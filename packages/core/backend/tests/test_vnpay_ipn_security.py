"""A3/A4 - VNPay IPN phai fail-closed ve secret va so tien.

## Bang chung goc (2 loi doc tu file that)

1. `commercial/vnpay_service.py:18` (cu) tra `getattr(settings, 'VNPAY_HASH_SECRET',
   'SECRET_DEMO')`. `SECRET_DEMO` la hang so cong khai trong repo => kiem tra chu ky
   luon PASS bang khoa ma doc duoc tu GitHub => endpoint IPN vo hieu hoa.

2. `commercial/views.py:252` (cu):
   ```python
   except (ValueError, TypeError):
       ipn_amount = -1
   if ipn_amount >= 0 and ipn_amount != txn.amount:
   ```
   `vnp_Amount=notanumber` => `ipn_amount = -1` => `>= 0` sai => **BO QUA** kiem
   tra so tien. Day la fail-open: input khong parse duoc la tu tat kiem tra.

## Vì sao kiem secret khong dua vao env_validation

`manage.py check` va `.githooks/pre-push` chay khi env khong co bien VNPay. Bat buoc
o boot se lam do duong push. Nay chan TAI THOI DIEM DUNG.
"""

import os
import sys
import uuid

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django

django.setup()

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase, override_settings

from commercial.vnpay_service import VNPayService


class VNPaySecretFailClosedTests(SimpleTestCase):
    """A4: secret demo khong duoc phep ky hoac xac thuc."""

    @override_settings(VNPAY_HASH_SECRET='')
    def test_empty_secret_refuses_to_sign(self):
        with self.assertRaises(ImproperlyConfigured):
            VNPayService.get_hash_secret()

    @override_settings(VNPAY_HASH_SECRET='SECRET_DEMO')
    def test_demo_secret_refuses_to_sign(self):
        with self.assertRaises(ImproperlyConfigured):
            VNPayService.get_hash_secret()

    @override_settings(VNPAY_HASH_SECRET=None)
    def test_missing_secret_refuses_to_sign(self):
        with self.assertRaises(ImproperlyConfigured):
            VNPayService.get_hash_secret()

    @override_settings(VNPAY_HASH_SECRET='   ')
    def test_whitespace_secret_refuses_to_sign(self):
        with self.assertRaises(ImproperlyConfigured):
            VNPayService.get_hash_secret()

    @override_settings(VNPAY_HASH_SECRET='a-real-secret-value')
    def test_real_secret_is_accepted(self):
        self.assertEqual(VNPayService.get_hash_secret(), 'a-real-secret-value')


class VNPaySignatureTests(SimpleTestCase):
    """Chu ky dung secret thi verify that; sai thi tu choi."""

    @override_settings(VNPAY_HASH_SECRET='a-real-secret-value', VNPAY_PAYMENT_URL='https://sandbox.vnpayment.vn/pay')
    def test_signature_roundtrip(self):
        url = VNPayService.generate_payment_url(
            txn_ref='TX-1',
            amount=100000,
            description='test order',
            client_ip='127.0.0.1',
        )
        import urllib.parse as up
        # Real callers pass DRF `request.query_params`, whose `.get()` yields a str.
        # Flatten `parse_qs` output to that shape.
        flat = {k: v[0] for k, v in up.parse_qs(up.urlparse(url).query).items()}
        self.assertIn('vnp_SecureHash', flat)
        self.assertTrue(VNPayService.verify_ipn_signature(flat))

    @override_settings(VNPAY_HASH_SECRET='a-real-secret-value', VNPAY_PAYMENT_URL='https://sandbox.vnpayment.vn/pay')
    def test_signature_roundtrip_accepts_list_values(self):
        """A plain dict from `parse_qs`/`.getlist()` carries lists, not strings.

        The signing message builder already unwrapped list values for every
        parameter except `vnp_SecureHash`, so a callback assembled that way
        compared the repr of a list against the digest and never verified.
        """
        url = VNPayService.generate_payment_url(
            txn_ref='TX-2',
            amount=50000,
            description='list shape',
            client_ip='127.0.0.1',
        )
        import urllib.parse as up
        listed = dict(up.parse_qs(up.urlparse(url).query))
        self.assertIsInstance(listed['vnp_SecureHash'], list)
        self.assertTrue(VNPayService.verify_ipn_signature(listed))

    @override_settings(VNPAY_HASH_SECRET='a-real-secret-value')
    def test_tampered_amount_fails_verification(self):
        params = {
            'vnp_TxnRef': 'TX-1',
            'vnp_Amount': '100000',
            'vnp_ResponseCode': '00',
        }
        import hmac as _hmac
        import hashlib as _hl
        import urllib.parse as up
        parts = []
        for k, v in sorted(params.items()):
            parts.append(f'{up.quote_plus(k)}={up.quote_plus(str(v))}')
        qs = '&'.join(parts)
        good = _hmac.new(b'a-real-secret-value', qs.encode(), _hl.sha512).hexdigest()

        tampered = dict(params, vnp_Amount='1')
        self.assertFalse(
            VNPayService.verify_ipn_signature({**tampered, 'vnp_SecureHash': good})
        )

    @override_settings(VNPAY_HASH_SECRET='a-real-secret-value')
    def test_missing_hash_is_rejected(self):
        self.assertFalse(VNPayService.verify_ipn_signature({'vnp_TxnRef': 'X'}))