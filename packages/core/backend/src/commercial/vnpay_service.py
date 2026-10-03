import hashlib
import hmac
import urllib.parse
from datetime import datetime
import logging
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

logger = logging.getLogger(__name__)


class VNPayService:
    @staticmethod
    def get_tmn_code():
        return getattr(settings, 'VNPAY_TMN_CODE', 'TMNCODE_DEMO')

    @staticmethod
    def get_hash_secret():
        secret = getattr(settings, 'VNPAY_HASH_SECRET', '')
        secret = (secret or '').strip()
        # Fail closed AT POINT OF USE.
        #
        # The previous default was the public constant 'SECRET_DEMO'. That makes
        # every signature check pass with a key an attacker can read from the
        # repository, which turns the whole IPN endpoint into a no-op.
        #
        # This is deliberately not an env_validation boot check: `manage.py check`
        # and the pre-push hook run without the VNPay variables set, so requiring
        # them at boot would turn the push path red. Refuse here instead - only
        # when someone actually tries to use VNPay.
        if not secret or secret == 'SECRET_DEMO':
            raise ImproperlyConfigured(
                'VNPAY_HASH_SECRET is not configured (or is still the public demo '
                'value). Refusing to sign or verify VNPay traffic. Generate a real '
                'secret and set it in the environment.'
            )
        return secret

    @staticmethod
    def get_payment_url():
        return getattr(settings, 'VNPAY_PAYMENT_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html')

    @staticmethod
    def get_return_url():
        return getattr(settings, 'VNPAY_RETURN_URL', 'http://localhost:3000/commercial/payment-return')

    @classmethod
    def generate_payment_url(cls, txn_ref: str, amount: float, description: str, client_ip: str) -> str:
        """
        Generates signed VNPay URL for redirecting client to payment gateway.
        """
        vnp_params = {
            'vnp_Version': '2.1.0',
            'vnp_Command': 'pay',
            'vnp_TmnCode': cls.get_tmn_code(),
            'vnp_Amount': str(int(amount * 100)),  # VNPay expects amount * 100 for VND
            'vnp_CreateDate': datetime.now().strftime('%Y%m%d%H%M%S'),
            'vnp_CurrCode': 'VND',
            'vnp_IpAddr': client_ip or '127.0.0.1',
            'vnp_Locale': 'vn',
            'vnp_OrderInfo': description or f'Thanh toan hoa don {txn_ref}',
            'vnp_OrderType': 'other',
            'vnp_ReturnUrl': cls.get_return_url(),
            'vnp_TxnRef': txn_ref,
        }

        # Sort parameters alphabetically
        sorted_params = sorted(vnp_params.items())

        # Construct query string
        query_parts = []
        for key, val in sorted_params:
            query_parts.append(f"{urllib.parse.quote_plus(key)}={urllib.parse.quote_plus(str(val))}")

        query_string = "&".join(query_parts)

        # Calculate secure hash signature using HMAC-SHA512
        secret_bytes = cls.get_hash_secret().encode('utf-8')
        message_bytes = query_string.encode('utf-8')
        secure_hash = hmac.new(secret_bytes, message_bytes, hashlib.sha512).hexdigest()

        payment_url = f"{cls.get_payment_url()}?{query_string}&vnp_SecureHash={secure_hash}"
        # Never log the URL at INFO: it carries `vnp_SecureHash`, the HMAC of the
        # order. Log enough to correlate, not enough to forge.
        logger.info(
            'Generated VNPay URL for txn_ref=%s (hash redacted, %d chars)',
            txn_ref, len(secure_hash),
        )
        return payment_url

    @classmethod
    def verify_ipn_signature(cls, query_params: dict) -> bool:
        """
        Validates VNPay secure hash signature from query parameters dictionary.
        """
        secure_hash = query_params.get('vnp_SecureHash')
        # DRF `request.query_params.get()` returns a str, but a plain dict built
        # from `parse_qs`/`.getlist()` yields a list. Normalise both, otherwise the
        # comparison below silently compares the repr of a list.
        if isinstance(secure_hash, (list, tuple)):
            secure_hash = secure_hash[0] if secure_hash else ''
        if not secure_hash:
            logger.warning("No vnp_SecureHash found in VNPay query parameters.")
            return False

        # Filter out signature parameters
        hash_params = {k: v for k, v in query_params.items() if k not in ('vnp_SecureHash', 'vnp_SecureHashType')}

        # Sort and construct signature message
        sorted_params = sorted(hash_params.items())
        query_parts = []
        for key, val in sorted_params:
            # Note: VNPay sends list or str for query parameters
            actual_val = val[0] if isinstance(val, list) else val
            query_parts.append(f"{urllib.parse.quote_plus(key)}={urllib.parse.quote_plus(str(actual_val))}")

        query_string = "&".join(query_parts)

        secret_bytes = cls.get_hash_secret().encode('utf-8')
        message_bytes = query_string.encode('utf-8')
        calculated_hash = hmac.new(secret_bytes, message_bytes, hashlib.sha512).hexdigest()

        is_valid = hmac.compare_digest(
            calculated_hash.lower(), str(secure_hash).lower()
        )
        if not is_valid:
            # Do not print either hash: on a mismatch an operator reading the log
            # learns nothing useful, but a log shipper now holds a valid HMAC.
            logger.warning("VNPay signature mismatch for the supplied parameters.")
        return is_valid
