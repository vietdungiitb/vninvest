"""B3.2: TCBS broker-config schema + test-connection unverified-flow (cần OTP mới connected).

Signatures verified tại vnbroker tag v3.4.0 (commit 1ff04e60):
- TCBSBrokerClient.__init__(api_key, base_url, custody_code) → keyword args.
- authenticate(otp: str) — BẮT BUỘC OTP nên test-connection KHÔNG gọi authenticate;
  chỉ check format + is_token_valid==False → status 'unverified' + hướng dẫn OTP ở pha trade.
P1-SEC-01: `base_url` không còn tự do — validate qua egress allowlist (broker/egress.py).
Import lazy + chịu ImportError (image cũ chưa có lane TCBS).
"""
from __future__ import annotations

import logging
import re

from .egress import EgressPolicyError, validate_base_url

logger = logging.getLogger(__name__)

PROVIDER_ID = 'tcbs'

# Custody TCBS thường dạng số/105C — validate LỎNG (warn, không chặn) tới khi xác nhận prod (G4).
CUSTODY_HINT_PATTERN = re.compile(r'^[0-9A-Za-z]{4,20}$')


def get_schema() -> dict:
    """Schema form động cho TCBS (khớp §5 DE_XUAT)."""
    return {
        'provider': PROVIDER_ID,
        'test_connection_kind': 'format_only',
        'fields': [
            {
                'key': 'api_key',
                'type': 'password',
                'required': True,
                'secret': True,
                'label_i18n': 'broker.tcbs.api_key',
                'placeholder': 'TCBS OpenAPI Key',
                'help_i18n': 'broker.tcbs.api_key_help',
            },
            {
                'key': 'custody_code',
                'type': 'text',
                'required': False,
                'secret': False,
                'label_i18n': 'broker.tcbs.custody_code',
                'placeholder': 'VD: 105C... (tùy chọn)',
                'help_i18n': 'broker.tcbs.custody_code_help',
            },
            {
                'key': 'base_url',
                'type': 'text',
                'required': False,
                'secret': False,
                # P1-SEC-01: endpoint KHÔNG tự do — chỉ host trong allowlist
                # server-side (broker/egress.py) mới được nhận.
                'egress_restricted': True,
                'label_i18n': 'broker.tcbs.base_url',
                'placeholder': 'Để trống = mặc định iFlash',
                'help_i18n': 'broker.tcbs.base_url_help',
            },
        ],
    }


def validate_secrets(secrets: dict) -> dict[str, str]:
    """Trả về {field: message} — rỗng = hợp lệ. custody sai format chỉ cảnh báo ở FE.

    P1-SEC-01: `base_url` phải qua egress allowlist. Message là CODE cố định, không
    echo giá trị người dùng nhập (giá trị đó có thể chứa host nội bộ/khoá đã rot).
    """
    errors: dict[str, str] = {}
    secrets = secrets or {}
    if not str(secrets.get('api_key', '') or '').strip():
        errors['api_key'] = 'required'
    try:
        validate_base_url(PROVIDER_ID, secrets.get('base_url'))
    except EgressPolicyError as exc:
        errors['base_url'] = exc.code
    return errors


def test_connection(secrets: dict) -> dict:
    """Không OTP → không thể connected: trả unverified + kiểm tra lane tồn tại.

    Trả về {'ok': False, 'unverified': True} khi config hợp lệ nhưng thiếu OTP;
    task sẽ map sang status 'unverified' (KHÔNG phải error).
    P1-SEC-01: base_url sai ⇒ fail-closed với code, KHÔNG im lặng rơi về default.
    """
    secrets = secrets or {}
    errors = validate_secrets(secrets)
    if errors.get('base_url'):
        return {'ok': False, 'error': errors['base_url']}
    if errors:
        return {'ok': False, 'error': 'missing_credentials'}
    try:
        from vnbroker.broker.tcbs.client import TCBSBrokerClient  # noqa: F401
    except ImportError as exc:
        logger.warning('tcbs test_connection: vnbroker TCBS lane unavailable — %s',
                       type(exc).__name__)
        return {'ok': False, 'error': 'vnbroker_unavailable'}
    custody = str(secrets.get('custody_code', '') or '').strip()
    note = None
    if custody and not CUSTODY_HINT_PATTERN.match(custody):
        note = 'custody_format_unconfirmed'
    return {'ok': False, 'unverified': True, 'error': 'otp_required', 'note': note}
