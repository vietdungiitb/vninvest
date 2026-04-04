from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from statistics import pstdev

from django.utils import timezone

from .models import DailyPrice, IntradayTick, OrderFlowSignal, PriceAlertRule, StockProfile, WhaleAdvisory


def _to_float(value, default=0.0) -> float:
    if value is None:
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def build_symbol_ai_context(symbol: str) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    today = timezone.localdate()

    profile = StockProfile.objects.filter(symbol=normalized_symbol).values(
        'symbol', 'company_name', 'industry', 'exchange', 'listed_date'
    ).first() or {}

    daily_rows = list(
        DailyPrice.objects.filter(symbol=normalized_symbol)
        .order_by('-date')
        .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')[:30]
    )

    closes = [_to_float(row['close_price']) for row in daily_rows if row.get('close_price') is not None]
    vols = [_to_float(row.get('volume')) for row in daily_rows if row.get('volume') is not None]

    latest_close = closes[0] if closes else 0.0
    change_1d_pct = ((closes[0] - closes[1]) / closes[1] * 100.0) if len(closes) >= 2 and closes[1] else 0.0
    change_5d_pct = ((closes[0] - closes[5]) / closes[5] * 100.0) if len(closes) >= 6 and closes[5] else 0.0
    change_20d_pct = ((closes[0] - closes[20]) / closes[20] * 100.0) if len(closes) >= 21 and closes[20] else 0.0
    avg_vol_20 = (sum(vols[:20]) / min(len(vols), 20)) if vols else 0.0
    volatility_20 = pstdev(closes[:20]) if len(closes) >= 5 else 0.0

    intraday_ticks = list(
        IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=today)
        .order_by('-trade_time')
        .values('trade_time', 'price', 'volume', 'side')[:500]
    )
    intraday_total_value = 0.0
    intraday_buy_value = 0.0
    intraday_sell_value = 0.0
    for tick in intraday_ticks:
        tick_value = _to_float(tick.get('price')) * _to_float(tick.get('volume'))
        intraday_total_value += tick_value
        side = str(tick.get('side') or '').upper()
        if side == 'BUY':
            intraday_buy_value += tick_value
        elif side == 'SELL':
            intraday_sell_value += tick_value

    active_alerts_count = PriceAlertRule.objects.filter(symbol=normalized_symbol, is_active=True).count()

    recent_advisories = list(
        WhaleAdvisory.objects.filter(symbol=normalized_symbol)
        .order_by('-created_at')
        .values('created_at', 'side', 'matched_value', 'ai_provider')[:5]
    )

    recent_order_flow_signals = list(
        OrderFlowSignal.objects.filter(symbol=normalized_symbol)
        .order_by('-created_at')
        .values(
            'created_at',
            'signal_type',
            'strength',
            'confidence',
            'tick_rate',
            'small_order_ratio',
        )[:5]
    )
    latest_order_flow = recent_order_flow_signals[0] if recent_order_flow_signals else {}

    return {
        'symbol': normalized_symbol,
        'profile': profile,
        'market': {
            'latest_close': latest_close,
            'change_1d_pct': change_1d_pct,
            'change_5d_pct': change_5d_pct,
            'change_20d_pct': change_20d_pct,
            'avg_volume_20': avg_vol_20,
            'volatility_20': volatility_20,
            'daily_points': len(daily_rows),
        },
        'intraday': {
            'tick_count_today': len(intraday_ticks),
            'total_value_today': intraday_total_value,
            'buy_value_today': intraday_buy_value,
            'sell_value_today': intraday_sell_value,
            'last_trade_time': str(intraday_ticks[0]['trade_time']) if intraday_ticks else '',
        },
        'alerts': {
            'active_price_alerts': active_alerts_count,
        },
        'order_flow': {
            'latest_signal_type': latest_order_flow.get('signal_type', 'none'),
            'latest_strength': _to_float(latest_order_flow.get('strength')),
            'latest_confidence': latest_order_flow.get('confidence') or 'low',
            'latest_tick_rate': _to_float(latest_order_flow.get('tick_rate')),
            'latest_small_order_ratio': _to_float(latest_order_flow.get('small_order_ratio')),
            'recent_signals': recent_order_flow_signals,
        },
        'history': {
            'recent_advisories': recent_advisories,
        },
        'generated_at': timezone.now().isoformat(),
    }


def render_context_for_prompt(context: dict) -> str:
    profile = context.get('profile') or {}
    market = context.get('market') or {}
    intraday = context.get('intraday') or {}
    alerts = context.get('alerts') or {}
    order_flow = context.get('order_flow') or {}
    recent = (context.get('history') or {}).get('recent_advisories') or []
    recent_order_flow = order_flow.get('recent_signals') or []

    recent_lines = []
    for row in recent[:3]:
        ts = str(row.get('created_at') or '')
        side = str(row.get('side') or 'UNKNOWN')
        value = _to_float(row.get('matched_value'))
        provider = str(row.get('ai_provider') or '')
        recent_lines.append(f"- {ts}: {side} {value:,.0f} VND ({provider})")
    recent_block = '\n'.join(recent_lines) if recent_lines else '- none'

    order_flow_lines = []
    for row in recent_order_flow[:3]:
        ts = str(row.get('created_at') or '')
        signal_type = str(row.get('signal_type') or 'none')
        strength = _to_float(row.get('strength'))
        confidence = str(row.get('confidence') or 'low')
        order_flow_lines.append(f"- {ts}: {signal_type} | strength {strength:.1f} | confidence {confidence}")
    order_flow_block = '\n'.join(order_flow_lines) if order_flow_lines else '- none'

    return (
        f"\n[DATA CONTEXT]\n"
        f"Symbol: {context.get('symbol')}\n"
        f"Company: {profile.get('company_name') or 'N/A'} | Industry: {profile.get('industry') or 'N/A'} | Exchange: {profile.get('exchange') or 'N/A'}\n"
        f"Latest close: {market.get('latest_close', 0):,.2f} VND\n"
        f"Change: 1D {market.get('change_1d_pct', 0):.2f}% | 5D {market.get('change_5d_pct', 0):.2f}% | 20D {market.get('change_20d_pct', 0):.2f}%\n"
        f"Avg volume 20D: {market.get('avg_volume_20', 0):,.0f} | Volatility20: {market.get('volatility_20', 0):,.2f}\n"
        f"Intraday today: ticks {intraday.get('tick_count_today', 0)}, total {intraday.get('total_value_today', 0):,.0f} VND, buy {intraday.get('buy_value_today', 0):,.0f}, sell {intraday.get('sell_value_today', 0):,.0f}\n"
        f"Active price alerts: {alerts.get('active_price_alerts', 0)}\n"
        f"Latest order flow: {order_flow.get('latest_signal_type', 'none')} | strength {order_flow.get('latest_strength', 0):.1f} | confidence {order_flow.get('latest_confidence', 'low')} | tick rate {order_flow.get('latest_tick_rate', 0):.1f} | small-order ratio {order_flow.get('latest_small_order_ratio', 0):.2f}\n"
        f"Recent order-flow signals:\n{order_flow_block}\n"
        f"Recent advisories:\n{recent_block}\n"
        f"Use this context to reduce hallucination and ground recommendations in data."
    )
