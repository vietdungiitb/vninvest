"""R2.10 - danh mục model **theo tài khoản**, cache theo provider + credential.

Vì sao không hardcode danh sách: tài liệu GitHub nói rõ danh mục Copilot phụ thuộc
*"subscription, org membership, and feature flags"* theo tài khoản. Liệt kê model
user **không có quyền** ⇒ họ chọn xong mới nhận 404/403 — cùng loại lỗi "hiển thị
sai rồi mới biết" như `ai_ready` giả (F-06).

Nguyên tắc (AC2): provider trả rỗng / lỗi / chưa có key ⇒ `models=[]` +
`catalog_source="unavailable"`. **Không** thay bằng danh sách tự chế ra.

Cache: khoá = `provider + sha256(credential)` ⇒ danh sách của user A không lẫn sang
user B, và **khoá cache không chứa API key** (chỉ có hash). TTL mỗi provider: copilot
bám vòng đời session token (~25 phút), provider khác 24h — catalog của họ đổi chậm.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

CATALOG_SOURCE_PROVIDER = 'provider'
CATALOG_SOURCE_UNAVAILABLE = 'unavailable'

#: TTL theo provider (giây).
TTL_SECONDS = {
    # Session token Copilot sống ~25 phút ⇒ catalog cũng hạn theo vòng đời token.
    'copilot': 1500,
}
DEFAULT_TTL_SECONDS = 86400  # 24h cho provider khác

#: Nhãn provider mà mô hình chỉ dùng được ở đó (AC9).
PROVIDER_LABELS = {
    'openai': 'OpenAI',
    'gemini': 'Google Gemini',
    'claude': 'Anthropic Claude',
    'copilot': 'GitHub Copilot',
    'local': 'Local',
    'openclaw': 'OpenClaw',
}

_NOTE_TIERED_ONLY = 'Chỉ dùng được qua provider {label}'

#: Cache process-level: key -> (expires_at, payload).
_CATALOG_CACHE: dict = {}


def ttl_seconds_for(provider: str) -> int:
    return TTL_SECONDS.get((provider or '').strip().lower(), DEFAULT_TTL_SECONDS)


def _cache_key(provider: str, credential: str) -> str:
    """Khoá cache = provider + sha256(credential). KHÔNG chứa bản thân key."""
    digest = hashlib.sha256((credential or '').encode('utf-8')).hexdigest()[:32]
    return f'{(provider or "").strip().lower()}:{digest}'


def clear_catalog_cache() -> int:
    with_cache = _CATALOG_CACHE
    count = len(with_cache)
    with_cache.clear()
    return count


def provider_note(model: str, providers_with_model) -> str:
    """AC9 (BE phần): nhãn khi mô hình chỉ tồn tại ở đúng một provider.

    Danh sách rỗng ⇒ không nhãn (chưa biết gì, không đoán).
    """
    providers = sorted({(p or '').strip().lower() for p in providers_with_model if p})
    if len(providers) != 1:
        return ''
    label = PROVIDER_LABELS.get(providers[0], providers[0])
    return _NOTE_TIERED_ONLY.format(label=label)


def _normalize(entries) -> list:
    """AC6: chỉ giữ model `policy.state == enabled` và cho phép chọn trong picker."""
    models = []
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        model_id = str(entry.get('id') or '').strip()
        if not model_id:
            continue
        state = str(entry.get('policy_state') or 'enabled').strip().lower()
        if state and state != 'enabled':
            continue
        if entry.get('model_picker_enabled') is False:
            continue
        models.append({
            'id': model_id,
            'name': str(entry.get('name') or model_id),
            # AC7: context_window đi kèm để user chọn đúng cho ngữ cảnh dài.
            'context_window': entry.get('context_window'),
            'vendor': str(entry.get('vendor') or ''),
            'policy_state': state or 'enabled',
        })
    return models


def fetch_catalog(
    provider: str,
    *,
    api_key: str = '',
    custom_endpoint: str = '',
    ai_model: str = '',
    client=None,
    use_cache: bool = True,
) -> dict:
    """Lấy danh mục model thật của provider. Không bao giờ trả list bịa."""
    provider_key = (provider or '').strip().lower()
    ttl = ttl_seconds_for(provider_key)

    if use_cache:
        cached = _CATALOG_CACHE.get(_cache_key(provider_key, api_key))
        if cached is not None and cached[0] > time.time():
            return {**cached[1], 'cached': True}

    if client is None:
        # Không có credential ⇒ không có danh mục xác minh được.
        if not api_key and provider_key not in ('local', 'openclaw'):
            return _unavailable(ttl)
        try:
            from advisory.ai_clients import get_ai_client

            client = get_ai_client(
                provider_key, api_key=api_key or '',
                custom_endpoint=custom_endpoint or '', ai_model=ai_model or '',
            )
        except Exception:
            logger.info('catalog: khong tao duoc client cho %s', provider_key, exc_info=True)
            return _unavailable(ttl)

    try:
        raw = asyncio.run(client.catalog())
    except Exception:
        logger.info('catalog: provider %s loi', provider_key, exc_info=True)
        return _unavailable(ttl)

    if raw is None:
        return _unavailable(ttl)
    models = _normalize(raw)
    if not models:
        return _unavailable(ttl)

    payload = {
        'models': models,
        'catalog_source': CATALOG_SOURCE_PROVIDER,
        'ttl_seconds': ttl,
        'fetched_at': int(time.time()),
    }
    if use_cache:
        _CATALOG_CACHE[_cache_key(provider_key, api_key)] = (
            time.time() + ttl, payload,
        )
    return {**payload, 'cached': False}


def _unavailable(ttl: int) -> dict:
    return {
        'models': [],
        'catalog_source': CATALOG_SOURCE_UNAVAILABLE,
        'ttl_seconds': ttl,
        'fetched_at': int(time.time()),
        'cached': False,
    }