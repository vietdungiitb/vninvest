"""Full-history adjusted-price rebase from CafeF (S4).

The three invariants below gate EVERY write: a provider snapshot with an
unexpected raw-price change or an out-of-band factor must halt, never silently
overwrite 1.9M rows.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

TOLERANCE = Decimal('0.005')
MIN_FACTOR = Decimal('0.01')
MAX_FACTOR = Decimal('1.05')
MIN_COVERAGE = Decimal('0.95')
MIN_RAW_OK_RATIO = Decimal('0.995')


def _diff_ratio(a: Decimal, b: Decimal) -> Decimal:
    if b == 0:
        return Decimal(0) if a == 0 else Decimal(1)
    return abs(a - b) / abs(b)


def validate_rebase(
    old: dict[date, dict[str, Any]],
    new: dict[date, dict[str, Any]],
    ex_date: date | None = None,
) -> tuple[bool, str]:
    """Return (allowed, reason). Pure function — no DB, no network."""
    if not old or not new:
        return False, 'insufficient_coverage'
    if Decimal(len(new)) / Decimal(len(old)) < MIN_COVERAGE:
        return False, 'insufficient_coverage'

    raw_dates = sorted(set(old) & set(new))
    if not raw_dates:
        return False, 'insufficient_coverage'
    bad = sum(
        1 for day in raw_dates
        if _diff_ratio(
            Decimal(str(new[day].get('close'))),
            Decimal(str(old[day].get('close'))),
        ) > TOLERANCE
    )
    if Decimal(bad) / Decimal(len(raw_dates)) > (Decimal(1) - MIN_RAW_OK_RATIO):
        return False, 'raw_close_changed'

    for day in new:
        factor = Decimal(str(new[day].get('adj_factor')))
        if not (MIN_FACTOR <= factor <= MAX_FACTOR):
            return False, 'factor_out_of_bounds'

    common = sorted(set(old) & set(new))
    for prev_day, day in zip(common, common[1:]):
        if ex_date is not None and (prev_day < ex_date <= day):
            continue  # the ex-date jump is expected
        old_prev = Decimal(str(old[prev_day].get('adj_close')))
        old_cur = Decimal(str(old[day].get('adj_close')))
        new_prev = Decimal(str(new[prev_day].get('adj_close')))
        new_cur = Decimal(str(new[day].get('adj_close')))
        if old_prev == 0 or new_prev == 0:
            continue
        if _diff_ratio(new_cur / new_prev, old_cur / old_prev) > TOLERANCE:
            return False, 'return_parity_broken'
    return True, 'ok'


def build_series(rows) -> dict[date, dict[str, Any]]:
    """Map DailyPrice/CafeF-like rows to the validation shape."""
    series: dict[date, dict[str, Any]] = {}
    for row in rows:
        if getattr(row, 'adj_close', None) is None or getattr(row, 'adj_factor', None) is None:
            continue
        series[row.date] = {
            'close': Decimal(str(row.close)),
            'adj_close': Decimal(str(row.adj_close)),
            'adj_factor': Decimal(str(row.adj_factor)),
        }
    return series
