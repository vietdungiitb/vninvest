"""
Realtime cache and rate-limit helpers extraction from legacy views.

This module provides cache storage and rate-limit state management for realtime endpoints,
without depending on legacy_views.py. All operations emit observability metrics.
"""
import logging
from django.core.cache import cache
from portfolio.services_realtime_metrics import increment_realtime_metric

logger = logging.getLogger(__name__)

# Rate-limit state cache keys
VNSTOCK_RATE_LIMIT_CACHE_PREFIX = 'vnstock:rate-limit'
VNSTOCK_TIMEOUT_COUNTER_KEY = 'vnstock:timeout-counter:price_board'


def _cache_get(cache_key: str):
    """
    Get value from cache by key. Safe wrapper for django cache.get.
    Emits metrics: cache_hits_total, cache_misses_total, cache_errors_total
    
    Args:
        cache_key: Cache key string
        
    Returns:
        Cached value or None if not found or expired
    """
    try:
        value = cache.get(cache_key)
        if value is not None:
            increment_realtime_metric('cache_hits_total')
        else:
            increment_realtime_metric('cache_misses_total')
        return value
    except Exception as exc:
        increment_realtime_metric('cache_errors_total')
        logger.debug('cache.get error for %s: %s', cache_key, exc)
        return None


def _cache_set(cache_key: str, value, timeout: int = 60):
    """
    Set value in cache by key with optional timeout.
    Emits metrics: cache_sets_total, cache_errors_total
    
    Args:
        cache_key: Cache key string
        value: Value to store
        timeout: Timeout in seconds (default 60)
    """
    try:
        cache.set(cache_key, value, timeout=timeout)
        increment_realtime_metric('cache_sets_total')
    except Exception as exc:
        increment_realtime_metric('cache_errors_total')
        logger.debug('cache.set error for %s: %s', cache_key, exc)


def _is_vnstock_rate_limited(endpoint: str) -> bool:
    """
    Check if vnstock endpoint is currently rate-limited (cooldown active).
    
    Args:
        endpoint: Endpoint name like 'price_board', 'intraday'
        
    Returns:
        True if rate-limited cooldown is active, False otherwise
    """
    cache_key = f'{VNSTOCK_RATE_LIMIT_CACHE_PREFIX}:{endpoint}'
    try:
        state = cache.get(cache_key)
        return state is not None
    except Exception as exc:
        logger.debug('_is_vnstock_rate_limited error for %s: %s', endpoint, exc)
        return False


def _mark_vnstock_rate_limited(endpoint: str, exc: Exception | None = None, cooldown_seconds: int = 20):
    """
    Mark vnstock endpoint as rate-limited and set cooldown window.
    Emits metrics: realtime_rate_limit_events_total (with endpoint suffix)
    
    Args:
        endpoint: Endpoint name like 'price_board', 'intraday', 'financial_ratio'
        exc: Exception object (for logging)
        cooldown_seconds: Cooldown duration in seconds (default 20)
    """
    cache_key = f'{VNSTOCK_RATE_LIMIT_CACHE_PREFIX}:{endpoint}'
    try:
        cache.set(
            cache_key,
            {
                'triggered_at': __import__('django.utils.timezone', fromlist=['now']).now().isoformat(),
                'reason': str(exc or '')[:200],
            },
            timeout=max(cooldown_seconds, 5),
        )
        increment_realtime_metric('realtime_rate_limit_events_total', suffix=endpoint)
        logger.warning('vnstock %s rate-limited for %ds', endpoint, cooldown_seconds)
    except Exception as set_exc:
        logger.debug('_mark_vnstock_rate_limited error for %s: %s', endpoint, set_exc)


def _clear_vnstock_rate_limit(endpoint: str):
    """
    Clear rate-limit state for a vnstock endpoint.
    
    Args:
        endpoint: Endpoint name like 'price_board', 'intraday'
    """
    cache_key = f'{VNSTOCK_RATE_LIMIT_CACHE_PREFIX}:{endpoint}'
    try:
        cache.delete(cache_key)
    except Exception as exc:
        logger.debug('_clear_vnstock_rate_limit error for %s: %s', endpoint, exc)
