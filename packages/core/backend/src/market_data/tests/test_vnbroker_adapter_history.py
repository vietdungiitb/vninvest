"""
Unit tests for fetch_intraday_tape_history (D01 — DNSE Backfill Whale & Dark Flow).

Test cases:
    T-A1: Returns list[dict] với đúng shape khi DNSEQuote trả về DataFrame hợp lệ.
    T-A2: Naive UTC timestamp được attach đúng tzinfo=UTC (không shift thêm).
    T-A3: DNSEQuote exception → trả về [] (không raise).
    T-A4: DNSEQuote trả về empty DataFrame → trả về [].
    T-A5: Side normalization đúng cho BU/SD, B/S, buy/sell.
"""
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
from django.test import TestCase

from market_data.vnbroker_adapter import fetch_intraday_tape_history


def _make_trades_df(rows):
    """Helper: tạo DataFrame với schema giống _parse_trades output."""
    records = [
        {
            'time': pd.Timestamp(r['time']),
            'price': r['price'],
            'volume': r['volume'],
            'side': r['side'],
        }
        for r in rows
    ]
    return pd.DataFrame(records)


class FetchIntradayTapeHistoryShapeTests(TestCase):
    """T-A1: Shape và content của kết quả trả về."""

    @patch('market_data.vnbroker_adapter.DNSEQuote', create=True)
    def test_returns_list_of_dicts_with_required_keys(self, _mock_dnse_cls):
        # Arrange: patch tại điểm import trong hàm
        with patch('vnbroker.explorer.dnse.quote.DNSEQuote') as mock_cls:
            mock_q = MagicMock()
            mock_q.intraday.return_value = _make_trades_df([{
                'time': '2026-05-10 02:30:00',  # naive UTC string
                'price': 25000.0,
                'volume': 1000,
                'side': 'BU',
            }])
            mock_cls.return_value = mock_q

            result = fetch_intraday_tape_history('HPG', '2026-05-10')

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        row = result[0]
        for key in ('timestamp', 'price', 'volume', 'side', 'match_type', 'source'):
            self.assertIn(key, row, f"Missing key: {key}")

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_source_label_propagated(self, mock_cls):
        mock_q = MagicMock()
        mock_q.intraday.return_value = _make_trades_df([{
            'time': '2026-05-10 02:30:00',
            'price': 25000.0, 'volume': 1000, 'side': 'BU',
        }])
        mock_cls.return_value = mock_q

        result = fetch_intraday_tape_history('HPG', '2026-05-10', source='dnse_system')
        self.assertEqual(result[0]['source'], 'dnse_system')


class FetchIntradayTapeHistoryTimestampTests(TestCase):
    """T-A2: Timestamp conversion — naive UTC input → UTC-aware output."""

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_naive_utc_timestamp_gets_utc_tzinfo(self, mock_cls):
        # VN trading: 09:30 VN = 02:30 UTC. DNSE API returns Unix timestamps
        # which _parse_trades converts to naive UTC. We verify we attach UTC correctly.
        mock_q = MagicMock()
        # Simulate naive UTC datetime (as _parse_trades would produce)
        naive_utc = datetime(2026, 5, 10, 2, 30, 0)  # 02:30 UTC = 09:30 VN
        mock_q.intraday.return_value = pd.DataFrame([{
            'time': pd.Timestamp(naive_utc),
            'price': 25000.0, 'volume': 500, 'side': 'BU',
        }])
        mock_cls.return_value = mock_q

        result = fetch_intraday_tape_history('HPG', '2026-05-10')

        self.assertEqual(len(result), 1)
        ts = result[0]['timestamp']
        self.assertEqual(ts.tzinfo, timezone.utc)
        self.assertEqual(ts.hour, 2)
        self.assertEqual(ts.minute, 30)

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_tz_aware_timestamp_converted_to_utc(self, mock_cls):
        """UTC+7 aware timestamp phải được convert sang UTC (-7h)."""
        from datetime import timedelta
        vn_tz = timezone(timedelta(hours=7))
        tz_aware = datetime(2026, 5, 10, 9, 30, 0, tzinfo=vn_tz)  # 09:30 VN

        mock_q = MagicMock()
        mock_q.intraday.return_value = pd.DataFrame([{
            'time': pd.Timestamp(tz_aware),
            'price': 25000.0, 'volume': 500, 'side': 'SD',
        }])
        mock_cls.return_value = mock_q

        result = fetch_intraday_tape_history('HPG', '2026-05-10')

        ts = result[0]['timestamp']
        self.assertEqual(ts.tzinfo, timezone.utc)
        self.assertEqual(ts.hour, 2)   # 09:30 VN = 02:30 UTC
        self.assertEqual(ts.minute, 30)


class FetchIntradayTapeHistoryErrorTests(TestCase):
    """T-A3 / T-A4: Error handling — không raise, trả về []."""

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_returns_empty_list_on_dnse_exception(self, mock_cls):
        """T-A3: DNSEQuote exception → trả về []."""
        mock_q = MagicMock()
        mock_q.intraday.side_effect = Exception('DNSE API timeout')
        mock_cls.return_value = mock_q

        result = fetch_intraday_tape_history('HPG', '2026-05-10')

        self.assertEqual(result, [])

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_returns_empty_list_when_dnse_returns_empty_df(self, mock_cls):
        """T-A4: empty DataFrame → trả về []."""
        mock_q = MagicMock()
        mock_q.intraday.return_value = pd.DataFrame()
        mock_cls.return_value = mock_q

        result = fetch_intraday_tape_history('HPG', '2026-05-10')

        self.assertEqual(result, [])

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_returns_empty_list_when_dnse_returns_none(self, mock_cls):
        mock_q = MagicMock()
        mock_q.intraday.return_value = None
        mock_cls.return_value = mock_q

        result = fetch_intraday_tape_history('HPG', '2026-05-10')

        self.assertEqual(result, [])

    @patch('vnbroker.explorer.dnse.quote.DNSEQuote')
    def test_constructor_exception_returns_empty(self, mock_cls):
        """DNSEQuote.__init__ raise → trả về []."""
        mock_cls.side_effect = RuntimeError('network error')

        result = fetch_intraday_tape_history('HPG', '2026-05-10')

        self.assertEqual(result, [])


class FetchIntradayTapeHistorySideTests(TestCase):
    """T-A5: Side normalization — BU/SD, B/S, buy/sell, unknown."""

    def _run_with_side(self, side_value):
        with patch('vnbroker.explorer.dnse.quote.DNSEQuote') as mock_cls:
            mock_q = MagicMock()
            mock_q.intraday.return_value = pd.DataFrame([{
                'time': pd.Timestamp(datetime(2026, 5, 10, 3, 0, 0)),
                'price': 25000.0, 'volume': 100, 'side': side_value,
            }])
            mock_cls.return_value = mock_q
            result = fetch_intraday_tape_history('HPG', '2026-05-10')
        return result[0]['side'] if result else None

    def test_bu_normalized_to_buy(self):
        self.assertEqual(self._run_with_side('BU'), 'buy')

    def test_sd_normalized_to_sell(self):
        self.assertEqual(self._run_with_side('SD'), 'sell')

    def test_b_normalized_to_buy(self):
        self.assertEqual(self._run_with_side('B'), 'buy')

    def test_s_normalized_to_sell(self):
        self.assertEqual(self._run_with_side('S'), 'sell')

    def test_buy_string_normalized(self):
        self.assertEqual(self._run_with_side('buy'), 'buy')

    def test_sell_string_normalized(self):
        self.assertEqual(self._run_with_side('sell'), 'sell')

    def test_unknown_side_normalized(self):
        self.assertEqual(self._run_with_side('X'), 'unknown')

    def test_empty_side_normalized(self):
        self.assertEqual(self._run_with_side(''), 'unknown')
