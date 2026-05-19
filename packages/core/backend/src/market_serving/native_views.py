"""
C2 — Native realtime views for market_serving.

Replaces RealtimeLegacyBridgeView for 9 frontend compat routes.
No bridge calls to backend:8000.

All views require IsAuthenticated; symbol param is always uppercased.
"""
from datetime import date

from django.db.models import Avg
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework.throttling import UserRateThrottle

from market_data.models import IntradayTick
from .models import SymbolSnapshot


class RealtimeDataThrottle(UserRateThrottle):
    """Independent bucket for realtime ticker polling — does not share the global 'user' quota."""
    scope = 'realtime_data'


class RealtimeTickerView(APIView):
    """GET /api/realtime/ticker/<symbol>/ — latest snapshot for a single symbol."""
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [RealtimeDataThrottle]

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
    throttle_classes = [RealtimeDataThrottle]

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
                'high_price': str(s.high) if s.high else None,
                'low_price': str(s.low) if s.low else None,
                'open_price': str(s.open) if s.open else None,
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


def _serialize_intraday_tick(tick: IntradayTick) -> dict:
    return {
        'time': timezone.localtime(tick.timestamp).strftime('%H:%M:%S'),
        'price': float(tick.price),
        'volume': int(tick.volume),
        'side': _INTRADAY_SIDE_MAP.get(str(tick.side).upper(), 'NO'),
    }


class RealtimeIntradayView(APIView):
    """GET /api/realtime/intraday/<symbol>/ — intraday matched trades from shared DB."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, symbol):
        symbol = symbol.upper()
        try:
            page_size = max(1, min(int(request.query_params.get('page_size', 50)), 200))
        except (TypeError, ValueError):
            page_size = 50

        served_at = timezone.now()
        latest_tick = (
            IntradayTick.objects.filter(symbol=symbol)
            .only('timestamp', 'created_at')
            .order_by('-timestamp')
            .first()
        )
        if latest_tick is None:
            return Response({
                'symbol': symbol,
                'trades': [],
                'bars': [],
                'total': 0,
                'source': 'intraday_tick_db_missing',
                'stale': True,
                'fetched_at': None,
                'source_event_at': None,
                'served_at': served_at.isoformat(),
                'age_seconds': None,
                'stale_over_threshold': False,
                'stale_threshold_seconds': None,
                'rate_limited': False,
            })

        latest_trade_date = timezone.localdate(latest_tick.timestamp)
        tick_rows = list(
            IntradayTick.objects.filter(symbol=symbol, timestamp__date=latest_trade_date)
            .order_by('-timestamp')[:page_size]
        )
        trades = [_serialize_intraday_tick(tick) for tick in tick_rows]
        age_seconds = max(int((served_at - latest_tick.timestamp).total_seconds()), 0)

        return Response({
            'symbol': symbol,
            'trades': trades,
            'bars': trades,
            'total': len(trades),
            'source': 'intraday_tick_db',
            'stale': latest_trade_date != timezone.localdate(),
            'fetched_at': latest_tick.created_at.isoformat() if latest_tick.created_at else latest_tick.timestamp.isoformat(),
            'source_event_at': latest_tick.timestamp.isoformat(),
            'served_at': served_at.isoformat(),
            'age_seconds': age_seconds,
            'stale_over_threshold': False,
            'stale_threshold_seconds': None,
            'rate_limited': False,
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
