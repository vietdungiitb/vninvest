from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import IntradayTick
from market_serving.models import SessionFacts

User = get_user_model()


class RealtimeIntradayViewTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='realtime-intraday-reader',
            email='realtime-intraday-reader@test.local',
            password='pass123',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in request path'))
    def test_realtime_intraday_reads_latest_db_session_without_provider_call(self, provider_mock):
        now = timezone.now().replace(microsecond=0)
        IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(days=1),
            price='17.90',
            volume=500,
            side=IntradayTick.SideChoices.BUY,
            source='core',
        )
        latest_buy = IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(minutes=2),
            price='18.20',
            volume=1000,
            side=IntradayTick.SideChoices.BUY,
            source='core',
        )
        latest_sell = IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(minutes=1),
            price='18.25',
            volume=1500,
            side=IntradayTick.SideChoices.SELL,
            source='core',
        )

        response = self.client.get('/api/realtime/intraday/tpb/?page_size=50')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['source'], 'intraday_tick_db')
        self.assertFalse(payload['stale'])
        self.assertEqual(payload['total'], 2)
        self.assertEqual(len(payload['trades']), 2)
        self.assertEqual(payload['bars'], payload['trades'])
        self.assertEqual(payload['trades'][0]['price'], 18.25)
        self.assertEqual(payload['trades'][0]['volume'], latest_sell.volume)
        self.assertEqual(payload['trades'][0]['side'], 'SELL')
        self.assertEqual(payload['trades'][1]['price'], 18.2)
        self.assertEqual(payload['trades'][1]['volume'], latest_buy.volume)
        self.assertEqual(payload['trades'][1]['side'], 'BUY')
        self.assertEqual(payload['source_event_at'], latest_sell.timestamp.isoformat())
        self.assertEqual(payload['fetched_at'], latest_sell.created_at.isoformat())
        self.assertIsInstance(payload['age_seconds'], int)
        self.assertIn('served_at', payload)
        provider_mock.assert_not_called()

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in request path'))
    def test_realtime_intraday_returns_safe_empty_payload_when_db_missing(self, provider_mock):
        response = self.client.get('/api/realtime/intraday/TPB/?page_size=10')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['source'], 'intraday_tick_db_missing')
        self.assertTrue(payload['stale'])
        self.assertEqual(payload['trades'], [])
        self.assertEqual(payload['bars'], [])
        self.assertEqual(payload['total'], 0)
        self.assertIsNone(payload['fetched_at'])
        self.assertIsNone(payload['source_event_at'])
        self.assertIsNone(payload['age_seconds'])
        self.assertIn('served_at', payload)
        provider_mock.assert_not_called()


class SessionFactsCvdViewTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='session-facts-cvd-reader',
            email='session-facts-cvd-reader@test.local',
            password='pass123',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_returns_empty_payload_when_session_facts_missing(self):
        response = self.client.get('/api/market/session-facts/VCB/cvd/?window=30m&trade_date=2026-05-15')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'VCB')
        self.assertEqual(payload['window'], '30m')
        self.assertEqual(payload['session_date'], '2026-05-15')
        self.assertEqual(payload['bucket_count'], 0)
        self.assertEqual(payload['cvd_series'], [])
        self.assertEqual(payload['data_status'], 'missing_session_facts')
        self.assertEqual(payload['_source'], 'no-data')

    def test_returns_empty_payload_when_window_has_no_bucket_rows(self):
        SessionFacts.objects.create(
            symbol='VCB',
            session_date=timezone.localdate(),
            cvd_normalized=55.0,
            buy_strength=51.0,
            institutional_strength=48.0,
            whale_net_flow=123456,
            dark_flow_score=10.0,
            total_buy_volume=1000,
            total_sell_volume=800,
            source=SessionFacts.SourceChoices.COMPUTED,
            stale=False,
        )

        response = self.client.get('/api/market/session-facts/VCB/cvd/?window=30m')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'VCB')
        self.assertEqual(payload['window'], '30m')
        self.assertEqual(payload['bucket_count'], 0)
        self.assertEqual(payload['cvd_series'], [])
        self.assertEqual(payload['data_status'], 'missing_cvd_buckets')
        self.assertEqual(payload['_source'], 'no-data')