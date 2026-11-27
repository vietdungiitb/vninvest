"""collect_rows phải dùng keyset pagination — không server-side named cursor.

Staging 2026-11-27: `.iterator()` gây psycopg2.errors.InvalidCursorName
("_django_curs_... does not exist") trong `check_price_integrity`.
"""
from types import SimpleNamespace
from unittest.mock import patch

from market_data.cafef.integrity import collect_rows


class _FakeQS:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        rows = self.rows
        if 'id__gt' in kwargs:
            rows = [r for r in rows if r['id'] > kwargs['id__gt']]
        if 'date__gte' in kwargs:
            rows = [r for r in rows if str(r['date']) >= kwargs['date__gte']]
        if 'symbol' in kwargs:
            rows = [r for r in rows if r['symbol'] == kwargs['symbol']]
        return _FakeQS(rows)

    def order_by(self, *args):
        return self

    def values(self, *fields):
        return self

    def __getitem__(self, sl):
        return self.rows[sl]

    def iterator(self, *args, **kwargs):
        raise AssertionError('server-side cursor forbidden')


def _rows(n):
    return [
        {
            'id': i, 'symbol': 'TPB', 'date': '2026-01-05',
            'price_source': 'cafef', 'close': 16.6,
            'adj_close': 13.93, 'adj_factor': 0.839,
        }
        for i in range(1, n + 1)
    ]


def test_collect_rows_uses_keyset_pagination():
    fake = SimpleNamespace(objects=SimpleNamespace(all=lambda: _FakeQS(_rows(3))))
    with patch('market_data.models.DailyPrice', fake):
        out = collect_rows(batch=2)
    assert len(out) == 3
    assert out[0]['symbol'] == 'TPB'
    assert 'id' not in out[0]


def test_collect_rows_honours_limit():
    fake = SimpleNamespace(objects=SimpleNamespace(all=lambda: _FakeQS(_rows(10))))
    with patch('market_data.models.DailyPrice', fake):
        out = collect_rows(limit=4, batch=3)
    assert len(out) == 4
