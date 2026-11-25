"""M6b R1 — dòng unmapped_cafef phải bị LOẠI khỏi cửa sổ adjusted (TDD)."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from market_data.pricing import effective_close, effective_ohlc


def row(source='unmapped_cafef'):
    return SimpleNamespace(
        date=date(2022, 1, 4), open=Decimal('43000'), high=Decimal('43500'),
        low=Decimal('42000'), close=Decimal('42750'),
        adj_close=None, adj_factor=None, price_source=source,
    )


class M6bPricingSkipTests(SimpleTestCase):
    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_unmapped_row_is_skipped_when_enabled(self):
        self.assertIsNone(effective_close(row()))
        self.assertIsNone(effective_ohlc(row()))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_legacy_row_keeps_raw(self):
        r = row('vnbroker_legacy')
        self.assertEqual(effective_close(r), Decimal('42750'))
        self.assertEqual(effective_ohlc(r)[3], Decimal('42750'))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'false'})
    def test_unmapped_row_keeps_raw_when_flag_off(self):
        self.assertEqual(effective_close(row()), Decimal('42750'))
