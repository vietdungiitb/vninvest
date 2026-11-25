"""M5a — /chart points phải mang field điều chỉnh cho FE scale (TDD)."""
from datetime import date
from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings

from market_data.stock_mgmt_native_views import (
    _aggregate_daily_rows,
    _ohlcv_bar_from_daily,
    _serialize_price_point,
)


def _row(day, close='42750', adj_close='17940', factor='0.4199', source='cafef'):
    return SimpleNamespace(
        date=date.fromisoformat(day),
        open='43000', high='43500', low='42000', close=close, volume='1000',
        adj_close=adj_close, adj_factor=factor, price_source=source,
    )


class M5ChartPointTests(SimpleTestCase):
    def test_serialize_point_exposes_adjustment_fields(self):
        point = _serialize_price_point(
            date.fromisoformat('2022-06-13'), '43000', '43500', '42000', '42750', '1000',
            adj_close='17940', adj_factor='0.4199', price_source='cafef',
        )
        self.assertEqual(point['close'], 42750.0)
        self.assertEqual(point['adj_close'], 17940.0)
        self.assertEqual(point['adj_factor'], 0.4199)
        self.assertEqual(point['price_source'], 'cafef')

    def test_intraday_point_has_null_adjustment_fields(self):
        point = _serialize_price_point(
            date.fromisoformat('2022-06-13'), '43000', '43500', '42000', '42750', '1000',
        )
        self.assertIsNone(point['adj_close'])
        self.assertIsNone(point['adj_factor'])
        self.assertIsNone(point['price_source'])

    def test_weekly_bucket_uses_last_session_adjustment(self):
        rows = [
            _row('2022-06-13', close='42750', adj_close='17940', factor='0.4199'),
            _row('2022-06-17', close='43100', adj_close='18080', factor='0.4195'),
        ]
        points = _aggregate_daily_rows(rows, 'W')
        self.assertEqual(len(points), 1)
        self.assertEqual(points[0]['close'], 43100.0)  # close = phiên cuối
        self.assertEqual(points[0]['adj_close'], 18080.0)  # adj = phiên cuối, KHÔNG aggregate
        self.assertEqual(points[0]['adj_factor'], 0.4195)
        self.assertEqual(points[0]['price_source'], 'cafef')

    @override_settings()
    def test_bars_daily_exposes_factor_and_source_when_flag_on(self):
        import os
        os.environ['CORPORATE_ACTIONS_ENABLED'] = 'true'
        try:
            bar = _ohlcv_bar_from_daily(_row('2022-06-13'))
            self.assertEqual(bar['adj_close'], 17940.0)
            self.assertEqual(bar['adj_factor'], 0.4199)
            self.assertEqual(bar['price_source'], 'cafef')
        finally:
            os.environ.pop('CORPORATE_ACTIONS_ENABLED', None)
