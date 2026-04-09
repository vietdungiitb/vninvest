from unittest.mock import patch

from django.contrib.auth.models import User
from django.test.utils import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.exceptions import ExternalSystemException
from portfolio.models import UserConfig
from portfolio.observability import get_market_observability_snapshot, reset_market_observability


@override_settings(ENABLE_NEW_MARKET_VIEWS=True)
class MarketObservabilityTests(APITestCase):
    def setUp(self):
        self.username = 'obs-user'
        self.password = 'Test@123456'
        self.user = User.objects.create_user(
            username=self.username,
            email='obs-user@example.com',
            password=self.password,
        )
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True},
        )
        reset_market_observability()

    def authenticate(self):
        response = self.client.post(
            '/api/auth/token/',
            {'username': self.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    @patch('portfolio.market_views.market_data_service.get_intraday_matched')
    def test_market_observability_health_reports_http_p95(self, mock_get_intraday_matched):
        self.authenticate()
        mock_get_intraday_matched.return_value = {
            'symbol': 'VCB',
            'trades': [],
            'total': 0,
            'source': 'mock',
        }

        response = self.client.get('/api/realtime/intraday/VCB/?page_size=50')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        health_response = self.client.get('/api/health/market-observability/')
        self.assertEqual(health_response.status_code, status.HTTP_200_OK)
        payload = health_response.json()
        self.assertGreaterEqual(payload['overall']['http_requests'], 1)
        self.assertIn('intraday-matched', payload['endpoints'])
        self.assertIn('p95', payload['endpoints']['intraday-matched']['latency_ms'])

    @patch('portfolio.market_data_service.fetch_intraday_dataframe')
    @patch('portfolio.market_data_service.is_vnstock_rate_limited')
    @patch('portfolio.market_data_service.read_stream_intraday_ticks')
    def test_whale_feed_timeout_records_fallback_and_timeout(
        self,
        mock_read_stream_intraday_ticks,
        mock_is_vnstock_rate_limited,
        mock_fetch_intraday_dataframe,
    ):
        self.authenticate()
        mock_read_stream_intraday_ticks.return_value = []
        mock_is_vnstock_rate_limited.return_value = False
        mock_fetch_intraday_dataframe.side_effect = ExternalSystemException(
            'vnstock timeout sau 8s',
            code='vnstock_timeout',
        )

        response = self.client.get('/api/realtime/whale-feed/VCB/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'timeout')

        snapshot = get_market_observability_snapshot()
        self.assertGreaterEqual(snapshot['overall']['external_timeouts'], 1)
        self.assertGreaterEqual(snapshot['overall']['fallback_hits'], 1)
        self.assertEqual(snapshot['fallback_breakdown']['whale-feed']['timeout'], 1)
        self.assertEqual(snapshot['external_timeout_breakdown']['whale-feed']['vnstock'], 1)


class AdminRuntimeKPITests(APITestCase):
    """Tests for GET /api/admin-ops/runtime-kpi/ (S24-04)."""

    def setUp(self):
        self.password = 'Test@123456'
        self.regular_user = User.objects.create_user(
            username='kpi-regular',
            email='kpi-regular@example.com',
            password=self.password,
        )
        UserConfig.objects.update_or_create(
            user=self.regular_user,
            defaults={'email_verified': True},
        )
        self.admin_user = User.objects.create_user(
            username='kpi-admin',
            email='kpi-admin@example.com',
            password=self.password,
            is_staff=True,
        )
        UserConfig.objects.update_or_create(
            user=self.admin_user,
            defaults={'email_verified': True},
        )
        reset_market_observability()

    def _authenticate(self, user):
        response = self.client.post(
            '/api/auth/token/',
            {'username': user.username, 'password': self.password},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_admin_runtime_kpi_requires_staff(self):
        self._authenticate(self.regular_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_runtime_kpi_anonymous_401(self):
        response = self.client.get('/api/admin-ops/runtime-kpi/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_runtime_kpi_returns_snapshot_structure(self):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sampled_at', data)
        self.assertIn('market_observability', data)
        self.assertIn('prefetch_health', data)
        self.assertIn('celery', data)
        obs = data['market_observability']
        self.assertIn('overall', obs)
        self.assertIn('http_requests', obs['overall'])
        self.assertIn('ai_chart_context', obs)
        self.assertIn('present', obs['ai_chart_context'])
        self.assertIn('used', obs['ai_chart_context'])
        self.assertIn('alive', data['celery'])

    def test_admin_runtime_kpi_advisory_merge_requires_staff(self):
        self._authenticate(self.regular_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/advisory-merge/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_runtime_kpi_advisory_merge_returns_structure(self):
        self._authenticate(self.admin_user)
        response = self.client.get('/api/admin-ops/runtime-kpi/advisory-merge/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('sampled_at', data)
        self.assertIn('advisory_event_merge', data)
        merge = data['advisory_event_merge']
        self.assertIn('scheduled', merge)
        self.assertIn('merged', merge)
        self.assertIn('flushed', merge)
        self.assertIn('skipped', merge)

