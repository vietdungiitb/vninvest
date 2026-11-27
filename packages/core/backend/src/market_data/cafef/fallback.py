"""Fallback KHI CafeF mất kết nối lâu dài.

KBS/VCI `adjusted=False` vẫn route sang CafeF (xem `vci/quote.py:578`), nên
khi CafeF chết KHÔNG có giá raw. Fallback vì thế là **provider-adjusted basis**:
ghi giá adjusted của provider vào `adj_close`, `adj_factor=1`, gắn nhãn
`price_source='vnbroker_fallback'`. Không bao giờ trộn với dòng `cafef`.

FE đã có nhãn `provider_adjusted_fallback` (`chartAdapter.js:90`) — không sửa FE.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

MIN_COVERAGE = 0.95


def fetch_provider_series(symbol: str, start: date, end: date,
                          provider: str = 'KBS') -> list[dict[str, Any]]:
    """Lấy chuỗi adjusted của provider; output `date` (date) + `close` (Decimal)."""
    from vnbroker import Vnbroker

    frame = (
        Vnbroker(show_log=False)
        .stock(symbol.upper(), source=provider)
        .quote.history(
            start=start.isoformat(), end=end.isoformat(),
            interval='1D', adjusted=True, to_df=True,
        )
    )
    if frame is None or getattr(frame, 'empty', True):
        return []
    rows = []
    for record in frame.to_dict('records'):
        raw_time = record.get('time') or record.get('date')
        if raw_time is None or record.get('close') is None:
            continue
        day = raw_time.date() if hasattr(raw_time, 'date') else date.fromisoformat(str(raw_time)[:10])
        rows.append({'date': day, 'close': Decimal(str(record['close']))})
    return rows


def _field(row: Any, name: str, default: Any = None) -> Any:
    """Chấp nhận cả dict lẫn ORM model — caller truyền DailyPrice object."""
    if isinstance(row, dict):
        return row.get(name, default)
    return getattr(row, name, default)


def validate_fallback(old_rows: list[Any], new_rows: list[Any]) -> tuple[bool, str]:
    """Fail-closed: không trộn basis, coverage đủ, thứ tự ngày hợp lệ."""
    if not old_rows or not new_rows:
        return False, 'insufficient_coverage'
    if any(str(_field(r, 'price_source', '')).lower() == 'cafef' for r in old_rows):
        return False, 'cafef_rows_present'
    if len(new_rows) / len(old_rows) < MIN_COVERAGE:
        return False, 'insufficient_coverage'
    days = [_field(r, 'date') for r in new_rows]
    if days != sorted(days):
        return False, 'unsorted_series'
    if any(Decimal(str(_field(r, 'close'))) <= 0 for r in new_rows):
        return False, 'nonpositive_price'
    return True, 'ok'


def apply_provider_fallback(symbol: str, from_year: int = 2011,
                            provider: str = 'KBS') -> dict:
    """Ghi provider-adjusted cho TOÀN chuỗi không-cafef của 1 mã."""
    from django.db.models import F
    from django.utils.timezone import now

    from market_data.models import DailyPrice

    symbol = symbol.upper()
    if DailyPrice.objects.filter(symbol=symbol, price_source='cafef').exists():
        return {'status': 'halted_data_error', 'reason': 'cafef_rows_present'}
    old_qs = DailyPrice.objects.filter(symbol=symbol).exclude(price_source='cafef')
    # Coverage phải so trên CÙNG khoảng ngày với fetch — nếu không, mã có
    # nhiều năm legacy sẽ luôn trả insufficient_coverage dù provider đầy đủ.
    if from_year:
        old_qs = old_qs.filter(date__gte=date(from_year, 1, 1))
    old_rows = list(old_qs)
    if not old_rows:
        return {'status': 'no_data', 'symbol': symbol}
    try:
        new_rows = fetch_provider_series(
            symbol, date(from_year, 1, 1), now().date(), provider=provider,
        )
    except Exception as exc:
        return {'status': 'fetch_error', 'reason': str(exc)[:300]}
    ok, reason = validate_fallback(old_rows, new_rows)
    if not ok:
        return {'status': 'halted_data_error', 'reason': reason}

    by_date = {row['date']: row for row in new_rows}
    updated = 0
    for row in old_rows:
        fresh = by_date.get(row.date)
        if fresh is None:
            continue
        row.adj_close = fresh['close']
        row.adj_factor = Decimal('1')
        row.is_adjusted = True
        row.price_source = 'vnbroker_fallback'
        row.adj_as_of = now()
        row.adj_version = F('adj_version') + 1
        updated += 1
    if updated:
        DailyPrice.objects.bulk_update(
            old_rows,
            ['adj_close', 'adj_factor', 'is_adjusted', 'price_source',
             'adj_as_of', 'adj_version'],
            batch_size=500,
        )
    return {
        'status': 'applied_fallback', 'symbol': symbol,
        'rows_updated': updated, 'provider': provider,
        'dates_fetched': len(new_rows),
    }
