
# --- Stock Management Modular Views ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework import generics, filters as rest_framework_filters
from .models import StockProfile
from .serializers import StockProfileSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer

# StockProfile List API
class StockProfileListView(generics.ListAPIView):
    serializer_class = StockProfileSerializer
    permission_classes = [AllowAny]
    filter_backends = [rest_framework_filters.SearchFilter]
    search_fields = ['symbol', 'company_name']

    def get_queryset(self):
        qs = StockProfile.objects.filter(is_active=True)
        return qs

# StockProfile Detail đã có

from .views_admin_sync import sync_market_groups_api, sync_stockprofile_api


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


# SecuritiesGroup List API
class SecuritiesGroupListView(generics.ListAPIView):
    serializer_class = SecuritiesGroupDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SecuritiesGroup.objects.all()

# SecuritiesItem List API (liệt kê các mã trong group)
class SecuritiesItemListView(generics.ListAPIView):
    serializer_class = SecuritiesItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs['pk']
        return SecuritiesItem.objects.filter(group_id=group_id)
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
from .ai_advisory_helpers import (
    _sprint17_build_component_templates,
    _sprint17_compute_summary_from_components,
    _sprint17_enforce_summary_narrative_policy,
    _sprint17_generate_component_templates_with_ai,
    _sprint17_generate_executive_synthesis_with_ai,
    _sprint17_serialize_stock_advisory_session,
)
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
    _timeframe_to_minutes,
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


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_advisory_symbol_stats_api(request):
    """
    GET /api/portfolio/whale-advisory-symbol-stats/
    Thống kê BUY/SELL whale theo cùng nguồn IntradayTick như Whale Alerts,
    giúp đồng nhất số liệu hiển thị giữa Whale Alerts và Whale Advisory.
    """
    from django.db.models import ExpressionWrapper, F, FloatField, Sum

    symbols_param = str(request.query_params.get('symbols') or '').strip()
    window = str(request.query_params.get('window') or 'session').strip().lower() or 'session'

    if symbols_param:
        symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    else:
        symbols = list(
            TrackedSymbol.objects.filter(user=request.user).values_list('symbol', flat=True)
        )

    if not symbols:
        return Response(
            {
                'ok': True,
                'stats': [],
                'window': window,
                'source': 'intraday_tick_db',
            },
            status=status.HTTP_200_OK,
        )

    today_local = timezone.localdate()
    queryset = IntradayTick.objects.filter(symbol__in=symbols).annotate(
        matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
    )

    if window == '5d':
        queryset = queryset.filter(trade_date__gte=today_local - timedelta(days=4))
    else:
        queryset = queryset.filter(trade_date=today_local)

    stats_list = []
    for symbol in symbols:
        symbol_threshold_vnd, _ = _resolve_user_whale_threshold_vnd(request.user, symbol)
        symbol_ticks = queryset.filter(symbol=symbol, matched_value__gte=symbol_threshold_vnd)

        buy_count = symbol_ticks.filter(side__iexact='BUY').count()
        sell_count = symbol_ticks.filter(side__iexact='SELL').count()
        total_count = buy_count + sell_count
        if total_count <= 0:
            continue

        total_value = float(symbol_ticks.aggregate(total=Sum('matched_value')).get('total') or 0.0)
        total_volume = int(symbol_ticks.aggregate(total=Sum('volume')).get('total') or 0)
        avg_order_value = total_value / total_count

        stats_list.append(
            {
                'symbol': symbol,
                'buyCount': buy_count,
                'sellCount': sell_count,
                'totalValue': total_value,
                'totalVolume': total_volume,
                'count': total_count,
                'avgOrderValue': avg_order_value,
            }
        )

    stats_list.sort(key=lambda item: item['totalValue'], reverse=True)
    return Response(
        {
            'ok': True,
            'stats': stats_list,
            'window': window,
            'source': 'intraday_tick_db',
            'symbols_count': len(symbols),
            'stats_count': len(stats_list),
        },
        status=status.HTTP_200_OK,
    )


_OPENCORE_STOCK_FEATURE_KEYS = {
    'stock_order_flow_api': 'dark_pool_flow',
    'stock_ai_advisory_session_api': 'whale_momentum',
    'stock_ai_advisory_components_generate_api': 'sentiment_score',
    'stock_ai_advisory_component_refresh_api': 'sentiment_score',
    'stock_ai_advisory_summary_regenerate_api': 'sentiment_score',
    'stock_ai_advisory_component_toggle_include_api': 'sentiment_score',
    'stock_ai_advisory_component_delete_api': 'sentiment_score',
    'stock_ai_advisory_component_clear_deleted_api': 'sentiment_score',
    'stock_ai_advisory_component_restore_api': 'sentiment_score',
    'stock_ai_advisory_summary_delete_api': 'sentiment_score',
}

_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS = {
    'stock_order_flow_api': {
        'GET': 'api_calls_per_day',
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_session_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_components_generate_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_component_refresh_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_summary_regenerate_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_component_toggle_include_api': {
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_delete_api': {
        'DELETE': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_clear_deleted_api': {
        'DELETE': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_restore_api': {
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_summary_delete_api': {
        'DELETE': 'api_calls_per_day',
    },
}


def _enforce_opencore_feature_for_stock_endpoint(request, endpoint_name: str):
    """
    Sprint26 Day 2 feature gate for stock workspace endpoints.

    Transitional behavior:
    - Legacy users chưa có DPI license tạm thời được cho phép đi qua
      để tránh hard-break trước khi backfill license toàn hệ thống.
    """
    feature_key = _OPENCORE_STOCK_FEATURE_KEYS.get(endpoint_name)
    if not feature_key:
        return None

    try:
        request.user.dpi_license
    except Exception:
        return None

    can_access, reason = check_feature_access(request.user, feature_key)
    if can_access:
        return None

    _track_opencore_stock_endpoint_usage(
        request,
        endpoint_name,
        status.HTTP_403_FORBIDDEN,
    )

    return Response(
        {
            'ok': False,
            'code': 'feature_locked',
            'feature_key': feature_key,
            'message': 'Tinh nang nay yeu cau goi cao hon hoac license hop le.',
            'reason': reason,
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def _enforce_opencore_quota_for_stock_endpoint(request, endpoint_name: str):
    quota_key = (_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS.get(endpoint_name) or {}).get(request.method.upper())
    if not quota_key:
        return None

    entitlements = resolve_user_entitlements(request.user)
    quota_result = consume_quota(
        request.user,
        quota_key=quota_key,
        entitlements=entitlements,
    )
    if quota_result.get('allowed', True):
        return None

    _track_opencore_stock_endpoint_usage(
        request,
        endpoint_name,
        status.HTTP_429_TOO_MANY_REQUESTS,
    )

    quota_messages = {
        'api_calls_per_day': 'Ban da dung het quota API trong ngay.',
        'ai_regenerate_per_day': 'Ban da dung het quota refresh AI trong ngay.',
    }
    return Response(
        build_quota_exceeded_payload(
            quota_result,
            quota_messages.get(quota_key, 'Ban da dung het quota trong ngay.'),
        ),
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _track_opencore_stock_endpoint_usage(request, endpoint_name: str, response_status_code: int):
    feature_key = _OPENCORE_STOCK_FEATURE_KEYS.get(endpoint_name, '')
    try:
        track_api_call(
            user=request.user,
            endpoint=request.path,
            method=request.method,
            status_code=int(response_status_code),
            feature=feature_key,
            api_weight=1,
        )
    except Exception as exc:
        logger.debug('OpenCore stock endpoint usage tracking failed for %s: %s', endpoint_name, exc)


def _timeframe_to_minutes(timeframe: str) -> int:
    """
    F2 Helper: Convert timeframe string (30m, 1h, 4h, 1d) to minutes
    for detect_dark_flow window_minutes parameter.
    Defaults to 30 minutes if format unrecognized.
    """
    timeframe_lower = str(timeframe or '').strip().lower()
    
    if timeframe_lower.endswith('m'):
        try:
            return max(int(timeframe_lower.rstrip('m')), 1)
        except (ValueError, TypeError):
            return 30
    elif timeframe_lower.endswith('h'):
        try:
            hours = int(timeframe_lower.rstrip('h'))
            return max(hours * 60, 1)
        except (ValueError, TypeError):
            return 30
    elif timeframe_lower.endswith('d'):
        try:
            days = int(timeframe_lower.rstrip('d'))
            return max(days * 24 * 60, 1)
        except (ValueError, TypeError):
            return 30
    
    return 30  # Default: 30 minutes


def _resolve_first_create_threshold_vnd(user, symbol: str, user_default_threshold_vnd: float) -> tuple[float, str]:
    """
    F3 Helper: Resolve threshold for first advisory creation.
    Returns (threshold_vnd, threshold_source) tuple.
    
    Order of precedence:
    1. Symbol-specific override (TrackedSymbol.whale_alert_threshold_million)
    2. User default threshold (UserConfig.whale_alert_threshold)
    
    Returns tuple of (threshold_vnd, source) where source is 'symbol_override' or 'user_default'
    """
    from portfolio.models import TrackedSymbol
    
    try:
        tracked_symbol = TrackedSymbol.objects.get(user=user, symbol=symbol.upper())
        if tracked_symbol.whale_alert_threshold_million:
            resolved_threshold = float(tracked_symbol.whale_alert_threshold_million) * 1_000_000
            return (resolved_threshold, 'symbol_override')
    except TrackedSymbol.DoesNotExist:
        pass
    
    return (user_default_threshold_vnd, 'user_default')


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_order_flow_api(request, symbol: str):
    """
    GET /api/stock-management/stocks/<symbol>/order-flow/
    Tra summary order flow cho stock detail page.
    Query params:
      - window: 5m | 15m | 30m (default) | 1h — khung thời gian CVD và tick rate.
    """
    from portfolio.order_flow import compute_cvd_series, detect_dark_flow

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_order_flow_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_order_flow_api')
    if quota_response is not None:
        return quota_response

    _window_map = {'5m': 5, '15m': 15, '30m': 30, '1h': 60}
    window_param = str(request.query_params.get('window', '30m')).strip().lower()
    window_minutes = _window_map.get(window_param, 30)

    dark_flow = detect_dark_flow(normalized_symbol, window_minutes=window_minutes)
    cvd_series = compute_cvd_series(normalized_symbol, window_minutes=window_minutes, bucket_seconds=60)
    # Sprint 34 A2: Implement cursor-based pagination with has_more semantics
    import base64

    try:
        offset = int(request.query_params.get('offset', 0) or 0)
    except (TypeError, ValueError):
        offset = 0
    offset = max(0, min(offset, 10000))  # Prevent crazy values

    try:
        limit = int(request.query_params.get('limit', 8) or 8)
    except (TypeError, ValueError):
        limit = 8
    limit = max(1, min(limit, 50))  # 1-50 records per page
    cursor = str(request.query_params.get('cursor', '')).strip()
    
    # Parse cursor if provided (format: base64(timestamp:id))
    cursor_timestamp = None
    cursor_id = None
    if cursor:
        try:
            decoded = base64.b64decode(cursor).decode('utf-8')
            cursor_timestamp, cursor_id_raw = decoded.rsplit(':', 1)
            cursor_id = int(cursor_id_raw)
        except Exception:
            pass  # Invalid cursor, start from beginning
    
    # Query with pagination: order by -created_at, -id for deterministic tiebreaker
    queryset = OrderFlowSignal.objects.filter(symbol=normalized_symbol).order_by('-created_at', '-id')
    
    # Apply cursor offset if provided
    if cursor_timestamp and cursor_id is not None:
        from datetime import datetime
        from django.db.models import Q
        try:
            cursor_dt = datetime.fromisoformat(cursor_timestamp.replace('Z', '+00:00'))
            queryset = queryset.filter(
                Q(created_at__lt=cursor_dt) |
                Q(created_at=cursor_dt, id__lt=cursor_id)
            )
        except Exception:
            pass
    
    # Get total count before offset
    total_count = queryset.count()
    
    # Apply offset + fetch limit+1 to detect has_more
    signals_with_extra = list(queryset[offset:offset + limit + 1].values(
        'id', 'symbol', 'signal_type', 'strength', 'confidence', 'tick_rate',
        'small_order_ratio', 'cvd_at_signal', 'price_at_signal', 'created_at',
        'event_id', 'severity'
    ))
    
    has_more = len(signals_with_extra) > limit
    recent_signals = signals_with_extra[:limit]
    
    # Generate next_cursor if has_more
    next_cursor = None
    if has_more and recent_signals:
        last_signal = recent_signals[-1]
        cursor_payload = f"{last_signal['created_at'].isoformat()}:{last_signal['id']}"
        next_cursor = base64.b64encode(cursor_payload.encode('utf-8')).decode('utf-8')
    
    latest_signal = recent_signals[0] if recent_signals else None

    _track_opencore_stock_endpoint_usage(request, 'stock_order_flow_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'window': window_param,
            'window_minutes': window_minutes,
            'latest_signal': latest_signal,
            'signals': recent_signals,
            'cvd_series': cvd_series,
            'dark_flow': dark_flow,
            'tick_rate': (dark_flow.get('components') or {}).get('tick_rate') or {},
            'size_distribution': (dark_flow.get('components') or {}).get('size_distribution') or {},
            'pagination': {
                'offset': offset,
                'limit': limit,
                'total_count': total_count,
                'has_more': has_more,
                'next_cursor': next_cursor,
            }
        },
        status=status.HTTP_200_OK,
    )







