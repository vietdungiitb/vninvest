"""B1.1: Broker config substrate — mask preview + schema interface (đa-broker dnse/ssi/tcbs).

Mọi secret chỉ xuất hiện ở BE memory; response/API chỉ trả bản mask (****).
"""
from __future__ import annotations

from typing import Any

# Field secret theo provider (§5 DE_XUAT). Non-secret (custody_code, base_url, device_id...)
# được giữ nguyên trong preview để user nhận diện cấu hình của mình.
PROVIDER_SECRET_KEYS: dict[str, frozenset[str]] = {
    'dnse': frozenset({'client_id', 'client_secret'}),
    'ssi': frozenset({'api_key', 'api_secret', 'private_key'}),
    'tcbs': frozenset({'api_key'}),
}

# Số ký tự đầu được lộ trong preview (đủ nhận diện, không đủ dùng).
PREVIEW_VISIBLE_CHARS = 4


def mask_value(value: Any) -> str:
    text = str(value or '')
    if not text:
        return ''
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
