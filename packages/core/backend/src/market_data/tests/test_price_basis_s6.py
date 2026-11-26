"""S6 consumer contract — bars must not leak stale adj_close (fail-before)."""
from datetime import date
from types import SimpleNamespace

from django.test import TestCase, override_settings

from market_data.stock_mgmt_native_views import (
    _aggregate_daily_to_ohlcv_bars,
    _bars_adjustment_metadata,
    _ohlcv_bar_from_daily,
)


def _row(day, close, adj_close, factor, source):
    return SimpleNamespace(
        date=day, open=close, high=close, low=close, close=close,
        volume=1000, adj_close=adj_close, adj_factor=factor, price_source=source,
    )


@override_settings(DJANGO_DEBUG=True)
class BarsBasisContract(TestCase):
    @override_settings(CORPORATE_ACTIONS_ENABLED=True)
    def test_legacy_row_never_exposes_stale_adj_close(self):
        row = _row(date(2026, 1, 5), 100, 95, None, 'vnbroker_legacy')
        bar = _ohlcv_bar_from_daily(row)
        self.assertNotIn('adj_close', bar)
        self.assertNotIn('adj_factor', bar)
        self.assertEqual(bar['price_source'], 'vnbroker_legacy')

    @override_settings(CORPORATE_ACTIONS_ENABLED=True)
    def test_cafef_row_exposes_adjusted_fields(self):
        row = _row(date(2022, 1, 4), 42750, 17940, 0.4196491228, 'cafef')
        bar = _ohlcv_bar_from_daily(row)
        self.assertEqual(bar['adj_close'], 17940.0)
        self.assertEqual(bar['adj_factor'], 0.4196491228)

    def test_mixed_bars_are_not_labelled_adjusted(self):
        bars = [
            {'price_source': 'cafef', 'adj_close': 17940.0, 'adj_factor': 0.4},
            {'price_source': 'vnbroker_legacy', 'close': 105.0},
        ]
        meta = _bars_adjustment_metadata(bars, partial_dates=[])
        self.assertFalse(meta['adjusted'])
        self.assertIn('mixed', meta['note'])

    @override_settings(CORPORATE_ACTIONS_ENABLED=True)
    def test_weekly_adjusted_scales_each_day_before_aggregation(self):
        # Ex-date falls mid-week: Monday pre-split, Tuesday post-split.
        rows = [
            _row(date(2024, 1, 1), 100, 50, 0.5, 'cafef'),
            _row(date(2024, 1, 2), 60, 60, 1.0, 'cafef'),
        ]
        bars = _aggregate_daily_to_ohlcv_bars(rows, 'W', adjusted=True)
        self.assertEqual(len(bars), 1)
        # Monday O/H/L must be scaled by 0.5, not left raw.
        self.assertEqual(bars[0]['open'], 50.0)
        self.assertEqual(bars[0]['high'], 60.0)
        self.assertEqual(bars[0]['low'], 50.0)
        self.assertEqual(bars[0]['close'], 60.0)
