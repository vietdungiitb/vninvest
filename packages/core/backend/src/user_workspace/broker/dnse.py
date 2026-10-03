"""B1.2: DNSE broker-config schema + test-connection read-only.

Schema dùng render form động ở FE (`GET broker/config-schema/dnse/`).
test_connection chỉ đọc (get_accounts), không tạo phiên trade, không gửi OTP.
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

PROVIDER_ID = 'dnse'


def get_schema() -> dict:
    """Schema form động cho DNSE (khớp §5 DE_XUAT)."""
    return {
        'provider': PROVIDER_ID,
        'test_connection_kind': 'accounts',
        'fields': [
            {
                'key': 'client_id',
                'type': 'text',
                'required': True,
                'secret': True,
                'label_i18n': 'broker.dnse.client_id',
                'placeholder': 'EntradeX → LightSpeed API → Client ID',
                'help_i18n': 'broker.dnse.client_id_help',
            },
            {
                'key': 'client_secret',
                'type': 'password',
                'required': True,
                'secret': True,
                'label_i18n': 'broker.dnse.client_secret',
                'placeholder': 'Client Secret',
                'help_i18n': 'broker.dnse.client_secret_help',
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
    """Kiểm tra read-only: True + account_count, hoặc False + error (không chứa secret)."""
    from user_workspace.vnbroker_dnse_compat import build_dnse_client

    secrets = secrets or {}
    client_id = str(secrets.get('client_id', '') or '').strip()
    client_secret = str(secrets.get('client_secret', '') or '').strip()
    if not client_id or not client_secret:
        return {'ok': False, 'error': 'missing_credentials'}
    try:
        client = build_dnse_client(client_id=client_id, client_secret=client_secret)
        accounts = client.get_accounts(raw=False)
    except ImportError as exc:
        logger.warning('dnse test_connection: vnbroker unavailable — %s', type(exc).__name__)
        return {'ok': False, 'error': 'vnbroker_unavailable'}
    except Exception as exc:  # noqa: BLE001 — mọi lỗi upstream đều thành error rõ, không raise
        logger.warning('dnse test_connection failed — %s', type(exc).__name__)
        return {'ok': False, 'error': f'{type(exc).__name__}'}
    try:
        count = len(accounts) if hasattr(accounts, '__len__') else 0
    except Exception:  # noqa: BLE001
        count = 0
    return {'ok': True, 'account_count': count}
