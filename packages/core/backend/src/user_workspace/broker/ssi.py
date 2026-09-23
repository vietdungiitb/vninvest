"""B3.1: SSI broker-config schema + test-connection market-only (không OTP).

Signatures verified tại vnbroker tag v3.3.0 (SHA 541d7f22):
- SSIBrokerClient.__init__(client_id, api_key, api_secret, private_key, api_url, stream_url)
  → BẮT BUỘC keyword args (C2).
- authenticate(otp=None, transaction_id=None): không OTP = market-data-only.
Import lazy + chịu ImportError (image cũ chưa có lane SSI).
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

PROVIDER_ID = 'ssi'


def get_schema() -> dict:
    """Schema form động cho SSI (khớp §5 DE_XUAT)."""
    return {
        'provider': PROVIDER_ID,
        'test_connection_kind': 'market_only',
        'fields': [
            {
                'key': 'api_key',
                'type': 'password',
                'required': True,
                'secret': True,
                'label_i18n': 'broker.ssi.api_key',
                'placeholder': 'SSI API Key',
                'help_i18n': 'broker.ssi.api_key_help',
            },
            {
                'key': 'api_secret',
                'type': 'password',
                'required': True,
                'secret': True,
                'label_i18n': 'broker.ssi.api_secret',
                'placeholder': 'SSI API Secret',
                'help_i18n': 'broker.ssi.api_secret_help',
            },
            {
                'key': 'client_id',
                'type': 'text',
                'required': False,
                'secret': False,
                'label_i18n': 'broker.ssi.client_id',
                'placeholder': 'VD: 1234561 (cần cho số dư/vị thế)',
                'help_i18n': 'broker.ssi.client_id_help',
            },
            {
                'key': 'private_key',
                'type': 'password',
                'required': False,
                'secret': True,
                'label_i18n': 'broker.ssi.private_key',
                'placeholder': 'Chỉ cần khi bật đặt lệnh (ký RSA)',
                'help_i18n': 'broker.ssi.private_key_help',
            },
        ],
    }


def validate_secrets(secrets: dict) -> dict[str, str]:
    """Trả về {field: message} — rỗng = hợp lệ. Không log secret."""
    errors: dict[str, str] = {}
    secrets = secrets or {}
    for field in get_schema()['fields']:
        if not field.get('required'):
            continue
        value = str(secrets.get(field['key'], '') or '').strip()
        if not value:
            errors[field['key']] = 'required'
    return errors


def test_connection(secrets: dict) -> dict:
    """Market-only authenticate (không OTP). True + account_count, hoặc False + error."""
    secrets = secrets or {}
    api_key = str(secrets.get('api_key', '') or '').strip()
    api_secret = str(secrets.get('api_secret', '') or '').strip()
    if not api_key or not api_secret:
        return {'ok': False, 'error': 'missing_credentials'}
    try:
        from vnbroker.broker.ssi.client import SSIBrokerClient
    except ImportError as exc:
        logger.warning('ssi test_connection: vnbroker SSI lane unavailable — %s',
                       type(exc).__name__)
        return {'ok': False, 'error': 'vnbroker_unavailable'}
    try:
        # KEYWORD ARGS bắt buộc (C2): __init__(client_id, api_key, api_secret, ...)
        client = SSIBrokerClient(
            client_id=str(secrets.get('client_id', '') or '').strip() or None,
            api_key=api_key,
            api_secret=api_secret,
        )
        client.authenticate()  # market-only, không OTP
        accounts = client.get_account_list()
    except Exception as exc:  # noqa: BLE001 — mọi lỗi upstream thành error rõ
        logger.warning('ssi test_connection failed — %s', type(exc).__name__)
        return {'ok': False, 'error': f'{type(exc).__name__}'}
    try:
        count = len(accounts) if hasattr(accounts, '__len__') else 0
    except Exception:  # noqa: BLE001
        count = 0
    return {'ok': True, 'account_count': count}
