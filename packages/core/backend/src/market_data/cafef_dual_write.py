"""P2 — dual-write mapper từ vnbroker 3.9.0 `daily_bars(basis='both')`.

Không fetch trực tiếp CafeF; không ghi DailyPrice. Chỉ chuyển frame → dict
chuẩn để bước ingest dual-write dùng (flag `DUAL_WRITE_PRICE_ENABLED`).
"""
from decimal import Decimal
from typing import Any


def map_frame_to_rows(frame: Any, symbol: str) -> list[dict[str, Any]]:
    """Map reference frame (vnbroker 3.9.0) sang dict chuan hoá.

    `coverage='missing'` ⇒ trả [] rõ ràng (không im lặng trả frame rỗng kiểu ngày nghỉ).
    """
    if getattr(frame, 'attrs', {}).get('coverage') == 'missing':
        return []

    data = frame.to_dict('records') if hasattr(frame, 'to_dict') else list(frame)
    rows: list[dict[str, Any]] = []
    for rec in data:
        raw = rec.get('close_raw')
        adj = rec.get('close_adjusted')
        if raw is None or adj is None:
            continue
        rows.append({
            'symbol': symbol.upper(),
            'date': rec['time'],
            'close_raw': Decimal(str(raw)).quantize(Decimal('0.01')),
            'close_adjusted': Decimal(str(adj)).quantize(Decimal('0.01')),
            'open_raw': Decimal(str(rec.get('open_raw', raw))).quantize(Decimal('0.01')),
            'high_raw': Decimal(str(rec.get('high_raw', raw))).quantize(Decimal('0.01')),
            'low_raw': Decimal(str(rec.get('low_raw', raw))).quantize(Decimal('0.01')),
            'volume': int(rec.get('volume') or 0),
            'value': int(rec.get('value') or 0) or None,
            'price_source': 'cafef',
        })
    return rows
