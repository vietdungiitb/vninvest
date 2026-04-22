from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig
from portfolio.models import TickerSessionClose
from portfolio.views_whale_orders import _get_reference_price


class WhaleOrdersSsotParityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='ssot_user', password='pass12345')
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': 'pro',
                'email_verified': True,
                'whale_alert_threshold': 500,
            },
        )
        self.client.force_authenticate(user=self.user)

    @patch('portfolio.views_whale_orders.market_data_service.get_whale_feed')
    @patch('portfolio.views_whale_orders._get_reference_price')
    def test_whale_orders_endpoint_uses_canonical_feed_and_returns_orders_without_ref_price(self, mock_get_ref, mock_get_whale_feed):
        mock_get_ref.side_effect = [None, None]
        now = timezone.localtime(timezone.now())
        mock_get_whale_feed.return_value = {
            'symbol': 'FPT',
            'threshold': 500_000_000,
            'threshold_source': 'user_default',
            'source': 'redis_stream',
            'source_event_at': now.isoformat(),
            'fetched_at': now.isoformat(),
            'whale_orders': [
                {
                    'ts': now.isoformat(),
                    'time': now.strftime('%H:%M:%S'),
                    'price': 100000,
                    'volume': 7000,
                    'matched_value': 700000000,
                    'side': 'buy',
                    'event_score': 80,
                    'display_score': 74,
                    'severity': 'high',
                }
            ],
        }

        response = self.client.get('/api/portfolio/whale/orders/FPT/?timeframe=session')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertTrue(response.data['degraded_mode'])
        self.assertEqual(response.data['summary']['total_orders'], 1)
        self.assertEqual(len(response.data['orders']['buy']), 1)
        self.assertEqual(response.data['source'], 'redis_stream')
        self.assertEqual(response.data['threshold'], 500_000_000)

    @patch('portfolio.views_whale_orders.market_data_service.get_whale_feed')
    @patch('portfolio.views_whale_orders._get_reference_price')
    def test_whale_orders_filters_by_timeframe(self, mock_get_ref, mock_get_whale_feed):
        mock_get_ref.return_value = Decimal('100000')
        now = timezone.localtime(timezone.now())
        old_ts = now - timedelta(hours=2)

        mock_get_whale_feed.return_value = {
            'symbol': 'FPT',
            'threshold': 500_000_000,
            'threshold_source': 'user_default',
            'source': 'intraday_tick_db',
            'source_event_at': now.isoformat(),
            'fetched_at': now.isoformat(),
            'whale_orders': [
                {
                    'ts': old_ts.isoformat(),
                    'time': old_ts.strftime('%H:%M:%S'),
                    'price': 100000,
                    'volume': 7000,
                    'matched_value': 700000000,
                    'side': 'buy',
                },
                {
                    'ts': now.isoformat(),
                    'time': now.strftime('%H:%M:%S'),
                    'price': 101000,
                    'volume': 7000,
                    'matched_value': 707000000,
                    'side': 'sell',
                },
            ],
        }

        response = self.client.get('/api/portfolio/whale/orders/FPT/?timeframe=15m')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary']['total_orders'], 1)
        self.assertEqual(len(response.data['orders']['sell']), 1)
        self.assertEqual(len(response.data['orders']['buy']), 0)


class WhaleOrdersReferencePriceLookupTests(APITestCase):
    def test_reference_price_falls_back_to_latest_session_not_newer_than_trade_date(self):
        TickerSessionClose.objects.create(
            symbol='FPT',
            market_code='VN_STOCK',
            session_date=date(2026, 4, 19),
            close_price=Decimal('115700.00'),
            prev_close_price=Decimal('115850.00'),
        )

        # 2026-04-22 has no snapshot; should fallback to nearest prior session.
        ref_price = _get_reference_price('FPT', date(2026, 4, 22))

        self.assertEqual(ref_price, Decimal('115850.00'))

    def test_reference_price_fallback_uses_close_price_when_prev_close_missing(self):
        TickerSessionClose.objects.create(
            symbol='FPT',
            market_code='VN_STOCK',
            session_date=date(2026, 4, 18),
            close_price=Decimal('114000.00'),
            prev_close_price=None,
        )

        ref_price = _get_reference_price('FPT', date(2026, 4, 22))

        self.assertEqual(ref_price, Decimal('114000.00'))
