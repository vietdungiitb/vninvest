
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


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_api(request):
    """
    GET /api/admin-ops/runtime-kpi/
    Admin-only: runtime KPI snapshot cho trust-track S24-06..S24-10.
    Trả về observability market, prefetch health, celery alive status.
    """
    from time import time as _time
    from portfolio.observability import get_market_observability_snapshot
    from config.health import build_prefetch_health_snapshot

    celery_alive = False
    celery_active_queues: list = []
    try:
        from config.celery import app as celery_app
        inspect = celery_app.control.inspect(timeout=1.5)
        ping_result = inspect.ping()
        celery_alive = bool(ping_result)
        active_qs = inspect.active_queues() or {}
        celery_active_queues = list(active_qs.keys())
    except Exception:
        pass

    obs_snapshot = get_market_observability_snapshot()
    prefetch_snapshot = build_prefetch_health_snapshot()

    return Response(
        {
            'sampled_at': _time(),
            'market_observability': obs_snapshot,
            'prefetch_health': prefetch_snapshot,
            'celery': {
                'alive': celery_alive,
                'active_workers': celery_active_queues,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_advisory_merge_api(request):
    """
    GET /api/admin-ops/runtime-kpi/advisory-merge/
    Admin-only: trả về nhanh chỉ số merge pipeline của advisory event.
    """
    from time import time as _time
    from portfolio.observability import get_market_observability_snapshot

    snapshot = get_market_observability_snapshot()
    merge_stats = snapshot.get('advisory_event_merge') or {}
    return Response(
        {
            'sampled_at': _time(),
            'advisory_event_merge': {
                'scheduled': int(merge_stats.get('scheduled', 0)),
                'merged': int(merge_stats.get('merged', 0)),
                'flushed': int(merge_stats.get('flushed', 0)),
                'skipped': int(merge_stats.get('skipped', 0)),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def admin_system_ai_settings_api(request):
    """
    GET/PUT /api/admin-ops/system-ai-settings/
    Admin-only: quản trị System AI Settings cho fallback runtime.
    """
    from django.core.exceptions import ValidationError
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider
    from .models import SystemAISettings, SystemAISettingsAuditLog

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)

    def _serialize(obj):
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
            'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
        }

    def _snapshot(obj):
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
        }

    if request.method == 'GET':
        return Response({'ok': True, 'settings': _serialize(settings_obj)}, status=status.HTTP_200_OK)

    before_snapshot = _snapshot(settings_obj)

    provider = str(request.data.get('ai_provider') or settings_obj.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or '').strip()
    notes = str(request.data.get('notes') or settings_obj.notes or '').strip()
    allow_env_fallback = bool(request.data.get('allow_env_fallback', settings_obj.allow_env_fallback))
    is_active = bool(request.data.get('is_active', settings_obj.is_active))
    raw_key = request.data.get('ai_api_key', None)

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    effective_model = model or settings_obj.get_effective_ai_model()
    if effective_model and not is_valid_model(provider, effective_model):
        return Response({'ok': False, 'message': 'AI model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if effective_model and not is_model_allowed_for_capability(provider, effective_model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'AI model này chưa được hỗ trợ cho advisory runtime hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj.ai_provider = provider
    settings_obj.ai_model = model
    settings_obj.notes = notes
    settings_obj.allow_env_fallback = allow_env_fallback
    settings_obj.is_active = is_active
    if raw_key is not None:
        settings_obj.set_ai_api_key(str(raw_key or '').strip())

    try:
        settings_obj.full_clean()
        settings_obj.save()
    except ValidationError as exc:
        return Response({'ok': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    after_snapshot = _snapshot(settings_obj)
    if before_snapshot != after_snapshot:
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=request.user if request.user.is_authenticated else None,
            action='update_settings',
            reason='updated_via_admin_api',
            before_json=before_snapshot,
            after_json=after_snapshot,
        )

    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật System AI Settings.',
            'settings': _serialize(settings_obj),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_system_ai_test_connection_api(request):
    """
    POST /api/admin-ops/system-ai-settings/test-connection/
    Admin-only: kiểm tra kết nối theo System AI Settings hiện hành.
    """
    from .ai_runtime_config import resolve_ai_runtime_config
    from .ai_service import test_ai_connection
    from .models import SystemAISettings, SystemAISettingsAuditLog

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        return Response(
            {
                'ok': False,
                'message': 'Chưa có System AI Settings để test kết nối.',
                'reason': 'missing_system_ai_settings',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    runtime_cfg = resolve_ai_runtime_config(user=None, system_settings=settings_obj)
    if not runtime_cfg.get('ready'):
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=request.user if request.user.is_authenticated else None,
            action='test_connection_failed',
            reason=str(runtime_cfg.get('reason') or 'runtime_not_ready'),
            before_json={
                'provider': runtime_cfg.get('provider'),
                'model': runtime_cfg.get('model'),
            },
            after_json={'ready': False},
        )
        return Response(
            {
                'ok': False,
                'message': runtime_cfg.get('message') or 'System AI runtime chưa sẵn sàng.',
                'reason': runtime_cfg.get('reason') or 'runtime_not_ready',
                'provider': runtime_cfg.get('provider'),
                'model': runtime_cfg.get('model'),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = test_ai_connection(
        provider=str(runtime_cfg.get('provider') or ''),
        model=str(runtime_cfg.get('model') or ''),
        api_key=str(runtime_cfg.get('api_key') or ''),
    )
    SystemAISettingsAuditLog.objects.create(
        settings=settings_obj,
        actor=request.user if request.user.is_authenticated else None,
        action='test_connection_success' if payload.get('ok') else 'test_connection_failed',
        reason=str(payload.get('message') or ''),
        before_json={
            'provider': runtime_cfg.get('provider'),
            'model': runtime_cfg.get('model'),
        },
        after_json={
            'ok': bool(payload.get('ok')),
            'prompt_tokens': int(payload.get('prompt_tokens') or 0),
            'completion_tokens': int(payload.get('completion_tokens') or 0),
        },
    )
    status_code = status.HTTP_200_OK if payload.get('ok') else status.HTTP_400_BAD_REQUEST
    return Response(payload, status=status_code)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_system_ai_audit_logs_api(request):
    """
    GET /api/admin-ops/system-ai-settings/audit-logs/
    Admin-only: xem lịch sử thay đổi/test của System AI Settings.
    """
    from .models import SystemAISettingsAuditLog

    from django.utils.dateparse import parse_datetime

    limit = max(1, min(int(request.query_params.get('limit', 50)), 200))
    offset = max(0, int(request.query_params.get('offset', 0)))
    action = str(request.query_params.get('action') or '').strip().lower()
    actor_username = str(request.query_params.get('actor') or '').strip()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()
    order = str(request.query_params.get('order') or 'desc').strip().lower()
    if order not in {'asc', 'desc'}:
        return Response({'ok': False, 'message': 'order chỉ hỗ trợ asc hoặc desc.'}, status=status.HTTP_400_BAD_REQUEST)

    ordering = 'created_at' if order == 'asc' else '-created_at'
    logs_qs = SystemAISettingsAuditLog.objects.select_related('actor', 'settings').order_by(ordering)
    if action:
        logs_qs = logs_qs.filter(action=action)
    if actor_username:
        logs_qs = logs_qs.filter(actor__username__iexact=actor_username)

    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at không đúng định dạng ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
        logs_qs = logs_qs.filter(created_at__gte=start_at)

    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at không đúng định dạng ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
        logs_qs = logs_qs.filter(created_at__lte=end_at)

    total = logs_qs.count()
    logs = list(logs_qs[offset: offset + limit])

    payload = []
    for log in logs:
        payload.append(
            {
                'id': log.id,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'action': log.action,
                'reason': log.reason,
                'actor': log.actor.username if log.actor_id else None,
                'settings_id': log.settings_id,
                'before_json': log.before_json,
                'after_json': log.after_json,
            }
        )

    return Response(
        {
            'ok': True,
            'count': len(payload),
            'total': total,
            'offset': offset,
            'limit': limit,
            'order': order,
            'has_more': (offset + len(payload)) < total,
            'results': payload,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def warm_ticker_prefetch_api(request):
    """
    POST /api/admin-ops/prefetch/warm/
    Trigger warm cache ticker thủ công từ giao diện admin/dashboard.

    Query/body:
      - mode=async (mặc định): queue Celery task ngay lập tức.
      - mode=sync: chạy ngay trong request để debug/verify.
    """
    from config.health import build_prefetch_health_snapshot
    from portfolio.tasks import prefetch_ticker_price_board

    mode = str(request.query_params.get('mode') or request.data.get('mode') or 'async').strip().lower()

    if mode == 'sync':
        result = prefetch_ticker_price_board.run()
        snapshot = build_prefetch_health_snapshot()
        ok = result.get('status') == 'ok'
        return Response(
            {
                'queued': False,
                'mode': 'sync',
                'result': result,
                'prefetch': snapshot,
            },
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    task = prefetch_ticker_price_board.apply_async(countdown=0)
    return Response(
        {
            'queued': True,
            'mode': 'async',
            'task_id': task.id,
            'prefetch': build_prefetch_health_snapshot(),
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_options_api(request):
    """GET /api/ai-options/ - provider/model khả dụng cho frontend dropdown."""
    from .ai_options import ADVISORY_CAPABILITY, AVAILABLE_MODELS, MODEL_CATALOG, get_default_model, get_model_entries

    return Response(
        {
            'providers': AVAILABLE_MODELS,
            'defaults': {provider: get_default_model(provider) for provider in AVAILABLE_MODELS.keys()},
            'model_catalog': {
                provider: get_model_entries(provider)
                for provider in MODEL_CATALOG.keys()
            },
            'scope': ADVISORY_CAPABILITY,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_test_connection_api(request):
    """POST /api/ai-config/test-connection/ - kiểm tra provider/model/api key trước khi lưu."""
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider
    from .ai_service import _resolve_provider_api_key, test_ai_connection

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    provider = str(request.data.get('ai_provider') or user_cfg.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or user_cfg.ai_model or '').strip()
    api_key = str(request.data.get('ai_api_key') or '').strip() or user_cfg.get_ai_api_key()

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
    if not model:
        return Response({'ok': False, 'message': 'Bạn chưa chọn AI model.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_valid_model(provider, model):
        return Response({'ok': False, 'message': 'Model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_model_allowed_for_capability(provider, model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'Model này chưa được hỗ trợ cho AI advisory hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _resolve_provider_api_key(provider, api_key):
        return Response({'ok': False, 'message': 'Bạn chưa cấu hình API key cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = test_ai_connection(provider=provider, model=model, api_key=api_key)
    return Response(payload, status=status.HTTP_200_OK if payload.get('ok') else status.HTTP_400_BAD_REQUEST)


def _get_ai_runtime_config_status(user_cfg) -> dict:
    from .ai_runtime_config import resolve_ai_runtime_config

    runtime_cfg = resolve_ai_runtime_config(user=getattr(user_cfg, 'user', None))
    provider = str(runtime_cfg.get('provider') or '').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    source = runtime_cfg.get('source')
    ready = bool(runtime_cfg.get('ready'))
    reason = runtime_cfg.get('reason')
    message = str(runtime_cfg.get('message') or '').strip()

    if ready:
        return {
            'provider': provider,
            'model': model,
            'source': source,
            'has_key': True,
            'ready': True,
            'reason': None,
            'message': '',
        }

    if not message:
        message = 'AI runtime chưa sẵn sàng. Vui lòng kiểm tra User AI hoặc System AI Settings.'

    return {
        'provider': provider,
        'model': model,
        'source': source,
        'has_key': False,
        'ready': False,
        'reason': reason,
        'message': message,
    }


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def ai_config_api(request):
    """GET/PUT /api/ai-config/ - đọc/cập nhật cấu hình AI cho user hiện tại."""
    from .ai_service import _resolve_provider_api_key

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)

    def _has_effective_ai_key(provider: str) -> bool:
        return bool(_resolve_provider_api_key(provider, user_cfg.get_ai_api_key()))

    ai_status = _get_ai_runtime_config_status(user_cfg)

    if request.method == 'GET':
        return Response(
            {
                'ai_provider': user_cfg.ai_provider,
                'ai_model': str(user_cfg.ai_model or '').strip(),
                'ai_api_key_configured': _has_effective_ai_key(user_cfg.ai_provider),
                'ai_ready': ai_status['ready'],
                'ai_config_message': ai_status['message'],
                'effective_ai_provider': ai_status['provider'],
                'effective_ai_model': ai_status['model'],
                'effective_ai_source': ai_status.get('source'),
            },
            status=status.HTTP_200_OK,
        )

    provider = str(request.data.get('ai_provider') or user_cfg.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or '').strip()
    api_key = request.data.get('ai_api_key', None)

    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    if not model:
        return Response({'ok': False, 'message': 'Bạn chưa chọn AI model.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_valid_model(provider, model):
        return Response({'ok': False, 'message': 'Model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_model_allowed_for_capability(provider, model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'Model này chưa được hỗ trợ cho AI advisory hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg.ai_provider = provider
    user_cfg.ai_model = model
    if api_key is not None:
        user_cfg.set_ai_api_key(str(api_key or '').strip())
    user_cfg.save()

    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật cấu hình AI.',
            'ai_provider': user_cfg.ai_provider,
            'ai_model': str(user_cfg.ai_model or '').strip(),
            'ai_api_key_configured': _has_effective_ai_key(user_cfg.ai_provider),
            'ai_ready': _get_ai_runtime_config_status(user_cfg)['ready'],
            'ai_config_message': _get_ai_runtime_config_status(user_cfg)['message'],
            'effective_ai_provider': _get_ai_runtime_config_status(user_cfg)['provider'],
            'effective_ai_model': _get_ai_runtime_config_status(user_cfg)['model'],
            'effective_ai_source': _get_ai_runtime_config_status(user_cfg).get('source'),
        },
        status=status.HTTP_200_OK,
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
from .models import Portfolio, Transaction, DailyPrice, IntradayTick, OrderFlowSignal, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, AdvisoryTokenLog, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, StockProfile, PriceAlertRule, MarketGroupSyncLog, StockProfileSyncLog, WhaleAdvisory
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
from .exceptions import ExternalSystemException
from .stock_workspace_helpers import (
    _build_stock_workspace_overview,
    _compute_ema,
    _compute_macd_hist,
    _compute_rsi,
    _compute_stock_workspace_technical,
    _get_exchange_price_band,
    _safe_round,
    _technical_bias_meta,
    _to_float,
)
from .whale_feed_helpers import (
    _allow_vnstock_aggregate_fallback,
    _build_aggregate_event_payload,
    _build_aggregate_event_payload_from_record,
    _build_stream_aggregate_records,
    _build_tick_timestamp,
    _build_vnstock_aggregate_records,
    _build_whale_order_payload,
    _cache_get,
    _cache_set,
    _classify_signal_size,
    _dataframe_has_threshold_hits,
    _decode_whale_feed_cursor,
    _encode_whale_feed_cursor,
    _get_user_whale_threshold_vnd,
    _get_user_symbol_threshold_overrides_vnd,
    _is_rate_limited_error,
    _is_vnstock_rate_limited,
    _mark_vnstock_rate_limited,
    _normalize_aggregate_event_records,
    _normalize_signal_side,
    _parse_cursor_datetime,
    _parse_cursor_matched_value,
    _resolve_whale_feed_symbols,
    _vnstock_rate_limit_cache_key,
)
from .ai_advisory_helpers import (
    _sprint17_build_component_templates,
    _sprint17_compute_summary_from_components,
    _sprint17_extract_json_block,
    _sprint17_generate_component_templates_with_ai,
    _sprint17_generate_executive_synthesis_with_ai,
    _sprint17_normalize_ai_component_payload,
    _sprint17_serialize_stock_advisory_session,
    _sprint17_suggested_action_from_status,
)
from .view_helpers import (
    _build_group_response,
    _build_price_alert_rule_row,
    _price_alert_is_triggered,
)
from .screener_helpers import (
    _SCREENER_ALLOWED_FIELDS,
    _SCREENER_ALLOWED_OPS,
    _apply_screener_condition,
    _screener_build_technical,
    _validate_screener_rules,
)

from .analytics import (
    compute_holdings, compute_nav_series, compute_allocation, build_summary,
    build_risk_metrics, compute_allocation_by_sector,
)



class WatchlistGroupListCreateView(generics.ListCreateAPIView):
    serializer_class = WatchlistGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WatchlistGroup.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WatchlistGroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = WatchlistGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WatchlistGroup.objects.filter(user=self.request.user)

# --- Watchlist Item Views ---
class WatchlistItemCreateView(generics.CreateAPIView):
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        group_id = self.kwargs['group_id']
        group = generics.get_object_or_404(WatchlistGroup, pk=group_id, user=self.request.user)
        serializer.save(group=group)

class WatchlistItemDeleteView(generics.DestroyAPIView):
    serializer_class = WatchlistItemSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = 'item_id'

    def get_queryset(self):
        return WatchlistItem.objects.filter(group__user=self.request.user)

# --- Watchlist Seed/Sync Placeholder Views ---
class WatchlistSeedView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        return Response({'detail': 'Seed not implemented'}, status=status.HTTP_501_NOT_IMPLEMENTED)

class WatchlistSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        days_raw = request.data.get('days', 5)
        try:
            days = int(days_raw)
            if days < 1 or days > 90:
                raise ValueError
        except (ValueError, TypeError):
            return Response({'detail': 'days phải là số nguyên trong khoảng [1, 90].'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            results = sync_watchlist_prices(user_id=request.user.id, days=days)
        except (Exception, SystemExit) as exc:
            logger.error('WatchlistSyncView lỗi: %s', exc, exc_info=True)
            return Response(
                {'detail': f'Sync thất bại: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({'synced': len(results), 'days': days})


class RealtimeTickerView(APIView):
    """
    GET /api/realtime/ticker/<symbol>/ — fallback polling endpoint for realtime views.
    Phục vụ từ cache (được làm ấm bởi Celery task prefetch_ticker_price_board).
    Không gọi vnstock trực tiếp trong HTTP handler để tránh block thread pool.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_ticker'

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        # --- Cache được làm ấm bởi prefetch_ticker_price_board Celery task ---
        ticker_cache_key = f'ticker:{normalized_symbol}'
        cached_ticker = _cache_get(ticker_cache_key)
        if cached_ticker is not None:
            return Response(cached_ticker)

        # --- Cache miss: trigger background prefetch để làm ấm cache cho lần sau ---
        try:
            from portfolio.tasks import prefetch_ticker_price_board
            prefetch_ticker_price_board.apply_async(countdown=0)
        except Exception:
            pass

        # --- Fallback ngay lập tức về DB, không block thread ---
        price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
        last_date = price_info.get('last_date')
        freshness_seconds = None
        stale = True

        if last_date:
            try:
                last_dt = datetime.fromisoformat(str(last_date))
                freshness_seconds = max(int((datetime.now() - last_dt).total_seconds()), 0)
                stale = freshness_seconds > 30
            except ValueError:
                freshness_seconds = None
                stale = True

        latest_dp = (
            DailyPrice.objects
            .filter(symbol=normalized_symbol)
            .order_by('-date')
            .values('open_price', 'high_price', 'low_price', 'volume')
            .first()
        )
        ohlc_extra = {}
        if latest_dp:
            ohlc_extra = {
                'open_price': float(latest_dp['open_price']) if latest_dp['open_price'] is not None else None,
                'high_price': float(latest_dp['high_price']) if latest_dp['high_price'] is not None else None,
                'low_price': float(latest_dp['low_price']) if latest_dp['low_price'] is not None else None,
                'volume': int(latest_dp['volume']) if latest_dp['volume'] is not None else None,
            }

        return Response({
            'symbol': normalized_symbol,
            **price_info,
            **ohlc_extra,
            'freshness_seconds': freshness_seconds,
            'stale': stale,
            'source': 'db',
        })


class IntradayMatchedView(APIView):
    """
    GET /api/realtime/intraday/<symbol>/?page_size=50
    Lấy dữ liệu khớp lệnh trong phiên giao dịch hôm nay từ vnstock.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_intraday'

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = int(request.query_params.get('page_size', 50))
            page_size = max(10, min(200, page_size))
        except (ValueError, TypeError):
            page_size = 50

        cache_key = f'intraday:{normalized_symbol}:{page_size}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if _is_vnstock_rate_limited('intraday'):
            return Response({
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'source': 'vnstock_backoff',
                'rate_limited': True,
                'fetched_at': timezone.now().isoformat(),
            })

        # Tier 1: đọc từ Redis Stream (nếu có)
        try:
            from portfolio.realtime.stream_reader import StreamReader
            _reader = StreamReader()
            stream_ticks = _reader.get_intraday_ticks(normalized_symbol, count=page_size)
            if stream_ticks:
                trades = []
                for tick in stream_ticks:
                    raw_time = tick.get("ts", "")
                    try:
                        import pandas as _pd
                        ts = _pd.Timestamp(raw_time)
                        time_str = ts.strftime('%H:%M:%S')
                    except Exception:
                        time_str = str(raw_time)[:8]
                    side_raw = tick.get("side", "UNKNOWN").lower()
                    side = "buy" if side_raw == "buy" else ("sell" if side_raw == "sell" else "neutral")
                    try:
                        price_val = float(tick.get("price", 0)) or None
                        vol_val = int(float(tick.get("volume", 0)))
                    except (ValueError, TypeError):
                        price_val = None
                        vol_val = None
                    if price_val is None:
                        continue
                    trades.append({
                        "time": time_str,
                        "price": price_val,
                        "volume": vol_val,
                        "side": side,
                        "match_type": tick.get("side", ""),
                    })
                if trades:
                    result = {
                        "symbol": normalized_symbol,
                        "trades": trades,
                        "total": len(trades),
                        "source": "stream",
                        "fetched_at": timezone.now().isoformat(),
                    }
                    _cache_set(cache_key, result, timeout=8)
                    return Response(result)
        except (Exception, SystemExit) as _exc:
            logger.debug("Stream fallback failed for %s: %s", normalized_symbol, _exc)

        try:
            df = fetch_intraday_dataframe(symbol=normalized_symbol, page_size=page_size)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if exc.code == 'vnstock_rate_limited':
                _mark_vnstock_rate_limited('intraday', exc)
                return Response({
                    'symbol': normalized_symbol,
                    'trades': [],
                    'total': 0,
                    'source': 'vnstock_backoff',
                    'rate_limited': True,
                    'fetched_at': timezone.now().isoformat(),
                })
            if exc.code == 'vnstock_timeout':
                return Response({
                    'symbol': normalized_symbol,
                    'trades': [],
                    'total': 0,
                    'source': 'timeout',
                    'fetched_at': timezone.now().isoformat(),
                })
            logger.warning('IntradayMatchedView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'source': 'vnstock_unavailable',
                'fetched_at': timezone.now().isoformat(),
            })
        except Exception as exc:
            logger.exception('IntradayMatchedView unexpected error %s: %s', normalized_symbol, exc)
            return Response({
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'source': 'error',
                'fetched_at': timezone.now().isoformat(),
            })

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'trades': [], 'total': 0, 'fetched_at': timezone.now().isoformat()})

        trades = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or row.get('date') or ''
            raw_price = row.get('price') or row.get('close') or 0
            raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0

            # vnstock VCI trả về match_type = 'Buy' / 'Sell' / 'ATO' / 'ATC'
            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            mt_lower = match_type_raw.lower()
            if mt_lower in ('buy', 'bu', 'b'):
                side = 'buy'
            elif mt_lower in ('sell', 'sd', 's'):
                side = 'sell'
            else:
                side = 'neutral'

            try:
                price_val = float(raw_price) if raw_price else None
                vol_val = int(float(raw_vol)) if raw_vol else None
            except (ValueError, TypeError):
                price_val = None
                vol_val = None

            if price_val is None:
                continue

            time_str = ''
            try:
                import pandas as pd
                ts = pd.Timestamp(raw_time)
                time_str = ts.strftime('%H:%M:%S')
            except Exception:
                time_str = str(raw_time)[:8]

            trades.append({
                'time': time_str,
                'price': price_val,
                'volume': vol_val,
                'side': side,
                'match_type': match_type_raw,
            })

        result = {
            'symbol': normalized_symbol,
            'trades': trades,
            'total': len(trades),
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=8)
        return Response(result)


class PriceBoardView(APIView):
    """
    GET /api/realtime/price-board/<symbol>/
    Trả về sổ lệnh 3 mức giá (bid/ask) và dữ liệu khớp thực từ vnstock price_board.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_price_board'

    def get(self, request, symbol):
        import pandas as pd
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'price_board:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if _is_vnstock_rate_limited('price_board'):
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'vnstock_backoff', 'rate_limited': True})

        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if exc.code == 'vnstock_rate_limited':
                _mark_vnstock_rate_limited('price_board', exc)
                return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'vnstock_backoff', 'rate_limited': True})
            if exc.code == 'vnstock_timeout':
                return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'timeout', 'fetched_at': timezone.now().isoformat()})
            logger.warning('PriceBoardView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'vnstock_unavailable', 'fetched_at': timezone.now().isoformat()})
        except Exception as exc:
            logger.exception('PriceBoardView unexpected fetch error %s: %s', normalized_symbol, exc)
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'error', 'fetched_at': timezone.now().isoformat()})

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}})

        row = df.iloc[0]

        def safe_float(val):
            try:
                v = float(val)
                return v if v == v else None  # NaN check
            except (TypeError, ValueError):
                return None

        def safe_int(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        try:
            ba = df['bid_ask'].iloc[0]
            mt = df['match'].iloc[0]
        except Exception as exc:
            logger.warning('PriceBoardView malformed payload %s: %s', normalized_symbol, exc)
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'payload_invalid', 'fetched_at': timezone.now().isoformat()})

        depth = []
        for i in range(1, 4):
            bp = safe_float(ba.get(f'bid_{i}_price'))
            bv = safe_int(ba.get(f'bid_{i}_volume'))
            ap = safe_float(ba.get(f'ask_{i}_price'))
            av = safe_int(ba.get(f'ask_{i}_volume'))
            if bp is not None or ap is not None:
                depth.append({'level': i, 'bid_price': bp, 'bid_volume': bv, 'ask_price': ap, 'ask_volume': av})

        ref = safe_float(mt.get('reference_price'))
        match_price = safe_float(mt.get('match_price'))
        change_pct = round((match_price - ref) / ref * 100, 2) if ref and match_price else None

        match_data = {
            'match_price': match_price,
            'open_price': safe_float(mt.get('open_price')),
            'highest': safe_float(mt.get('highest')),
            'lowest': safe_float(mt.get('lowest')),
            'reference_price': ref,
            'accumulated_volume': safe_int(mt.get('accumulated_volume')),
            'foreign_buy_volume': safe_int(mt.get('foreign_buy_volume')),
            'foreign_sell_volume': safe_int(mt.get('foreign_sell_volume')),
            'change_pct': change_pct,
        }

        result = {
            'symbol': normalized_symbol,
            'depth': depth,
            'match': match_data,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=8)
        return Response(result)


class SectorBreadthView(APIView):
    """
    GET /api/realtime/breadth/<symbol>/
    Trả về diễn biến giá các mã cùng nhóm ngành với symbol, dùng price_board.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_breadth'

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'breadth:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        # Lấy các nhóm mà symbol thuộc về
        group_items = (
            SecuritiesItem.objects
            .filter(symbol=normalized_symbol)
            .select_related('group')
            .order_by('group__order', 'group__name')[:5]
        )

        if not group_items.exists():
            return Response({'symbol': normalized_symbol, 'groups': [], 'fetched_at': timezone.now().isoformat()})

        # Gom tất cả symbols cần fetch (tối đa 15 mã/nhóm)
        groups_meta = []
        all_symbols = set()
        for item in group_items:
            group = item.group
            peers = list(
                SecuritiesItem.objects
                .filter(group=group)
                .exclude(symbol=normalized_symbol)
                .values_list('symbol', flat=True)
                .order_by('order', 'symbol')[:14]
            )
            peers.insert(0, normalized_symbol)
            groups_meta.append({'id': group.id, 'name': group.name, 'symbols': peers})
            all_symbols.update(peers)

        all_symbols = list(all_symbols)

        # --- Cache-first: đọc từ ticker cache (được làm ấm bởi prefetch_ticker_price_board) ---
        price_map = {}
        missing_syms = []
        for sym in all_symbols:
            cached_t = _cache_get(f'ticker:{sym}')
            if cached_t:
                match_price = cached_t.get('current_price')
                ref_price = cached_t.get('prev_price')
                try:
                    chg = (round((match_price - ref_price) / ref_price * 100, 2)
                           if match_price and ref_price else None)
                except (TypeError, ZeroDivisionError):
                    chg = None
                status_val = 'up' if chg and chg > 0.5 else 'down' if chg and chg < -0.5 else 'flat'
                price_map[sym.upper()] = {'price': match_price, 'change_pct': chg, 'status': status_val}
            else:
                missing_syms.append(sym)

        # --- Chỉ gọi vnstock cho symbols chưa có trong cache ---
        if missing_syms:
            df = None
            try:
                df = fetch_price_board_dataframe(missing_syms, anchor_symbol=normalized_symbol)
            except ExternalSystemException as exc:
                if exc.code == 'vnstock_timeout':
                    logger.warning('SectorBreadthView timeout fetching %d missing syms for %s',
                                   len(missing_syms), normalized_symbol)
                else:
                    logger.warning('SectorBreadthView lỗi vnstock %s: %s', normalized_symbol, exc)

            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    sym = str(row.get(('listing', 'symbol')) or '').upper()
                    if not sym:
                        continue
                    try:
                        ref = float(row.get(('match', 'reference_price')) or 0)
                        price = float(row.get(('match', 'match_price')) or 0)
                        chg = round((price - ref) / ref * 100, 2) if ref > 0 else None
                    except (TypeError, ValueError):
                        chg = None
                        price = None
                    status_val = 'up' if chg and chg > 0.5 else 'down' if chg and chg < -0.5 else 'flat'
                    price_map[sym] = {'price': price, 'change_pct': chg, 'status': status_val}


        result_groups = []
        for gm in groups_meta:
            peers = []
            for s in gm['symbols']:
                info = price_map.get(s.upper(), {})
                peers.append({
                    'symbol': s,
                    'price': info.get('price'),
                    'change_pct': info.get('change_pct'),
                    'status': info.get('status', 'flat'),
                    'is_self': s == normalized_symbol,
                })
            result_groups.append({'name': gm['name'], 'peers': peers})

        result = {
            'symbol': normalized_symbol,
            'groups': result_groups,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=30)
        return Response(result)


class WhaleFeedView(APIView):
    """
    GET /api/realtime/whale-feed/<symbol>/
    Trả về các lệnh lớn trong phiên + tóm tắt dòng tiền từ intraday data.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_feed'

    def get(self, request, symbol):
        import pandas as pd
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        threshold_vnd = _get_user_whale_threshold_vnd(request.user, normalized_symbol)
        score_config = resolve_whale_score_config()
        request_now = timezone.now()

        cache_key = f'whale_feed:{request.user.id}:{normalized_symbol}:{int(threshold_vnd)}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        # Tier 1: đọc từ Redis Stream
        stream_df = None
        stream_has_hits = False
        try:
            from portfolio.realtime.stream_reader import StreamReader
            _reader = StreamReader()
            stream_ticks = _reader.get_intraday_ticks(normalized_symbol, count=500)
            if stream_ticks:
                stream_df = pd.DataFrame([{
                    "price": float(t.get("price", 0)),
                    "volume": float(t.get("volume", 0)),
                    "match_type": t.get("side", "UNKNOWN"),
                    "side": t.get("side", "UNKNOWN"),
                } for t in stream_ticks])
                stream_has_hits = _dataframe_has_threshold_hits(stream_df, threshold_vnd)
        except (Exception, SystemExit) as _exc:
            logger.debug("WhaleFeed stream fallback failed for %s: %s", normalized_symbol, _exc)

        # Tier 2: đọc từ read model IntradayTick trong DB để đồng bộ với aggregate feed/hub.
        # Nếu stream có dữ liệu nhưng không có lệnh nào vượt ngưỡng, vẫn phải fallback xuống DB.
        db_df = None
        db_has_hits = False
        if stream_df is None or stream_df.empty or not stream_has_hits:
            db_rows = list(
                IntradayTick.objects
                .filter(symbol=normalized_symbol, trade_date=date.today())
                .order_by('-trade_time', '-id')
                .values('trade_time', 'price', 'volume', 'match_type', 'side')
            )
            if db_rows:
                db_df = pd.DataFrame([
                    {
                        'time': row['trade_time'].isoformat() if row.get('trade_time') else '',
                        'price': float(row.get('price') or 0),
                        'volume': float(row.get('volume') or 0),
                        'match_type': row.get('side') or row.get('match_type') or 'UNKNOWN',
                        'side': row.get('side') or row.get('match_type') or 'UNKNOWN',
                    }
                    for row in db_rows
                ])
                db_has_hits = _dataframe_has_threshold_hits(db_df, threshold_vnd)

        try:
            if stream_df is not None and not stream_df.empty and stream_has_hits:
                df = stream_df
                data_source = 'redis_stream'
            elif db_df is not None and not db_df.empty and db_has_hits:
                df = db_df
                data_source = 'intraday_tick_db'
            elif stream_df is not None and not stream_df.empty:
                df = stream_df
                data_source = 'redis_stream'
            elif db_df is not None and not db_df.empty:
                df = db_df
                data_source = 'intraday_tick_db'
            else:
                if _is_vnstock_rate_limited('intraday'):
                    df = None
                    data_source = 'vnstock_backoff'
                else:
                    try:
                        df = fetch_intraday_dataframe(symbol=normalized_symbol, page_size=500)
                        data_source = 'vnstock'
                    except ExternalSystemException as exc:
                        if exc.code == 'vnstock_timeout':
                            logger.warning('WhaleFeedView timeout vnstock fallback %s', normalized_symbol)
                            df = None
                            data_source = 'timeout'
                        elif exc.code == 'vnstock_rate_limited':
                            _mark_vnstock_rate_limited('intraday', exc)
                            logger.info('WhaleFeedView vnstock rate-limited %s — activate cooldown', normalized_symbol)
                            data_source = 'vnstock_backoff'
                            df = None
                        else:
                            logger.warning('WhaleFeedView lỗi vnstock %s: %s', normalized_symbol, exc)
                            data_source = 'unavailable'
                            df = None
        except Exception as exc:
            logger.warning('WhaleFeedView data-source selection error %s: %s', normalized_symbol, exc)
            df = None
            data_source = 'error'

        if df is None or df.empty:
            return Response({
                'symbol': normalized_symbol, 'threshold': threshold_vnd,
                'source': locals().get('data_source', 'unknown'),
                'rate_limited': locals().get('data_source') in ('unavailable', 'timeout', 'vnstock_backoff'),
                'whale_orders': [], 'summary': {
                    'buy_value': 0, 'sell_value': 0, 'flow_net': 0,
                    'shark_value': 0, 'whale_value': 0, 'small_value': 0,
                    'shark_pct': 0, 'whale_pct': 0, 'small_pct': 0,
                },
                'fetched_at': timezone.now().isoformat(),
            })

        orders = []
        total_buy_value = 0.0
        total_sell_value = 0.0
        shark_value = 0.0
        whale_value_total = 0.0
        small_value = 0.0

        for _, row in df.iterrows():
            try:
                raw_price = float(row.get('price') or row.get('close') or 0)
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            matched_value = raw_price * raw_vol

            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            mt_lower = match_type_raw.lower()
            if mt_lower in ('buy', 'bu', 'b'):
                side = 'buy'
            elif mt_lower in ('sell', 'sd', 's'):
                side = 'sell'
            else:
                side = 'neutral'

            if matched_value >= 5_000_000_000:
                size_class = 'shark'
                shark_value += matched_value
            elif matched_value >= 1_000_000_000:
                size_class = 'whale'
                whale_value_total += matched_value
            else:
                size_class = 'small'
                small_value += matched_value

            if side == 'buy':
                total_buy_value += matched_value
            elif side == 'sell':
                total_sell_value += matched_value

            if matched_value >= threshold_vnd:
                raw_time = row.get('time') or row.get('tradingDate') or ''
                orders.append(
                    _build_whale_order_payload(
                        raw_time=raw_time,
                        raw_price=raw_price,
                        raw_vol=raw_vol,
                        matched_value=matched_value,
                        side=side,
                        size_class=size_class,
                        threshold_vnd=threshold_vnd,
                        score_config=score_config,
                        now=request_now,
                    )
                )

        orders.sort(key=lambda x: x['matched_value'], reverse=True)
        total_value = shark_value + whale_value_total + small_value

        result = {
            'symbol': normalized_symbol,
            'threshold': threshold_vnd,
            'source': data_source,
            'weights_version': score_config['version'],
            'whale_orders': orders[:50],
            'summary': {
                'buy_value': total_buy_value,
                'sell_value': total_sell_value,
                'flow_net': total_buy_value - total_sell_value,
                'shark_value': shark_value,
                'whale_value': whale_value_total,
                'small_value': small_value,
                'shark_pct': round(shark_value / total_value * 100, 1) if total_value > 0 else 0,
                'whale_pct': round(whale_value_total / total_value * 100, 1) if total_value > 0 else 0,
                'small_pct': round(small_value / total_value * 100, 1) if total_value > 0 else 0,
            },
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=20)
        return Response(result)


class RVOLView(APIView):
    """
    GET /api/realtime/rvol/<symbol>/
    Tính RVOL (Relative Volume) theo bucket 15 phút từ intraday data.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_rvol'

    def get(self, request, symbol):
        import pandas as pd
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'rvol:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if _is_vnstock_rate_limited('intraday'):
            return Response({'symbol': normalized_symbol, 'buckets': [], 'source': 'vnstock_backoff', 'rate_limited': True, 'fetched_at': timezone.now().isoformat()})

        try:
            df = fetch_intraday_dataframe(symbol=normalized_symbol, page_size=500)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                _mark_vnstock_rate_limited('intraday', exc)
                return Response({'symbol': normalized_symbol, 'buckets': [], 'source': 'vnstock_backoff', 'rate_limited': True, 'fetched_at': timezone.now().isoformat()})
            logger.warning('RVOLView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc.message}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'buckets': [], 'fetched_at': timezone.now().isoformat()})

        rows = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or ''
            raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
            try:
                ts = pd.Timestamp(str(raw_time))
                vol = float(raw_vol)
                rows.append({'ts': ts, 'volume': vol})
            except Exception:
                continue

        if not rows:
            return Response({'symbol': normalized_symbol, 'buckets': [], 'fetched_at': timezone.now().isoformat()})

        frame = pd.DataFrame(rows).set_index('ts').sort_index()
        buckets_df = frame.resample('15min')['volume'].sum().reset_index()
        buckets_df.columns = ['time', 'volume']

        volumes = buckets_df['volume'].values
        window = min(20, len(volumes))
        sma20_vals = []
        for i in range(len(volumes)):
            start = max(0, i - window)
            sma20_vals.append(float(volumes[start:i + 1].mean()) if i >= 0 else 0.0)

        buckets = []
        for i, row in buckets_df.iterrows():
            vol = float(row['volume'])
            sma20 = sma20_vals[i] if i < len(sma20_vals) else 0.0
            rvol = round(vol / sma20, 2) if sma20 > 0 else 0.0
            try:
                time_str = row['time'].strftime('%H:%M')
            except Exception:
                time_str = str(row['time'])[:5]
            buckets.append({
                'time': time_str,
                'volume': int(vol),
                'sma20': int(sma20),
                'rvol': rvol,
                'is_spike': rvol >= 2.0,
            })

        result = {
            'symbol': normalized_symbol,
            'buckets': buckets,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=20)
        return Response(result)


class WhaleFeedAggregateView(APIView):
    """
    GET /api/realtime/whale-feed/aggregate/
    Aggregate whale events với pipeline ưu tiên Redis stream -> IntradayTick DB -> vnstock.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        threshold_vnd = _get_user_whale_threshold_vnd(request.user)
        entitlements = resolve_user_entitlements(request.user)
        api_quota = consume_quota(
            request.user,
            quota_key='api_calls_per_day',
            entitlements=entitlements,
        )
        if not api_quota.get('allowed', True):
            return Response(
                build_quota_exceeded_payload(api_quota, 'Ban da dung het quota API trong ngay.'),
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        symbols, scope, watchlist_group_ids, scope_source = _resolve_whale_feed_symbols(request)
        symbol_threshold_overrides = _get_user_symbol_threshold_overrides_vnd(request.user, symbols)

        def _resolve_threshold_for_symbol(resolved_symbol: str) -> float:
            return symbol_threshold_overrides.get(str(resolved_symbol or '').strip().upper(), threshold_vnd)

        min_threshold_vnd = min([_resolve_threshold_for_symbol(symbol) for symbol in symbols], default=threshold_vnd)
        score_config = resolve_whale_score_config()
        request_now = timezone.now()

        limit_raw = request.query_params.get('limit', 20)
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            return Response({'detail': 'limit phải là số nguyên trong khoảng [1, 50].'}, status=status.HTTP_400_BAD_REQUEST)
        if limit < 1 or limit > 50:
            return Response({'detail': 'limit phải là số nguyên trong khoảng [1, 50].'}, status=status.HTTP_400_BAD_REQUEST)

        sort = str(request.query_params.get('sort', 'ts')).strip().lower()
        if sort not in ('ts', 'matched_value'):
            return Response({'detail': "sort không hợp lệ. Chỉ hỗ trợ: 'ts' hoặc 'matched_value'."}, status=status.HTTP_400_BAD_REQUEST)

        cursor_payload = _decode_whale_feed_cursor(request.query_params.get('cursor'))
        if request.query_params.get('cursor') and cursor_payload is None:
            return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
        if cursor_payload is not None:
            cursor_sort = str(cursor_payload.get('sort', '')).strip().lower()
            if cursor_sort and cursor_sort != sort:
                return Response({'detail': 'cursor không hợp lệ cho sort hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

        if not symbols:
            if cursor_payload is not None:
                return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            return Response({
                'results': [],
                'next_cursor': None,
                'has_more': False,
                'server_time': timezone.now().isoformat(),
                'source': 'intraday_tick_db',
                'filters': {
                    'scope': scope,
                    'scope_source': scope_source,
                    'symbols': [],
                    'watchlist_group_ids': watchlist_group_ids,
                    'sort': sort,
                    'limit': limit,
                    'threshold': threshold_vnd,
                },
                'meta': {
                    'contract_version': '1.1',
                    'pagination': {
                        'sort': sort,
                        'limit': limit,
                        'has_more': False,
                        'next_cursor': None,
                    },
                    'scope': {
                        'value': scope,
                        'source': scope_source,
                    },
                },
                'entitlements': entitlements,
                'weights_version': score_config['version'],
            })

        stream_records = _build_stream_aggregate_records(symbols, min_threshold_vnd)
        if stream_records:
            stream_records = [
                row for row in stream_records
                if float(row.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(row.get('symbol'))
            ]
        if stream_records:
            normalized_records, ok = _normalize_aggregate_event_records(stream_records, sort=sort, cursor_payload=cursor_payload)
            if not ok:
                return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

            has_more = len(normalized_records) > limit
            page_rows = normalized_records[:limit]
            next_cursor = None
            if has_more and page_rows:
                last_row = page_rows[-1]
                if sort == 'matched_value':
                    next_cursor = _encode_whale_feed_cursor({
                        'sort': sort,
                        'matched_value': float(last_row['matched_value']),
                        'id': int(last_row['id']),
                    })
                else:
                    last_dt = datetime.fromisoformat(str(last_row['ts']).replace('Z', '+00:00'))
                    next_cursor = _encode_whale_feed_cursor({
                        'sort': sort,
                        'trade_date': last_dt.date().isoformat(),
                        'trade_time': last_dt.time().isoformat(),
                        'id': int(last_row['id']),
                    })

            return Response({
                'results': [
                    _build_aggregate_event_payload_from_record(
                        row,
                        _resolve_threshold_for_symbol(row.get('symbol')),
                        score_config=score_config,
                        now=request_now,
                    )
                    for row in page_rows
                ],
                'next_cursor': next_cursor,
                'has_more': has_more,
                'server_time': timezone.now().isoformat(),
                'source': 'redis_stream',
                'weights_version': score_config['version'],
                'filters': {
                    'scope': scope,
                    'scope_source': scope_source,
                    'symbols': symbols,
                    'watchlist_group_ids': watchlist_group_ids,
                    'sort': sort,
                    'limit': limit,
                    'threshold': threshold_vnd,
                },
                'meta': {
                    'contract_version': '1.1',
                    'pagination': {
                        'sort': sort,
                        'limit': limit,
                        'has_more': has_more,
                        'next_cursor': next_cursor,
                    },
                    'scope': {
                        'value': scope,
                        'source': scope_source,
                    },
                },
                'entitlements': entitlements,
            })

        queryset = (
            IntradayTick.objects
            .filter(trade_date=date.today(), symbol__in=symbols)
            .annotate(
                matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
            )
            .filter(matched_value__gte=min_threshold_vnd)
        )

        if sort == 'matched_value':
            if cursor_payload is not None:
                parsed_cursor = _parse_cursor_matched_value(cursor_payload)
                if parsed_cursor is None:
                    return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
                cursor_value, cursor_id = parsed_cursor
                queryset = queryset.filter(
                    Q(matched_value__lt=cursor_value) |
                    Q(matched_value=cursor_value, id__lt=cursor_id)
                )
            queryset = queryset.order_by('-matched_value', '-id')
        else:
            if cursor_payload is not None:
                parsed_cursor = _parse_cursor_datetime(cursor_payload)
                if parsed_cursor is None:
                    return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
                cursor_date, cursor_time, cursor_id = parsed_cursor
                queryset = queryset.filter(
                    Q(trade_date__lt=cursor_date) |
                    Q(trade_date=cursor_date, trade_time__lt=cursor_time) |
                    Q(trade_date=cursor_date, trade_time=cursor_time, id__lt=cursor_id)
                )
            queryset = queryset.order_by('-trade_date', '-trade_time', '-id')

        rows = [
            row for row in queryset
            if float(getattr(row, 'matched_value', 0) or 0.0) >= _resolve_threshold_for_symbol(getattr(row, 'symbol', ''))
        ]
        has_more = len(rows) > limit
        page_rows = rows[:limit]

        if not page_rows:
            vnstock_records = _build_vnstock_aggregate_records(symbols, min_threshold_vnd)
            if vnstock_records:
                vnstock_records = [
                    row for row in vnstock_records
                    if float(row.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(row.get('symbol'))
                ]
            normalized_records, ok = _normalize_aggregate_event_records(vnstock_records, sort=sort, cursor_payload=cursor_payload)
            if not ok:
                return Response({'detail': 'cursor không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

            has_more = len(normalized_records) > limit
            page_rows = normalized_records[:limit]
            next_cursor = None
            if has_more and page_rows:
                last_row = page_rows[-1]
                if sort == 'matched_value':
                    next_cursor = _encode_whale_feed_cursor({
                        'sort': sort,
                        'matched_value': float(last_row['matched_value']),
                        'id': int(last_row['id']),
                    })
                else:
                    last_dt = datetime.fromisoformat(str(last_row['ts']).replace('Z', '+00:00'))
                    next_cursor = _encode_whale_feed_cursor({
                        'sort': sort,
                        'trade_date': last_dt.date().isoformat(),
                        'trade_time': last_dt.time().isoformat(),
                        'id': int(last_row['id']),
                    })

            return Response({
                'results': [
                    _build_aggregate_event_payload_from_record(
                        row,
                        _resolve_threshold_for_symbol(row.get('symbol')),
                        score_config=score_config,
                        now=request_now,
                    )
                    for row in page_rows
                ],
                'next_cursor': next_cursor,
                'has_more': has_more,
                'server_time': timezone.now().isoformat(),
                'source': 'vnstock' if page_rows else 'intraday_tick_db',
                'weights_version': score_config['version'],
                'filters': {
                    'scope': scope,
                    'scope_source': scope_source,
                    'symbols': symbols,
                    'watchlist_group_ids': watchlist_group_ids,
                    'sort': sort,
                    'limit': limit,
                    'threshold': threshold_vnd,
                },
                'meta': {
                    'contract_version': '1.1',
                    'pagination': {
                        'sort': sort,
                        'limit': limit,
                        'has_more': has_more,
                        'next_cursor': next_cursor,
                    },
                    'scope': {
                        'value': scope,
                        'source': scope_source,
                    },
                },
                'entitlements': entitlements,
            })

        next_cursor = None
        if has_more and page_rows:
            last_row = page_rows[-1]
            if sort == 'matched_value':
                next_cursor = _encode_whale_feed_cursor({
                    'sort': sort,
                    'matched_value': float(getattr(last_row, 'matched_value', 0) or 0),
                    'id': last_row.id,
                })
            else:
                next_cursor = _encode_whale_feed_cursor({
                    'sort': sort,
                    'trade_date': last_row.trade_date.isoformat(),
                    'trade_time': last_row.trade_time.isoformat(),
                    'id': last_row.id,
                })

        results = [
            _build_aggregate_event_payload(
                row,
                _resolve_threshold_for_symbol(getattr(row, 'symbol', '')),
                score_config=score_config,
                now=request_now,
            )
            for row in page_rows
        ]
        return Response({
            'results': results,
            'next_cursor': next_cursor,
            'has_more': has_more,
            'server_time': timezone.now().isoformat(),
            'source': 'intraday_tick_db',
            'weights_version': score_config['version'],
            'filters': {
                'scope': scope,
                'scope_source': scope_source,
                'symbols': symbols,
                'watchlist_group_ids': watchlist_group_ids,
                'sort': sort,
                'limit': limit,
                'threshold': threshold_vnd,
            },
            'meta': {
                'contract_version': '1.1',
                'pagination': {
                    'sort': sort,
                    'limit': limit,
                    'has_more': has_more,
                    'next_cursor': next_cursor,
                },
                'scope': {
                    'value': scope,
                    'source': scope_source,
                },
            },
            'entitlements': entitlements,
        })


class DepthChartView(APIView):
    """
    GET /api/realtime/depth-chart/<symbol>/
    Tính độ sâu tích lũy từ price_board để vẽ depth chart (bid/ask mountains).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        except ExternalSystemException as exc:
            logger.warning('DepthChartView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc.message}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'bids': [], 'asks': [], 'walls': [], 'reference_price': None})

        def safe_f(val):
            try:
                v = float(val)
                return v if v == v else None
            except (TypeError, ValueError):
                return None

        def safe_i(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        ba = df['bid_ask'].iloc[0]
        mt = df['match'].iloc[0]

        ref_price = safe_f(mt.get('reference_price')) or 0
        ceil_price = safe_f(mt.get('ceiling_price')) or (ref_price * 1.07 if ref_price else None)
        floor_price = safe_f(mt.get('floor_price')) or (ref_price * 0.93 if ref_price else None)

        bids = []
        cum_bid = 0
        for i in range(1, 4):
            bp = safe_f(ba.get(f'bid_{i}_price'))
            bv = safe_i(ba.get(f'bid_{i}_volume'))
            if bp and bv:
                cum_bid += bv
                bids.append({'price': bp, 'volume': bv, 'cumulative': cum_bid})

        asks = []
        cum_ask = 0
        for i in range(1, 4):
            ap = safe_f(ba.get(f'ask_{i}_price'))
            av = safe_i(ba.get(f'ask_{i}_volume'))
            if ap and av:
                cum_ask += av
                asks.append({'price': ap, 'volume': av, 'cumulative': cum_ask})

        all_vols = [b['volume'] for b in bids] + [a['volume'] for a in asks]
        avg_vol = sum(all_vols) / len(all_vols) if all_vols else 1
        wall_threshold = avg_vol * 2

        walls = []
        for b in bids:
            if b['volume'] >= wall_threshold:
                walls.append({'side': 'bid', 'price': b['price'], 'volume': b['volume'],
                               'label': f'⚠️ TƯỜNG MUA: {b["volume"]:,}'})
        for a in asks:
            if a['volume'] >= wall_threshold:
                walls.append({'side': 'ask', 'price': a['price'], 'volume': a['volume'],
                               'label': f'⚠️ TƯỜNG BÁN: {a["volume"]:,}'})

        return Response({
            'symbol': normalized_symbol,
            'reference_price': ref_price,
            'ceiling_price': ceil_price,
            'floor_price': floor_price,
            'bids': bids,
            'asks': asks,
            'walls': walls,
            'fetched_at': timezone.now().isoformat(),
        })


# ---------------------------------------------------------------------------
# Financial Metrics View
# ---------------------------------------------------------------------------

class FinancialMetricsView(APIView):
    """
    GET /api/stock-management/stocks/<symbol>/financials/
    Trả về chỉ tiêu tài chính theo năm (tối đa 5 năm gần nhất).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'financials:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            df = fetch_financial_ratio_dataframe(
                normalized_symbol,
                period='year',
                lang='vi',
                dropna=True,
                source='VCI',
            )
        except ExternalSystemException as exc:
            logger.warning('FinancialMetricsView lỗi vnstock %s: %s', normalized_symbol, exc)
            if exc.code == 'vnstock_missing':
                return Response({'detail': str(exc.message)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'years': [],
                    'source': 'vnstock_unavailable',
                    'fetched_at': timezone.now().isoformat(),
                }
            )
        except Exception as exc:
            logger.exception('FinancialMetricsView unexpected lỗi %s: %s', normalized_symbol, exc)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'years': [],
                    'source': 'error',
                    'fetched_at': timezone.now().isoformat(),
                }
            )

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'years': []})

        def _f(row, key):
            val = row.get(key)
            if val is None:
                return None
            try:
                v = float(val)
                return round(v, 4) if v == v else None
            except (TypeError, ValueError):
                return None

        def _parse_year(value):
            if value is None:
                return None
            try:
                return int(float(value))
            except (TypeError, ValueError):
                match = re.search(r'\d{4}', str(value))
                return int(match.group(0)) if match else None

        years = []
        try:
            for _, row in df.head(5).iterrows():
                year_val = row.get(('Meta', 'Năm')) or row.get('Năm') or row.get('year')
                years.append({
                    'year': _parse_year(year_val),
                    # Định giá
                    'eps':         _f(row, ('Chỉ tiêu định giá', 'EPS (VND)')),
                    'pe':          _f(row, ('Chỉ tiêu định giá', 'P/E')),
                    'pb':          _f(row, ('Chỉ tiêu định giá', 'P/B')),
                    'ps':          _f(row, ('Chỉ tiêu định giá', 'P/S')),
                    'bvps':        _f(row, ('Chỉ tiêu định giá', 'BVPS (VND)')),
                    'market_cap_bn': _f(row, ('Chỉ tiêu định giá', 'Vốn hóa (Tỷ đồng)')),
                    # Sinh lời
                    'roe':           _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROE (%)')),
                    'roa':           _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROA (%)')),
                    'net_margin':    _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Biên lợi nhuận ròng (%)')),
                    'dividend_yield': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Tỷ suất cổ tức (%)')),
                    # Thanh khoản / đòn bẩy
                    'leverage':      _f(row, ('Chỉ tiêu thanh khoản', 'Đòn bẩy tài chính')),
                    'current_ratio': _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán hiện hành')),
                    'quick_ratio':   _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán nhanh')),
                    'debt_equity':   _f(row, ('Chỉ tiêu thanh khoản', 'Nợ/Vốn chủ sở hữu')),
                })
        except Exception as exc:
            logger.exception('FinancialMetricsView parse lỗi %s: %s', normalized_symbol, exc)
            return Response({'detail': 'Không parse được dữ liệu tài chính từ nguồn realtime.'}, status=status.HTTP_502_BAD_GATEWAY)

        result = {
            'symbol': normalized_symbol,
            'years': years,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=21600)  # 6 giờ
        return Response(result)


# ---------------------------------------------------------------------------
# Portfolio Views
# ---------------------------------------------------------------------------

@method_decorator(csrf_exempt, name='dispatch')
class PortfolioListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)


# ---------------------------------------------------------------------------
# Transaction Views
# ---------------------------------------------------------------------------


class SubAccountListCreateView(generics.ListCreateAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SubAccount.objects.filter(portfolio__user=self.request.user).select_related('portfolio')

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        if not payload.get('portfolio'):
            fallback_portfolio = Portfolio.objects.filter(user=request.user).first()
            if fallback_portfolio:
                payload['portfolio'] = fallback_portfolio.id

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = self.request.user
        if not user.portfolios.exists():
            from rest_framework import serializers
            raise serializers.ValidationError('User must have at least one Portfolio')

        requested_portfolio_id = self.request.data.get('portfolio')
        if requested_portfolio_id:
            portfolio = generics.get_object_or_404(Portfolio, pk=requested_portfolio_id, user=user)
        else:
            portfolio = user.portfolios.first()

        serializer.save(portfolio=portfolio)


class SubAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SubAccountSerializer
    permission_classes = [IsAuthenticated]
    queryset = SubAccount.objects.select_related('portfolio')
    lookup_field = 'pk'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return SubAccount.objects.filter(portfolio__user=self.request.user)

@method_decorator(csrf_exempt, name='dispatch')
class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sub_account_id = self.kwargs['sub_account_id']
        return Transaction.objects.filter(
            sub_account_id=sub_account_id,
            sub_account__portfolio__user=self.request.user,
        ).order_by('-date')

    def perform_create(self, serializer):
        sub_account_id = self.kwargs['sub_account_id']
        sub_account = generics.get_object_or_404(
            SubAccount, pk=sub_account_id, portfolio__user=self.request.user
        )
        serializer.save(sub_account=sub_account)




class TransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(sub_account__portfolio__user=self.request.user)



# ---------------------------------------------------------------------------
# UserConfig Views
# ---------------------------------------------------------------------------

class UserConfigView(generics.RetrieveUpdateAPIView):
    """
    GET/PUT /api/portfolio/userconfig/ — Lấy/cập nhật config cá nhân.
    Tự động tạo nếu chưa có.
    """
    serializer_class = UserConfigSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_config, created = UserConfig.objects.get_or_create(
            user=self.request.user,
            defaults={
                'whale_alert_threshold': Decimal('500'),
                'theme': 'dark',
            },
        )
        if created:
            logger.info("Created UserConfig for user: %s", self.request.user.username)
        return user_config


# ---------------------------------------------------------------------------
# Analytics Views
# ---------------------------------------------------------------------------

class HoldingsView(APIView):
    """GET /api/portfolio/portfolios/{id}/holdings/ — Danh sách vị thế đang nắm giữ + P/L."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        df = compute_holdings(portfolio)
        holding_list = df.to_dict(orient='records') if not df.empty else []
        serializer = HoldingSerializer(holding_list, many=True)
        return Response(serializer.data)


class SummaryView(APIView):
    """GET /api/portfolio/portfolios/{id}/summary/ — Tổng quan tài sản."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        summary = build_summary(portfolio)
        serializer = SummarySerializer(summary)
        return Response(serializer.data)


class ChartDataView(APIView):
    """GET /api/portfolio/portfolios/{id}/chart/?days=90 — Dữ liệu biểu đồ tăng trưởng."""
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        try:
            days = int(request.query_params.get('days', 90))
            days = min(max(days, 7), 365)  # giới hạn 7–365 ngày
        except ValueError:
            days = 90

        df = compute_nav_series(portfolio, days=days)
        chart_data = df.to_dict(orient='records') if not df.empty else []
        serializer = ChartPointSerializer(chart_data, many=True)
        return Response(serializer.data)


class EquityCurveView(APIView):
    """
    GET /api/portfolio/portfolios/{id}/equity-curve/?days=180

    Trả về chuỗi NAV portfolio và VN-Index chuẩn hóa về % tăng trưởng từ ngày đầu.
    Response: {
      points: [{date, portfolio_pct, benchmark_pct}],
      has_benchmark: bool,
      period_days: int
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(Portfolio, pk=portfolio_id, user=request.user)
        try:
            days = int(request.query_params.get('days', 180))
            days = min(max(days, 7), 1825)
        except ValueError:
            days = 180

        import pandas as pd
        nav_df = compute_nav_series(portfolio, days=days)
        if nav_df.empty:
            return Response({'points': [], 'has_benchmark': False, 'period_days': days})

        nav_df['date'] = pd.to_datetime(nav_df['date'])
        nav_df = nav_df.sort_values('date')
        base_nav = float(nav_df.iloc[0]['value'])
        if base_nav == 0:
            return Response({'points': [], 'has_benchmark': False, 'period_days': days})

        nav_df['portfolio_pct'] = ((nav_df['value'].astype(float) / base_nav) - 1) * 100

        # Load VNINDEX từ DailyPrice
        start_date = nav_df['date'].iloc[0].date()
        end_date = nav_df['date'].iloc[-1].date()
        bench_qs = (
            DailyPrice.objects
            .filter(symbol='VNINDEX', date__gte=start_date, date__lte=end_date)
            .order_by('date')
            .values('date', 'close_price')
        )
        has_benchmark = bench_qs.exists()
        bench_map = {}
        if has_benchmark:
            bench_list = list(bench_qs)
            if bench_list:
                base_bench = float(bench_list[0]['close_price'])
                if base_bench > 0:
                    for row in bench_list:
                        bench_map[str(row['date'])] = round(
                            (float(row['close_price']) / base_bench - 1) * 100, 2
                        )

        points = []
        for _, row in nav_df.iterrows():
            date_str = str(row['date'].date())
            points.append({
                'date': date_str,
                'portfolio_pct': round(float(row['portfolio_pct']), 2),
                'benchmark_pct': bench_map.get(date_str),
            })

        return Response({
            'points': points,
            'has_benchmark': bool(bench_map),
            'period_days': days,
        })


@method_decorator(csrf_exempt, name='dispatch')
class SyncPricesView(APIView):
    """POST /api/portfolio/portfolios/{id}/sync/ — Kéo giá EOD mới nhất từ vnstock."""
    permission_classes = [IsAuthenticated]

    def post(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        try:
            days = int(request.data.get('days', 30))
            days = min(max(days, 1), 365)
        except (ValueError, TypeError):
            days = 30

        results = sync_portfolio_prices(portfolio.id, days=days)

        if not results:
            return Response(
                {'detail': 'Danh mục không có giao dịch nào để đồng bộ.'},
                status=status.HTTP_200_OK,
            )

        return Response({
            'synced': results,
            'total_symbols': len(results),
        }, status=status.HTTP_200_OK)


class AllocationView(APIView):
    """
    GET /api/portfolio/portfolios/{id}/allocation/        — Pie Chart theo mã CK
    GET /api/portfolio/portfolios/{id}/allocation/?by=sector — Pie Chart theo ngành
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        by = request.query_params.get('by', 'symbol')
        if by == 'sector':
            items = compute_allocation_by_sector(portfolio)
            hhi_score = round(sum(row['hhi_contribution'] for row in items), 2)
            return Response({'items': items, 'hhi_score': hhi_score})
        else:
            data = compute_allocation(portfolio)
        return Response(data)


class PortfolioAnalyticsView(APIView):
    """
    GET /api/portfolio/portfolios/{id}/analytics/?days=365

    Trả về risk metrics cho danh mục:
        sharpe_ratio, sortino_ratio, max_drawdown_pct, twr_pct,
        volatility_annual_pct, best_day_pct, worst_day_pct,
        total_trading_days, period_days
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, portfolio_id):
        portfolio = generics.get_object_or_404(
            Portfolio, pk=portfolio_id, user=request.user
        )
        days_raw = request.query_params.get('days', '365')
        try:
            days = int(days_raw)
            if days < 5 or days > 1825:  # 5 ngày → 5 năm
                raise ValueError
        except ValueError:
            return Response(
                {'detail': 'days phải là số nguyên trong khoảng [5, 1825].'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metrics = build_risk_metrics(portfolio, days=days)
        return Response(metrics)


# ---------------------------------------------------------------------------
# Securities Views
# ---------------------------------------------------------------------------

@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupListCreateView(APIView):
    """
    GET  /api/portfolio/Securities/groups/  — Tất cả nhóm Securities kèm giá.
    POST /api/portfolio/Securities/groups/  — Tạo nhóm mới.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        groups = SecuritiesGroup.objects.all().prefetch_related('items')

        all_symbols = list({
            item.symbol
            for group in groups
            for item in group.items.all()
        })
        price_map = get_price_changes(all_symbols)

        data = [_build_group_response(g, price_map) for g in groups]
        return Response(data)

    def post(self, request):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesGroupDetailView(APIView):
    """
    PATCH  /api/portfolio/Securities/groups/{id}/  — Cập nhật nhóm.
    DELETE /api/portfolio/Securities/groups/{id}/  — Xóa nhóm.
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, request, group_id):
        return generics.get_object_or_404(
            SecuritiesGroup, pk=group_id
        )

    def patch(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def delete(self, request, group_id):
        return Response(
            {'detail': 'Nhóm thị trường là taxonomy dùng chung và chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemCreateView(APIView):
    """POST /api/portfolio/Securities/groups/{id}/items/ — Thêm mã CK vào nhóm."""
    permission_classes = [IsAuthenticated]

    def post(self, request, group_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesItemDeleteView(APIView):
    """DELETE /api/portfolio/Securities/items/{id}/ — Xóa mã CK khỏi nhóm."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        return Response(
            {'detail': 'Mã trong nhóm thị trường chỉ được cập nhật qua admin sync.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@method_decorator(csrf_exempt, name='dispatch')
@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesSeedView(APIView):
    """
    POST /api/portfolio/Securities/seed/

    Tự động lấy toàn bộ nhóm ngành (25 nhóm ICB) + nhóm vốn hóa (VN30/VN100/HNX30)
    từ vnstock (VCI source) và tạo SecuritiesGroup + SecuritiesItem cho user hiện tại.

    Query params:
        ?mode=sectors   — chỉ tạo nhóm ngành
        ?mode=caps      — chỉ tạo nhóm vốn hóa
        ?mode=all       — tạo tất cả (mặc định)
        ?mode=manual    — dùng danh sách cứng (fallback khi vnstock lỗi)
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        mode = request.query_params.get('mode', 'all')
        result = sync_market_groups_for_user(request.user, requested_by=request.user, mode=mode)
        response_status = status.HTTP_200_OK if result['success'] and not result['warning'] else status.HTTP_207_MULTI_STATUS
        if not result['success']:
            response_status = status.HTTP_500_INTERNAL_SERVER_ERROR

        return Response(
            {
                'created': result.get('created', []),
                'updated': result.get('updated', []),
                'message': result['message'],
                'warning': result.get('warning'),
                'source': result.get('source'),
                'total_groups': result.get('total_groups', 0),
                'success': result['success'],
            },
            status=response_status,
        )


@method_decorator(csrf_exempt, name='dispatch')
class SecuritiesSyncView(APIView):
    """POST /api/portfolio/Securities/sync/ — Đồng bộ giá cho toàn bộ mã trong Securities."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            days = int(request.data.get('days', 5))
            days = min(max(days, 1), 30)
        except (ValueError, TypeError):
            days = 5

        # Đồng bộ giá cho toàn bộ mã trong SecuritiesGroup của user.
        all_symbols = list({
            item.symbol
            for group in SecuritiesGroup.objects.all().prefetch_related('items')
            for item in group.items.all()
        })
        if not all_symbols:
            return Response({'detail': 'Securities không có mã nào.'}, status=status.HTTP_200_OK)

        results = sync_watchlist_prices(request.user.id, days=days)
        return Response({
            'synced': results,
            'total_symbols': len(all_symbols),
        })


# ---------------------------------------------------------------------------
# Mã Theo dõi Views
# ---------------------------------------------------------------------------


def _parse_tracked_symbol_threshold_million(raw_value):
    if raw_value in (None, ''):
        return None
    try:
        resolved = float(raw_value)
    except (TypeError, ValueError):
        raise ValueError('Ngưỡng whale riêng phải là số >= 1 (triệu VNĐ).')
    if resolved < 1:
        raise ValueError('Ngưỡng whale riêng phải là số >= 1 (triệu VNĐ).')
    return Decimal(str(resolved))

class TrackedSymbolListCreateView(APIView):
    """
    GET  /api/portfolio/tracked-symbols/  — Danh sách Mã Theo dõi cá nhân kèm giá.
    POST /api/portfolio/tracked-symbols/  — Thêm mã. Body: {symbol, source_group_id (optional)}
    """
    permission_classes = [IsAuthenticated]

    def _enrich(self, ts):
        """Gắn giá thị trường vào một TrackedSymbol instance."""
        changes = get_price_changes([ts.symbol])
        info = changes.get(ts.symbol, {})
        grp = ts.source_group
        return {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
            'updated_at': ts.updated_at,
        }

    def get(self, request):
        tracked = (
            TrackedSymbol.objects
            .filter(user=request.user)
            .select_related('source_group')
        )
        # Lấy giá cho tất cả mã cùng lúc
        symbols = [t.symbol for t in tracked]
        changes = get_price_changes(symbols) if symbols else {}
        rows = []
        for ts in tracked:
            grp = ts.source_group
            info = changes.get(ts.symbol, {})
            rows.append({
                'id': ts.id,
                'symbol': ts.symbol,
                'source_group_id': grp.id if grp else None,
                'source_group_name': grp.name if grp else None,
                'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
                'current_price': info.get('current_price'),
                'prev_price': info.get('prev_price'),
                'change_value': info.get('change_value'),
                'change_pct': info.get('change_pct'),
                'last_date': info.get('last_date'),
                'added_at': ts.added_at,
                'updated_at': ts.updated_at,
            })
        serializer = TrackedSymbolSerializer(rows, many=True)
        return Response(serializer.data)

    def post(self, request):
        symbol = (request.data.get('symbol') or '').strip().upper()
        if not symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        source_group_id = request.data.get('source_group_id')
        source_group = None
        if source_group_id:
            try:
                source_group = SecuritiesGroup.objects.get(id=source_group_id)
            except SecuritiesGroup.DoesNotExist:
                pass

        ts, created = TrackedSymbol.objects.get_or_create(
            user=request.user,
            symbol=symbol,
            defaults={
                'source_group': source_group,
                'whale_alert_threshold_million': threshold_million,
            },
        )
        if not created:
            return Response({'detail': f'{symbol} đã có trong danh sách theo dõi.'}, status=status.HTTP_409_CONFLICT)

        # Cập nhật source_group nếu mới cung cấp
        update_fields = []
        if created and source_group and ts.source_group != source_group:
            ts.source_group = source_group
            update_fields.append('source_group')
        if threshold_million is not None and ts.whale_alert_threshold_million != threshold_million:
            ts.whale_alert_threshold_million = threshold_million
            update_fields.append('whale_alert_threshold_million')
        if update_fields:
            ts.save(update_fields=update_fields)

        grp = ts.source_group
        info = get_price_changes([symbol]).get(symbol, {})
        row = {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
            'updated_at': ts.updated_at,
        }
        return Response(TrackedSymbolSerializer(row).data, status=status.HTTP_201_CREATED)


class TrackedSymbolDeleteView(APIView):
    """
    DELETE /api/portfolio/tracked-symbols/<id>/ — Xóa mã khỏi danh sách Mã Theo dõi.
    """
    permission_classes = [IsAuthenticated]

    def _build_row(self, ts):
        grp = ts.source_group
        info = get_price_changes([ts.symbol]).get(ts.symbol, {})
        return {
            'id': ts.id,
            'symbol': ts.symbol,
            'source_group_id': grp.id if grp else None,
            'source_group_name': grp.name if grp else None,
            'whale_alert_threshold_million': float(ts.whale_alert_threshold_million) if ts.whale_alert_threshold_million is not None else None,
            'current_price': info.get('current_price'),
            'prev_price': info.get('prev_price'),
            'change_value': info.get('change_value'),
            'change_pct': info.get('change_pct'),
            'last_date': info.get('last_date'),
            'added_at': ts.added_at,
            'updated_at': ts.updated_at,
        }

    def patch(self, request, ts_id):
        try:
            ts = TrackedSymbol.objects.select_related('source_group').get(id=ts_id, user=request.user)
        except TrackedSymbol.DoesNotExist:
            return Response({'detail': 'Không tìm thấy mã.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = []

        if 'whale_alert_threshold_million' in request.data:
            try:
                threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
            except ValueError as exc:
                return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            if ts.whale_alert_threshold_million != threshold_million:
                ts.whale_alert_threshold_million = threshold_million
                update_fields.append('whale_alert_threshold_million')

        if 'source_group_id' in request.data:
            source_group_id = request.data.get('source_group_id')
            source_group = None
            if source_group_id not in (None, ''):
                try:
                    source_group = SecuritiesGroup.objects.get(id=source_group_id)
                except SecuritiesGroup.DoesNotExist:
                    return Response({'detail': 'Nhóm thị trường nguồn không tồn tại.'}, status=status.HTTP_400_BAD_REQUEST)
            if ts.source_group_id != (source_group.id if source_group else None):
                ts.source_group = source_group
                update_fields.append('source_group')

        if update_fields:
            if 'updated_at' not in update_fields:
                update_fields.append('updated_at')
            ts.save(update_fields=update_fields)

        return Response(TrackedSymbolSerializer(self._build_row(ts)).data)

    def delete(self, request, ts_id):
        try:
            ts = TrackedSymbol.objects.get(id=ts_id, user=request.user)
        except TrackedSymbol.DoesNotExist:
            return Response({'detail': 'Không tìm thấy mã.'}, status=status.HTTP_404_NOT_FOUND)
        ts.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class TrackedSymbolBulkThresholdView(APIView):
    """
    POST /api/stock-management/tracked-symbols/bulk-threshold/
    Body: {
      "tracked_symbol_ids": [1,2,3],
      "whale_alert_threshold_million": 750 | null
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tracked_symbol_ids = request.data.get('tracked_symbol_ids')
        if not isinstance(tracked_symbol_ids, list) or not tracked_symbol_ids:
            return Response(
                {'detail': 'tracked_symbol_ids phải là mảng id không rỗng.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized_ids = []
        for raw_id in tracked_symbol_ids:
            try:
                normalized_ids.append(int(raw_id))
            except (TypeError, ValueError):
                return Response({'detail': 'tracked_symbol_ids chứa giá trị không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold_million = _parse_tracked_symbol_threshold_million(request.data.get('whale_alert_threshold_million'))
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        queryset = TrackedSymbol.objects.filter(user=request.user, id__in=normalized_ids)
        found_ids = set(queryset.values_list('id', flat=True))
        requested_ids = set(normalized_ids)
        missing_ids = sorted(requested_ids - found_ids)
        if missing_ids:
            return Response(
                {'detail': 'Một số tracked symbol không tồn tại hoặc không thuộc user.', 'missing_ids': missing_ids},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now_ts = timezone.now()
        updated_count = queryset.update(
            whale_alert_threshold_million=threshold_million,
            updated_at=now_ts,
        )

        updated_rows = list(
            TrackedSymbol.objects
            .filter(user=request.user, id__in=found_ids)
            .select_related('source_group')
            .order_by('-added_at')
        )
        symbols = [row.symbol for row in updated_rows]
        changes = get_price_changes(symbols) if symbols else {}
        payload_rows = []
        for row in updated_rows:
            grp = row.source_group
            info = changes.get(row.symbol, {})
            payload_rows.append({
                'id': row.id,
                'symbol': row.symbol,
                'source_group_id': grp.id if grp else None,
                'source_group_name': grp.name if grp else None,
                'whale_alert_threshold_million': float(row.whale_alert_threshold_million) if row.whale_alert_threshold_million is not None else None,
                'current_price': info.get('current_price'),
                'prev_price': info.get('prev_price'),
                'change_value': info.get('change_value'),
                'change_pct': info.get('change_pct'),
                'last_date': info.get('last_date'),
                'added_at': row.added_at,
                'updated_at': row.updated_at,
            })

        return Response(
            {
                'updated_count': updated_count,
                'whale_alert_threshold_million': float(threshold_million) if threshold_million is not None else None,
                'applied_ids': sorted(found_ids),
                'rows': TrackedSymbolSerializer(payload_rows, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rules = list(PriceAlertRule.objects.filter(user=request.user).order_by('-created_at'))
        price_map = get_price_changes([rule.symbol for rule in rules])
        rows = [_build_price_alert_rule_row(rule, price_map) for rule in rules]
        return Response(PriceAlertRuleSerializer(rows, many=True).data)

    def post(self, request):
        serializer = PriceAlertRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rule, created = PriceAlertRule.objects.get_or_create(
            user=request.user,
            symbol=serializer.validated_data['symbol'],
            condition=serializer.validated_data['condition'],
            target_price=serializer.validated_data['target_price'],
            defaults={
                'cooldown_seconds': serializer.validated_data['cooldown_seconds'],
                'is_active': serializer.validated_data['is_active'],
            },
        )

        if not created:
            return Response(
                {'detail': 'Cảnh báo giá này đã tồn tại.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, rule_id):
        return generics.get_object_or_404(PriceAlertRule, id=rule_id, user=request.user)

    def patch(self, request, rule_id):
        rule = self.get_object(request, rule_id)
        serializer = PriceAlertRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data)

    def delete(self, request, rule_id):
        rule = self.get_object(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class PriceAlertRuleTriggerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, rule_id):
        rule = generics.get_object_or_404(PriceAlertRule, id=rule_id, user=request.user)
        rule.last_triggered_at = timezone.now()
        rule.save(update_fields=['last_triggered_at', 'updated_at'])
        price_map = get_price_changes([rule.symbol])
        row = _build_price_alert_rule_row(rule, price_map)
        return Response(PriceAlertRuleSerializer(row).data)


@method_decorator(csrf_exempt, name='dispatch')
class StockWorkspaceOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = StockProfile.objects.filter(symbol=normalized_symbol).first()
        if not profile:
            return Response({'detail': 'Không tìm thấy mã chứng khoán.'}, status=status.HTTP_404_NOT_FOUND)

        cache_key = f'overview:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            payload = _build_stock_workspace_overview(symbol, request.user)
        except Exception as exc:
            logger.exception('StockWorkspaceOverviewView base payload lỗi %s: %s', normalized_symbol, exc)
            payload = {
                'tracked_symbol_id': None,
                'symbol': profile.symbol,
                'company_name': profile.company_name or '',
                'industry': profile.industry or '',
                'exchange': profile.exchange or '',
                'listed_date': profile.listed_date,
                'is_active': profile.is_active,
                'updated_at': profile.updated_at,
                'current_price': None,
                'prev_price': None,
                'change_value': None,
                'change_pct': None,
                'last_date': None,
                'open_price': None,
                'high_price': None,
                'low_price': None,
                'close_price': None,
                'volume': None,
                'average_price': None,
                'reference_price': None,
                'ceiling_price': None,
                'floor_price': None,
                'week52_high': None,
                'week52_low': None,
                'is_tracked': False,
                'source_group_name': None,
                'market_groups': [],
                'watchlist_groups': [],
                'market_group_refs': [],
                'watchlist_memberships': [],
            }
        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
            if df is not None and not df.empty:
                ls = df['listing'].iloc[0]
                mt = df['match'].iloc[0]

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

                match_price = _f(mt.get('match_price'))
                ref_price = _f(ls.get('ref_price')) or _f(mt.get('reference_price'))
                ceil_price = _f(ls.get('ceiling')) or _f(mt.get('ceiling_price'))
                floor_price = _f(ls.get('floor')) or _f(mt.get('floor_price'))
                highest = _f(mt.get('highest'))
                lowest = _f(mt.get('lowest'))
                open_price = _f(mt.get('open_price'))
                accum_vol = _i(mt.get('accumulated_volume'))
                exchange_raw = str(ls.get('exchange') or '').strip()

                if match_price:
                    payload['current_price'] = match_price
                    payload['close_price'] = match_price
                if ref_price:
                    payload['reference_price'] = ref_price
                    payload['prev_price'] = ref_price
                if ceil_price:
                    payload['ceiling_price'] = ceil_price
                if floor_price:
                    payload['floor_price'] = floor_price
                if highest:
                    payload['high_price'] = highest
                if lowest:
                    payload['low_price'] = lowest
                if open_price:
                    payload['open_price'] = open_price
                if accum_vol and accum_vol > 0:
                    payload['volume'] = accum_vol
                if exchange_raw and not payload.get('exchange'):
                    payload['exchange'] = exchange_raw

                # Tính change từ giá thực
                if match_price and ref_price:
                    chg_val = round(match_price - ref_price, 2)
                    chg_pct = round((match_price - ref_price) / ref_price * 100, 2)
                    payload['change_value'] = chg_val
                    payload['change_pct'] = chg_pct

                # average_price: trung bình OHLC thực
                prices = [v for v in [open_price, highest, lowest, match_price] if v]
                if len(prices) >= 2:
                    payload['average_price'] = round(sum(prices) / len(prices), 2)

        except ExternalSystemException as exc:
            logger.warning('StockWorkspaceOverviewView vnstock overlay lỗi %s: %s', normalized_symbol, exc)
        except Exception as exc:
            logger.debug('StockWorkspaceOverviewView overlay parse lỗi %s: %s', normalized_symbol, exc)

        # 52W high/low thực từ vnstock history (1D, 365 ngày)
        try:
            from datetime import date as _date, timedelta as _timedelta
            _end = _date.today().strftime('%Y-%m-%d')
            _start = (_date.today() - _timedelta(days=365)).strftime('%Y-%m-%d')
            hist_df = fetch_history_dataframe(
                normalized_symbol,
                start=_start,
                end=_end,
                interval='1D',
                source='VCI',
            )
            if hist_df is not None and not hist_df.empty and 'high' in hist_df.columns:
                # Giữ nguyên đơn vị gốc từ vnstock (nghìn đồng)
                w52_high = round(float(hist_df['high'].max()), 2)
                w52_low = round(float(hist_df['low'].min()), 2)
                if w52_high > 0:
                    payload['week52_high'] = w52_high
                if w52_low > 0:
                    payload['week52_low'] = w52_low
        except ExternalSystemException as exc4:
            logger.debug('StockWorkspaceOverviewView 52W overlay lỗi %s: %s', normalized_symbol, exc4)
        except Exception as exc4:
            logger.debug('StockWorkspaceOverviewView 52W parse lỗi %s: %s', normalized_symbol, exc4)

        # Nếu company_name / exchange vẫn trống, thử lấy từ listing.all_symbols
        if not payload.get('company_name'):
            try:
                ls_df = fetch_listing_symbols_dataframe(symbol=normalized_symbol, source='VCI')
                if ls_df is not None and not ls_df.empty:
                    row = ls_df[ls_df['symbol'] == normalized_symbol]
                    if not row.empty:
                        name = str(row.iloc[0].get('organ_name') or '').strip()
                        if name:
                            payload['company_name'] = name
            except ExternalSystemException as exc3:
                logger.debug('StockWorkspaceOverviewView listing overlay lỗi %s: %s', normalized_symbol, exc3)
            except Exception as exc3:
                logger.debug('StockWorkspaceOverviewView listing parse lỗi %s: %s', normalized_symbol, exc3)

        serialized = StockWorkspaceOverviewSerializer(payload).data
        _cache_set(cache_key, serialized, timeout=12)
        return Response(serialized)


@method_decorator(csrf_exempt, name='dispatch')
class StockWorkspaceChartView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_chart'

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        generics.get_object_or_404(StockProfile, symbol=normalized_symbol)

        try:
            days = int(request.query_params.get('days', 180))
        except (TypeError, ValueError):
            days = 180

        days = min(max(days, 30), 365)
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        # --- 1. Redis cache ---
        cache_key = f'chart:{normalized_symbol}:{days}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        # --- 2. vnstock — dữ liệu thật (source KBS, interval 1D) ---
        series = None
        tech_rows = None

        def _fetch_vnstock():
            return fetch_history_dataframe(
                normalized_symbol,
                start=str(start_date),
                end=str(end_date),
                interval='1D',
                source='KBS',
            )

        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_fetch_vnstock)
                try:
                    df = future.result(timeout=8)
                except concurrent.futures.TimeoutError:
                    logger.warning('StockWorkspaceChartView vnstock timeout %s', normalized_symbol)
                    df = None
            if df is not None and not df.empty:
                series = []
                for _, row in df.iterrows():
                    try:
                        raw_time = row.get('time', row.get('date', ''))
                        d = raw_time.date() if hasattr(raw_time, 'date') else date.fromisoformat(str(raw_time)[:10])
                        series.append({
                            'date': str(d),
                            'open': float(row['open']) if row.get('open') is not None else None,
                            'high': float(row['high']) if row.get('high') is not None else None,
                            'low': float(row['low']) if row.get('low') is not None else None,
                            'close': float(row['close']),
                            'volume': float(row['volume']) if row.get('volume') is not None else None,
                        })
                    except (TypeError, ValueError, KeyError):
                        continue
                tech_rows = [{'close_price': s['close'], 'volume': s['volume']} for s in series]
        except (ExternalSystemException, Exception, SystemExit) as exc:
            logger.warning('StockWorkspaceChartView vnstock lỗi %s: %s', normalized_symbol, exc)

        # --- 3. Fallback DB ---
        if not series:
            db_rows = list(
                DailyPrice.objects
                .filter(symbol=normalized_symbol, date__range=(start_date, end_date))
                .order_by('date')
                .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')
            )
            series = [
                {
                    'date': str(row['date']),
                    'open': _to_float(row['open_price']),
                    'high': _to_float(row['high_price']),
                    'low': _to_float(row['low_price']),
                    'close': float(row['close_price']),
                    'volume': _to_float(row['volume']),
                }
                for row in db_rows
            ]
            tech_rows = db_rows  # DB rows already have close_price key

        overview = _build_stock_workspace_overview(normalized_symbol, request.user)
        payload = {
            'symbol': normalized_symbol,
            'days': days,
            'start_date': str(start_date),
            'end_date': str(end_date),
            'points': StockWorkspaceChartPointSerializer(series, many=True).data,
            'technical': StockWorkspaceTechnicalSerializer(
                _compute_stock_workspace_technical(tech_rows or [], overview)
            ).data,
        }

        result = StockWorkspaceChartResponseSerializer(payload).data
        _cache_set(cache_key, result, timeout=3600)
        return Response(result)

# --- StockProfile Views ---
from .models import StockProfile
from .serializers import StockProfileSerializer

class StockProfileDetailView(generics.RetrieveAPIView):
    queryset = StockProfile.objects.all()
    serializer_class = StockProfileSerializer
    lookup_field = 'symbol'
    permission_classes = []  # Public, hoặc thêm quyền nếu cần


# ---------------------------------------------------------------------------
# Admin Ops
# ---------------------------------------------------------------------------

class AdminOpsStatsView(APIView):
    """
    GET /api/admin-ops/stats/

    Trả về thống kê hệ thống để admin theo dõi: số user, danh mục,
    mã theo dõi, watchlist, lần sync cuối, trạng thái Redis/channel layer.
    Yêu cầu is_staff (IsAdminUser).
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        from django.conf import settings
        from config.health import build_prefetch_health_snapshot
        from portfolio.services import (
            get_latest_whale_config_anomaly_overview,
            get_whale_config_dashboard_overview,
            get_whale_config_propagation_overview,
        )

        # --- Counts ---
        user_count = User.objects.count()
        portfolio_count = Portfolio.objects.count()
        tracked_symbol_count = TrackedSymbol.objects.count()
        watchlist_item_count = WatchlistItem.objects.count()

        # --- Last sync logs ---
        last_mg_sync = MarketGroupSyncLog.objects.order_by('-started_at').first()
        last_sp_sync = StockProfileSyncLog.objects.order_by('-started_at').first()

        def _fmt_sync(log):
            if log is None:
                return None
            return {
                'started_at': log.started_at.isoformat() if log.started_at else None,
                'finished_at': log.finished_at.isoformat() if log.finished_at else None,
                'success': log.success,
                'mode': log.mode,
                'message': log.message,
            }

        # --- Redis / channel layer health ---
        channel_layer_type = getattr(settings, 'REALTIME_CHANNEL_LAYER', 'redis')
        realtime_enabled = getattr(settings, 'REALTIME_ENABLED', False)
        redis_ok = None
        if channel_layer_type != 'inmemory':
            try:
                redis_url = getattr(settings, 'REALTIME_REDIS_URL', 'redis://localhost:6379/0')
                client = redis_lib.from_url(redis_url, socket_connect_timeout=1)
                client.ping()
                redis_ok = True
            except Exception:
                redis_ok = False

        return Response({
            'user_count': user_count,
            'portfolio_count': portfolio_count,
            'tracked_symbol_count': tracked_symbol_count,
            'watchlist_item_count': watchlist_item_count,
            'last_market_group_sync': _fmt_sync(last_mg_sync),
            'last_stock_profile_sync': _fmt_sync(last_sp_sync),
            'channel_layer_type': channel_layer_type,
            'realtime_enabled': realtime_enabled,
            'redis_ok': redis_ok,
            'ticker_prefetch': build_prefetch_health_snapshot(),
            'whale_config_propagation': get_whale_config_propagation_overview(),
            'whale_config_anomaly': get_latest_whale_config_anomaly_overview(),
            'whale_config_dashboard': get_whale_config_dashboard_overview(),
        })


# ---------------------------------------------------------------------------
# WhaleAdvisory — Tư vấn AI từ OpenClaw
# ---------------------------------------------------------------------------
class WhaleAdvisoryListView(generics.ListAPIView):
    """
    GET /api/portfolio/whale-advisory/
    Pro+: trả về danh sách advisory (ẩn ai_detail nếu chưa Premium).
    """
    permission_classes = [IsAuthenticated, IsProPlan]
    serializer_class = WhaleAdvisorySerializer

    def get_queryset(self):
        # Return only user-owned advisories (no legacy fallback)
        # Legacy records with user=NULL should not appear in user-facing lists
        qs = (
            WhaleAdvisory.objects
            .filter(user=self.request.user)
            .order_by('-created_at')
        )

        refresh_status = str(self.request.query_params.get('refresh_status') or '').strip().lower()
        now = timezone.now()
        if refresh_status == 'ready':
            qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__lte=now)
        elif refresh_status == 'pending':
            qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__gt=now)
        elif refresh_status == 'recent':
            cutoff = now - timedelta(hours=4)
            qs = qs.filter(created_at__gte=cutoff)

        # ?watchlist_only=true: chỉ trả advisory cho mã trong TrackedSymbol của user
        watchlist_only = str(self.request.query_params.get('watchlist_only') or '').strip().lower()
        if watchlist_only == 'true':
            tracked_symbols = TrackedSymbol.objects.filter(user=self.request.user).values_list('symbol', flat=True)
            qs = qs.filter(symbol__in=tracked_symbols)

        return qs[:100]

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        plan = _get_plan(request.user)
        data = WhaleAdvisorySerializer(qs, many=True).data
        # Pro: ẩn ai_detail (chỉ Premium+ được xem)
        if plan not in ('premium', 'admin'):
            for item in data:
                item['ai_detail'] = ''
        return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_advisory_auto_refresh_info_api(request, symbol: str):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    tracked = TrackedSymbol.objects.filter(user=request.user, symbol=normalized_symbol).first()
    if tracked is None:
        return Response(
            {'ok': False, 'symbol': normalized_symbol, 'message': 'Symbol chưa nằm trong danh sách theo dõi.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    latest = WhaleAdvisory.objects.filter(user=request.user, symbol=normalized_symbol).order_by('-created_at').first()
    tokens_today = AdvisoryTokenLog.objects.filter(
        user=request.user,
        created_at__date=timezone.localdate(),
    ).aggregate(total=Sum('tokens_used'))['total'] or 0
    auto_refreshes_today = AdvisoryTokenLog.objects.filter(
        user=request.user,
        source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
        created_at__date=timezone.localdate(),
    ).count()

    response_payload = {
        'ok': True,
        'symbol': normalized_symbol,
        'tracked_since': tracked.added_at,
        'advisory_auto_generation_enabled': bool(user_cfg.advisory_auto_generation_enabled),
        'advisory_manual_refresh_enabled': bool(user_cfg.advisory_manual_refresh_enabled),
        'advisory_refresh_interval_hours': int(user_cfg.advisory_refresh_interval_hours or 24),
        'advisory_max_auto_refreshes_per_day': int(user_cfg.advisory_max_auto_refreshes_per_day or 0),
        'auto_refreshes_used_today': int(auto_refreshes_today),
        'auto_refreshes_remaining_today': max(int(user_cfg.advisory_max_auto_refreshes_per_day or 0) - int(auto_refreshes_today), 0),
        'daily_token_budget': int(user_cfg.advisory_max_tokens_per_day or 0),
        'tokens_used_today': int(tokens_today),
        'tokens_remaining_today': max(int(user_cfg.advisory_max_tokens_per_day or 0) - int(tokens_today), 0),
    }

    if latest is None:
        response_payload.update({
            'status': 'no_advisory',
            'advisory_id': None,
            'last_refreshed_at': None,
            'next_refresh_at': None,
            'refresh_count': 0,
            'is_stale': False,
            'is_auto_generated': False,
            'source': None,
        })
        return Response(response_payload, status=status.HTTP_200_OK)

    next_refresh_at = latest.next_refresh_at or (
        latest.created_at + timedelta(hours=max(int(user_cfg.advisory_refresh_interval_hours or 24), 1))
    )
    response_payload.update({
        'status': 'ready' if next_refresh_at <= timezone.now() else 'scheduled',
        'advisory_id': latest.id,
        'last_refreshed_at': latest.created_at,
        'next_refresh_at': next_refresh_at,
        'refresh_count': int(latest.refresh_count or 0),
        'is_stale': next_refresh_at <= timezone.now(),
        'is_auto_generated': bool(latest.is_auto_generated),
        'source': latest.source,
    })
    return Response(response_payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_whale_advisory_api(request, symbol: str):
    """
    POST /api/portfolio/whale-advisory/<symbol>/refresh/
    Làm mới advisory thủ công để tiết kiệm token: chỉ gọi khi user chủ động bấm Refresh.
    """
    from portfolio.tasks import generate_whale_advisory_task

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'queued': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    entitlements = resolve_user_entitlements(request.user)
    if not entitlements.get('can_read_whale_advisory', False):
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'reason': 'plan_upgrade_required',
                'message': 'Gói hiện tại chưa hỗ trợ Refresh AI Advisory. Vui lòng nâng cấp lên Pro để sử dụng tính năng này.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'whale_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'

    # Chặn spam refresh liên tiếp để tiết kiệm token cho user.
    last_refresh_ts = _cache_get(refresh_lock_key)
    if last_refresh_ts:
        retry_after = refresh_cooldown
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Bạn vừa refresh gần đây, vui lòng thử lại sau.',
                'retry_after_seconds': retry_after,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    latest = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    latest_symbol_side = (
        WhaleAdvisory.objects
        .filter(symbol=normalized_symbol)
        .exclude(side__iexact='UNKNOWN')
        .order_by('-created_at')
        .values_list('side', flat=True)
        .first()
    )

    regenerate_quota = consume_quota(
        request.user,
        quota_key='ai_regenerate_per_day',
        entitlements=entitlements,
    )
    if not regenerate_quota.get('allowed', True):
        return Response(
            build_quota_exceeded_payload(regenerate_quota, 'Ban da dung het quota refresh AI trong ngay.'),
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    matched_value_vnd = float(latest.matched_value) if latest else float(user_cfg.whale_alert_threshold or 500) * 1_000_000
    advisory_side = latest.side if latest else (str(latest_symbol_side or 'UNKNOWN').upper())
    advisory_threshold = float(latest.threshold or 0) if latest else float(user_cfg.whale_alert_threshold or 500) * 1_000_000

    task = generate_whale_advisory_task.apply_async(
        kwargs={
            'symbol': normalized_symbol,
            'matched_value_vnd': matched_value_vnd,
            'side': advisory_side,
            'threshold': advisory_threshold,
            'force_refresh': True,
            'user_id': request.user.id,
            'source': WhaleAdvisory.SourceChoices.USER_REFRESH,
        },
        countdown=0,
    )
    _cache_set(refresh_lock_key, timezone.now().isoformat(), timeout=refresh_cooldown)

    return Response(
        {
            'queued': True,
            'symbol': normalized_symbol,
            'task_id': task.id,
            'message': 'Đã nhận yêu cầu refresh advisory.' if latest else 'Đã nhận yêu cầu tạo advisory đầu tiên cho mã này.',
        },
        status=status.HTTP_202_ACCEPTED,
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
        'GET': 'api_calls_per_day',
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

    dark_flow = detect_dark_flow(normalized_symbol)
    cvd_series = compute_cvd_series(normalized_symbol, window_minutes=window_minutes, bucket_seconds=60)
    recent_signals = list(
        OrderFlowSignal.objects.filter(symbol=normalized_symbol)
        .order_by('-created_at')
        .values(
            'id', 'symbol', 'signal_type', 'strength', 'confidence', 'tick_rate',
            'small_order_ratio', 'cvd_at_signal', 'price_at_signal', 'created_at'
        )[:8]
    )
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
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_components_generate_api(request, symbol: str):
    from portfolio.order_flow import detect_dark_flow
    from portfolio.observability import record_ai_chart_context_observation

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_components_generate_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    latest = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    if latest is None:
        return Response({'ok': False, 'message': 'Chua co advisory goc de tao components.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_components_generate_api')
    if quota_response is not None:
        return quota_response

    timeframe = str(request.data.get('timeframe', '30m')).strip().lower()
    valid_timeframes = {choice for choice, _ in AIAdvisoryComponentRecord.TimeframeChoice.choices}
    if timeframe not in valid_timeframes:
        timeframe = '30m'

    chart_context = None
    chart_context_used = False
    chart_context_warnings = []
    raw_chart_context = request.data.get('chart_context')
    chart_context_payload_bytes = 0
    chart_context_ohlcv_points = 0
    if raw_chart_context is not None:
        try:
            chart_context_payload_bytes = len(json.dumps(raw_chart_context, ensure_ascii=False).encode('utf-8'))
        except Exception:
            chart_context_payload_bytes = 0
        context_serializer = StockAIChartContextSerializer(
            data=raw_chart_context,
            context={'symbol': normalized_symbol, 'max_ohlcv_points': 300},
        )
        if context_serializer.is_valid():
            chart_context = dict(context_serializer.validated_data)
            chart_context_used = True
            chart_context_ohlcv_points = len(chart_context.get('ohlcv') or [])
        else:
            chart_context_warnings.append('chart_context_invalid')

    logger.info(
        'stock_ai_advisory_components_generate telemetry symbol=%s chart_context_present=%s chart_context_used=%s chart_context_ohlcv_points=%s chart_context_payload_bytes=%s chart_context_warning_count=%s',
        normalized_symbol,
        raw_chart_context is not None,
        chart_context_used,
        chart_context_ohlcv_points,
        chart_context_payload_bytes,
        len(chart_context_warnings),
    )
    record_ai_chart_context_observation(
        present=raw_chart_context is not None,
        used=chart_context_used,
        warning_count=len(chart_context_warnings),
        ohlcv_points=chart_context_ohlcv_points,
        payload_bytes=chart_context_payload_bytes,
    )

    dark_flow = detect_dark_flow(normalized_symbol)
    templates = _sprint17_generate_component_templates_with_ai(
        user=request.user,
        symbol=normalized_symbol,
        latest_advisory=latest,
        dark_flow=dark_flow,
        timeframe=timeframe,
        chart_context=chart_context,
    )
    generated_by_ai = bool(templates)
    if not templates:
        templates = _sprint17_build_component_templates(normalized_symbol, latest, dark_flow, timeframe, chart_context=chart_context)
    created = [
        AIAdvisoryComponentRecord.objects.create(user=request.user, **payload)
        for payload in templates
    ]

    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_components_generate_api', status.HTTP_201_CREATED)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'created_count': len(created),
            'generated_by_ai': generated_by_ai,
            'chart_context_used': chart_context_used,
            'chart_context_warnings': chart_context_warnings,
            'components': AIAdvisoryComponentRecordSerializer(created, many=True).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_toggle_include_api(request, component_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_toggle_include_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_toggle_include_api')
    if quota_response is not None:
        return quota_response

    component.include_in_summary = not component.include_in_summary
    component.save(update_fields=['include_in_summary', 'updated_at'])
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_toggle_include_api', status.HTTP_200_OK)
    return Response({'ok': True, 'component': AIAdvisoryComponentRecordSerializer(component).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_refresh_api(request, component_id: int):
    from portfolio.order_flow import detect_dark_flow

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_refresh_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

    latest = WhaleAdvisory.objects.filter(symbol=component.symbol, user=request.user).order_by('-created_at').first()
    if latest is None:
        return Response({'ok': False, 'message': 'Chưa có advisory gốc để làm mới tab.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_refresh_api')
    if quota_response is not None:
        return quota_response

    timeframe = component.timeframe or AIAdvisoryComponentRecord.TimeframeChoice.M30
    dark_flow = detect_dark_flow(component.symbol)
    templates = _sprint17_generate_component_templates_with_ai(
        user=request.user,
        symbol=component.symbol,
        latest_advisory=latest,
        dark_flow=dark_flow,
        timeframe=timeframe,
    )
    generated_by_ai = bool(templates)
    if not templates:
        templates = _sprint17_build_component_templates(component.symbol, latest, dark_flow, timeframe)

    refreshed_payload = next((item for item in templates if item.get('component_type') == component.component_type), None)
    if refreshed_payload is None and templates:
        refreshed_payload = templates[0]
    if refreshed_payload is None:
        return Response({'ok': False, 'message': 'Không tạo được dữ liệu làm mới cho tab này.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    component.indicator_name = refreshed_payload.get('indicator_name') or component.indicator_name
    component.status = refreshed_payload.get('status') or component.status
    component.confidence_score = int(refreshed_payload.get('confidence_score') or component.confidence_score or 5)
    component.suggested_action = refreshed_payload.get('suggested_action') or component.suggested_action
    component.rationale_text = refreshed_payload.get('rationale_text') or component.rationale_text
    component.timeframe = refreshed_payload.get('timeframe') or component.timeframe
    component.save(update_fields=['indicator_name', 'status', 'confidence_score', 'suggested_action', 'rationale_text', 'timeframe', 'updated_at'])

    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_refresh_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'generated_by_ai': generated_by_ai,
            'component': AIAdvisoryComponentRecordSerializer(component).data,
            'message': 'Đã làm mới tab AI đang chọn.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_delete_api(request, component_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_delete_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_delete_api')
    if quota_response is not None:
        return quota_response

    component.is_deleted = True
    component.include_in_summary = False
    component.save(update_fields=['is_deleted', 'include_in_summary', 'updated_at'])
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_delete_api', status.HTTP_200_OK)
    return Response({'ok': True, 'message': 'Da xoa component (soft delete).'}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_clear_deleted_api(request, symbol: str):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_clear_deleted_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_clear_deleted_api')
    if quota_response is not None:
        return quota_response

    deleted_qs = AIAdvisoryComponentRecord.objects.filter(
        user=request.user,
        symbol=normalized_symbol,
        is_deleted=True,
    )
    deleted_count = deleted_qs.count()
    deleted_qs.delete()

    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_clear_deleted_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'deleted_count': deleted_count,
            'message': 'Da xoa toan bo deleted tabs.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_restore_api(request, component_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_restore_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=True).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai hoac chua bi xoa.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_restore_api')
    if quota_response is not None:
        return quota_response

    component.is_deleted = False
    component.include_in_summary = True
    component.save(update_fields=['is_deleted', 'include_in_summary', 'updated_at'])
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_restore_api', status.HTTP_200_OK)
    return Response({'ok': True, 'component': AIAdvisoryComponentRecordSerializer(component).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_summary_regenerate_api(request, symbol: str):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_summary_regenerate_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    def _tracked_response(payload: dict, response_status: int):
        _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_summary_regenerate_api', response_status)
        return Response(payload, status=response_status)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return _tracked_response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status.HTTP_409_CONFLICT,
        )

    cooldown = max(int(getattr(settings, 'AI_ADVISORY_SUMMARY_REGEN_COOLDOWN_SECONDS', 30)), 5)
    lock_key = f'ai_advisory_summary_regen:{request.user.id}:{normalized_symbol}'
    if _cache_get(lock_key):
        return _tracked_response(
            {
                'ok': False,
                'message': 'Ban vua regenerate gan day, vui long thu lai sau.',
                'retry_after_seconds': cooldown,
            },
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    component_ids = request.data.get('component_ids')
    synthesis_preference = str(request.data.get('synthesis_preference') or 'balanced').strip().lower()
    if synthesis_preference not in {'short_term_action', 'risk_management', 'balanced'}:
        synthesis_preference = 'balanced'

    qs = AIAdvisoryComponentRecord.objects.filter(
        user=request.user,
        symbol=normalized_symbol,
        is_deleted=False,
        include_in_summary=True,
    )
    if isinstance(component_ids, list) and component_ids:
        qs = qs.filter(id__in=component_ids)

    components = list(qs.order_by('-created_at'))
    if not components:
        return _tracked_response({'ok': False, 'message': 'Khong co component active de tong hop.'}, status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_summary_regenerate_api')
    if quota_response is not None:
        return quota_response

    latest = AIAdvisoryExecutiveSummary.objects.filter(user=request.user, symbol=normalized_symbol).order_by('-summary_version').first()
    summary_payload = _sprint17_compute_summary_from_components(components)
    ai_synthesis_text = _sprint17_generate_executive_synthesis_with_ai(
        user=request.user,
        symbol=normalized_symbol,
        components=components,
        summary_payload=summary_payload,
        synthesis_preference=synthesis_preference,
    )
    if ai_synthesis_text:
        summary_payload['synthesis_text'] = ai_synthesis_text
    summary = AIAdvisoryExecutiveSummary.objects.create(
        user=request.user,
        symbol=normalized_symbol,
        summary_version=(latest.summary_version + 1) if latest else 1,
        **summary_payload,
    )
    _cache_set(lock_key, timezone.now().isoformat(), timeout=cooldown)

    return _tracked_response({'ok': True, 'executive_summary': AIAdvisoryExecutiveSummarySerializer(summary).data}, status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_summary_delete_api(request, symbol: str, summary_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_summary_delete_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_summary_delete_api')
    if quota_response is not None:
        return quota_response

    summary = AIAdvisoryExecutiveSummary.objects.filter(
        id=summary_id,
        user=request.user,
        symbol=normalized_symbol,
    ).first()
    if summary is None:
        return Response({'ok': False, 'message': 'Thong tin tong hop khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    summary.delete()
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_summary_delete_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'summary_id': summary_id,
            'message': 'Da xoa thong tin tong hop.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_session_api(request, symbol: str):
    """
    GET/POST /api/stock-management/stocks/<symbol>/ai-advisory-session/
    - GET: trả advisory mới nhất; nếu chưa có thì tự queue tạo advisory.
    - POST: refresh thủ công advisory cho mã hiện tại.
    """
    from portfolio.tasks import generate_whale_advisory_task

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_session_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_session_api')
    if quota_response is not None:
        return quota_response

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    threshold_m = float(user_cfg.whale_alert_threshold or 500)
    threshold_vnd = threshold_m * 1_000_000

    def _should_use_sync_fallback() -> bool:
        if not bool(getattr(settings, 'DEBUG', False)):
            return False
        try:
            host = str(request.get_host() or '').lower()
        except Exception:
            host = ''
        # Giữ hành vi async trong test suite để tránh làm flaky unit tests.
        return 'testserver' not in host

    def _queue_or_run(payload_kwargs: dict) -> dict:
        if _should_use_sync_fallback():
            try:
                from celery import current_app
                worker_responses = current_app.control.inspect(timeout=0.6).ping() or {}
            except Exception:
                worker_responses = {}

            if not worker_responses:
                try:
                    result = generate_whale_advisory_task.run(**payload_kwargs)
                    return {'queued': False, 'task_id': None, 'sync': True, 'result': result}
                except Exception as exc:
                    logger.warning('stock_ai_advisory_session_api sync fallback failed %s: %s', normalized_symbol, exc)

        try:
            task = generate_whale_advisory_task.apply_async(kwargs=payload_kwargs, countdown=0)
            return {'queued': True, 'task_id': task.id, 'sync': False}
        except Exception as exc:
            logger.error('stock_ai_advisory_session_api queue failed %s: %s', normalized_symbol, exc)
            return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': str(exc)}

    def _serialize_latest(latest_advisory):
        if latest_advisory is None:
            return None
        data = WhaleAdvisorySerializer(latest_advisory).data
        if _get_plan(request.user) not in ('premium', 'admin'):
            data['ai_detail'] = ''
        return data

    def _build_session_payload(latest_advisory):
        payload = _sprint17_serialize_stock_advisory_session(request.user, normalized_symbol, latest_advisory)
        advisory_data = payload.get('advisory')
        if advisory_data and _get_plan(request.user) not in ('premium', 'admin'):
            advisory_data['ai_detail'] = ''
        payload['user_ai_provider'] = str(user_cfg.ai_provider or 'openclaw').strip().lower()
        payload['effective_ai_provider'] = ai_status.get('provider')
        payload['effective_ai_model'] = ai_status.get('model')
        payload['effective_ai_source'] = ai_status.get('source')
        return payload

    def _tracked_response(payload: dict, response_status: int):
        _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_session_api', response_status)
        return Response(payload, status=response_status)

    latest = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    ai_status = _get_ai_runtime_config_status(user_cfg)

    if request.method == 'GET':
        if latest is not None:
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    **_build_session_payload(latest),
                },
                status.HTTP_200_OK,
            )

        auto_cooldown = max(int(getattr(settings, 'STOCK_AI_ADVISORY_AUTOGEN_COOLDOWN_SECONDS', 45)), 10)
        auto_lock_key = f'stock_ai_advisory_autogen_lock:{request.user.id}:{normalized_symbol}'
        if not ai_status['ready']:
            return _tracked_response(
                {
                    'ok': False,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'components_count': 0,
                    'active_components_count': 0,
                    'message': ai_status['message'],
                    'reason': 'ai_not_configured',
                    'config_issue': ai_status['reason'],
                },
                status.HTTP_409_CONFLICT,
            )
        if _cache_get(auto_lock_key):
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'message': 'Đang chờ advisory AI được tạo, vui lòng tải lại sau ít giây.',
                },
                status.HTTP_202_ACCEPTED,
            )

        payload_kwargs = {
            'symbol': normalized_symbol,
            'matched_value_vnd': threshold_vnd,
            'side': 'UNKNOWN',
            'threshold': threshold_vnd,
            'force_refresh': False,
            'user_id': request.user.id,
        }
        submit_result = _queue_or_run(payload_kwargs)
        if submit_result.get('queue_error'):
            return _tracked_response(
                {
                    'ok': False,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'components_count': 0,
                    'active_components_count': 0,
                    'message': 'Khong the tao advisory luc nay (queue service tam thoi khong san sang). Vui long thu lai sau.',
                },
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        _cache_set(auto_lock_key, timezone.now().isoformat(), timeout=auto_cooldown)

        latest_after_submit = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
        if submit_result.get('sync') and latest_after_submit is not None:
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    **_build_session_payload(latest_after_submit),
                    'message': 'Đã tạo AI Advisory trực tiếp trong phiên hiện tại.',
                },
                status.HTTP_200_OK,
            )

        return _tracked_response(
            {
                'ok': True,
                'queued': bool(submit_result.get('queued')),
                'symbol': normalized_symbol,
                'task_id': submit_result.get('task_id'),
                'advisory': None,
                'components': [],
                'executive_summary': None,
                'components_count': 0,
                'active_components_count': 0,
                'message': 'Đã gửi yêu cầu tạo AI Advisory cho mã này.' if submit_result.get('queued') else 'Đang xử lý AI Advisory trực tiếp.',
            },
            status.HTTP_202_ACCEPTED,
        )

    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'stock_ai_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'
    if not ai_status['ready']:
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                **_build_session_payload(latest),
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status.HTTP_409_CONFLICT,
        )
    if _cache_get(refresh_lock_key):
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Bạn vừa refresh gần đây, vui lòng thử lại sau.',
                'retry_after_seconds': refresh_cooldown,
            },
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    matched_value_vnd = float(latest.matched_value) if latest else threshold_vnd
    advisory_side = latest.side if latest else 'UNKNOWN'
    advisory_threshold = float(latest.threshold or 0) if latest else threshold_vnd
    payload_kwargs = {
        'symbol': normalized_symbol,
        'matched_value_vnd': matched_value_vnd,
        'side': advisory_side,
        'threshold': advisory_threshold,
        'force_refresh': True,
        'user_id': request.user.id,
        'source': WhaleAdvisory.SourceChoices.USER_REFRESH,
    }
    submit_result = _queue_or_run(payload_kwargs)
    if submit_result.get('queue_error'):
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                **_build_session_payload(latest),
                'message': 'Khong the refresh advisory luc nay (queue service tam thoi khong san sang). Vui long thu lai sau.',
            },
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    _cache_set(refresh_lock_key, timezone.now().isoformat(), timeout=refresh_cooldown)

    latest_after_refresh = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    if submit_result.get('sync') and latest_after_refresh is not None:
        return _tracked_response(
            {
                'ok': True,
                'queued': False,
                'symbol': normalized_symbol,
                'task_id': None,
                **_build_session_payload(latest_after_refresh),
                'message': 'Đã refresh AI Advisory trực tiếp trong phiên hiện tại.',
            },
            status.HTTP_200_OK,
        )

    return _tracked_response(
        {
            'ok': True,
            'queued': bool(submit_result.get('queued')),
            'symbol': normalized_symbol,
            'task_id': submit_result.get('task_id'),
            **_build_session_payload(latest),
            'message': 'Đã gửi yêu cầu refresh AI Advisory cho mã này.' if submit_result.get('queued') else 'Đang refresh AI Advisory trực tiếp.',
        },
        status.HTTP_202_ACCEPTED,
    )


# ---------------------------------------------------------------------------
# Screener — CRUD + Evaluator
# ---------------------------------------------------------------------------
from .models import ScreenerRule
from .serializers import ScreenerRuleSerializer


class ScreenerRuleListCreateView(APIView):
    """
    GET  /api/portfolio/screener/rules/    — danh sách rule của user
    POST /api/portfolio/screener/rules/    — tạo rule mới
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rules = ScreenerRule.objects.filter(user=request.user)
        return Response(ScreenerRuleSerializer(rules, many=True).data)

    def post(self, request):
        serializer = ScreenerRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        ok, err = _validate_screener_rules(serializer.validated_data.get('rules_json', []))
        if not ok:
            return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save(user=request.user)
        return Response(ScreenerRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class ScreenerRuleDetailView(APIView):
    """
    GET    /api/portfolio/screener/rules/{id}/
    PUT    /api/portfolio/screener/rules/{id}/
    DELETE /api/portfolio/screener/rules/{id}/
    """
    permission_classes = [IsAuthenticated]

    def _get_rule(self, request, rule_id):
        return generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)

    def get(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        return Response(ScreenerRuleSerializer(rule).data)

    def put(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        serializer = ScreenerRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        if 'rules_json' in serializer.validated_data:
            ok, err = _validate_screener_rules(serializer.validated_data['rules_json'])
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save()
        return Response(ScreenerRuleSerializer(rule).data)

    def delete(self, request, rule_id):
        rule = self._get_rule(request, rule_id)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScreenerRuleRunView(APIView):
    """
    POST /api/portfolio/screener/rules/{id}/run/

    Chạy screener rule trên toàn bộ DailyPrice hiện có.
    Trả về danh sách mã khớp kèm giá + technical snapshot.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, rule_id):
        rule = generics.get_object_or_404(ScreenerRule, pk=rule_id, user=request.user)
        conditions = rule.rules_json  # list[{field, op, value}]

        # Lấy danh sách symbol có dữ liệu giá gần nhất
        from django.db.models import Max
        latest_dates = (
            DailyPrice.objects
            .values('symbol')
            .annotate(latest=Max('date'))
        )
        symbol_date_map = {row['symbol']: row['latest'] for row in latest_dates}

        if not symbol_date_map:
            return Response({'matched': [], 'total_scanned': 0, 'rule_id': rule.id})

        # Batch load tất cả DailyPrice mới nhất (1 query)
        from django.db.models import Q
        filter_q = Q()
        for sym, dt in symbol_date_map.items():
            filter_q |= Q(symbol=sym, date=dt)

        # Nếu quá nhiều symbols, chunk để tránh quá large query
        all_symbols = list(symbol_date_map.keys())
        CHUNK = 500
        rows = []
        for i in range(0, len(all_symbols), CHUNK):
            chunk_syms = all_symbols[i:i + CHUNK]
            chunk_q = Q()
            for sym in chunk_syms:
                chunk_q |= Q(symbol=sym, date=symbol_date_map[sym])
            rows.extend(
                DailyPrice.objects.filter(chunk_q).values(
                    'symbol', 'close_price', 'volume', 'open_price', 'high_price', 'low_price', 'date'
                )
            )

        # Tính technical fields cần thiết (dùng _compute_rsi + SMA từ lịch sử gần đây)
        # Lấy 60 ngày gần nhất để tính SMA50 đủ điểm
        from datetime import timedelta
        required_fields = {cond['field'] for cond in conditions}
        needs_history = required_fields & {'rsi_14', 'sma20', 'sma50', 'momentum_20d_pct',
                                           'price_vs_sma20_pct', 'price_vs_sma50_pct',
                                           'range_position_pct', 'avg_volume_20',
                                           'macd_hist', 'volume_rvol', 'sma20_vs_sma50_pct'}

        history_map = {}  # symbol -> list of (close, volume) sorted by date asc
        if needs_history:
            from datetime import date as date_cls
            cutoff = date_cls.today() - timedelta(days=70)
            hist_qs = (
                DailyPrice.objects
                .filter(symbol__in=all_symbols, date__gte=cutoff)
                .values('symbol', 'date', 'close_price', 'volume', 'high_price', 'low_price')
                .order_by('symbol', 'date')
            )
            for row in hist_qs:
                sym = row['symbol']
                if sym not in history_map:
                    history_map[sym] = []
                history_map[sym].append(row)

        matched = []
        total_scanned = len(rows)
        for row in rows:
            sym = row['symbol']
            tech = _screener_build_technical(sym, row, history_map)
            # Áp dụng tất cả conditions (AND logic)
            if all(_apply_screener_condition(tech.get(c['field']), c['op'], c['value']) for c in conditions):
                matched.append({
                    'symbol': sym,
                    'date': str(row['date']),
                    **tech,
                })

        matched.sort(key=lambda x: x.get('close') or 0, reverse=True)

        return Response({
            'rule_id': rule.id,
            'rule_name': rule.name,
            'total_scanned': total_scanned,
            'matched_count': len(matched),
            'matched': matched,
        })

