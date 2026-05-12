
# --- Stock Management Modular Views ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny

from .views_admin_sync import sync_market_groups_api, sync_stockprofile_api
from .views_stock_catalog import SecuritiesGroupListView, SecuritiesItemListView, StockProfileListView


from .runtime_policy_helpers import (
    HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY,
    PREFETCH_RUNTIME_SETTINGS_CACHE_KEY,
    PREFETCH_TIME_POLICY_CACHE_KEY,
    _coerce_governance_delta_thresholds,
    _coerce_prefetch_runtime_settings,
    _coerce_prefetch_time_policy,
    _default_governance_delta_thresholds,
    _default_prefetch_runtime_settings,
    _default_prefetch_time_policy,
    _get_runtime_governance_delta_thresholds,
    _get_runtime_prefetch_settings,
    _get_runtime_prefetch_time_policy,
    _prefetch_time_policy_rulebook,
    _set_runtime_governance_delta_thresholds,
    _set_runtime_prefetch_settings,
    _set_runtime_prefetch_time_policy,
)

"""
views.py — DRF API Views.

Endpoints:
  GET/POST   /api/portfolio/portfolios/
  GET/PUT/DELETE /api/portfolio/portfolios/{id}/
  GET/POST   /api/portfolio/portfolios/{id}/transactions/
  GET/PUT/DELETE /api/transactions/{id}/
  GET        /api/portfolio/portfolios/{id}/holdings/
  GET        /api/portfolio/portfolios/{id}/summary/
  GET        /api/portfolio/portfolios/{id}/chart/
  POST       /api/portfolio/portfolios/{id}/sync/
  GET/PUT    /api/portfolio/userconfig/ (UserConfig)
"""

from decimal import Decimal
from datetime import date, datetime, time, timedelta
import base64
import json
import re
import concurrent.futures as _cf
import logging
import os
import sys

logger = logging.getLogger(__name__)

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)


from django.db.models import Case, ExpressionWrapper, F, FloatField, IntegerField, Max, Min, Q, Sum, When
from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.models import User
import redis as redis_lib
from rest_framework.permissions import IsAuthenticated, IsAdminUser
# Core models (AUTHORITY)
try:
    from user_workspace.models import Portfolio, Watchlist, PriceAlert, WatchlistItem
except (ImportError, RuntimeError):
    # Models migrated to packages/core - stubs for dev environment
    class Portfolio:
        pass
    class Watchlist:
        pass
    class PriceAlert:
        pass
    class WatchlistItem:
        pass

# Legacy models (remaining)
from .models import Transaction, DailyPrice, IntradayTick, OrderFlowSignal, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, AdvisoryTokenLog, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, StockProfile, MarketGroupSyncLog, StockProfileSyncLog, WhaleAdvisory
from .serializers import (
    PortfolioSerializer, TransactionSerializer, UserConfigSerializer, SubAccountSerializer,
    HoldingSerializer, SummarySerializer, ChartPointSerializer,
    SecuritiesGroupCreateSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer,
    TrackedSymbolSerializer, WatchlistGroupSerializer, WatchlistItemSerializer, StockProfileSerializer,
    PriceAlertRuleSerializer, StockWorkspaceChartPointSerializer, StockWorkspaceChartResponseSerializer,
    StockWorkspaceGroupRefSerializer, StockWorkspaceOverviewSerializer,
    StockWorkspaceTechnicalSerializer, StockWorkspaceWatchlistMembershipSerializer,
    WhaleAdvisorySerializer, AIAdvisoryComponentRecordSerializer, AIAdvisoryExecutiveSummarySerializer,
    StockAIChartContextSerializer,
)

from .services import (
    fetch_and_save_daily_prices, sync_portfolio_prices, get_latest_price,
    get_price_changes, get_price_series, sync_market_groups, sync_market_groups_for_user, sync_stock_profiles, sync_watchlist_prices,
)
from .permissions import IsProPlan, _get_plan, resolve_user_entitlements
from .quota_service import build_quota_exceeded_payload, consume_quota
from .opencore_dpi import check_feature_access
from .opencore_analytics import track_api_call
from .whale_scoring import calculate_display_score, calculate_event_score, resolve_whale_score_config
from .adapters.vnbroker_adapter import (
    fetch_financial_ratio_dataframe,
    fetch_history_dataframe,
    fetch_intraday_dataframe,
    fetch_listing_symbols_dataframe,
    fetch_price_board_dataframe,
)
from .exceptions import ExternalSystemException, MarketDataValidationException
from .market_data_service import market_data_service
from .tasks import generate_whale_advisory_task
from .ai_advisory_helpers import (
    _sprint17_build_component_templates,
    _sprint17_compute_summary_from_components,
    _sprint17_enforce_summary_narrative_policy,
    _sprint17_generate_component_templates_with_ai,
    _sprint17_generate_executive_synthesis_with_ai,
    _sprint17_serialize_stock_advisory_session,
)
from portfolio.order_flow import compute_cvd_series, detect_dark_flow
from .stock_workspace_helpers import _build_stock_workspace_overview, _compute_stock_workspace_technical
from .views_portfolio_watchlist import (
    AllocationView,
    ChartDataView,
    EquityCurveView,
    HoldingsView,
    PortfolioAnalyticsView,
    PortfolioDetailView,
    PortfolioListCreateView,
    SubAccountDetailView,
    SubAccountListCreateView,
    SummaryView,
    SyncPricesView,
    TransactionDetailView,
    TransactionListCreateView,
    UserConfigView,
    WatchlistGroupDetailView,
    WatchlistGroupListCreateView,
    WatchlistItemCreateView,
    WatchlistItemDeleteView,
    WatchlistSeedView,
    WatchlistSyncView,
    _acquire_sync_cooldown,
)
from .views_stock_management import (
    PriceAlertRuleDetailView,
    PriceAlertRuleListCreateView,
    PriceAlertRuleTriggerView,
    SecuritiesGroupDetailView,
    SecuritiesGroupListCreateView,
    SecuritiesItemCreateView,
    SecuritiesItemDeleteView,
    SecuritiesSeedView,
    SecuritiesSyncView,
    TrackedSymbolBulkThresholdView,
    TrackedSymbolDeleteView,
    TrackedSymbolListCreateView,
    _parse_tracked_symbol_threshold_million,
)
from .views_screener import (
    ScreenerRuleDetailView,
    ScreenerRuleListCreateView,
    ScreenerRuleRunView,
)
from .views_stock_workspace_admin import (
    AdminOpsStatsView,
    StockProfileDetailView,
    StockWorkspaceChartView,
    StockWorkspaceOverviewView,
)
from .views_realtime_symbol import (
    symbol_investigation_api,
    whale_symbol_summary_api,
)
from .views_dashboard_risk import dashboard_aggregated_risk_api
from .views_ai_advisory_trace import (
    _build_advisory_trace_payload_for_user,
    stock_ai_advisory_observability_api,
    stock_ai_advisory_trace_api,
    stock_ai_advisory_trace_export_api,
    stock_ai_advisory_trace_list_api,
)
from .views_ai_advisory_components_summary import (
    _build_component_generation_key,
    _estimate_component_generation_actionability,
    _estimate_component_generation_confidence,
    _persist_component_generation_metrics_audit_log,
    stock_ai_advisory_component_clear_deleted_api,
    stock_ai_advisory_component_delete_api,
    stock_ai_advisory_component_refresh_api,
    stock_ai_advisory_component_restore_api,
    stock_ai_advisory_component_toggle_include_api,
    stock_ai_advisory_components_generate_api,
    stock_ai_advisory_summary_delete_api,
    stock_ai_advisory_summary_regenerate_api,
)
from .views_ai_advisory_management import (
    WhaleAdvisoryListView,
    _build_advisory_canonical_payload,
    _extract_confidence_from_summary,
    _is_celery_worker_available,
    _submit_advisory_generation_with_fallback,
    ai_advisory_canonical_symbol_api,
    delete_current_whale_advisory_api,
    refresh_whale_advisory_api,
    whale_advisory_manual_refresh_status_api,
    whale_advisory_auto_refresh_info_api,
)
from .views_ai_advisory_session import (
    _build_session_v2_aggregate_quality_metrics,
    _build_session_v2_benchmark_enrichment,
    _build_session_v2_decision_digest,
    _build_session_v2_observability,
    _get_holistic_advisory_v1_gate_status,
    _is_holistic_advisory_v1_enabled_for_user,
    _log_holistic_rollout_gate_deny,
    stock_ai_advisory_session_api,
)
from .views_admin_runtime import (
    admin_intraday_side_backfill_apply_api,
    admin_intraday_side_backfill_preview_api,
    admin_intraday_side_backfill_status_api,
    admin_intraday_universe_warm_now_api,
    admin_runtime_kpi_advisory_merge_api,
    admin_runtime_kpi_advisory_metrics_api,
    admin_runtime_kpi_api,
    admin_runtime_kpi_whale_preflight_metrics_api,
    admin_runtime_kpi_whale_pipeline_api,
    operator_health_api,
    operator_ai_runtime_api,
    operator_audit_request_detail_api,
    operator_audit_requests_api,
    operator_jobs_api,
    operator_tenant_activate_api,
    operator_tenant_change_plan_api,
    operator_tenant_detail_api,
    operator_tenant_pats_api,
    operator_tenant_service_accounts_api,
    operator_tenant_suspend_api,
    operator_tenants_api,
    operator_overview_api,
    admin_system_ai_audit_logs_api,
    admin_system_ai_settings_api,
    admin_system_ai_test_connection_api,
    admin_vnbroker_runtime_config_changelog_api,
    admin_vnbroker_runtime_config_current_api,
    admin_vnbroker_runtime_config_reset_api,
    admin_vnbroker_runtime_config_update_api,
    offpeak_vnbroker_ingest_api,
    offpeak_vnbroker_ingest_history_api,
    warm_ticker_prefetch_api,
)
from .views_admin_vnbroker_benchmark import (
    admin_vnbroker_price_board_benchmark_latest_api,
    admin_vnbroker_price_board_benchmark_run_api,
)
from .views_signal_admin import (
    signal_admin_config_api,
    signal_admin_config_preview_api,
    signal_admin_whale_governance_bridge_apply_api,
    signal_admin_whale_governance_bridge_preview_api,
    signal_admin_job_retry_api,
    signal_admin_jobs_api,
    signal_admin_jobs_run_api,
    signal_admin_money_flow_materialization_preview_api,
    signal_admin_money_flow_materialization_run_api,
    signal_admin_recent_events_api,
    signal_admin_retention_preview_api,
    signal_admin_summary_api,
    signal_admin_universe_apply_api,
    signal_admin_universe_preview_api,
)
from .views_ai_runtime_stats import (
    _get_ai_runtime_config_status,
    ai_config_api,
    ai_command_center_audit_logs_api,
    ai_options_api,
    ai_test_connection_api,
)
from .views_stock_order_flow import (
    _enforce_opencore_feature_for_stock_endpoint,
    _enforce_opencore_quota_for_stock_endpoint,
    _track_opencore_stock_endpoint_usage,
    stock_order_flow_api,
    whale_advisory_symbol_stats_api,
)
from .views_dark_money_history import (
    dark_money_history_api,
)
from .views_stock_news import (
    portfolio_news_digest_api,
    stock_news_ai_summary_api,
    stock_news_api,
)
from .whale_feed_helpers import (
    _build_aggregate_event_payload,
    _build_aggregate_event_payload_from_record,
    _build_stream_aggregate_records,
    _build_vnbroker_aggregate_records,
    _build_whale_order_payload,
    _cache_get,
    _cache_set,
    _dataframe_has_threshold_hits,
    _decode_whale_feed_cursor,
    _encode_whale_feed_cursor,
    _get_user_symbol_threshold_overrides_vnd,
    _get_user_whale_threshold_vnd,
    _is_event_timestamp_in_window,
    _is_tick_row_in_window,
    _is_vnbroker_rate_limited,
    _mark_vnbroker_rate_limited,
    _normalize_aggregate_event_records,
    _parse_aggregate_window,
    _parse_cursor_datetime,
    _parse_cursor_matched_value,
    _resolve_whale_feed_symbols,
)

from .views_analytics_extended import PortfolioTechnicalView, BulkTechnicalBySymbolsView


# ── PR-3/4/5: Sentiment, Notifications, Backtest ────────────────────────────
from .views_sentiment import sentiment_detail_api
from .views_notifications import (
    telegram_generate_link,
    telegram_unlink,
    telegram_webhook,
    telegram_status,
    telegram_settings_update,
    preferred_symbols_list,
    preferred_symbols_delete,
)
from .views_backtest import backtest_stats_api


# ── PR-3: first-create threshold resolution helper ─────────────────────────────
def _resolve_first_create_threshold_vnd(user, symbol: str, user_default_threshold_vnd: int):
    """
    Resolve the effective first-create threshold (in VND) for a given user/symbol.

    Resolution order:
      1. If a TrackedSymbol row exists for this user+symbol AND has
         whale_alert_threshold_million set → return (override, 'symbol_override')
      2. Otherwise → return (user_default, 'user_default')

    Returns:
        (threshold_vnd: int, source: str)
    """
    from .models import TrackedSymbol
    ts = TrackedSymbol.objects.filter(user=user, symbol=symbol.upper()).first()
    if ts is not None and ts.whale_alert_threshold_million is not None:
        return int(ts.whale_alert_threshold_million * 1_000_000), 'symbol_override'
    return user_default_threshold_vnd, 'user_default'

