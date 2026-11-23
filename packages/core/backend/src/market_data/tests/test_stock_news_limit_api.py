"""RQ-B2 — news endpoint ton trong `limit` (REQ_BACKEND_FOR_WIDGET_NEWS_EVENTS_20261123.md).

Fail-before: `StockManagementNewsView.get` hien bo qua query `limit` va cache key
`stock_news:{symbol}` (khong co hau to limit) -> test RED.
"""
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, UserProfile
from market_data.tests.envelope import unwrapped_json

User = get_user_model()


def _five_news_frame():
    import pandas as pd
    return pd.DataFrame([
        {
            'news_id': f'kbs-{i}',
            'title': f'Tin {i}',
            'summary': f'Tom tat {i}',
            'url': f'https://example.vn/tin-{i}',
            'published_at': '2026-11-23T08:00:00+07:00',
            'source': 'KBS',
            'raw_hash': f'hash-{i}',
        }
        for i in range(5)
    ])


class StockNewsLimitApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        owner = User.objects.create_user(
            username='news-limit-owner', email='news-limit-owner@test.local', password='pass123',
        )
        tenant = CoreTenant.objects.create(
            tenant_code='news-limit-tenant', display_name='News Limit Tenant',
            plan=CoreTenant.PlanChoices.PRO, status=CoreTenant.StatusChoices.ACTIVE,
            owner_user=owner,
        )
        cls.user = User.objects.create_user(
            username='news-limit-user', email='news-limit-user@test.local', password='pass123',
        )
        UserProfile.objects.create(user=cls.user, tenant=tenant)

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        cache.clear()

    @patch('vnbroker.api.news.News')
    def test_limit_caps_results(self, mock_news):
        mock_news.return_value.by_symbol.return_value = _five_news_frame()
        response = self.client.get('/core/v1/stock-management/stocks/VNM/news/?limit=2')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'VNM')
        self.assertEqual(len(payload['news']), 2)

    @patch('vnbroker.api.news.News')
    def test_cache_key_has_limit_suffix(self, mock_news):
        mock_news.return_value.by_symbol.return_value = _five_news_frame()
        self.client.get('/core/v1/stock-management/stocks/VNM/news/?limit=2')
        self.assertIsNotNone(
            cache.get('stock_news:VNM:2'),
            'cache key phai co hau to limit de khong nhiem chéo giua limit=2 va limit=5',
        )

    @patch('vnbroker.api.news.News')
    def test_different_limits_do_not_share_cache(self, mock_news):
        mock_news.return_value.by_symbol.return_value = _five_news_frame()
        self.client.get('/core/v1/stock-management/stocks/VNM/news/?limit=2')
        self.client.get('/core/v1/stock-management/stocks/VNM/news/?limit=5')
        self.assertEqual(mock_news.return_value.by_symbol.call_count, 2)

    @patch('vnbroker.api.news.News')
    def test_limit_above_max_is_capped(self, mock_news):
        mock_news.return_value.by_symbol.return_value = _five_news_frame()
        payload = unwrapped_json(
            self.client.get('/core/v1/stock-management/stocks/VNM/news/?limit=999')
        )
        self.assertEqual(len(payload['news']), 5)
        self.assertIsNotNone(cache.get('stock_news:VNM:100'))

    @patch('vnbroker.api.news.News')
    def test_invalid_limit_falls_back_to_default(self, mock_news):
        mock_news.return_value.by_symbol.return_value = _five_news_frame()
        payload = unwrapped_json(
            self.client.get('/core/v1/stock-management/stocks/VNM/news/?limit=abc&force=true')
        )
        self.assertEqual(payload['symbol'], 'VNM')
