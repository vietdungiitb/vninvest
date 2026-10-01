from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.tests.envelope import unwrapped_json

from market_data.models import IntradayTick

User = get_user_model()


class IntradayTapeApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='market-data-intraday-tape',
            email='market-data-intraday-tape@test.local',
            password='pass123',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in request path'))
    def test_intraday_tape_reads_latest_db_session_without_provider_call(self, provider_mock):
        now = timezone.now().replace(microsecond=0)
        IntradayTick.objects.create(
            symbol='FPT',
            timestamp=now - timedelta(days=1),
            price='117.50',
            volume=100,
            side=IntradayTick.SideChoices.BUY,
            source='core',
        )
        latest_tick = IntradayTick.objects.create(
            symbol='FPT',
            timestamp=now - timedelta(minutes=1),
            price='118.20',
            volume=250,
            side=IntradayTick.SideChoices.SELL,
            match_type='PutThrough',
            source='core',
        )

        response = self.client.get('/core/v1/market-data/intraday-tape/FPT/?page_size=20')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['source'], 'intraday_tick_db')
        self.assertFalse(payload['stale'])
        self.assertEqual(payload['total'], 1)
        self.assertEqual(payload['trades'][0]['price'], 118.2)
        self.assertEqual(payload['trades'][0]['volume'], latest_tick.volume)
        self.assertEqual(payload['trades'][0]['side'], latest_tick.side)
        self.assertEqual(payload['trades'][0]['match_type'], 'PutThrough')
        self.assertEqual(payload['source_event_at'], latest_tick.timestamp.isoformat())
        self.assertEqual(payload['fetched_at'], latest_tick.created_at.isoformat())
        self.assertIsInstance(payload['age_seconds'], int)
        self.assertIn('served_at', payload)
        provider_mock.assert_not_called()

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in request path'))
    def test_intraday_tape_returns_safe_empty_payload_when_db_missing(self, provider_mock):
        response = self.client.get('/core/v1/market-data/intraday-tape/FPT/?page_size=20')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['source'], 'intraday_tick_db_missing')
        self.assertTrue(payload['stale'])
        self.assertEqual(payload['trades'], [])
        self.assertEqual(payload['total'], 0)
        self.assertIsNone(payload['fetched_at'])
        self.assertIsNone(payload['source_event_at'])
        self.assertIsNone(payload['age_seconds'])
        self.assertIn('served_at', payload)
        provider_mock.assert_not_called()