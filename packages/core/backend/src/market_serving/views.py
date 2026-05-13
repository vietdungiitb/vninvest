import hashlib
import json
import logging

from django.core.cache import cache
from rest_framework import generics, permissions
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

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


class SessionFactsListView(generics.ListAPIView):
    serializer_class = SessionFactsSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = SnapshotCursorPagination

    def get_queryset(self):
        qs = SessionFacts.objects.all().order_by('-session_date', 'symbol')
        symbol = self.request.query_params.get('symbol')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        return qs


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

