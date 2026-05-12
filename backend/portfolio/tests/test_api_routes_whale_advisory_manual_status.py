from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import TrackedSymbol, UserConfig, WhaleAdvisory


class ApiRouteWhaleAdvisoryManualStatusTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True},
        )
        TrackedSymbol.objects.update_or_create(user=self.user, symbol='FPT', defaults={})

    def authenticate_direct(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate_direct(self)

    @patch('portfolio.views._cache_get', return_value=None)
    def test_manual_refresh_status_reports_ready_when_not_locked(self, _mock_cache_get):
        self.authenticate_direct()

        response = self.client.get('/api/portfolio/ai-advisory/FPT/manual-refresh-status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertEqual(response.data['queue_name'], 'manual_on_demand')
        self.assertEqual(response.data['status'], 'ready')
        self.assertEqual(response.data['retry_after_seconds'], 0)
        self.assertFalse(response.data['is_locked'])

    @patch('portfolio.views._cache_get', return_value='locked')
    def test_manual_refresh_status_reports_cooldown_when_locked(self, _mock_cache_get):
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
            refresh_count=1,
            is_auto_generated=False,
            source=WhaleAdvisory.SourceChoices.USER_REFRESH,
        )

        self.authenticate_direct()

        response = self.client.get('/api/portfolio/ai-advisory/FPT/manual-refresh-status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['status'], 'cooldown')
        self.assertEqual(response.data['queue_name'], 'manual_on_demand')
        self.assertEqual(response.data['manual_refresh_cooldown_seconds'], 90)
        self.assertEqual(response.data['retry_after_seconds'], 90)
        self.assertTrue(response.data['is_locked'])
        self.assertEqual(response.data['last_manual_refresh_id'], advisory.id)
        self.assertEqual(response.data['last_manual_refresh_count'], 1)
        self.assertIsNotNone(response.data['last_manual_refresh_at'])
        self.assertIsNotNone(response.data['next_retry_at'])