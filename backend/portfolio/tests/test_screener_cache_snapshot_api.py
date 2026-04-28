from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.services_global_screener import GlobalScreenerService


RUN_URL = lambda pk: f'/api/portfolio/screener/rules/{pk}/run/'


class ScreenerCacheSnapshotApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='cache-user', password='Test@123456')
        self.client.force_authenticate(user=self.user)
        cache.clear()

    def tearDown(self):
        cache.clear()

    def _build_rule(self, rule_id=42):
        return SimpleNamespace(
            id=rule_id,
            name='Cached Global Screener',
            rules_json=[{'field': 'close', 'op': 'gt', 'value': 100000}],
        )

    @patch('portfolio.views_screener.generics.get_object_or_404')
    @patch('portfolio.views_screener.ScreenerScheduleConfig.objects.first', return_value=None)
    def test_run_uses_cached_master_snapshot_without_business_db_queries(self, _mock_schedule, mock_get_rule):
        cache.set(
            GlobalScreenerService.CACHE_KEY,
            {
                'rows': [
                    {
                        'symbol': 'VCB',
                        'date': '2026-04-27',
                        'close': 120000,
                        'volume': 1000,
                        'rsi_14': 25,
                    },
                    {
                        'symbol': 'FPT',
                        'date': '2026-04-27',
                        'close': 90000,
                        'volume': 1200,
                        'rsi_14': 40,
                    },
                ]
            },
        )
        mock_get_rule.return_value = self._build_rule()

        with CaptureQueriesContext(connection) as ctx:
            response = self.client.post(RUN_URL(42))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_scanned'], 2)
        self.assertEqual(response.data['matched_count'], 1)
        self.assertEqual(response.data['matched'][0]['symbol'], 'VCB')
        self.assertEqual(len(ctx), 0)

    @patch('portfolio.views_screener.generics.get_object_or_404')
    def test_run_feature_flag_disabled_returns_403(self, mock_get_rule):
        mock_get_rule.return_value = self._build_rule(rule_id=77)

        with patch('portfolio.views_screener.ScreenerScheduleConfig.objects.first') as mock_schedule_first:
            mock_schedule_first.return_value = SimpleNamespace(is_user_custom_screener_enabled=False)
            response = self.client.post(RUN_URL(77))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('bảo trì', str(response.data).lower())