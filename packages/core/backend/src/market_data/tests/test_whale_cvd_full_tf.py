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

    def test_whale_buckets_exposes_buy_and_sell_values(self):
        """AC-01: bucket phai co buy_value/sell_value, net = buy - sell."""
        from market_serving.native_views import build_whale_buckets

        self._canonical(self._alert('whale_tick:b1', 'buy', self.now), 'buy', self.now, 600000000)
        self._canonical(
            self._alert('whale_tick:s1', 'sell', self.now + timedelta(minutes=1)),
            'sell', self.now + timedelta(minutes=1), 200000000,
        )
        buckets = build_whale_buckets(self.symbol, '1D', min_value=50000)
        self.assertEqual(len(buckets), 1)
        self.assertEqual(buckets[0]['buy_value'], 600000000)
        self.assertEqual(buckets[0]['sell_value'], 200000000)
        self.assertEqual(buckets[0]['net_value'], 400000000)
        self.assertEqual(buckets[0]['dominance'], 'buy')

    def test_whale_buckets_window_1h(self):
        """AC-04: ?window=1h hop le, bucket anchor theo gio."""
        from market_serving.native_views import build_whale_buckets

        self._canonical(self._alert('whale_tick:h1', 'buy', self.now), 'buy', self.now, 100000000)
        buckets = build_whale_buckets(self.symbol, '1h', min_value=50000)
        self.assertEqual(len(buckets), 1)
        self.assertEqual(buckets[0]['bucket_ts'][11:13], '09')

    def test_whale_feed_default_min_value_stays_500m(self):
        """AC-03: khong truyen min_value => van loc 500M cho caller cu."""
        from market_serving.native_views import build_whale_feed_payload

        self._canonical(self._alert('whale_tick:small', 'buy', self.now), 'buy', self.now, 499999999)
        self._canonical(
            self._alert('whale_tick:big', 'buy', self.now + timedelta(minutes=1)),
            'buy', self.now + timedelta(minutes=1), 900000000,
        )
        payload = build_whale_feed_payload(self.symbol)
        self.assertEqual(len(payload['whale_orders']), 1)
        self.assertEqual(payload['whale_orders'][0]['matched_value'], 900000000)

    def test_whale_feed_min_value_floor_and_ceiling(self):
        """AC-02: duoi floor va tren ceiling tra 400; gia tri hop le duoc chap nhan."""
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate

        from market_serving.native_views import RealtimeWhaleFeedView

        factory = APIRequestFactory()
        user = get_user_model().objects.create_user(username='wf-floor-tester')
        view = RealtimeWhaleFeedView.as_view()

        def call(query):
            req = factory.get(f'/core/v1/realtime/whale-feed/{self.symbol}/', query)
            force_authenticate(req, user=user)
            return view(req, symbol=self.symbol)

        low = call({'min_value': '100'})
        self.assertEqual(low.status_code, 400)
        self.assertEqual(low.data['code'], 'MIN_VALUE_BELOW_FLOOR')

        high = call({'min_value': '200000000000'})
        self.assertEqual(high.status_code, 400)
        self.assertEqual(high.data['code'], 'MIN_VALUE_ABOVE_CEILING')

        self._canonical(self._alert('whale_tick:mid', 'buy', self.now), 'buy', self.now, 100000000)
        ok = call({'min_value': '100000000', 'window': '1D'})
        self.assertEqual(ok.status_code, 200)
        bucket = ok.data['whale_buckets'][0]
        self.assertEqual(bucket['buy_value'], 100000000)
        self.assertEqual(bucket['sell_value'], 0)

    def test_whale_feed_query_cap_keeps_newest(self):
        """AC-05: cap lay tick moi nhat, khong phai cu nhat; bao truncated."""
        from unittest.mock import patch

        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate

        from market_serving import native_views

        for i in range(3):
            ts = self.now + timedelta(minutes=i)
            self._canonical(self._alert(f'whale_tick:cap{i}', 'buy', ts), 'buy', ts, 100000000 + i)

        factory = APIRequestFactory()
        user = get_user_model().objects.create_user(username='wf-cap-tester')
        req = factory.get(f'/core/v1/realtime/whale-feed/{self.symbol}/', {})
        force_authenticate(req, user=user)
        with patch.object(native_views, '_WHALE_TICK_QUERY_CAP', 2):
            res = native_views.RealtimeWhaleFeedView.as_view()(req, symbol=self.symbol)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['data_quality'], 'truncated')
        self.assertEqual(len(res.data['whale_orders']), 2)
        self.assertEqual(
            sorted(o['matched_value'] for o in res.data['whale_orders']),
            [100000001, 100000002],
        )

    def test_whale_bucket_cap_reports_truncated_envelope(self):
        """M1: bucket path cap phai bao truncated ca o top-level envelope."""
        from unittest.mock import patch

        from django.contrib.auth import get_user_model
        from rest_framework.test import APIRequestFactory, force_authenticate

        from market_serving import native_views

        for i in range(3):
            ts = self.now + timedelta(minutes=i)
            self._canonical(self._alert(f'whale_tick:bcap{i}', 'buy', ts), 'buy', ts, 100000000 + i)

        factory = APIRequestFactory()
        user = get_user_model().objects.create_user(username='wf-bcap-tester')
        req = factory.get(f'/core/v1/realtime/whale-feed/{self.symbol}/', {'window': '1D'})
        force_authenticate(req, user=user)
        with patch.object(native_views, '_WHALE_TICK_QUERY_CAP', 2):
            res = native_views.RealtimeWhaleFeedView.as_view()(req, symbol=self.symbol)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['data_quality'], 'truncated')
        self.assertEqual(res.data['whale_buckets'][0]['data_quality'], 'truncated')
