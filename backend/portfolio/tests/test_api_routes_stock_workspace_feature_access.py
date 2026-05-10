from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig, WhaleAdvisory


class ApiRouteStockWorkspaceFeatureAccessTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)
        cache.clear()
        _ai_ready = {'ready': True, 'message': 'ok', 'reason': ''}
        self._patcher_ai_status = patch('portfolio.views._get_ai_runtime_config_status', return_value=_ai_ready)
        self._patcher_ai_status.start()
        self.addCleanup(self._patcher_ai_status.stop)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    def _attach_dpi_license(self, plan_name, feature_flags=None, status='active', grace_days=7):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests._attach_dpi_license(self, plan_name, feature_flags, status, grace_days)

    def test_stock_order_flow_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'dark_pool_flow': False})
        self.authenticate()

        response = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'dark_pool_flow')

    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_order_flow_returns_200_when_feature_enabled_for_pro_dpi_license(self, mock_cvd_series, mock_detect_dark_flow):
        self._attach_dpi_license('pro', {'dark_pool_flow': True})
        self.authenticate()
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }

        response = self.client.get('/api/stock-management/stocks/FPT/order-flow/?window=15m')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'community': {
                'api_calls_per_day': 1,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 10,
                'exports_per_day': 0,
            },
        },
    )
    @patch('portfolio.order_flow.detect_dark_flow')
    @patch('portfolio.order_flow.compute_cvd_series')
    def test_stock_order_flow_returns_429_when_api_quota_exceeded(self, mock_cvd_series, mock_detect_dark_flow):
        cache.clear()
        self.authenticate()
        mock_cvd_series.return_value = []
        mock_detect_dark_flow.return_value = {
            'signal_type': None,
            'strength': 0,
            'confidence': 'low',
            'components': {},
        }

        first = self.client.get('/api/stock-management/stocks/FPT/order-flow/')
        second = self.client.get('/api/stock-management/stocks/FPT/order-flow/')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'api_calls_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)

    def test_stock_ai_advisory_components_generate_returns_403_when_feature_locked_for_free_dpi_license(self):
        self._attach_dpi_license('free', {'sentiment_score': False})
        self.authenticate()

        response = self.client.post(
            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
            {'timeframe': '15m'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['ok'])
        self.assertEqual(response.data['code'], 'feature_locked')
        self.assertEqual(response.data['feature_key'], 'sentiment_score')

    def test_check_feature_access_allows_staff_admin_without_dpi_feature(self):
        from portfolio.opencore_dpi import check_feature_access

        admin_user = User.objects.create_superuser(
            username='route-admin',
            email='route-admin@example.com',
            password='Test@123456',
        )
        can_access, reason = check_feature_access(admin_user, 'sentiment_score')

        self.assertTrue(can_access)
        self.assertIsNone(reason)

    def test_stock_ai_advisory_components_generate_allows_admin_even_without_pro_feature_license(self):
        from portfolio.opencore_dpi import DPILicense, DPIPlan

        admin_user = User.objects.create_superuser(
            username='stock-admin',
            email='stock-admin@example.com',
            password='Test@123456',
        )
        UserConfig.objects.update_or_create(
            user=admin_user,
            defaults={'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        admin_cfg = UserConfig.objects.get(user=admin_user)
        admin_cfg.set_ai_api_key('sk-admin-route')
        admin_cfg.save(update_fields=['ai_api_key'])

        free_plan, _ = DPIPlan.objects.get_or_create(
            name='free',
            defaults={
                'display_name': 'Community',
                'annual_price_usd': 0,
                'monthly_price_usd': 0,
                'features': {'sentiment_score': False, 'whale_momentum': False},
            },
        )
        DPILicense.objects.update_or_create(
            user=admin_user,
            defaults={
                'plan': free_plan,
                'status': 'active',
                'expiry_date': timezone.now() + timedelta(days=30),
            },
        )

        WhaleAdvisory.objects.create(
            user=admin_user,
            symbol='BCM',
            matched_value=7_000_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Admin workspace summary',
            ai_detail='Admin workspace detail',
            ai_provider='copilot',
            ai_model='openai/gpt-4o',
        )

        token_response = self.client.post(
            '/api/auth/token/',
            {'username': 'stock-admin', 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")

        with patch('portfolio.views._get_ai_runtime_config_status', return_value={'ready': True, 'message': '', 'reason': None}):
            with patch('portfolio.order_flow.detect_dark_flow', return_value={}):
                with patch('portfolio.views._sprint17_generate_component_templates_with_ai', return_value=[]):
                    with patch('portfolio.views._sprint17_build_component_templates', return_value=[]):
                        response = self.client.post(
                            '/api/stock-management/stocks/BCM/ai-advisory-components/generate/',
                            {'timeframe': '15m'},
                            format='json',
                        )

        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
