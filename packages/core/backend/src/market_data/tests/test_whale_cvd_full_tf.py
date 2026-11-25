"""Fail-before regression tests for Whale/CVD full-timeframe helpers (R-05)."""
from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from market_data.models import DailyPrice, IntradayBar
from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical


class WhaleCvdFullTimeframeTests(TestCase):
    def setUp(self):
        self.symbol = 'TPB'
        self.today = timezone.localdate()
        self.now = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
        DailyPrice.objects.create(
            symbol=self.symbol, date=self.today,
            open=Decimal('18000'), high=Decimal('18500'), low=Decimal('17800'), close=Decimal('18200'),
            volume=100000, value=1820000000,
        )

    def _alert(self, source_ref, direction, executed_at):
        return UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol=self.symbol,
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            title='whale',
            body='',
            value=Decimal('1000000000'),
            direction=direction,
            session_date=executed_at.date(),
            triggered_at=executed_at,
            source_ref=source_ref,
            metadata={},
            evidence={},
        )

    def _canonical(self, alert, side, executed_at, value=1000000000):
        return WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol=self.symbol,
            session_date=executed_at.date(),
            side=side,
            price=Decimal('18200'),
            volume=100000,
            matched_value=value,
            is_dark_flow=False,
            order_id=f'order-{alert.pk}',
            executed_at=executed_at,
        )

    def test_cvd_filters_aggregate_rows_and_side(self):
        """F-01/F-02: chi per-tick row duoc cong; aggregate tick_session va UNKNOWN bi loai."""
        from market_data.stock_mgmt_native_views import _compute_daily_weekly_cvd_series

        self._canonical(self._alert('whale_tick:buy', 'buy', self.now), 'buy', self.now, 800000000)
        agg = self._alert('tick_session:TPB:2026-11-25:buy', 'buy', self.now)
        self._canonical(agg, 'buy', self.now, 5000000000)
        unk = self._alert('whale_tick:unknown', 'buy', self.now + timedelta(minutes=1))
        self._canonical(unk, 'hold', self.now + timedelta(minutes=1), 700000000)

        series = _compute_daily_weekly_cvd_series(self.symbol, self.today, self.today, '1D')
        self.assertEqual(len(series), 1)
        self.assertEqual(series[0]['delta'], 800000000)
        self.assertEqual(series[0]['unit'], 'vnd')
        self.assertIn('cvd', series[0])
        self.assertTrue(series[0]['bucket_ts'].endswith('+00:00'))

    def test_cvd_fills_empty_bucket(self):
        """F-06: ngay khong co whale van co bucket (delta=0) de truc lien tuc."""
        from market_data.stock_mgmt_native_views import _compute_daily_weekly_cvd_series

        d2 = self.today - timedelta(days=1)
        DailyPrice.objects.create(
            symbol=self.symbol, date=d2,
            open=Decimal('17000'), high=Decimal('17500'), low=Decimal('16900'), close=Decimal('17400'),
            volume=90000, value=1566000000,
        )
        self._canonical(self._alert('whale_tick:buy', 'buy', self.now), 'buy', self.now, 600000000)

        series = _compute_daily_weekly_cvd_series(self.symbol, d2, self.today, '1D')
        self.assertEqual(len(series), 2)
        self.assertEqual(series[0]['delta'], 0)
        self.assertEqual(series[1]['delta'], 600000000)

    def test_whale_buckets_window(self):
        """R-03/Q2: ?window=1D aggregate theo bucket, co price close, ts unix."""
        from market_serving.native_views import build_whale_buckets

        self._canonical(self._alert('whale_tick:buy', 'buy', self.now), 'buy', self.now, 900000000)
        buckets = build_whale_buckets(self.symbol, '1D')
        self.assertEqual(len(buckets), 1)
        self.assertEqual(buckets[0]['net_value'], 900000000)
        self.assertEqual(buckets[0]['dominance'], 'buy')
        self.assertEqual(buckets[0]['price'], 18200.0)
        self.assertIsInstance(buckets[0]['ts'], int)

    def test_whale_buckets_floor_500m_and_empty_bucket_neutral(self):
        """F-06/F-09: row <500M bi loai; bucket rong tu DailyPrice co count=0, neutral."""
        from market_serving.native_views import build_whale_buckets

        empty = build_whale_buckets(self.symbol, '1D')
        self.assertEqual(len(empty), 1)
        self.assertEqual(empty[0]['count'], 0)
        self.assertEqual(empty[0]['dominance'], 'neutral')
        self.assertEqual(empty[0]['price'], 18200.0)

        small = self._alert('whale_tick:small', 'buy', self.now)
        self._canonical(small, 'buy', self.now, 499999999)
        big = self._alert('whale_tick:big', 'buy', self.now + timedelta(minutes=1))
        self._canonical(big, 'buy', self.now + timedelta(minutes=1), 900000000)
        buckets = build_whale_buckets(self.symbol, '1D')
        self.assertEqual(len(buckets), 1)
        self.assertEqual(buckets[0]['count'], 1)
        self.assertEqual(buckets[0]['net_value'], 900000000)

    def test_whale_feed_window_alias_and_invalid(self):
        """F-02: whale-feed lower-case + alias 1d/1w, window la -> 400 UNSUPPORTED_WINDOW."""
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate

        from market_serving.native_views import RealtimeWhaleFeedView

        factory = APIRequestFactory()
        user = get_user_model().objects.create_user(username='wf-tester')
        view = RealtimeWhaleFeedView.as_view()

        def call(query):
            req = factory.get(f'/core/v1/realtime/whale-feed/{self.symbol}/', query)
            force_authenticate(req, user=user)
            return view(req, symbol=self.symbol)

        res_alias = call({'window': '1d'})
        self.assertEqual(res_alias.status_code, 200)
        self.assertEqual(res_alias.data['window'], '1D')
        self.assertIn('whale_buckets', res_alias.data)

        res_weekly = call({'window': '1W'})
        self.assertEqual(res_weekly.status_code, 200)
        self.assertEqual(res_weekly.data['window'], '1W')

        res_bad = call({'window': '17m'})
        self.assertEqual(res_bad.status_code, 400)
        self.assertEqual(res_bad.data['code'], 'UNSUPPORTED_WINDOW')

        res_per_tick = call({})
        self.assertEqual(res_per_tick.status_code, 200)
        self.assertIn('whale_orders', res_per_tick.data)
