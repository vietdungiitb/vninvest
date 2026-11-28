"""S5 / REQ-BE-M06 — Market CVD SSOT từ 100% IntradayTick (CONTINUOUS only).

Fail-before trên code cũ: SessionFactsBucket chưa có 8 field mới ⇒ FieldError/TypeError.
"""
from __future__ import annotations

from datetime import datetime, time, timedelta, timezone as dt_timezone
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from market_data.models import DailyPrice, IntradayTick
from market_serving.models import SessionFactsBucket
from market_serving.session_facts_engine import compute_market_cvd_from_ticks


class MarketCvdSsotTests(TestCase):
    def setUp(self) -> None:
        self.day = timezone.localdate()
        base = timezone.make_aware(datetime.combine(self.day, time(9, 15)), dt_timezone.utc)
        self.ts = base
        IntradayTick.objects.bulk_create([
            IntradayTick(symbol='VIC', timestamp=base, price=Decimal('100000'), volume=100,
                         side='BUY', match_type='Continuous', source='vnbroker_intraday'),
            IntradayTick(symbol='VIC', timestamp=base + timedelta(minutes=1), price=Decimal('100000'), volume=50,
                         side='SELL', match_type='Continuous', source='vnbroker_intraday'),
            # ATC: UNKNOWN, khong duoc vao buy/sell — chi vao auction_value.
            IntradayTick(symbol='VIC', timestamp=timezone.make_aware(
                datetime.combine(self.day, time(14, 45)), dt_timezone.utc),
                price=Decimal('100000'), volume=200, side='UNKNOWN', match_type='ATC',
                source='vnbroker_intraday'),
        ])
        DailyPrice.objects.create(
            symbol='VIC', date=self.day, open=100000, high=100000, low=100000,
            close=100000, volume=350,
        )

    def test_market_cvd_from_ticks_excludes_auction_from_aggressor(self) -> None:
        result = compute_market_cvd_from_ticks('VIC', self.day)
        self.assertEqual(result['market_buy_value'], 10_000_000)
        self.assertEqual(result['market_sell_value'], 5_000_000)
        self.assertEqual(result['auction_value'], 20_000_000)
        self.assertEqual(result['trade_count'], 2)
        self.assertEqual(result['cvd_source'], 'full_tick')
        self.assertGreater(result['coverage_ratio'], 0.9)

    def test_daily_price_parity_within_5pct(self) -> None:
        result = compute_market_cvd_from_ticks('VIC', self.day)
        actual = result['market_buy_value'] + result['market_sell_value'] + result['auction_value']
        expected = 100000 * 350
        self.assertLessEqual(abs(actual - expected) / expected, 0.05)

    def test_materialization_writes_new_fields(self) -> None:
        from market_serving.session_facts_engine import compute_session_facts_for_all_active

        compute_session_facts_for_all_active(session_date=self.day, symbol='VIC')
        bucket = SessionFactsBucket.objects.filter(symbol='VIC', session_date=self.day).first()
        self.assertIsNotNone(bucket)
        self.assertEqual(bucket.cvd_source, 'full_tick')
        self.assertGreater(bucket.trade_count, 0)
