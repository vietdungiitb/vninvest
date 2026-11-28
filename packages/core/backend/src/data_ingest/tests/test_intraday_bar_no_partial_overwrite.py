"""S1 / REQ-BE-M01 — fail-before: khong duoc ghi de cụt IntradayBar bang batch partial.

Given bucket 1H da co 500.000 cp tu batch 1; When batch 2 them 1.000 cp luc 10:45
roi chay _hydrate_intraday_symbols; Then volume phai la 501.000 (khong giam ve 1.000).

Fail-before tren code cu: assertion 501000 that 1000 -> DO.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from data_ingest.tasks import _hydrate_intraday_symbols, _floor_intraday_bucket
from market_data.models import IntradayBar, IntradayTick


_SYMBOL = 'VIC'


def _local(day: object, hour: int, minute: int) -> datetime:
    """ICT (UTC+7) represented as a fixed-offset UTC datetime.

    Khong dung pytz.timezone(...).localize qua django make_aware: pytz chua
    localized co offset LMT+7:07, lam bucket key lech 7 phut so voi tick doc tu DB.
    """
    return datetime.combine(day, time(hour, minute)).replace(tzinfo=dt_timezone.utc) - timedelta(hours=7)


def _raw_trade(ts: datetime, volume: int, price: str = '100000') -> dict:
    return {
        'timestamp': ts.isoformat(),
        'price': price,
        'volume': volume,
        'side': 'BUY',
        'match_type': 'NormalMatch',
    }


class IntradayBarNoPartialOverwriteTests(TestCase):
    def setUp(self) -> None:
        self.day = datetime(2026, 11, 25).date()
        self.t10 = _local(self.day, 10, 0)
        self.t1030 = _local(self.day, 10, 30)
        self.t1045 = _local(self.day, 10, 45)
        # Batch 1 da luu trong DB: 250.000 + 250.000 = 500.000 cp.
        for ts in (self.t10, self.t1030):
            IntradayTick.objects.create(
                symbol=_SYMBOL,
                timestamp=ts,
                price=Decimal('100000'),
                volume=250000,
                side='BUY',
                match_type='NormalMatch',
                source='vnbroker_intraday',
            )
        IntradayBar.objects.create(
            symbol=_SYMBOL,
            datetime=_floor_intraday_bucket(self.t10, '1H'),
            timeframe='1H',
            open=Decimal('100000'),
            high=Decimal('100000'),
            low=Decimal('100000'),
            close=Decimal('100000'),
            volume=500000,
            source='vnbroker_intraday',
        )
        # Control: bucket khong bi batch 2 anh huong.
        IntradayBar.objects.create(
            symbol=_SYMBOL,
            datetime=_floor_intraday_bucket(_local(self.day, 9, 0), '1H'),
            timeframe='1H',
            open=Decimal('99000'),
            high=Decimal('99000'),
            low=Decimal('99000'),
            close=Decimal('99000'),
            volume=100000,
            source='vnbroker_intraday',
        )

    @patch('data_ingest.tasks._fetch_tape_with_timeout')
    def test_batch2_must_accumulate_not_overwrite(self, mock_fetch) -> None:
        # Lan 1: batch cu (da co trong DB) — khong doi bar.
        mock_fetch.return_value = {
            'trades': [_raw_trade(self.t10, 250000), _raw_trade(self.t1030, 250000)],
            'source': 'vnbroker',
        }
        _hydrate_intraday_symbols(
            [{'symbol': _SYMBOL, 'page_size': 50}],
            ['intraday_ticks', 'intraday_bars'],
        )
        # Lan 2: batch moi 1.000 cp luc 10:45.
        mock_fetch.return_value = {'trades': [_raw_trade(self.t1045, 1000)], 'source': 'vnbroker'}
        _hydrate_intraday_symbols(
            [{'symbol': _SYMBOL, 'page_size': 50}],
            ['intraday_ticks', 'intraday_bars'],
        )

        tick_count = IntradayTick.objects.filter(symbol=_SYMBOL).count()
        self.assertEqual(tick_count, 3, 'batch 2 phai duoc luu 1 tick moi vao DB')
        minute_bar = IntradayBar.objects.get(
            symbol=_SYMBOL, timeframe='1m', datetime=_floor_intraday_bucket(self.t1045, '1m')
        )
        self.assertEqual(minute_bar.volume, 1000, 'recompute phai tao bar 1m cho tick 10:45')
        bar = IntradayBar.objects.get(symbol=_SYMBOL, timeframe='1H', datetime=_floor_intraday_bucket(self.t10, '1H'))
        self.assertEqual(bar.volume, 501000, 'batch 2 phai cong don, khong duoc ghi de 1000')

    def test_helper_aggregates_all_db_ticks_for_bucket(self) -> None:
        from data_ingest.intraday_bar_recompute import recompute_bar_payloads_from_ticks
        from data_ingest.tasks import _INTRADAY_BAR_TIMEFRAMES

        IntradayTick.objects.create(
            symbol=_SYMBOL,
            timestamp=self.t1045,
            price=Decimal('100000'),
            volume=1000,
            side='BUY',
            match_type='NormalMatch',
            source='vnbroker_intraday',
        )
        rows = list(
            IntradayTick.objects.filter(symbol=_SYMBOL)
            .values('timestamp', 'price', 'volume', 'source')
            .order_by('timestamp')
        )
        self.assertEqual(len(rows), 3)
        affected = {
            (timeframe, _floor_intraday_bucket(row['timestamp'], timeframe))
            for row in rows
            for timeframe in _INTRADAY_BAR_TIMEFRAMES
        }
        payloads = recompute_bar_payloads_from_ticks(
            _SYMBOL, rows, affected, _floor_intraday_bucket, _INTRADAY_BAR_TIMEFRAMES
        )
        hour_key = ('1H', _floor_intraday_bucket(self.t1045, '1H'))
        self.assertEqual(payloads[hour_key]['volume'], 501000)

    @patch('data_ingest.tasks.fetch_intraday_tape')
    def test_warm_path_creates_all_timeframe_bars(self, mock_fetch) -> None:
        """G-3a: tape +07 va DB UTC phai cho cung bucket cho ca 2H/4H."""
        from django.utils import timezone as dj_tz

        from data_ingest.tasks import _INTRADAY_BAR_TIMEFRAMES, warm_intraday_universe

        first = dj_tz.now().astimezone(dj_tz.get_current_timezone()).replace(second=0, microsecond=0)
        if first.minute >= 58:
            first = first - timedelta(minutes=10)
        second = first + timedelta(minutes=1)
        IntradayTick.objects.create(
            symbol='ACB', timestamp=first, price=Decimal('10.00'), volume=100,
            side='BUY', match_type='NormalMatch', source='vnbroker_intraday',
        )

        def _side(symbol, page_size=50):
            if symbol == 'ACB':
                return {'trades': [_raw_trade(first, 100, '10.0'), _raw_trade(second, 120, '10.5')],
                        'source': 'VCI', 'stale': False}
            return {'trades': [], 'source': 'VCI', 'stale': False}

        mock_fetch.side_effect = _side
        result = warm_intraday_universe.run(plan_items=[
            {'symbol': 'ACB', 'dataset': 'intraday_ticks'},
            {'symbol': 'ACB', 'dataset': 'intraday_bars'},
            {'symbol': 'FPT', 'dataset': 'intraday_ticks'},
        ])
        self.assertGreaterEqual(result['bar_counts']['inserted'], 7)
        for timeframe in _INTRADAY_BAR_TIMEFRAMES:
            self.assertTrue(
                IntradayBar.objects.filter(symbol='ACB', timeframe=timeframe).exists(),
                f'thieu bar khung {timeframe} do floor khac múi giờ',
            )

    @patch('data_ingest.tasks._fetch_tape_with_timeout')
    def test_unaffected_bucket_keeps_volume(self, mock_fetch) -> None:
        mock_fetch.return_value = {'trades': [_raw_trade(self.t1045, 1000)], 'source': 'vnbroker'}
        _hydrate_intraday_symbols(
            [{'symbol': _SYMBOL, 'page_size': 50}],
            ['intraday_ticks', 'intraday_bars'],
        )
        control = IntradayBar.objects.get(
            symbol=_SYMBOL,
            timeframe='1H',
            datetime=_floor_intraday_bucket(_local(self.day, 9, 0), '1H'),
        )
        self.assertEqual(control.volume, 100000, 'bucket khong anh huong phai giu nguyen')
