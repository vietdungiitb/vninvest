"""Import XLSX CafeF vào bảng đối chiếu CafefDailyPrice.

KHÔNG ghi vào DailyPrice — bảng này chỉ phục vụ đối chiếu (plan AGREE).
"""
import os
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
    """Frame vnbroker 3.10 mang field widget-only; ORM chỉ nhận field model."""
    out = {key: row[key] for key in MODEL_FIELDS if key in row and key != 'source'}
    out['source'] = row.get('source') or 'cafef'
    return out


def _frame_records(frame) -> list[dict]:
    """Chuẩn hoá DataFrame/mock-list về list[dict] — SSOT shape cho caller."""
    if frame is None:
        return []
    if hasattr(frame, 'to_dict'):
        return frame.to_dict('records')
    return list(frame)


def fetch_year_paced(exchange: str, year: int, base_delay: int | None = None,
                     attempts: int = 4, max_delay: int = 120) -> list[dict]:
    """Fetch ALL-export với exponential backoff — CafeF rate-limit theo IP burst.

    Cửa sổ 1 tháng cũng trả 503 trong cooldown ⇒ chia nhỏ không đủ, phải
    backoff. Sleep dài chỉ được gọi từ Celery/ops, KHÔNG ở request path.
    """
    # Gọi trực tiếp hàm module-level để test patch được cùng target với S4
    # (`vnbroker.reference.client.bulk_year`) — tránh round-trip qua reference
    # method vốn import alias riêng.
    from vnbroker.reference import client as cafef_client

    if base_delay is None:
        base_delay = int(os.getenv('CAFEF_BACKOFF_BASE', '10'))
    today = datetime.now().date()
    end_date = date(year, 12, 31) if year < today.year else today
    last_error = None
    for attempt in range(attempts):
        try:
            frame = cafef_client.bulk_year(
                exchange, year, end_date=end_date, use_cache=False,
            )
            return _frame_records(frame)
        except Exception as exc:
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(min(base_delay * (2 ** attempt), max_delay))
    raise last_error


def _fetch_rows(exchange: str, year: int) -> list[dict]:
    """Paced bulk_year trước; fallback local XLSX khi vẫn 503."""
    try:
        rows = fetch_year_paced(exchange, year)
        if rows:
            return rows
    except Exception:
        pass
    return parse_xlsx_rows(fetch_xlsx(exchange, year))


def _fetch_rows_with_rejected(exchange: str, year: int):
    """Trả (rows, rejected) — local path đếm được rejected, vnbroker path trả []."""
    try:
        rows = fetch_year_paced(exchange, year)
        if rows:
            return rows, []
    except Exception:
        pass
    return parse_xlsx_rows(fetch_xlsx(exchange, year), with_rejected=True)

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
        cleaned = normalize_row(row)
        key = (row['symbol'], row['date'])
        obj = existing.get(key)
        if obj is None:
            to_create.append(CafefDailyPrice(**cleaned))
            continue
        for field in _UPDATABLE:
            # Không xoá giá trị cũ bằng None khi frame thiếu cột (O1' audit M0 v2).
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
