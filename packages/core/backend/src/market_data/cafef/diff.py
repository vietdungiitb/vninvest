"""M1 dry-run diff — so sánh DailyPrice (legacy) với CafefDailyPrice.

KHÔNG ghi DB. Trả dict báo cáo để command `price_migration_diff` tổng hợp.
"""
import statistics
from decimal import Decimal


BENCHMARK_SYMBOLS = {
    'VNINDEX', 'VN30', 'HNXINDEX', 'HNX30', 'UPCOMINDEX', 'VNMIDCAP', 'VNSMLCAP',
}


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _changed(a, b) -> bool:
    fa, fb = _num(a), _num(b)
    if fa is None or fb is None:
        return a != b
    return abs(fa - fb) > 0.01


def diff_row(symbol, day, old: dict, new: dict) -> dict:
    """So sánh 1 cặp (symbol,date). `old` từ DailyPrice, `new` từ CafefDailyPrice."""
    fields = {
        'close': (old.get('close'), new.get('close_raw')),
        'adj_close': (old.get('adj_close'), new.get('close_adjusted')),
        'open': (old.get('open'), new.get('open_raw')),
        'high': (old.get('high'), new.get('high_raw')),
        'low': (old.get('low'), new.get('low_raw')),
        'volume': (old.get('volume'), new.get('volume')),
        'value': (old.get('value'), new.get('value')),
    }
    changed = [name for name, (a, b) in fields.items() if _changed(a, b)]
    close_old = _num(old.get('close'))
    close_new = _num(new.get('close_raw'))
    ratio = (close_new / close_old) if close_old and close_new else None
    return {
        'symbol': symbol,
        'date': day,
        'close_old': old.get('close'),
        'close_new': new.get('close_raw'),
        'adj_close_old': old.get('adj_close'),
        'adj_close_new': new.get('close_adjusted'),
        'volume_old': old.get('volume'),
        'volume_new': new.get('volume'),
        'value_old': old.get('value'),
        'value_new': new.get('value'),
        'close_ratio': ratio,
        'fields_changed': len(changed),
        'changed_fields': changed,
        'adj_close_missing': new.get('close_adjusted') is None,
        'unit_suspected': ratio is not None and (ratio >= 100 or ratio <= 0.01),
    }


def classify_db_only(symbol: str) -> str:
    """Phân loại (symbol,date) có trong DB nhưng không có trong CafeF."""
    upper = str(symbol).strip().upper()
    if upper in BENCHMARK_SYMBOLS or upper.endswith('INDEX'):
        return 'benchmark'
    if len(upper) > 10 or any(ch in upper for ch in ('CW', 'ETF')):
        return 'delisted_or_etf'
    return 'legacy_garbage'


def ratio_stats(ratios) -> dict:
    """Thống kê tỷ lệ giá để phân loại REBASE_SHIFT vs DATA_ERROR."""
    values = [float(r) for r in ratios if r is not None]
    if not values:
        return {'count': 0, 'mean': None, 'std': 0.0, 'halt': False}
    mean = statistics.fmean(values)
    std = statistics.pstdev(values)
    halt = any(r >= 100 or r <= 0.01 for r in values) or (
        std > 0.005 and (max(values) - min(values)) > 0.5
    )
    return {'count': len(values), 'mean': mean, 'std': std, 'halt': halt}
