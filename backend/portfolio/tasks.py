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

# Re-export whale advisory generation functions for backward compatibility
from portfolio.tasks_whale_advisory import (
    generate_whale_advisory_task,
    auto_generate_advisories_for_all_tracked,
    flush_merged_advisory_event,
    ADVISORY_AUTO_GENERATION_JOB_LOCK_KEY,
    ADVISORY_EVENT_MERGE_CACHE_KEY_PREFIX,
)
from portfolio.tasks_prefetch import (
    prefetch_ticker_price_board,
    _prefetch_runtime_defaults,
    _get_prefetch_runtime_settings,
    _prefetch_time_policy_defaults,
    _coerce_prefetch_time_policy,
    _get_prefetch_time_policy,
    _parse_hhmm_to_minutes,
    _resolve_prefetch_time_profile,
    _resolve_effective_prefetch_settings,
    _distinct_symbols,
    _collect_prefetch_symbols,
    _store_prefetch_meta,
    _metric_cache_key,
    _increment_prefetch_metric,
    _is_rate_limited_error,
    _prefetch_retry_countdown,
    _prefetch_retry_countdown_with_policy,
    _mark_price_board_rate_limited,
    _record_vnstock_timeout,
    TICKER_PREFETCH_META_CACHE_KEY,
    VNSTOCK_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
    PREFETCH_RUNTIME_SETTINGS_CACHE_KEY,
    PREFETCH_TIME_POLICY_CACHE_KEY,
    PREFETCH_METRIC_CACHE_PREFIX,
    VNSTOCK_TIMEOUT_COUNTER_KEY,
)
from portfolio.tasks_order_flow import (
    detect_and_store_order_flow,
    detect_whale_reversal,
    ORDER_FLOW_COOLDOWN_SECONDS,
    ORDER_FLOW_MAX_SYMBOLS,
)


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

def _fetch_news_context_for_advisory(symbol: str, max_items: int = 4) -> str:
    """
    Sprint34 Layer 2: Đọc tin tức gần đây từ cache Redis hoặc vnstock.
    Trả về chuỗi rỗng nếu không có dữ liệu hoặc lỗi (graceful degradation).
    Không gọi vnstock trực tiếp nếu cache miss + đang trong cooldown.
    """
    import logging as _logging
    _log = _logging.getLogger(__name__)

    try:
        from django.core.cache import cache as _cache

        cache_key = f'stock:news:{symbol}'
        cached = _cache.get(cache_key)
        items = None

        if cached is None:
            # Cache miss: thử gọi vnstock với timeout ngắn
            try:
                from portfolio.adapters.vnstock_adapter import _build_stock_client, _run_with_timeout

                def _fetch():
                    stock_client = _build_stock_client(symbol=symbol, source='VCI')
                    return stock_client.company.news()

                raw = _run_with_timeout(_fetch, timeout=5)
                if raw is not None and not (hasattr(raw, 'empty') and raw.empty):
                    import pandas as _pd
                    rows = raw.to_dict(orient='records') if hasattr(raw, 'to_dict') else (raw if isinstance(raw, list) else [])
                    items_parsed = []
                    for row in rows[:max_items]:
                        title = str(row.get('title') or row.get('subject') or row.get('headline') or '').strip()
                        source_name = str(row.get('source') or row.get('publisher') or '').strip()
                        raw_date = row.get('published_date') or row.get('publishedDate') or row.get('date') or ''
                        try:
                            date_str = str(_pd.Timestamp(raw_date).date()) if raw_date else ''
                        except Exception:
                            date_str = str(raw_date)[:10] if raw_date else ''
                        if title:
                            items_parsed.append({'title': title, 'source': source_name, 'date': date_str})
                    items = items_parsed
            except Exception as exc:
                _log.debug('_fetch_news_context_for_advisory: vnstock error for %s: %s', symbol, exc)
                items = []
        else:
            raw_items = cached.get('items', []) if isinstance(cached, dict) else []
            items = [
                {'title': str(r.get('title') or '').strip(), 'source': str(r.get('source') or '').strip(), 'date': str(r.get('published_at') or '')[:10]}
                for r in raw_items if str(r.get('title') or '').strip()
            ]

        if not items:
            return ''

        lines = [f'Tin tức gần đây về {symbol}:']
        for item in items[:max_items]:
            meta = ''
            if item.get('source') and item.get('date'):
                meta = f" ({item['source']}, {item['date']})"
            elif item.get('source'):
                meta = f" ({item['source']})"
            elif item.get('date'):
                meta = f" ({item['date']})"
            lines.append(f"- {item['title']}{meta}")
        return '\n'.join(lines)
    except Exception as exc:
        _log.debug('_fetch_news_context_for_advisory: unexpected error for %s: %s', symbol, exc)
        return ''


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


# ============================================================================
# Sprint35 Layer 3 — Portfolio Daily News Digest (Celery Beat 16:05 ICT)
# ============================================================================

def _generate_news_digest_for_user(user) -> dict:
    """
    Tạo bản tóm tắt tin tức danh mục cho một user.
    Đọc watchlist, fetch news từ cache/vnstock, gọi AI, lưu DB.
    Trả về dict status.
    """
    from portfolio.models import WatchlistItem, PortfolioNewsDigest
    from portfolio.ai_service import generate_portfolio_digest, _resolve_provider_api_key
    from portfolio.ai_options import get_advisory_provider_failover_chain, get_default_model
    from django.utils import timezone as _tz
    import logging as _logging
    _log = _logging.getLogger(__name__)

    today = _tz.localdate()  # ICT-aware thanks to CELERY_TIMEZONE

    # Idempotency: bỏ qua nếu đã có digest hôm nay
    if PortfolioNewsDigest.objects.filter(user=user, date=today).exists():
        return {'skipped': True, 'reason': 'already_exists'}

    # Lấy danh sách symbols từ watchlist
    symbols = list(
        WatchlistItem.objects.filter(group__user=user)
        .values_list('symbol', flat=True)
        .distinct()
        .order_by('symbol')[:20]  # tối đa 20 mã
    )
    if not symbols:
        return {'skipped': True, 'reason': 'empty_watchlist'}

    # Fetch news context cho từng mã
    news_by_symbol: dict[str, str] = {}
    total_items = 0
    for sym in symbols:
        ctx = _fetch_news_context_for_advisory(sym, max_items=5)
        if ctx:
            news_by_symbol[sym] = ctx
            total_items += ctx.count('\n- ')

    if not news_by_symbol:
        return {'skipped': True, 'reason': 'no_news_available', 'symbols': symbols}

    # Resolve AI provider
    try:
        user_config = getattr(user, 'userconfig', None)
        provider_chain = get_advisory_provider_failover_chain(user_config)
        provider = provider_chain[0] if provider_chain else 'openclaw'
        model = get_default_model(provider)
        decrypted_key = str(getattr(user_config, 'decrypted_ai_key', '') or '') if user_config else ''
        api_key = _resolve_provider_api_key(provider, decrypted_key)
    except Exception as exc:
        _log.warning('sprint35: cannot resolve AI provider for user=%s: %s', user.id, exc)
        return {'error': str(exc), 'user_id': user.id}

    # Gọi AI
    try:
        result = generate_portfolio_digest(
            provider=provider,
            model=model,
            api_key=api_key,
            symbols=list(news_by_symbol.keys()),
            news_context_by_symbol=news_by_symbol,
            user=user_config,
        )
    except ValueError as exc:
        # No news → no AI call, already handled above; this is extra safety
        return {'skipped': True, 'reason': str(exc)}
    except Exception as exc:
        _log.warning('sprint35: AI digest generation failed for user=%s: %s', user.id, exc)
        return {'error': str(exc), 'user_id': user.id}

    # Lưu DB
    try:
        digest = PortfolioNewsDigest.objects.create(
            user=user,
            date=today,
            symbols=list(news_by_symbol.keys()),
            digest_summary=result.get('summary', ''),
            digest_full=result.get('full', ''),
            item_count=total_items,
            ai_model=model,
            prompt_tokens=result.get('prompt_tokens', 0),
            completion_tokens=result.get('completion_tokens', 0),
        )
    except Exception as exc:
        _log.error('sprint35: DB save failed for user=%s: %s', user.id, exc)
        return {'error': str(exc), 'user_id': user.id}

    # WebSocket push → user_{user_id}_alerts group
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'user_{user.id}_alerts',
                {
                    'type': 'news_digest',
                    'payload': {
                        'event_type': 'news_digest',
                        'digest_id': digest.id,
                        'date': str(today),
                        'symbols': digest.symbols,
                        'summary': digest.digest_summary,
                        'item_count': digest.item_count,
                        'created_at': digest.created_at.isoformat(),
                    },
                },
            )
    except Exception as exc:
        _log.warning('sprint35: WebSocket push failed for user=%s: %s', user.id, exc)

    return {
        'ok': True,
        'user_id': user.id,
        'digest_id': digest.id,
        'symbols': digest.symbols,
        'item_count': digest.item_count,
    }


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def generate_all_portfolio_news_digests_task(self, batch_size: int = 200) -> dict:
    """
    Sprint35 Layer 3: Celery Beat 16:05 ICT (Mon-Fri).
    Tạo Portfolio Daily News Digest cho tất cả user có watchlist.
    """
    from django.contrib.auth.models import User as _User
    from portfolio.models import WatchlistItem

    logger.info('event=sprint35_digest_start')
    results = {'ok': 0, 'skipped': 0, 'error': 0}

    # Lấy user_ids có ít nhất 1 watchlist item
    user_ids = list(
        WatchlistItem.objects.values_list('group__user_id', flat=True)
        .distinct()[:batch_size]
    )

    for uid in user_ids:
        try:
            user = _User.objects.select_related('userconfig').get(pk=uid)
            result = _generate_news_digest_for_user(user)
            if result.get('ok'):
                results['ok'] += 1
            elif result.get('skipped'):
                results['skipped'] += 1
            else:
                results['error'] += 1
        except Exception as exc:
            logger.warning('sprint35: digest failed for user_id=%s: %s', uid, exc)
            results['error'] += 1

    logger.info('event=sprint35_digest_done ok=%s skipped=%s error=%s', results['ok'], results['skipped'], results['error'])
    return {'status': 'ok', 'batch_size': batch_size, **results}

