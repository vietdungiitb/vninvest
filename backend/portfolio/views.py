
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

logger = logging.getLogger(__name__)


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
from .models import Portfolio, Transaction, DailyPrice, IntradayTick, OrderFlowSignal, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, AdvisoryTokenLog, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, StockProfile, PriceAlertRule, MarketGroupSyncLog, StockProfileSyncLog, WhaleAdvisory
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
from .adapters.vnstock_adapter import (
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
from .views_realtime_core import (
    IntradayMatchedView,
    PriceBoardView,
    RealtimeTickerView,
    SectorBreadthView,
)
from .views_realtime_advanced import (
    RVOLView,
    WhaleFeedView,
)
from .views_realtime_aggregate_campaigns import (
    WhaleCampaignsView,
    WhaleFeedAggregateView,
)
from .views_realtime_depth_financial import (
    DepthChartView,
    FinancialMetricsView,
)
from .views_realtime_symbol_investigation import symbol_investigation_api
from .views_realtime_whale_symbol_summary import whale_symbol_summary_api
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
    admin_runtime_kpi_advisory_merge_api,
    admin_runtime_kpi_advisory_metrics_api,
    admin_runtime_kpi_api,
    admin_runtime_kpi_whale_pipeline_api,
    admin_system_ai_audit_logs_api,
    admin_system_ai_settings_api,
    admin_system_ai_test_connection_api,
    admin_vnstock_runtime_config_changelog_api,
    admin_vnstock_runtime_config_current_api,
    admin_vnstock_runtime_config_reset_api,
    admin_vnstock_runtime_config_update_api,
    warm_ticker_prefetch_api,
)
from .views_ai_runtime_stats import (
    _get_ai_runtime_config_status,
    ai_config_api,
    ai_options_api,
    ai_test_connection_api,
)
from .views_stock_order_flow import (
    _OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS,
    _OPENCORE_STOCK_FEATURE_KEYS,
    _enforce_opencore_feature_for_stock_endpoint,
    _enforce_opencore_quota_for_stock_endpoint,
    _resolve_first_create_threshold_vnd,
    _timeframe_to_minutes,
    _track_opencore_stock_endpoint_usage,
    stock_order_flow_api,
    whale_advisory_symbol_stats_api,
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
    _build_vnstock_aggregate_records,
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
    _is_vnstock_rate_limited,
    _mark_vnstock_rate_limited,
    _normalize_aggregate_event_records,
    _parse_aggregate_window,
    _parse_cursor_datetime,
    _parse_cursor_matched_value,
    _resolve_user_whale_threshold_vnd,
    _resolve_whale_feed_symbols,
)


