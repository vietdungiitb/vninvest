"""D1 tests: retail reference endpoints (mocked vnbroker facade, cache).

Chạy: python manage.py test user_workspace.test_broker_retail
"""
import pandas as pd
from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import MagicMock, patch


def _mod():
    return 'user_workspace.views_retail'


class RetailReferenceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bret', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        from django.core.cache import cache
        cache.clear()

    def _fake_retail(self):
        retail = MagicMock()
        retail.gold.return_value = pd.DataFrame([{
            'name': 'SJC 1L', 'branch': 'HN', 'buy_price': 100.0,
            'sell_price': 102.0, 'date': '2026-09-22', 'source': 'SJC'}])
        retail.exchange_rate.return_value = pd.DataFrame([{
            'currency_code': 'USD', 'buy_cash': 25000.0, 'sell': 25400.0}])
        return retail

    def test_gold_ok_and_cached(self):
        with patch('vnbroker.Vnbroker') as mock_vn:
            mock_vn.return_value.retail.return_value = self._fake_retail()
            r1 = self.client.get('/core/v1/broker/retail/gold/?source=sjc')
            self.assertEqual(r1.status_code, 200)
            self.assertFalse(r1.json()['cached'])
            self.assertEqual(r1.json()['rows'][0]['name'], 'SJC 1L')
            r2 = self.client.get('/core/v1/broker/retail/gold/?source=sjc')
            self.assertTrue(r2.json()['cached'])
            self.assertEqual(r2.json()['rows'], r1.json()['rows'])

    def test_gold_bad_source_400(self):
        resp = self.client.get('/core/v1/broker/retail/gold/?source=xyz')
        self.assertEqual(resp.status_code, 400)

    def test_exchange_rate_ok(self):
        with patch('vnbroker.Vnbroker') as mock_vn:
            mock_vn.return_value.retail.return_value = self._fake_retail()
            resp = self.client.get('/core/v1/broker/retail/exchange-rate/')
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()['source'], 'vcb')
            self.assertEqual(resp.json()['rows'][0]['currency_code'], 'USD')

    def test_upstream_error_mapped(self):
        with patch('vnbroker.Vnbroker') as mock_vn:
            retail = MagicMock()
            retail.gold.side_effect = RuntimeError('down')
            mock_vn.return_value.retail.return_value = retail
            resp = self.client.get('/core/v1/broker/retail/gold/?source=btmc')
            self.assertEqual(resp.status_code, 400)
            self.assertIn('upstream_error', str(resp.content))

    def test_requires_auth(self):
        anon = APIClient()
        resp = anon.get('/core/v1/broker/retail/gold/')
        self.assertEqual(resp.status_code, 401)

