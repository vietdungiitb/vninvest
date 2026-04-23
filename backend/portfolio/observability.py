
# ============================================================================
# PR-5: Holistic Advisory Baseline Metrics Instrumentation
# ============================================================================
# Purpose: Capture token usage, latency, actionability for Sprint H0 baseline

import functools
import logging
from typing import Any, Dict, List, Optional
from django.contrib.auth.models import User

_advisory_logger = logging.getLogger('portfolio.advisory.metrics')

# Session-level metrics for current advisory generation
_ADVISORY_SESSION_METRICS: Dict[str, Any] = {
    'active': False,
    'token_cost': 0,
    'latency_ms': 0,
    'actionability_score': 0.0,
    'components_used': [],
    'confidence': 0.0,
    'phase_timings': {},
    'error_recovery': {
        'retry_count': 0,
        'fallback_components': [],
        'error_messages': []
    },
    'phase_start_times': {},
    'session_start_time': None,
}


def reset_advisory_session() -> None:
    """Reset session metrics for new advisory generation"""
    global _ADVISORY_SESSION_METRICS
    with _LOCK:
        _ADVISORY_SESSION_METRICS = {
            'active': False,
            'token_cost': 0,
            'latency_ms': 0,
            'actionability_score': 0.0,
            'components_used': [],
            'confidence': 0.0,
            'phase_timings': {},
            'error_recovery': {
                'retry_count': 0,
                'fallback_components': [],
                'error_messages': []
            },
            'phase_start_times': {},
            'session_start_time': time(),
        }


def start_advisory_session() -> None:
    """Begin new advisory generation session"""
    reset_advisory_session()
    with _LOCK:
        _ADVISORY_SESSION_METRICS['active'] = True


def end_advisory_session() -> Dict[str, Any]:
    """Finalize current session and return complete metrics"""
    if not _metrics_enabled():
        return {}
    
    with _LOCK:
        if _ADVISORY_SESSION_METRICS['session_start_time']:
            total_latency_ms = (time() - _ADVISORY_SESSION_METRICS['session_start_time']) * 1000
            _ADVISORY_SESSION_METRICS['latency_ms'] = total_latency_ms
        
        _ADVISORY_SESSION_METRICS['active'] = False
        metrics_copy = {k: v for k, v in _ADVISORY_SESSION_METRICS.items() if k != 'phase_start_times'}
        
        _advisory_logger.info(
            f"Advisory session complete: {metrics_copy['latency_ms']:.2f}ms, "
            f"{metrics_copy['token_cost']} tokens, "
            f"actionability={metrics_copy['actionability_score']:.2f}"
        )
        return metrics_copy


def record_advisory_token_usage(tokens: int, source: str = 'unknown') -> None:
    """
    Record token consumption from AI component or API call.
    
    Args:
        tokens: Number of tokens consumed
        source: Source identifier (component name, API call type, etc.)
    """
    if not _metrics_enabled():
        return
    
    with _LOCK:
        _ADVISORY_SESSION_METRICS['token_cost'] += tokens
        if 'token_breakdown' not in _ADVISORY_SESSION_METRICS:
            _ADVISORY_SESSION_METRICS['token_breakdown'] = {}
        
        if source not in _ADVISORY_SESSION_METRICS['token_breakdown']:
            _ADVISORY_SESSION_METRICS['token_breakdown'][source] = 0
        _ADVISORY_SESSION_METRICS['token_breakdown'][source] += tokens
        
        _advisory_logger.debug(f"Recorded {tokens} tokens from {source}")


def record_advisory_component(component: str, latency_ms: float, 
                              success: bool = True, error: Optional[str] = None) -> None:
    """
    Record component (volatility, momentum, volume, etc.) execution.
    
    Args:
        component: Component name
        latency_ms: Execution time in milliseconds
        success: Whether component succeeded
        error: Error message if failed
    """
    if not _metrics_enabled():
        return
    
    with _LOCK:
        if component not in _ADVISORY_SESSION_METRICS['components_used']:
            _ADVISORY_SESSION_METRICS['components_used'].append(component)
        
        if 'component_timings' not in _ADVISORY_SESSION_METRICS:
            _ADVISORY_SESSION_METRICS['component_timings'] = {}
        
        _ADVISORY_SESSION_METRICS['component_timings'][component] = latency_ms
        
        if not success and error:
            _ADVISORY_SESSION_METRICS['error_recovery']['fallback_components'].append({
                'component': component,
                'error': error,
                'fallback_used': True
            })


def record_advisory_actionability(score: float, factors: Optional[Dict[str, float]] = None) -> None:
    """
    Record actionability quality score (0-1 range).
    
    Args:
        score: Actionability score (0.0-1.0)
        factors: Component scoring breakdown (optional)
    """
    if not _metrics_enabled():
        return
    
    with _LOCK:
        _ADVISORY_SESSION_METRICS['actionability_score'] = max(0.0, min(1.0, score))
        if factors:
            _ADVISORY_SESSION_METRICS['actionability_factors'] = factors
        _advisory_logger.debug(f"Actionability score: {score:.2f}")


def record_advisory_confidence(confidence: float, source: str = 'aggregate') -> None:
    """
    Record aggregate confidence level across all signals.
    
    Args:
        confidence: Confidence score (0.0-1.0)
        source: Confidence calculation source
    """
    if not _metrics_enabled():
        return
    
    with _LOCK:
        _ADVISORY_SESSION_METRICS['confidence'] = max(0.0, min(1.0, confidence))
        _ADVISORY_SESSION_METRICS['confidence_source'] = source
        _advisory_logger.debug(f"Confidence: {confidence:.2f} (source: {source})")


def start_advisory_phase(phase_name: str) -> None:
    """Start timing a specific phase of advisory generation"""
    if not _metrics_enabled():
        return
    
    with _LOCK:
        if 'phase_start_times' not in _ADVISORY_SESSION_METRICS:
            _ADVISORY_SESSION_METRICS['phase_start_times'] = {}
        _ADVISORY_SESSION_METRICS['phase_start_times'][phase_name] = time()


def end_advisory_phase(phase_name: str) -> None:
    """End timing a phase and record duration"""
    if not _metrics_enabled():
        return
    
    with _LOCK:
        start = _ADVISORY_SESSION_METRICS.get('phase_start_times', {}).get(phase_name)
        if start is None:
            return
        
        duration_ms = (time() - start) * 1000
        _ADVISORY_SESSION_METRICS['phase_timings'][phase_name] = duration_ms
        if phase_name in _ADVISORY_SESSION_METRICS.get('phase_start_times', {}):
            del _ADVISORY_SESSION_METRICS['phase_start_times'][phase_name]
        
        _advisory_logger.debug(f"Phase '{phase_name}' completed in {duration_ms:.2f}ms")


def record_advisory_error_recovery(error_type: str, fallback_strategy: str, 
                                  success: bool = True) -> None:
    """
    Record error detection + recovery information.
    
    Args:
        error_type: Type of error encountered
        fallback_strategy: Recovery strategy used
        success: Whether recovery succeeded
    """
    if not _metrics_enabled():
        return
    
    with _LOCK:
        _ADVISORY_SESSION_METRICS['error_recovery']['retry_count'] += 1
        _ADVISORY_SESSION_METRICS['error_recovery']['error_messages'].append({
            'error_type': error_type,
            'fallback_strategy': fallback_strategy,
            'success': success
        })


def advisory_phase_timer(phase_name: str):
    """
    Decorator to automatically record metrics for a function/phase execution.
    
    Args:
        phase_name: Name of phase (defaults to function name if None)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            actual_phase = phase_name or func.__name__
            start_advisory_phase(actual_phase)
            try:
                result = func(*args, **kwargs)
                end_advisory_phase(actual_phase)
                return result
            except Exception as e:
                end_advisory_phase(actual_phase)
                record_advisory_error_recovery(
                    error_type=type(e).__name__,
                    fallback_strategy='exception_caught',
                    success=False
                )
                _advisory_logger.error(f"Error in {actual_phase}: {str(e)}")
                raise
        
        return wrapper
    return decorator


def generate_advisory_baseline_report(user: User, symbol: str, 
                                     metrics_samples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Generate baseline metrics report from collection of metric samples.
    
    Args:
        user: User for which baseline is being established
        symbol: Stock symbol being analyzed
        metrics_samples: List of metrics dictionaries from multiple generations
    
    Returns:
        Dictionary with baseline report including p50/p95/p99 latency,
        average token usage, actionability distribution, etc.
    """
    if not metrics_samples:
        _advisory_logger.warning("No metrics samples provided for baseline report")
        return {}
    
    # Extract latencies, tokens, actionability scores
    latencies = [m.get('latency_ms', 0) for m in metrics_samples]
    tokens = [m.get('token_cost', 0) for m in metrics_samples]
    actionability = [m.get('actionability_score', 0) for m in metrics_samples]
    confidences = [m.get('confidence', 0) for m in metrics_samples]
    
    # Sort for percentile calculation
    latencies_sorted = sorted(latencies)
    tokens_sorted = sorted(tokens)
    actionability_sorted = sorted(actionability)
    confidences_sorted = sorted(confidences)
    
    count = len(metrics_samples)
    
    def percentile(data: List[float], p: int) -> float:
        """Calculate percentile from sorted data"""
        if not data:
            return 0
        idx = int(len(data) * p / 100)
        return float(data[min(idx, len(data) - 1)])
    
    # Collect component usage stats
    components_used = {}
    for m in metrics_samples:
        for comp in m.get('components_used', []):
            components_used[comp] = components_used.get(comp, 0) + 1
    
    component_participation = {
        comp: f"{count_comp / count * 100:.1f}%" 
        for comp, count_comp in components_used.items()
    }
    
    report = {
        'baseline_timestamp': datetime.utcnow().isoformat(),
        'user': user.username,
        'symbol': symbol,
        'sample_count': count,
        'collection_period': f"{count} advisory generations",
        
        # Latency profile
        'latency_metrics': {
            'p50_ms': percentile(latencies_sorted, 50),
            'p95_ms': percentile(latencies_sorted, 95),
            'p99_ms': percentile(latencies_sorted, 99),
            'min_ms': min(latencies) if latencies else 0,
            'max_ms': max(latencies) if latencies else 0,
            'avg_ms': sum(latencies) / count if latencies else 0,
        },
        
        # Token usage
        'token_metrics': {
            'p50': percentile(tokens_sorted, 50),
            'p95': percentile(tokens_sorted, 95),
            'p99': percentile(tokens_sorted, 99),
            'min': min(tokens) if tokens else 0,
            'max': max(tokens) if tokens else 0,
            'avg': sum(tokens) / count if tokens else 0,
            'total': sum(tokens),
        },
        
        # Quality metrics
        'quality_metrics': {
            'actionability_avg': sum(actionability) / count if actionability else 0,
            'actionability_p50': percentile(actionability_sorted, 50),
            'actionability_p95': percentile(actionability_sorted, 95),
            'confidence_avg': sum(confidences) / count if confidences else 0,
            'confidence_p50': percentile(confidences_sorted, 50),
        },
        
        # Component usage
        'component_participation': component_participation,
        
        # Error recovery stats
        'error_metrics': {
            'total_errors': sum(len(m.get('error_recovery', {}).get('error_messages', [])) 
                               for m in metrics_samples),
            'fallback_count': sum(len(m.get('error_recovery', {}).get('fallback_components', [])) 
                                 for m in metrics_samples),
        }
    }
    
    _advisory_logger.info(f"Generated baseline report for {user.username}:{symbol}")
    return report
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
_INTRADAY_FRESHNESS_STATS: dict[str, object] = {
    'age_seconds': deque(maxlen=300),
    'stale_served_total': 0,
    'stale_over_threshold_total': 0,
    'realtime_refresh_trigger_total': 0,
    'source_counts': defaultdict(int),
}
_SYMBOL_ENGAGEMENT_STATS: dict[str, int] = {
    'activation_total': 0,
    'warmup_skipped_fresh_total': 0,
    'warmup_skipped_lock_total': 0,
    'warmup_success_total': 0,
    'warmup_error_total': 0,
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
        _INTRADAY_FRESHNESS_STATS['age_seconds'] = deque(maxlen=_latency_window_size())
        _INTRADAY_FRESHNESS_STATS['stale_served_total'] = 0
        _INTRADAY_FRESHNESS_STATS['stale_over_threshold_total'] = 0
        _INTRADAY_FRESHNESS_STATS['realtime_refresh_trigger_total'] = 0
        _INTRADAY_FRESHNESS_STATS['source_counts'] = defaultdict(int)
        _SYMBOL_ENGAGEMENT_STATS.update({
            'activation_total': 0,
            'warmup_skipped_fresh_total': 0,
            'warmup_skipped_lock_total': 0,
            'warmup_success_total': 0,
            'warmup_error_total': 0,
        })
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


def record_intraday_freshness_observation(
    *,
    source: str,
    age_seconds=None,
    stale: bool = False,
    stale_over_threshold: bool = False,
    realtime_refresh_trigger: bool = False,
) -> None:
    if not _metrics_enabled():
        return

    source_key = str(source or 'unknown').strip() or 'unknown'
    coerced_age = None
    try:
        if age_seconds is not None:
            coerced_age = max(float(age_seconds), 0.0)
    except (TypeError, ValueError):
        coerced_age = None

    with _LOCK:
        source_counts = _INTRADAY_FRESHNESS_STATS.get('source_counts')
        if isinstance(source_counts, dict):
            source_counts[source_key] = int(source_counts.get(source_key, 0)) + 1

        if bool(stale):
            _INTRADAY_FRESHNESS_STATS['stale_served_total'] = int(
                _INTRADAY_FRESHNESS_STATS.get('stale_served_total', 0)
            ) + 1

        if bool(stale_over_threshold):
            _INTRADAY_FRESHNESS_STATS['stale_over_threshold_total'] = int(
                _INTRADAY_FRESHNESS_STATS.get('stale_over_threshold_total', 0)
            ) + 1

        if bool(realtime_refresh_trigger):
            _INTRADAY_FRESHNESS_STATS['realtime_refresh_trigger_total'] = int(
                _INTRADAY_FRESHNESS_STATS.get('realtime_refresh_trigger_total', 0)
            ) + 1

        if coerced_age is not None:
            age_window = _INTRADAY_FRESHNESS_STATS.get('age_seconds')
            if isinstance(age_window, deque):
                age_window.append(coerced_age)


def record_symbol_engagement_event(event_type: str) -> None:
    if not _metrics_enabled():
        return

    key = str(event_type or '').strip().lower()
    if key not in _SYMBOL_ENGAGEMENT_STATS:
        return

    with _LOCK:
        _SYMBOL_ENGAGEMENT_STATS[key] += 1


def _build_intraday_freshness_summary_from_counters(
    *,
    age_samples: list[float],
    stale_served_total: int,
    stale_over_threshold_total: int,
    realtime_refresh_trigger_total: int,
    source_counts: dict,
) -> dict:
    sample_size = len(age_samples)
    age_p50 = round(_percentile(age_samples, 0.50), 2)
    age_p95 = round(_percentile(age_samples, 0.95), 2)
    stale_ratio_pct = round((stale_served_total / sample_size) * 100, 2) if sample_size else 0.0
    over_threshold_ratio_pct = (
        round((stale_over_threshold_total / stale_served_total) * 100, 2)
        if stale_served_total
        else 0.0
    )

    return {
        'age_seconds': {
            'sample_size': sample_size,
            'p50': age_p50,
            'p95': age_p95,
        },
        'stale_served_total': stale_served_total,
        'stale_ratio_pct': stale_ratio_pct,
        'stale_over_threshold_total': stale_over_threshold_total,
        'stale_over_threshold_ratio_pct': over_threshold_ratio_pct,
        'realtime_refresh_trigger_total': realtime_refresh_trigger_total,
        'source_mix': source_counts,
    }


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
        intraday_age_samples = list(_INTRADAY_FRESHNESS_STATS.get('age_seconds') or [])
        intraday_stale_served_total = int(_INTRADAY_FRESHNESS_STATS.get('stale_served_total', 0))
        intraday_stale_over_threshold_total = int(_INTRADAY_FRESHNESS_STATS.get('stale_over_threshold_total', 0))
        intraday_refresh_trigger_total = int(_INTRADAY_FRESHNESS_STATS.get('realtime_refresh_trigger_total', 0))
        intraday_source_counts = dict(_INTRADAY_FRESHNESS_STATS.get('source_counts') or {})
        engagement_stats = dict(_SYMBOL_ENGAGEMENT_STATS)

        whale_pipeline_summary = _build_whale_pipeline_health_summary_from_counters(
            freshness_samples=whale_freshness_samples,
            events_total=whale_events_total,
            recovered_events=whale_recovered_events,
            dedup_total=whale_dedup_total,
            dedup_hits=whale_dedup_hits,
            source_counts=whale_source_counts,
        )
        intraday_freshness_summary = _build_intraday_freshness_summary_from_counters(
            age_samples=intraday_age_samples,
            stale_served_total=intraday_stale_served_total,
            stale_over_threshold_total=intraday_stale_over_threshold_total,
            realtime_refresh_trigger_total=intraday_refresh_trigger_total,
            source_counts=intraday_source_counts,
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
            'intraday_freshness': intraday_freshness_summary,
            'whale_pipeline': whale_pipeline_summary,
            'symbol_engagement': engagement_stats,
            'endpoints': endpoints,
            'fallback_breakdown': fallback_breakdown,
            'external_timeout_breakdown': timeout_breakdown,
        }
