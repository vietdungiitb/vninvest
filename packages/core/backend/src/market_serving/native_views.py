"""
C2 — Native realtime views for market_serving.

Replaces RealtimeLegacyBridgeView for 9 frontend compat routes.
No bridge calls to backend:8000.

All views require IsAuthenticated; symbol param is always uppercased.
"""
from datetime import date

from django.db.models import Avg
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from market_data import vnbroker_adapter
from .models import SymbolSnapshot


class RealtimeTickerView(APIView):
    """GET /api/realtime/ticker/<symbol>/ — latest snapshot for a single symbol."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        today = date.today()
        snap = SymbolSnapshot.objects.filter(symbol=symbol, session_date=today).first()
        if not snap:
            return Response({
                'symbol': symbol,
                'price': None,
                'stale': True,
                'source': 'no_data',
            })
        return Response({
            'symbol': snap.symbol,
            'price': str(snap.price),
            'current_price': str(snap.price),
            'price_change': str(snap.price_change),
            'change_value': str(snap.price_change),
            'price_change_pct': str(snap.price_change_pct),
            'change_pct': float(snap.price_change_pct),
            'volume': snap.volume,
            'market_status': snap.market_status,
            'stale': snap.stale,
            'source': snap.source,
            'fetched_at': snap.fetched_at.isoformat(),
        })


class RealtimeTickerListView(APIView):
    """GET /api/realtime/tickers/?symbols=VCB,HPG — batch snapshot lookup."""
    permission_classes = [permissions.IsAuthenticated]

    _MAX_SYMBOLS = 100

    def get(self, request):
        today = date.today()
        symbols_raw = request.query_params.get('symbols', '')
        if symbols_raw:
            symbols = [s.strip().upper() for s in symbols_raw.split(',') if s.strip()][:self._MAX_SYMBOLS]
            qs = SymbolSnapshot.objects.filter(symbol__in=symbols, session_date=today)
        else:
            qs = SymbolSnapshot.objects.filter(session_date=today).order_by('symbol')[:self._MAX_SYMBOLS]
        # Return as dict keyed by symbol so frontend can do Object.values(tickersMap)
        result = {}
        for s in qs:
            result[s.symbol] = {
                'symbol': s.symbol,
                'price': str(s.price),
                'current_price': str(s.price),
                'price_change': str(s.price_change),
                'change_value': str(s.price_change),
                'price_change_pct': str(s.price_change_pct),
                'change_pct': float(s.price_change_pct),
                'volume': s.volume,
                'reference_price': str(s.reference_price) if s.reference_price else None,
                'ceiling': str(s.ceiling) if s.ceiling else None,
                'floor': str(s.floor) if s.floor else None,
                'market_status': s.market_status,
                'stale': s.stale,
            }
        return Response(result)


_INTRADAY_SIDE_MAP = {'B': 'BUY', 'S': 'SELL', 'BUY': 'BUY', 'SELL': 'SELL'}


def _normalize_trade(t: dict) -> dict:
    return {
        'time': t.get('ts') or t.get('time') or t.get('datetime', ''),
        'price': float(t.get('price', 0)),
        'volume': int(t.get('volume', 0)),
        'side': _INTRADAY_SIDE_MAP.get(str(t.get('side', '')).upper(), 'NO'),
    }


class RealtimeIntradayView(APIView):
    """GET /api/realtime/intraday/<symbol>/ — intraday bars for symbol."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        page_size = int(request.query_params.get('page_size', 50))
        data = vnbroker_adapter.fetch_intraday_tape(symbol, page_size=page_size)
        raw_trades = data.get('trades') or []
        trades = [_normalize_trade(t) for t in raw_trades]

        return Response({
            'symbol': symbol,
            'trades': trades,
            'bars': trades,
            'total': len(trades),
            'source': data.get('source', 'native'),
            'stale': bool(data.get('stale', False)),
            'fetched_at': data.get('fetched_at'),
        })


class RealtimePriceBoardView(APIView):
    """GET /api/realtime/price-board/<symbol>/ — price board snapshot."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        today = date.today()
        snap = SymbolSnapshot.objects.filter(symbol=symbol, session_date=today).first()
        if not snap:
            return Response({'symbol': symbol, 'data': None, 'stale': True})
        return Response({
            'symbol': snap.symbol,
            'price': str(snap.price),
            'price_change': str(snap.price_change),
            'price_change_pct': str(snap.price_change_pct),
            'volume': snap.volume,
            'market_status': snap.market_status,
            'stale': snap.stale,
            'fetched_at': snap.fetched_at.isoformat(),
        })


class RealtimeBreadthView(APIView):
    """GET /api/realtime/breadth/<symbol>/ — market breadth aggregate."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        # symbol param is accepted but breadth is market-wide aggregate
        today = date.today()
        qs = SymbolSnapshot.objects.filter(session_date=today)
        total = qs.count()
        advancing = qs.filter(price_change__gt=0).count()
        declining = qs.filter(price_change__lt=0).count()
        return Response({
            'symbol': symbol.upper(),
            'total': total,
            'advancing': advancing,
            'declining': declining,
            'unchanged': total - advancing - declining,
        })


class RealtimeWhaleFeedView(APIView):
    """GET /api/realtime/whale-feed/<symbol>/ — whale alerts for a symbol."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from signal_intelligence.models import UnifiedAlert
        symbol = symbol.upper()
        limit = min(int(request.query_params.get('limit', 50)), 200)
        alerts = UnifiedAlert.objects.filter(symbol=symbol).order_by('-triggered_at')[:limit]
        return Response({
            'symbol': symbol,
            'alerts': [{
                'id': str(a.alert_id),
                'alert_type': a.alert_type,
                'severity': a.severity,
                'title': a.title,
                'value': str(a.value) if a.value is not None else None,
                'direction': a.direction,
                'triggered_at': a.triggered_at.isoformat(),
            } for a in alerts],
        })


class RealtimeSymbolInvestigationView(APIView):
    """GET /api/realtime/symbol-investigation/<symbol>/ — combined profile + snapshot."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from market_data.models import StockProfile
        symbol = symbol.upper()
        try:
            profile = StockProfile.objects.get(symbol=symbol)
        except StockProfile.DoesNotExist:
            return Response({'symbol': symbol, 'found': False})
        snap = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-fetched_at').first()
        return Response({
            'symbol': symbol,
            'found': True,
            'company_name': profile.company_name,
            'exchange': profile.exchange,
            'industry': profile.industry,
            'outstanding_shares': profile.outstanding_shares,
            'price': str(snap.price) if snap else None,
            'volume': snap.volume if snap else None,
            'stale': snap.stale if snap else True,
        })


class RealtimeRvolView(APIView):
    """GET /api/realtime/rvol/<symbol>/ — relative volume vs 20-day average."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        from market_data.models import DailyPrice
        symbol = symbol.upper()
        today = date.today()
        snap = SymbolSnapshot.objects.filter(symbol=symbol, session_date=today).first()
        today_vol = snap.volume if snap else 0
        avg_result = (
            DailyPrice.objects.filter(symbol=symbol)
            .order_by('-date')[:20]
            .aggregate(avg=Avg('volume'))
        )
        avg_vol = avg_result['avg'] or 1
        rvol = round(today_vol / avg_vol, 2) if avg_vol else 0
        return Response({
            'symbol': symbol,
            'rvol': rvol,
            'today_volume': today_vol,
            'avg_volume_20d': round(avg_vol, 0),
        })


class RealtimeDepthChartView(APIView):
    """GET /api/realtime/depth-chart/<symbol>/ — order book depth (native stub)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        # Order book depth requires realtime feed not yet available natively.
        # Return empty gracefully per code quality constitution §INV-04 pattern.
        return Response({
            'symbol': symbol.upper(),
            'bids': [],
            'asks': [],
            'note': 'depth_not_available_in_native',
        })
