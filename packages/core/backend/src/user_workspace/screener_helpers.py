import numpy as np
from decimal import Decimal
from django.utils import timezone

_SCREENER_ALLOWED_FIELDS = {
    # Price & Volume
    'close', 'volume',
    # Technical - Momentum/Trend
    'rsi_14', 'sma20', 'sma50',
    'momentum_20d_pct', 'price_vs_sma20_pct', 'price_vs_sma50_pct',
    'range_position_pct', 'avg_volume_20',
    # Technical - Advanced (NEW)
    'stochastic_k', 'stochastic_d', 'atr_14', 'adx_14',
    'bollinger_width', 'vwap', 'mfi_14',
    # Technical - MACD
    'macd_hist', 'volume_rvol', 'sma20_vs_sma50_pct',
    # Whale
    'whale_buy_value', 'whale_sell_value', 'whale_unknown_value',
    'whale_total_value', 'whale_net_value', 'whale_buy_pct',
    'whale_sell_pct', 'whale_unknown_pct', 'whale_trade_count',
    'whale_whale_value', 'whale_shark_value', 'whale_small_value',
    'whale_intensity',
    # Dark Pool
    'dark_flow_strength', 'dark_flow_avg_strength', 'dark_flow_max_strength',
    'dark_flow_signal_count', 'dark_flow_cvd',
    # Fundamental (NEW)
    'pe_ratio', 'market_cap', 'dividend_yield',
    'eps_growth_yoy', 'revenue_growth_yoy', 'debt_to_equity',
}
_SCREENER_ALLOWED_OPS = {'lt', 'lte', 'gt', 'gte', 'eq'}

def _validate_screener_rules(rules_json):
    """
    Kiểm tra cú pháp rules_json.
    rules_json phải là list[dict] với mỗi dict có: field (str), op (str), value (number).
    Trả về (ok: bool, error_msg: str)
    """
    if not isinstance(rules_json, list) or len(rules_json) == 0:
        return False, 'rules_json phải là list không rỗng.'
    for i, cond in enumerate(rules_json):
        if not isinstance(cond, dict):
            return False, f'Condition #{i} phải là object.'
        field = cond.get('field')
        op = cond.get('op')
        value = cond.get('value')
        if field not in _SCREENER_ALLOWED_FIELDS:
            return False, f'Field "{field}" không hợp lệ. Cho phép: {sorted(_SCREENER_ALLOWED_FIELDS)}.'
        if op not in _SCREENER_ALLOWED_OPS:
            return False, f'Op "{op}" không hợp lệ. Cho phép: {sorted(_SCREENER_ALLOWED_OPS)}.'
        if not isinstance(value, (int, float)):
            return False, f'Value của condition #{i} phải là số.'
    return True, ''

def _apply_screener_condition(field_val, op, target_val):
    if field_val is None:
        return False
    try:
        fv = float(field_val)
        tv = float(target_val)
    except (TypeError, ValueError):
        return False
    if op == 'lt':  return fv < tv
    if op == 'lte': return fv <= tv
    if op == 'gt':  return fv > tv
    if op == 'gte': return fv >= tv
    if op == 'eq':  return abs(fv - tv) < 1e-9
    return False

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

def _compute_stochastic(highs, lows, closes, k_period=14, d_period=3):
    """Compute Stochastic %K and %D."""
    if len(closes) < k_period:
        return None, None
    
    k_values = []
    for i in range(k_period - 1, len(closes)):
        period_highs = highs[i - k_period + 1:i + 1]
        period_lows = lows[i - k_period + 1:i + 1]
        highest_high = max(period_highs)
        lowest_low = min(period_lows)
        if highest_high == lowest_low:
            k_values.append(50.0)
        else:
            k = ((closes[i] - lowest_low) / (highest_high - lowest_low)) * 100
            k_values.append(k)
    
    if len(k_values) < d_period:
        return k_values[-1] if k_values else None, None
    
    d_values = []
    for i in range(d_period - 1, len(k_values)):
        d = sum(k_values[i - d_period + 1:i + 1]) / d_period
        d_values.append(d)
    
    return k_values[-1], d_values[-1] if d_values else None

def _compute_atr(highs, lows, closes, window=14):
    """Compute Average True Range (ATR)."""
    if len(closes) <= window:
        return None
    
    tr_values = []
    for i in range(1, len(closes)):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1])
        )
        tr_values.append(tr)
    
    if len(tr_values) < window:
        return None
    
    return sum(tr_values[-window:]) / window

def _compute_adx(highs, lows, closes, window=14):
    """Compute Average Directional Index (ADX). Simplified version."""
    if len(closes) < window + 1:
        return None
    
    plus_dm = []
    minus_dm = []
    tr_values = []
    
    for i in range(1, len(closes)):
        up_move = highs[i] - highs[i - 1]
        down_move = lows[i - 1] - lows[i]
        
        plus_dm.append(up_move if up_move > down_move and up_move > 0 else 0)
        minus_dm.append(down_move if down_move > up_move and down_move > 0 else 0)
        
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1])
        )
        tr_values.append(tr)
    
    if len(tr_values) < window:
        return None
    
    atr = sum(tr_values[-window:]) / window
    if atr == 0:
        return None
    
    plus_di = 100 * (sum(plus_dm[-window:]) / window) / atr
    minus_di = 100 * (sum(minus_dm[-window:]) / window) / atr
    
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di) if (plus_di + minus_di) > 0 else 0
    return dx

def _compute_bollinger_width(closes, window=20, num_std=2):
    """Compute Bollinger Band Width."""
    if len(closes) < window:
        return None
    
    sma = sum(closes[-window:]) / window
    variance = sum((c - sma) ** 2 for c in closes[-window:]) / window
    std = variance ** 0.5
    
    upper = sma + num_std * std
    lower = sma - num_std * std
    
    if sma == 0:
        return None
    return ((upper - lower) / sma) * 100

def _compute_vwap(closes, volumes, window=20):
    """Compute Volume Weighted Average Price (VWAP)."""
    if len(closes) < window or len(volumes) < window:
        return None
    
    pv_sum = sum(c * v for c, v in zip(closes[-window:], volumes[-window:]))
    vol_sum = sum(volumes[-window:])
    
    if vol_sum == 0:
        return None
    return pv_sum / vol_sum

def _compute_mfi(highs, lows, closes, volumes, window=14):
    """Compute Money Flow Index (MFI)."""
    if len(closes) <= window:
        return None
    
    typical_prices = [(h + l + c) / 3 for h, l, c in zip(highs, lows, closes)]
    money_flows = [tp * v for tp, v in zip(typical_prices, volumes)]
    
    positive_flow = 0
    negative_flow = 0
    for i in range(1, len(typical_prices)):
        if typical_prices[i] > typical_prices[i - 1]:
            positive_flow += money_flows[i]
        elif typical_prices[i] < typical_prices[i - 1]:
            negative_flow += money_flows[i]
    
    if negative_flow == 0:
        return 100.0
    
    mfr = positive_flow / negative_flow
    return 100 - (100 / (1 + mfr))

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

def _compute_fundamental_metrics(financials, close=None, outstanding_shares=None):
    """Extract the 6 core fundamental metrics from a vnbroker financials dict.

    Args:
        financials: dict with 'ratio', 'income_statement', 'balance_sheet' (from fetch_company_financials)
        close: Optional current close price (for market_cap)
        outstanding_shares: Optional shares outstanding (preferred source for market_cap over ratio payload)

    Returns:
        dict with pe_ratio, market_cap, dividend_yield, eps_growth_yoy, revenue_growth_yoy, debt_to_equity
    """
    pe_ratio = market_cap = dividend_yield = eps_growth_yoy = revenue_growth_yoy = debt_to_equity = None

    if financials:
        ratios = financials.get('ratio', []) or []
        if ratios:
            latest_ratio = ratios[0]
            pe_ratio = _safe_round(latest_ratio.get('pe_ratio') or latest_ratio.get('pe'))
            dividend_yield = _safe_round(latest_ratio.get('dividend_yield') or latest_ratio.get('div_yield'))

            os_shares = outstanding_shares or latest_ratio.get('outstanding_shares') or latest_ratio.get('shares_outstanding')
            if close and os_shares:
                market_cap = _safe_round(float(close) * float(os_shares) / 1_000_000_000, 2)  # Billions VND

            eps_current = latest_ratio.get('eps') or latest_ratio.get('basic_eps')
            eps_prev = None
            if len(ratios) >= 5:
                eps_prev = ratios[4].get('eps') or ratios[4].get('basic_eps')
            if eps_current and eps_prev and float(eps_prev) != 0:
                eps_growth_yoy = _safe_round(((float(eps_current) / float(eps_prev) - 1) * 100))

        income_stmt = financials.get('income_statement', []) or []
        if income_stmt and len(income_stmt) >= 2:
            rev_current = income_stmt[0].get('revenue') or income_stmt[0].get('total_revenue')
            rev_prev = income_stmt[1].get('revenue') or income_stmt[1].get('total_revenue')
            if rev_current and rev_prev and float(rev_prev) > 0:
                revenue_growth_yoy = _safe_round(((float(rev_current) / float(rev_prev) - 1) * 100))

        balance_sheet = financials.get('balance_sheet', []) or []
        if balance_sheet:
            latest_bs = balance_sheet[0]
            total_debt = latest_bs.get('total_debt') or (
                (latest_bs.get('short_term_debt', 0) or 0) + (latest_bs.get('long_term_debt', 0) or 0)
            )
            total_equity = latest_bs.get('total_equity') or latest_bs.get('equity')
            if total_debt and total_equity and float(total_equity) > 0:
                debt_to_equity = _safe_round(float(total_debt) / float(total_equity))

    return {
        'pe_ratio': pe_ratio,
        'market_cap': market_cap,
        'dividend_yield': dividend_yield,
        'eps_growth_yoy': eps_growth_yoy,
        'revenue_growth_yoy': revenue_growth_yoy,
        'debt_to_equity': debt_to_equity,
    }


def _screener_build_technical(symbol, close, volume, history_list, financials=None, fundamental_metrics=None):
    """Build a technical-feature dict for one symbol from history data.

    Args:
        symbol: Stock symbol
        close: Current close price
        volume: Current volume
        history_list: List of DailyPrice objects for historical data
        financials: Optional dict with financial data from vnbroker (ratio, income_statement, balance_sheet)
        fundamental_metrics: Optional pre-computed dict of the 6 fundamental metrics
            (derived from cached vnbroker financials via _compute_fundamental_metrics).
            When provided it takes precedence over deriving from `financials`.
    """
    closes = [float(p.close) for p in history_list]
    volumes = [float(p.volume) for p in history_list]
    highs = [float(p.high) for p in history_list]
    lows = [float(p.low) for p in history_list]

    if close is not None:
        closes.append(float(close))
        highs.append(float(close))
        lows.append(float(close))
    if volume is not None:
        volumes.append(float(volume))

    sma20 = (sum(closes[-20:]) / 20) if len(closes) >= 20 else None
    sma50 = (sum(closes[-50:]) / 50) if len(closes) >= 50 else None
    rsi_14 = _safe_round(_compute_rsi(closes, 14))
    momentum_20d = _safe_round(
        ((closes[-1] / closes[-21] - 1) * 100) if len(closes) >= 21 and closes[-21] > 0 else None
    )
    price_vs_sma20 = _safe_round(
        ((float(close) / sma20 - 1) * 100) if close and sma20 else None
    )
    price_vs_sma50 = _safe_round(
        ((float(close) / sma50 - 1) * 100) if close and sma50 else None
    )
    hi52 = max(highs[-52:]) if len(highs) >= 52 else None
    lo52 = min(lows[-52:]) if len(lows) >= 52 else None
    range_pos = _safe_round(
        ((float(close) - lo52) / (hi52 - lo52) * 100) if close and hi52 and lo52 and (hi52 - lo52) > 0 else None
    )
    avg_vol20 = _safe_round(
        (sum(volumes[-20:]) / 20) if len(volumes) >= 20 else None
    )
    macd_hist = _safe_round(_compute_macd_hist(closes), 4)
    volume_rvol = _safe_round(
        (float(volume) / (sum(volumes[-20:]) / 20)) if volume and len(volumes) >= 20 else None
    )
    sma20_vs_sma50_pct = _safe_round(
        ((sma20 / sma50 - 1) * 100) if sma20 and sma50 else None
    )
    
    # Advanced technical indicators (NEW)
    stochastic_k, stochastic_d = _compute_stochastic(highs, lows, closes)
    atr_14 = _safe_round(_compute_atr(highs, lows, closes))
    adx_14 = _safe_round(_compute_adx(highs, lows, closes))
    bollinger_width = _safe_round(_compute_bollinger_width(closes))
    vwap = _safe_round(_compute_vwap(closes, volumes))
    mfi_14 = _safe_round(_compute_mfi(highs, lows, closes, volumes))

    # Fundamental metrics — prefer pre-computed (from cached vnbroker financials); else derive from financials
    if fundamental_metrics:
        pe_ratio = fundamental_metrics.get('pe_ratio')
        market_cap = fundamental_metrics.get('market_cap')
        dividend_yield = fundamental_metrics.get('dividend_yield')
        eps_growth_yoy = fundamental_metrics.get('eps_growth_yoy')
        revenue_growth_yoy = fundamental_metrics.get('revenue_growth_yoy')
        debt_to_equity = fundamental_metrics.get('debt_to_equity')
    else:
        fund = _compute_fundamental_metrics(financials, close)
        pe_ratio = fund['pe_ratio']
        market_cap = fund['market_cap']
        dividend_yield = fund['dividend_yield']
        eps_growth_yoy = fund['eps_growth_yoy']
        revenue_growth_yoy = fund['revenue_growth_yoy']
        debt_to_equity = fund['debt_to_equity']

    return {
        'close': float(close) if close is not None else None,
        'volume': float(volume) if volume is not None else None,
        'rsi_14': rsi_14,
        'sma20': _safe_round(sma20),
        'sma50': _safe_round(sma50),
        'momentum_20d_pct': momentum_20d,
        'price_vs_sma20_pct': price_vs_sma20,
        'price_vs_sma50_pct': price_vs_sma50,
        'range_position_pct': range_pos,
        'avg_volume_20': avg_vol20,
        'macd_hist': macd_hist,
        'volume_rvol': volume_rvol,
        'sma20_vs_sma50_pct': sma20_vs_sma50_pct,
        # Advanced technical (NEW)
        'stochastic_k': stochastic_k,
        'stochastic_d': stochastic_d,
        'atr_14': atr_14,
        'adx_14': adx_14,
        'bollinger_width': bollinger_width,
        'vwap': vwap,
        'mfi_14': mfi_14,
        # Fundamental (NEW)
        'pe_ratio': pe_ratio,
        'market_cap': market_cap,
        'dividend_yield': dividend_yield,
        'eps_growth_yoy': eps_growth_yoy,
        'revenue_growth_yoy': revenue_growth_yoy,
        'debt_to_equity': debt_to_equity,
    }


# P1.3: minimum TRADING days of history per condition field, derived from the
# indicator implementations above (SMA50 family: 55, MACD: >=35 closes,
# 52-period range: 55, 20-day family: 20-25). Fields that never read price
# history (whale/dark/fundamental/symbol/date/ai) need only a small bonus
# window for the always-computed tech dict; truly unknown fields stay at the
# conservative 55 (plan §4 D7 refinement, Entry 75).
_REQUIRED_LOOKBACK_DAYS = {
    'sma50': 55,
    'sma20_vs_sma50_pct': 55,
    'price_vs_sma50_pct': 55,
    'range_position_pct': 55,
    'macd_hist': 40,
    'sma20': 25,
    'price_vs_sma20_pct': 25,
    'bollinger_width': 25,
    'vwap': 25,
    'mfi_14': 25,
    'avg_volume_20': 25,
    'momentum_20d_pct': 22,
    'rsi_14': 20,
    'stochastic_k': 20,
    'stochastic_d': 20,
    'atr_14': 20,
    'adx_14': 20,
    'volume_rvol': 20,
    'close': 20,
    'volume': 20,
}
_HISTORY_FREE_FIELDS = frozenset({
    'symbol', 'date', 'ai_score',
    'whale_buy_value', 'whale_sell_value', 'whale_unknown_value',
    'whale_total_value', 'whale_net_value', 'whale_buy_pct',
    'whale_sell_pct', 'whale_unknown_pct', 'whale_trade_count',
    'whale_whale_value', 'whale_shark_value', 'whale_small_value',
    'whale_intensity',
    'dark_flow_strength', 'dark_flow_avg_strength', 'dark_flow_max_strength',
    'dark_flow_signal_count', 'dark_flow_cvd',
    'pe_ratio', 'market_cap', 'dividend_yield',
    'eps_growth_yoy', 'revenue_growth_yoy', 'debt_to_equity',
})
_DEFAULT_LOOKBACK_DAYS = 55
_HISTORY_FREE_LOOKBACK_DAYS = 25
_EMPTY_RULE_LOOKBACK_DAYS = 75

# D7 (Entry 73): calendar window clamp [35, 90].
_MIN_WINDOW_DAYS = 35
_MAX_WINDOW_DAYS = 90


def _required_lookback_days(conditions):
    """Max trading-day lookback needed by a rule's condition fields."""
    if not isinstance(conditions, list) or len(conditions) == 0:
        return _EMPTY_RULE_LOOKBACK_DAYS
    need = 0
    for cond in conditions:
        if not isinstance(cond, dict):
            continue
        field = cond.get('field')
        if field in _REQUIRED_LOOKBACK_DAYS:
            need = max(need, _REQUIRED_LOOKBACK_DAYS[field])
        elif field in _HISTORY_FREE_FIELDS:
            need = max(need, _HISTORY_FREE_LOOKBACK_DAYS)
        else:
            need = max(need, _DEFAULT_LOOKBACK_DAYS)
    return need or _EMPTY_RULE_LOOKBACK_DAYS


def _lookback_calendar_days(trading_days):
    """Trading days -> calendar days (weekends/holidays), clamped [35, 90]."""
    import math
    return max(_MIN_WINDOW_DAYS, min(_MAX_WINDOW_DAYS, int(math.ceil(trading_days * 1.5)) + 5))
