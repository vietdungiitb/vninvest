from __future__ import annotations

from datetime import timedelta, datetime
import logging
import os
import random
import re

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from portfolio.ai_options import get_advisory_provider_failover_chain, get_default_model

from portfolio.models import (
    AdvisoryTokenLog,
    AdvisoryAggregateSnapshot,
    PriceAlertRule,
    SecuritiesGroup,
    SecuritiesItem,
    TrackedSymbol,
    Transaction,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
    WhaleAdvisory,
    WhaleConfigRollout,
)
from portfolio.realtime.collector import collect_intraday_frame, collect_symbols_for_user, collect_and_push
from portfolio.realtime.compute import (
    build_heartbeat_payload,
    build_ticker_payload,
    build_whale_payload,
    detect_whale_signals,
)
from portfolio.realtime.publisher import RealtimePublisher
from portfolio.services import (
    activate_due_scheduled_whale_config_rollouts,
    ensure_rollout_worker_ack_records,
    get_live_celery_worker_names,
    monitor_whale_config_rollout_anomalies,
    record_whale_config_worker_ack,
    resolve_whale_runtime_config,
    refresh_rollout_propagation_status,
    sync_watchlist_prices,
)
from portfolio.adapters.vnstock_adapter import fetch_price_board_dataframe
from portfolio.domain_constants import resolve_user_whale_threshold_vnd
from portfolio.onboarding_trial_service import process_expired_onboarding_trials
from portfolio.observability import (
    end_advisory_phase,
    end_advisory_session,
    record_advisory_actionability,
    record_advisory_confidence,
    record_advisory_error_recovery,
    record_advisory_merge_observation,
    record_advisory_token_usage,
    record_whale_dedup_observation,
    record_whale_event_observation,
    start_advisory_phase,
    start_advisory_session,
)

logger = logging.getLogger(__name__)

TICKER_PREFETCH_META_CACHE_KEY = 'ticker:prefetch:meta'
VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY = 'vnstock:rate-limit:price_board'
ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY = 'advisory:auto-generation:job-lock'
ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX = 'advisory:event-merge'


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


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def flush_merged_advisory_event(self, user_id: int, symbol: str) -> dict:
    normalized_symbol = _normalize_symbol(symbol)
    cache_key = _advisory_event_merge_cache_key(int(user_id), normalized_symbol)
    state = cache.get(cache_key)
    if not state:
        record_advisory_merge_observation('skipped')
        return {'status': 'skipped', 'reason': 'no_merged_state', 'user_id': int(user_id), 'symbol': normalized_symbol}

    threshold_vnd = _safe_float(state.get('threshold_vnd'), 0.0)
    threshold_source = str(state.get('threshold_source') or 'user_default')
    matched_value_vnd = _safe_float(state.get('matched_value_vnd'), threshold_vnd)
    score_sum = _safe_float(state.get('score_sum'), 0.0)
    side = _resolve_side_by_dynamic_score(score_sum)
    merged_sources = [str(item) for item in (state.get('sources') or [])]
    source_scores = state.get('source_scores') or {}
    primary_source = ''
    if source_scores:
        ranked_source = max(source_scores.items(), key=lambda kv: abs(_safe_float(kv[1], 0.0)))
        primary_source = str(ranked_source[0])
    elif merged_sources:
        primary_source = merged_sources[0]

    # F1: Extract dark flow fields for severity computation
    dark_flow_strength = state.get('dark_flow_strength')
    dark_flow_confidence = state.get('dark_flow_confidence')

    # F1 Fix: Determine source semantically - use dark_flow if present & has strength, else whale_signal
    advisory_source = WhaleAdvisory.SourceChoices.WHALE_SIGNAL
    if 'dark_flow' in merged_sources and dark_flow_strength is not None:
        advisory_source = 'dark_flow'

    task = generate_whale_advisory_task.apply_async(
        kwargs={
            'symbol': normalized_symbol,
            'matched_value_vnd': max(matched_value_vnd, threshold_vnd),
            'side': side,
            'threshold': threshold_vnd,
            'threshold_source': threshold_source,
            'force_refresh': True,
            'user_id': int(user_id),
            'source': advisory_source,
            'merged_sources': merged_sources,
            'primary_source': primary_source,
            'dark_flow_strength': dark_flow_strength,
            'dark_flow_confidence': dark_flow_confidence,
        },
        countdown=0,
    )

    cache.delete(cache_key)
    record_advisory_merge_observation('flushed')
    return {
        'status': 'queued',
        'user_id': int(user_id),
        'symbol': normalized_symbol,
        'task_id': task.id,
        'score_sum': score_sum,
        'resolved_side': side,
        'threshold_source': threshold_source,
        'sources': merged_sources,
        'primary_source': primary_source,
    }


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

    now = timezone.now()
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


def _distinct_symbols(queryset) -> list[str]:
    return sorted({
        str(symbol).strip().upper()
        for symbol in queryset
        if symbol and str(symbol).strip()
    })


def _collect_prefetch_symbols() -> tuple[list[str], dict]:
    include_group_symbols = os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true'
    symbol_limit = max(int(os.getenv('TICKER_PREFETCH_SYMBOL_LIMIT', '240')), 0)

    source_lists = {
        'tracked_symbols': _distinct_symbols(TrackedSymbol.objects.values_list('symbol', flat=True).distinct()),
        'watchlist_items': _distinct_symbols(WatchlistItem.objects.values_list('symbol', flat=True).distinct()),
        'price_alerts': _distinct_symbols(PriceAlertRule.objects.values_list('symbol', flat=True).distinct()),
        'portfolio_transactions': _distinct_symbols(Transaction.objects.values_list('symbol', flat=True).distinct()),
    }
    if include_group_symbols:
        source_lists['market_group_items'] = _distinct_symbols(
            SecuritiesItem.objects.values_list('symbol', flat=True).distinct()
        )

    merged_symbols = []
    seen = set()
    for _, symbols in source_lists.items():
        for symbol in symbols:
            if symbol in seen:
                continue
            seen.add(symbol)
            merged_symbols.append(symbol)

    if symbol_limit:
        merged_symbols = merged_symbols[:symbol_limit]

    source_counts = {name: len(symbols) for name, symbols in source_lists.items()}
    return merged_symbols, source_counts


def _store_prefetch_meta(payload: dict, timeout: int = 600) -> None:
    try:
        cache.set(TICKER_PREFETCH_META_CACHE_KEY, payload, timeout=timeout)
    except Exception:
        pass


def _is_rate_limited_error(exc: Exception) -> bool:
    message = str(exc or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'gioi han api' in message
        or 'giới hạn api' in message
    )


def _prefetch_retry_countdown(retries: int) -> int:
    base = max(int(os.getenv('TICKER_PREFETCH_RETRY_BASE_SECONDS', '8')), 1)
    max_seconds = max(int(os.getenv('TICKER_PREFETCH_RETRY_MAX_SECONDS', '120')), base)
    return min(max_seconds, base * (2 ** max(retries, 0)))


VNSTOCK_TIMEOUT_COUNTER_KEY = 'vnstock:timeout-counter:price_board'


def _mark_price_board_rate_limited(exc: Exception) -> None:
    cooldown_seconds = max(int(os.getenv('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', '20')), 5)
    try:
        cache.set(
            VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
            {
                'triggered_at': timezone.now().isoformat(),
                'reason': str(exc or '')[:200],
            },
            timeout=cooldown_seconds,
        )
    except Exception:
        pass


def _record_vnstock_timeout(exc: Exception) -> bool:
    """Track consecutive timeout/connection errors.

    Returns True and activates 30-minute circuit-breaker lock once the threshold
    (default 3 consecutive timeouts within 5 minutes) is reached.
    Separate from rate-limit cooldown — this protects against sustained outages.
    """
    if not isinstance(exc, (TimeoutError, ConnectionError, OSError)):
        return False
    try:
        _counter_window = int(os.getenv('VNSTOCK_CIRCUIT_WINDOW_SECONDS', '300'))
        _threshold = int(os.getenv('VNSTOCK_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', '3'))
        _circuit_cooldown = int(os.getenv('VNSTOCK_CIRCUIT_BREAKER_COOLDOWN_SECONDS', '1800'))

        current = cache.get(VNSTOCK_TIMEOUT_COUNTER_KEY) or 0
        new_count = current + 1
        cache.set(VNSTOCK_TIMEOUT_COUNTER_KEY, new_count, timeout=_counter_window)

        if new_count >= _threshold:
            logger.warning(
                'vnstock circuit breaker triggered after %d consecutive timeouts — pausing %ds',
                new_count,
                _circuit_cooldown,
            )
            cache.set(
                VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
                {
                    'triggered_at': timezone.now().isoformat(),
                    'reason': f'circuit_breaker_timeout_threshold_exceeded count={new_count}',
                },
                timeout=_circuit_cooldown,
            )
            cache.delete(VNSTOCK_TIMEOUT_COUNTER_KEY)
            return True
    except Exception:
        pass
    return False


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def activate_due_whale_config_rollouts(self) -> dict:
    activated = activate_due_scheduled_whale_config_rollouts()
    return {
        'status': 'ok',
        'activated_count': len(activated),
        'activated': activated,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def monitor_whale_config_anomalies(self, auto_revert: bool = True) -> dict:
    results = monitor_whale_config_rollout_anomalies(auto_revert=auto_revert)
    auto_reverted = [result for result in results if result.get('auto_reverted')]
    anomalies = [result for result in results if not result.get('anomaly', {}).get('healthy', True)]
    return {
        'status': 'ok',
        'checked_count': len(results),
        'anomaly_count': len(anomalies),
        'auto_reverted_count': len(auto_reverted),
        'results': results,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def refresh_whale_config_rollout_status(self, rollout_id: int) -> dict:
    rollout = WhaleConfigRollout.objects.select_related('version').get(pk=rollout_id)
    worker_result = get_live_celery_worker_names()
    ensure_rollout_worker_ack_records(rollout, worker_names=worker_result['workers'])
    snapshot = refresh_rollout_propagation_status(rollout)
    return {
        'status': rollout.status,
        'rollout_id': rollout.id,
        'version_code': rollout.version.version_code,
        'signal': snapshot['signal'],
        'acked_count': snapshot['acked_count'],
        'expected_count': snapshot['expected_count'],
        'missing_workers': snapshot['missing_workers'],
        'stale_workers': snapshot['stale_workers'],
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def ack_whale_config_rollout(
    self,
    rollout_id: int,
    worker_name: str | None = None,
    worker_version: str | None = None,
    details: str = '',
) -> dict:
    rollout = WhaleConfigRollout.objects.select_related('version').get(pk=rollout_id)
    resolved_worker_name = worker_name or getattr(self.request, 'hostname', '') or 'unknown-worker'
    resolved_version = worker_version or rollout.version.version_code

    ack = record_whale_config_worker_ack(
        rollout,
        worker_name=resolved_worker_name,
        worker_version=resolved_version,
        acked=True,
        details=details or 'ack_from_task',
    )
    snapshot = refresh_rollout_propagation_status(rollout)
    return {
        'status': rollout.status,
        'rollout_id': rollout.id,
        'worker_name': ack.worker_name,
        'worker_version': ack.worker_version,
        'signal': snapshot['signal'],
        'acked_count': snapshot['acked_count'],
        'expected_count': snapshot['expected_count'],
    }


def _whale_thresholds_for_user(user_id: int | None) -> list[float]:
    default_threshold = float(getattr(settings, "REALTIME_DEFAULT_WHALE_THRESHOLD", 500_000_000))
    if user_id is None:
        return [default_threshold]

    config = UserConfig.objects.filter(user_id=user_id).values("whale_alert_threshold").first()
    if not config or config.get("whale_alert_threshold") is None:
        return [default_threshold]

    # whale_alert_threshold is in million VND in current domain model.
    threshold_vnd = float(config["whale_alert_threshold"]) * 1_000_000
    return [threshold_vnd]


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def collect_and_publish_realtime(self, user_id: int | None = None) -> dict:
    if not getattr(settings, "REALTIME_ENABLED", False):
        return {"status": "skipped", "reason": "REALTIME_ENABLED=false"}

    symbols = collect_symbols_for_user(user_id=user_id)
    if not symbols:
        return {"status": "ok", "symbols": 0, "published": 0}

    # --- Redis Streams: push ticks vào stream trước khi publish WebSocket ---
    stream_enabled = getattr(settings, "STREAM_REDIS_URL", None)
    producer = None
    if stream_enabled:
        try:
            from portfolio.realtime.tick_producer import TickProducer
            producer = TickProducer()
        except Exception as exc:
            logger.warning("TickProducer init failed: %s", exc)

    publisher = RealtimePublisher()
    worker_name = getattr(self.request, 'hostname', '') or 'collect-and-publish'

    user_thresholds = _whale_thresholds_for_user(user_id)
    symbol_threshold_overrides: dict[str, float] = {}
    if user_id is not None and symbols:
        override_rows = TrackedSymbol.objects.filter(
            user_id=user_id,
            symbol__in=symbols,
            whale_alert_threshold_million__isnull=False,
        ).values('symbol', 'whale_alert_threshold_million')
        for row in override_rows:
            normalized_symbol = _normalize_symbol(row.get('symbol'))
            if not normalized_symbol:
                continue
            symbol_threshold_overrides[normalized_symbol] = resolve_user_whale_threshold_vnd(
                row.get('whale_alert_threshold_million')
            )

    published = 0
    for symbol in symbols:
        normalized_symbol = _normalize_symbol(symbol)
        runtime_config = resolve_whale_runtime_config(
            symbol=symbol,
            worker_name=worker_name,
            source='collect_and_publish',
        )
        if user_id is not None:
            thresholds = [
                symbol_threshold_overrides.get(normalized_symbol, user_thresholds[0])
            ]
        else:
            thresholds = runtime_config['thresholds_vnd'] or user_thresholds

        # Thu thập frame một lần, tái dùng cho cả Stream push lẫn WebSocket publish
        frame = collect_intraday_frame(symbol)

        # Push ticks vào Redis Stream (nếu available) — dùng lại frame đã fetch
        if producer is not None:
            try:
                producer.ensure_consumer_groups(symbol)
                producer.push_intraday_ticks(symbol, frame)
            except Exception as exc:
                logger.warning("Stream push failed for %s: %s", symbol, exc)

        ticker_channel = f"ticker:{symbol}"
        ticker_seq = publisher.next_seq(ticker_channel)
        ticker_payload = build_ticker_payload(symbol=symbol, trades_df=frame, seq=ticker_seq)
        if publisher.publish(ticker_channel, ticker_payload):
            published += 1

        whale_channel = f"whale:{symbol}"
        for signal in detect_whale_signals(symbol=symbol, trades_df=frame, thresholds=thresholds):
            whale_seq = publisher.next_seq(whale_channel)
            whale_payload = build_whale_payload(
                signal=signal,
                seq=whale_seq,
                config_version=runtime_config['version_code'],
                source=f"collect-and-publish:{runtime_config['mode']}",
                score_config=runtime_config['score_config'],
            )
            # Dedup: same whale trade can appear in 100-tick snapshot on every 5s poll.
            # Use Django cache with 5-minute TTL to suppress duplicate WS publishes.
            event_id = whale_payload.get("event_id", "")
            if event_id:
                dedup_cache_key = f"whale:dedup:{event_id}"
                if cache.get(dedup_cache_key):
                    record_whale_dedup_observation(hit=True)
                    continue
                cache.set(dedup_cache_key, 1, timeout=300)
                record_whale_dedup_observation(hit=False)

            if publisher.publish(whale_channel, whale_payload):
                published += 1
                record_whale_event_observation(
                    source=str(whale_payload.get('source') or 'intraday-engine'),
                    ts=whale_payload.get('ts'),
                    recovered=bool(whale_payload.get('recovered')),
                )
            if user_id is not None:
                user_channel = f"user:{user_id}:alerts"
                user_seq = publisher.next_seq(user_channel)
                user_payload = {**whale_payload, "seq": user_seq}
                if publisher.publish(user_channel, user_payload):
                    published += 1
            tracked_rows = list(
                TrackedSymbol.objects.filter(symbol=signal.symbol)
                .values('user_id', 'whale_alert_threshold_million')
            )
            for tracked_row in tracked_rows:
                tracked_user_id = int(tracked_row.get('user_id') or 0)
                if not tracked_user_id:
                    continue
                user_cfg = UserConfig.objects.filter(user_id=tracked_user_id).first()
                if user_cfg is None:
                    continue
                if not bool(user_cfg.advisory_whale_signal_enabled):
                    continue
                threshold_vnd = _resolve_advisory_threshold_vnd(
                    user_cfg,
                    tracked_threshold_million=tracked_row.get('whale_alert_threshold_million'),
                )
                threshold_source = 'symbol_override' if tracked_row.get('whale_alert_threshold_million') is not None else 'user_default'
                _accumulate_user_advisory_event(
                    user_id=int(tracked_user_id),
                    symbol=signal.symbol,
                    source='whale_alert',
                    payload={
                        'event_score': whale_payload.get('event_score', 0),
                        'side': whale_payload.get('side') or signal.side,
                        'matched_value': signal.matched_value,
                    },
                    threshold_vnd=threshold_vnd,
                    threshold_source=threshold_source,
                )

    if user_id is not None:
        heartbeat_channel = f"user:{user_id}:alerts"
        heartbeat_seq = publisher.next_seq(heartbeat_channel)
        heartbeat_payload = build_heartbeat_payload(scope=f"user:{user_id}", seq=heartbeat_seq)
        if publisher.publish(heartbeat_channel, heartbeat_payload):
            published += 1

    logger.info("Realtime publish completed: symbols=%d published=%d", len(symbols), published)
    return {"status": "ok", "symbols": len(symbols), "published": published}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_user_watch_assets(self, user_id: int, days: int | None = None) -> dict:
    sync_days = int(days or getattr(settings, 'WATCHLIST_SYNC_DAYS', 5))
    results = sync_watchlist_prices(user_id=user_id, days=sync_days)
    return {
        'status': 'ok',
        'user_id': user_id,
        'days': sync_days,
        'symbols': len(results),
        'synced': results,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 3})
def sync_all_watch_assets(self, days: int | None = None) -> dict:
    sync_days = int(days or getattr(settings, 'WATCHLIST_SYNC_DAYS', 5))
    user_ids = sorted({
        *TrackedSymbol.objects.values_list('user_id', flat=True),
        *WatchlistGroup.objects.values_list('user_id', flat=True),
    })
    user_ids = [user_id for user_id in user_ids if user_id]

    synced_users = []
    total_symbols = 0
    for user_id in user_ids:
                results = sync_watchlist_prices(user_id=user_id, days=sync_days)
                total_symbols += len(results)
                synced_users.append({'user_id': user_id, 'symbols': len(results)})

    return {
        'status': 'ok',
        'days': sync_days,
        'users': synced_users,
        'total_users': len(synced_users),
        'total_symbols': total_symbols,
    }


# ---------------------------------------------------------------------------
# M2: Celery task — chạy consumer batch theo group (thay thế cho long-running process)
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=False, retry_kwargs={"max_retries": 0})
def run_stream_consumer_batch(self, group: str = "all") -> dict:
    """
    Chạy một batch của stream consumers cho tất cả active symbols.
    Được gọi định kỳ qua Celery Beat (thay vì long-running process).
    """
    from portfolio.realtime.stream_consumers import (
        DbWriterConsumer,
        WsBroadcastConsumer,
        AlertEngineConsumer,
    )

    worker_name = getattr(self.request, 'hostname', '') or f'{group}-worker'
    consumers = []
    if group in ("all", "db-writer"):
        consumers.append(DbWriterConsumer(consumer_name=worker_name))
    if group in ("all", "ws-broadcaster"):
        consumers.append(WsBroadcastConsumer(consumer_name=worker_name))
    if group in ("all", "alert-engine"):
        consumers.append(AlertEngineConsumer(consumer_name=worker_name))

    symbols = collect_symbols_for_user(user_id=None)
    if not symbols:
        return {"status": "ok", "processed": 0}

    total = 0
    for symbol in symbols:
        for consumer in consumers:
            try:
                total += consumer.run_once(symbol)
            except Exception as exc:
                logger.warning("consumer.run_once(%s, %s) error: %s", group, symbol, exc)

    return {"status": "ok", "group": group, "symbols": len(symbols), "processed": total}


# ---------------------------------------------------------------------------
# M4: EOD cleanup — trim stream và xóa IntradayTick cũ
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def cleanup_old_intraday_ticks(self, keep_days: int = 7) -> dict:
    """
    Xóa IntradayTick cũ hơn `keep_days` ngày để tránh DB phình to.
    Chạy mỗi đêm qua Celery Beat.
    """
    from datetime import date, timedelta
    from portfolio.models import IntradayTick

    cutoff = date.today() - timedelta(days=keep_days)
    deleted, _ = IntradayTick.objects.filter(trade_date__lt=cutoff).delete()
    logger.info("EOD cleanup: deleted %d IntradayTick records older than %s", deleted, cutoff)
    return {"status": "ok", "deleted": deleted, "cutoff": str(cutoff)}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={"max_retries": 2})
def trim_streams(self) -> dict:
    """
    Trim tất cả Redis Streams về STREAM_MAX_LEN để tiết kiệm bộ nhớ.
    Chạy định kỳ qua Celery Beat.
    """
    from portfolio.realtime.tick_producer import TickProducer

    max_len = getattr(settings, "STREAM_MAX_LEN", 50_000)
    symbols = collect_symbols_for_user(user_id=None)
    if not symbols:
        return {"status": "ok", "trimmed": 0}

    try:
        client = TickProducer().client
    except Exception as exc:
        logger.warning("trim_streams: Redis unavailable: %s", exc)
        return {"status": "skipped", "reason": str(exc)}

    trimmed = 0
    for symbol in symbols:
        key = TickProducer.stream_key(symbol)
        try:
            client.xtrim(key, maxlen=max_len, approximate=True)
            trimmed += 1
        except Exception as exc:
            logger.warning("trim_streams: xtrim(%s) failed: %s", key, exc)

    return {"status": "ok", "trimmed": trimmed, "max_len": max_len}


# ---------------------------------------------------------------------------
# AI Advisory: Gọi OpenClaw → lưu WhaleAdvisory → push WebSocket
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=60, retry_kwargs={'max_retries': 2})
def generate_whale_advisory_task(
    self,
    symbol: str,
    matched_value_vnd: float,
    side: str,
    threshold: float = 0,
    force_refresh: bool = False,
    user_id: int | None = None,
    source: str = WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
    merged_sources: list[str] | None = None,
    primary_source: str | None = None,
    advisory_type: str = WhaleAdvisory.AdvisoryTypeChoices.DEFAULT,
    severity_override: str | None = None,
    threshold_source: str = 'user_default',
    dark_flow_strength: float | None = None,
    dark_flow_confidence: str | None = None,
) -> dict:
    """
    1. Kiểm tra Redis cooldown — bỏ qua nếu đã gọi trong 15 phút.
    2. Gọi provider AI được cấu hình trong UserConfig: summary (Pro) + detail (Premium).
    3. Lưu WhaleAdvisory vào DB.
    4. Push WebSocket event whale_advisory tới group whale_{symbol}.
    """
    from django.core.cache import cache
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from portfolio.ai_runtime_config import resolve_ai_runtime_config
    from portfolio.ai_service import _resolve_provider_api_key, generate_advisory_concise, generate_whale_text

    cooldown = getattr(settings, 'WHALE_ADVISORY_COOLDOWN_SECONDS', 900)
    cache_key = f'whale_advisory_lock:{user_id}:{symbol}' if user_id is not None else f'whale_advisory_lock:{symbol}'
    source_key = _normalize_advisory_source(source)

    advisory_qs = WhaleAdvisory.objects.filter(symbol=symbol)
    if user_id is not None:
        advisory_qs = advisory_qs.filter(user_id=user_id)
    latest_existing_advisory = advisory_qs.order_by('-created_at').first()

    if not force_refresh and latest_existing_advisory is not None:
        logger.info('Whale advisory already exists — skipping auto generation for %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'existing_advisory'}

    if not force_refresh and cache.get(cache_key):
        logger.info('Whale advisory cooldown active — skipping %s', symbol)
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'cooldown'}

    target_user = None
    user_cfg = None
    remaining_budget = None
    if user_id is not None:
        user_cfg = UserConfig.objects.filter(user_id=user_id).select_related('user').first()
        target_user = getattr(user_cfg, 'user', None)

    if user_cfg is not None:
        if source_key == WhaleAdvisory.SourceChoices.WHALE_SIGNAL and not user_cfg.advisory_whale_signal_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'whale_signal_disabled', 'user_id': user_id}
        if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and not user_cfg.advisory_auto_generation_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'auto_generation_disabled', 'user_id': user_id}
        if source_key == WhaleAdvisory.SourceChoices.USER_REFRESH and not user_cfg.advisory_manual_refresh_enabled:
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'manual_refresh_disabled', 'user_id': user_id}

        # Fix race condition: acquire per-user generation lock before budget check so two concurrent
        # Celery tasks cannot both pass the budget gate and overrun the daily limit together.
        _gen_lock_key = f'advisory:gen-lock:{user_id}'
        _lock_acquired = cache.add(_gen_lock_key, 1, timeout=90)
        if not _lock_acquired:
            logger.info('Whale advisory generation locked (concurrent task) for user=%s symbol=%s', user_id, symbol)
            return {'status': 'skipped', 'symbol': symbol, 'reason': 'concurrent_generation_active', 'user_id': user_id}

        try:
            remaining_budget = _get_remaining_advisory_budget(user_cfg)
            if remaining_budget <= 0:
                logger.info('Whale advisory budget exhausted for user=%s symbol=%s source=%s', user_id, symbol, source_key)
                return {
                    'status': 'skipped',
                    'symbol': symbol,
                    'reason': 'daily_budget_exceeded',
                    'user_id': user_id,
                    'source': source_key,
                }
            if source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB and _get_remaining_auto_refreshes(user_cfg) <= 0:
                logger.info('Whale advisory auto-refresh count exhausted for user=%s symbol=%s', user_id, symbol)
                return {
                    'status': 'skipped',
                    'symbol': symbol,
                    'reason': 'daily_auto_refresh_limit_exceeded',
                    'user_id': user_id,
                    'source': source_key,
                }
        finally:
            # Release lock — generation itself continues; lock only protected the budget-check window.
            cache.delete(_gen_lock_key)

    runtime_cfg = resolve_ai_runtime_config(user=target_user)
    if not runtime_cfg.get('ready'):
        logger.info(
            'Whale advisory skipped for %s: runtime AI not ready reason=%s user_id=%s',
            symbol,
            runtime_cfg.get('reason'),
            user_id,
        )
        return {
            'status': 'skipped',
            'symbol': symbol,
            'reason': str(runtime_cfg.get('reason') or 'runtime_ai_not_ready'),
            'user_id': user_id,
            'ai_source': runtime_cfg.get('source'),
        }

    provider = str(runtime_cfg.get('provider') or 'openclaw').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    primary_provider = provider
    primary_model = model
    # Pop api_key immediately so the full config dict is safe to log without exposing the key.
    api_key = str(runtime_cfg.pop('api_key', '') or '').strip()
    ai_source = str(runtime_cfg.get('source') or 'unknown')

    # Check per-provider rate-limit cooldown set by a previous 429 response.
    if cache.get(f'advisory:provider-ratelimit:{provider}'):
        logger.info(
            'Whale advisory skipped — provider %s still in rate-limit cooldown symbol=%s user_id=%s',
            provider,
            symbol,
            user_id,
        )
        return {'status': 'skipped', 'symbol': symbol, 'reason': 'provider_rate_limit_cooldown', 'user_id': user_id}

    use_concise = _should_use_concise_advisory(source_key, remaining_budget)
    output_language = str(getattr(user_cfg, 'language', 'vi') if user_cfg is not None else 'vi').strip().lower()
    if output_language not in {'vi', 'en'}:
        output_language = 'vi'

    # P2: Route to cheaper model when remaining budget is below threshold percentage.
    _total_budget = int(user_cfg.advisory_max_tokens_per_day or 0) if user_cfg is not None else None
    model = _resolve_model_for_budget(provider, model, remaining_budget, _total_budget)
    primary_model = model

    failover_chain = get_advisory_provider_failover_chain().get(primary_provider, [])
    providers_to_try = [primary_provider] + [p for p in failover_chain if p != primary_provider]
    failover_occurred = False
    failover_reason = ''
    failover_chain_attempted: list[str] = []
    failover_attempt_count = 0

    start_advisory_session()
    start_advisory_phase('provider_generation')
    summary_resp = None
    deep_resp = None
    last_exc: Exception | None = None

    for idx, attempt_provider in enumerate(providers_to_try):
        failover_chain_attempted.append(attempt_provider)
        attempt_model = model if attempt_provider == primary_provider else get_default_model(attempt_provider)
        attempt_model = _resolve_model_for_budget(attempt_provider, attempt_model, remaining_budget, _total_budget)
        attempt_api_key = api_key if attempt_provider == primary_provider else _resolve_provider_api_key(attempt_provider, '')

        if not attempt_api_key:
            _record_provider_attempt(attempt_provider, success=False, failure_type='missing_api_key')
            if idx + 1 < len(providers_to_try):
                failover_attempt_count += 1
                _record_failover_event(attempt_provider, providers_to_try[idx + 1], 'missing_api_key', success=False)
            continue

        try:
            if use_concise:
                summary_resp = generate_advisory_concise(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    user=target_user,
                    output_language=output_language,
                )
                deep_resp = {'text': '', 'prompt_tokens': 0, 'completion_tokens': 0}
            else:
                summary_resp = generate_whale_text(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    deep=False,
                    user=target_user,
                    output_language=output_language,
                )
                deep_resp = generate_whale_text(
                    provider=attempt_provider,
                    model=attempt_model,
                    api_key=attempt_api_key,
                    symbol=symbol,
                    matched_value_vnd=matched_value_vnd,
                    side=side,
                    deep=True,
                    user=target_user,
                    output_language=output_language,
                )

            _record_provider_attempt(attempt_provider, success=True)
            if attempt_provider != primary_provider:
                failover_occurred = True
                _record_failover_event(primary_provider, attempt_provider, failover_reason or 'unknown', success=True)
            provider = attempt_provider
            model = attempt_model
            break
        except Exception as exc:
            failure_type = _classify_provider_failure(exc)
            last_exc = exc
            _record_provider_attempt(attempt_provider, success=False, failure_type=failure_type)

            if failure_type == 'rate_limited':
                _mark_provider_ratelimit(attempt_provider)

            can_failover = _is_failover_eligible_failure(failure_type)
            has_next_provider = idx + 1 < len(providers_to_try)

            if can_failover and has_next_provider:
                failover_attempt_count += 1
                if not failover_reason:
                    failover_reason = failure_type
                next_provider = providers_to_try[idx + 1]
                _record_failover_event(attempt_provider, next_provider, failure_type, success=False)
                logger.warning(
                    'Advisory provider failover: %s/%s failed (%s) symbol=%s -> next=%s',
                    attempt_provider,
                    attempt_model,
                    failure_type,
                    symbol,
                    next_provider,
                )
                continue

            logger.error(
                'AI provider error for %s via %s/%s (%s): %s',
                symbol,
                attempt_provider,
                attempt_model,
                failure_type,
                exc,
            )
            break

    end_advisory_phase('provider_generation')
    if summary_resp is None or deep_resp is None:
        record_advisory_error_recovery(type(last_exc).__name__ if last_exc else 'RuntimeError', 'provider_generation_failed', success=False)
        end_advisory_session()
        raise (last_exc or RuntimeError('All advisory providers failed'))

    today_iso = timezone.localdate().isoformat()
    _increment_daily_counter(f'advisory:language-check-count:{output_language}:{today_iso}')
    summary_language_mismatch = _is_language_mismatch(summary_resp.get('text', ''), output_language)
    detail_language_mismatch = _is_language_mismatch(deep_resp.get('text', ''), output_language)
    language_mismatch = bool(summary_language_mismatch or detail_language_mismatch)
    if language_mismatch:
        _increment_daily_counter(f'advisory:language-mismatch-count:{output_language}:{today_iso}')
        logger.warning(
            'Advisory language mismatch detected symbol=%s expected=%s provider=%s model=%s',
            symbol,
            output_language,
            provider,
            model,
        )

    record_advisory_token_usage(
        int(summary_resp.get('prompt_tokens', 0) or 0) + int(summary_resp.get('completion_tokens', 0) or 0),
        source='summary_generation' if not use_concise else 'concise_generation',
    )
    if not use_concise:
        record_advisory_token_usage(
            int(deep_resp.get('prompt_tokens', 0) or 0) + int(deep_resp.get('completion_tokens', 0) or 0),
            source='detail_generation',
        )

    refresh_count = (latest_existing_advisory.refresh_count + 1) if (force_refresh and latest_existing_advisory is not None) else 0
    
    # F1 Fix: Use dark_flow severity mapper for dark flow sources
    if severity_override:
        resolved_severity = str(severity_override).strip().lower()
    elif source == 'dark_flow' and dark_flow_strength is not None:
        resolved_severity = _compute_dark_flow_severity(
            strength=dark_flow_strength,
            confidence=dark_flow_confidence or 'low',
            cvd_change=0.0,
        )
    else:
        resolved_severity = _compute_advisory_severity(matched_value_vnd, float(threshold or 0))
    
    if resolved_severity not in {
        WhaleAdvisory.SeverityChoices.URGENT,
        WhaleAdvisory.SeverityChoices.WARNING,
        WhaleAdvisory.SeverityChoices.INFO,
    }:
        resolved_severity = WhaleAdvisory.SeverityChoices.INFO

    advisory_type_key = str(advisory_type or WhaleAdvisory.AdvisoryTypeChoices.DEFAULT).strip().lower()
    if advisory_type_key not in {
        WhaleAdvisory.AdvisoryTypeChoices.DEFAULT,
        WhaleAdvisory.AdvisoryTypeChoices.REVERSAL,
    }:
        advisory_type_key = WhaleAdvisory.AdvisoryTypeChoices.DEFAULT

    normalized_merged_sources = sorted({str(item).strip().lower() for item in (merged_sources or []) if str(item).strip()})
    normalized_primary_source = str(primary_source or '').strip().lower()
    normalized_threshold_source = str(threshold_source or 'user_default').strip().lower() or 'user_default'
    if normalized_threshold_source not in {'user_default', 'symbol_override'}:
        normalized_threshold_source = 'user_default'
    if not normalized_primary_source and normalized_merged_sources:
        normalized_primary_source = normalized_merged_sources[0]

    record_advisory_confidence(
        _estimate_advisory_confidence(
            matched_value_vnd=matched_value_vnd,
            threshold=float(threshold or 0),
            dark_flow_strength=dark_flow_strength,
            merged_sources=normalized_merged_sources,
        ),
        source=source_key,
    )
    record_advisory_actionability(
        _estimate_advisory_actionability(
            severity=resolved_severity,
            use_concise=use_concise,
            merged_sources=normalized_merged_sources,
        ),
        factors={
            'severity_weight': 1.0 if resolved_severity == WhaleAdvisory.SeverityChoices.URGENT else 0.75 if resolved_severity == WhaleAdvisory.SeverityChoices.WARNING else 0.5,
            'multi_source_bonus': 0.05 if len(normalized_merged_sources) > 1 else 0.0,
            'concise_penalty': -0.05 if use_concise else 0.0,
        },
    )

    aggregate_snapshot = _persist_advisory_aggregate_snapshot(
        user=target_user,
        symbol=symbol,
        matched_value_vnd=matched_value_vnd,
        threshold=float(threshold or 0),
        side=side,
        source=source_key,
        severity=resolved_severity,
        merged_sources=normalized_merged_sources,
        primary_source=normalized_primary_source,
        dark_flow_strength=dark_flow_strength,
        dark_flow_confidence=dark_flow_confidence,
        use_concise=use_concise,
    )

    start_advisory_phase('persist_advisory')
    advisory = WhaleAdvisory.objects.create(
        user=target_user,
        symbol=symbol,
        matched_value=int(matched_value_vnd),
        side=side,
        threshold=float(threshold or 0),
        ai_summary=summary_resp['text'],
        ai_detail=deep_resp['text'],
        ai_provider=provider,
        ai_model=model,
        prompt_tokens=summary_resp['prompt_tokens'] + deep_resp['prompt_tokens'],
        completion_tokens=summary_resp['completion_tokens'] + deep_resp['completion_tokens'],
        next_refresh_at=_resolve_next_refresh_at(user_cfg),
        refresh_count=refresh_count,
        is_auto_generated=source_key == WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        aggregate_snapshot=aggregate_snapshot,
        source=source_key,
        merged_sources=normalized_merged_sources,
        primary_source=normalized_primary_source,
        advisory_type=advisory_type_key,
        severity=resolved_severity,
    )

    if target_user is not None:
        AdvisoryTokenLog.objects.create(
            user=target_user,
            advisory=advisory,
            tokens_used=advisory.prompt_tokens + advisory.completion_tokens,
            source=_token_log_source_for_advisory_source(source_key),
            symbol=symbol,
        )
    end_advisory_phase('persist_advisory')

    # Set cooldown lock cho luồng auto; refresh thủ công có cooldown riêng ở API endpoint.
    if not force_refresh:
        cache.set(cache_key, True, timeout=cooldown)

    # Push WebSocket event tới user group nếu advisory được sinh theo user cụ thể.
    try:
        start_advisory_phase('broadcast')
        channel_layer = get_channel_layer()
        target_group = f'user_{user_id}_alerts' if user_id is not None else f'whale_{symbol}'
        async_to_sync(channel_layer.group_send)(
            target_group,
            {
                'type': 'whale_advisory',
                'payload': {
                    'event_type': 'whale_advisory',
                    'symbol': symbol,
                    'side': side,
                    'matched_value': int(matched_value_vnd),
                    'threshold': float(threshold or 0),
                    'threshold_source': normalized_threshold_source,
                    'ai_summary': advisory.ai_summary,
                    'ai_detail': advisory.ai_detail,
                    'ai_provider': advisory.ai_provider,
                    'ai_model': advisory.ai_model,
                    'ts': advisory.created_at.isoformat(),
                    'created_at': advisory.created_at.isoformat(),
                    'id': advisory.id,
                    'snapshot_id': advisory.aggregate_snapshot_id,
                },
            },
        )
        end_advisory_phase('broadcast')
    except Exception as exc:
        end_advisory_phase('broadcast')
        record_advisory_error_recovery(type(exc).__name__, 'broadcast_failed', success=False)
        logger.warning('WebSocket push failed for whale_advisory %s: %s', symbol, exc)

    metrics_payload = end_advisory_session()
    if metrics_payload:
        metrics_payload.update(
            {
                'advisory_id': advisory.id,
                'ai_provider': provider,
                'ai_model': model,
                'ai_provider_primary': primary_provider,
                'ai_model_primary': primary_model,
                'ai_source': ai_source,
                'output_language': output_language,
                'language_mismatch': language_mismatch,
                'failover_occurred': failover_occurred,
                'failover_reason': failover_reason,
                'failover_chain_attempted': failover_chain_attempted,
                'failover_attempt_count': failover_attempt_count,
                'threshold_source': normalized_threshold_source,
                'source': source_key,
                'merged_sources': normalized_merged_sources,
                'primary_source': normalized_primary_source,
                'used_concise': use_concise,
                'snapshot_id': advisory.aggregate_snapshot_id,
            }
        )
        _persist_advisory_metrics_audit_log(
            user=target_user,
            symbol=symbol,
            advisory=advisory,
            latest_existing_advisory=latest_existing_advisory,
            source=source_key,
            threshold_source=normalized_threshold_source,
            merged_sources=normalized_merged_sources,
            primary_source=normalized_primary_source,
            metrics=metrics_payload,
            task_id=getattr(self.request, 'id', ''),
        )

    logger.info('WhaleAdvisory created: id=%d symbol=%s side=%s', advisory.id, symbol, side)
    return {
        'status': 'ok',
        'advisory_id': advisory.id,
        'symbol': symbol,
        'ai_provider': provider,
        'ai_model': model,
        'ai_provider_primary': primary_provider,
        'ai_model_primary': primary_model,
        'ai_source': ai_source,
        'output_language': output_language,
        'language_mismatch': language_mismatch,
        'failover_occurred': failover_occurred,
        'failover_reason': failover_reason,
        'failover_chain_attempted': failover_chain_attempted,
        'failover_attempt_count': failover_attempt_count,
        'force_refresh': bool(force_refresh),
        'user_id': user_id,
        'source': source_key,
        'threshold_source': normalized_threshold_source,
        'merged_sources': normalized_merged_sources,
        'primary_source': normalized_primary_source,
        'used_concise': use_concise,
        'snapshot_id': advisory.aggregate_snapshot_id,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def auto_generate_advisories_for_all_tracked(self, batch_size: int | None = None) -> dict:
    """
    Queue advisory generation for tracked symbols that do not have an advisory yet
    or whose last advisory is due for refresh.
    """
    job_lock_timeout = max(int(os.getenv('ADVISORY_AUTO_GENERATION_JOB_LOCK_SECONDS', '1800')), 60)
    if not cache.add(ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY, timezone.now().isoformat(), timeout=job_lock_timeout):
        return {'status': 'skipped', 'reason': 'job_locked'}

    try:
        estimated_tokens_per_job = max(int(os.getenv('ADVISORY_AUTO_GENERATION_ESTIMATED_TOKENS', '250')), 50)
        queue_lock_timeout = max(int(os.getenv('ADVISORY_AUTO_GENERATION_QUEUE_LOCK_SECONDS', '1800')), 60)
        max_symbols = max(int(batch_size or os.getenv('ADVISORY_AUTO_GENERATION_BATCH_SIZE', '200')), 1)
        jitter_min = max(int(os.getenv('ADVISORY_AUTO_GENERATION_JITTER_MIN_SECONDS', '5')), 0)
        jitter_max = max(int(os.getenv('ADVISORY_AUTO_GENERATION_JITTER_MAX_SECONDS', '15')), jitter_min)
        now = timezone.now()

        stats = {
            'status': 'ok',
            'users_considered': 0,
            'users_skipped_budget': 0,
            'symbols_considered': 0,
            'queued_count': 0,
            'skipped_existing': 0,
            'skipped_locked': 0,
            'skipped_budget': 0,
        }

        user_configs = UserConfig.objects.select_related('user').filter(
            user__is_active=True,
            advisory_auto_generation_enabled=True,
            user__tracked_symbols__isnull=False,
        ).distinct()

        for user_config in user_configs:
            if stats['queued_count'] >= max_symbols:
                break

            stats['users_considered'] += 1
            remaining_budget = _get_remaining_advisory_budget(user_config)
            remaining_auto_refreshes = _get_remaining_auto_refreshes(user_config)
            if remaining_budget < estimated_tokens_per_job:
                stats['users_skipped_budget'] += 1
                continue
            if remaining_auto_refreshes <= 0:
                stats['users_skipped_budget'] += 1
                continue

            tracked_symbols = list(
                TrackedSymbol.objects.filter(user_id=user_config.user_id).order_by('-updated_at', '-added_at')
            )
            for tracked_symbol in tracked_symbols:
                if stats['queued_count'] >= max_symbols:
                    break

                stats['symbols_considered'] += 1
                if remaining_budget < estimated_tokens_per_job:
                    stats['skipped_budget'] += 1
                    break
                if remaining_auto_refreshes <= 0:
                    stats['skipped_budget'] += 1
                    break

                latest_advisory = WhaleAdvisory.objects.filter(
                    user_id=user_config.user_id,
                    symbol=tracked_symbol.symbol,
                ).order_by('-created_at').first()

                if latest_advisory is None:
                    should_queue = True
                    force_refresh = False
                    matched_value_vnd = _resolve_advisory_threshold_vnd(user_config, tracked_symbol)
                    advisory_side = 'INFO'
                    advisory_threshold = matched_value_vnd
                else:
                    refresh_due_at = latest_advisory.next_refresh_at or (
                        latest_advisory.created_at + timedelta(hours=max(int(user_config.advisory_refresh_interval_hours or 24), 1))
                    )
                    should_queue = refresh_due_at <= now
                    force_refresh = should_queue
                    matched_value_vnd = float(latest_advisory.matched_value or 0) or _resolve_advisory_threshold_vnd(user_config, tracked_symbol)
                    advisory_side = latest_advisory.side or 'INFO'
                    advisory_threshold = float(latest_advisory.threshold or 0) or _resolve_advisory_threshold_vnd(user_config, tracked_symbol)

                if not should_queue:
                    stats['skipped_existing'] += 1
                    continue

                queue_lock_key = f'advisory:auto-generation:queue:{user_config.user_id}:{tracked_symbol.symbol}'
                if not cache.add(queue_lock_key, now.isoformat(), timeout=queue_lock_timeout):
                    stats['skipped_locked'] += 1
                    continue

                generate_whale_advisory_task.apply_async(
                    kwargs={
                        'symbol': tracked_symbol.symbol,
                        'matched_value_vnd': matched_value_vnd,
                        'side': advisory_side,
                        'threshold': advisory_threshold,
                        'threshold_source': 'symbol_override' if tracked_symbol.whale_alert_threshold_million is not None else 'user_default',
                        'force_refresh': force_refresh,
                        'user_id': user_config.user_id,
                        'source': WhaleAdvisory.SourceChoices.PERIODIC_JOB,
                    },
                    countdown=random.randint(jitter_min, jitter_max),
                )
                stats['queued_count'] += 1
                remaining_budget = max(remaining_budget - estimated_tokens_per_job, 0)
                remaining_auto_refreshes = max(remaining_auto_refreshes - 1, 0)

        return stats
    finally:
        cache.delete(ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY)


# ---------------------------------------------------------------------------
# Tier-2 Cache pre-fetch: batch price_board cho tất cả tracked symbols
# Giải quyết thread pool exhaustion — 1 vnstock call thay vì N calls
# ---------------------------------------------------------------------------
@shared_task(bind=True)
def prefetch_ticker_price_board(self) -> dict:
    """
    Gọi vnstock price_board MỘT LẦN cho tất cả tracked symbols.
    Kết quả được lưu vào Django cache (ticker:{symbol}) với TTL 60s.
    HTTP handler RealtimeTickerView chỉ đọc cache, không gọi vnstock nữa.
    Chạy mỗi 20s qua Celery Beat (luôn bật, không cần REALTIME_ENABLED).
    """
    batch_size = max(int(os.getenv('TICKER_PREFETCH_BATCH_SIZE', '60')), 1)
    symbols, source_counts = _collect_prefetch_symbols()
    if not symbols:
        payload = {
            'status': 'ok',
            'symbols': 0,
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': [],
        }
        _store_prefetch_meta(payload)
        return payload

    def _f(val):
        try:
            v = float(val)
            return v if v == v and v != 0 else None
        except (TypeError, ValueError):
            return None

    def _i(val):
        try:
            v = float(val)
            return int(v) if v == v else None
        except (TypeError, ValueError):
            return None

    now_iso = timezone.now().isoformat()
    cached_count = 0
    processed_batches = 0
    max_retries = max(int(os.getenv('TICKER_PREFETCH_MAX_RETRIES', '6')), 0)
    if cache.get(VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY):
        payload = {
            'status': 'backoff',
            'reason': 'price_board rate limit cooldown active',
            'symbols': len(symbols),
            'cached': 0,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': 0,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload
    try:
        for start in range(0, len(symbols), batch_size):
            batch_symbols = symbols[start:start + batch_size]
            df = fetch_price_board_dataframe(batch_symbols, anchor_symbol=batch_symbols[0])
            processed_batches += 1

            if df is None or df.empty:
                continue

            for _, row in df.iterrows():
                try:
                    sym = str(row.get(('listing', 'symbol')) or '').upper()
                    if not sym:
                        continue
                    match_price = _f(row.get(('match', 'match_price')))
                    ref_price = (_f(row.get(('listing', 'ref_price')))
                                 or _f(row.get(('match', 'reference_price'))))
                    highest = _f(row.get(('match', 'highest')))
                    lowest = _f(row.get(('match', 'lowest')))
                    open_price = _f(row.get(('match', 'open_price')))
                    accum_vol = _i(row.get(('match', 'accumulated_volume')))
                    change_value = round(match_price - ref_price, 2) if match_price and ref_price else None
                    change_pct = (round((match_price - ref_price) / ref_price * 100, 2)
                                  if match_price and ref_price else None)
                    data = {
                        'symbol': sym,
                        'current_price': match_price,
                        'prev_price': ref_price,
                        'change_value': change_value,
                        'change_pct': change_pct,
                        'high_price': highest,
                        'low_price': lowest,
                        'open_price': open_price,
                        'volume': accum_vol,
                        'last_date': now_iso,
                        'freshness_seconds': 0,
                        'stale': False,
                        'source': 'prefetch',
                    }
                    cache.set(f'ticker:{sym}', data, timeout=60)
                    cached_count += 1
                except Exception as exc:
                    logger.warning('prefetch_ticker_price_board parse error row: %s', exc)
    except (Exception, SystemExit) as exc:
        logger.warning('prefetch_ticker_price_board vnstock error: %s', exc)
        # Track consecutive timeouts; triggers 30-min circuit breaker after threshold.
        _record_vnstock_timeout(exc)
        if _is_rate_limited_error(exc):
            _mark_price_board_rate_limited(exc)
            countdown = _prefetch_retry_countdown(getattr(self.request, 'retries', 0))
            payload = {
                'status': 'retrying',
                'reason': str(exc),
                'symbols': len(symbols),
                'cached': cached_count,
                'source_counts': source_counts,
                'generated_at': timezone.now().isoformat(),
                'batch_size': batch_size,
                'batches': processed_batches,
                'sample_symbols': symbols[:10],
                'retry_after_seconds': countdown,
                'retry_count': getattr(self.request, 'retries', 0) + 1,
                'max_retries': max_retries,
            }
            _store_prefetch_meta(payload)
            raise self.retry(exc=exc, countdown=countdown, max_retries=max_retries)

        payload = {
            'status': 'error',
            'reason': str(exc),
            'symbols': len(symbols),
            'cached': cached_count,
            'source_counts': source_counts,
            'generated_at': timezone.now().isoformat(),
            'batch_size': batch_size,
            'batches': processed_batches,
            'sample_symbols': symbols[:10],
        }
        _store_prefetch_meta(payload)
        return payload

    payload = {
        'status': 'ok',
        'symbols': len(symbols),
        'cached': cached_count,
        'source_counts': source_counts,
        'generated_at': now_iso,
        'batch_size': batch_size,
        'batches': processed_batches,
        'sample_symbols': symbols[:10],
        'retry_count': getattr(self.request, 'retries', 0),
    }
    _store_prefetch_meta(payload)
    logger.info(
        'prefetch_ticker_price_board: symbols=%d cached=%d batches=%d',
        len(symbols),
        cached_count,
        processed_batches,
    )
    return payload


# ---------------------------------------------------------------------------
# Sprint 15 — Order Flow Detection Task
# ---------------------------------------------------------------------------
ORDER_FLOW_COOLDOWN_SECONDS = 300   # 5 phut / symbol
ORDER_FLOW_MAX_SYMBOLS = 30


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_and_store_order_flow(self, symbol: str | None = None) -> dict:
    """
    Chay detect_dark_flow() cho moi symbol dang duoc theo doi.
    Luu OrderFlowSignal neu signal_type != 'none' hoac strength > 20.
    Publish dark_flow_alert WS event neu strength > 50.
    Cooldown: ORDER_FLOW_COOLDOWN_SECONDS / symbol (5 phut).
    Bi tat khi ORDER_FLOW_DETECTION_ENABLED=false.
    """
    if not getattr(settings, 'ORDER_FLOW_DETECTION_ENABLED', True):
        return {'status': 'disabled'}

    from portfolio.models import OrderFlowSignal
    from portfolio.order_flow import detect_dark_flow

    if symbol:
        symbols = [symbol.upper()]
    else:
        tracked = list(TrackedSymbol.objects.values_list('symbol', flat=True).distinct())
        watchlisted = list(WatchlistItem.objects.values_list('symbol', flat=True).distinct())
        symbols = sorted({s.upper() for s in tracked + watchlisted if s})[:ORDER_FLOW_MAX_SYMBOLS]

    processed = 0
    stored = 0
    alerted = 0
    errors = 0

    for sym in symbols:
        lock_key = f'order_flow_lock:{sym}'
        if cache.get(lock_key):
            continue

        try:
            result = detect_dark_flow(sym)
        except Exception as exc:
            logger.warning('detect_dark_flow error for %s: %s', sym, exc)
            errors += 1
            continue

        processed += 1
        strength = float(result.get('strength', 0) or 0)
        signal_type = str(result.get('signal_type', 'none') or 'none')
        comps = result.get('components', {}) or {}
        tick_rate_info = comps.get('tick_rate', {}) or {}
        size_dist = comps.get('size_distribution', {}) or {}
        cvd_change = comps.get('absorption', {}).get('cvd_change', 0)

        # Sprint 34 A1: Calculate severity (B1) and deterministic event_id (A1)
        if strength < 40:
            severity = OrderFlowSignal.SeverityChoices.INFO
        elif strength < 70:
            severity = OrderFlowSignal.SeverityChoices.WARNING
        else:
            severity = OrderFlowSignal.SeverityChoices.URGENT
        triggered_at_iso = result.get('triggered_at', timezone.now().isoformat())
        event_id = f"dark_flow:{sym}:{triggered_at_iso}:{signal_type}"

        if signal_type != 'none' or strength > 20:
            _, created = OrderFlowSignal.objects.update_or_create(
                event_id=event_id,
                defaults={
                    'symbol': sym,
                    'signal_type': signal_type,
                    'strength': strength,
                    'confidence': result.get('confidence', 'low'),
                    'tick_rate': tick_rate_info.get('tick_rate_per_min', 0),
                    'small_order_ratio': size_dist.get('small_ratio', 0),
                    'cvd_at_signal': cvd_change,
                    'price_at_signal': 0,
                    'window_seconds': 300,
                    'components_json': comps,
                    'severity': severity,
                },
            )
            if created:
                stored += 1
            cache.set(lock_key, True, timeout=ORDER_FLOW_COOLDOWN_SECONDS)

        if strength > 50:
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer

                channel_layer = get_channel_layer()
                iceberg = comps.get('iceberg', {}) or {}
                if iceberg.get('level'):
                    description = (
                        f"Phat hien {iceberg.get('repeat_count', 0)} lenh lap tai "
                        f"{iceberg.get('level', 0):,.0f} VND"
                    )
                else:
                    description = f"Tin hieu {signal_type} strength={strength:.0f}"

                async_to_sync(channel_layer.group_send)(
                    f'whale_{sym}',
                    {
                        'type': 'dark_flow_alert',
                        'data': {
                            'event_type': 'dark_flow_alert',
                            'contract_version': '1.0',
                            'symbol': sym,
                            'signal_type': signal_type,
                            'strength': strength,
                            'confidence': result.get('confidence', 'low'),
                            'tick_rate': tick_rate_info.get('tick_rate_per_min', 0),
                            'small_order_ratio': size_dist.get('small_ratio', 0),
                            'cvd_at_signal': cvd_change,
                            'description': description,
                            'event_id': event_id,
                            'ts': result.get('triggered_at', timezone.now().isoformat()),
                            'severity': severity,
                        },
                    },
                )
                alerted += 1

                tracked_rows = list(
                    TrackedSymbol.objects.filter(symbol=sym)
                    .values('user_id', 'whale_alert_threshold_million')
                )
                for tracked_row in tracked_rows:
                    tracked_user_id = int(tracked_row.get('user_id') or 0)
                    if not tracked_user_id:
                        continue
                    user_cfg = UserConfig.objects.filter(user_id=tracked_user_id).first()
                    if user_cfg is None:
                        continue
                    if not bool(user_cfg.advisory_whale_signal_enabled):
                        continue
                    threshold_vnd = _resolve_advisory_threshold_vnd(
                        user_cfg,
                        tracked_threshold_million=tracked_row.get('whale_alert_threshold_million'),
                    )
                    threshold_source = 'symbol_override' if tracked_row.get('whale_alert_threshold_million') is not None else 'user_default'
                    _accumulate_user_advisory_event(
                        user_id=int(tracked_user_id),
                        symbol=sym,
                        source='dark_flow',
                        payload={
                            'strength': strength,
                            'signal_type': signal_type,
                            'cvd_change': cvd_change,
                            'confidence': result.get('confidence', 'low'),
                            'matched_value_vnd': threshold_vnd,
                        },
                        threshold_vnd=threshold_vnd,
                        threshold_source=threshold_source,
                    )
            except Exception as exc:
                logger.warning('dark_flow_alert WS push failed for %s: %s', sym, exc)

    logger.info(
        'detect_and_store_order_flow: symbols=%d processed=%d stored=%d alerted=%d errors=%d',
        len(symbols), processed, stored, alerted, errors,
    )
    return {
        'status': 'ok',
        'symbols': len(symbols),
        'processed': processed,
        'stored': stored,
        'alerted': alerted,
        'errors': errors,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_whale_reversal(self, symbol: str | None = None) -> dict:
    """
    Detect reversal signal và queue advisory loại REVERSAL cho các user đang theo dõi symbol.
    Chạy định kỳ qua Celery Beat, có lock để tránh queue trùng.
    """
    if not getattr(settings, 'REVERSAL_DETECTION_ENABLED', True):
        return {'status': 'disabled'}

    if symbol:
        symbols = [str(symbol).strip().upper()]
    else:
        tracked = list(TrackedSymbol.objects.values_list('symbol', flat=True).distinct())
        watchlisted = list(WatchlistItem.objects.values_list('symbol', flat=True).distinct())
        symbols = sorted({str(s).strip().upper() for s in tracked + watchlisted if s})[:ORDER_FLOW_MAX_SYMBOLS]

    queued = 0
    processed = 0
    skipped_locked = 0

    for sym in symbols:
        lock_key = f'reversal_alert_lock:{sym}'
        lock_seconds = max(int(os.getenv('REVERSAL_COOLDOWN_SECONDS', '300')), 60)
        if not cache.add(lock_key, timezone.now().isoformat(), timeout=lock_seconds):
            skipped_locked += 1
            continue

        signal = _detect_reversal_signal(sym)
        if not signal:
            continue

        processed += 1
        tracked_user_ids = list(
            TrackedSymbol.objects.filter(symbol=sym).values_list('user_id', flat=True).distinct()
        )
        if not tracked_user_ids:
            continue

        for user_id in tracked_user_ids:
            user_cfg = UserConfig.objects.filter(user_id=user_id).first()
            if user_cfg is None:
                continue
            if not bool(user_cfg.advisory_whale_signal_enabled):
                continue

            threshold_vnd = float(user_cfg.whale_alert_threshold or 500) * 1_000_000
            generate_whale_advisory_task.apply_async(
                kwargs={
                    'symbol': sym,
                    'matched_value_vnd': signal['sell_value_vnd'],
                    'side': 'SELL',
                    'threshold': threshold_vnd,
                    'force_refresh': True,
                    'user_id': user_id,
                    'source': WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
                    'advisory_type': WhaleAdvisory.AdvisoryTypeChoices.REVERSAL,
                    'severity_override': WhaleAdvisory.SeverityChoices.URGENT,
                },
                countdown=1,
            )
            queued += 1

    return {
        'status': 'ok',
        'symbols': len(symbols),
        'processed': processed,
        'queued': queued,
        'skipped_locked': skipped_locked,
    }


# ---------------------------------------------------------------------------
# Slice C: Trial / Grace Transitions (Daily Scheduler)
# ---------------------------------------------------------------------------
@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def process_plan_lifecycle_transitions(self) -> dict:
    """
    Chạy mỗi ngày qua Celery Beat để transition trial -> grace -> expired.
    - Nếu trial kết thúc và chưa có grace, tạo grace period.
    - Nếu grace kết thúc, downgrade về free.
    """
    from portfolio.models import UserPlanLifecycle
    
    now = timezone.now()
    transitions = {'trial_to_grace': 0, 'grace_expired': 0, 'errors': 0}
    
    try:
        expired_trials = UserPlanLifecycle.objects.filter(
            trial_ends_at__lte=now,
            grace_ends_at__isnull=True,
        )
        
        for lifecycle in expired_trials:
            try:
                grace_deadline = lifecycle.trial_ends_at + timezone.timedelta(days=7)
                lifecycle.grace_ends_at = grace_deadline
                lifecycle.save(update_fields=['grace_ends_at', 'updated_at'])
                transitions['trial_to_grace'] += 1
                logger.info('Transition trial->grace: user=%s, grace_ends=%s', lifecycle.user.id, grace_deadline)
            except Exception as exc:
                logger.error('Error transitioning trial for user=%s: %s', lifecycle.user.id, exc)
                transitions['errors'] += 1
        
        expired_graces = UserPlanLifecycle.objects.filter(
            grace_ends_at__lte=now,
        )
        
        for lifecycle in expired_graces:
            try:
                user_cfg = UserConfig.objects.get(user=lifecycle.user)
                if user_cfg.plan != 'free':
                    user_cfg.plan = 'free'
                    user_cfg.save(update_fields=['plan', 'updated_at'])
                    logger.info(
                        'Downgrade after grace: user=%s, from_plan=%s, to=free',
                        lifecycle.user.id, user_cfg.plan,
                    )
                transitions['grace_expired'] += 1
            except Exception as exc:
                logger.error('Error expiring grace for user=%s: %s', lifecycle.user.id, exc)
                transitions['errors'] += 1
    except Exception as exc:
        logger.error('process_plan_lifecycle_transitions general error: %s', exc)
        transitions['errors'] += 1
    
    return {'status': 'ok', **transitions}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def process_expired_onboarding_trials_task(self, batch_size: int = 500) -> dict:
    """Downgrade expired onboarding trials to fallback plan in bounded batches."""
    result = process_expired_onboarding_trials(batch_size=batch_size)
    logger.info(
        'event=onboarding_trial_expiry_task_run processed=%s downgraded=%s skipped=%s fallback_plan=%s batch_size=%s',
        result.get('processed', 0),
        result.get('downgraded', 0),
        result.get('skipped', 0),
        result.get('fallback_plan', ''),
        batch_size,
    )
    return {'status': 'ok', **result}

