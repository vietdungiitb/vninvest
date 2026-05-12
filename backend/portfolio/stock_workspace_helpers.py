from datetime import date, timedelta
from decimal import Decimal

import os
import sys
from django.db.models import Max, Min
from rest_framework import generics

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import WatchlistItem
except (ImportError, RuntimeError):
    class WatchlistItem:
        pass

from .models import DailyPrice, SecuritiesGroup, StockProfile, TrackedSymbol
from .services import get_price_changes


def _to_float(value):
    return float(value) if value is not None else None


def _get_exchange_price_band(exchange):
    normalized_exchange = (exchange or '').strip().upper()
    if normalized_exchange == 'HNX':
        return Decimal('0.10')
    if normalized_exchange in {'UPCOM', 'UPCOM'}:
        return Decimal('0.15')
    return Decimal('0.07')


def _build_stock_workspace_overview(symbol, user):
    normalized_symbol = (symbol or '').strip().upper()
    profile = generics.get_object_or_404(StockProfile, symbol=normalized_symbol)
    latest_daily_price = (
        DailyPrice.objects
        .filter(symbol=normalized_symbol)
        .order_by('-date')
        .values('open_price', 'high_price', 'low_price', 'close_price', 'volume')
        .first()
    )
    price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
    year_stats = (
        DailyPrice.objects
        .filter(symbol=normalized_symbol, date__gte=date.today() - timedelta(days=365))
        .aggregate(week52_high=Max('high_price'), week52_low=Min('low_price'))
    )

    average_price = None
    if latest_daily_price:
        numeric_prices = [
            value
            for value in [
                latest_daily_price.get('open_price'),
                latest_daily_price.get('high_price'),
                latest_daily_price.get('low_price'),
                latest_daily_price.get('close_price'),
            ]
            if value is not None
        ]
        if numeric_prices:
            average_price = _to_float(sum(numeric_prices, Decimal('0')) / Decimal(len(numeric_prices)))

    reference_price = price_info.get('prev_price')
    if reference_price is None and latest_daily_price:
        reference_price = _to_float(latest_daily_price.get('close_price'))

    ceiling_price = None
    floor_price = None
    if reference_price is not None:
        reference_decimal = Decimal(str(reference_price))
        band = _get_exchange_price_band(profile.exchange)
        ceiling_price = _to_float(reference_decimal * (Decimal('1') + band))
        floor_price = _to_float(reference_decimal * (Decimal('1') - band))

    tracked_item = None
    market_groups = []
    watchlist_groups = []
    market_group_refs = []
    watchlist_memberships = []
    if user and user.is_authenticated:
        tracked_item = (
            TrackedSymbol.objects
            .select_related('source_group')
            .filter(user=user, symbol=normalized_symbol)
            .first()
        )
        market_group_refs = list(
            SecuritiesGroup.objects
            .filter(items__symbol=normalized_symbol)
            .order_by('name')
            .values('id', 'name')
            .distinct()
        )
        market_groups = [group['name'] for group in market_group_refs]
        watchlist_memberships = list(
            WatchlistItem.objects
            .filter(watchlist__user=user, symbol=normalized_symbol)
            .select_related('watchlist')
            .order_by('watchlist__name')
            .values('id', 'watchlist_id', 'watchlist__name')
        )
        watchlist_groups = [item['watchlist__name'] for item in watchlist_memberships]

    return {
        'tracked_symbol_id': tracked_item.id if tracked_item else None,
        'symbol': profile.symbol,
        'company_name': profile.company_name,
        'industry': profile.industry,
        'exchange': profile.exchange,
        'listed_date': profile.listed_date,
        'is_active': profile.is_active,
        'updated_at': profile.updated_at,
        'current_price': price_info.get('current_price'),
        'prev_price': price_info.get('prev_price'),
        'change_value': price_info.get('change_value'),
        'change_pct': price_info.get('change_pct'),
        'last_date': price_info.get('last_date'),
        'open_price': _to_float(latest_daily_price.get('open_price')) if latest_daily_price else None,
        'high_price': _to_float(latest_daily_price.get('high_price')) if latest_daily_price else None,
        'low_price': _to_float(latest_daily_price.get('low_price')) if latest_daily_price else None,
        'close_price': _to_float(latest_daily_price.get('close_price')) if latest_daily_price else None,
        'volume': latest_daily_price.get('volume') if latest_daily_price else None,
        'average_price': average_price,
        'reference_price': reference_price,
        'ceiling_price': ceiling_price,
        'floor_price': floor_price,
        'week52_high': _to_float(year_stats.get('week52_high')),
        'week52_low': _to_float(year_stats.get('week52_low')),
        'is_tracked': tracked_item is not None,
        'source_group_name': tracked_item.source_group.name if tracked_item and tracked_item.source_group else None,
        'market_groups': market_groups,
        'watchlist_groups': watchlist_groups,
        'market_group_refs': market_group_refs,
        'watchlist_memberships': [
            {
                'item_id': item['id'],
                'group_id': item['group_id'],
                'group_name': item['group__name'],
            }
            for item in watchlist_memberships
        ],
    }


def _safe_round(value, digits=2):
    if value is None:
        return None
    return round(float(value), digits)


def _compute_rsi(values, window=14):
    if len(values) <= window:
        return None

    deltas = [values[index] - values[index - 1] for index in range(1, len(values))]
    gains = [max(delta, 0) for delta in deltas]
    losses = [abs(min(delta, 0)) for delta in deltas]
    recent_gains = gains[-window:]
    recent_losses = losses[-window:]

    average_gain = sum(recent_gains) / window
    average_loss = sum(recent_losses) / window
    if average_loss == 0:
        return 100.0 if average_gain > 0 else 50.0

    rs = average_gain / average_loss
    return 100 - (100 / (1 + rs))


def _compute_ema(values, period):
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    ema = sum(values[:period]) / period
    for v in values[period:]:
        ema = v * k + ema * (1 - k)
    return ema


def _compute_macd_hist(values):
    if len(values) < 35:
        return None
    k12 = 2.0 / 13
    k26 = 2.0 / 27
    k9 = 2.0 / 10
    ema12 = sum(values[:12]) / 12
    ema26 = sum(values[:26]) / 26
    macd_series = []
    for i, v in enumerate(values[1:], start=1):
        ema12 = v * k12 + ema12 * (1 - k12)
        ema26 = v * k26 + ema26 * (1 - k26)
        if i >= 25:
            macd_series.append(ema12 - ema26)
    if len(macd_series) < 9:
        return None
    signal = sum(macd_series[:9]) / 9
    for m in macd_series[9:]:
        signal = m * k9 + signal * (1 - k9)
    return macd_series[-1] - signal


def _technical_bias_meta(bias):
    normalized_bias = (bias or 'NEUTRAL').strip().upper()
    if normalized_bias == 'BULLISH':
        return {
            'bias': 'BULLISH',
            'bias_label': 'Tăng',
            'bias_description': 'Giá đang nằm trên SMA20 và SMA50, động lượng duy trì tích cực.',
        }
    if normalized_bias == 'WEAK':
        return {
            'bias': 'WEAK',
            'bias_label': 'Yếu',
            'bias_description': 'Giá đang nằm dưới các đường trung bình và động lượng suy yếu.',
        }
    return {
        'bias': 'NEUTRAL',
        'bias_label': 'Trung tính',
        'bias_description': 'Cấu trúc giá chưa nghiêng rõ theo một hướng mạnh.',
    }


def _compute_stock_workspace_technical(rows, overview):
    close_values = [float(row['close_price']) for row in rows if row.get('close_price') is not None]
    volume_values = [float(row['volume']) for row in rows if row.get('volume') is not None]
    latest_close = close_values[-1] if close_values else None

    sma20 = sum(close_values[-20:]) / 20 if len(close_values) >= 20 else None
    sma50 = sum(close_values[-50:]) / 50 if len(close_values) >= 50 else None
    rsi14 = _compute_rsi(close_values, 14)
    avg_volume_20 = sum(volume_values[-20:]) / 20 if len(volume_values) >= 20 else None
    momentum_20d_pct = None
    if len(close_values) >= 21 and close_values[-21] > 0:
        momentum_20d_pct = ((close_values[-1] - close_values[-21]) / close_values[-21]) * 100

    range_position_pct = None
    week52_low = overview.get('week52_low')
    week52_high = overview.get('week52_high')
    if latest_close is not None and week52_low is not None and week52_high is not None and week52_high > week52_low:
        range_position_pct = ((latest_close - week52_low) / (week52_high - week52_low)) * 100

    price_vs_sma20_pct = None
    if latest_close is not None and sma20:
        price_vs_sma20_pct = ((latest_close - sma20) / sma20) * 100

    price_vs_sma50_pct = None
    if latest_close is not None and sma50:
        price_vs_sma50_pct = ((latest_close - sma50) / sma50) * 100

    bias = 'NEUTRAL'
    if latest_close is not None and sma20 and sma50 and rsi14 is not None:
        if latest_close > sma20 > sma50 and rsi14 >= 55:
            bias = 'BULLISH'
        elif latest_close < sma20 < sma50 and rsi14 <= 45:
            bias = 'WEAK'

    bias_meta = _technical_bias_meta(bias)

    return {
        **bias_meta,
        'sma20': _safe_round(sma20),
        'sma50': _safe_round(sma50),
        'rsi14': _safe_round(rsi14),
        'avg_volume_20': _safe_round(avg_volume_20),
        'price_vs_sma20_pct': _safe_round(price_vs_sma20_pct),
        'price_vs_sma50_pct': _safe_round(price_vs_sma50_pct),
        'momentum_20d_pct': _safe_round(momentum_20d_pct),
        'range_position_pct': _safe_round(range_position_pct),
        'latest_close': _safe_round(latest_close),
    }
