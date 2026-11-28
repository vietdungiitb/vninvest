"""S2 / REQ-BE-M02 + G-3b — cách ly đấu giá: ATO/ATC/PUT_THROUGH có side=UNKNOWN.

Fail-before tren code cu: cac assert side=='unknown' that 'buy' -> DO.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

import pandas as pd
import pytz
from django.test import TestCase

from data_ingest.tasks import _normalize_intraday_trade_row
from market_data.vnbroker_adapter import _normalize_intraday_trade_rows

_VN = pytz.timezone('Asia/Ho_Chi_Minh')


def _ict(day: object, hour: int, minute: int, second: int = 0) -> datetime:
    return _VN.localize(datetime.combine(day, time(hour, minute, second))).astimezone(dt_timezone.utc)


class AuctionIsolationNormalizationTests(TestCase):
    def setUp(self) -> None:
        self.day = datetime(2026, 11, 25).date()
        self.atc_ts = _ict(self.day, 14, 45, 18)
        self.ato_ts = _ict(self.day, 9, 10, 30)
        self.continuous_ts = _ict(self.day, 10, 30, 0)

    def _frame(self, ts: datetime, side: str, match_type: str | None) -> pd.DataFrame:
        return pd.DataFrame([{
            'time': ts.isoformat(),
            'price': 235000.0,
            'volume': 220200,
            'side': side,
            'match_type': match_type,
        }])

    def test_live_match_type_atc_forces_unknown(self) -> None:
        rows = _normalize_intraday_trade_rows(
            self._frame(self.atc_ts, 'buy', 'ATC'), 'VIC'
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['side'], 'unknown', 'ATC phai ep side=UNKNOWN')

    def test_live_time_fallback_atc_without_match_type(self) -> None:
        """G-3b: provider khong tra match_type → van ep UNKNOWN theo khung 14:30:01-14:59:59."""
        rows = _normalize_intraday_trade_rows(
            self._frame(self.atc_ts, 'buy', None), 'VIC'
        )
        self.assertEqual(rows[0]['side'], 'unknown', 'fallback khung gio ATC phai ep UNKNOWN')

    def test_live_time_fallback_ato(self) -> None:
        rows = _normalize_intraday_trade_rows(
            self._frame(self.ato_ts, 'sell', ''), 'VIC'
        )
        self.assertEqual(rows[0]['side'], 'unknown', 'ATO phai ep UNKNOWN')

    def test_positive_control_continuous_keeps_buy(self) -> None:
        rows = _normalize_intraday_trade_rows(
            self._frame(self.continuous_ts, 'buy', 'NormalMatch'), 'VIC'
        )
        self.assertEqual(rows[0]['side'], 'buy', 'phiên CONTINUOUS giu aggressor thật')

    def test_hydrate_normalization_atc_forces_unknown(self) -> None:
        row = _normalize_intraday_trade_row('VIC', {
            'timestamp': self.atc_ts.isoformat(),
            'price': 235000,
            'volume': 220200,
            'side': 'BUY',
            'match_type': 'NormalMatch',  # gia su provider khong tra match_type
        })
        self.assertIsNotNone(row)
        self.assertEqual(row['side'], 'UNKNOWN')

    def test_hydrate_positive_control_continuous(self) -> None:
        row = _normalize_intraday_trade_row('VIC', {
            'timestamp': self.continuous_ts.isoformat(),
            'price': 235000,
            'volume': 1000,
            'side': 'BUY',
            'match_type': 'NormalMatch',
        })
        self.assertEqual(row['side'], 'BUY')

    def test_backfill_history_atc_forces_unknown(self) -> None:
        """Duong backfill DNSE cung phai ep UNKNOWN (G-3b fallback)."""
        from market_data.vnbroker_adapter import fetch_intraday_tape_history

        frame = pd.DataFrame([{
            'time': pd.Timestamp(self.atc_ts),
            'price': 235000.0,
            'volume': 220200,
            'side': 'buy',
        }])

        class _FakeQuote:
            def __init__(self, **kwargs):
                pass

            def intraday(self, **kwargs):
                return frame

        with patch('vnbroker.explorer.dnse.quote.DNSEQuote', _FakeQuote):
            rows = fetch_intraday_tape_history(
                'VIC', self.day, api_key=None, api_secret=None, source='dnse_system'
            )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['side'], 'unknown')
        self.assertNotEqual(str(rows[0].get('match_type') or '').lower(), 'normalmatch')

    def test_detect_whale_excludes_unknown_atc_tick(self) -> None:
        """Layer 2: du co tick 600M ATC da bi ep UNKNOWN, detect phai loai."""
        from signal_intelligence.order_flow_engine import detect_whale_ticks

        df = pd.DataFrame([{
            'timestamp': pd.Timestamp(self.atc_ts),
            'price': 235000.0,
            'volume': 220200,
            'side': 'UNKNOWN',
            'value': 235000.0 * 220200,
        }])
        result = detect_whale_ticks(df, 500_000_000)
        self.assertTrue(result.empty, 'detect phai loai tick UNKNOWN du gia tri lon')
