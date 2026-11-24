"""Import XLSX CafeF vào bảng đối chiếu CafefDailyPrice.

KHÔNG ghi vào DailyPrice — bảng này chỉ phục vụ đối chiếu (plan AGREE).
"""
import time

from django.db import transaction

from market_data.models import CafefDailyPrice

from .fetcher import fetch_xlsx
from .parser import parse_xlsx_rows

_CACHE_TTL_SECONDS = 600
_preview_cache = {}

_UPDATABLE = (
    'close_raw', 'close_adjusted', 'open_raw', 'high_raw', 'low_raw',
    'volume', 'value', 'source',
)


def preview_import(exchange: str, year: int) -> dict:
    """Fetch+parse in-memory, trả số dòng dự kiến. Cache 10 phút."""
    key = (exchange, year)
    now = time.monotonic()
    cached = _preview_cache.get(key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    rows, rejected = parse_xlsx_rows(fetch_xlsx(exchange, year), with_rejected=True)
    result = {
        'exchange': exchange,
        'year': year,
        'row_count': len(rows),
        'rejected_count': len(rejected),
        'sample': rows[:2],
        'source': 'live_fetch',
    }
    _preview_cache[key] = (now, result)
    return result


def run_import(exchange: str, year: int, dry_run: bool = False) -> dict:
    """Ghi CafefDailyPrice theo lô (exchange, year). Idempotent."""
    rows = parse_xlsx_rows(fetch_xlsx(exchange, year))
    if dry_run:
        return {
            'exchange': exchange, 'year': year,
            'row_count': len(rows), 'inserted': 0, 'updated': 0,
            'dry_run': True,
        }

    keys = [(row['symbol'], row['date']) for row in rows]
    if not keys:
        return {'exchange': exchange, 'year': year, 'row_count': 0,
                'inserted': 0, 'updated': 0, 'dry_run': False}

    symbols = {symbol for symbol, _ in keys}
    dates = [date for _, date in keys]
    existing = {
        (obj.symbol, obj.date): obj
        for obj in CafefDailyPrice.objects.filter(
            symbol__in=symbols, date__gte=min(dates), date__lte=max(dates),
        )
    }

    to_create, to_update = [], []
    for row in rows:
        key = (row['symbol'], row['date'])
        obj = existing.get(key)
        if obj is None:
            to_create.append(CafefDailyPrice(**row))
            continue
        for field in _UPDATABLE:
            setattr(obj, field, row[field])
        to_update.append(obj)

    with transaction.atomic():
        created = CafefDailyPrice.objects.bulk_create(to_create, batch_size=1000)
        if to_update:
            CafefDailyPrice.objects.bulk_update(
                to_update, fields=_UPDATABLE, batch_size=1000,
            )

    return {
        'exchange': exchange, 'year': year, 'row_count': len(rows),
        'inserted': len(created), 'updated': len(to_update), 'dry_run': False,
    }
