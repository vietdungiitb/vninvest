"""M5b1 — NAV phải dùng adj_close trong scope pilot (TDD)."""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from market_data.models import DailyPrice
from user_workspace.portfolio_analytics_views import _nav_series


class M5bNavAdjustedTests(TestCase):
    def setUp(self):
        self.day = date(2022, 1, 4)
        DailyPrice.objects.create(
            symbol='TPB', date=self.day,
            open=Decimal('43000'), high=Decimal('43500'), low=Decimal('42000'),
            close=Decimal('42750'), volume=1000,
            adj_close=Decimal('17940'), adj_factor=Decimal('0.4196491228'),
            price_source='cafef', source='cafef',
        )
        self.holdings = {'TPB': {'quantity': Decimal('2'), 'avg_cost': Decimal('20000')}}

    def _series(self):
        return _nav_series(self.holdings, ['TPB'], self.day - timedelta(days=1))

    def test_flag_off_uses_raw_close_old_contract(self):
        series = self._series()
        self.assertEqual(len(series), 1)
        self.assertEqual(series[0]['nav'], float(Decimal('42750') * 2))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_flag_on_uses_adj_close_no_split_jump(self):
        # 2 cổ phiếu sau chia 2:1 × giá đã điều chỉnh 17940 = 35880,
        # thay vì 2 × 42750 = 85500 (nhảy giả ngày chia).
        series = self._series()
        self.assertEqual(len(series), 1)
        self.assertEqual(series[0]['nav'], float(Decimal('17940') * 2))

    @patch.dict('os.environ', {'PRICE_ADJUSTED_DISPLAY': 'true'})
    def test_flag_on_row_without_factor_falls_back_to_raw(self):
        DailyPrice.objects.all().delete()
        DailyPrice.objects.create(
            symbol='TPB', date=self.day,
            open=Decimal('43000'), high=Decimal('43500'), low=Decimal('42000'),
            close=Decimal('42750'), volume=1000,
            adj_close=None, adj_factor=None,
            price_source='unmapped_cafef', source='cafef',
        )
        series = self._series()
        self.assertEqual(series[0]['nav'], float(Decimal('42750') * 2))
