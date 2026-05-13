"""
Market Data domain REST API views.

Endpoints:
  GET /core/v1/market-data/symbols/                    — list StockProfile
  GET /core/v1/market-data/symbols/<symbol>/           — StockProfile detail
  GET /core/v1/market-data/daily-prices/<symbol>/      — DailyPrice history
"""
from rest_framework import permissions, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone

from .models import DailyPrice, StockProfile
from .serializers import DailyPriceSerializer, StockProfileSerializer
from . import vnbroker_adapter


class StockProfileListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    _PAGE_SIZE = 100

    def get(self, request):
        qs = StockProfile.objects.filter(status='active').order_by('symbol')
        search = request.query_params.get('search') or request.query_params.get('q')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(symbol__icontains=search) |
                Q(company_name__icontains=search)
            )
        exchange = request.query_params.get('exchange')
        if exchange:
            qs = qs.filter(exchange=exchange.upper())
        industry = request.query_params.get('industry')
        if industry:
            qs = qs.filter(industry__icontains=industry)
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        offset = (page - 1) * self._PAGE_SIZE
        results = qs[offset: offset + self._PAGE_SIZE]
        return Response({
            'results': StockProfileSerializer(results, many=True).data,
            'page': page,
            'page_size': self._PAGE_SIZE,
        })


class StockProfileDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            raise NotFound(f'Stock profile not found for {symbol}')
        return Response(StockProfileSerializer(profile).data)


class DailyPriceListView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    _PAGE_SIZE = 250

    def get(self, request, symbol):
        symbol = symbol.upper()
        qs = DailyPrice.objects.filter(symbol=symbol).order_by('-date')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1
        offset = (page - 1) * self._PAGE_SIZE
        results = qs[offset: offset + self._PAGE_SIZE]
        return Response({
            'symbol': symbol,
            'results': DailyPriceSerializer(results, many=True).data,
            'page': page,
            'page_size': self._PAGE_SIZE,
        })


class TrackedSymbolsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from user_workspace.models import WatchlistItem

        items = (
            WatchlistItem.objects
            .filter(watchlist__user=request.user)
            .order_by('-added_at', '-pk')
        )
        seen_symbols = set()
        payload = []
        for item in items:
            symbol = str(item.symbol or '').upper().strip()
            if not symbol or symbol in seen_symbols:
                continue
            seen_symbols.add(symbol)
            payload.append(
                {
                    'id': item.pk,
                    'symbol': symbol,
                    'note': item.note or '',
                }
            )
        return Response(payload)

    def post(self, request):
        from user_workspace.models import Watchlist, WatchlistItem

        raw_symbol = request.data.get('symbol') or request.data.get('ticker') or request.data.get('code')
        symbol = str(raw_symbol or '').upper().strip()
        if not symbol:
            return Response({'detail': 'symbol là bắt buộc.'}, status=status.HTTP_400_BAD_REQUEST)

        watchlist = (
            Watchlist.objects
            .filter(user=request.user)
            .order_by('-is_default', 'name', 'pk')
            .first()
        )
        if watchlist is None:
            tenant = getattr(request.user, 'core_tenant', None)
            watchlist = Watchlist.objects.create(
                user=request.user,
                tenant=tenant,
                name='Danh mục theo dõi',
                description='Tạo tự động cho tracked symbols.',
                is_default=True,
            )

        item, created = WatchlistItem.objects.get_or_create(
            watchlist=watchlist,
            symbol=symbol,
            defaults={'note': str(request.data.get('note') or '')[:255]},
        )
        return Response(
            {
                'id': item.pk,
                'symbol': item.symbol,
                'note': item.note or '',
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class IntradayPricesView(APIView):
    """
    GET /core/v1/market-data/intraday-prices/{symbol}/

    Phase 2: Query native IntradayBar model (replaces bridge).

    Query params:
        timeframe: 1m|5m|15m|1H|2H|4H|D|W|M  (default: 1H)
        days: int  (default: 180)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        timeframe = request.query_params.get('timeframe', '1H')
        days = int(request.query_params.get('days', 180))
        
        # Query native adapter
        data = vnbroker_adapter.fetch_intraday_ohlcv(symbol, timeframe, days)
        
        return Response({
            'symbol': symbol,
            'days': len(data['bars']),
            'timeframe': timeframe,
            'interval': timeframe.lower(),
            'points': [
                {
                    'date': bar['datetime'],
                    'open': bar['open'],
                    'high': bar['high'],
                    'low': bar['low'],
                    'close': bar['close'],
                    'volume': bar['volume'],
                }
                for bar in data['bars']
            ],
            'technical': {},
            'source': 'native',
        })


class IntradayTapeView(APIView):
    """
    GET /core/v1/market-data/intraday-tape/{symbol}/

    Phase 2: Query native IntradayTick model with Redis cache (5 min TTL).

    Query params:
        page_size: int  (default: 50)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        page_size = int(request.query_params.get('page_size', 50))
        
        # Query native adapter (Redis cache → DB fallback)
        data = vnbroker_adapter.fetch_intraday_tape(symbol, page_size)
        
        return Response({
            'symbol': symbol,
            'trades': [
                {
                    'time': t['timestamp'].split('T')[1][:8],
                    'ts': t['timestamp'],
                    'price': t['price'],
                    'volume': t['volume'],
                    'side': t['side'],
                    'match_type': t.get('match_type', 'NormalMatch'),
                }
                for t in data['trades']
            ],
            'total': len(data['trades']),
            'source': 'native',
            'stale': False,
            'fetched_at': timezone.now().isoformat(),
        })
