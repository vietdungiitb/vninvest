"""
Observability metrics for realtime cache and adapter operations.

Metrics are persisted in cache with daily rollover (24h timeout).
Supports suffixes for per-endpoint or per-tier breakdowns.

Metrics tracked:
- cache_hits_total: successful cache.get() retrievals
- cache_misses_total: cache.get() returning None  
- cache_sets_total: successful cache.set() operations
- cache_errors_total: exceptions during cache ops
- realtime_rate_limit_events_total: #times endpoint marked as rate-limited
- realtime_upstream_calls_total: #calls to vnstock endpoints (suffix: endpoint name)
- realtime_upstream_errors_total: #errors from upstream calls (suffix: endpoint name)
"""
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

REALTIME_METRICS_CACHE_PREFIX = 'ticker:realtime:metrics'


def _metric_cache_key(name: str, suffix: str | None = None) -> str:
    """Build cache key for metric."""
    if suffix:
        return f'{REALTIME_METRICS_CACHE_PREFIX}:{name}:{suffix}'
    return f'{REALTIME_METRICS_CACHE_PREFIX}:{name}'


def increment_realtime_metric(
    name: str,
    *,
    suffix: str | None = None,
    amount: int = 1,
    timeout: int = 60 * 60 * 24,
) -> int:
    """
    Increment a realtime metric counter (atomically or fallback).
    
    Args:
        name: Metric name (e.g., 'cache_hits_total')
        suffix: Optional suffix for breakdown (e.g., endpoint name)
        amount: Increment amount (default 1)
        timeout: Cache TTL in seconds (default 24h)
        
    Returns:
        New value after increment
    """
    key = _metric_cache_key(name, suffix=suffix)
    try:
        # Try atomic increment via cache
        if cache.add(key, int(amount), timeout=timeout):
            return int(amount)
        value = cache.incr(key, amount)
        cache.touch(key, timeout=timeout)
        return int(value)
    except Exception as exc:  # pragma: no cover - cache.incr may not support all backends
        try:
            # Fallback: manual increment
            current = int(cache.get(key) or 0)
            current += int(amount)
            cache.set(key, current, timeout=timeout)
            return current
        except Exception as fallback_exc:  # pragma: no cover
            logger.debug('Failed to increment metric %s: %s, fallback error: %s', name, exc, fallback_exc)
            return 0


def get_realtime_metric(name: str, *, suffix: str | None = None) -> int:
    """
    Get current value of a realtime metric.
    
    Args:
        name: Metric name
        suffix: Optional suffix
        
    Returns:
        Current metric value or 0 if not found
    """
    key = _metric_cache_key(name, suffix=suffix)
    try:
        return int(cache.get(key) or 0)
    except Exception as exc:
        logger.debug('Failed to get metric %s: %s', name, exc)
        return 0


def get_realtime_metrics_summary(prefix_filter: str | None = None) -> dict:
    """
    Get all realtime metrics (optionally filtered by prefix).
    
    Args:
        prefix_filter: If provided, only return metrics matching this prefix
        
    Returns:
        Dict mapping metric names to their values
    """
    summary = {}
    try:
        # Note: This depends on cache backend supporting pattern-based retrieval
        # For in-memory cache, this is not guaranteed to work
        # Consider using cache.keys() if available, otherwise return empty
        
        # Django's cache doesn't have a portable pattern search,
        # so we return empty for now. Observability should use external monitoring.
        return summary
    except Exception as exc:
        logger.debug('Failed to get metrics summary: %s', exc)
        return summary


def reset_realtime_metrics_for_test():
    """Clear all realtime metrics (test helper only)."""
    try:
        # For tests: manually clear known metric keys
        # In production, metrics naturally expire after 24h
        metric_names = [
            'cache_hits_total',
            'cache_misses_total',
            'cache_sets_total',
            'cache_errors_total',
            'realtime_rate_limit_events_total',
        ]
        endpoints = ['price_board', 'intraday', 'financial_ratio']
        
        for name in metric_names:
            key = _metric_cache_key(name)
            cache.delete(key)
            for endpoint in endpoints:
                key = _metric_cache_key(name, suffix=endpoint)
                cache.delete(key)
    except Exception as exc:
        logger.debug('Failed to reset metrics: %s', exc)
