"""S5 / REQ-BE-M08 — additive ?metric=market|whale, default whale (Q9).

Fail-before trên code cũ: khong co metric/source/data_quality ⇒ KeyError/assert that.
"""
from __future__ import annotations

from datetime import datetime, time, timezone as dt_timezone
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from market_serving.models import SessionFacts, SessionFactsBucket


class SessionFactsMetricApiTests(TestCase):
    def setUp(self) -> None:
        user = get_user_model().objects.create_user(
            username='metric-reader', email='metric-reader@test.local', password='pass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=user)
        self.day = timezone.localdate()
        facts = SessionFacts.objects.create(
            symbol='VIC', session_date=self.day,
            cvd_normalized=55.0, buy_strength=51.0, institutional_strength=48.0,
            whale_net_flow=5_000_000, dark_flow_score=10.0,
            total_buy_volume=10_000_000, total_sell_volume=5_000_000,
            source=SessionFacts.SourceChoices.COMPUTED, stale=False,
        )
        for tf, minutes in (('15m', 15), ('1h', 60), ('1D', 1440)):
            SessionFactsBucket.objects.create(
                session_facts=facts, symbol='VIC', session_date=self.day,
                window=tf, bucket_minutes=minutes,
                bucket_ts=timezone.make_aware(datetime.combine(self.day, time(10, 0)), dt_timezone.utc),
                cumulative_cvd=5_000_000, buy_strength=51.0, institutional_strength=48.0,
                buy_volume=10_000_000, sell_volume=5_000_000,
                market_buy_value=100_000_000, market_sell_value=90_000_000,
                auction_value=10_000_000, trade_count=1842,
                whale_buy_value=10_000_000, whale_sell_value=5_000_000,
                cvd_source='full_tick', coverage_ratio=Decimal('0.992'),
            )

    def test_default_metric_remains_whale(self) -> None:
        payload = self.client.get('/core/v1/session-facts/VIC/cvd/?window=1h').json()
        self.assertEqual(payload['metric'], 'whale')
        self.assertEqual(payload['source'], 'whale_aggregate')
        self.assertEqual(payload['cvd_series'][0]['buy_volume'], 10_000_000)

    def test_metric_market_returns_full_tick_values(self) -> None:
        payload = self.client.get('/core/v1/session-facts/VIC/cvd/?window=1h&metric=market').json()
        self.assertEqual(payload['metric'], 'market')
        self.assertEqual(payload['source'], 'market_tick_aggregate')
        self.assertEqual(payload['data_quality'], 'verified')
        first = payload['cvd_series'][0]
        self.assertEqual(first['buy_volume'], 100_000_000)
        self.assertEqual(first['sell_volume'], 90_000_000)
        self.assertEqual(first['auction_volume'], 10_000_000)
        self.assertEqual(first['trade_count'], 1842)
        self.assertEqual(first['cvd_source'], 'full_tick')
        # Control that: market buy (100M) phai lon hon whale buy (10M) — khong so sanh chinh no.
        whale = self.client.get('/core/v1/session-facts/VIC/cvd/?window=1h&metric=whale').json()
        self.assertGreater(first['buy_volume'], whale['cvd_series'][0]['buy_volume'])

    def test_history_with_candle_day_without_buckets_returns_200(self) -> None:
        """N1 (re-audit S5 v2): fill candle-day phai co du field, khong KeyError/500."""
        from datetime import timedelta

        from market_data.models import DailyPrice

        # R1: dat bucket o day-2, DailyPrice o day-1 (sau coverage_from, khong co bucket)
        # -> bat buoc di qua nhanh fill cua _get_cvd_history (views.py:489).
        SessionFactsBucket.objects.all().delete()
        facts = SessionFacts.objects.get(symbol='VIC', session_date=self.day)
        facts.session_date = self.day - timedelta(days=2)
        facts.save(update_fields=['session_date'])
        SessionFactsBucket.objects.create(
            session_facts=facts, symbol='VIC', session_date=facts.session_date,
            window='1D', bucket_minutes=1440,
            bucket_ts=timezone.make_aware(datetime.combine(facts.session_date, time(0, 0)), dt_timezone.utc),
            cumulative_cvd=5_000_000, buy_strength=51.0, institutional_strength=48.0,
            buy_volume=10_000_000, sell_volume=5_000_000,
            market_buy_value=100_000_000, market_sell_value=90_000_000,
            auction_value=10_000_000, trade_count=1842, cvd_source='full_tick',
            coverage_ratio=0.992,
        )
        DailyPrice.objects.create(
            symbol='VIC', date=self.day - timedelta(days=1), open=100000, high=100000,
            low=100000, close=100000, volume=1000,
        )
        response = self.client.get(
            '/core/v1/session-facts/VIC/cvd/?window=1D&period=1M&metric=market'
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['metric'], 'market')
        self.assertTrue(payload['history'])
        for bucket in payload['cvd_series']:
            self.assertIn('auction_volume', bucket)
            self.assertIn('trade_count', bucket)
            self.assertIn('cvd_source', bucket)

    def test_two_metrics_do_not_share_cache_entry(self) -> None:
        market = self.client.get('/core/v1/session-facts/VIC/cvd/?window=1h&metric=market').json()
        whale = self.client.get('/core/v1/session-facts/VIC/cvd/?window=1h&metric=whale').json()
        self.assertNotEqual(market['buy_volume'] if 'buy_volume' in market else market['cvd_series'][0]['buy_volume'],
                            whale['cvd_series'][0]['buy_volume'])
