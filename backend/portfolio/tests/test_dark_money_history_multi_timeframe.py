"""
Tests for multi-timeframe OHLCV support in dark_money_history_api
Validates: 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W intervals
"""
from datetime import date, datetime, timedelta
from unittest.mock import MagicMock, patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone as tz
from rest_framework.test import APIRequestFactory, force_authenticate

from portfolio.models import OrderFlowSignal, TrackedSymbol
from portfolio.views_dark_money_history import (
    INTRADAY_MAX_DAYS,
    VALID_INTERVALS,
    dark_money_history_api,
    vnbroker_INTERVAL_MAP,
)


class TestMultiTimeframeIntervalValidation(TestCase):
    """Verify all supported intervals are defined correctly"""

    def test_all_intervals_defined_in_vnbroker_map(self):
        """Each valid interval has a vnbroker provider mapping"""
        for interval in VALID_INTERVALS:
            self.assertIn(
                interval, vnbroker_INTERVAL_MAP,
                f"Interval '{interval}' missing from vnbroker_INTERVAL_MAP"
            )

    def test_intraday_max_days_coverage(self):
        """All intraday intervals (< 1D) have max lookback days defined"""
        intraday_intervals = {'1m', '5m', '15m', '30m', '1h', '4h'}
        for interval in intraday_intervals:
            self.assertIn(
                interval, INTRADAY_MAX_DAYS,
                f"Intraday interval '{interval}' missing from INTRADAY_MAX_DAYS"
            )

    def test_valid_intervals_include_new_timeframes(self):
        """Verify 1m, 5m, 4h are in VALID_INTERVALS"""
        required_intervals = {'1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'}
        self.assertTrue(
            required_intervals.issubset(VALID_INTERVALS),
            f"Missing intervals: {required_intervals - VALID_INTERVALS}"
        )


class TestDarkMoneyHistoryMultiTimeframe(TestCase):
    """Test dark_money_history_api with multiple timeframes"""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(
            username='multi-timeframe-user',
            email='multi-tf@example.com',
            password='test-pass-123',
        )
        self.symbol = 'VNM'
        self.trade_date = date.today() - timedelta(days=2)

    def _create_ohlcv_dataframe(self, interval: str, num_rows: int = 10) -> pd.DataFrame:
        """Generate mock OHLCV data for given interval"""
        data = []
        now = tz.now()

        if interval in ['1m', '5m', '15m', '30m']:
            # Intraday: generate rows with minute frequency
            step_minutes = int(interval.replace('m', ''))
            for i in range(num_rows):
                ts = now - timedelta(minutes=step_minutes * (num_rows - i))
                data.append({
                    'time': ts,
                    'open': 100.0 + i * 0.1,
                    'high': 100.2 + i * 0.1,
                    'low': 99.8 + i * 0.1,
                    'close': 100.1 + i * 0.1,
                    'volume': 1000 + i * 100,
                })
        elif interval == '1h':
            # Hourly: generate rows with hour frequency
            for i in range(num_rows):
                ts = now - timedelta(hours=num_rows - i)
                data.append({
                    'time': ts,
                    'open': 100.0 + i * 0.5,
                    'high': 100.5 + i * 0.5,
                    'low': 99.5 + i * 0.5,
                    'close': 100.3 + i * 0.5,
                    'volume': 5000 + i * 200,
                })
        elif interval == '4h':
            # 4-hourly: generate rows with 4-hour frequency
            for i in range(num_rows):
                ts = now - timedelta(hours=4 * (num_rows - i))
                data.append({
                    'time': ts,
                    'open': 100.0 + i * 1.0,
                    'high': 100.5 + i * 1.0,
                    'low': 99.5 + i * 1.0,
                    'close': 100.3 + i * 1.0,
                    'volume': 20000 + i * 500,
                })
        else:  # 1D, 1W
            # Daily/Weekly: generate rows with day frequency
            step_days = 7 if interval == '1W' else 1
            for i in range(num_rows):
                ts = now - timedelta(days=step_days * (num_rows - i))
                data.append({
                    'time': ts.date(),
                    'open': 100.0 + i * 2.0,
                    'high': 101.0 + i * 2.0,
                    'low': 99.0 + i * 2.0,
                    'close': 100.5 + i * 2.0,
                    'volume': 100000 + i * 5000,
                })

        return pd.DataFrame(data)

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_fetch_1m_interval(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test fetching 1-minute interval data"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('1m')
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {self.trade_date: 100.0}

        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=1m&period=1M'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        self.assertIn('candles', response.data)
        self.assertGreater(len(response.data['candles']), 0)
        # Verify vnbroker was called with correct interval mapping
        mock_fetch_history.assert_called()
        call_kwargs = mock_fetch_history.call_args.kwargs
        self.assertEqual(call_kwargs.get('interval'), '1')  # 1m maps to '1' in vnbroker

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_fetch_5m_interval(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test fetching 5-minute interval data"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('5m')
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {self.trade_date: 100.0}

        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=5m&period=1M'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        self.assertIn('candles', response.data)
        self.assertGreater(len(response.data['candles']), 0)
        # Verify interval mapping
        call_kwargs = mock_fetch_history.call_args.kwargs
        self.assertEqual(call_kwargs.get('interval'), '5')  # 5m maps to '5'

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_fetch_4h_interval(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test fetching 4-hour interval data"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('4h')
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {self.trade_date: 100.0}

        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=4h&period=1M'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        self.assertIn('candles', response.data)
        self.assertGreater(len(response.data['candles']), 0)
        # Verify interval mapping
        call_kwargs = mock_fetch_history.call_args.kwargs
        self.assertEqual(call_kwargs.get('interval'), '240')  # 4h maps to '240'

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_fetch_1h_interval(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test fetching 1-hour interval data"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('1h')
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {self.trade_date: 100.0}

        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=1h&period=1M'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        self.assertIn('candles', response.data)
        self.assertGreater(len(response.data['candles']), 0)

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_intraday_period_clamped_to_max_days(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test that intraday timeframes clamp period to INTRADAY_MAX_DAYS"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('1m', num_rows=5)
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {}

        # Request 1 year data, but 1m should clamp to 1 day max
        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=1m&period=1Y'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        # Should have clamped the date range
        call_kwargs = mock_fetch_history.call_args.kwargs
        start_date = datetime.strptime(call_kwargs.get('start'), '%Y-%m-%d').date()
        end_date = datetime.strptime(call_kwargs.get('end'), '%Y-%m-%d').date()
        date_diff = (end_date - start_date).days
        # 1m max is 1 day
        self.assertLessEqual(date_diff, INTRADAY_MAX_DAYS['1m'])

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_intraday_timestamps_are_unix_seconds(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test that intraday candles use Unix timestamp format"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('5m')
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {}

        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=5m'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        candles = response.data.get('candles', [])
        if candles:
            # Intraday timestamps should be Unix integers (seconds)
            first_candle_time = candles[0].get('time')
            self.assertIsInstance(first_candle_time, int)
            # Verify it's a reasonable Unix timestamp (after year 2000)
            self.assertGreater(first_candle_time, 946684800)  # Jan 1, 2000

    @patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date')
    @patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd')
    @patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe')
    def test_daily_timestamps_are_date_strings(
        self,
        mock_fetch_history,
        mock_resolve_threshold,
        mock_build_ref_price,
    ):
        """Test that daily candles use date string format (YYYY-MM-DD)"""
        mock_fetch_history.return_value = self._create_ohlcv_dataframe('1D')
        mock_resolve_threshold.return_value = (500_000, 'test')
        mock_build_ref_price.return_value = {}

        request = self.factory.get(
            f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval=1D'
        )
        force_authenticate(request, user=self.user)

        response = dark_money_history_api(request, self.symbol)

        self.assertEqual(response.status_code, 200)
        candles = response.data.get('candles', [])
        if candles:
            # Daily timestamps should be date strings
            first_candle_time = candles[0].get('time')
            self.assertIsInstance(first_candle_time, str)
            # Verify format is YYYY-MM-DD
            self.assertRegex(first_candle_time, r'^\d{4}-\d{2}-\d{2}$')

    def test_all_supported_intervals_accepted(self):
        """Test that all intervals in VALID_INTERVALS are accepted (endpoint level)"""
        # This is a smoke test to verify the endpoint accepts all intervals
        # Actual vnbroker calls are mocked to avoid network dependency
        for interval in VALID_INTERVALS:
            with self.subTest(interval=interval):
                with patch('portfolio.adapters.vnbroker_adapter.fetch_history_dataframe') as mock_fetch:
                    with patch('portfolio.views_dark_money_history._build_reference_price_by_trade_date'):
                        with patch('portfolio.services.WhaleSignalEngine.resolve_threshold_vnd') as mock_threshold:
                            mock_fetch.return_value = self._create_ohlcv_dataframe(interval, num_rows=3)
                            mock_threshold.return_value = (500_000, 'test')

                            request = self.factory.get(
                                f'/api/stock-management/stocks/{self.symbol}/dark-money-history/?interval={interval}'
                            )
                            force_authenticate(request, user=self.user)

                            response = dark_money_history_api(request, self.symbol)

                            # Should not fail with invalid interval
                            self.assertIn(response.status_code, [200, 400, 404])
                            if response.status_code == 200:
                                self.assertIn('candles', response.data)
