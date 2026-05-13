import hashlib
import json
import logging

from django.core.cache import cache
from django.utils import timezone as dj_timezone
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import generics, permissions
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from vninvest_core.pagination import SnapshotCursorPagination

from .models import SessionFacts, SymbolSnapshot
from .serializers import SessionFactsSerializer, SymbolSnapshotSerializer

_SNAPSHOT_TTL = 15   # seconds — SM-P2.4 cache TTL for market data
_SESSION_FACTS_TTL = 30


def _snapshot_cache_key(symbol: str, session_date) -> str:
    return f'core:snapshot:{symbol.upper()}:{session_date}'


def _session_facts_cache_key(symbol: str, session_date) -> str:
    return f'core:session_facts:{symbol.upper()}:{session_date}'


class SymbolSnapshotListView(generics.ListAPIView):
    serializer_class = SymbolSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = SnapshotCursorPagination

    def get_queryset(self):
        qs = SymbolSnapshot.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


class SymbolSnapshotDetailView(generics.RetrieveAPIView):
    """SM-P2.4: Adds Redis cache layer with 15s TTL."""
    serializer_class = SymbolSnapshotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        symbol = self.kwargs['symbol'].upper()
        obj = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-session_date').first()
        if not obj:
            raise NotFound(f'No snapshot found for {symbol}')
        return obj

    def retrieve(self, request, *args, **kwargs):
        symbol = self.kwargs['symbol'].upper()
        obj = self.get_object()
        cache_key = _snapshot_cache_key(symbol, obj.session_date)

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning(f'SymbolSnapshot cache get failed: {e}')
            cached = None
        if cached is not None:
            data = cached
            data['_source'] = 'cache-hit'
            return Response(data)

        serializer = self.get_serializer(obj)
        data = serializer.data
        try:
            cache.set(cache_key, dict(data), timeout=_SNAPSHOT_TTL)
        except Exception as e:
            logger.warning(f'SymbolSnapshot cache set failed: {e}')
        data = dict(data)
        data['_source'] = 'db-read'
        return Response(data)


class MarketDataThrottle(UserRateThrottle):
    """60 req/min per authenticated user — market data endpoints."""
    rate = '60/min'


class SessionFactsListView(generics.ListAPIView):
    """
    GET /api/market/session-facts/

    Danh sách SessionFacts (CVD + Strength) cho toàn bộ hoặc một symbol.
    Hỗ trợ filter ?symbol=VCB. Trả về cursor-paginated list.
    """
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [MarketDataThrottle]
    pagination_class = SnapshotCursorPagination

    def get_queryset(self):
        qs = SessionFacts.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


@extend_schema(
    summary='Lấy SessionFacts (CVD + Strength) cho một symbol',
    description=(
        'Trả về SessionFacts cho phiên giao dịch hiện tại hoặc gần nhất. '
        'Nếu chưa có dữ liệu hôm nay, tự động compute on-demand từ WhaleAlertCanonical. '
        'Cache Redis TTL 30 giây. Xác thực bắt buộc.'
    ),
    parameters=[
        OpenApiParameter(
            name='symbol',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.PATH,
            description='Mã chứng khoán, ví dụ VCB, VPB, HPG.',
            required=True,
        )
    ],
    responses={
        200: SessionFactsSerializer,
        401: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class SessionFactsDetailView(generics.RetrieveAPIView):
    """
    GET /api/market/session-facts/<symbol>/

    Trả về SessionFacts cho symbol theo phiên gần nhất.
    Nếu chưa có dữ liệu cho hôm nay, tự động compute on-demand từ
    WhaleAlertCanonical trước khi trả về.

    Cache TTL: 30 s (Redis).
    """
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [MarketDataThrottle]

    def _compute_on_demand(self, symbol: str):
        """Trigger engine tính ngay nếu chưa có dữ liệu hôm nay."""
        from django.utils.timezone import now as _now
        from market_serving.session_facts_engine import compute_session_facts

        today = _now().date()
        result = compute_session_facts(symbol, today)
        if result is None:
            return None

        obj, _ = SessionFacts.objects.update_or_create(
            symbol=symbol,
            session_date=today,
            defaults={
                'cvd_normalized': result['cvd_normalized'],
                'buy_strength': result['buy_strength'],
                'institutional_strength': result['institutional_strength'],
                'whale_net_flow': result['whale_net_flow'],
                'dark_flow_score': result['dark_flow_score'],
                'total_buy_volume': result['total_buy_volume'],
                'total_sell_volume': result['total_sell_volume'],
                'source': SessionFacts.SourceChoices.COMPUTED,
                'stale': False,
            },
        )
        return obj

    def get_object(self):
        from django.utils.timezone import now as _now

        symbol = self.kwargs['symbol'].upper()
        today = _now().date()

        # Ưu tiên dữ liệu hôm nay
        obj = SessionFacts.objects.filter(symbol=symbol, session_date=today).first()
        if obj is None:
            # Thử compute on-demand từ WhaleAlertCanonical
            obj = self._compute_on_demand(symbol)
        if obj is None:
            # Fallback: phiên gần nhất bất kỳ
            obj = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date').first()
        if obj is None:
            raise NotFound(f'Không có dữ liệu SessionFacts cho {symbol}')
        return obj

    def retrieve(self, request, *args, **kwargs):
        symbol = self.kwargs['symbol'].upper()
        obj = self.get_object()
        cache_key = _session_facts_cache_key(symbol, obj.session_date)

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning(f'SessionFacts cache get failed: {e}')
            cached = None
        if cached is not None:
            data = dict(cached)
            data['_source'] = 'cache-hit'
            return Response(data)

        serializer = self.get_serializer(obj)
        data = dict(serializer.data)
        try:
            cache.set(cache_key, data, timeout=_SESSION_FACTS_TTL)
        except Exception as e:
            logger.warning(f'SessionFacts cache set failed: {e}')
        data['_source'] = 'db-read'
        return Response(data)


# ── CVD Series endpoint ───────────────────────────────────

_WINDOW_TO_BUCKET_MINUTES: dict[str, int] = {
    '5m': 5, '15m': 15, '30m': 30, '1h': 60,
}
_CVD_SERIES_CACHE_TTL = 30   # seconds — same as SessionFacts


@extend_schema(
    summary='Lấy chuỗi CVD whale theo bucket thời gian (SSOT)',
    description=(
        'Trả về chuỗi CVD tích lũy theo bucket thời gian cho một symbol, '
        'được tính từ nguồn SSOT duy nhất là **WhaleAlertCanonical**. '
        'Đây là nguồn chân lý duy nhất cho CVD chart — thay thế cvd_series '
        'từ IntradayTick (short-lived, không đáng tin cho cả phiên). '
        'Mỗi bucket trả về `bucket_ts` (ISO 8601), `cumulative_cvd` (VND), '
        '`buy_volume`, `sell_volume`. '
        'Cache Redis TTL 30 giây. Xác thực bắt buộc.'
    ),
    parameters=[
        OpenApiParameter(
            name='symbol',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.PATH,
            description='Mã chứng khoán, ví dụ VCB, VPB, HPG.',
            required=True,
        ),
        OpenApiParameter(
            name='window',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Độ rộng bucket: 5m | 15m (mặc định) | 30m | 1h.',
            required=False,
            enum=['5m', '15m', '30m', '1h'],
        ),
    ],
    responses={
        200: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'VPB 15m',
            value={
                'symbol': 'VPB',
                'session_date': '2026-05-13',
                'window': '15m',
                'bucket_minutes': 15,
                'cvd_normalized': 50.0,
                'delta_strength_pct': -100.0,
                'whale_net_flow': -500000000,
                'cvd_series': [
                    {'bucket_ts': '2026-05-13T09:00:00+07:00', 'cumulative_cvd': -250000000.0,
                     'buy_volume': 0, 'sell_volume': 250000000},
                ],
                'bucket_count': 1,
                '_source': 'db-read',
            },
        ),
    ],
)
class SessionFactsCvdView(APIView):
    """
    GET /api/market/session-facts/<symbol>/cvd/

    Chuỗi CVD theo bucket từ SSOT duy nhất (WhaleAlertCanonical).
    Dùng để render CVD chart — thay thế cvd_series từ IntradayTick.

    Query params:
      window   — 5m | 15m (default) | 30m | 1h

    Response fields:
      symbol, session_date, window, bucket_minutes,
      cvd_normalized, delta_strength_pct, whale_net_flow,
      cvd_series[{bucket_ts, cumulative_cvd, buy_volume, sell_volume}],
      bucket_count, _source
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [MarketDataThrottle]

    def get(self, request, symbol: str):
        symbol = symbol.strip().upper()
        if not symbol:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Symbol không hợp lệ.', 'code': 'invalid_symbol'})

        window = str(request.query_params.get('window', '15m')).strip().lower()
        bucket_minutes = _WINDOW_TO_BUCKET_MINUTES.get(window, 15)

        today = dj_timezone.now().date()
        cache_key = f'core:cvd_series:{symbol}:{today}:{bucket_minutes}'

        try:
            cached = cache.get(cache_key)
        except Exception as e:
            logger.warning('SessionFactsCvd cache get failed: %s', e)
            cached = None

        if cached is not None:
            return Response({**cached, '_source': 'cache-hit'})

        from market_serving.session_facts_engine import compute_session_facts
        result = compute_session_facts(
            symbol, today,
            bucket_minutes=bucket_minutes,
            include_series=True,
        )

        if result is None:
            raise NotFound({
                'detail': f'Không có dữ liệu whale cho {symbol} hôm nay.',
                'code': 'not_found',
            })

        data = {
            'symbol': symbol,
            'session_date': today.isoformat(),
            'window': window,
            'bucket_minutes': bucket_minutes,
            'cvd_normalized': result['cvd_normalized'],
            'delta_strength_pct': result['delta_strength_pct'],
            'whale_net_flow': result['whale_net_flow'],
            'cvd_series': result.get('cvd_series', []),
            'bucket_count': result['bucket_count'],
        }

        try:
            cache.set(cache_key, data, timeout=_CVD_SERIES_CACHE_TTL)
        except Exception as e:
            logger.warning('SessionFactsCvd cache set failed: %s', e)

        return Response({**data, '_source': 'db-read'})

