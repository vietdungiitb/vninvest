from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.pagination import AlertCursorPagination, OrderFlowCursorPagination

from identity_access.models import UserProfile
from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from .serializers import OrderFlowEventSerializer, UnifiedAlertSerializer
from user_workspace.models import Portfolio, TrackedSymbol, Transaction, WatchlistItem


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


def _whale_size_class(matched_value) -> str:
    v = float(matched_value or 0)
    if v >= 5_000_000_000:
        return 'whale'
    if v >= 1_000_000_000:
        return 'shark'
    return 'normal'


class WhaleAlertCursorPagination(AlertCursorPagination):
    ordering = '-executed_at'


@extend_schema_view(
    get=extend_schema(
        summary='Lấy unified alerts cho alert center',
        description=(
            'Trả về unified alerts canonical với lane tách main/AI, cùng confidence, freshness_state và evidence. '
            'Default lane là main; dùng lane=ai để đọc lane AI riêng.'
        ),
        parameters=[
            OpenApiParameter(name='symbol', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='alert_type', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='severity', type=OpenApiTypes.STR, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(name='session_date', type=OpenApiTypes.DATE, location=OpenApiParameter.QUERY, required=False),
            OpenApiParameter(
                name='lane',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='main hoặc ai; mặc định main.',
            ),
        ],
        responses={200: CursorPaginatedUnifiedAlertResponseSerializer, 401: OpenApiTypes.OBJECT},
        examples=[
            OpenApiExample(
                'Unified alerts cursor page',
                value={
                    'next': None,
                    'previous': None,
                    'results': [
                        {
                            'alert_id': '3c5d1a1d-3f1d-4ef1-b25a-28c45a0a2b1a',
                            'alert_type': 'whale',
                            'lane': 'main',
                            'symbol': 'VCI',
                            'severity': 'high',
                            'confidence': 0.95,
                            'freshness_state': 'fresh',
                            'title': 'Cá mập mua VCI: 1,000,000,000đ',
                            'body': '',
                            'value': 1000000000,
                            'direction': 'buy',
                            'session_date': '2026-05-15',
                            'triggered_at': '2026-05-15T09:15:00+07:00',
                            'source_ref': 'order_flow:123',
                            'metadata': {'source': 'native_order_flow_events'},
                            'evidence': {'source': 'native_order_flow_events'},
                        }
                    ],
                },
            )
        ],
    )
)
class UnifiedAlertListView(generics.ListAPIView):
    serializer_class = UnifiedAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AlertCursorPagination

    def get_queryset(self):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        lane = (self.request.query_params.get('lane') or 'main').strip().lower()
        symbol = self.request.query_params.get('symbol')
        alert_type = self.request.query_params.get('alert_type')
        severity = self.request.query_params.get('severity')
        session_date = self.request.query_params.get('session_date')
        main_lane_types = {
            UnifiedAlert.AlertTypeChoices.WHALE,
            UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            UnifiedAlert.AlertTypeChoices.SIGNAL,
            UnifiedAlert.AlertTypeChoices.SYSTEM,
        }
        if lane == 'main':
            qs = qs.filter(alert_type__in=main_lane_types)
        elif lane == 'ai':
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


def _resolve_user_delivery_symbols(user) -> list[str]:
    symbols = set()
    if user is None or not getattr(user, 'is_authenticated', False):
        return []

    watchlist_symbols = WatchlistItem.objects.filter(watchlist__user=user).values_list('symbol', flat=True).distinct()
    tracked_symbols = TrackedSymbol.objects.filter(user=user).values_list('symbol', flat=True).distinct()
    holding_symbols = Transaction.objects.filter(portfolio__user=user).values_list('symbol', flat=True).distinct()

    for symbol in watchlist_symbols:
        if symbol:
            symbols.add(str(symbol).upper())
    for symbol in tracked_symbols:
        if symbol:
            symbols.add(str(symbol).upper())
    for symbol in holding_symbols:
        if symbol:
            symbols.add(str(symbol).upper())
    return sorted(symbols)


def _resolve_user_whale_threshold_vnd(user) -> int:
    profile = getattr(user, 'core_profile', None)
    if isinstance(profile, UserProfile) and profile.whale_alert_threshold is not None:
        try:
            return max(int(profile.whale_alert_threshold), 1) * 1_000_000
        except (TypeError, ValueError):
            return 500_000_000
    return 500_000_000


@extend_schema_view(
    get=extend_schema(
        summary='Lấy unified alerts dành riêng cho người dùng hiện tại',
        description=(
            'Trả về unified alerts canonical đã được project theo watchlist, tracked symbols và holdings của user. '
            'Alert whale/dark-flow được lọc thêm theo whale_alert_threshold của profile.'
        ),
        parameters=[
            OpenApiParameter(
                name='lane',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='main hoặc ai; mặc định main.',
            ),
        ],
        responses={200: CursorPaginatedUnifiedAlertResponseSerializer, 401: OpenApiTypes.OBJECT},
    )
)
class UserUnifiedAlertDeliveryView(UnifiedAlertListView):
    def get_queryset(self):
        qs = super().get_queryset()
        user_symbols = _resolve_user_delivery_symbols(self.request.user)
        if not user_symbols:
            return qs.none()
        qs = qs.filter(symbol__in=user_symbols)
        whale_threshold = _resolve_user_whale_threshold_vnd(self.request.user)
        return qs.exclude(
            alert_type__in={UnifiedAlert.AlertTypeChoices.WHALE, UnifiedAlert.AlertTypeChoices.DARK_FLOW},
            value__isnull=False,
            value__lt=whale_threshold,
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
