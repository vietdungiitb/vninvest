"""Whale Orders API for Bubble Chart visualization.

This endpoint now consumes the same canonical whale feed contract used by
alerts, then adapts it into bubble-chart coordinates.
"""
from datetime import datetime, timedelta
from decimal import Decimal
import pytz

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .market_data_service import market_data_service
from .models import TickerSessionClose
from .permissions import IsProPlan


# Constants
MARKET_OPEN_HOUR = 9  # 9:00 AM
MARKET_CLOSE_HOUR = 15  # 3:00 PM (15:00)
TIMEZONE_VN = pytz.timezone('Asia/Ho_Chi_Minh')


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
        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            return None

        def _resolve_from_queryset(base_qs):
            # Prefer the latest session not newer than requested trade_date.
            session = base_qs.filter(session_date__lte=trade_date).order_by('-session_date', '-captured_at').first()
            if session:
                return session.prev_close_price or session.close_price
            return None

        ref_price = _resolve_from_queryset(
            TickerSessionClose.objects.filter(symbol=normalized_symbol, market_code='VN_STOCK')
        )
        if ref_price:
            return ref_price

        # Fallback for unexpected market_code drift in stored snapshots.
        ref_price = _resolve_from_queryset(TickerSessionClose.objects.filter(symbol=normalized_symbol))
        if ref_price:
            return ref_price
    except Exception as e:
        print(f"[WhaleOrders] Error fetching reference price for {symbol}: {e}")
    
    return None


def _calculate_bubbles(orders: list, ref_price: Decimal | None, session_start_time, whale_threshold_vnd: float) -> list:
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
    resolved_threshold_vnd = float(whale_threshold_vnd or 0)
    
    for order in orders:
        try:
            # Canonical order comes from whale_feed contract.
            ts_value = order.get('ts')
            if ts_value:
                dt_local = datetime.fromisoformat(str(ts_value).replace('Z', '+00:00'))
                if dt_local.tzinfo is None:
                    dt_local = pytz.UTC.localize(dt_local)
                dt_local = dt_local.astimezone(TIMEZONE_VN)
            else:
                raw_time = str(order.get('time') or '').strip()
                parsed_time = datetime.strptime(raw_time, '%H:%M:%S').time()
                dt_naive = datetime.combine(session_start_time.date(), parsed_time)
                dt_local = TIMEZONE_VN.localize(dt_naive)
            
            # X-axis: minutes since session start (9:00 AM)
            time_delta = dt_local - session_start_time
            x_minutes = time_delta.total_seconds() / 60.0
            
            # Y-axis: price difference from reference (degraded mode keeps bubbles at y=0)
            price_decimal = Decimal(str(order.get('price') or 0))
            if ref_price:
                y_vnd = float(price_decimal - ref_price)
                y_pct = float((price_decimal - ref_price) / ref_price * 100)
            else:
                y_vnd = 0.0
                y_pct = 0.0
            
            # Size: normalize matched_value using sqrt for better visual scaling
            matched_value = float(order.get('matched_value') or 0)
            if matched_value <= 0:
                matched_value = float(order.get('volume') or 0) * float(price_decimal)
            size = (matched_value ** 0.5) / 1000  # Scale down for ECharts

            normalized_side = str(order.get('side') or 'neutral').strip().lower()
            if normalized_side in ('buy', 'bu', 'b'):
                side = 'BUY'
            elif normalized_side in ('sell', 'sd', 's'):
                side = 'SELL'
            else:
                side = 'NEUTRAL'
            
            bubble = {
                'ts': dt_local.isoformat(),
                'price': float(price_decimal),
                'volume': int(float(order.get('volume') or 0)),
                'matched_value': matched_value,
                'x': x_minutes,  # minutes since session start
                'y_vnd': y_vnd,  # price delta (VND)
                'y_pct': y_pct,  # percentage delta
                'size': size,
                'side': side,
                'is_large': resolved_threshold_vnd > 0 and matched_value >= resolved_threshold_vnd,
                'event_score': order.get('event_score'),
                'display_score': order.get('display_score'),
                'severity': order.get('severity'),
            }
            bubbles.append(bubble)
        except Exception as e:
            print(f"[WhaleOrders] Error calculating bubble: {e}")
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
        side = str(order.get('side') or '').strip().lower()
        if side in ('buy', 'bu', 'b'):
            categorized['buy'].append(order)
        elif side in ('sell', 'sd', 's'):
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

    whale_payload = market_data_service.get_whale_feed(request.user, symbol)
    whale_threshold_vnd = float(whale_payload.get('threshold') or 0)

    filtered_orders = []
    for order in whale_payload.get('whale_orders') or []:
        try:
            ts_raw = str(order.get('ts') or '').replace('Z', '+00:00')
            order_dt = datetime.fromisoformat(ts_raw)
            if order_dt.tzinfo is None:
                order_dt = pytz.UTC.localize(order_dt)
            order_dt_local = order_dt.astimezone(TIMEZONE_VN)
        except Exception:
            continue

        if start_dt <= order_dt_local <= end_dt:
            filtered_orders.append(order)

    
    # Calculate bubbles with coordinates
    session_start = _get_session_start_time(trade_date)
    bubbles = _calculate_bubbles(filtered_orders, ref_price, session_start, whale_threshold_vnd)
    
    # Categorize by side
    categorized = _categorize_orders(filtered_orders)
    
    # Build categorized bubble response
    response_orders = {
        'buy': _calculate_bubbles(categorized['buy'], ref_price, session_start, whale_threshold_vnd),
        'sell': _calculate_bubbles(categorized['sell'], ref_price, session_start, whale_threshold_vnd),
        'internal': _calculate_bubbles(categorized['internal'], ref_price, session_start, whale_threshold_vnd),
    }
    
    session_end = _get_session_start_time(trade_date).replace(hour=MARKET_CLOSE_HOUR)
    
    return Response({
        'ok': True,
        'symbol': symbol,
        'ref_price': float(ref_price) if ref_price is not None else None,
        'session_start': session_start.isoformat(),
        'session_end': session_end.isoformat(),
        'timeframe': timeframe,
        'source': whale_payload.get('source'),
        'threshold': whale_payload.get('threshold'),
        'threshold_source': whale_payload.get('threshold_source'),
        'source_event_at': whale_payload.get('source_event_at'),
        'fetched_at': whale_payload.get('fetched_at'),
        'degraded_mode': ref_price is None,
        'degraded_mode_reason': 'missing_ref_price' if ref_price is None else None,
        'event_count': len(filtered_orders),
        'quality_flags': {
            'missing_reference_price': ref_price is None,
            'canonical_feed_source': whale_payload.get('source'),
        },
        'data_range': {
            'start': start_dt.isoformat(),
            'end': end_dt.isoformat(),
        },
        'orders': response_orders,
        'message': f'Không có giá tham chiếu cho {symbol}; biểu đồ đang chạy chế độ degraded.' if ref_price is None else None,
        'summary': {
            'total_orders': len(bubbles),
            'buy_orders': len(response_orders['buy']),
            'sell_orders': len(response_orders['sell']),
            'internal_orders': len(response_orders['internal']),
            'buy_volume': sum(b['volume'] for b in response_orders['buy']),
            'sell_volume': sum(b['volume'] for b in response_orders['sell']),
        },
    })
