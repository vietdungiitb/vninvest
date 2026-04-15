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
    build_realtime_symbol_universe_snapshot,
    schedule_realtime_prefetch_shards,
    prefetch_realtime_ticker_shard,
    _resolve_prefetch_topology,
    _collect_realtime_symbol_universe,
    _resolve_scheduler_plan,
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
from portfolio.tasks_sync import (
    sync_user_watch_assets,
    sync_all_watch_assets,
)
from portfolio.tasks_maintenance import (
    run_stream_consumer_batch,
    cleanup_old_intraday_ticks,
    trim_streams,
)
from portfolio.tasks_maintenance import run_vnstock_price_board_benchmark  # noqa: F401
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


