from __future__ import annotations

from datetime import timedelta, datetime
import logging
import os
import re

from django.core.cache import cache
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from portfolio.domain_constants import resolve_user_whale_threshold_vnd
from portfolio.models import AdvisoryTokenLog, AdvisoryAggregateSnapshot, UserConfig, TrackedSymbol, WhaleAdvisory
from portfolio.observability import record_advisory_merge_observation
from portfolio.tasks_whale_advisory import (
    ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX,
    flush_merged_advisory_event,
)

logger = logging.getLogger(__name__)

def _advisory_event_merge_cache_key(user_id: int, symbol: str) -> str:
    return f'{ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX}:{user_id}:{symbol}'


def _safe_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _normalize_symbol(symbol: str) -> str:
    return str(symbol or '').strip().upper()


def _infer_dark_flow_direction(signal_type: str, cvd_change: float) -> int:
    signal_key = str(signal_type or '').strip().lower()
    if any(token in signal_key for token in ('buy', 'bid', 'accum', 'absorb_buy', 'accumulation')):
        return 1
    if any(token in signal_key for token in ('sell', 'ask', 'dist', 'distribution', 'absorb_sell')):
        return -1
    if cvd_change > 0:
        return 1
    if cvd_change < 0:
        return -1
    return 0


def _compute_event_side_score(source: str, payload: dict) -> float:
    source_key = str(source or '').strip().lower()
    if source_key == 'whale_alert':
        event_score = _safe_float(payload.get('event_score'), 0.0)
        side = str(payload.get('side') or '').strip().lower()
        direction = 1 if side == 'buy' else -1 if side == 'sell' else 0
        return direction * event_score

    if source_key == 'dark_flow':
        strength = _safe_float(payload.get('strength'), 0.0)
        cvd_change = _safe_float(payload.get('cvd_change'), 0.0)
        direction = _infer_dark_flow_direction(payload.get('signal_type'), cvd_change)
        return direction * strength

    return 0.0


def _resolve_side_by_dynamic_score(score: float) -> str:
    neutral_band = max(_safe_float(os.getenv('ADVISORY_DYNAMIC_SCORE_NEUTRAL_BAND', '8'), 8.0), 0.0)
    if score > neutral_band:
        return 'BUY'
    if score < -neutral_band:
        return 'SELL'
    return 'UNKNOWN'


def _accumulate_user_advisory_event(
    *,
    user_id: int,
    symbol: str,
    source: str,
    payload: dict,
    threshold_vnd: float,
    threshold_source: str = 'user_default',
) -> dict:
    normalized_symbol = _normalize_symbol(symbol)
    if not normalized_symbol:
        record_advisory_merge_observation('skipped')
        return {'status': 'skipped', 'reason': 'invalid_symbol'}

    merge_window_seconds = max(int(os.getenv('ADVISORY_EVENT_MERGE_WINDOW_SECONDS', '180')), 30)
    cache_ttl = merge_window_seconds + 300
    now = timezone.now()
    cache_key = _advisory_event_merge_cache_key(user_id, normalized_symbol)

    existing = cache.get(cache_key)
    matched_value_candidate = _safe_float(payload.get('matched_value_vnd') or payload.get('matched_value'), threshold_vnd)
    event_side_score = _compute_event_side_score(source, payload)

    if existing is None:
        state = {
            'user_id': int(user_id),
            'symbol': normalized_symbol,
            'threshold_vnd': float(threshold_vnd),
            'threshold_source': str(threshold_source or 'user_default'),
            'matched_value_vnd': float(max(matched_value_candidate, threshold_vnd)),
            'score_sum': float(event_side_score),
            'sources': [str(source)],
            'source_scores': {str(source): float(event_side_score)},
            'first_event_at': now.isoformat(),
            'updated_at': now.isoformat(),
            # F1: Store dark_flow specific fields
            'dark_flow_strength': float(payload.get('strength', 0) or 0) if source == 'dark_flow' else None,
            'dark_flow_confidence': str(payload.get('confidence', 'low')) if source == 'dark_flow' else None,
        }
        cache.set(cache_key, state, timeout=cache_ttl)
        flush_merged_advisory_event.apply_async(
            kwargs={'user_id': int(user_id), 'symbol': normalized_symbol},
            countdown=merge_window_seconds,
        )
        record_advisory_merge_observation('scheduled')
        return {'status': 'scheduled', 'cache_key': cache_key, 'window_seconds': merge_window_seconds}

    source_list = [str(item) for item in (existing.get('sources') or [])]
    source_set = set(source_list)
    source_set.add(str(source))
    source_scores = existing.get('source_scores') or {}
    current_source_score = _safe_float(source_scores.get(str(source)), 0.0)
    source_scores[str(source)] = float(current_source_score + event_side_score)

    existing['threshold_vnd'] = float(max(_safe_float(existing.get('threshold_vnd'), threshold_vnd), threshold_vnd))
    if str(threshold_source or '').strip().lower() == 'symbol_override':
        existing['threshold_source'] = 'symbol_override'
    else:
        existing['threshold_source'] = str(existing.get('threshold_source') or 'user_default')
    existing['matched_value_vnd'] = float(max(_safe_float(existing.get('matched_value_vnd'), threshold_vnd), matched_value_candidate, threshold_vnd))
    existing['score_sum'] = float(_safe_float(existing.get('score_sum'), 0.0) + event_side_score)
    existing['sources'] = sorted(source_set)
    existing['source_scores'] = source_scores
    existing['updated_at'] = now.isoformat()
    # F1: Update dark_flow fields when dark_flow signal arrives
    if source == 'dark_flow':
        existing['dark_flow_strength'] = max(float(existing.get('dark_flow_strength', 0) or 0), float(payload.get('strength', 0) or 0))
        existing['dark_flow_confidence'] = str(payload.get('confidence') or existing.get('dark_flow_confidence', 'low'))
    cache.set(cache_key, existing, timeout=cache_ttl)
    record_advisory_merge_observation('merged')
    return {'status': 'merged', 'cache_key': cache_key, 'window_seconds': merge_window_seconds}


def _normalize_advisory_source(source: str | None) -> str:
    source_key = str(source or WhaleAdvisory.SourceChoices.WHALE_SIGNAL).strip().lower()
    allowed = {
        WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
        WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        WhaleAdvisory.SourceChoices.USER_REFRESH,
    }
    if source_key in allowed:
        return source_key
    return WhaleAdvisory.SourceChoices.WHALE_SIGNAL


def _token_log_source_for_advisory_source(source: str) -> str:
    source_key = _normalize_advisory_source(source)
    if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB:
        return AdvisoryTokenLog.SourceChoices.AUTO_GENERATION
    if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH:
        return AdvisoryTokenLog.SourceChoices.MANUAL_REFRESH
    return AdvisoryTokenLog.SourceChoices.WHALE_SIGNAL


def _estimate_advisory_confidence(
    *,
    matched_value_vnd: float,
    threshold: float,
    dark_flow_strength: float | None,
    merged_sources: list[str] | None,
) -> float:
    if dark_flow_strength is not None:
        strength_value = float(dark_flow_strength or 0)
        if strength_value > 1.0:
            strength_value = strength_value / 100.0
        confidence_score = strength_value
    else:
        ratio = float(matched_value_vnd or 0) / float(threshold or 1) if float(threshold or 0) > 0 else 0.5
        confidence_score = ratio / 5.0

    if len(merged_sources or []) > 1:
        confidence_score += 0.05
    return max(0.0, min(confidence_score, 0.99))


def _estimate_advisory_actionability(
    *,
    severity: str,
    use_concise: bool,
    merged_sources: list[str] | None,
) -> float:
    base_score = {
        WhaleAdvisory.SeverityChoices.URGENT: 0.90,
        WhaleAdvisory.SeverityChoices.WARNING: 0.75,
        WhaleAdvisory.SeverityChoices.INFO: 0.55,
    }.get(str(severity or '').strip().lower(), 0.50)
    if use_concise:
        base_score -= 0.05
    if len(merged_sources or []) > 1:
        base_score += 0.05
    return max(0.0, min(base_score, 0.99))


def _advisory_audit_reason_for_source(source: str) -> str:
    source_key = _normalize_advisory_source(source)
    if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB:
        return 'auto_generation'
    if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH:
        return 'manual_refresh'
    if source_key == 'dark_flow':
        return 'dark_flow_detected'
    return 'new_whale_event'


def _advisory_audit_actor_for_source(source: str) -> str:
    source_key = _normalize_advisory_source(source)
    if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB:
        return 'scheduler'
    if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH:
        return 'user'
    return 'system'


def _persist_advisory_metrics_audit_log(
    *,
    user,
    symbol: str,
    advisory,
    latest_existing_advisory,
    source: str,
    threshold_source: str,
    merged_sources: list[str],
    primary_source: str,
    metrics: dict,
    task_id: str,
) -> None:
    if user is None or advisory is None:
        return

    before_state = {}
    if latest_existing_advisory is not None:
        before_state = {
            'advisory_id': latest_existing_advisory.id,
            'severity': getattr(latest_existing_advisory, 'severity', ''),
            'source': getattr(latest_existing_advisory, 'source', ''),
            'threshold_source': getattr(latest_existing_advisory, 'threshold_source', ''),
            'created_at': latest_existing_advisory.created_at.isoformat() if latest_existing_advisory.created_at else None,
        }

    after_state = {
        'advisory_id': advisory.id,
        'snapshot_id': advisory.aggregate_snapshot_id,
        'severity': advisory.severity,
        'source': advisory.source,
        'threshold_source': threshold_source,
        'primary_source': primary_source,
        'merged_sources': merged_sources,
        'created_at': advisory.created_at.isoformat() if advisory.created_at else None,
    }

    audit_actor = _advisory_audit_actor_for_source(source)
    actor_id = str(user.id) if audit_actor == 'user' else str(task_id or 'generate_whale_advisory_task')

    try:
        from portfolio.models import AdvisoryAggregateAuditLog

        AdvisoryAggregateAuditLog.objects.create(
            user=user,
            symbol=symbol,
            before_state_json=before_state,
            after_state_json=after_state,
            reason=_advisory_audit_reason_for_source(source),
            actor=audit_actor,
            actor_id=actor_id,
            metadata_json=metrics,
        )
    except Exception as exc:
        logger.warning('Advisory metrics audit log persistence failed for %s: %s', symbol, exc)


def _get_tokens_used_today(user_id: int) -> int:
    total = AdvisoryTokenLog.objects.filter(
        user_id=user_id,
        created_at__date=timezone.localdate(),
    ).aggregate(total=Sum('tokens_used'))['total']
    return int(total or 0)


def _build_advisory_aggregate_state_payload(
    *,
    symbol: str,
    matched_value_vnd: float,
    threshold: float,
    side: str,
    source: str,
    severity: str,
    merged_sources: list[str],
    primary_source: str,
    dark_flow_strength: float | None,
    dark_flow_confidence: str | None,
    use_concise: bool,
) -> dict:
    return {
        'whale': {
            'signal_count': 1,
            'max_value': float(matched_value_vnd or 0),
            'max_threshold': float(threshold or 0),
            'side': str(side or 'UNKNOWN').upper(),
        },
        'dark_flow': {
            'detection_count': 1 if dark_flow_strength is not None else 0,
            'max_strength': float(dark_flow_strength or 0),
            'max_confidence': str(dark_flow_confidence or 'low'),
        },
        'order_flow': {
            'event_count': 1,
            'latest_severity': str(severity or WhaleAdvisory.SeverityChoices.INFO),
        },
        'market': {
            'context': 'legacy_h2_bootstrap',
            'benchmark': {},
        },
        'history': [
            {
                'timestamp': timezone.now().isoformat(),
                'event': 'advisory_generation',
                'source': str(source or WhaleAdvisory.SourceChoices.WHALE_SIGNAL),
            }
        ],
        'quality': {
            'actionability': 0.0,
            'noise_ratio': 0.0,
            'consistency': 1.0 if len(merged_sources or []) > 1 else 0.7,
        },
        'updated_at': timezone.now().isoformat(),
        'source': str(source or WhaleAdvisory.SourceChoices.WHALE_SIGNAL),
        'merged_sources': list(merged_sources or []),
        'primary_source': str(primary_source or ''),
        'severity': str(severity or WhaleAdvisory.SeverityChoices.INFO),
        'used_concise': bool(use_concise),
    }


def _persist_advisory_aggregate_snapshot(
    *,
    user,
    symbol: str,
    matched_value_vnd: float,
    threshold: float,
    side: str,
    source: str,
    severity: str,
    merged_sources: list[str],
    primary_source: str,
    dark_flow_strength: float | None,
    dark_flow_confidence: str | None,
    use_concise: bool,
) -> AdvisoryAggregateSnapshot | None:
    if user is None:
        return None

    normalized_symbol = _normalize_symbol(symbol)
    now = timezone.now()
    expires_at = now + timedelta(days=30)

    with transaction.atomic():
        latest_snapshot = (
            AdvisoryAggregateSnapshot.objects.select_for_update()
            .filter(user=user, symbol=normalized_symbol)
            .order_by('-snapshot_seq')
            .first()
        )
        next_seq = (latest_snapshot.snapshot_seq + 1) if latest_snapshot is not None else 1
        state_json = _build_advisory_aggregate_state_payload(
            symbol=normalized_symbol,
            matched_value_vnd=matched_value_vnd,
            threshold=threshold,
            side=side,
            source=source,
            severity=severity,
            merged_sources=merged_sources,
            primary_source=primary_source,
            dark_flow_strength=dark_flow_strength,
            dark_flow_confidence=dark_flow_confidence,
            use_concise=use_concise,
        )
        state_json['seq'] = next_seq

        return AdvisoryAggregateSnapshot.objects.create(
            user=user,
            symbol=normalized_symbol,
            snapshot_seq=next_seq,
            state_json=state_json,
            expires_at=expires_at,
        )


def _get_remaining_advisory_budget(user_config: UserConfig) -> int:
    budget = int(user_config.advisory_max_tokens_per_day or 0)
    return max(budget - _get_tokens_used_today(user_config.user_id), 0)


def _get_auto_generation_count_today(user_id: int) -> int:
    return AdvisoryTokenLog.objects.filter(
        user_id=user_id,
        source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
        created_at__date=timezone.localdate(),
    ).count()


def _get_remaining_auto_refreshes(user_config: UserConfig) -> int:
    daily_limit = int(user_config.advisory_max_auto_refreshes_per_day or 0)
    return max(daily_limit - _get_auto_generation_count_today(user_config.user_id), 0)


def _resolve_next_refresh_at(user_config: UserConfig | None) -> timezone.datetime | None:
    if user_config is None:
        return None
    refresh_hours = max(int(user_config.advisory_refresh_interval_hours or 24), 1)
    return timezone.now() + timedelta(hours=refresh_hours)


def _resolve_advisory_threshold_vnd(
    user_config: UserConfig,
    tracked_symbol: TrackedSymbol | None = None,
    tracked_threshold_million: float | None = None,
) -> float:
    if tracked_threshold_million is not None:
        return resolve_user_whale_threshold_vnd(tracked_threshold_million)
    if tracked_symbol is not None and tracked_symbol.whale_alert_threshold_million is not None:
        return resolve_user_whale_threshold_vnd(tracked_symbol.whale_alert_threshold_million)
    return resolve_user_whale_threshold_vnd(user_config.whale_alert_threshold)


def _should_use_concise_advisory(source: str, remaining_budget: int | None) -> bool:
    threshold = max(int(os.getenv('ADVISORY_CONCISE_BUDGET_THRESHOLD', '1200')), 200)
    return source == WhaleAdvisory.SourceChoices.PERIODIC_JOB or (
        remaining_budget is not None and remaining_budget <= threshold
    )


# Default cheaper/faster fallback model per provider used during low-budget routing.
_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS: dict[str, str] = {
    'openai': 'gpt-3.5-turbo',
    'claude': 'claude-3-haiku-20240307',
    'gemini': 'gemini-1.5-flash',
    'copilot': 'openai/gpt-4.1-mini',
    'openclaw': 'default',
}


def _resolve_model_for_budget(
    provider: str,
    model: str,
    remaining_budget: int | None,
    total_budget: int | None,
) -> str:
    """Return a (possibly downgraded) model ID based on remaining daily token budget.

    When the user's remaining budget falls below ``ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT``
    percent of ``total_budget``, the task is automatically routed to a cheaper / faster model
    so the session can serve more advisory cycles with the remaining tokens.

    The fallback model is configurable per provider via env vars of the form
    ``ADVISORY_BUDGET_DOWNGRADE_MODEL_{PROVIDER}`` (e.g. ``ADVISORY_BUDGET_DOWNGRADE_MODEL_OPENAI``).
    An empty or missing env var falls back to :data:`_ADVISORY_BUDGET_DOWNGRADE_DEFAULTS`.
    """
    if remaining_budget is None or total_budget is None or total_budget <= 0:
        return model

    threshold_pct = max(float(os.getenv('ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT', '20')), 1.0)
    threshold_tokens = total_budget * (threshold_pct / 100.0)

    if remaining_budget > threshold_tokens:
        return model  # Budget still comfortable — keep original model.

    provider_key = str(provider or '').strip().lower()
    env_key = f'ADVISORY_BUDGET_DOWNGRADE_MODEL_{provider_key.upper()}'
    cheap_model = (os.getenv(env_key) or _ADVISORY_BUDGET_DOWNGRADE_DEFAULTS.get(provider_key, '')).strip()

    if not cheap_model or cheap_model == model:
        return model

    logger.info(
        'Advisory model downgraded (low budget): provider=%s %s→%s remaining=%s total=%s threshold_pct=%.1f',
        provider, model, cheap_model, remaining_budget, total_budget, threshold_pct,
    )
    # Increment daily downgrade counter for monitoring metrics endpoint.
    from django.core.cache import cache as _cache
    from django.utils import timezone as _tz
    _dg_key = f'advisory:budget-downgrade-count:{_tz.localdate().isoformat()}'
    try:
        _cache.incr(_dg_key)
    except ValueError:
        _cache.set(_dg_key, 1, timeout=90_000)  # ~25h
    except Exception:
        pass
    return cheap_model


def _increment_daily_counter(key: str, timeout_seconds: int = 90_000) -> None:
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=timeout_seconds)
    except Exception:
        pass


def _classify_provider_failure(exc: Exception) -> str:
    exc_str = str(exc or '').lower()
    if '429' in exc_str or 'too many requests' in exc_str:
        return 'rate_limited'
    if '401' in exc_str or 'unauthorized' in exc_str or 'forbidden' in exc_str:
        return 'auth_failed'
    if '503' in exc_str or 'service unavailable' in exc_str:
        return 'service_down'
    if '408' in exc_str or 'timeout' in exc_str or 'timed out' in exc_str:
        return 'timeout'
    return 'unknown'


def _is_failover_eligible_failure(failure_type: str) -> bool:
    return failure_type in {'rate_limited', 'service_down', 'timeout'}


def _mark_provider_ratelimit(provider: str) -> None:
    provider_key = str(provider or '').strip().lower()
    if not provider_key:
        return
    _rl_key = f'advisory:provider-ratelimit:{provider_key}'
    _rl_seconds = int(os.getenv('AI_PROVIDER_RATELIMIT_PAUSE_SECONDS', '120'))
    cache.set(_rl_key, 1, timeout=_rl_seconds)
    _429_counter_key = f'advisory:429-count:{provider_key}:{timezone.localdate().isoformat()}'
    _increment_daily_counter(_429_counter_key)


def _record_provider_attempt(provider: str, success: bool, failure_type: str = '') -> None:
    provider_key = str(provider or '').strip().lower()
    if not provider_key:
        return
    today_iso = timezone.localdate().isoformat()
    _increment_daily_counter(f'advisory:provider-attempts:{provider_key}:{today_iso}')
    if success:
        _increment_daily_counter(f'advisory:provider-success:{provider_key}:{today_iso}')
        return
    if failure_type:
        cache.set(
            f'advisory:provider-last-failure:{provider_key}',
            {'failure_type': failure_type, 'at': timezone.now().isoformat()},
            timeout=90_000,
        )


def _record_failover_event(source_provider: str, target_provider: str, failure_type: str, success: bool) -> None:
    source_key = str(source_provider or '').strip().lower()
    target_key = str(target_provider or '').strip().lower()
    reason_key = str(failure_type or 'unknown').strip().lower() or 'unknown'
    today_iso = timezone.localdate().isoformat()
    _increment_daily_counter(f'advisory:failover-attempt-count:{today_iso}')
    _increment_daily_counter(f'advisory:failover-count:{source_key}:{today_iso}')
    _increment_daily_counter(f'advisory:failover-target:{source_key}:{target_key}:{today_iso}')
    _increment_daily_counter(f'advisory:failover-reason:{source_key}:{reason_key}:{today_iso}')
    if success:
        _increment_daily_counter(f'advisory:failover-success-count:{today_iso}')
        _increment_daily_counter(f'advisory:failover-success:{source_key}:{today_iso}')


_VI_DIACRITIC_PATTERN = re.compile(r'[\u0102\u0103\u00c2\u00e2\u0110\u0111\u00ca\u00ea\u00d4\u00f4\u01a0\u01a1\u01af\u01b0\u00e1\u00e0\u1ea3\u00e3\u1ea1\u1eaf\u1eb1\u1eb3\u1eb5\u1eb7\u1ea5\u1ea7\u1ea9\u1eab\u1ead\u00e9\u00e8\u1ebb\u1ebd\u1eb9\u1ebf\u1ec1\u1ec3\u1ec5\u1ec7\u00ed\u00ec\u1ec9\u0129\u1ecb\u00f3\u00f2\u1ecf\u00f5\u1ecd\u1ed1\u1ed3\u1ed5\u1ed7\u1ed9\u1edb\u1edd\u1edf\u1ee1\u1ee3\u00fa\u00f9\u1ee7\u0169\u1ee5\u1ee9\u1eeb\u1eed\u1eef\u1ef1\u00fd\u1ef3\u1ef7\u1ef9\u1ef5]')


def _is_language_mismatch(text: str, expected_language: str) -> bool:
    content = str(text or '').strip()
    if not content:
        return False

    expected = str(expected_language or 'vi').strip().lower()
    has_vi_chars = bool(_VI_DIACRITIC_PATTERN.search(content))
    english_cues = sum(
        1
        for token in re.findall(r'[a-zA-Z]{3,}', content.lower())
        if token in {'the', 'and', 'risk', 'watch', 'signal', 'market', 'volume', 'trend', 'short', 'term', 'support', 'resistance'}
    )

    if expected == 'en':
        return has_vi_chars
    return (not has_vi_chars) and english_cues >= 2


def _compute_advisory_severity(matched_value_vnd: float, threshold: float) -> str:
    """
    Tính mức độ nghiêm trọng từ tỷ lệ matched_value / threshold:
    - >= 5x → urgent (cá mập lớn, giá trị khớp rất cao)
    - >= 2x → warning (cá mập bình thường)
    - else  → info
    """
    if threshold and threshold > 0:
        ratio = float(matched_value_vnd) / float(threshold)
        if ratio >= 5.0:
            return WhaleAdvisory.SeverityChoices.URGENT
        if ratio >= 2.0:
            return WhaleAdvisory.SeverityChoices.WARNING
    return WhaleAdvisory.SeverityChoices.INFO


def _compute_dark_flow_severity(
    strength: float,
    confidence: str = 'low',
    cvd_change: float = 0.0,
) -> str:
    """
    F1 Fix: Tính severity riêng cho dark_flow dựa trên strength + confidence + cvd_change.
    Không dùng matched_value/threshold (vì dark flow không có concept "matched_value").

    Quy tắc:
    - URGENT: strength >= 80 AND confidence in [high, high_confidence]
    - WARNING: (strength >= 60) OR (strength >= 40 AND confidence in [medium, high, high_confidence])
    - INFO: else

    Tham số:
    - strength: 0-100, độ mạnh của dark flow signal (từ order flow analysis)
    - confidence: low/medium/high/high_confidence
    - cvd_change: cumulative volume delta direction (dùng cho context nhưng không là chỉ tiêu chính)
    """
    strength_val = float(strength or 0)
    confidence_str = str(confidence or 'low').strip().lower()

    # Normalize confidence levels
    is_high_confidence = confidence_str in {'high', 'high_confidence', 'very_high'}
    is_medium_confidence = confidence_str in {'medium', 'medium_confidence'}

    # Urgent: very strong + high confidence
    if strength_val >= 80 and is_high_confidence:
        return WhaleAdvisory.SeverityChoices.URGENT

    # Warning: either very strong, or strong + good confidence
    if strength_val >= 60:
        return WhaleAdvisory.SeverityChoices.WARNING
    if strength_val >= 40 and (is_high_confidence or is_medium_confidence):
        return WhaleAdvisory.SeverityChoices.WARNING

    # Info: everything else
    return WhaleAdvisory.SeverityChoices.INFO


def _detect_reversal_signal(symbol: str) -> dict | None:
    """
    Phát hiện đảo chiều: >= N lệnh BUY liên tiếp trong cửa sổ 15 phút,
    sau đó xuất hiện 1 lệnh SELL lớn vượt ngưỡng.
    """
    from portfolio.models import IntradayTick

    window_minutes = max(int(os.getenv('REVERSAL_WINDOW_MINUTES', '15')), 5)
    min_consecutive_buy = max(int(os.getenv('REVERSAL_MIN_CONSECUTIVE_BUY', '3')), 2)
    min_sell_value_vnd = float(os.getenv('REVERSAL_MIN_SELL_VALUE_VND', '5000000000'))

    now = timezone.localtime()
    today = timezone.localdate()
    cutoff_dt = now - timedelta(minutes=window_minutes)
    cutoff_t = cutoff_dt.time()

    ticks = list(
        IntradayTick.objects.filter(symbol=symbol, trade_date=today)
        .filter(trade_time__gte=cutoff_t)
        .values('trade_time', 'price', 'volume', 'side')
        .order_by('trade_time')
    )
    if len(ticks) < min_consecutive_buy + 1:
        return None

    buy_streak = 0
    for idx, tick in enumerate(ticks):
        side = str(tick.get('side') or '').upper()
        if side == 'BUY':
            buy_streak += 1
            continue

        if side != 'SELL':
            buy_streak = 0
            continue

        sell_value = float(tick.get('price') or 0) * float(tick.get('volume') or 0)
        if buy_streak >= min_consecutive_buy and sell_value >= min_sell_value_vnd:
            buy_values = [
                float(item.get('price') or 0) * float(item.get('volume') or 0)
                for item in ticks[max(0, idx - buy_streak):idx]
                if str(item.get('side') or '').upper() == 'BUY'
            ]
            avg_buy_value = (sum(buy_values) / len(buy_values)) if buy_values else 0
            return {
                'symbol': symbol,
                'sell_value_vnd': sell_value,
                'buy_streak': buy_streak,
                'avg_buy_value_vnd': avg_buy_value,
                'triggered_at': datetime.combine(today, tick['trade_time']).isoformat(),
            }

        buy_streak = 0

    return None


