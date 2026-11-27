"""apply_provider_fallback phải scope dòng cũ theo from_year — fail-before.

E2E 2026-11-27: AAH có ~222 dòng 2026 nhưng hàng ngàn dòng cũ ⇒ fetch
từ 2026 trả 223 dòng ⇒ coverage <95%, dù dữ liệu provider đầy đủ.
"""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from market_data.cafef.fallback import apply_provider_fallback


class _QS:
    def __init__(self, rows, calls):
        self.rows = rows
        self.calls = calls

    def filter(self, **kwargs):
        self.calls.append(('filter', kwargs))
        rows = self.rows
        if 'date__gte' in kwargs:
            cutoff = kwargs['date__gte']
            rows = [r for r in rows if r.date >= cutoff]
        return _QS(rows, self.calls)

    def exclude(self, **kwargs):
        self.calls.append(('exclude', kwargs))
        return self

    def exists(self):
        return False

    def __iter__(self):
        return iter(self.rows)


def test_old_rows_are_scoped_by_from_year():
    calls = []
    rows = [
        SimpleNamespace(date=date(2025, 1, 5), price_source='unmapped_cafef'),
        SimpleNamespace(date=date(2026, 1, 5), price_source='unmapped_cafef',
                        adj_close=None, adj_factor=None, is_adjusted=False,
                        price_source2=None),
    ]
    manager = SimpleNamespace(
        filter=lambda **kw: _QS(rows, calls),
        bulk_update=lambda *a, **k: None,
    )
    fake = SimpleNamespace(objects=manager)
    provider_rows = [{'date': date(2026, 1, 5), 'close': Decimal('3500')}]
    with patch('market_data.models.DailyPrice', fake), \
         patch('market_data.cafef.fallback.fetch_provider_series', return_value=provider_rows):
        result = apply_provider_fallback('AAH', from_year=2026)
    assert result['status'] == 'applied_fallback'
    assert ('filter', {'date__gte': date(2026, 1, 1)}) in calls
