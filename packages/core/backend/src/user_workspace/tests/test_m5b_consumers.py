"""M5b2 — advisory/screener dùng giá điều chỉnh trong pilot (TDD)."""
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from advisory.advisory_helpers import build_ohlcv_lookback_context
from user_workspace.screener_helpers import _screener_build_technical


def _row(day, close='42750', adj_close='17940', factor='0.4196491228', source='cafef'):
    return SimpleNamespace(
        date=day, open='43000', high='43500', low='42000', close=close,
        volume='1000', adj_close=adj_close, adj_factor=factor, price_source=source,
    )


class M5bAdvisoryAdjustedTests(SimpleTestCase):
    rows = [_row(date(2022, 1, 4))]

    def test_flag_off_keeps_raw_in_context(self):
        with patch('advisory.advisory_helpers.DailyPrice.objects.filter') as flt:
            flt.return_value.order_by.return_value.__getitem__ = lambda s, k: self.rows
            text = build_ohlcv_lookback_context('TPB', limit=1)
        self.assertIn('42,750', text)
        self.assertNotIn('17,940', text)

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_flag_on_uses_adjusted_in_context(self):
        with patch('advisory.advisory_helpers.DailyPrice.objects.filter') as flt:
            flt.return_value.order_by.return_value.__getitem__ = lambda s, k: self.rows
            text = build_ohlcv_lookback_context('TPB', limit=1)
        self.assertIn('17,940', text)
        self.assertNotIn('42,750', text)


class M5bScreenerAdjustedTests(SimpleTestCase):
    @staticmethod
    def _history(n=21):
        d0 = date(2022, 1, 4)
        return [_row(d0 + timedelta(days=i), close='100', adj_close='50', factor='0.5') for i in range(n)]

    def test_flag_off_sma20_raw(self):
        tech = _screener_build_technical('TPB', Decimal('100'), 1000, self._history())
        self.assertEqual(tech['sma20'], 100.0)

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_flag_on_sma20_adjusted(self):
        tech = _screener_build_technical('TPB', Decimal('100'), 1000, self._history())
        self.assertEqual(tech['sma20'], 50.0)
