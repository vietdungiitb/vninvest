from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import IntradayBar

User = get_user_model()


class IntradayPricesApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='market-data-intraday-prices',
            email='market-data-intraday-prices@test.local',
            password='pass123',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('market_data.vnbroker_adapter.fetch_intraday_ohlcv', side_effect=AssertionError('provider path must not run in request path'))
    def test_intraday_prices_reads_db_bars_without_provider_call(self, fetch_intraday_ohlcv_mock):
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        IntradayBar.objects.create(
            symbol='FPT',
            datetime=now - timedelta(days=10),
            timeframe='1H',
            open='117.0',
            high='118.0',
            low='116.5',
            close='117.8',
            volume=1000,
            source='core',
        )
        first_bar = IntradayBar.objects.create(
            symbol='FPT',
            datetime=now - timedelta(hours=1),
            timeframe='1H',
            open='118.0',
            high='118.7',
            low='117.9',
            close='118.5',
            volume=1200,
            source='core',
        )
        second_bar = IntradayBar.objects.create(
            symbol='FPT',
            datetime=now,
            timeframe='1H',
            open='118.5',
            high='119.1',
            low='118.2',
            close='118.9',
            volume=1350,
            source='core',
        )
        IntradayBar.objects.create(
            symbol='FPT',
            datetime=now,
            timeframe='15m',
            open='118.5',
            high='118.8',
            low='118.4',
            close='118.6',
            volume=400,
            source='core',
        )

        response = self.client.get('/core/v1/market-data/intraday-prices/FPT/?timeframe=1H&days=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['timeframe'], '1H')
        self.assertEqual(payload['interval'], '1h')
        self.assertEqual(payload['source'], 'intraday_bar_db')
        self.assertEqual(payload['days'], 2)
        self.assertEqual(len(payload['points']), 2)
        self.assertEqual(payload['points'][0]['date'], first_bar.datetime.isoformat())
        self.assertEqual(payload['points'][0]['close'], 118.5)
        self.assertEqual(payload['points'][1]['date'], second_bar.datetime.isoformat())
        self.assertEqual(payload['points'][1]['close'], 118.9)
        fetch_intraday_ohlcv_mock.assert_not_called()

    @patch('market_data.vnbroker_adapter.fetch_intraday_ohlcv', side_effect=AssertionError('provider path must not run in request path'))
    def test_intraday_prices_returns_empty_payload_when_db_missing(self, fetch_intraday_ohlcv_mock):
        response = self.client.get('/core/v1/market-data/intraday-prices/FPT/?timeframe=1H&days=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['timeframe'], '1H')
        self.assertEqual(payload['source'], 'intraday_bar_db')
        self.assertEqual(payload['days'], 0)
        self.assertEqual(payload['points'], [])
        fetch_intraday_ohlcv_mock.assert_not_called()