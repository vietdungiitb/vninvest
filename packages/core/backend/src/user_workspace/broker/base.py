"""B1.1: Broker config substrate — mask preview + schema interface (đa-broker dnse/ssi/tcbs).

Mọi secret chỉ xuất hiện ở BE memory; response/API chỉ trả bản mask (****).
"""
from __future__ import annotations

from typing import Any

# Field secret theo provider (§5 DE_XUAT). Non-secret (custody_code, base_url, device_id...)
# được giữ nguyên trong preview để user nhận diện cấu hình của mình.
# LƯU Ý P1-SEC-01: `base_url` là non-secret (không lộ khoá) nhưng KHÔNG còn là input tự do —
# nó phải qua egress allowlist (broker/egress.py). Non-secret ≠ tin cậy.
PROVIDER_SECRET_KEYS: dict[str, frozenset[str]] = {
    'dnse': frozenset({'client_id', 'client_secret'}),
    'ssi': frozenset({'api_key', 'api_secret', 'private_key'}),
    'tcbs': frozenset({'api_key'}),
}

# Số ký tự đầu được lộ trong preview (đủ nhận diện, không đủ dùng).
PREVIEW_VISIBLE_CHARS = 4

# ---------------------------------------------------------------------------
# conn-hardening: fail-fast HÌNH DẠNG secret (không thay thế xác minh live).
# ---------------------------------------------------------------------------
# Vì sao chỉ max + charset, KHÔNG min-length: chưa từng thấy credential thật
# của broker (Owner cấp sau) nên mọi min-length đều là đoán mò (L-V02). Min
# thật lấy từ tài liệu từng broker rồi bổ sung sau (xem
# `docs/CREDENTIAL_CHECKLIST_BROKER_20261016.md`).
# Quy tắc này bắt: paste nhầm (2000 ký tự), binary/control-char lọt vào,
# whitespace-only đã strip (required báo 'required', shape bỏ qua rỗng).
SECRET_MAX_LENGTH: dict[str, int] = {
    'client_id': 128,
    'client_secret': 512,
    'api_key': 256,
    'api_secret': 1024,
    'private_key': 8192,  # PEM RSA ~1-2KB + biên an toàn
    'custody_code': 64,
}

# Điều khiển nhị phân (trừ \t\n\r cho PEM) không bao giờ là credential hợp lệ.
_CONTROL_CHARS = frozenset(chr(c) for c in list(range(0x00, 0x20)) + [0x7F])
_CONTROL_CHARS_ALLOWED = frozenset({'\t', '\n', '\r'})


def check_secret_shape(key: str, value: object) -> str | None:
    """Trả về error code cố định hoặc None (= qua). Không log, không echo value.

    Codes: 'too_long' | 'invalid_characters'. Rỗng/None → None (rule
    'required' của từng lane sở hữu trường hợp đó). Key lạ → None (không
    chặn field tương lai).
    """
    text = str(value or '')
    if not text.strip():
        return None
    limit = SECRET_MAX_LENGTH.get(str(key or ''))
    if limit is not None and len(text) > limit:
        return 'too_long'
    for char in text:
        if char in _CONTROL_CHARS and char not in _CONTROL_CHARS_ALLOWED:
            return 'invalid_characters'
    return None

# ---------------------------------------------------------------------------
# C-04: capability matrix là DỮ LIỆU VERSIONED, không phải hằng trong view
# ---------------------------------------------------------------------------
# Vì sao: `views_broker.py` hardcode `FULLY_SUPPORTED = {'dnse','ssi','tcbs'}` trong khi
# `tcbs.py` tự trả `unverified` (cần OTP) và `ssi.py` mới chỉ test market-only. UI đọc
# hằng đó sẽ hiểu là "đã hỗ trợ đầy đủ" trong khi contract chưa hoàn chỉnh.
#
# Cách dùng (coordinator nối vào `views_broker.py`, file ngoài phạm vi của slice này):
#     from .broker.base import capability_matrix, is_fully_supported
#     FULLY_SUPPORTED = frozenset(providers_requiring_capability_review())  # hoặc
#     if not is_fully_supported(normalized): raise not_supported_yet
#
# Nguyên tắc: `verified_contract` = đã chứng minh end-to-end bằng contract test + live probe.
# `read_basic` chỉ = đọc được tài khoản/số dư/vị thế/lệnh. `trade` = đặt lệnh (cần OTP
# + private key + chữ ký), chưa provider nào bật ở pha này.
CAPABILITY_MATRIX_VERSION = '2026-09-26.1'

PROVIDER_CAPABILITIES: dict[str, dict] = {
    'dnse': {
        'read_basic': True,
        'read_positions': True,
        'read_orders': True,
        'trade': False,
        'otp_required': False,
        'verified_contract': True,
        'verified_contract_by': 'contract test + live sync production',
    },
    'ssi': {
        'read_basic': True,
        'read_positions': True,
        'read_orders': True,
        'trade': False,
        'otp_required': True,
        'verified_contract': False,
        'verified_contract_by': 'chỉ market-only; chưa có probe số dư/vị thế thật',
    },
    'tcbs': {
        'read_basic': True,
        'read_positions': True,
        'read_orders': True,
        'trade': False,
        'otp_required': True,
        'verified_contract': False,
        'verified_contract_by': 'chỉ format-valid; chưa xác minh OTP',
    },
}


def capability_matrix() -> dict:
    """Bản capability kèm version — client phải đọc `version` để biết cache cũ hay không."""
    return {
        'version': CAPABILITY_MATRIX_VERSION,
        'providers': {key: dict(value) for key, value in PROVIDER_CAPABILITIES.items()},
    }


def is_fully_supported(provider: str) -> bool:
    """Chỉ `dnse` là fully supported; `ssi`/`tcbs` đã có khung nhưng contract chưa đủ."""
    return bool(PROVIDER_CAPABILITIES.get(
        str(provider or '').strip().lower(), {}).get('verified_contract'))


def providers_pending_capability_review() -> list[str]:
    """Provider đã có khung nhưng contract chưa xác minh ⇒ UI không được báo "đã hỗ trợ"."""
    return sorted(key for key, value in PROVIDER_CAPABILITIES.items()
                  if not value.get('verified_contract'))


def mask_value(value: Any) -> str:
    text = str(value or '')
    if not text:
        return ''
    if len(text) <= PREVIEW_VISIBLE_CHARS:
        return '****'  # secret ngắn: che toàn bộ (khỏi lộ nguyên văn)
    return text[:PREVIEW_VISIBLE_CHARS] + '****'


def mask_secrets_preview(provider: str, secrets: dict) -> dict:
    """Trả preview an toàn: secret → 'abcd****', non-secret giữ nguyên, không bao giờ lộ full."""
    secret_keys = PROVIDER_SECRET_KEYS.get(str(provider or '').lower(), frozenset())
    preview: dict[str, Any] = {}
    for key, value in (secrets or {}).items():
        if key in secret_keys:
            preview[key] = mask_value(value)
        else:
            preview[key] = value
    return preview
