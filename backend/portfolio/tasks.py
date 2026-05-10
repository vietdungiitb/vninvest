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
from portfolio.adapters.vnbroker_adapter import fetch_price_board_dataframe
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
    offpeak_vnbroker_ingest,
    build_realtime_symbol_universe_snapshot,
    schedule_realtime_prefetch_shards,
    prefetch_realtime_ticker_shard,
    _resolve_prefetch_topology,
    _collect_realtime_symbol_universe,
    _resolve_scheduler_plan,
    _prefetch_runtime_defaults,
    _get_vnbroker_runtime_settings,
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
    _record_vnbroker_timeout,
    TICKER_PREFETCH_META_CACHE_KEY,
    VNBROKER_PRICE_BOARD_RATE_LIMIT_CACHE_KEY,
    VNBROKER_RUNTIME_SETTINGS_CACHE_KEY,
    PREFETCH_TIME_POLICY_CACHE_KEY,
    PREFETCH_METRIC_CACHE_PREFIX,
    VNBROKER_TIMEOUT_COUNTER_KEY,
)
from portfolio.tasks_order_flow import (
    detect_and_store_order_flow,
    distribute_order_flow_signal,
    detect_whale_reversal,
    ORDER_FLOW_COOLDOWN_SECONDS,
    ORDER_FLOW_MAX_SYMBOLS,
)
from portfolio.tasks_rollout import (
    activate_due_whale_config_rollouts,
    monitor_whale_config_anomalies,
    refresh_whale_config_rollout_status,
    ack_whale_config_rollout,
)
from portfolio.tasks_lifecycle import (
    process_plan_lifecycle_transitions,
    process_expired_onboarding_trials_task,
)
from portfolio.tasks_news_digest import (
    _fetch_news_context_for_advisory,
    _generate_news_digest_for_user,
    generate_all_portfolio_news_digests_task,
)
from portfolio.tasks_realtime import (
    _whale_thresholds_for_user,
    collect_and_publish_realtime,
)
from portfolio.tasks_watchlist_indicators import (
    compute_watchlist_indicators,
)
from portfolio.tasks_whale_service import (
    distribute_whale_alert_event,
    detect_and_store_global_whale_alerts,
)
from portfolio.tasks_sync import (
    sync_user_watch_assets,
    sync_all_watch_assets,
)
from portfolio.tasks_dnse import (
    sync_dnse_accounts_task,
    sync_all_dnse_balances_task,
    sync_dnse_balances_task,
    reconcile_all_dnse_transactions_task,
    reconcile_dnse_transactions_task,
)
from portfolio.tasks_symbol_engagement import warmup_symbol_intraday  # noqa: F401
from portfolio.tasks_maintenance import (
    run_stream_consumer_batch,
    cleanup_old_intraday_ticks,
    cleanup_old_signal_service_runs,
    trim_streams,
)
from portfolio.tasks_maintenance import run_vnbroker_price_board_benchmark  # noqa: F401
from portfolio.tasks_advisory_helpers import (
    _advisory_event_merge_cache_key,
    _safe_float,
    _normalize_symbol,
    _infer_dark_flow_direction,
    _compute_event_side_score,
    _resolve_side_by_dynamic_score,
    _accumulate_user_advisory_event,
    _normalize_advisory_source,
    _token_log_source_for_advisory_source,
    _estimate_advisory_confidence,
    _estimate_advisory_actionability,
    _advisory_audit_reason_for_source,
    _advisory_audit_actor_for_source,
    _persist_advisory_metrics_audit_log,
    _get_tokens_used_today,
    _build_advisory_aggregate_state_payload,
    _persist_advisory_aggregate_snapshot,
    _get_remaining_advisory_budget,
    _get_auto_generation_count_today,
    _get_remaining_auto_refreshes,
    _resolve_next_refresh_at,
    _resolve_advisory_threshold_vnd,
    _should_use_concise_advisory,
    _resolve_model_for_budget,
    _increment_daily_counter,
    _classify_provider_failure,
    _is_failover_eligible_failure,
    _mark_provider_ratelimit,
    _record_provider_attempt,
    _record_failover_event,
    _is_language_mismatch,
    _compute_advisory_severity,
    _compute_dark_flow_severity,
    _detect_reversal_signal,
)


# ─── Warmup Cache Task ───────────────────────────────────────────────────────
@shared_task(bind=True, name='portfolio.warmup_realtime_ticker_cache', max_retries=0, time_limit=300, soft_time_limit=290)
def warmup_realtime_ticker_cache(self):
    """
    Async wrapper for cache warmup task.
    
    Initializes realtime ticker cache by prefetching hot tier symbols.
    Can be triggered on-demand or on startup via Django AppConfig.
    """
    try:
        from .warmup_cache import run_warmup_cache
        run_warmup_cache()
    except Exception as exc:
        logger.exception('Warmup task failed: %s', exc)
        return {'status': 'failed', 'error': str(exc)}
    
    return {'status': 'completed'}




# SM-P5.6: Auto-create next month partition for portfolio_intradaytick.
@shared_task(name='portfolio.create_next_month_partition', bind=True, max_retries=1, default_retry_delay=3600)
def create_next_month_partition(self):
    """
    Creates the next month's partition for portfolio_intradaytick if it doesn't exist.
    Scheduled to run on the 20th of each month at 02:15 AM.
    """
    from datetime import date
    from django.db import connection
    import calendar

    today = date.today()
    # Calculate next month
    if today.month == 12:
        next_month = date(today.year + 1, 1, 1)
    else:
        next_month = date(today.year, today.month + 1, 1)

    # Month after next (partition end boundary)
    if next_month.month == 12:
        month_after = date(next_month.year + 1, 1, 1)
    else:
        month_after = date(next_month.year, next_month.month + 1, 1)

    partition_name = f"portfolio_intradaytick_y{next_month.year}m{next_month.month:02d}"
    start_str = next_month.strftime('%Y-%m-%d')
    end_str = month_after.strftime('%Y-%m-%d')

    check_sql = """
        SELECT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = %s
        );
    """
    create_sql = f"""
        CREATE TABLE {partition_name}
            PARTITION OF portfolio_intradaytick
            FOR VALUES FROM ('{start_str}') TO ('{end_str}');
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(check_sql, [partition_name])
            exists = cursor.fetchone()[0]
            if exists:
                return {'status': 'already_exists', 'partition': partition_name}
            cursor.execute(create_sql)
        return {'status': 'created', 'partition': partition_name, 'range': f'{start_str}..{end_str}'}
    except Exception as exc:
        logger.error('Failed to create partition %s: %s', partition_name, exc)
        raise self.retry(exc=exc)
