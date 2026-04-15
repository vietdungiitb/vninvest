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
from django.utils import timezone

logger = logging.getLogger(__name__)

REALTIME_METRICS_CACHE_PREFIX = 'ticker:realtime:metrics'
REALTIME_ENDPOINTS = ('price_board', 'intraday', 'financial_ratio')
REALTIME_BASE_METRICS = (
    'cache_hits_total',
    'cache_misses_total',
    'cache_sets_total',
    'cache_errors_total',
    'realtime_warmup_started_total',
    'realtime_warmup_completed_total',
    'realtime_warmup_symbols_cached_total',
    'realtime_warmup_errors_total',
)
REALTIME_ENDPOINT_METRICS = (
    'realtime_rate_limit_events_total',
    'realtime_upstream_calls_total',
    'realtime_upstream_errors_total',
)


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


def build_realtime_metrics_snapshot() -> dict:
    """Build normalized snapshot for dashboards and runbooks."""
    metrics = {}

    for metric_name in REALTIME_BASE_METRICS:
        metrics[metric_name] = get_realtime_metric(metric_name)

    for metric_name in REALTIME_ENDPOINT_METRICS:
        metric_values = {}
        for endpoint in REALTIME_ENDPOINTS:
            metric_values[endpoint] = get_realtime_metric(metric_name, suffix=endpoint)
        metrics[metric_name] = metric_values

    hits = int(metrics.get('cache_hits_total') or 0)
    misses = int(metrics.get('cache_misses_total') or 0)
    total_reads = hits + misses
    hit_ratio = (hits / total_reads) if total_reads > 0 else None

    snapshot = {
        'generated_at': timezone.now().isoformat(),
        'cache': {
            'hits_total': hits,
            'misses_total': misses,
            'reads_total': total_reads,
            'hit_ratio': hit_ratio,
            'sets_total': int(metrics.get('cache_sets_total') or 0),
            'errors_total': int(metrics.get('cache_errors_total') or 0),
        },
        'warmup': {
            'started_total': int(metrics.get('realtime_warmup_started_total') or 0),
            'completed_total': int(metrics.get('realtime_warmup_completed_total') or 0),
            'symbols_cached_total': int(metrics.get('realtime_warmup_symbols_cached_total') or 0),
            'errors_total': int(metrics.get('realtime_warmup_errors_total') or 0),
        },
        'upstream': {
            'calls_total': metrics.get('realtime_upstream_calls_total', {}),
            'errors_total': metrics.get('realtime_upstream_errors_total', {}),
            'rate_limit_events_total': metrics.get('realtime_rate_limit_events_total', {}),
        },
        'raw': metrics,
    }
    return snapshot


def build_prometheus_metrics_text() -> str:
    """Export normalized realtime metrics in Prometheus text format."""
    snapshot = build_realtime_metrics_snapshot()
    lines = []

    cache_data = snapshot.get('cache', {})
    lines.append('# HELP vninvest_realtime_cache_hits_total Total cache hits for realtime endpoints')
    lines.append('# TYPE vninvest_realtime_cache_hits_total counter')
    lines.append(f"vninvest_realtime_cache_hits_total {int(cache_data.get('hits_total') or 0)}")

    lines.append('# HELP vninvest_realtime_cache_misses_total Total cache misses for realtime endpoints')
    lines.append('# TYPE vninvest_realtime_cache_misses_total counter')
    lines.append(f"vninvest_realtime_cache_misses_total {int(cache_data.get('misses_total') or 0)}")

    hit_ratio = cache_data.get('hit_ratio')
    if hit_ratio is not None:
        lines.append('# HELP vninvest_realtime_cache_hit_ratio Cache hit ratio for realtime reads')
        lines.append('# TYPE vninvest_realtime_cache_hit_ratio gauge')
        lines.append(f'vninvest_realtime_cache_hit_ratio {float(hit_ratio):.6f}')

    lines.append('# HELP vninvest_realtime_cache_sets_total Total cache set operations for realtime endpoints')
    lines.append('# TYPE vninvest_realtime_cache_sets_total counter')
    lines.append(f"vninvest_realtime_cache_sets_total {int(cache_data.get('sets_total') or 0)}")

    lines.append('# HELP vninvest_realtime_cache_errors_total Total cache errors for realtime endpoints')
    lines.append('# TYPE vninvest_realtime_cache_errors_total counter')
    lines.append(f"vninvest_realtime_cache_errors_total {int(cache_data.get('errors_total') or 0)}")

    warmup_data = snapshot.get('warmup', {})
    lines.append('# HELP vninvest_realtime_warmup_started_total Total warmup start events')
    lines.append('# TYPE vninvest_realtime_warmup_started_total counter')
    lines.append(f"vninvest_realtime_warmup_started_total {int(warmup_data.get('started_total') or 0)}")

    lines.append('# HELP vninvest_realtime_warmup_completed_total Total warmup completion events')
    lines.append('# TYPE vninvest_realtime_warmup_completed_total counter')
    lines.append(f"vninvest_realtime_warmup_completed_total {int(warmup_data.get('completed_total') or 0)}")

    lines.append('# HELP vninvest_realtime_warmup_symbols_cached_total Total symbols cached by warmup')
    lines.append('# TYPE vninvest_realtime_warmup_symbols_cached_total counter')
    lines.append(f"vninvest_realtime_warmup_symbols_cached_total {int(warmup_data.get('symbols_cached_total') or 0)}")

    lines.append('# HELP vninvest_realtime_warmup_errors_total Total warmup errors')
    lines.append('# TYPE vninvest_realtime_warmup_errors_total counter')
    lines.append(f"vninvest_realtime_warmup_errors_total {int(warmup_data.get('errors_total') or 0)}")

    upstream_data = snapshot.get('upstream', {})
    for endpoint in REALTIME_ENDPOINTS:
        calls_value = int((upstream_data.get('calls_total', {}) or {}).get(endpoint) or 0)
        errors_value = int((upstream_data.get('errors_total', {}) or {}).get(endpoint) or 0)
        rl_value = int((upstream_data.get('rate_limit_events_total', {}) or {}).get(endpoint) or 0)
        lines.append('# HELP vninvest_realtime_upstream_calls_total Total upstream calls by endpoint')
        lines.append('# TYPE vninvest_realtime_upstream_calls_total counter')
        lines.append(f'vninvest_realtime_upstream_calls_total{{endpoint="{endpoint}"}} {calls_value}')
        lines.append('# HELP vninvest_realtime_upstream_errors_total Total upstream errors by endpoint')
        lines.append('# TYPE vninvest_realtime_upstream_errors_total counter')
        lines.append(f'vninvest_realtime_upstream_errors_total{{endpoint="{endpoint}"}} {errors_value}')
        lines.append('# HELP vninvest_realtime_rate_limit_events_total Total upstream 429/rate-limit events by endpoint')
        lines.append('# TYPE vninvest_realtime_rate_limit_events_total counter')
        lines.append(f'vninvest_realtime_rate_limit_events_total{{endpoint="{endpoint}"}} {rl_value}')

    return '\n'.join(lines) + '\n'


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
            'realtime_upstream_calls_total',
            'realtime_upstream_errors_total',
            'realtime_warmup_started_total',
            'realtime_warmup_completed_total',
            'realtime_warmup_symbols_cached_total',
            'realtime_warmup_errors_total',
        ]
        endpoints = list(REALTIME_ENDPOINTS)
        
        for name in metric_names:
            key = _metric_cache_key(name)
            cache.delete(key)
            for endpoint in endpoints:
                key = _metric_cache_key(name, suffix=endpoint)
                cache.delete(key)
    except Exception as exc:
        logger.debug('Failed to reset metrics: %s', exc)
