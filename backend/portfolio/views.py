
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

# Đồng bộ StockProfile từ vnstock (gọi management command hoặc service)
from django.http import JsonResponse
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_stockprofile_api(request):
    result = sync_stock_profiles(requested_by=request.user, mode=request.query_params.get('mode', 'all'))
    return JsonResponse(
        {
            'success': result['success'],
            'message': result['message'],
            'warning': result.get('warning'),
            'source': result.get('source'),
            'total_symbols': result.get('total_symbols', 0),
            'created_symbols': result.get('created_symbols', 0),
            'updated_symbols': result.get('updated_symbols', 0),
            'error': result.get('error', ''),
        },
        status=200 if result['success'] else 500,
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def symbol_investigation_api(request, symbol: str):
    """
    GET /api/realtime/symbol-investigation/<symbol>/

    Get co-observation of whale campaigns + dark money flows for a symbol.
    """
    try:
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response(
                {'detail': 'Thiếu mã chứng khoán.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        window = request.query_params.get('window', 'session')
        if window not in ['5m', '15m', '1h', 'session', '5d']:
            return Response(
                {'detail': 'Window không hợp lệ. Sử dụng: 5m, 15m, 1h, session, 5d'},
                status=status.HTTP_400_BAD_REQUEST
            )

        include_whale_raw = request.query_params.get('include_whale', request.query_params.get('include_campaigns', 'true'))
        include_dark_flow_raw = request.query_params.get('include_dark_flow', request.query_params.get('include_signals', 'true'))
        include_whale = str(include_whale_raw).lower() == 'true'
        include_dark_flow = str(include_dark_flow_raw).lower() == 'true'
        sort = request.query_params.get('sort', 'created_at')
        if sort not in ['created_at', 'correlation_strength']:
            return Response(
                {'detail': 'Sort không hợp lệ. Sử dụng: created_at, correlation_strength'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .coobservation_service import CoObservationService
        service = CoObservationService()
        result = service.get_symbol_investigation(
            symbol=normalized_symbol,
            window=window,
            include_whale=include_whale,
            include_dark_flow=include_dark_flow,
            sort=sort,
            user=request.user,
            query_params=request.query_params,
        )
        return Response(result)
    except Exception:
        logger.exception(f'symbol_investigation_api error for {symbol}')
        return Response(
            {'detail': 'Lỗi khi lấy thông tin co-observation.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def sync_market_groups_api(request):
    """
    POST /api/admin-ops/market-groups/sync/
    Trigger đồng bộ nhóm thị trườ ng (sectors, market caps) toàn hệ thống.
    Yêu cầu is_staff.
    """
    mode = request.query_params.get('mode', 'all')
    clear_existing = request.query_params.get('clear', 'false').lower() == 'true'

    result = sync_market_groups(
        requested_by=request.user,
        mode=mode,
        clear_existing=clear_existing,
        scope=MarketGroupSyncLog.ScopeChoices.GLOBAL,
    )

    if result.get('warning') and result.get('success'):
        resp_status = status.HTTP_207_MULTI_STATUS
    elif result.get('success'):
        resp_status = status.HTTP_200_OK
    else:
        resp_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    return Response(
        {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'warning': result.get('warning'),
            'source': result.get('source'),
            'created_groups': result.get('created_groups_count', 0),
            'updated_groups': result.get('updated_groups_count', 0),
            'added_symbols': result.get('added_symbols_count', 0),
            'error': result.get('error', ''),
        },
        status=resp_status,
    )


HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY = 'admin_ops:holistic_governance_delta_thresholds'
PREFETCH_RUNTIME_SETTINGS_CACHE_KEY = 'admin_ops:prefetch_runtime_settings'
PREFETCH_TIME_POLICY_CACHE_KEY = 'admin_ops:prefetch_time_policy'


def _default_governance_delta_thresholds():
    warning = max(0.0, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD', 2.0) or 2.0))
    critical = max(warning, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD', 4.0) or 4.0))
    cooldown = max(0.0, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD', 2.0) or 2.0))
    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }


def _coerce_governance_delta_thresholds(raw_payload, fallback=None):
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_governance_delta_thresholds()

    try:
        warning = float(payload.get('warning', base['warning']))
        critical = float(payload.get('critical', base['critical']))
        cooldown = float(payload.get('cooldown', base['cooldown']))
    except (TypeError, ValueError):
        raise ValueError('governance_delta_thresholds phải là số hợp lệ.')

    if warning < 0 or critical < 0 or cooldown < 0:
        raise ValueError('governance_delta_thresholds không được âm.')
    if critical < warning:
        raise ValueError('critical phải lớn hơn hoặc bằng warning.')

    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }


def _get_runtime_governance_delta_thresholds():
    from django.core.cache import cache

    default_thresholds = _default_governance_delta_thresholds()
    cached = cache.get(HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_thresholds
    try:
        return _coerce_governance_delta_thresholds(cached, fallback=default_thresholds)
    except ValueError:
        return default_thresholds


def _set_runtime_governance_delta_thresholds(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_governance_delta_thresholds(raw_payload, fallback=_default_governance_delta_thresholds())
    cache.set(HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY, normalized, timeout=None)
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD', normalized['warning'])
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD', normalized['critical'])
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD', normalized['cooldown'])
    return normalized


def _default_prefetch_runtime_settings():
    def _int_env(name, default, minimum):
        try:
            value = int(os.getenv(name, str(default)))
        except (TypeError, ValueError):
            value = int(default)
        return max(value, minimum)

    retry_base = _int_env('TICKER_PREFETCH_RETRY_BASE_SECONDS', 8, 1)
    return {
        'batch_size': _int_env('TICKER_PREFETCH_BATCH_SIZE', 60, 1),
        'symbol_limit': _int_env('TICKER_PREFETCH_SYMBOL_LIMIT', 240, 0),
        'max_retries': _int_env('TICKER_PREFETCH_MAX_RETRIES', 6, 0),
        'retry_base_seconds': retry_base,
        'retry_max_seconds': max(_int_env('TICKER_PREFETCH_RETRY_MAX_SECONDS', 120, 1), retry_base),
        'rate_limit_cooldown_seconds': _int_env('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', 20, 5),
        'circuit_window_seconds': _int_env('VNSTOCK_CIRCUIT_WINDOW_SECONDS', 300, 30),
        'circuit_breaker_timeout_threshold': _int_env('VNSTOCK_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', 3, 1),
        'circuit_breaker_cooldown_seconds': _int_env('VNSTOCK_CIRCUIT_BREAKER_COOLDOWN_SECONDS', 1800, 60),
        'include_group_symbols': os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true',
    }


def _coerce_prefetch_runtime_settings(raw_payload, fallback=None):
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_prefetch_runtime_settings()

    int_fields = {
        'batch_size': 1,
        'symbol_limit': 0,
        'max_retries': 0,
        'retry_base_seconds': 1,
        'retry_max_seconds': 1,
        'rate_limit_cooldown_seconds': 5,
        'circuit_window_seconds': 30,
        'circuit_breaker_timeout_threshold': 1,
        'circuit_breaker_cooldown_seconds': 60,
    }

    normalized = {}
    for field, minimum in int_fields.items():
        try:
            value = int(payload.get(field, base[field]))
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số nguyên hợp lệ.')
        normalized[field] = max(value, minimum)

    normalized['retry_max_seconds'] = max(normalized['retry_max_seconds'], normalized['retry_base_seconds'])
    normalized['include_group_symbols'] = bool(payload.get('include_group_symbols', base['include_group_symbols']))
    return normalized


def _get_runtime_prefetch_settings():
    from django.core.cache import cache

    default_settings = _default_prefetch_runtime_settings()
    cached = cache.get(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_settings
    try:
        return _coerce_prefetch_runtime_settings(cached, fallback=default_settings)
    except ValueError:
        return default_settings


def _set_runtime_prefetch_settings(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_prefetch_runtime_settings(raw_payload, fallback=_default_prefetch_runtime_settings())
    cache.set(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY, normalized, timeout=None)
    return normalized


def _default_prefetch_time_policy():
    return {
        'timezone': 'Asia/Ho_Chi_Minh',
        'market': {
            'open_time': '09:00',
            'close_time': '15:00',
            'pre_open_minutes': 30,
            'post_close_minutes': 30,
            'lunch_break': {
                'enabled': True,
                'start': '11:30',
                'end': '13:00',
            },
            'weekend_mode': 'offhours',
        },
        'profiles': {
            'pre_open': {
                'query_enabled': True,
                'interval_seconds': 90,
                'batch_size': 10,
                'symbol_limit': 20,
                'max_retries': 2,
            },
            'market_open': {
                'query_enabled': True,
                'interval_seconds': 35,
                'batch_size': 20,
                'symbol_limit': 40,
                'max_retries': 4,
            },
            'lunch_break': {
                'query_enabled': True,
                'interval_seconds': 180,
                'batch_size': 8,
                'symbol_limit': 20,
                'max_retries': 1,
            },
            'pre_close': {
                'query_enabled': True,
                'interval_seconds': 60,
                'batch_size': 12,
                'symbol_limit': 30,
                'max_retries': 2,
            },
            'post_close': {
                'query_enabled': True,
                'interval_seconds': 180,
                'batch_size': 8,
                'symbol_limit': 20,
                'max_retries': 1,
            },
            'offhours': {
                'query_enabled': False,
                'interval_seconds': 600,
                'batch_size': 5,
                'symbol_limit': 10,
                'max_retries': 0,
            },
        },
        'rate_limit_guard': {
            'jitter_percent': 15.0,
            'cooldown_multiplier_on_429': 2.0,
            'max_interval_seconds': 1800,
        },
    }


def _prefetch_time_policy_rulebook():
    return {
        'timezone_required': True,
        'time_format': 'HH:MM',
        'market': {
            'pre_open_minutes_min': 0,
            'post_close_minutes_min': 0,
            'weekend_mode_allowed': ['offhours'],
        },
        'profiles': {
            'required_profiles': ['pre_open', 'market_open', 'lunch_break', 'pre_close', 'post_close', 'offhours'],
            'interval_seconds_min': 5,
            'batch_size_min': 1,
            'symbol_limit_min': 0,
            'max_retries_min': 0,
        },
        'rate_limit_guard': {
            'jitter_percent_min': 0,
            'jitter_percent_max': 50,
            'cooldown_multiplier_on_429_min': 1,
            'max_interval_seconds_min': 60,
        },
    }


def _coerce_prefetch_time_policy(raw_payload, fallback=None):
    from datetime import datetime
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    def _to_int(value, field, minimum=0):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số nguyên hợp lệ.')
        if parsed < minimum:
            raise ValueError(f'{field} phải lớn hơn hoặc bằng {minimum}.')
        return parsed

    def _to_float(value, field):
        try:
            return float(value)
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số hợp lệ.')

    def _to_bool(value, field):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {'true', '1', 'yes', 'on'}:
                return True
            if lowered in {'false', '0', 'no', 'off'}:
                return False
        raise ValueError(f'{field} phải là boolean hợp lệ.')

    def _to_hhmm(value, field):
        candidate = str(value or '').strip()
        try:
            datetime.strptime(candidate, '%H:%M')
        except ValueError:
            raise ValueError(f'{field} phải theo định dạng HH:MM.')
        return candidate

    def _to_minutes(hhmm):
        hh, mm = hhmm.split(':')
        return int(hh) * 60 + int(mm)

    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_prefetch_time_policy()

    timezone_name = str(payload.get('timezone', base['timezone']) or '').strip()
    if not timezone_name:
        raise ValueError('prefetch_time_policy.timezone là bắt buộc.')
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        raise ValueError('prefetch_time_policy.timezone không hợp lệ.')

    market_payload = payload.get('market', {})
    if market_payload is None:
        market_payload = {}
    if not isinstance(market_payload, dict):
        raise ValueError('prefetch_time_policy.market phải là object hợp lệ.')

    market_base = base['market']
    open_time = _to_hhmm(market_payload.get('open_time', market_base['open_time']), 'prefetch_time_policy.market.open_time')
    close_time = _to_hhmm(market_payload.get('close_time', market_base['close_time']), 'prefetch_time_policy.market.close_time')
    if _to_minutes(open_time) >= _to_minutes(close_time):
        raise ValueError('prefetch_time_policy.market.open_time phải nhỏ hơn close_time.')

    pre_open_minutes = _to_int(
        market_payload.get('pre_open_minutes', market_base['pre_open_minutes']),
        'prefetch_time_policy.market.pre_open_minutes',
        minimum=0,
    )
    post_close_minutes = _to_int(
        market_payload.get('post_close_minutes', market_base['post_close_minutes']),
        'prefetch_time_policy.market.post_close_minutes',
        minimum=0,
    )

    lunch_payload = market_payload.get('lunch_break', {})
    if lunch_payload is None:
        lunch_payload = {}
    if not isinstance(lunch_payload, dict):
        raise ValueError('prefetch_time_policy.market.lunch_break phải là object hợp lệ.')

    lunch_base = market_base['lunch_break']
    lunch_enabled = _to_bool(
        lunch_payload.get('enabled', lunch_base['enabled']),
        'prefetch_time_policy.market.lunch_break.enabled',
    )
    lunch_start = _to_hhmm(
        lunch_payload.get('start', lunch_base['start']),
        'prefetch_time_policy.market.lunch_break.start',
    )
    lunch_end = _to_hhmm(
        lunch_payload.get('end', lunch_base['end']),
        'prefetch_time_policy.market.lunch_break.end',
    )
    if lunch_enabled and _to_minutes(lunch_start) >= _to_minutes(lunch_end):
        raise ValueError('prefetch_time_policy.market.lunch_break.start phải nhỏ hơn end.')

    weekend_mode = str(market_payload.get('weekend_mode', market_base.get('weekend_mode', 'offhours')) or '').strip().lower()
    if weekend_mode not in {'offhours'}:
        raise ValueError('prefetch_time_policy.market.weekend_mode không hợp lệ.')

    profiles_payload = payload.get('profiles', {})
    if profiles_payload is None:
        profiles_payload = {}
    if not isinstance(profiles_payload, dict):
        raise ValueError('prefetch_time_policy.profiles phải là object hợp lệ.')

    normalized_profiles = {}
    for profile_name, profile_base in base['profiles'].items():
        profile_payload = profiles_payload.get(profile_name, {})
        if profile_payload is None:
            profile_payload = {}
        if not isinstance(profile_payload, dict):
            raise ValueError(f'prefetch_time_policy.profiles.{profile_name} phải là object hợp lệ.')

        query_enabled = _to_bool(
            profile_payload.get('query_enabled', profile_base['query_enabled']),
            f'prefetch_time_policy.profiles.{profile_name}.query_enabled',
        )
        interval_seconds = _to_int(
            profile_payload.get('interval_seconds', profile_base['interval_seconds']),
            f'prefetch_time_policy.profiles.{profile_name}.interval_seconds',
            minimum=5,
        )
        batch_size = _to_int(
            profile_payload.get('batch_size', profile_base['batch_size']),
            f'prefetch_time_policy.profiles.{profile_name}.batch_size',
            minimum=1,
        )
        symbol_limit = _to_int(
            profile_payload.get('symbol_limit', profile_base['symbol_limit']),
            f'prefetch_time_policy.profiles.{profile_name}.symbol_limit',
            minimum=0,
        )
        max_retries = _to_int(
            profile_payload.get('max_retries', profile_base['max_retries']),
            f'prefetch_time_policy.profiles.{profile_name}.max_retries',
            minimum=0,
        )

        normalized_profiles[profile_name] = {
            'query_enabled': query_enabled,
            'interval_seconds': interval_seconds,
            'batch_size': batch_size,
            'symbol_limit': symbol_limit,
            'max_retries': max_retries,
        }

    guard_payload = payload.get('rate_limit_guard', {})
    if guard_payload is None:
        guard_payload = {}
    if not isinstance(guard_payload, dict):
        raise ValueError('prefetch_time_policy.rate_limit_guard phải là object hợp lệ.')
    guard_base = base['rate_limit_guard']

    jitter_percent = _to_float(
        guard_payload.get('jitter_percent', guard_base['jitter_percent']),
        'prefetch_time_policy.rate_limit_guard.jitter_percent',
    )
    if jitter_percent < 0 or jitter_percent > 50:
        raise ValueError('prefetch_time_policy.rate_limit_guard.jitter_percent phải trong khoảng [0, 50].')

    cooldown_multiplier_on_429 = _to_float(
        guard_payload.get('cooldown_multiplier_on_429', guard_base['cooldown_multiplier_on_429']),
        'prefetch_time_policy.rate_limit_guard.cooldown_multiplier_on_429',
    )
    if cooldown_multiplier_on_429 < 1:
        raise ValueError('prefetch_time_policy.rate_limit_guard.cooldown_multiplier_on_429 phải >= 1.')

    max_interval_seconds = _to_int(
        guard_payload.get('max_interval_seconds', guard_base['max_interval_seconds']),
        'prefetch_time_policy.rate_limit_guard.max_interval_seconds',
        minimum=60,
    )

    for profile_name, profile_payload in normalized_profiles.items():
        if profile_payload['interval_seconds'] > max_interval_seconds:
            raise ValueError(
                f'prefetch_time_policy.profiles.{profile_name}.interval_seconds không được lớn hơn '
                'prefetch_time_policy.rate_limit_guard.max_interval_seconds.'
            )

    return {
        'timezone': timezone_name,
        'market': {
            'open_time': open_time,
            'close_time': close_time,
            'pre_open_minutes': pre_open_minutes,
            'post_close_minutes': post_close_minutes,
            'lunch_break': {
                'enabled': lunch_enabled,
                'start': lunch_start,
                'end': lunch_end,
            },
            'weekend_mode': weekend_mode,
        },
        'profiles': normalized_profiles,
        'rate_limit_guard': {
            'jitter_percent': jitter_percent,
            'cooldown_multiplier_on_429': cooldown_multiplier_on_429,
            'max_interval_seconds': max_interval_seconds,
        },
    }


def _get_runtime_prefetch_time_policy():
    from django.core.cache import cache

    default_policy = _default_prefetch_time_policy()
    cached = cache.get(PREFETCH_TIME_POLICY_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_policy
    try:
        return _coerce_prefetch_time_policy(cached, fallback=default_policy)
    except ValueError:
        return default_policy


def _set_runtime_prefetch_time_policy(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_prefetch_time_policy(raw_payload, fallback=_default_prefetch_time_policy())
    cache.set(PREFETCH_TIME_POLICY_CACHE_KEY, normalized, timeout=None)
    return normalized


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
@permission_classes([IsAuthenticated])
def whale_symbol_summary_api(request, symbol: str):
    """
    GET /api/realtime/whale-symbol-summary/<symbol>/
    
    Get comprehensive whale event summary for a symbol including:
    - Latest campaign info
    - Today's buy/sell bias
    - Net value flow
    - Abnormality context
    - Baseline metrics
    """
    try:
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response(
                {'detail': 'Thiếu mã chứng khoán.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .baseline_service import BaselineService
        baseline_svc = BaselineService()
        summary = baseline_svc.get_whale_symbol_summary(normalized_symbol, window='session')
        
        return Response(summary)
    except Exception:
        logger.exception(f'whale_symbol_summary_api error for {symbol}')
        return Response(
            {'detail': 'Lỗi khi lấy thông tin tóm tắt whale.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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







