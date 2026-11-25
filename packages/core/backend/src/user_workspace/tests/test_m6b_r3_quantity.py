"""M6b R3 (fix O2) — NAV dùng quantity theo ngày, kể cả vị thế trước cửa sổ."""
from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase

from market_data.models import DailyPrice
from user_workspace.portfolio_analytics_views import _nav_series
from user_workspace.tests.test_review_findings_wave2 import _entry, _portfolio, _tenant


class M6bQuantitySeriesTests(TestCase):
    def setUp(self):
        self.tenant = _tenant('m6bq')
        self.portfolio = _portfolio(self.tenant, 'R3')
        # Vị thế có TRƯỚC cửa sổ giá — phải được cộng baseline, không được = 0.
        _entry(self.tenant, self.portfolio, symbol='VNM',
               trade_date=date(2022, 1, 4), quantity=1000)
        for day, close in ((date(2022, 2, 1), '100'), (date(2022, 2, 2), '110')):
            DailyPrice.objects.create(
                symbol='VNM', date=day,
                open=Decimal(close), high=Decimal(close), low=Decimal(close),
                close=Decimal(close), volume=0,
                price_source='cafef', source='cafef',
            )

    def test_baseline_quantity_before_window_is_counted(self):
        holdings = {'VNM': {'quantity': Decimal('999'), 'avg_cost': Decimal('50')}}
        series = _nav_series(holdings, ['VNM'], date(2022, 2, 1),
                             portfolio=self.portfolio, tenant=self.tenant)
        self.assertEqual(len(series), 2)
        self.assertEqual(series[0]['nav'], 100000.0)  # 1000 × 100, KHÔNG phải 999 × 100

    def test_sell_inside_window_changes_quantity(self):
        _entry(self.tenant, self.portfolio, symbol='VNM', entry_type='SELL',
               trade_date=date(2022, 2, 2), quantity=200)
        holdings = {'VNM': {'quantity': Decimal('999'), 'avg_cost': Decimal('50')}}
        series = _nav_series(holdings, ['VNM'], date(2022, 2, 1),
                             portfolio=self.portfolio, tenant=self.tenant)
        self.assertEqual(series[1]['nav'], 88000.0)  # (1000-200) × 110
