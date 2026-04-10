from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime
from threading import Lock
from time import time

from django.conf import settings
from django.utils import timezone


_LOCK = Lock()

_HTTP_STATS: dict[str, dict] = {}
_FALLBACK_COUNTS: dict[str, dict[str, int]] = defaultdict(dict)
_TIMEOUT_COUNTS: dict[str, dict[str, int]] = defaultdict(dict)
_AI_CHART_CONTEXT_STATS: dict[str, float] = {
    'present': 0,
    'used': 0,
    'warnings': 0,
    'ohlcv_points_total': 0,
    'payload_bytes_total': 0,
}
_ADVISORY_MERGE_STATS: dict[str, float] = {
    'scheduled': 0,
    'merged': 0,
    'flushed': 0,
    'skipped': 0,
}
_WHALE_PIPELINE_STATS: dict[str, object] = {
    'freshness_seconds': deque(maxlen=300),
    'dedup_hits': 0,
    'dedup_total': 0,
    'recovered_events': 0,
    'events_total': 0,
    'source_counts': defaultdict(int),
}
_STARTED_AT_EPOCH = time()


def _latency_window_size() -> int:
    try:
        configured = int(getattr(settings, 'MARKET_OBSERVABILITY_LATENCY_WINDOW', 300))
    except (TypeError, ValueError):
        configured = 300
    return max(configured, 50)


def _metrics_enabled() -> bool:
    return bool(getattr(settings, 'MARKET_OBSERVABILITY_ENABLED', True))


def _percentile(samples: list[float], percentile: float) -> float:
    if not samples:
        return 0.0
    sorted_samples = sorted(samples)
    index = int((len(sorted_samples) - 1) * percentile)
    return float(sorted_samples[index])


def _ensure_http_endpoint(endpoint: str) -> dict:
    endpoint_stats = _HTTP_STATS.get(endpoint)
    if endpoint_stats is not None:
        return endpoint_stats

    endpoint_stats = {
        'count': 0,
        'status_2xx': 0,
        'status_4xx': 0,
        'status_5xx': 0,
        'latencies_ms': deque(maxlen=_latency_window_size()),
    }
    _HTTP_STATS[endpoint] = endpoint_stats
    return endpoint_stats


def reset_market_observability() -> None:
    global _STARTED_AT_EPOCH
    with _LOCK:
        _HTTP_STATS.clear()
        _FALLBACK_COUNTS.clear()
        _TIMEOUT_COUNTS.clear()
        _AI_CHART_CONTEXT_STATS.update(
            {
                'present': 0,
                'used': 0,
                'warnings': 0,
                'ohlcv_points_total': 0,
                'payload_bytes_total': 0,
            }
        )
        _ADVISORY_MERGE_STATS.update(
            {
                'scheduled': 0,
                'merged': 0,
                'flushed': 0,
                'skipped': 0,
            }
        )
        _WHALE_PIPELINE_STATS['freshness_seconds'] = deque(maxlen=_latency_window_size())
        _WHALE_PIPELINE_STATS['dedup_hits'] = 0
        _WHALE_PIPELINE_STATS['dedup_total'] = 0
        _WHALE_PIPELINE_STATS['recovered_events'] = 0
        _WHALE_PIPELINE_STATS['events_total'] = 0
        _WHALE_PIPELINE_STATS['source_counts'] = defaultdict(int)
        _STARTED_AT_EPOCH = time()


def _coerce_freshness_seconds(event_ts) -> int | None:
    if not event_ts:
        return None
    try:
        parsed = datetime.fromisoformat(str(event_ts).replace('Z', '+00:00'))
    except Exception:
        return None

    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    age_seconds = int((timezone.now() - parsed).total_seconds())
    return max(age_seconds, 0)


def record_market_http_observation(endpoint: str, status_code: int, latency_ms: float) -> None:
    if not _metrics_enabled():
        return

    endpoint_key = str(endpoint or 'unknown')
    with _LOCK:
        endpoint_stats = _ensure_http_endpoint(endpoint_key)
        endpoint_stats['count'] += 1

        status_bucket = int(status_code or 0)
        if 200 <= status_bucket < 300:
            endpoint_stats['status_2xx'] += 1
        elif 400 <= status_bucket < 500:
            endpoint_stats['status_4xx'] += 1
        elif status_bucket >= 500:
            endpoint_stats['status_5xx'] += 1

        endpoint_stats['latencies_ms'].append(max(float(latency_ms), 0.0))


def record_market_fallback(endpoint: str, source: str) -> None:
    if not _metrics_enabled():
        return

    endpoint_key = str(endpoint or 'unknown')
    source_key = str(source or 'unknown')
    with _LOCK:
        source_map = _FALLBACK_COUNTS[endpoint_key]
        source_map[source_key] = int(source_map.get(source_key, 0)) + 1


def record_market_external_timeout(endpoint: str, provider: str = 'vnstock') -> None:
    if not _metrics_enabled():
        return

    endpoint_key = str(endpoint or 'unknown')
    provider_key = str(provider or 'unknown')
    with _LOCK:
        provider_map = _TIMEOUT_COUNTS[endpoint_key]
        provider_map[provider_key] = int(provider_map.get(provider_key, 0)) + 1


def record_ai_chart_context_observation(
    *,
    present: bool,
    used: bool,
    warning_count: int,
    ohlcv_points: int,
    payload_bytes: int,
) -> None:
    if not _metrics_enabled():
        return

    with _LOCK:
        if present:
            _AI_CHART_CONTEXT_STATS['present'] += 1
        if used:
            _AI_CHART_CONTEXT_STATS['used'] += 1
        _AI_CHART_CONTEXT_STATS['warnings'] += max(int(warning_count or 0), 0)
        _AI_CHART_CONTEXT_STATS['ohlcv_points_total'] += max(int(ohlcv_points or 0), 0)
        _AI_CHART_CONTEXT_STATS['payload_bytes_total'] += max(int(payload_bytes or 0), 0)


def record_advisory_merge_observation(status: str) -> None:
    if not _metrics_enabled():
        return

    status_key = str(status or '').strip().lower()
    if status_key not in _ADVISORY_MERGE_STATS:
        status_key = 'skipped'

    with _LOCK:
        _ADVISORY_MERGE_STATS[status_key] += 1


def record_whale_dedup_observation(hit: bool) -> None:
    if not _metrics_enabled():
        return

    with _LOCK:
        _WHALE_PIPELINE_STATS['dedup_total'] = int(_WHALE_PIPELINE_STATS.get('dedup_total', 0)) + 1
        if bool(hit):
            _WHALE_PIPELINE_STATS['dedup_hits'] = int(_WHALE_PIPELINE_STATS.get('dedup_hits', 0)) + 1


def record_whale_event_observation(*, source: str, ts=None, recovered: bool = False) -> None:
    if not _metrics_enabled():
        return

    source_key = str(source or 'unknown').strip() or 'unknown'
    freshness_seconds = _coerce_freshness_seconds(ts)
    with _LOCK:
        _WHALE_PIPELINE_STATS['events_total'] = int(_WHALE_PIPELINE_STATS.get('events_total', 0)) + 1
        if bool(recovered):
            _WHALE_PIPELINE_STATS['recovered_events'] = int(_WHALE_PIPELINE_STATS.get('recovered_events', 0)) + 1
        source_counts = _WHALE_PIPELINE_STATS.get('source_counts')
        if isinstance(source_counts, dict):
            source_counts[source_key] = int(source_counts.get(source_key, 0)) + 1
        if freshness_seconds is not None:
            freshness_window = _WHALE_PIPELINE_STATS.get('freshness_seconds')
            if isinstance(freshness_window, deque):
                freshness_window.append(float(freshness_seconds))


def get_whale_pipeline_health_summary() -> dict:
    with _LOCK:
        freshness_samples = list(_WHALE_PIPELINE_STATS.get('freshness_seconds') or [])
        events_total = int(_WHALE_PIPELINE_STATS.get('events_total', 0))
        recovered_events = int(_WHALE_PIPELINE_STATS.get('recovered_events', 0))
        dedup_total = int(_WHALE_PIPELINE_STATS.get('dedup_total', 0))
        dedup_hits = int(_WHALE_PIPELINE_STATS.get('dedup_hits', 0))
        source_counts = dict(_WHALE_PIPELINE_STATS.get('source_counts') or {})

    source_mix_ratio = {
        key: round((int(value) / events_total) * 100, 2) if events_total else 0.0
        for key, value in source_counts.items()
    }
    freshness_p95 = round(_percentile(freshness_samples, 0.95), 2)
    freshness_median = round(_percentile(freshness_samples, 0.50), 2)
    dedup_hit_ratio_pct = round((dedup_hits / dedup_total) * 100, 2) if dedup_total else 0.0
    snapshot_recovery_ratio_pct = round((recovered_events / events_total) * 100, 2) if events_total else 0.0

    try:
        freshness_warn_seconds = int(getattr(settings, 'WHALE_PIPELINE_FRESHNESS_P95_WARN_SECONDS', 120))
    except (TypeError, ValueError):
        freshness_warn_seconds = 120

    healthy = freshness_p95 <= max(freshness_warn_seconds, 30)

    return {
        'healthy': healthy,
        'freshness': {
            'sample_size': len(freshness_samples),
            'median_seconds': freshness_median,
            'p95_seconds': freshness_p95,
            'warn_threshold_seconds': max(freshness_warn_seconds, 30),
        },
        'dedup': {
            'total': dedup_total,
            'hits': dedup_hits,
            'hit_ratio_pct': dedup_hit_ratio_pct,
        },
        'snapshot_recovery': {
            'events_total': events_total,
            'recovered_events': recovered_events,
            'ratio_pct': snapshot_recovery_ratio_pct,
        },
        'source_mix': {
            'counts': source_counts,
            'ratio_pct': source_mix_ratio,
        },
    }


def _build_whale_pipeline_health_summary_from_counters(
    *,
    freshness_samples: list[float],
    events_total: int,
    recovered_events: int,
    dedup_total: int,
    dedup_hits: int,
    source_counts: dict,
) -> dict:
    source_mix_ratio = {
        key: round((int(value) / events_total) * 100, 2) if events_total else 0.0
        for key, value in source_counts.items()
    }
    freshness_p95 = round(_percentile(freshness_samples, 0.95), 2)
    freshness_median = round(_percentile(freshness_samples, 0.50), 2)
    dedup_hit_ratio_pct = round((dedup_hits / dedup_total) * 100, 2) if dedup_total else 0.0
    snapshot_recovery_ratio_pct = round((recovered_events / events_total) * 100, 2) if events_total else 0.0

    try:
        freshness_warn_seconds = int(getattr(settings, 'WHALE_PIPELINE_FRESHNESS_P95_WARN_SECONDS', 120))
    except (TypeError, ValueError):
        freshness_warn_seconds = 120

    healthy = freshness_p95 <= max(freshness_warn_seconds, 30)

    return {
        'healthy': healthy,
        'freshness': {
            'sample_size': len(freshness_samples),
            'median_seconds': freshness_median,
            'p95_seconds': freshness_p95,
            'warn_threshold_seconds': max(freshness_warn_seconds, 30),
        },
        'dedup': {
            'total': dedup_total,
            'hits': dedup_hits,
            'hit_ratio_pct': dedup_hit_ratio_pct,
        },
        'snapshot_recovery': {
            'events_total': events_total,
            'recovered_events': recovered_events,
            'ratio_pct': snapshot_recovery_ratio_pct,
        },
        'source_mix': {
            'counts': source_counts,
            'ratio_pct': source_mix_ratio,
        },
    }


def get_market_observability_snapshot() -> dict:
    with _LOCK:
        endpoints = {}
        total_requests = 0
        total_5xx = 0
        for endpoint, stats in _HTTP_STATS.items():
            latencies = list(stats['latencies_ms'])
            count = int(stats['count'])
            five_xx_count = int(stats['status_5xx'])
            total_requests += count
            total_5xx += five_xx_count
            endpoints[endpoint] = {
                'requests': count,
                'status_2xx': int(stats['status_2xx']),
                'status_4xx': int(stats['status_4xx']),
                'status_5xx': five_xx_count,
                'five_xx_ratio_pct': round((five_xx_count / count) * 100, 2) if count else 0.0,
                'latency_ms': {
                    'latest_window_size': len(latencies),
                    'p50': round(_percentile(latencies, 0.50), 2),
                    'p95': round(_percentile(latencies, 0.95), 2),
                    'max': round(max(latencies), 2) if latencies else 0.0,
                },
            }

        fallback_total = 0
        fallback_breakdown = {}
        for endpoint, sources in _FALLBACK_COUNTS.items():
            fallback_breakdown[endpoint] = dict(sources)
            fallback_total += sum(int(value) for value in sources.values())

        timeout_total = 0
        timeout_breakdown = {}
        for endpoint, providers in _TIMEOUT_COUNTS.items():
            timeout_breakdown[endpoint] = dict(providers)
            timeout_total += sum(int(value) for value in providers.values())

        chart_present = int(_AI_CHART_CONTEXT_STATS.get('present', 0))
        chart_used = int(_AI_CHART_CONTEXT_STATS.get('used', 0))
        chart_warnings = int(_AI_CHART_CONTEXT_STATS.get('warnings', 0))
        ohlcv_points_total = int(_AI_CHART_CONTEXT_STATS.get('ohlcv_points_total', 0))
        payload_bytes_total = int(_AI_CHART_CONTEXT_STATS.get('payload_bytes_total', 0))
        advisory_merge_scheduled = int(_ADVISORY_MERGE_STATS.get('scheduled', 0))
        advisory_merge_merged = int(_ADVISORY_MERGE_STATS.get('merged', 0))
        advisory_merge_flushed = int(_ADVISORY_MERGE_STATS.get('flushed', 0))
        advisory_merge_skipped = int(_ADVISORY_MERGE_STATS.get('skipped', 0))
        whale_freshness_samples = list(_WHALE_PIPELINE_STATS.get('freshness_seconds') or [])
        whale_events_total = int(_WHALE_PIPELINE_STATS.get('events_total', 0))
        whale_recovered_events = int(_WHALE_PIPELINE_STATS.get('recovered_events', 0))
        whale_dedup_total = int(_WHALE_PIPELINE_STATS.get('dedup_total', 0))
        whale_dedup_hits = int(_WHALE_PIPELINE_STATS.get('dedup_hits', 0))
        whale_source_counts = dict(_WHALE_PIPELINE_STATS.get('source_counts') or {})

        whale_pipeline_summary = _build_whale_pipeline_health_summary_from_counters(
            freshness_samples=whale_freshness_samples,
            events_total=whale_events_total,
            recovered_events=whale_recovered_events,
            dedup_total=whale_dedup_total,
            dedup_hits=whale_dedup_hits,
            source_counts=whale_source_counts,
        )

        return {
            'enabled': _metrics_enabled(),
            'window': {
                'latency_samples_per_endpoint': _latency_window_size(),
                'started_at_epoch': int(_STARTED_AT_EPOCH),
            },
            'overall': {
                'http_requests': total_requests,
                'http_5xx': total_5xx,
                'http_5xx_ratio_pct': round((total_5xx / total_requests) * 100, 2) if total_requests else 0.0,
                'fallback_hits': fallback_total,
                'external_timeouts': timeout_total,
            },
            'ai_chart_context': {
                'present': chart_present,
                'used': chart_used,
                'usage_ratio_pct': round((chart_used / chart_present) * 100, 2) if chart_present else 0.0,
                'warnings_total': chart_warnings,
                'ohlcv_points_total': ohlcv_points_total,
                'payload_bytes_total': payload_bytes_total,
                'avg_ohlcv_points': round(ohlcv_points_total / chart_present, 2) if chart_present else 0.0,
                'avg_payload_bytes': round(payload_bytes_total / chart_present, 2) if chart_present else 0.0,
            },
            'advisory_event_merge': {
                'scheduled': advisory_merge_scheduled,
                'merged': advisory_merge_merged,
                'flushed': advisory_merge_flushed,
                'skipped': advisory_merge_skipped,
            },
            'whale_pipeline': whale_pipeline_summary,
            'endpoints': endpoints,
            'fallback_breakdown': fallback_breakdown,
            'external_timeout_breakdown': timeout_breakdown,
        }
