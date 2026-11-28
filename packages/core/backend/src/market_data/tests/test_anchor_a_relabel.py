"""Anchor A relabel — fail-before tests (2026-11-28)."""
from datetime import date
from decimal import Decimal
from io import StringIO
from types import SimpleNamespace

import pytest
from django.core.management.base import CommandError

from market_data.management.commands.anchor_a_relabel import build_relabel_plan


def _row(i, close, adj=None):
    return SimpleNamespace(
        id=i, close=Decimal(str(close)), adj_close=None if adj is None else Decimal(str(adj)),
        price_source='unmapped_cafef', adj_factor=None, is_adjusted=False,
        adj_as_of=None, adj_version=0,
    )


def test_relabel_all_rolls_back_everything_on_late_skip(monkeypatch):
    from contextlib import contextmanager

    from django.core.management.base import CommandError

    import market_data.management.commands.anchor_a_relabel as cmd

    events = []

    @contextmanager
    def fake_atomic():
        events.append('enter')
        try:
            yield
        except Exception as exc:
            events.append(('exit_error', type(exc).__name__))
            raise
        events.append('exit_ok')

    class FakeQS:
        def __init__(self, rows):
            self.rows = rows
            self.last = 0

        def exclude(self, **kwargs):
            return self

        def filter(self, **kwargs):
            if 'id__gt' in kwargs:
                self.last = kwargs['id__gt']
            return self

        def order_by(self, *args):
            return self

        def count(self):
            return 0  # pre-check: không có adj_close ngoài cafef

        def __getitem__(self, sl):
            return [r for r in self.rows if r.id > self.last][sl]

    good = _row(1, 100)
    bad = _row(2, 50, adj=40)
    monkeypatch.setattr(cmd.transaction, 'atomic', fake_atomic)
    def fake_bulk(rows, fields, batch_size):
        # F('adj_version') + 1 là CombinedExpression, không phải F thuần.
        events.append((
            'bulk', tuple(fields), batch_size,
            'adj_version' in str(rows[0].adj_version),
        ))

    monkeypatch.setattr(cmd.DailyPrice.objects, 'bulk_update', fake_bulk)
    with pytest.raises(CommandError):
        cmd.relabel_all(FakeQS([good, bad]), batch=1)
    assert events == [
        'enter',
        ('bulk', cmd.FIELDS, 1000, True),
        ('exit_error', 'CommandError'),
    ]


def test_cafef_rows_can_be_overridden_but_other_sources_cannot():
    cafef = _row(10, 100, adj=80)
    cafef.price_source = 'cafef'
    legacy = _row(11, 50, adj=40)
    legacy.price_source = 'vnbroker_legacy'
    updates, skips = build_relabel_plan(
        [cafef, legacy], now_value=date(2026, 11, 28),
        allow_cafef_override=True,
    )
    assert [r.id for r in updates] == [10]
    assert skips == 1
    assert updates[0].adj_close == Decimal('100')  # CafeF basis bị thay bởi anchor


def test_keyset_batches_do_not_materialize_whole_table():
    from market_data.management.commands.anchor_a_relabel import iter_keyset_batches

    class FakeQS:
        def __init__(self, rows):
            self.rows = rows
            self.last = 0

        def filter(self, **kwargs):
            self.last = kwargs['id__gt']
            return self

        def order_by(self, *args):
            return self

        def __getitem__(self, sl):
            return [r for r in self.rows if r.id > self.last][sl]

    rows = [SimpleNamespace(id=i) for i in range(1, 8)]
    batches = list(iter_keyset_batches(FakeQS(rows), batch=3))
    assert [[r.id for r in b] for b in batches] == [
        [1, 2, 3], [4, 5, 6], [7],
    ]


def test_target_symbols_clears_default_model_ordering():
    from unittest.mock import patch

    from market_data.management.commands.anchor_a_relabel import target_symbols

    with patch('market_data.management.commands.anchor_a_relabel.DailyPrice.objects') as objs:
        qs = objs.filter.return_value
        qs.order_by.return_value.values_list.return_value.distinct.return_value = ['TPB']
        assert target_symbols() == ['TPB']
        qs.order_by.assert_called_once_with()  # clear Meta.ordering before distinct


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


def _command():
    import market_data.management.commands.anchor_a_relabel as cmd

    instance = cmd.Command()
    instance.stdout = StringIO()
    return instance


def test_rollback_sql_restores_exactly_six_fields(monkeypatch):
    monkeypatch.setattr(
        'market_data.management.commands.anchor_a_relabel.target_symbols',
        lambda: [],
    )
    c = _command()
    c.handle(dry_run=False, backup=False, apply=False,
             rollback_sql=True, limit=0)
    out = c.stdout.getvalue()
    for field in ('price_source', 'adj_close', 'adj_factor',
                  'is_adjusted', 'adj_as_of', 'adj_version'):
        assert f'{field}=b.{field}' in out
    assert 'WHERE d.id=b.id' in out


def test_apply_refuses_limit_flag(monkeypatch):
    monkeypatch.setattr(
        'market_data.management.commands.anchor_a_relabel.target_symbols',
        lambda: [],
    )
    c = _command()
    with pytest.raises(CommandError):
        c.handle(dry_run=False, backup=False, apply=True,
                 rollback_sql=False, limit=10)
