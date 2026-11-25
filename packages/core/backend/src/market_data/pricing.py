"""M5b — helper giá hiệu dụng cho consumer BE trong scope pilot.

Pilot: chỉ HOSE 2022 (~2% dữ liệu) có `price_source='cafef'` + `adj_factor`.
Flag `PRICE_ADJUSTED_DISPLAY` mặc định off: mọi consumer giữ hành vi cũ.
Khi bật, chỉ dòng cafef có adj_factor mới dùng giá điều chỉnh; dòng
`unmapped_cafef` / legacy fallback raw — không thay raw close vào cửa sổ
adjusted (tránh nhảy basis TPB 42750 vs 17940).
"""
import os
from decimal import Decimal, InvalidOperation

PILOT_FLAG = 'PRICE_ADJUSTED_DISPLAY'


def pilot_adjusted_enabled() -> bool:
    return os.getenv(PILOT_FLAG, 'false').strip().lower() in ('1', 'true', 'yes')


def _dec(value):
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def effective_close(row, *, enabled=None) -> Decimal:
    """Trả close hiệu dụng (Decimal) cho một DailyPrice.

    - flag off / không phải cafef / adj_factor NULL / adj_close NULL ⇒ raw close.
    - flag on + cafef + có factor ⇒ adj_close.
    """
    if enabled is None:
        enabled = pilot_adjusted_enabled()
    raw = _dec(getattr(row, 'close', None))
    if enabled and getattr(row, 'price_source', None) == 'cafef':
        factor = _dec(getattr(row, 'adj_factor', None))
        adj_close = _dec(getattr(row, 'adj_close', None))
        if factor is not None and adj_close is not None:
            return adj_close
    if raw is None:
        raise ValueError('DailyPrice row has no close')
    return raw


def effective_ohlc(row, *, enabled=None):
    """Trả (open, high, low, close) hiệu dụng.

    adjusted: O/H/L = raw × adj_factor, close = adj_close
    (theo SSOT `adj_factor = adj_close/close`, plan §1.3).
    """
    if enabled is None:
        enabled = pilot_adjusted_enabled()
    o, h, l, c = (_dec(getattr(row, key, None)) for key in ('open', 'high', 'low', 'close'))
    if enabled and getattr(row, 'price_source', None) == 'cafef':
        factor = _dec(getattr(row, 'adj_factor', None))
        adj_close = _dec(getattr(row, 'adj_close', None))
        if factor is not None and adj_close is not None:
            return (
                o * factor if o is not None else None,
                h * factor if h is not None else None,
                l * factor if l is not None else None,
                adj_close,
            )
    return (o, h, l, c)
