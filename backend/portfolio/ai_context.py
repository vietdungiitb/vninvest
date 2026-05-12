from __future__ import annotations

import os
import sys
from datetime import timedelta
from decimal import Decimal
from statistics import pstdev

from django.utils import timezone
from django.db.models import Sum, Q, DecimalField, Value

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import PriceAlert
except (ImportError, RuntimeError):
    from .models import PriceAlertRule as PriceAlert  # noqa: F401 - fallback

# Legacy models (remaining)
from .models import IntradayTick, OrderFlowSignal, StockProfile, WhaleAdvisory, Transaction


def _to_float(value, default=0.0) -> float:
    if value is None:
        return float(default)
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _empty_side_stats() -> dict:
    return {
        'count': 0,
        'total_value': 0.0,
        'avg_value': 0.0,
        'max_value': 0.0,
    }


def _build_side_stats(rows: list[dict]) -> dict:
    if not rows:
        return _empty_side_stats()
    values = [_to_float(row.get('price')) * _to_float(row.get('volume')) for row in rows]
    if not values:
        return _empty_side_stats()
    total_value = sum(values)
    return {
        'count': len(values),
        'total_value': float(total_value),
        'avg_value': float(total_value / len(values)),
        'max_value': float(max(values)),
    }


def build_symbol_ai_context(symbol: str, user=None) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    today = timezone.localdate()

    profile = StockProfile.objects.filter(symbol=normalized_symbol).values(
        'symbol', 'company_name', 'industry', 'exchange', 'listed_date'
    ).first() or {}

    from .market_data_service import MarketDataService
    daily_rows_asc = MarketDataService.get_historical_indicators(
        [normalized_symbol], 
        lookback_days=30,
        include_fields=['date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']
    ).get(normalized_symbol, [])
    
    daily_rows = list(reversed(daily_rows_asc))

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

    ticks_5d = list(
        IntradayTick.objects.filter(
            symbol=normalized_symbol,
            trade_date__gte=today - timedelta(days=4),
        )
        .values('trade_date', 'trade_time', 'price', 'volume', 'side')[:5000]
    )
    session_buy_rows = [row for row in intraday_ticks if str(row.get('side') or '').upper() == 'BUY']
    session_sell_rows = [row for row in intraday_ticks if str(row.get('side') or '').upper() == 'SELL']
    recent_5d_buy_rows = [row for row in ticks_5d if str(row.get('side') or '').upper() == 'BUY']
    recent_5d_sell_rows = [row for row in ticks_5d if str(row.get('side') or '').upper() == 'SELL']

    order_stats = {
        'session': {
            'buy': _build_side_stats(session_buy_rows),
            'sell': _build_side_stats(session_sell_rows),
        },
        'five_day': {
            'buy': _build_side_stats(recent_5d_buy_rows),
            'sell': _build_side_stats(recent_5d_sell_rows),
        },
    }

    active_alerts_count = PriceAlert.objects.filter(symbol=normalized_symbol, is_enabled=True).count()

    # Recent advisories: only include user-owned ones to avoid legacy/placeholder records
    advisory_qs = WhaleAdvisory.objects.filter(symbol=normalized_symbol)
    if user is not None:
        advisory_qs = advisory_qs.filter(user=user)
    else:
        # If no user specified, return empty advisory history
        advisory_qs = advisory_qs.filter(user__isnull=False).none()
    recent_advisories = list(
        advisory_qs.order_by('-created_at')
        .values('created_at', 'side', 'matched_value', 'ai_provider', 'ai_model')[:5]
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

    # PHASE 1 Enhancement: Get user's portfolio position for this symbol
    portfolio_position = None
    if user is not None:
        tx_rows = Transaction.objects.filter(
            sub_account__portfolio__user=user,
            symbol=normalized_symbol,
        ).values_list('price', 'quantity')

        total_shares = 0.0
        total_cost = 0.0
        for raw_price, raw_quantity in tx_rows:
            quantity = _to_float(raw_quantity)
            price = _to_float(raw_price)
            total_shares += quantity
            total_cost += price * quantity
        
        if total_shares != 0:
            avg_cost = total_cost / total_shares if total_shares else 0
            current_value = total_shares * latest_close
            unrealized_pnl = current_value - total_cost
            unrealized_pct = (unrealized_pnl / total_cost * 100) if total_cost else 0
            
            portfolio_position = {
                'shares_owned': int(total_shares),
                'avg_buy_price': float(avg_cost),
                'current_value': float(current_value),
                'unrealized_pnl': float(unrealized_pnl),
                'unrealized_pnl_pct': float(unrealized_pct),
            }

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
        'order_stats': order_stats,
        'history': {
            'recent_advisories': recent_advisories,
        },
        # PHASE 1 Enhancement: Include portfolio position
        'portfolio_position': portfolio_position,
        'generated_at': timezone.now().isoformat(),
    }


def render_context_for_prompt(context: dict) -> str:
    profile = context.get('profile') or {}
    market = context.get('market') or {}
    intraday = context.get('intraday') or {}
    alerts = context.get('alerts') or {}
    order_flow = context.get('order_flow') or {}
    order_stats = context.get('order_stats') or {}
    session_stats = order_stats.get('session') or {}
    five_day_stats = order_stats.get('five_day') or {}

    session_buy = session_stats.get('buy') or _empty_side_stats()
    session_sell = session_stats.get('sell') or _empty_side_stats()
    five_day_buy = five_day_stats.get('buy') or _empty_side_stats()
    five_day_sell = five_day_stats.get('sell') or _empty_side_stats()
    recent = (context.get('history') or {}).get('recent_advisories') or []
    recent_order_flow = order_flow.get('recent_signals') or []

    recent_lines = []
    for row in recent[:3]:
        ts = str(row.get('created_at') or '')
        side = str(row.get('side') or 'UNKNOWN')
        value = _to_float(row.get('matched_value'))
        provider = str(row.get('ai_provider') or '')
        model = str(row.get('ai_model') or '')
        provider_label = f'{provider}/{model}' if model else provider
        recent_lines.append(f"- {ts}: {side} {value:,.0f} VND ({provider_label})")
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
        f"BUY/SELL stats session: BUY count {session_buy.get('count', 0)}, total {session_buy.get('total_value', 0):,.0f} VND, max {session_buy.get('max_value', 0):,.0f} | SELL count {session_sell.get('count', 0)}, total {session_sell.get('total_value', 0):,.0f} VND, max {session_sell.get('max_value', 0):,.0f}\n"
        f"BUY/SELL stats 5D: BUY count {five_day_buy.get('count', 0)}, total {five_day_buy.get('total_value', 0):,.0f} VND, max {five_day_buy.get('max_value', 0):,.0f} | SELL count {five_day_sell.get('count', 0)}, total {five_day_sell.get('total_value', 0):,.0f} VND, max {five_day_sell.get('max_value', 0):,.0f}\n"
        f"Recent order-flow signals:\n{order_flow_block}\n"
        f"Recent advisories:\n{recent_block}\n"
        f"Use this context to reduce hallucination and ground recommendations in data."
    )


def render_concise_context_for_prompt(context: dict) -> str:
    """
    PHASE 1: Render compact context (5-10 lines) for concise advisory generation.
    Optimized for token efficiency without losing critical information.
    """
    profile = context.get('profile') or {}
    market = context.get('market') or {}
    intraday = context.get('intraday') or {}
    portfolio_pos = context.get('portfolio_position')
    order_flow = context.get('order_flow') or {}
    order_stats = context.get('order_stats') or {}
    session_stats = order_stats.get('session') or {}
    session_buy = session_stats.get('buy') or _empty_side_stats()
    session_sell = session_stats.get('sell') or _empty_side_stats()
    
    lines = [
        f"Symbol: {context.get('symbol')} | {profile.get('company_name', 'N/A')} | {profile.get('industry', 'N/A')}",
        f"Price: {market.get('latest_close', 0):,.2f} VND | Change: 1D {market.get('change_1d_pct', 0):.1f}%, 5D {market.get('change_5d_pct', 0):.1f}%, 20D {market.get('change_20d_pct', 0):.1f}%",
        f"Today: {intraday.get('total_value_today', 0):,.0f} VND traded (buy {intraday.get('buy_value_today', 0):,.0f}, sell {intraday.get('sell_value_today', 0):,.0f})",
        f"Session BUY/SELL ticks: buy {session_buy.get('count', 0)} (max {session_buy.get('max_value', 0):,.0f} VND), sell {session_sell.get('count', 0)} (max {session_sell.get('max_value', 0):,.0f} VND)",
        f"Order flow: {order_flow.get('latest_signal_type', 'none')} | Confidence: {order_flow.get('latest_confidence', 'low')} | Strength: {order_flow.get('latest_strength', 0):.1f}",
    ]
    
    if portfolio_pos:
        lines.append(f"Your position: {portfolio_pos.get('shares_owned', 0)} shares @ avg {portfolio_pos.get('avg_buy_price', 0):.2f} | P&L: {portfolio_pos.get('unrealized_pnl', 0):+,.0f} ({portfolio_pos.get('unrealized_pnl_pct', 0):+.1f}%)")
    
    return "\n".join(lines)
