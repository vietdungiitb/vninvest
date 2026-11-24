"""P2 — dual-write mapper: vnbroker daily_bars(basis='both') → DailyPrice fields.

Dùng MOCK (0 request thật — ToS chưa ký). Golden 3 mã × 3 năm.
"""
import os
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase

from market_data import vnbroker_adapter


def _frame(rows):
    class F:
        def __init__(self, data):
            self.data = data
            self.attrs = {'coverage': 'ok'}

        def __iter__(self):
            return iter(self.data)

        def to_dict(self, _orient):
            return self.data

    return F(rows)


TPB = _frame([
    {'time': date(2022, 1, 4), 'open_raw': 41500.0, 'high_raw': 43250.0,
     'low_raw': 41300.0, 'close_raw': 42750.0, 'close_adjusted': 17940.0,
     'volume': 11034900, 'value': 467260000000, 'price_basis': 'both',
     'coverage': 'ok'},
])


class DualWriteTests(SimpleTestCase):
    def setUp(self):
        os.environ['DUAL_WRITE_PRICE_ENABLED'] = '1'

    def tearDown(self):
        os.environ.pop('DUAL_WRITE_PRICE_ENABLED', None)

    def test_map_golden_tpb(self):
        with patch.object(vnbroker_adapter, '_daily_bars', return_value=TPB) as call:
            rows = vnbroker_adapter.fetch_dual_write_bars('TPB', date(2022, 1, 4), date(2022, 1, 4))
        call.assert_called_once()
        self.assertEqual(call.call_args.kwargs['basis'], 'both')
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['symbol'], 'TPB')
        self.assertEqual(row['date'], date(2022, 1, 4))
        self.assertEqual(row['close_raw'], Decimal('42750.00'))
        self.assertEqual(row['close_adjusted'], Decimal('17940.00'))
        self.assertEqual(row['value'], 467260000000)
        self.assertEqual(row['price_source'], 'cafef')

    def test_flag_off_returns_empty(self):
        os.environ.pop('DUAL_WRITE_PRICE_ENABLED', None)
        with patch.object(vnbroker_adapter, '_daily_bars') as call:
            rows = vnbroker_adapter.fetch_dual_write_bars('TPB', date(2022, 1, 4), date(2022, 1, 4))
        self.assertEqual(rows, [])
        call.assert_not_called()

    def test_parity_three_symbols_three_years(self):
        """Parity 3 mã × 3 năm — golden mapping, KHONG fetch that."""
        cases = [('TPB', 2011), ('VNM', 2015), ('VIC', 2022)]
        for symbol, year in cases:
            frame = _frame([{
                'time': date(year, 1, 4), 'open_raw': 1000.0, 'high_raw': 1100.0,
                'low_raw': 900.0, 'close_raw': 1000.0, 'close_adjusted': 500.0,
                'volume': 100, 'value': 100000000, 'price_basis': 'both',
                'coverage': 'ok',
            }])
            with patch.object(vnbroker_adapter, '_daily_bars', return_value=frame):
                rows = vnbroker_adapter.fetch_dual_write_bars(symbol, date(year, 1, 4), date(year, 1, 4))
            self.assertEqual(rows[0]['close_raw'], Decimal('1000.00'), (symbol, year))
            self.assertEqual(rows[0]['close_adjusted'], Decimal('500.00'), (symbol, year))
            self.assertEqual(rows[0]['symbol'], symbol, (symbol, year))

    def test_missing_coverage_is_explicit(self):
        empty = _frame([])
        empty.attrs['coverage'] = 'missing'
        with patch.object(vnbroker_adapter, '_daily_bars', return_value=empty):
            rows = vnbroker_adapter.fetch_dual_write_bars('TPB', date(2011, 1, 1), date(2011, 1, 1))
        self.assertEqual(rows, [])
