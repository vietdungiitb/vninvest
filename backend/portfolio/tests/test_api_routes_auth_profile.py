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
        self.assertFalse(response.data['is_staff'])
        self.assertFalse(response.data['is_superuser'])
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
        self.assertTrue(response.data['entitlements']['can_read_tenant_admin_home'])
        self.assertTrue(response.data['entitlements']['can_read_tenant_capabilities'])
        self.assertTrue(response.data['entitlements']['can_read_tenant_usage'])
        self.assertTrue(response.data['entitlements']['can_read_tenant_billing'])
        self.assertTrue(response.data['entitlements']['can_read_tenant_service_accounts'])
        self.assertTrue(response.data['entitlements']['can_write_tenant_service_accounts'])
        self.assertTrue(response.data['entitlements']['can_read_tenant_pats'])
        self.assertTrue(response.data['entitlements']['can_write_tenant_pats'])
        self.assertIn({'action': 'read', 'subject': 'TenantAdminHome'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'TenantCapabilityView'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'TenantUsageView'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'TenantBillingView'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'TenantServiceAccountAdmin'}, response.data['abilities'])
        self.assertIn({'action': 'create', 'subject': 'TenantServiceAccountAdmin'}, response.data['abilities'])
        self.assertIn({'action': 'update', 'subject': 'TenantServiceAccountAdmin'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'TenantPATAdmin'}, response.data['abilities'])
        self.assertIn({'action': 'issue', 'subject': 'TenantPATAdmin'}, response.data['abilities'])
        self.assertIn({'action': 'rotate', 'subject': 'TenantPATAdmin'}, response.data['abilities'])
        self.assertIn({'action': 'revoke', 'subject': 'TenantPATAdmin'}, response.data['abilities'])

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
        self.assertFalse(response.data['entitlements']['can_read_tenant_admin_home'])
        self.assertFalse(response.data['entitlements']['can_read_tenant_capabilities'])
        self.assertFalse(response.data['entitlements']['can_read_tenant_usage'])
        self.assertFalse(response.data['entitlements']['can_read_tenant_billing'])
        self.assertFalse(response.data['entitlements']['can_read_tenant_service_accounts'])
        self.assertFalse(response.data['entitlements']['can_write_tenant_service_accounts'])
        self.assertFalse(response.data['entitlements']['can_read_tenant_pats'])
        self.assertFalse(response.data['entitlements']['can_write_tenant_pats'])

    def test_auth_me_endpoint_returns_staff_flags_for_superuser(self):
        admin_user = User.objects.create_superuser(
            username='auth_me_admin',
            email='auth-me-admin@example.com',
            password='Admin@123456',
        )
        UserConfig.objects.update_or_create(
            user=admin_user,
            defaults={'email_verified': True},
        )
        self.client.force_authenticate(user=admin_user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'auth_me_admin')
        self.assertTrue(response.data['is_staff'])
        self.assertTrue(response.data['is_superuser'])
        self.assertEqual(response.data['plan'], 'admin')
        self.assertIn({'action': 'read', 'subject': 'AdminOps'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'AdminCrawlControl'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'CoreJobOps'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'CoreAuditTrace'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'StockDetailAdvancedTab'}, response.data['abilities'])
        self.assertNotIn({'action': 'manage', 'subject': 'all'}, response.data['abilities'])
        self.assertTrue(response.data['entitlements']['can_read_admin_ops'])
        self.assertTrue(response.data['entitlements']['can_read_admin_crawl_control'])

    def test_auth_me_endpoint_treats_staff_user_as_admin_capability_session(self):
        staff_user = User.objects.create_user(
            username='auth_me_staff',
            email='auth-me-staff@example.com',
            password='Admin@123456',
            is_staff=True,
        )
        UserConfig.objects.update_or_create(
            user=staff_user,
            defaults={'plan': 'free', 'email_verified': True},
        )
        self.client.force_authenticate(user=staff_user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['plan'], 'admin')
        self.assertIn({'action': 'read', 'subject': 'AdminOps'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'AdminCrawlControl'}, response.data['abilities'])
        self.assertNotIn({'action': 'manage', 'subject': 'all'}, response.data['abilities'])
        self.assertTrue(response.data['entitlements']['can_read_admin_ops'])

    def test_access_capabilities_route_returns_tenant_bootstrap_snapshot(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'premium', 'email_verified': True},
        )
        self.authenticate()

        response = self.client.get('/api/core/v1/access/capabilities/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['object'], 'capability_snapshot')
        self.assertEqual(response.data['snapshot_version'], '2026-05-03')
        self.assertEqual(response.data['actor']['session_type'], 'tenant_human')
        self.assertEqual(response.data['actor']['primary_tenant_id'], f'ten_usr_{self.user.id}')
        self.assertFalse(response.data['surfaces']['central_operator']['enabled'])
        self.assertTrue(response.data['surfaces']['tenant_admin']['enabled'])
        self.assertEqual(response.data['surfaces']['tenant_admin']['default_route'], '/tenant-admin/home')
        self.assertEqual(response.data['navigation']['default_route'], '/tenant-admin/home')
        self.assertIn({'action': 'read', 'subject': 'TenantAdminHome'}, response.data['abilities'])
        self.assertFalse(response.data['bridges']['legacy_manage_all_active'])
        self.assertEqual(response.data['bridges']['bridge_deprecation_state'], 'disabled')

    def test_access_capabilities_route_returns_operator_bootstrap_snapshot(self):
        admin_user = User.objects.create_superuser(
            username='capability_admin',
            email='capability-admin@example.com',
            password='Admin@123456',
        )
        UserConfig.objects.update_or_create(
            user=admin_user,
            defaults={'email_verified': True},
        )
        self.client.force_authenticate(user=admin_user)

        response = self.client.get('/api/core/v1/access/capabilities/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['object'], 'capability_snapshot')
        self.assertEqual(response.data['snapshot_version'], '2026-05-03')
        self.assertEqual(response.data['actor']['session_type'], 'operator_human')
        self.assertTrue(response.data['surfaces']['central_operator']['enabled'])
        self.assertEqual(response.data['surfaces']['central_operator']['default_route'], '/admin-ops')
        self.assertEqual(response.data['navigation']['default_route'], '/admin-ops')
        self.assertIn({'action': 'read', 'subject': 'AdminOps'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'AdminCrawlControl'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'CoreJobOps'}, response.data['abilities'])
        self.assertIn({'action': 'read', 'subject': 'CoreAuditTrace'}, response.data['abilities'])
        self.assertFalse(response.data['bridges']['legacy_manage_all_active'])
