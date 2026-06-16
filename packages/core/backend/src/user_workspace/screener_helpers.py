import numpy as np
from decimal import Decimal
from django.utils import timezone

_SCREENER_ALLOWED_FIELDS = {
    'close', 'volume', 'rsi_14', 'sma20', 'sma50',
    'momentum_20d_pct', 'price_vs_sma20_pct', 'price_vs_sma50_pct',
    'range_position_pct', 'avg_volume_20',
    'whale_buy_value', 'whale_sell_value', 'whale_unknown_value',
    'whale_total_value', 'whale_net_value', 'whale_buy_pct',
    'whale_sell_pct', 'whale_unknown_pct', 'whale_trade_count',
    'whale_whale_value', 'whale_shark_value', 'whale_small_value',
    'whale_intensity',
    'dark_flow_strength', 'dark_flow_avg_strength', 'dark_flow_max_strength',
    'dark_flow_signal_count', 'dark_flow_cvd',
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

def _screener_build_technical(symbol, close, volume, history_list):
    """Build a technical-feature dict for one symbol from history data."""
    closes = [float(p.close) for p in history_list]
    volumes = [float(p.volume) for p in history_list]
    highs = [float(p.high) for p in history_list]
    lows = [float(p.low) for p in history_list]

    if close is not None:
        closes.append(float(close))
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
    hi52 = max(highs[-52:]) if len(highs) >= 10 else None
    lo52 = min(lows[-52:]) if len(lows) >= 10 else None
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
    }
