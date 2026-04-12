from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig


class ApiRouteAuthProfileTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    @patch('portfolio.auth_views.send_verification_email', return_value=1)
    def test_login_is_blocked_for_unverified_user(self, _mock_send_verification_email):
        self.client.post(
            '/api/auth/register/',
            {
                'username': 'pending_verify_user',
                'email': 'pending@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Test@123456',
            },
            format='json',
        )

        response = self.client.post(
            '/api/auth/token/',
            {'username': 'pending_verify_user', 'password': 'Test@123456'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('xác thực', str(response.data['detail']).lower())

    def test_login_allows_unverified_superuser(self):
        admin_user = User.objects.create_superuser(
            username='root',
            email='root@example.com',
            password='Root@123456',
        )
        UserConfig.objects.update_or_create(
            user=admin_user,
            defaults={'email_verified': False},
        )

        response = self.client.post(
            '/api/auth/token/',
            {'username': 'root', 'password': 'Root@123456'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_register_endpoint_rejects_password_mismatch(self):
        response = self.client.post(
            '/api/auth/register/',
            {
                'username': 'password_mismatch_user',
                'email': 'password-mismatch@example.com',
                'password': 'Test@123456',
                'password_confirm': 'Mismatch@123456',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', response.data)

    def test_portfolio_userconfig_endpoint(self):
        self.authenticate()

        response = self.client.get('/api/portfolio/userconfig/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('whale_alert_threshold', response.data)

    def test_auth_me_endpoint_returns_plan_and_abilities(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'premium', 'whale_alert_threshold': 750, 'email_verified': True})
        self.authenticate()

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.username)
        self.assertEqual(response.data['plan'], 'premium')
        self.assertEqual(response.data['whale_alert_threshold'], 750.0)
        self.assertIn({'action': 'read', 'subject': 'WhaleAdvisory'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'WhaleAdvisoryDetail'}, response.data['abilities'])
        self.assertEqual(response.data['entitlements']['plan'], 'premium')
        self.assertEqual(response.data['entitlements']['tier'], 'pro_team')
        self.assertEqual(response.data['entitlements']['quota_caps']['api_calls_per_day'], 10000)
        self.assertEqual(response.data['entitlements']['quota_caps']['ai_regenerate_per_day'], 120)
        self.assertEqual(response.data['entitlements']['quota_caps']['whale_symbols_max'], 100)
        self.assertEqual(response.data['entitlements']['quota_caps']['exports_per_day'], 100)
        self.assertEqual(response.data['entitlements']['trial_state'], 'none')
        self.assertIsNone(response.data['entitlements']['trial_ends_at'])
        self.assertIsNone(response.data['entitlements']['grace_ends_at'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory_detail'])

    def test_auth_me_endpoint_returns_community_tier_for_free_plan(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'whale_alert_threshold': 500, 'email_verified': True},
        )
        self.authenticate()

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['entitlements']['plan'], 'free')
        self.assertEqual(response.data['entitlements']['tier'], 'community')
        self.assertEqual(response.data['entitlements']['quota_caps']['api_calls_per_day'], 300)
        self.assertEqual(response.data['entitlements']['quota_caps']['ai_regenerate_per_day'], 0)
        self.assertEqual(response.data['entitlements']['quota_caps']['whale_symbols_max'], 10)
        self.assertEqual(response.data['entitlements']['quota_caps']['exports_per_day'], 0)
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])