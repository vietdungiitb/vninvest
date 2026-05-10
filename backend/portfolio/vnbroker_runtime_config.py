import copy
import logging
from typing import Any

from django.core.cache import cache

logger = logging.getLogger(__name__)

VNBROKER_RUNTIME_CACHE_KEY = 'admin_ops:vnbroker_runtime_config'
VNBROKER_RUNTIME_CACHE_TTL_SECONDS = 300

ALLOWED_VNBROKER_SOURCES = {'VCI', 'KBS', 'TCBS', 'SSI'}
TIMEOUT_CHANNELS = {'price_board', 'intraday', 'financial_ratio', 'history', 'listing', 'general'}


def default_vnbroker_runtime_settings() -> dict[str, Any]:
    return {
        'max_concurrency': 12,
        'retry_attempts': 1,
        'retry_backoff_seconds': 0.35,
        'rate_limit_cooldown_seconds': 20,
        'timeout_config': {
            'price_board': 8,
            'intraday': 8,
            'financial_ratio': 10,
            'history': 12,
            'listing': 12,
            'general': 8,
        },
        'price_board_source': 'KBS',
        'fallback_sources': ['VCI'],
        'enable_caching': True,
        'enable_rate_limit_detection': True,
        'enable_concurrent_limit': True,
    }


def coerce_vnbroker_runtime_settings(raw_payload: dict[str, Any] | None, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or default_vnbroker_runtime_settings()

    def _to_int(key: str, minimum: int, maximum: int) -> int:
        try:
            parsed = int(payload.get(key, base[key]))
        except (TypeError, ValueError):
            raise ValueError(f'{key} phải là số nguyên hợp lệ.')
        if parsed < minimum or parsed > maximum:
            raise ValueError(f'{key} phải nằm trong khoảng [{minimum}, {maximum}].')
        return parsed

    def _to_float(key: str, minimum: float, maximum: float) -> float:
        try:
            parsed = float(payload.get(key, base[key]))
        except (TypeError, ValueError):
            raise ValueError(f'{key} phải là số hợp lệ.')
        if parsed < minimum or parsed > maximum:
            raise ValueError(f'{key} phải nằm trong khoảng [{minimum}, {maximum}].')
        return parsed

    max_concurrency = _to_int('max_concurrency', 1, 50)
    retry_attempts = _to_int('retry_attempts', 0, 5)
    retry_backoff_seconds = _to_float('retry_backoff_seconds', 0.0, 5.0)
    rate_limit_cooldown_seconds = _to_int('rate_limit_cooldown_seconds', 5, 120)

    timeout_payload = payload.get('timeout_config', base['timeout_config'])
    if not isinstance(timeout_payload, dict):
        raise ValueError('timeout_config phải là object hợp lệ.')

    timeout_config = {}
    for channel in TIMEOUT_CHANNELS:
        raw_value = timeout_payload.get(channel, base['timeout_config'][channel])
        try:
            timeout_value = int(raw_value)
        except (TypeError, ValueError):
            raise ValueError(f'timeout_config.{channel} phải là số nguyên hợp lệ.')
        if timeout_value < 1 or timeout_value > 120:
            raise ValueError(f'timeout_config.{channel} phải nằm trong khoảng [1, 120].')
        timeout_config[channel] = timeout_value

    price_board_source = str(payload.get('price_board_source', base['price_board_source']) or '').strip().upper()
    if not price_board_source:
        price_board_source = base['price_board_source']
    if price_board_source not in ALLOWED_VNBROKER_SOURCES:
        raise ValueError('price_board_source không hợp lệ.')

    fallback_raw = payload.get('fallback_sources', base['fallback_sources'])
    if not isinstance(fallback_raw, list):
        raise ValueError('fallback_sources phải là danh sách.')

    fallback_sources: list[str] = []
    for item in fallback_raw:
        source = str(item or '').strip().upper()
        if not source:
            continue
        if source not in ALLOWED_VNBROKER_SOURCES:
            raise ValueError(f'fallback_sources chứa provider không hợp lệ: {source}')
        if source not in fallback_sources:
            fallback_sources.append(source)

    if price_board_source not in fallback_sources:
        fallback_sources.insert(0, price_board_source)

    return {
        'max_concurrency': max_concurrency,
        'retry_attempts': retry_attempts,
        'retry_backoff_seconds': retry_backoff_seconds,
        'rate_limit_cooldown_seconds': rate_limit_cooldown_seconds,
        'timeout_config': timeout_config,
        'price_board_source': price_board_source,
        'fallback_sources': fallback_sources,
        'enable_caching': bool(payload.get('enable_caching', base['enable_caching'])),
        'enable_rate_limit_detection': bool(payload.get('enable_rate_limit_detection', base['enable_rate_limit_detection'])),
        'enable_concurrent_limit': bool(payload.get('enable_concurrent_limit', base['enable_concurrent_limit'])),
    }


def invalidate_vnbroker_runtime_cache() -> None:
    cache.delete(VNBROKER_RUNTIME_CACHE_KEY)


def get_vnbroker_runtime_settings(force_refresh: bool = False) -> dict[str, Any]:
    if not force_refresh:
        cached = cache.get(VNBROKER_RUNTIME_CACHE_KEY)
        if isinstance(cached, dict):
            return copy.deepcopy(cached)

    defaults = default_vnbroker_runtime_settings()
    try:
        from .models import RuntimeVnbrokerConfig

        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        normalized = coerce_vnbroker_runtime_settings(config.to_runtime_dict(), fallback=defaults)
    except Exception:
        logger.exception('Failed to load RuntimeVnbrokerConfig; fallback to defaults')
        normalized = defaults

    cache.set(VNBROKER_RUNTIME_CACHE_KEY, normalized, timeout=VNBROKER_RUNTIME_CACHE_TTL_SECONDS)
    return copy.deepcopy(normalized)
