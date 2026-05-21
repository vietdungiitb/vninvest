"""
Tests cho endpoint OHLCV Bars contract mới
GET /api/stock-management/stocks/{symbol}/bars/

Đáp ứng yêu cầu frontend handoff 2026-05-21
"""
import datetime
from unittest.mock import MagicMock, patch

import pytest
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from portfolio.serializers import OHLCVBarsQuerySerializer

User = get_user_model()


# ---------------------------------------------------------------------------
# Serializer unit tests
# ---------------------------------------------------------------------------

class TestOHLCVBarsQuerySerializer(TestCase):
    """Kiểm tra OHLCVBarsQuerySerializer nhận đúng các chế độ input."""

    def test_timeframe_required(self):
        s = OHLCVBarsQuerySerializer(data={})
        self.assertFalse(s.is_valid())
        self.assertIn('timeframe', s.errors)

    def test_invalid_timeframe_rejected(self):
        s = OHLCVBarsQuerySerializer(data={'timeframe': '1Y'})
        self.assertFalse(s.is_valid())
        self.assertIn('timeframe', s.errors)

    def test_valid_timeframe_choices(self):
        for tf in ['1m', '5m', '15m', '1H', '2H', '4H', 'D', 'W', 'M']:
            s = OHLCVBarsQuerySerializer(data={'timeframe': tf, 'before': str(int(datetime.datetime(2026, 5, 1, tzinfo=datetime.timezone.utc).timestamp() * 1000))})
            self.assertTrue(s.is_valid(), msg=f'timeframe={tf} lỗi: {s.errors}')

    def test_window_mode_from_and_to_required_together(self):
        # Chỉ có from, thiếu to
        s = OHLCVBarsQuerySerializer(data={'timeframe': 'D', 'from': '1716163200000'})
        self.assertFalse(s.is_valid())

    def test_window_mode_from_must_be_less_than_to(self):
        from_ms = 1716249600000  # 2026-05-21
        to_ms = 1716163200000    # 2026-05-20 — sai thứ tự
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'from': str(from_ms),
            'to': str(to_ms),
        })
        self.assertFalse(s.is_valid())

    def test_window_mode_valid(self):
        from_ms = 1716163200000  # 2026-05-20
        to_ms = 1716249600000    # 2026-05-21
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'from': str(from_ms),
            'to': str(to_ms),
        })
        self.assertTrue(s.is_valid(), msg=s.errors)
        self.assertIn('from', s.validated_data)
        self.assertIn('to', s.validated_data)

    def test_before_mode_valid_unix_ms(self):
        before_ms = 1716163200000
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'before': str(before_ms),
            'limit': '500',
        })
        self.assertTrue(s.is_valid(), msg=s.errors)
        self.assertIsInstance(s.validated_data['before'], datetime.datetime)

    def test_before_mode_valid_iso8601(self):
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'before': '2026-05-20T00:00:00Z',
            'limit': '200',
        })
        self.assertTrue(s.is_valid(), msg=s.errors)

    def test_limit_max_enforced(self):
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'before': '1716163200000',
            'limit': '9999',
        })
        self.assertFalse(s.is_valid())
        self.assertIn('limit', s.errors)

    def test_cannot_mix_modes(self):
        from_ms = 1716163200000
        to_ms = 1716249600000
        before_ms = 1716076800000
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'from': str(from_ms),
            'to': str(to_ms),
            'before': str(before_ms),
        })
        self.assertFalse(s.is_valid())

    def test_no_mode_defaults_to_before_now(self):
        # Không truyền from/to/before/after → serializer set default before=now
        s = OHLCVBarsQuerySerializer(data={'timeframe': 'D'})
        self.assertTrue(s.is_valid(), msg=s.errors)
        self.assertIn('before', s.validated_data)

    def test_snapshot_id_optional(self):
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': 'D',
            'before': '1716163200000',
            'snapshot_id': 'TCB:D:2026-05-21T15:30Z',
        })
        self.assertTrue(s.is_valid(), msg=s.errors)
        self.assertEqual(s.validated_data['snapshot_id'], 'TCB:D:2026-05-21T15:30Z')

    def test_after_mode_valid(self):
        s = OHLCVBarsQuerySerializer(data={
            'timeframe': '1H',
            'after': '1716163200000',
            'limit': '100',
        })
        self.assertTrue(s.is_valid(), msg=s.errors)
        self.assertIn('after', s.validated_data)


# ---------------------------------------------------------------------------
# View integration tests (mock service)
# ---------------------------------------------------------------------------

MOCK_BARS_RESULT = {
    'symbol': 'TCB',
    'timeframe': 'D',
    'bars': [
        {'timestamp': 1716163200000, 'open': 48200.0, 'high': 49100.0, 'low': 47800.0, 'close': 48900.0, 'volume': 12400500.0},
    ],
    'has_more_before': True,
    'has_more_after': False,
    'next_before': 1716163200000,
    'next_after': None,
    'snapshot_id': 'TCB:D:2026-05-21T15:30Z',
}


def _make_authed_client():
    user = User.objects.create_user(username='testbars', password='Test@123456', email='testbars@test.com')
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestStockOHLCVBarsView(TestCase):
    """Integration tests cho GET /api/stock-management/stocks/{symbol}/bars/"""

    def setUp(self):
        self.client = _make_authed_client()

    @patch('portfolio.market_data_service.market_data_service.get_ohlcv_bars', return_value=MOCK_BARS_RESULT)
    def test_before_mode_returns_200(self, mock_svc):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'D', 'before': '1716163200000', 'limit': '100'},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn('bars', data)
        self.assertIn('has_more_before', data)
        self.assertIn('has_more_after', data)
        self.assertIn('next_before', data)
        self.assertIn('snapshot_id', data)

    @patch('portfolio.market_data_service.market_data_service.get_ohlcv_bars', return_value=MOCK_BARS_RESULT)
    def test_window_mode_returns_200(self, mock_svc):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'D', 'from': '1716076800000', 'to': '1716163200000'},
        )
        self.assertEqual(resp.status_code, 200)

    def test_missing_timeframe_returns_400_with_code(self):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'before': '1716163200000'},
        )
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('code', data)
        self.assertIn('detail', data)

    def test_invalid_timeframe_returns_400_with_machine_readable_code(self):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'INVALID', 'before': '1716163200000'},
        )
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertEqual(data.get('code'), 'INVALID_TIMEFRAME')

    def test_limit_exceeds_max_returns_400(self):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'D', 'before': '1716163200000', 'limit': '9999'},
        )
        self.assertEqual(resp.status_code, 400)
        data = resp.json()
        self.assertIn('code', data)

    def test_mixed_mode_returns_400(self):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {
                'timeframe': 'D',
                'from': '1716076800000',
                'to': '1716163200000',
                'before': '1716076800000',
            },
        )
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_returns_401(self):
        client = APIClient()
        resp = client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'D', 'before': '1716163200000'},
        )
        self.assertEqual(resp.status_code, 401)

    @patch('portfolio.market_data_service.market_data_service.get_ohlcv_bars', return_value=MOCK_BARS_RESULT)
    def test_response_bars_have_required_fields(self, mock_svc):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'D', 'before': '1716163200000'},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        bars = data['bars']
        self.assertIsInstance(bars, list)
        if bars:
            bar = bars[0]
            for field in ['timestamp', 'open', 'high', 'low', 'close', 'volume']:
                self.assertIn(field, bar, msg=f'Bar thiếu field {field}')
            # timestamp phải là số nguyên Unix ms
            self.assertIsInstance(bar['timestamp'], int)
            self.assertGreater(bar['timestamp'], 1_000_000_000_000)

    @patch('portfolio.market_data_service.market_data_service.get_ohlcv_bars', return_value=MOCK_BARS_RESULT)
    def test_snapshot_id_present_in_response(self, mock_svc):
        resp = self.client.get(
            '/api/stock-management/stocks/TCB/bars/',
            {'timeframe': 'D', 'before': '1716163200000'},
        )
        data = resp.json()
        self.assertIn('snapshot_id', data)
        self.assertIsInstance(data['snapshot_id'], str)
        self.assertTrue(len(data['snapshot_id']) > 0)


# ---------------------------------------------------------------------------
# Service unit tests (mock DB + vnbroker)
# ---------------------------------------------------------------------------

class TestGetOHLCVBarsService(TestCase):
    """Unit tests cho market_data_service.get_ohlcv_bars()."""

    def _make_params_before(self, before_iso='2026-05-20T00:00:00+00:00', limit=100, timeframe='D'):
        from portfolio.serializers import OHLCVBarsQuerySerializer
        data = {
            'timeframe': timeframe,
            'before': before_iso,
            'limit': str(limit),
        }
        s = OHLCVBarsQuerySerializer(data=data)
        assert s.is_valid(), s.errors
        return s.validated_data

    def _make_params_window(self, from_iso, to_iso, timeframe='D'):
        from portfolio.serializers import OHLCVBarsQuerySerializer
        data = {
            'timeframe': timeframe,
            'from': from_iso,
            'to': to_iso,
        }
        s = OHLCVBarsQuerySerializer(data=data)
        assert s.is_valid(), s.errors
        return s.validated_data

    @patch('portfolio.market_data_service.DailyPrice')
    @patch('portfolio.market_data_service.fetch_history_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.set_cache')
    def test_before_mode_returns_correct_structure(self, mock_set, mock_get, mock_fetch, mock_dp):
        import pandas as pd
        from portfolio.market_data_service import market_data_service
        from portfolio.exceptions import MarketDataValidationException

        # Mock StockProfile exists
        with patch('portfolio.models.StockProfile.objects') as mock_sp:
            mock_sp.filter.return_value.exists.return_value = True

            # Mock fetch_history_dataframe trả về DataFrame trống → test DB fallback
            mock_fetch.side_effect = Exception('vnbroker down')

            # Mock DailyPrice queryset
            mock_qs = MagicMock()
            mock_qs.filter.return_value.order_by.return_value.values.return_value = [
                {
                    'date': datetime.date(2026, 5, 19),
                    'open_price': 48000,
                    'high_price': 49000,
                    'low_price': 47500,
                    'close_price': 48500,
                    'volume': 10000000,
                },
            ]
            mock_dp.objects = mock_qs

            params = self._make_params_before('2026-05-20T00:00:00+00:00', limit=100)
            result = market_data_service.get_ohlcv_bars('TCB', params)

        self.assertIn('symbol', result)
        self.assertIn('timeframe', result)
        self.assertIn('bars', result)
        self.assertIn('has_more_before', result)
        self.assertIn('has_more_after', result)
        self.assertIn('next_before', result)
        self.assertIn('next_after', result)
        self.assertIn('snapshot_id', result)
        self.assertEqual(result['symbol'], 'TCB')
        self.assertEqual(result['timeframe'], 'D')

    @patch('portfolio.market_data_service.DailyPrice')
    @patch('portfolio.market_data_service.fetch_history_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.set_cache')
    def test_symbol_not_found_raises(self, mock_set, mock_get, mock_fetch, mock_dp):
        from portfolio.market_data_service import market_data_service
        from portfolio.exceptions import MarketDataValidationException

        with patch('portfolio.models.StockProfile.objects') as mock_sp:
            mock_sp.filter.return_value.exists.return_value = False
            params = self._make_params_before('2026-05-20T00:00:00+00:00')
            with self.assertRaises(MarketDataValidationException):
                market_data_service.get_ohlcv_bars('INVALID_SYM', params)

    @patch('portfolio.market_data_service.DailyPrice')
    @patch('portfolio.market_data_service.fetch_history_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.set_cache')
    def test_cached_result_returned_immediately(self, mock_set, mock_get_cache, mock_fetch, mock_dp):
        from portfolio.market_data_service import market_data_service

        cached_payload = {'symbol': 'VPB', 'timeframe': 'D', 'bars': [], 'snapshot_id': 'x'}
        mock_get_cache.return_value = cached_payload

        with patch('portfolio.models.StockProfile.objects') as mock_sp:
            mock_sp.filter.return_value.exists.return_value = True
            params = self._make_params_before('2026-05-20T00:00:00+00:00')
            result = market_data_service.get_ohlcv_bars('VPB', params)

        # Không được gọi fetch khi cache hit
        mock_fetch.assert_not_called()
        self.assertEqual(result, cached_payload)

    @patch('portfolio.market_data_service.DailyPrice')
    @patch('portfolio.market_data_service.fetch_history_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.set_cache')
    def test_snapshot_id_passed_through(self, mock_set, mock_get, mock_fetch, mock_dp):
        from portfolio.market_data_service import market_data_service

        snapshot_in = 'TCB:D:2026-05-21T10:00Z'

        with patch('portfolio.models.StockProfile.objects') as mock_sp:
            mock_sp.filter.return_value.exists.return_value = True
            mock_fetch.side_effect = Exception('down')

            mock_qs = MagicMock()
            mock_qs.filter.return_value.order_by.return_value.values.return_value = []
            mock_dp.objects = mock_qs

            from portfolio.serializers import OHLCVBarsQuerySerializer
            s = OHLCVBarsQuerySerializer(data={
                'timeframe': 'D',
                'before': '1716163200000',
                'snapshot_id': snapshot_in,
            })
            assert s.is_valid(), s.errors
            result = market_data_service.get_ohlcv_bars('TCB', s.validated_data)

        self.assertEqual(result['snapshot_id'], snapshot_in)

    @patch('portfolio.market_data_service.DailyPrice')
    @patch('portfolio.market_data_service.fetch_history_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.set_cache')
    def test_bars_sorted_ascending_by_timestamp(self, mock_set, mock_get, mock_fetch, mock_dp):
        """Bars phải được sort tăng dần theo timestamp."""
        import pandas as pd
        from portfolio.market_data_service import market_data_service

        df = pd.DataFrame([
            {'date': '2026-05-19', 'open': 480, 'high': 490, 'low': 475, 'close': 485, 'volume': 1000},
            {'date': '2026-05-17', 'open': 470, 'high': 480, 'low': 465, 'close': 475, 'volume': 900},
            {'date': '2026-05-18', 'open': 475, 'high': 485, 'low': 470, 'close': 480, 'volume': 950},
        ])
        mock_fetch.return_value = df

        with patch('portfolio.models.StockProfile.objects') as mock_sp:
            mock_sp.filter.return_value.exists.return_value = True

            params_data = {
                'timeframe': 'D',
                'before': '1716163200000',
                'limit': '100',
            }
            from portfolio.serializers import OHLCVBarsQuerySerializer
            s = OHLCVBarsQuerySerializer(data=params_data)
            assert s.is_valid(), s.errors

            result = market_data_service.get_ohlcv_bars('TCB', s.validated_data)

        bars = result['bars']
        if len(bars) > 1:
            timestamps = [b['timestamp'] for b in bars]
            self.assertEqual(timestamps, sorted(timestamps), 'Bars phải sort tăng dần')

    @patch('portfolio.market_data_service.DailyPrice')
    @patch('portfolio.market_data_service.fetch_history_dataframe')
    @patch('portfolio.market_data_service.get_cache', return_value=None)
    @patch('portfolio.market_data_service.set_cache')
    def test_no_duplicate_timestamps(self, mock_set, mock_get, mock_fetch, mock_dp):
        """Không được có duplicate timestamp trong kết quả."""
        import pandas as pd
        from portfolio.market_data_service import market_data_service

        # Cố tình tạo duplicate
        df = pd.DataFrame([
            {'date': '2026-05-19', 'open': 480, 'high': 490, 'low': 475, 'close': 485, 'volume': 1000},
            {'date': '2026-05-19', 'open': 481, 'high': 491, 'low': 476, 'close': 486, 'volume': 1001},
        ])
        mock_fetch.return_value = df

        with patch('portfolio.models.StockProfile.objects') as mock_sp:
            mock_sp.filter.return_value.exists.return_value = True
            from portfolio.serializers import OHLCVBarsQuerySerializer
            s = OHLCVBarsQuerySerializer(data={'timeframe': 'D', 'before': '1716163200000'})
            assert s.is_valid(), s.errors
            result = market_data_service.get_ohlcv_bars('TCB', s.validated_data)

        bars = result['bars']
        timestamps = [b['timestamp'] for b in bars]
        self.assertEqual(len(timestamps), len(set(timestamps)), 'Không được có duplicate timestamp')
