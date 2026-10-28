import logging
import time
from datetime import timedelta

from django.core.cache import cache
from django.db.models import (
    Case,
    Count,
    DecimalField,
    IntegerField,
    Max,
    Q,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from django.utils import timezone
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

# Đặt TRƯỚC `logger = ...` để không cộng thêm E402 (các import dưới đây đã nằm
# sau `logger` từ trước B5 và ruff đã báo E402 cho chúng — không nhân thêm lỗi
# của chính dòng mình thêm vào).
from vninvest_core.api_envelope import envelope_response

from .envelope import envelope

logger = logging.getLogger(__name__)


class SignalRateThrottle(UserRateThrottle):
    scope = 'signals'


def _alert_scope_cache_key(prefix, user, params, lane, extra=''):
    return 'alert-center:%s:%s:%s:%s:%s:%s:%s:%s:%s' % (
        prefix,
        getattr(user, 'pk', 'anon'),
        lane,
        params.get('symbol') or '',
        params.get('severity') or '',
        params.get('alert_family') or '',
        params.get('timeframe') or '',
        params.get('session_date') or '',
        extra,
    )

from vninvest_core.pagination import AlertCursorPagination, OrderFlowCursorPagination


def _type_priority_annotation():
    """CASE expression: whale=0, dark_flow=1, ai_alert=2, ai_suggest=3, signal=4, system=5, other=6."""
    return Case(
        When(alert_type=UnifiedAlert.AlertTypeChoices.WHALE, then=Value(0)),
        When(alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW, then=Value(1)),
        When(alert_type=UnifiedAlert.AlertTypeChoices.AI_ALERT, then=Value(2)),
        When(alert_type=UnifiedAlert.AlertTypeChoices.AI_SUGGEST, then=Value(3)),
        When(alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL, then=Value(4)),
        When(alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM, then=Value(5)),
        default=Value(6),
        output_field=IntegerField(),
    )


class AlertCenterFeedCursorPagination(AlertCursorPagination):
    """Cursor pagination for alert center feed ordered by recency (matches default queryset)."""
    ordering = ('-triggered_at', '-pk')

    def get_ordering(self, request, queryset, view=None):
        # DRF cursor pagination tự order_by lại queryset nên phải đọc ?order= ở đây,
        # khớp với annotation type_priority mà AlertCenterFeedView gắn ở mode priority.
        order = (request.query_params.get('order') or 'recent').strip().lower()
        if order == 'priority':
            return ('type_priority', '-triggered_at', '-pk')
        return super().get_ordering(request, queryset, view)

from vninvest_core.exceptions import NotFoundErrorException, ValidationErrorException

from . import delivery_service
from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from .serializers import OrderFlowEventSerializer, UnifiedAlertSerializer
from .sse import (
    AlertCenterStreamEventRenderer,
    AlertCenterStreamingHttpResponse,
    sse_format,
)


class CursorPaginatedUnifiedAlertResponseSerializer(serializers.Serializer):
    next = serializers.CharField(required=False, allow_null=True)
    previous = serializers.CharField(required=False, allow_null=True)
    results = UnifiedAlertSerializer(many=True)


class CursorPaginatedOrderFlowEventResponseSerializer(serializers.Serializer):
    next = serializers.CharField(required=False, allow_null=True)
    previous = serializers.CharField(required=False, allow_null=True)
    results = OrderFlowEventSerializer(many=True)


class WhaleFeedAggregateSummarySerializer(serializers.Serializer):
    buy_value = serializers.FloatField()
    sell_value = serializers.FloatField()


class WhaleFeedAggregateItemSerializer(serializers.Serializer):
    ts = serializers.CharField()
    price = serializers.FloatField()
    volume = serializers.IntegerField()
    matched_value = serializers.FloatField()
    side = serializers.CharField()
    size_class = serializers.CharField()


class WhaleFeedAggregateResponseSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    whale_orders = WhaleFeedAggregateItemSerializer(many=True)
    summary = WhaleFeedAggregateSummarySerializer()


_WHALE_SIDE_MAP = {'B': 'BUY', 'S': 'SELL', 'BUY': 'BUY', 'SELL': 'SELL'}


class AlertCenterSummaryResponseSerializer(serializers.Serializer):
    lane = serializers.CharField()
    total = serializers.IntegerField()
    unseen = serializers.IntegerField()
    by_severity = serializers.DictField(child=serializers.IntegerField())
    generated_at = serializers.DateTimeField()


class SymbolStatsItemSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    count = serializers.IntegerField()
    buy_count = serializers.IntegerField()
    sell_count = serializers.IntegerField()
    neutral_count = serializers.IntegerField()
    total_value = serializers.DecimalField(max_digits=24, decimal_places=2)
    latest_triggered_at = serializers.DateTimeField(allow_null=True)
    by_severity = serializers.DictField(child=serializers.IntegerField())


class AlertCenterSymbolStatsResponseSerializer(serializers.Serializer):
    lane = serializers.CharField()
    total_alerts_in_scope = serializers.IntegerField()
    symbols = SymbolStatsItemSerializer(many=True)
    pagination = serializers.DictField(child=serializers.IntegerField())
    generated_at = serializers.DateTimeField()


class AlertCenterSymbolContextSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    lane = serializers.CharField()
    total = serializers.IntegerField()
    unseen = serializers.IntegerField()
    in_delivery_scope = serializers.BooleanField()
    recent_events = UnifiedAlertSerializer(many=True)


class UserAlertDeliveryStateSerializer(serializers.Serializer):
    delivery_id = serializers.UUIDField()
    alert_id = serializers.UUIDField(source='alert.alert_id')
    delivery_state = serializers.CharField()
    delivered_at = serializers.DateTimeField()
    seen_at = serializers.DateTimeField(allow_null=True)
    acknowledged_at = serializers.DateTimeField(allow_null=True)
    suppression_reason = serializers.CharField()


class AlertCenterMutePreferenceRequestSerializer(serializers.Serializer):
    symbol = serializers.CharField(required=False, allow_blank=True)
    alert_family = serializers.CharField(required=False, allow_blank=True)
    mute_minutes = serializers.IntegerField(required=False, min_value=0)
    cooldown_seconds = serializers.IntegerField(required=False, min_value=0)
    metadata = serializers.DictField(required=False)

    def validate(self, attrs):
        symbol = (attrs.get('symbol') or '').strip().upper()
        alert_family = (attrs.get('alert_family') or '').strip().lower()
        mute_minutes = int(attrs.get('mute_minutes') or 0)
        cooldown_seconds = int(attrs.get('cooldown_seconds') or 0)
        if not symbol and not alert_family:
            raise ValidationError('Cần cung cấp symbol hoặc alert_family cho phạm vi mute.')
        if mute_minutes <= 0 and cooldown_seconds <= 0:
            raise ValidationError('Cần cung cấp mute_minutes hoặc cooldown_seconds lớn hơn 0.')
        attrs['symbol'] = symbol
        attrs['alert_family'] = alert_family
        return attrs


def _apply_common_alert_filters(qs, params, *, lane: str):
    symbol = params.get('symbol')
    alert_type = params.get('alert_type')
    alert_family = params.get('alert_family')
    severity = params.get('severity')
    session_date = params.get('session_date')
    timeframe = str(params.get('timeframe') or '').strip().lower()
    main_lane_types = {
        UnifiedAlert.AlertTypeChoices.WHALE,
        UnifiedAlert.AlertTypeChoices.DARK_FLOW,
        UnifiedAlert.AlertTypeChoices.SIGNAL,
        UnifiedAlert.AlertTypeChoices.SYSTEM,
    }
    normalized_lane = (lane or 'main').strip().lower()
    if normalized_lane == 'main':
        qs = qs.filter(alert_type__in=main_lane_types)
    elif normalized_lane == 'ai':
        qs = qs.exclude(alert_type__in=main_lane_types)
    if symbol:
        qs = qs.filter(symbol=symbol.upper())
    if alert_type:
        qs = qs.filter(alert_type=alert_type)
    if alert_family:
        parts = [p.strip().lower() for p in str(alert_family).split(',') if p.strip()]
        if parts:
            q_or = Q()
            for val in parts:
                if val == 'price_shock':
                    q_or |= Q(alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL) & Q(source_ref__startswith='market_anomaly:')
                elif val == 'stale_quote':
                    q_or |= (Q(alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM) & (Q(source_ref__startswith='stale_quote:') | Q(freshness_state='stale')))
                else:
                    q_or |= Q(alert_type=val)
            qs = qs.filter(q_or)

    if severity:
        parts = [p.strip().lower() for p in str(severity).split(',') if p.strip()]
        if len(parts) == 1:
            qs = qs.filter(severity=parts[0])
        elif len(parts) > 1:
            qs = qs.filter(severity__in=parts)
    if session_date:
        qs = qs.filter(session_date=session_date)

    if timeframe:
        now = timezone.now()
        timeframe_cutoffs = {
            '5m': now - timedelta(minutes=5),
            '15m': now - timedelta(minutes=15),
            '1h': now - timedelta(hours=1),
            '5d': now - timedelta(days=5),
        }
        cutoff = timeframe_cutoffs.get(timeframe)
        if cutoff is not None:
            qs = qs.filter(triggered_at__gte=cutoff)
        elif timeframe == 'session' and not session_date:
            latest_session_date = qs.order_by('-session_date').values_list('session_date', flat=True).first()
            if latest_session_date is not None:
                qs = qs.filter(session_date=latest_session_date)
    return qs


def _build_summary_payload(qs, *, lane: str, user=None) -> dict:
    aggregate = qs.aggregate(
        total=Count('id', distinct=True),
        unseen=Count(
            'id',
            filter=Q(deliveries__delivery_state='new', deliveries__user=user) if user is not None else Q(),
            distinct=True,
        ),
        critical=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.CRITICAL), distinct=True),
        high=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.HIGH), distinct=True),
        medium=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.MEDIUM), distinct=True),
        low=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.LOW), distinct=True),
    )
    return {
        'lane': lane,
        'total': aggregate.get('total') or 0,
        'unseen': aggregate.get('unseen') or 0,
        'by_severity': {
            'critical': aggregate.get('critical') or 0,
            'high': aggregate.get('high') or 0,
            'medium': aggregate.get('medium') or 0,
            'low': aggregate.get('low') or 0,
        },
        'generated_at': timezone.now(),
    }


def _build_symbol_stats_payload(qs, *, lane: str, page: int, page_size: int) -> dict:
    safe_page = max(page, 1)
    safe_page_size = max(min(page_size, 200), 1)

    grouped_qs = (
        qs.values('symbol')
        .annotate(
            count=Count('id', distinct=True),
            buy_count=Count('id', filter=Q(direction=UnifiedAlert.DirectionChoices.BUY), distinct=True),
            sell_count=Count('id', filter=Q(direction=UnifiedAlert.DirectionChoices.SELL), distinct=True),
            neutral_count=Count(
                'id',
                filter=Q(direction=UnifiedAlert.DirectionChoices.NEUTRAL)
                | Q(direction__isnull=True)
                | Q(direction=''),
                distinct=True,
            ),
            total_value=Coalesce(Sum('value'), Value(0), output_field=DecimalField(max_digits=24, decimal_places=2)),
            latest_triggered_at=Max('triggered_at'),
            critical_count=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.CRITICAL), distinct=True),
            high_count=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.HIGH), distinct=True),
            medium_count=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.MEDIUM), distinct=True),
            low_count=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.LOW), distinct=True),
        )
        .order_by('-count', 'symbol')
    )

    total_symbols = grouped_qs.count()
    start_idx = (safe_page - 1) * safe_page_size
    end_idx = start_idx + safe_page_size

    symbol_rows = []
    for row in grouped_qs[start_idx:end_idx]:
        symbol_rows.append(
            {
                'symbol': row.get('symbol') or 'UNKNOWN',
                'count': int(row.get('count') or 0),
                'buy_count': int(row.get('buy_count') or 0),
                'sell_count': int(row.get('sell_count') or 0),
                'neutral_count': int(row.get('neutral_count') or 0),
                'total_value': row.get('total_value'),
                'latest_triggered_at': row.get('latest_triggered_at'),
                'by_severity': {
                    'critical': int(row.get('critical_count') or 0),
                    'high': int(row.get('high_count') or 0),
                    'medium': int(row.get('medium_count') or 0),
                    'low': int(row.get('low_count') or 0),
                },
            }
        )

    total_alerts = qs.aggregate(total=Count('id', distinct=True)).get('total') or 0
    total_pages = max((total_symbols + safe_page_size - 1) // safe_page_size, 1)

    return {
        'lane': lane,
        'total_alerts_in_scope': int(total_alerts),
        'symbols': symbol_rows,
        'pagination': {
            'page': safe_page,
            'page_size': safe_page_size,
            'total_pages': total_pages,
            'total_symbols': total_symbols,
        },
        'generated_at': timezone.now(),
    }


def _whale_size_class(matched_value) -> str:
    v = float(matched_value or 0)
    if v >= 5_000_000_000:
        return 'whale'
    if v >= 1_000_000_000:
        return 'shark'
    return 'normal'


class WhaleAlertCursorPagination(AlertCursorPagination):
    ordering = '-executed_at'


class AlertFeedBaseListView(generics.ListAPIView):
    serializer_class = UnifiedAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AlertCursorPagination

    def get_queryset(self):
        qs = UnifiedAlert.objects.all().select_related('whale_detail').order_by('-triggered_at')
        lane = (self.request.query_params.get('lane') or 'main').strip().lower()
        return _apply_common_alert_filters(qs, self.request.query_params, lane=lane)


class UserScopedAlertFeedBaseView(AlertFeedBaseListView):
    throttle_classes = [SignalRateThrottle]

    def get_queryset(self):
        qs = super().get_queryset()
        return delivery_service.apply_user_delivery_policy(user=self.request.user, queryset=qs)

    def list(self, request, *args, **kwargs):
        start = time.monotonic()
        response = super().list(request, *args, **kwargs)
        page = getattr(self, 'page', None)
        if page is not None:
            delivery_service.sync_user_delivery_rows(user=request.user, alerts=list(page))
        try:
            count = len((response.data or {}).get('results', []))
        except Exception:
            count = -1
        logger.info(
            'alert-center.feed latency=%.3fs results=%s user=%s lane=%s',
            time.monotonic() - start, count, getattr(request.user, 'pk', 'anon'),
            request.query_params.get('lane') or 'feed',
        )
        return response


@extend_schema_view(
    get=extend_schema(
        summary='Lấy feed alert-center (main lane) cho người dùng hiện tại',
        description=(
            'Endpoint chuẩn hóa theo TECH_SPEC: trả về feed lane main từ đường `/core/v1/signals/alert-center/feed`. '
            'Hỗ trợ filter `symbol`, `severity`, `session_date`, cursor pagination (`cursor`, `page_size`). '
            'Rate limit policy: default authenticated API policy của core; xem response 429 theo error envelope chuẩn.'
        ),
        parameters=[
            OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='alert_family', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='timeframe', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='order', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False,
                             description='recent (mặc định, mới nhất trước) | priority (whale/dark_flow trước)'),
            OpenApiParameter(name='cursor', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='page_size', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: CursorPaginatedUnifiedAlertResponseSerializer, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
    )
)
class AlertCenterFeedView(UserScopedAlertFeedBaseView):
    pagination_class = AlertCenterFeedCursorPagination

    def get_queryset(self):
        # F1: mặc định recency-first để màn hình nào cũng thấy cảnh báo mới nhất.
        # ?order=priority giữ hành vi cũ (whale/dark_flow trước) cho ai cần.
        order = (self.request.query_params.get('order') or 'recent').strip().lower()
        qs = UnifiedAlert.objects.select_related('whale_detail')
        if order == 'priority':
            qs = qs.annotate(type_priority=_type_priority_annotation()).order_by(
                'type_priority', '-triggered_at', '-pk'
            )
        else:
            qs = qs.order_by('-triggered_at', '-pk')
        qs = _apply_common_alert_filters(qs, self.request.query_params, lane='main')
        return delivery_service.apply_user_delivery_policy(user=self.request.user, queryset=qs)


@extend_schema_view(
    get=extend_schema(
        summary='Lấy feed AI Alerts (ai lane) cho người dùng hiện tại',
        description=(
            'Endpoint chuẩn hóa theo TECH_SPEC: trả về feed lane AI từ đường `/core/v1/signals/ai-alerts/feed`. '
            'Hỗ trợ filter `symbol`, `severity`, `session_date`, cursor pagination (`cursor`, `page_size`). '
            'Rate limit policy: default authenticated API policy của core; xem response 429 theo error envelope chuẩn.'
        ),
        parameters=[
            OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='alert_family', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='timeframe', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='cursor', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='page_size', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: CursorPaginatedUnifiedAlertResponseSerializer, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
    )
)
class AIAlertsFeedView(UserScopedAlertFeedBaseView):
    def get_queryset(self):
        qs = UnifiedAlert.objects.all().select_related('whale_detail').order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, self.request.query_params, lane='ai')
        return delivery_service.apply_user_delivery_policy(user=self.request.user, queryset=qs)


class _BaseAlertSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SignalRateThrottle]
    lane = 'main'

    def get_scoped_queryset(self, request):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, request.query_params, lane=self.lane)
        return delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)

    def get(self, request):
        start = time.monotonic()
        cache_key = _alert_scope_cache_key('summary', request.user, request.query_params, self.lane)
        payload = cache.get(cache_key)
        if payload is None:
            payload = _build_summary_payload(self.get_scoped_queryset(request), lane=self.lane, user=request.user)
            cache.set(cache_key, payload, 10)
        logger.info(
            'alert-center.summary latency=%.3fs total=%s user=%s lane=%s',
            time.monotonic() - start, (payload or {}).get('total'), getattr(request.user, 'pk', 'anon'), self.lane,
        )
        return Response(payload)


@extend_schema(
    summary='Lấy summary alert-center (main lane)',
    description=(
        'Endpoint chuẩn hóa theo TECH_SPEC: trả về tổng hợp lane main từ `/core/v1/signals/alert-center/summary`. '
        'Hỗ trợ filter `symbol`, `severity`, `session_date`; response gồm total, unseen và by_severity. '
        'Rate limit policy: default authenticated API policy của core; response lỗi theo error envelope chuẩn.'
    ),
    parameters=[
        OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='timeframe', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
    ],
    responses={200: AlertCenterSummaryResponseSerializer, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterSummaryView(_BaseAlertSummaryView):
    lane = 'main'


@extend_schema(
    summary='Lấy summary AI Alerts (ai lane)',
    description=(
        'Endpoint chuẩn hóa theo TECH_SPEC: trả về tổng hợp lane AI từ `/core/v1/signals/ai-alerts/summary`. '
        'Hỗ trợ filter `symbol`, `severity`, `session_date`; response gồm total, unseen và by_severity. '
        'Rate limit policy: default authenticated API policy của core; response lỗi theo error envelope chuẩn.'
    ),
    parameters=[
        OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='timeframe', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
    ],
    responses={200: AlertCenterSummaryResponseSerializer, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AIAlertsSummaryView(_BaseAlertSummaryView):
    lane = 'ai'


class _BaseAlertSymbolStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SignalRateThrottle]
    lane = 'main'

    def get_scoped_queryset(self, request):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, request.query_params, lane=self.lane)
        return delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)

    def get(self, request):
        start = time.monotonic()
        try:
            page = int(request.query_params.get('page') or 1)
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(request.query_params.get('page_size') or 20)
        except (TypeError, ValueError):
            page_size = 20

        cache_key = _alert_scope_cache_key(
            'symbol-stats', request.user, request.query_params, self.lane, '%s:%s' % (page, page_size),
        )
        payload = cache.get(cache_key)
        if payload is None:
            payload = _build_symbol_stats_payload(
                self.get_scoped_queryset(request),
                lane=self.lane,
                page=page,
                page_size=page_size,
            )
            cache.set(cache_key, payload, 10)
        logger.info(
            'alert-center.symbol-stats latency=%.3fs count=%s user=%s lane=%s',
            time.monotonic() - start, (payload or {}).get('total_alerts_in_scope'),
            getattr(request.user, 'pk', 'anon'), self.lane,
        )
        return Response(payload)


@extend_schema(
    summary='Lấy thống kê theo mã cho alert-center (main lane)',
    description=(
        'Endpoint chuẩn hóa theo TECH_SPEC: trả về aggregate theo mã cho lane main '
        'từ `/core/v1/signals/alert-center/symbol-stats`. '
        'Hỗ trợ filter scope giống feed/summary và pagination theo page/page_size.'
    ),
    parameters=[
        OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='alert_family', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='timeframe', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='page', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='page_size', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
    ],
    responses={200: AlertCenterSymbolStatsResponseSerializer, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterSymbolStatsView(_BaseAlertSymbolStatsView):
    lane = 'main'


@extend_schema(
    summary='Lấy thống kê theo mã cho AI Alerts (ai lane)',
    description=(
        'Endpoint chuẩn hóa theo TECH_SPEC: trả về aggregate theo mã cho lane AI '
        'từ `/core/v1/signals/ai-alerts/symbol-stats`. '
        'Hỗ trợ filter scope giống feed/summary và pagination theo page/page_size.'
    ),
    parameters=[
        OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='alert_family', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='timeframe', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='page', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        OpenApiParameter(name='page_size', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
    ],
    responses={200: AlertCenterSymbolStatsResponseSerializer, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AIAlertsSymbolStatsView(_BaseAlertSymbolStatsView):
    lane = 'ai'


@extend_schema(
    summary='Lấy chi tiết alert theo alert_id cho alert-center',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/events/{alert_id}`. '
        'Chỉ trả về alert thuộc lane main và nằm trong delivery scope của người dùng hiện tại.'
    ),
    responses={200: envelope_response(UnifiedAlertSerializer), 401: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterEventDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SignalRateThrottle]

    def get(self, request, alert_id):
        qs = UnifiedAlert.objects.all().select_related('whale_detail').order_by('-triggered_at')
        lane = str(request.query_params.get('lane') or 'main').strip().lower()
        if lane not in ('main', 'ai'):
            lane = 'main'
        qs = _apply_common_alert_filters(qs, request.query_params, lane=lane)
        qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
        alert = qs.filter(alert_id=alert_id).first()
        if alert is None:
            raise NotFoundErrorException(detail='Không tìm thấy alert trong scope người dùng hiện tại.', code='alert_not_found')
        return envelope(UnifiedAlertSerializer(alert).data)


@extend_schema(
    summary='Lấy context theo symbol cho alert-center',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/symbols/{symbol}/context`. '
        'Trả về context lane main cho một mã gồm tổng hợp nhanh và danh sách recent events trong scope người dùng.'
    ),
    parameters=[
        OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
    ],
    responses={200: envelope_response(AlertCenterSymbolContextSerializer), 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterSymbolContextView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SignalRateThrottle]

    def get(self, request, symbol):
        symbol = (symbol or '').upper()
        qs = UnifiedAlert.objects.all().select_related('whale_detail').order_by('-triggered_at')
        lane = str(request.query_params.get('lane') or 'main').strip().lower()
        if lane not in ('main', 'ai'):
            lane = 'main'
        qs = _apply_common_alert_filters(qs, request.query_params, lane=lane)
        qs = qs.filter(symbol=symbol)
        scoped_qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
        recent_alerts = list(scoped_qs[:10])
        summary = _build_summary_payload(scoped_qs, lane=lane)
        payload = {
            'symbol': symbol,
            'lane': lane,
            'total': summary['total'],
            'unseen': summary['unseen'],
            'in_delivery_scope': summary['total'] > 0,
            'recent_events': UnifiedAlertSerializer(recent_alerts, many=True).data,
        }
        return envelope(payload)


@extend_schema(
    summary='Đánh dấu acknowledged cho alert theo alert_id',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/events/{alert_id}/ack`. '
        'Thao tác trên delivery projection của user hiện tại và áp dụng state transition guard từ service layer.'
    ),
    responses={200: envelope_response(UserAlertDeliveryStateSerializer), 401: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
@extend_schema(
    summary='AlertCenterAcknowledgeView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AlertCenterAcknowledgeView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SignalRateThrottle]

    def post(self, request, alert_id):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        lane = str(request.query_params.get('lane') or 'main').strip().lower()
        if lane not in ('main', 'ai'):
            lane = 'main'
        qs = _apply_common_alert_filters(qs, request.query_params, lane=lane)
        qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
        alert = qs.filter(alert_id=alert_id).first()
        if alert is None:
            raise NotFoundErrorException(detail='Không tìm thấy alert trong scope người dùng hiện tại.', code='alert_not_found')
        delivery_row = delivery_service.acknowledge_delivery(user=request.user, alert=alert)
        return envelope(UserAlertDeliveryStateSerializer(delivery_row).data)


@extend_schema(
    summary='Thiết lập mute/cooldown preference cho alert-center',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/preferences/mute`. '
        'Cho phép mute theo symbol hoặc alert_family trong một khoảng thời gian và/hoặc cooldown seconds. '
        'Rate limit policy: default authenticated API policy của core; response lỗi theo error envelope chuẩn.'
    ),
    request=AlertCenterMutePreferenceRequestSerializer,
    # `data` free-form: payload dựng tay ở `post`, không có serializer payload.
    responses={200: envelope_response(), 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterMutePreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [SignalRateThrottle]

    def post(self, request):
        serializer = AlertCenterMutePreferenceRequestSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except ValidationError as exc:
            raise ValidationErrorException(detail='Payload mute preference không hợp lệ.', field_errors={'request': [str(exc)]})

        payload = serializer.validated_data
        mute_minutes = int(payload.get('mute_minutes') or 0)
        mute_until = timezone.now() + timedelta(minutes=mute_minutes) if mute_minutes > 0 else None
        preference = delivery_service.upsert_user_alert_preference(
            user=request.user,
            symbol=payload.get('symbol') or '',
            alert_family=payload.get('alert_family') or '',
            mute_until=mute_until,
            cooldown_seconds=int(payload.get('cooldown_seconds') or 0),
            metadata=payload.get('metadata') or {},
        )
        return envelope(
            {
                'symbol': preference.symbol,
                'alert_family': preference.alert_family,
                'mute_until': preference.mute_until,
                'cooldown_seconds': preference.cooldown_seconds,
            }
        )


class AlertCenterStreamThrottle(UserRateThrottle):
    """Throttle riêng cho SSE alert-center — 60/min, không tiêu quota signals."""

    scope = 'alert_center_stream'


_STREAM_ALERT_FAMILIES = frozenset({
    'whale', 'dark_flow', 'signal', 'system', 'price_shock', 'stale_quote',
    'ai_alert', 'ai_suggest',
})


@extend_schema(exclude=True)
class AlertCenterStreamView(APIView):
    """GET /core/v1/signals/alert-center/stream/ — SSE user-scoped (S7).

    Copy contract signals_stream (retry 3000, :ping 15s, Last-Event-ID/since,
    ?token= fallback, poll DB 3s, idle 1h, max_loops cho test) nhưng:
    - scope theo delivery policy của user hiện tại (watchlist/tracked/holdings),
    - filter lane/symbol/severity/alert_family phía server,
    - event name `alert-center`, payload full UnifiedAlertSerializer shape
      (cùng key space alert_id với REST → FE dedupe an toàn).
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [AlertCenterStreamThrottle]
    renderer_classes = [AlertCenterStreamEventRenderer]

    def initial(self, request, *args, **kwargs):
        # EventSource không gửi được Authorization header → hỗ trợ ?token=
        token = request.query_params.get('token') or request.GET.get('token')
        if token and not request.META.get('HTTP_AUTHORIZATION'):
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
            try:
                from identity_access.authentication import CorePATAuthentication

                pat_auth = CorePATAuthentication()
                user_auth = pat_auth.authenticate(request)
                if user_auth is not None:
                    request.user, request.auth = user_auth
            except Exception:
                pass
        return super().initial(request, *args, **kwargs)

    def get(self, request):
        import sys

        testing = 'test' in sys.argv
        max_loops = int(request.query_params.get('max_loops') or 0) or None
        lane = str(request.query_params.get('lane') or 'main').strip().lower()
        if lane not in ('main', 'ai'):
            lane = 'main'
        severity = (request.query_params.get('severity') or '').strip().lower() or None
        if severity and severity not in {c.value for c in UnifiedAlert.SeverityChoices}:
            severity = None
        alert_family = (request.query_params.get('alert_family') or '').strip().lower() or None
        if alert_family and alert_family not in _STREAM_ALERT_FAMILIES:
            alert_family = None
        filter_params = {
            'symbol': (request.query_params.get('symbol') or '').strip().upper() or None,
            'severity': severity,
            'alert_family': alert_family,
        }

        def event_stream():
            yield sse_format(retry=3000)
            raw_last = request.META.get('HTTP_LAST_EVENT_ID')
            if raw_last is None and hasattr(request, 'headers'):
                try:
                    raw_last = request.headers.get('Last-Event-ID')
                except Exception:
                    raw_last = None
            if raw_last is None or str(raw_last).strip() == '':
                raw_last = request.query_params.get('since') or request.query_params.get('last_id')
            if raw_last is None or str(raw_last).strip() == '':
                try:
                    agg = UnifiedAlert.objects.aggregate(max_id=Max('pk'))
                    last_id = agg['max_id'] or 0
                except Exception:
                    last_id = 0
            else:
                try:
                    last_id = int(str(raw_last).strip())
                except (TypeError, ValueError):
                    last_id = 0

            last_heartbeat = time.time()
            stream_start = time.time()
            loop_count = 0
            while True:
                loop_count += 1
                if max_loops is not None and loop_count > max_loops:
                    break
                if not testing and time.time() - stream_start > 3600:
                    break
                try:
                    from django.db import close_old_connections, connection

                    # Guarded: `close_old_connections()` inside an atomic block
                    # closes the live connection (Django compares
                    # `get_autocommit()` to `settings_dict['AUTOCOMMIT']`), so the
                    # next query dies with `OperationalError: the connection is
                    # closed`. Outside atomic blocks the ORM reopens by itself.
                    if not connection.in_atomic_block:
                        close_old_connections()
                    qs = UnifiedAlert.objects.all().select_related('whale_detail')
                    qs = _apply_common_alert_filters(qs, filter_params, lane=lane)
                    qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
                    qs = qs.filter(pk__gt=last_id).order_by('triggered_at', 'pk')[:50]

                    alerts = list(qs)
                    if alerts:
                        for alert in alerts:
                            try:
                                s = UnifiedAlertSerializer(alert).data
                                data = {
                                    'id': alert.pk,
                                    'alert_id': str(s.get('alert_id')),
                                    'type': s.get('alert_family'),
                                    'lane': s.get('lane'),
                                    'symbol': s.get('symbol'),
                                    'severity': s.get('severity'),
                                    'confidence': s.get('confidence'),
                                    'freshness_state': s.get('freshness_state'),
                                    'title': s.get('title'),
                                    'body': s.get('body'),
                                    'value': s.get('value'),
                                    'direction': s.get('direction'),
                                    'session_date': s.get('session_date'),
                                    'triggered_at': s.get('triggered_at'),
                                    'detected_at': s.get('triggered_at'),
                                    'source_ref': s.get('source_ref'),
                                    'metadata': s.get('metadata') or {},
                                    'evidence': s.get('evidence') or {},
                                    'summary': s.get('summary'),
                                    'executed_at': s.get('executed_at'),
                                }
                                yield sse_format(event='alert-center', data=data, sse_id=str(alert.pk))
                                last_id = max(last_id, alert.pk)
                            except Exception:
                                continue
                        last_heartbeat = time.time()
                    else:
                        if testing or time.time() - last_heartbeat >= 15:
                            yield sse_format(comment='ping')
                            last_heartbeat = time.time()
                except GeneratorExit:
                    break
                except Exception:
                    try:
                        yield sse_format(comment='ping')
                    except GeneratorExit:
                        break

                if testing and max_loops is not None:
                    continue
                try:
                    time.sleep(3)
                except Exception:
                    break

        response = AlertCenterStreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        response['Connection'] = 'keep-alive'
        return response


@extend_schema_view(
    get=extend_schema(
        summary='Lấy order-flow events cho một symbol',
        description='Trả về order-flow events canonical theo symbol với cursor pagination.',
        parameters=[
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='signal_type', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: CursorPaginatedOrderFlowEventResponseSerializer, 401: OpenApiTypes.OBJECT},
    )
)
class OrderFlowEventListView(generics.ListAPIView):
    """List OrderFlowEvent records for a symbol (newest first)."""
    serializer_class = OrderFlowEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = OrderFlowCursorPagination

    def get_queryset(self):
        symbol = self.kwargs.get('symbol', '').upper()
        qs = OrderFlowEvent.objects.filter(symbol=symbol).order_by('-triggered_at')
        session_date = self.request.query_params.get('session_date')
        signal_type = self.request.query_params.get('signal_type')
        if session_date:
            qs = qs.filter(session_date=session_date)
        if signal_type:
            qs = qs.filter(signal_type=signal_type)
        return qs


class WhaleFeedAggregateView(APIView):
    """GET /api/signals/whale-feed/?symbol=VCB — flat whale order list with summary."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Lấy whale-feed aggregate canonical',
        description='Trả về danh sách whale alerts canonical theo symbol cùng summary buy/sell value.',
        parameters=[
            OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: envelope_response(WhaleFeedAggregateResponseSerializer), 401: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        symbol = request.query_params.get('symbol', '').upper()
        session_date = request.query_params.get('session_date')

        qs = WhaleAlertCanonical.objects.select_related('alert').order_by('-executed_at')
        if symbol:
            qs = qs.filter(symbol=symbol)
        if session_date:
            qs = qs.filter(session_date=session_date)
        qs = qs[:200]

        whale_orders = [
            {
                'ts': item.executed_at.isoformat(),
                'price': float(item.price),
                'volume': item.volume,
                'matched_value': float(item.matched_value),
                'side': _WHALE_SIDE_MAP.get(str(item.side).upper(), item.side),
                'size_class': _whale_size_class(item.matched_value),
            }
            for item in qs
        ]

        buy_value = sum(o['matched_value'] for o in whale_orders if o['side'] == 'BUY')
        sell_value = sum(o['matched_value'] for o in whale_orders if o['side'] == 'SELL')

        return envelope({
            'symbol': symbol,
            'whale_orders': whale_orders,
            'summary': {
                'buy_value': buy_value,
                'sell_value': sell_value,
            },
        })
