"""
Whale Orders API for Bubble Chart Visualization.
Provides intraday order flow data with reference price normalization.
"""
from datetime import datetime, timedelta
from decimal import Decimal
import pytz

from django.db.models import Q, F
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import IntradayTick, TickerSessionClose
from .permissions import IsProPlan


# Constants
MARKET_OPEN_HOUR = 9  # 9:00 AM
MARKET_CLOSE_HOUR = 15  # 3:00 PM (15:00)
TIMEZONE_VN = pytz.timezone('Asia/Ho_Chi_Minh')

# Default thresholds for categorizing "large" orders (in VND)
DEFAULT_LARGE_ORDER_THRESHOLD = 1_000_000_000  # 1 billion VND


def _get_session_start_time(trade_date):
    """
    Get the market session start time (9:00 AM) for a given trade date.
    Returns datetime in Asia/Ho_Chi_Minh timezone.
    """
    dt = datetime.combine(trade_date, datetime.min.time()).replace(hour=MARKET_OPEN_HOUR)
    return TIMEZONE_VN.localize(dt)


def _get_reference_price(symbol: str, trade_date) -> Decimal:
    """
    Get the reference price (prev_close_price) for a symbol on a given date.
    Falls back to close_price if prev_close_price is not available.
    
    Returns: Decimal price or None if not found
    """
    try:
        session = TickerSessionClose.objects.filter(
            symbol=symbol.upper(),
            session_date=trade_date,
            market_code='VN_STOCK'
        ).first()
        
        if session:
            # Prefer prev_close_price; fallback to close_price
            ref_price = session.prev_close_price or session.close_price
            if ref_price:
                return ref_price
    except Exception as e:
        print(f"[WhaleOrders] Error fetching reference price for {symbol}: {e}")
    
    return None


def _calculate_bubbles(orders: list, ref_price: Decimal, session_start_time) -> list:
    """
    Convert IntradayTick orders to bubble chart coordinates.
    
    Args:
        orders: List of IntradayTick objects
        ref_price: Reference price for Y-axis centering
        session_start_time: Market session start time (9:00 AM)
    
    Returns:
        List of bubble data dicts with coordinates and metadata
    """
    bubbles = []
    
    if not ref_price:
        return bubbles
    
    for order in orders:
        try:
            # Combine trade_date and trade_time into datetime
            dt_naive = datetime.combine(order.trade_date, order.trade_time)
            dt_local = TIMEZONE_VN.localize(dt_naive)
            
            # X-axis: minutes since session start (9:00 AM)
            time_delta = dt_local - session_start_time
            x_minutes = time_delta.total_seconds() / 60.0
            
            # Y-axis: price difference from reference
            price_decimal = Decimal(str(order.price))
            y_vnd = float(price_decimal - ref_price)
            y_pct = float((price_decimal - ref_price) / ref_price * 100) if ref_price else 0.0
            
            # Size: normalize matched_value using sqrt for better visual scaling
            matched_value = float(order.volume) * float(price_decimal)
            size = (matched_value ** 0.5) / 1000  # Scale down for ECharts
            
            bubble = {
                'ts': dt_local.isoformat(),
                'price': float(price_decimal),
                'volume': order.volume,
                'matched_value': matched_value,
                'x': x_minutes,  # minutes since session start
                'y_vnd': y_vnd,  # price delta (VND)
                'y_pct': y_pct,  # percentage delta
                'size': size,
                'side': order.side,
                'is_large': matched_value >= DEFAULT_LARGE_ORDER_THRESHOLD,
            }
            bubbles.append(bubble)
        except Exception as e:
            print(f"[WhaleOrders] Error calculating bubble for order {order.id}: {e}")
            continue
    
    return bubbles


def _categorize_orders(orders: list) -> dict:
    """
    Separate orders into Buy, Sell, and Internal based on side.
    
    Returns:
        {
            'buy': [...],
            'sell': [...],
            'internal': [...]
        }
    """
    categorized = {
        'buy': [],
        'sell': [],
        'internal': []
    }
    
    for order in orders:
        if order.side == IntradayTick.Side.BUY:
            categorized['buy'].append(order)
        elif order.side == IntradayTick.Side.SELL:
            categorized['sell'].append(order)
        else:
            categorized['internal'].append(order)
    
    return categorized


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_orders_by_symbol_api(request, symbol: str):
    """
    GET /api/whale/orders/{symbol}/?timeframe=15m&start={ts}&end={ts}
    
    Fetch intraday order flow data for a single symbol.
    Used by Whale Bubble Chart visualization.
    
    Query Parameters:
        - timeframe: '15m', '30m', '1h', 'session' (default: 'session')
        - start: ISO timestamp (optional, overrides timeframe)
        - end: ISO timestamp (optional, defaults to now)
    
    Response:
    {
        "ok": true,
        "symbol": "VNM",
        "ref_price": 85500,
        "session_start": "2026-04-21T09:00:00+07:00",
        "session_end": "2026-04-21T15:00:00+07:00",
        "orders": {
            "buy": [...],
            "sell": [...],
            "internal": [...]
        }
    }
    """
    symbol = symbol.upper().strip()
    
    # Validate symbol format
    if not symbol or len(symbol) > 10 or not symbol.isalpha():
        return Response(
            {'ok': False, 'error': 'Invalid symbol format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Determine time range
    now = timezone.now()
    today = now.date()
    timeframe = request.query_params.get('timeframe', 'session').lower()
    
    try:
        start_param = request.query_params.get('start')
        end_param = request.query_params.get('end')
        
        if end_param:
            end_dt = datetime.fromisoformat(end_param.replace('Z', '+00:00'))
            if isinstance(end_dt, datetime) and end_dt.tzinfo is None:
                end_dt = pytz.UTC.localize(end_dt)
            end_dt = end_dt.astimezone(TIMEZONE_VN)
        else:
            end_dt = now.astimezone(TIMEZONE_VN)
        
        if start_param:
            start_dt = datetime.fromisoformat(start_param.replace('Z', '+00:00'))
            if isinstance(start_dt, datetime) and start_dt.tzinfo is None:
                start_dt = pytz.UTC.localize(start_dt)
            start_dt = start_dt.astimezone(TIMEZONE_VN)
        else:
            # Use timeframe to determine start time
            if timeframe == '15m':
                start_dt = end_dt - timedelta(minutes=15)
            elif timeframe == '30m':
                start_dt = end_dt - timedelta(minutes=30)
            elif timeframe == '1h':
                start_dt = end_dt - timedelta(hours=1)
            else:  # 'session' or default
                start_dt = _get_session_start_time(today)
    except ValueError as e:
        return Response(
            {'ok': False, 'error': f'Invalid timestamp format: {e}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Extract date from start_dt for reference price lookup
    trade_date = start_dt.date()
    
    # Get reference price
    ref_price = _get_reference_price(symbol, trade_date)
    
    if not ref_price:
        # Try yesterday if today's reference is not found
        ref_price = _get_reference_price(symbol, trade_date - timedelta(days=1))
    
    # If still no ref_price, return empty response (graceful degradation)
    if not ref_price:
        session_start = _get_session_start_time(trade_date)
        session_end = session_start.replace(hour=MARKET_CLOSE_HOUR)
        return Response({
            'ok': True,
            'symbol': symbol,
            'ref_price': None,
            'session_start': session_start.isoformat(),
            'session_end': session_end.isoformat(),
            'timeframe': timeframe,
            'data_range': {
                'start': start_dt.isoformat(),
                'end': end_dt.isoformat(),
            },
            'orders': {'buy': [], 'sell': [], 'internal': []},
            'message': f'No reference price data available for {symbol}',
        })
    
    # Fetch intraday ticks within the time range
    start_date = start_dt.date()
    end_date = end_dt.date()
    
    ticks_qs = IntradayTick.objects.filter(
        symbol=symbol,
        trade_date__gte=start_date,
        trade_date__lte=end_date
    )
    
    # If same day, also filter by time
    if start_date == end_date:
        ticks_qs = ticks_qs.filter(
            trade_time__gte=start_dt.time(),
            trade_time__lte=end_dt.time()
        )
    
    ticks = list(ticks_qs.order_by('trade_date', 'trade_time'))
    
    # Calculate bubbles with coordinates
    session_start = _get_session_start_time(trade_date)
    bubbles = _calculate_bubbles(ticks, ref_price, session_start)
    
    # Categorize by side
    categorized = _categorize_orders(ticks)
    
    # Build categorized bubble response
    response_orders = {
        'buy': _calculate_bubbles(categorized['buy'], ref_price, session_start),
        'sell': _calculate_bubbles(categorized['sell'], ref_price, session_start),
        'internal': _calculate_bubbles(categorized['internal'], ref_price, session_start),
    }
    
    session_end = _get_session_start_time(trade_date).replace(hour=MARKET_CLOSE_HOUR)
    
    return Response({
        'ok': True,
        'symbol': symbol,
        'ref_price': float(ref_price),
        'session_start': session_start.isoformat(),
        'session_end': session_end.isoformat(),
        'timeframe': timeframe,
        'data_range': {
            'start': start_dt.isoformat(),
            'end': end_dt.isoformat(),
        },
        'orders': response_orders,
        'summary': {
            'total_orders': len(bubbles),
            'buy_orders': len(response_orders['buy']),
            'sell_orders': len(response_orders['sell']),
            'internal_orders': len(response_orders['internal']),
            'buy_volume': sum(b['volume'] for b in response_orders['buy']),
            'sell_volume': sum(b['volume'] for b in response_orders['sell']),
        },
    })
