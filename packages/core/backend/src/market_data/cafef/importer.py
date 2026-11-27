"""Import XLSX CafeF vào bảng đối chiếu CafefDailyPrice.

KHÔNG ghi vào DailyPrice — bảng này chỉ phục vụ đối chiếu (plan AGREE).
"""
import time
from datetime import date, datetime

from django.db import transaction

from market_data.models import CafefDailyPrice

from .fetcher import fetch_xlsx
from .parser import parse_xlsx_rows

MODEL_FIELDS = (
    'symbol', 'date', 'close_raw', 'close_adjusted', 'open_raw',
    'high_raw', 'low_raw', 'volume', 'value', 'change_pct', 'source',
)


def normalize_row(row: dict) -> dict:
    """vnbroker 3.10 frame carries widget-only fields; ORM accepts only these."""
    out = {k: row[k] for k in MODEL_FIELDS if k in row and k != 'source'}
    out['source'] = row.get('source') or 'cafef'
    return out


def fetch_year_paced(exchange: str, year: int, base_delay: int = 10,
                     attempts: int = 4, max_delay: int = 120):
    """Fetch ALL-export with exponential backoff — CafeF rate-limits by IP burst.

    Single small windows also return 503 during cooldown, so pacing (not just
    smaller payloads) is the mitigation. Long sleeps belong in a Celery job,
    never in a request path.
    """
    from vnbroker import Vnbroker

    reference = Vnbroker(show_log=False).reference('cafef')
    today = datetime.now().date()
    end_date = date(year, 12, 31) if year < today.year else today
    last_error = None
    for attempt in range(attempts):
        try:
            return reference.bulk_year(
                exchange, year, end_date=end_date, use_cache=False,
            )
        except Exception as exc:
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(min(base_delay * (2 ** attempt), max_delay))
    raise last_error


def _fetch_rows(exchange: str, year: int) -> list[dict]:
    """Nguồn duy nhất = vnbroker 3.9.0 bulk_year; fallback local khi chưa pin.

    vnbroker.bulk_year tra list dict da normalize (co close_raw/close_adjusted/...),
    khong can parse XLSX lai o vninvest.
    """
    frame = fetch_year_paced(exchange, year)
    if frame is not None and not getattr(frame, 'empty', True):
        return frame.to_dict('records')
    return []


def _fetch_rows_with_rejected(exchange: str, year: int):
    """Trả (rows, rejected) — local path đếm được rejected, vnbroker path trả []."""
    try:
        frame = fetch_year_paced(exchange, year)
        if frame is not None and not getattr(frame, 'empty', True):
            return frame.to_dict('records'), []
    except Exception:
        pass
    return [], []

_CACHE_TTL_SECONDS = 600
_preview_cache = {}

_UPDATABLE = (
    'close_raw', 'close_adjusted', 'open_raw', 'high_raw', 'low_raw',
    'volume', 'value', 'change_pct', 'source',
)


def preview_import(exchange: str, year: int) -> dict:
    """Fetch+parse in-memory, trả số dòng dự kiến. Cache 10 phút."""
    key = (exchange, year)
    now = time.monotonic()
    cached = _preview_cache.get(key)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1]

    rows, rejected = _fetch_rows_with_rejected(exchange, year)
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
    rows = _fetch_rows(exchange, year)
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
        cleaned = normalize_row(row)
        if obj is None:
            to_create.append(CafefDailyPrice(**cleaned))
            continue
        for field in _UPDATABLE:
            if field in cleaned and cleaned[field] is not None:
                setattr(obj, field, cleaned[field])
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
