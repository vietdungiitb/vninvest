"""Dot2 honest-contract tests (S1.1 B-5 + S2.1 B-2 + S3.1 branch-B).

Fail-before: price la string, depth-chart bia so, bars thieu adjusted.
Pass-after: price la number, depth rong trung thuc, bars co adjusted+note.
"""
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot

User = get_user_model()


class Dot2HonestContractTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='dot2-reader',
            email='dot2@test.local',
            password='pass123',
        )
        SymbolSnapshot.objects.create(
            symbol='VNM',
            session_date=date.today(),
            price=Decimal('72.50'),
            price_change=Decimal('1.20'),
            price_change_pct=Decimal('1.6835'),
            volume=1234567,
            reference_price=Decimal('71.30'),
            ceiling=Decimal('76.40'),
            floor=Decimal('66.20'),
            open=Decimal('71.80'),
            high=Decimal('72.90'),
            low=Decimal('71.50'),
            market_status='open',
            stale=False,
            source='test',
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_quote_single_price_is_number_not_string(self):
        resp = self.client.get('/core/v1/realtime/ticker/VNM/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        p = resp.json()
        self.assertIsInstance(p['price'], (int, float))
        self.assertIsInstance(p['current_price'], (int, float))
        self.assertIsInstance(p['prev_price'], (int, float))
        self.assertIsInstance(p['price_change'], (int, float))
        self.assertIsInstance(p['change_value'], (int, float))
        self.assertIsInstance(p['price_change_pct'], (int, float))
        self.assertIsInstance(p['change_pct'], (int, float))
        self.assertIsInstance(p['volume'], int)

    def test_quote_batch_price_is_number_not_string(self):
        resp = self.client.get('/core/v1/realtime/tickers/', {'symbols': 'VNM'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        row = resp.json()['VNM']
        self.assertIsInstance(row['price'], (int, float))
        self.assertIsInstance(row['current_price'], (int, float))
        self.assertIsInstance(row['price_change_pct'], (int, float))
        self.assertIsInstance(row['reference_price'], (int, float))
        self.assertIsInstance(row['ceiling'], (int, float))

    def test_price_board_price_is_number_not_string(self):
        resp = self.client.get('/core/v1/realtime/price-board/VNM/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        p = resp.json()
        self.assertIsInstance(p['price'], (int, float))
        self.assertIsInstance(p['current_price'], (int, float))
        self.assertIsInstance(p['volume'], int)

    def test_depth_chart_honest_empty_no_synthetic(self):
        resp = self.client.get('/core/v1/realtime/depth-chart/VNM/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        p = resp.json()
        self.assertEqual(p['bids'], [])
        self.assertEqual(p['asks'], [])
        self.assertIsNone(p['spread'])
        self.assertEqual(p['data_quality'], 'unavailable')
        self.assertNotIn('is_mock', p)
        self.assertNotIn('source', p)  # khong 'synthetic_from_snapshot'
        self.assertTrue(p['note'])

    def test_bars_adjusted_false_with_note(self):
        for i, (o, h, l, c) in enumerate([
            (Decimal('71.00'), Decimal('71.90'), Decimal('70.80'), Decimal('71.30')),
            (Decimal('71.30'), Decimal('72.90'), Decimal('71.10'), Decimal('72.50')),
        ]):
            DailyPrice.objects.create(
                symbol='VNM',
                date=date.today() - timedelta(days=2 - i),
                open=o, high=h, low=l, close=c,
                volume=1000000 + i,
                source='test',
            )
        resp = self.client.get(
            '/core/v1/stock-management/stocks/VNM/bars/', {'timeframe': 'D'}
        )
        # Sau S3.1-nhanh-B: 200 + adjusted False + note, khong bia adj_close.
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.json()
        payload = body.get('data', body)
        self.assertFalse(payload['adjusted'])
        self.assertTrue(payload['note'])
        self.assertNotIn('adj_close', payload)
