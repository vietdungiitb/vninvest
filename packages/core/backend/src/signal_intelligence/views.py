from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.db.models import Count, Q
from datetime import timedelta
from django.utils import timezone
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.pagination import AlertCursorPagination, OrderFlowCursorPagination

from . import delivery_service
from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from .serializers import OrderFlowEventSerializer, UnifiedAlertSerializer
from vninvest_core.exceptions import NotFoundErrorException, ValidationErrorException


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
    severity = params.get('severity')
    session_date = params.get('session_date')
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
    if severity:
        qs = qs.filter(severity=severity)
    if session_date:
        qs = qs.filter(session_date=session_date)
    return qs


def _build_summary_payload(qs, *, lane: str) -> dict:
    aggregate = qs.aggregate(
        total=Count('id'),
        unseen=Count('id', filter=Q(deliveries__delivery_state='new')),
        critical=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.CRITICAL)),
        high=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.HIGH)),
        medium=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.MEDIUM)),
        low=Count('id', filter=Q(severity=UnifiedAlert.SeverityChoices.LOW)),
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
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        lane = (self.request.query_params.get('lane') or 'main').strip().lower()
        return _apply_common_alert_filters(qs, self.request.query_params, lane=lane)


class UserScopedAlertFeedBaseView(AlertFeedBaseListView):
    def get_queryset(self):
        qs = super().get_queryset()
        return delivery_service.apply_user_delivery_policy(user=self.request.user, queryset=qs)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        page = getattr(self, 'page', None)
        if page is not None:
            delivery_service.sync_user_delivery_rows(user=request.user, alerts=list(page))
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
            OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='cursor', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='page_size', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: CursorPaginatedUnifiedAlertResponseSerializer, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
    )
)
class AlertCenterFeedView(UserScopedAlertFeedBaseView):
    def get_queryset(self):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
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
            OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='cursor', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='page_size', type=OpenApiTypes.INT, location=OpenApiParameter.QUERY, required=False),
        ],
        responses={200: CursorPaginatedUnifiedAlertResponseSerializer, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
    )
)
class AIAlertsFeedView(UserScopedAlertFeedBaseView):
    def get_queryset(self):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, self.request.query_params, lane='ai')
        return delivery_service.apply_user_delivery_policy(user=self.request.user, queryset=qs)


class _BaseAlertSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    lane = 'main'

    def get_scoped_queryset(self, request):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, request.query_params, lane=self.lane)
        return delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)

    def get(self, request):
        payload = _build_summary_payload(self.get_scoped_queryset(request), lane=self.lane)
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
    ],
    responses={200: AlertCenterSummaryResponseSerializer, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AIAlertsSummaryView(_BaseAlertSummaryView):
    lane = 'ai'


@extend_schema(
    summary='Lấy chi tiết alert theo alert_id cho alert-center',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/events/{alert_id}`. '
        'Chỉ trả về alert thuộc lane main và nằm trong delivery scope của người dùng hiện tại.'
    ),
    responses={200: UnifiedAlertSerializer, 401: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterEventDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, alert_id):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, request.query_params, lane='main')
        qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
        alert = qs.filter(alert_id=alert_id).first()
        if alert is None:
            raise NotFoundErrorException(detail='Không tìm thấy alert trong scope người dùng hiện tại.', code='alert_not_found')
        return Response(UnifiedAlertSerializer(alert).data)


@extend_schema(
    summary='Lấy context theo symbol cho alert-center',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/symbols/{symbol}/context`. '
        'Trả về context lane main cho một mã gồm tổng hợp nhanh và danh sách recent events trong scope người dùng.'
    ),
    parameters=[
        OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
    ],
    responses={200: AlertCenterSymbolContextSerializer, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterSymbolContextView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = (symbol or '').upper()
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, request.query_params, lane='main')
        qs = qs.filter(symbol=symbol)
        scoped_qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
        recent_alerts = list(scoped_qs[:10])
        summary = _build_summary_payload(scoped_qs, lane='main')
        payload = {
            'symbol': symbol,
            'lane': 'main',
            'total': summary['total'],
            'unseen': summary['unseen'],
            'in_delivery_scope': summary['total'] > 0,
            'recent_events': UnifiedAlertSerializer(recent_alerts, many=True).data,
        }
        return Response(payload)


@extend_schema(
    summary='Đánh dấu acknowledged cho alert theo alert_id',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/events/{alert_id}/ack`. '
        'Thao tác trên delivery projection của user hiện tại và áp dụng state transition guard từ service layer.'
    ),
    responses={200: UserAlertDeliveryStateSerializer, 401: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterAcknowledgeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, alert_id):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        qs = _apply_common_alert_filters(qs, request.query_params, lane='main')
        qs = delivery_service.apply_user_delivery_policy(user=request.user, queryset=qs)
        alert = qs.filter(alert_id=alert_id).first()
        if alert is None:
            raise NotFoundErrorException(detail='Không tìm thấy alert trong scope người dùng hiện tại.', code='alert_not_found')
        delivery_row = delivery_service.acknowledge_delivery(user=request.user, alert=alert)
        return Response(UserAlertDeliveryStateSerializer(delivery_row).data)


@extend_schema(
    summary='Thiết lập mute/cooldown preference cho alert-center',
    description=(
        'Endpoint chuẩn hóa `/core/v1/signals/alert-center/preferences/mute`. '
        'Cho phép mute theo symbol hoặc alert_family trong một khoảng thời gian và/hoặc cooldown seconds. '
        'Rate limit policy: default authenticated API policy của core; response lỗi theo error envelope chuẩn.'
    ),
    request=AlertCenterMutePreferenceRequestSerializer,
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 429: OpenApiTypes.OBJECT},
)
class AlertCenterMutePreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

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
        return Response(
            {
                'symbol': preference.symbol,
                'alert_family': preference.alert_family,
                'mute_until': preference.mute_until,
                'cooldown_seconds': preference.cooldown_seconds,
            }
        )


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
        responses={200: WhaleFeedAggregateResponseSerializer, 401: OpenApiTypes.OBJECT},
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

        return Response({
            'symbol': symbol,
            'whale_orders': whale_orders,
            'summary': {
                'buy_value': buy_value,
                'sell_value': sell_value,
            },
        })
