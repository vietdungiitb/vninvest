import datetime as dt
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from market_data.models import DailyPrice
from market_serving.models import SessionFacts, SessionFactsBucket

URL = '/core/v1/session-facts/HPG/cvd/'


class Cvd1dCoverageApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        user = get_user_model().objects.create_user(username='cvd1d-cov', password='pass')
        self.client.force_authenticate(user=user)
        self.d0 = timezone.localdate() - dt.timedelta(days=2)
        facts = SessionFacts.objects.create(
            symbol='HPG', session_date=self.d0, cvd_normalized=50.0,
            whale_net_flow=-100, total_buy_volume=100, total_sell_volume=200,
            source='computed', stale=False,
        )
        SessionFactsBucket.objects.create(
            session_facts=facts, symbol='HPG', session_date=self.d0,
            window='1D', bucket_minutes=1440,
            bucket_ts=dt.datetime.combine(self.d0, dt.time.min, tzinfo=dt.timezone.utc),
            cumulative_cvd=-100.0, buy_strength=50.0, institutional_strength=50.0,
            buy_volume=100, sell_volume=200,
        )
        DailyPrice.objects.create(
            symbol='HPG', date=self.d0 - dt.timedelta(days=30),
            open=Decimal('10000'), high=Decimal('10100'), low=Decimal('9900'),
            close=Decimal('10000'), volume=1000, value=10_000_000,
        )

    def _get(self, query):
        return self.client.get(URL + '?' + query)

    def test_coverage_from_trims_zero_prefix(self):
        resp = self._get('window=1D&period=3M')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data
        self.assertEqual(data['coverage_from'], self.d0.isoformat())
        self.assertEqual(data['bucket_count'], 1)
        self.assertEqual(data['cvd_series'][0]['delta'], -100)
        self.assertEqual(data['cvd_series'][0]['cumulative_cvd'], -100.0)

    def test_cross_period_cache_does_not_collide(self):
        long = self._get('window=1D&period=3M').data
        short = self._get('window=1D&period=1M').data
        self.assertEqual(long['period'], '3M')
        self.assertEqual(short['period'], '1M')
        self.assertEqual(short['coverage_from'], self.d0.isoformat())
