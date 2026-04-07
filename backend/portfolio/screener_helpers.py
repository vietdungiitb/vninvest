"""
screener_helpers.py
Helpers for the Screener feature (rule validation, condition evaluation, technical build).
S23-04 views decomposition — extracted from views.py.
"""
from __future__ import annotations

from .stock_workspace_helpers import _compute_macd_hist, _compute_rsi, _safe_round

# ---------------------------------------------------------------------------
# Allowed field/op sets (used in validation + frontend schema)
# ---------------------------------------------------------------------------

_SCREENER_ALLOWED_FIELDS = {
    'close', 'volume', 'rsi_14', 'sma20', 'sma50',
    'momentum_20d_pct', 'price_vs_sma20_pct', 'price_vs_sma50_pct',
    'range_position_pct', 'avg_volume_20',
}
_SCREENER_ALLOWED_OPS = {'lt', 'lte', 'gt', 'gte', 'eq'}

# Extended fields used in ScreenerRuleRunView technical computation
_SCREENER_NEEDS_HISTORY_FIELDS = {
    'rsi_14', 'sma20', 'sma50', 'momentum_20d_pct',
    'price_vs_sma20_pct', 'price_vs_sma50_pct',
    'range_position_pct', 'avg_volume_20',
    'macd_hist', 'volume_rvol', 'sma20_vs_sma50_pct',
}


# ---------------------------------------------------------------------------
# Rule validation
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Condition evaluation
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Per-symbol technical snapshot (used by ScreenerRuleRunView)
# ---------------------------------------------------------------------------

def _screener_build_technical(sym: str, latest_row: dict, history_map: dict) -> dict:
    """Build a technical-feature dict for one symbol from cached history data."""
    hist = history_map.get(sym, [])
    closes = [float(r['close_price']) for r in hist if r['close_price'] is not None]
    volumes = [float(r['volume']) for r in hist if r['volume'] is not None]
    highs = [float(r['high_price']) for r in hist if r['high_price'] is not None]
    lows = [float(r['low_price']) for r in hist if r['low_price'] is not None]

    close = float(latest_row['close_price']) if latest_row['close_price'] else None

    sma20 = (sum(closes[-20:]) / 20) if len(closes) >= 20 else None
    sma50 = (sum(closes[-50:]) / 50) if len(closes) >= 50 else None
    rsi_14 = _safe_round(_compute_rsi(closes, 14))
    momentum_20d = _safe_round(
        ((closes[-1] / closes[-21] - 1) * 100) if len(closes) >= 21 else None
    )
    price_vs_sma20 = _safe_round(
        ((close / sma20 - 1) * 100) if close and sma20 else None
    )
    price_vs_sma50 = _safe_round(
        ((close / sma50 - 1) * 100) if close and sma50 else None
    )
    hi52 = max(highs[-52:]) if len(highs) >= 10 else None
    lo52 = min(lows[-52:]) if len(lows) >= 10 else None
    range_pos = _safe_round(
        ((close - lo52) / (hi52 - lo52) * 100) if close and hi52 and lo52 and (hi52 - lo52) > 0 else None
    )
    avg_vol20 = _safe_round(
        (sum(volumes[-20:]) / 20) if len(volumes) >= 20 else None
    )
    macd_hist = _safe_round(_compute_macd_hist(closes), 4)
    cur_vol = float(latest_row['volume']) if latest_row.get('volume') else None
    volume_rvol = _safe_round(
        (cur_vol / (sum(volumes[-20:]) / 20)) if cur_vol and len(volumes) >= 20 else None
    )
    sma20_vs_sma50_pct = _safe_round(
        ((sma20 / sma50 - 1) * 100) if sma20 and sma50 else None
    )

    return {
        'close': close,
        'volume': float(latest_row['volume']) if latest_row.get('volume') else None,
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
