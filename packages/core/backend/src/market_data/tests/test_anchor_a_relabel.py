"""Anchor A relabel — fail-before tests (2026-11-28)."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

from market_data.management.commands.anchor_a_relabel import build_relabel_plan


def _row(i, close, adj=None):
    return SimpleNamespace(
        id=i, close=Decimal(str(close)), adj_close=None if adj is None else Decimal(str(adj)),
        price_source='unmapped_cafef', adj_factor=None, is_adjusted=False,
        adj_as_of=None, adj_version=0,
    )


def test_plan_relabels_only_rows_without_existing_adjustment():
    rows = [_row(1, 100), _row(2, 50, adj=40)]
    updates, skips = build_relabel_plan(rows, now_value=date(2026, 11, 28))
    assert len(updates) == 1
    assert updates[0].id == 1
    assert skips == 1
    assert updates[0].adj_close == Decimal('100')
    assert updates[0].adj_factor == Decimal('1')
    assert updates[0].price_source == 'vnbroker_fallback'
    assert rows[1].adj_close == Decimal('40')  # không bị đụng


def test_plan_preserves_raw_close_and_ohlc():
    row = _row(3, 17.5)
    row.open = Decimal('18')
    row.high = Decimal('19')
    row.low = Decimal('17')
    updates, skips = build_relabel_plan([row], now_value=date(2026, 11, 28))
    assert skips == 0
    assert updates[0].close == Decimal('17.5')
    assert (updates[0].open, updates[0].high, updates[0].low) == (Decimal('18'), Decimal('19'), Decimal('17'))
