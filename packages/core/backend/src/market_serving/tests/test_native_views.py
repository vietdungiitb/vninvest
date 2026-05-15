from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import IntradayTick

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