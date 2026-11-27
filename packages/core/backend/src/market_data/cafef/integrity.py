"""SSOT kiểm tra toàn vẹn giá (S7).

Mọi bất biến đã từng bị vi phạm trong dự án (basis trộn, hệ số vô hiệu,
adj_close tàn dư, coverage rỗng) được mã hoá ở MỘT chỗ. Gate dùng chung cho
write-path (assert_integrity) và lệnh ops/CI (check_price_integrity).

Không import models ở mức module — collector là adapter mỏng, phần kiểm tra
là hàm thuần nhận dict nên test được không cần DB/network.
"""
from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, InvalidOperation
from typing import Any, Iterable

TOLERANCE = Decimal('0.005')
MIN_FACTOR = Decimal('0.01')
MAX_FACTOR = Decimal('1.05')
DEFAULT_MIN_COVERAGE = Decimal('0.95')

VIOLATION_CODES = (
    'residual_adjusted_legacy',
    'unmapped_with_adjustment',
    'factor_out_of_bounds',
    'factor_close_mismatch',
    'orphan_adjustment',
    'mixed_basis_symbol',
    'coverage_below_min',
)


class PriceIntegrityError(RuntimeError):
    """Fail-closed: dữ liệu vi phạm bất biến, KHÔNG được ghi."""


def _dec(value: Any) -> Decimal | None:
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _diff_ratio(a: Decimal, b: Decimal) -> Decimal:
    if b == 0:
        return Decimal(0) if a == 0 else Decimal(1)
    return abs(a - b) / abs(b)


def audit_rows(rows: Iterable[dict], min_coverage: Decimal | None = None) -> dict:
    """Trả báo cáo `{ok, violations, counts, rows, cafef_rows}`.

    `rows` là dict tối thiểu: symbol, price_source, close, adj_close,
    adj_factor. `date` chỉ cần cho báo cáo/ops, không ảnh hưởng bất biến.
    """
    rows = list(rows)
    counts = {code: 0 for code in VIOLATION_CODES}
    hit: set[str] = set()

    def mark(code: str) -> None:
        hit.add(code)
        counts[code] += 1

    per_symbol: dict[str, dict[str, bool]] = defaultdict(
        lambda: {'cafef': False, 'foreign_adjusted': False},
    )
    cafef_rows = 0

    for row in rows:
        source = str(row.get('price_source') or '').lower()
        symbol = str(row.get('symbol') or '')
        close = _dec(row.get('close'))
        adj_close = _dec(row.get('adj_close'))
        factor = _dec(row.get('adj_factor'))
        has_adj = adj_close is not None

        if source == 'cafef':
            cafef_rows += 1
            per_symbol[symbol]['cafef'] = True
        if source in ('vnbroker_legacy', 'unmapped_cafef') and has_adj:
            per_symbol[symbol]['foreign_adjusted'] = True

        if source == 'vnbroker_legacy' and has_adj:
            mark('residual_adjusted_legacy')
        if source == 'unmapped_cafef' and has_adj:
            mark('unmapped_with_adjustment')

        if has_adj and factor is None:
            mark('orphan_adjustment')
        elif not has_adj and factor is not None:
            mark('orphan_adjustment')
        elif has_adj and factor is not None:
            if not (MIN_FACTOR <= factor <= MAX_FACTOR):
                mark('factor_out_of_bounds')
            if close is not None and close != 0:
                if _diff_ratio(adj_close / close, factor) > TOLERANCE:
                    mark('factor_close_mismatch')

    for flags in per_symbol.values():
        if flags['cafef'] and flags['foreign_adjusted']:
            mark('mixed_basis_symbol')

    if min_coverage is not None and rows:
        if Decimal(cafef_rows) / Decimal(len(rows)) < min_coverage:
            mark('coverage_below_min')

    violations = sorted(hit)
    return {
        'ok': not violations,
        'violations': violations,
        'counts': counts,
        'rows': len(rows),
        'cafef_rows': cafef_rows,
    }


def assert_integrity(rows: Iterable[dict], min_coverage: Decimal | None = None) -> bool:
    """Dùng trước mọi bulk-write có nguy cơ trộn basis."""
    report = audit_rows(rows, min_coverage=min_coverage)
    if not report['ok']:
        raise PriceIntegrityError(
            'price_integrity:' + ','.join(report['violations'])
        )
    return True


def collect_rows(since: str | None = None, symbol: str | None = None,
                 limit: int | None = None, batch: int = 5000) -> list[dict]:
    """Adapter DB — keyset pagination, KHÔNG dùng server-side named cursor.

    `.iterator()` tạo cursor có tên; trên staging (pool transaction) psycopg2
    trả `InvalidCursorName: _django_curs_... does not exist`. Keyset theo `id`
    dùng client-side slice, chạy được mọi cấu hình pool.
    """
    from market_data.models import DailyPrice

    qs = DailyPrice.objects.all()
    if since:
        qs = qs.filter(date__gte=since)
    if symbol:
        qs = qs.filter(symbol=symbol.upper())
    qs = qs.order_by('id')

    fields = ('id', 'symbol', 'date', 'price_source', 'close', 'adj_close', 'adj_factor')
    out: list[dict] = []
    last_id = 0
    while True:
        chunk = list(qs.filter(id__gt=last_id).values(*fields)[:batch])
        if not chunk:
            break
        for row in chunk:
            out.append({key: row[key] for key in fields if key != 'id'})
        last_id = chunk[-1]['id']
        if limit is not None and len(out) >= limit:
            return out[:limit]
    return out
