"""
Tests for StockManagementOHLCVBarsView — cursor-paginated OHLCV bars endpoint.
GET /api/stock-management/stocks/<symbol>/bars/
"""
from datetime import date, datetime, time, timedelta, UTC

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from market_data.tests.envelope import unwrapped_json
from market_data.models import DailyPrice, IntradayBar, StockProfile

User = get_user_model()

_URL = '/core/v1/stock-management/stocks/{symbol}/bars/'


def _make_intraday_bar(symbol, tf, dt, o=10.0, h=10.5, lo=9.9, c=10.2, vol=1000):
    return IntradayBar.objects.create(
        symbol=symbol,
        timeframe=tf,
        datetime=dt,
        open=o,
        high=h,
        low=lo,
        close=c,
        volume=vol,
    )


def _make_daily_row(symbol, d, o=10.0, h=10.5, lo=9.9, c=10.2, vol=1000):
    return DailyPrice.objects.create(
        symbol=symbol,
        date=d,
        open=o,
        high=h,
        low=lo,
        close=c,
        volume=vol,
        source='core',
    )


class OHLCVBarsAuthTestCase(TestCase):
    def test_unauthenticated_returns_401(self):
        client = APIClient()
        resp = client.get(_URL.format(symbol='TCB'), {'timeframe': 'D'})
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class OHLCVBarsValidationTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-val',
            email='ohlcv-bars-val@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='TCB',
            company_name='Techcombank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_invalid_timeframe_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': '3H'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_TIMEFRAME')

    def test_30m_timeframe_not_valid_for_bars(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': '30m'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_TIMEFRAME')

    def test_invalid_limit_string_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'limit': 'abc'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_LIMIT')

    def test_limit_exceeds_max_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'limit': '1001'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'LIMIT_EXCEEDED')

    def test_limit_zero_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'limit': '0'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'LIMIT_EXCEEDED')

    def test_mode_conflict_before_and_after_returns_400(self):
        ts = '1716163200000'
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'before': ts, 'after': ts})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_QUERY')

    def test_mode_conflict_window_and_before_returns_400(self):
        ts = '1716163200000'
        resp = self.client.get(_URL.format(symbol='TCB'), {
            'timeframe': 'D', 'from': ts, 'to': ts, 'before': ts,
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_QUERY')

    def test_window_mode_missing_to_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'from': '1716163200000'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_TIMESTAMP')

    def test_invalid_before_timestamp_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'before': 'not-a-ts'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_TIMESTAMP')

    def test_invalid_after_timestamp_returns_400(self):
        resp = self.client.get(_URL.format(symbol='TCB'), {'timeframe': 'D', 'after': 'not-a-ts'})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.json()['code'], 'INVALID_TIMESTAMP')

    def test_unknown_symbol_returns_404(self):
        resp = self.client.get(_URL.format(symbol='ZZZUNK'), {'timeframe': 'D'})
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class OHLCVBarsDefaultModeTestCase(TestCase):
    """Default mode (no from/to/before/after) returns latest bars."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-def',
            email='ohlcv-bars-def@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='HPG',
            company_name='Hoa Phat Group',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Steel',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        today = date.today()
        for i in range(5):
            _make_daily_row('HPG', today - timedelta(days=i), o=25.0 + i, c=25.5 + i)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_default_returns_200_with_bar_shape(self):
        resp = self.client.get(_URL.format(symbol='HPG'), {'timeframe': 'D'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = unwrapped_json(resp)
        self.assertEqual(data['symbol'], 'HPG')
        self.assertEqual(data['timeframe'], 'D')
        self.assertIsInstance(data['bars'], list)
        self.assertIn('has_more_before', data)
        self.assertIn('has_more_after', data)
        self.assertIn('next_before', data)
        self.assertIn('next_after', data)
        self.assertIsNone(data['snapshot_id'])

    def test_bars_have_required_fields(self):
        resp = self.client.get(_URL.format(symbol='HPG'), {'timeframe': 'D'})
        bars = unwrapped_json(resp)['bars']
        self.assertTrue(len(bars) > 0)
        bar = bars[0]
        for field in ('timestamp', 'open', 'high', 'low', 'close', 'volume'):
            self.assertIn(field, bar, f'Missing field: {field}')
        self.assertIsInstance(bar['timestamp'], int)

    def test_snapshot_id_echoed_back(self):
        resp = self.client.get(_URL.format(symbol='HPG'), {'timeframe': 'D', 'snapshot_id': 'snap-42'})
        self.assertEqual(unwrapped_json(resp)['snapshot_id'], 'snap-42')

    def test_bars_are_ascending_by_timestamp(self):
        resp = self.client.get(_URL.format(symbol='HPG'), {'timeframe': 'D'})
        bars = unwrapped_json(resp)['bars']
        if len(bars) >= 2:
            timestamps = [b['timestamp'] for b in bars]
            self.assertEqual(timestamps, sorted(timestamps))


class OHLCVBarsCursorBeforeTestCase(TestCase):
    """cursor_before mode."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-cb',
            email='ohlcv-bars-cb@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='VCB',
            company_name='Vietcombank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        base = date(2024, 5, 1)
        for i in range(10):
            _make_daily_row('VCB', base + timedelta(days=i), c=85.0 + i)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _ts_for_date(self, d):
        dt = datetime.combine(d, time.min).replace(tzinfo=UTC)
        return int(dt.timestamp() * 1000)

    def test_cursor_before_returns_bars_before_timestamp(self):
        cutoff = self._ts_for_date(date(2024, 5, 6))  # May 6
        resp = self.client.get(_URL.format(symbol='VCB'), {
            'timeframe': 'D', 'before': str(cutoff), 'limit': '3',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = unwrapped_json(resp)
        bars = data['bars']
        self.assertLessEqual(len(bars), 3)
        for bar in bars:
            self.assertLess(bar['timestamp'], cutoff)

    def test_limit_is_respected(self):
        cutoff = self._ts_for_date(date(2025, 1, 1))
        resp = self.client.get(_URL.format(symbol='VCB'), {
            'timeframe': 'D', 'before': str(cutoff), 'limit': '3',
        })
        self.assertLessEqual(len(unwrapped_json(resp)['bars']), 3)

    def test_has_more_before_true_when_more_data_exists(self):
        cutoff = self._ts_for_date(date(2025, 1, 1))
        resp = self.client.get(_URL.format(symbol='VCB'), {
            'timeframe': 'D', 'before': str(cutoff), 'limit': '3',
        })
        data = unwrapped_json(resp)
        # 10 rows exist, limit=3 → has_more_before should be True
        self.assertTrue(data['has_more_before'])

    def test_has_more_after_false_when_no_newer_data(self):
        # before=now → no bars after now
        cutoff = self._ts_for_date(date(2030, 1, 1))
        resp = self.client.get(_URL.format(symbol='VCB'), {
            'timeframe': 'D', 'before': str(cutoff), 'limit': '100',
        })
        self.assertFalse(unwrapped_json(resp)['has_more_after'])

    def test_iso8601_before_accepted(self):
        resp = self.client.get(_URL.format(symbol='VCB'), {
            'timeframe': 'D', 'before': '2025-01-01T00:00:00Z',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class OHLCVBarsCursorAfterTestCase(TestCase):
    """cursor_after mode."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-ca',
            email='ohlcv-bars-ca@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='MBB',
            company_name='MB Bank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        base = date(2024, 5, 1)
        for i in range(10):
            _make_daily_row('MBB', base + timedelta(days=i), c=25.0 + i)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _ts_for_date(self, d):
        dt = datetime.combine(d, time.min).replace(tzinfo=UTC)
        return int(dt.timestamp() * 1000)

    def test_cursor_after_returns_bars_after_timestamp(self):
        cutoff = self._ts_for_date(date(2024, 5, 3))
        resp = self.client.get(_URL.format(symbol='MBB'), {
            'timeframe': 'D', 'after': str(cutoff), 'limit': '3',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        bars = unwrapped_json(resp)['bars']
        for bar in bars:
            self.assertGreater(bar['timestamp'], cutoff)

    def test_has_more_before_true_when_data_before_cutoff(self):
        cutoff = self._ts_for_date(date(2024, 5, 3))
        resp = self.client.get(_URL.format(symbol='MBB'), {
            'timeframe': 'D', 'after': str(cutoff), 'limit': '100',
        })
        # Data exists before May 3
        self.assertTrue(unwrapped_json(resp)['has_more_before'])


class OHLCVBarsWindowModeTestCase(TestCase):
    """window mode (from + to)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-win',
            email='ohlcv-bars-win@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corporation',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Technology',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        base = date(2024, 1, 2)
        for i in range(20):
            _make_daily_row('FPT', base + timedelta(days=i), c=90.0 + i)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _ts_for_date(self, d):
        dt = datetime.combine(d, time.min).replace(tzinfo=UTC)
        return int(dt.timestamp() * 1000)

    def test_window_mode_returns_bars_in_range(self):
        from_ts = self._ts_for_date(date(2024, 1, 5))
        to_ts = self._ts_for_date(date(2024, 1, 10))
        resp = self.client.get(_URL.format(symbol='FPT'), {
            'timeframe': 'D', 'from': str(from_ts), 'to': str(to_ts),
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        bars = unwrapped_json(resp)['bars']
        for bar in bars:
            self.assertGreaterEqual(bar['timestamp'], from_ts)
            self.assertLessEqual(bar['timestamp'], to_ts)

    def test_window_returns_has_more_both_directions(self):
        from_ts = self._ts_for_date(date(2024, 1, 5))
        to_ts = self._ts_for_date(date(2024, 1, 10))
        resp = self.client.get(_URL.format(symbol='FPT'), {
            'timeframe': 'D', 'from': str(from_ts), 'to': str(to_ts),
        })
        data = unwrapped_json(resp)
        # data exists before Jan 5 and after Jan 10
        self.assertTrue(data['has_more_before'])
        self.assertTrue(data['has_more_after'])


class OHLCVBarsIntradayTestCase(TestCase):
    """Intraday timeframe (1H) bars."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-intra',
            email='ohlcv-bars-intra@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='ACB',
            company_name='Asia Commercial Bank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        base_dt = datetime(2024, 5, 10, 9, 0, 0, tzinfo=UTC)
        for i in range(8):
            _make_intraday_bar('ACB', '1H', base_dt + timedelta(hours=i), c=24.0 + i * 0.1)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_intraday_bars_returned_for_1h_timeframe(self):
        resp = self.client.get(_URL.format(symbol='ACB'), {'timeframe': '1H', 'limit': '5'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = unwrapped_json(resp)
        self.assertEqual(data['timeframe'], '1H')
        self.assertIsInstance(data['bars'], list)

    def test_bars_timestamp_is_unix_ms(self):
        resp = self.client.get(_URL.format(symbol='ACB'), {'timeframe': '1H'})
        bars = unwrapped_json(resp)['bars']
        if bars:
            ts = bars[0]['timestamp']
            self.assertIsInstance(ts, int)
            # Unix ms for any date after 2000-01-01 should be > 9e11
            self.assertGreater(ts, 9_000_000_000_00)


class OHLCVBarsWeeklyTestCase(TestCase):
    """Weekly (W) bars aggregated from DailyPrice."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='ohlcv-bars-w',
            email='ohlcv-bars-w@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='VNM',
            company_name='Vinamilk',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Consumer',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        # 4 weeks worth of data (28 days from Mon 2024-01-01)
        base = date(2024, 1, 1)
        for i in range(28):
            _make_daily_row('VNM', base + timedelta(days=i), c=70.0 + i * 0.1)

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_weekly_bars_aggregated(self):
        resp = self.client.get(_URL.format(symbol='VNM'), {
            'timeframe': 'W', 'before': '1800000000000',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        bars = unwrapped_json(resp)['bars']
        # 28 daily rows → ~4 weekly bars
        self.assertGreater(len(bars), 0)
        # Each weekly bar covers a full week's OHLCV
        bar = bars[0]
        for field in ('timestamp', 'open', 'high', 'low', 'close', 'volume'):
            self.assertIn(field, bar)
