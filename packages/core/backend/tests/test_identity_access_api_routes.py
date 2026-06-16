"""
Native identity_access API route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant
from identity_access.views_tenant import (
    PATListView,
    ServiceAccountListView,
    partner_issue_pat,
    partner_revoke_pat,
    partner_rotate_pat,
)
from identity_access.views_auth import capabilities_view, login_view, profile_view, user_config_view


class IdentityAccessApiRouteTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(username='identity-owner', password='Test@123456', email='identity@example.com')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='identity-tenant-1',
            display_name='Identity Tenant',
            plan='pro',
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Identity Bot',
            scopes=['read:market', 'read:signals'],
        )
        self.credential, self.raw_pat = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='Identity PAT',
            audit_reason='tenant_admin_issue_pat',
        )

    def _login_and_authenticate(self):
        login_response = self.client.post(
            '/core/v1/auth/login/',
            {'username': self.user.username, 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        login_data = login_response.data['data']
        self.assertIn('token', login_data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_data['token']}")
        return login_response

    def test_login_me_capabilities_and_userconfig_routes_are_native(self):
        resolver_login = resolve('/core/v1/auth/login/')
        self.assertIs(resolver_login.func, login_view)

        login_response = self._login_and_authenticate()
        login_data = login_response.data['data']
        self.assertEqual(login_data['user']['username'], self.user.username)
        self.assertEqual(login_data['tenant']['tenant_code'], self.tenant.tenant_code)

        resolver_me = resolve('/core/v1/auth/me/')
        self.assertIs(resolver_me.func, profile_view)

        me_response = self.client.get('/core/v1/auth/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data['username'], self.user.username)
        self.assertIn('abilities', me_response.data)
        self.assertIn('entitlements', me_response.data)

        resolver_capabilities = resolve('/core/v1/access/capabilities/')
        self.assertIs(resolver_capabilities.func, capabilities_view)

        capabilities_response = self.client.get('/core/v1/access/capabilities/')
        self.assertEqual(capabilities_response.status_code, status.HTTP_200_OK)
        self.assertEqual(capabilities_response.data['principal']['identity']['username'], self.user.username)
        self.assertEqual(capabilities_response.data['build']['target'], 'saas')
        self.assertIn('abilities', capabilities_response.data)

        resolver_profile = resolve('/core/v1/identity/profile/')
        from identity_access.views_tenant import UserProfileView
        self.assertIs(resolver_profile.func.view_class, UserProfileView)

        userconfig_response = self.client.get('/core/v1/identity/profile/')
        self.assertEqual(userconfig_response.status_code, status.HTTP_200_OK)
        self.assertIn('whale_alert_threshold', userconfig_response.data)

    def test_partner_service_accounts_route_is_native(self):
        resolver_service_accounts = resolve('/core/v1/partner/service-accounts/')
        self.assertIs(resolver_service_accounts.func.view_class, ServiceAccountListView)

        login_response = self._login_and_authenticate()
        self.assertTrue(login_response.data['data']['access'])

        list_response = self.client.get('/core/v1/partner/service-accounts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', list_response.data)
        self.assertEqual(list_response.data['results'][0]['name'], self.service_account.name)

    def test_partner_pat_routes_are_native_and_list_never_leaks_secret(self):
        resolver_pat_list = resolve('/core/v1/partner/pats/')
        self.assertIs(resolver_pat_list.func.view_class, PATListView)

        resolver_pat_issue = resolve('/core/v1/partner/pats/issue/')
        self.assertIs(resolver_pat_issue.func, partner_issue_pat)

        resolver_pat_rotate = resolve(f'/core/v1/partner/pats/{self.credential.public_id}/rotate/')
        self.assertIs(resolver_pat_rotate.func, partner_rotate_pat)

        resolver_pat_revoke = resolve(f'/core/v1/partner/pats/{self.credential.public_id}/revoke/')
        self.assertIs(resolver_pat_revoke.func, partner_revoke_pat)

        self._login_and_authenticate()

        list_response = self.client.get('/core/v1/partner/pats/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', list_response.data)

        target_item = next(
            item for item in list_response.data['results']
            if item['pat_id'] == self.credential.public_id
        )
        self.assertEqual(target_item['service_account_id'], self.service_account.public_id)
        self.assertEqual(target_item['tenant_id'], self.tenant.public_id)
        self.assertEqual(target_item['token_prefix'], self.credential.token_prefix)
        self.assertNotIn('secret', target_item)
        self.assertNotIn('token', target_item)

    def test_login_session_pat_has_expiry_and_refresh_rotates_secret(self):
        login_response = self.client.post(
            '/core/v1/auth/login/',
            {'username': self.user.username, 'password': 'Test@123456'},
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        login_data = login_response.data['data']
        original_token = login_data['token']

        credential = CorePATCredential.resolve_from_raw_secret(original_token)
        self.assertIsNotNone(credential)
        self.assertTrue(credential.is_human_session)
        self.assertIsNotNone(credential.expires_at)

        refresh_response = self.client.post(
            '/core/v1/auth/token/refresh/',
            {'refresh': original_token},
            format='json',
        )

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        refresh_data = refresh_response.data['data']
        self.assertNotEqual(refresh_data['token'], original_token)

        credential.refresh_from_db()
        self.assertEqual(credential.status, CorePATCredential.StatusChoices.REVOKED)

        old_token_client = APIClient()
        old_token_client.credentials(HTTP_AUTHORIZATION=f'Bearer {original_token}')
        old_profile_response = old_token_client.get('/core/v1/auth/me/')
        self.assertEqual(old_profile_response.status_code, status.HTTP_401_UNAUTHORIZED)