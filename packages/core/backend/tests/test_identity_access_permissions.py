"""
SAAS-14: identity_access permission enforcement tests.

Uses Django's TestCase for DB isolation.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

# Ensure src/ is on sys.path
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from identity_access.models import CoreServiceAccount, CoreTenant
from identity_access.permissions import IsTenantActive


class IsTenantActivePermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission = IsTenantActive()

        self.active_user = User.objects.create_user(
            username='active-tenant-user',
            password='testpass123',
        )
        self.active_tenant = CoreTenant.objects.create(
            owner_user=self.active_user,
            tenant_code='active-tenant-1',
            display_name='Active Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        self.trial_user = User.objects.create_user(
            username='trial-tenant-user',
            password='testpass123',
        )
        self.trial_tenant = CoreTenant.objects.create(
            owner_user=self.trial_user,
            tenant_code='trial-tenant-1',
            display_name='Trial Tenant',
            status=CoreTenant.StatusChoices.TRIAL,
        )

        self.suspended_user = User.objects.create_user(
            username='suspended-tenant-user',
            password='testpass123',
        )
        self.suspended_tenant = CoreTenant.objects.create(
            owner_user=self.suspended_user,
            tenant_code='suspended-tenant-1',
            display_name='Suspended Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )

        self.deprovisioned_user = User.objects.create_user(
            username='deprovisioned-tenant-user',
            password='testpass123',
        )
        self.deprovisioned_tenant = CoreTenant.objects.create(
            owner_user=self.deprovisioned_user,
            tenant_code='deprovisioned-tenant-1',
            display_name='Deprovisioned Tenant',
            status=CoreTenant.StatusChoices.DEPROVISIONED,
        )

        self.superuser = User.objects.create_superuser(
            username='super-tenant-user',
            email='super-tenant@example.com',
            password='testpass123',
        )
        self.superuser_tenant = CoreTenant.objects.create(
            owner_user=self.superuser,
            tenant_code='super-tenant-1',
            display_name='Superuser Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )

        self.no_tenant_user = User.objects.create_user(
            username='no-tenant-user',
            password='testpass123',
        )

    def _request_for_user(self, user):
        request = self.factory.get('/api/core/v1/partner/service-accounts/')
        request.user = user
        return request

    def test_active_tenant_allowed(self):
        self.assertTrue(self.permission.has_permission(self._request_for_user(self.active_user), None))

    def test_trial_tenant_allowed(self):
        self.assertTrue(self.permission.has_permission(self._request_for_user(self.trial_user), None))

    def test_suspended_tenant_blocked(self):
        self.assertFalse(self.permission.has_permission(self._request_for_user(self.suspended_user), None))

    def test_deprovisioned_tenant_blocked(self):
        self.assertFalse(self.permission.has_permission(self._request_for_user(self.deprovisioned_user), None))

    def test_superuser_bypasses_tenant_status(self):
        self.assertTrue(self.permission.has_permission(self._request_for_user(self.superuser), None))

    def test_user_without_tenant_allowed(self):
        self.assertTrue(self.permission.has_permission(self._request_for_user(self.no_tenant_user), None))


class IsTenantActiveRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username='route-tenant-user',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='route-tenant-1',
            display_name='Route Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Route Bot',
        )

        self.superuser = User.objects.create_superuser(
            username='route-superuser',
            email='route-superuser@example.com',
            password='testpass123',
        )
        self.superuser_tenant = CoreTenant.objects.create(
            owner_user=self.superuser,
            tenant_code='route-super-tenant-1',
            display_name='Route Superuser Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )
        self.superuser_service_account = CoreServiceAccount.objects.create(
            tenant=self.superuser_tenant,
            name='Route Superuser Bot',
        )

    def test_suspended_tenant_blocks_partner_service_accounts_route(self):
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save(update_fields=['status', 'updated_at'])

        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/core/v1/partner/service-accounts/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_bypasses_suspended_tenant_on_partner_service_accounts_route(self):
        self.client.force_authenticate(user=self.superuser)
        response = self.client.get('/api/core/v1/partner/service-accounts/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(len(response.data['results']), 1)

    def test_public_legal_pages_route_unchanged(self):
        response = self.client.get('/api/public/legal-pages/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {'results': []})


class PartnerScopeGuardRouteTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='partner-scope-user',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='partner-scope-tenant-1',
            display_name='Partner Scope Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.PRO,
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Partner Scope Bot',
            scopes=[],
        )

    def test_machine_pat_without_manage_pats_scope_is_forbidden(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/partner/pats/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_human_login_pat_bypasses_partner_scope_guard(self):
        client = APIClient()
        login_response = client.post(
            '/api/auth/login/',
            {'username': self.user.username, 'password': 'testpass123'},
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['token']}")

        response = client.get('/api/core/v1/partner/pats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_machine_pat_cannot_use_refresh_flow(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='machine-refresh-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        response = client.post('/api/auth/token/refresh/', {'refresh': raw_secret}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_cannot_inherit_operator_access_from_staff_owner(self):
        from identity_access.models import CorePATCredential

        staff_user = User.objects.create_user(
            username='staff-partner-owner',
            password='testpass123',
            is_staff=True,
        )
        staff_tenant = CoreTenant.objects.create(
            owner_user=staff_user,
            tenant_code='staff-partner-tenant-1',
            display_name='Staff Partner Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        staff_service_account = CoreServiceAccount.objects.create(
            tenant=staff_tenant,
            name='Staff Machine Bot',
            scopes=['market:read'],
        )
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=staff_service_account,
            scopes=['market:read'],
            label='staff-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/core/v1/audit-log')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_without_manage_tenant_scope_is_forbidden_on_partner_billing_route(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='billing-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/partner/billing/subscription/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_without_manage_tenant_scope_is_forbidden_on_tenant_members_route(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='tenant-members-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/tenant-members/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_is_forbidden_on_dnse_credential_route(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='dnse-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/dnse-credential/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_with_manage_tenant_scope_can_access_partner_billing_route(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_tenant'],
            label='billing-admin-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/partner/billing/subscription/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_staff_human_session_pat_keeps_operator_access(self):
        staff_user = User.objects.create_user(
            username='staff-human-owner',
            password='testpass123',
            is_staff=True,
        )
        staff_tenant = CoreTenant.objects.create(
            owner_user=staff_user,
            tenant_code='staff-human-tenant-1',
            display_name='Staff Human Tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        CoreServiceAccount.objects.create(
            tenant=staff_tenant,
            name='Staff Human Bot',
            scopes=['market:read'],
        )

        client = APIClient()
        login_response = client.post(
            '/api/auth/login/',
            {'username': staff_user.username, 'password': 'testpass123'},
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['token']}")

        response = client.get('/core/v1/audit-log')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_machine_pat_with_manage_pats_scope_can_access_partner_pat_routes(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='scoped-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/partner/pats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_cannot_issue_scope_outside_its_own_grants(self):
        from identity_access.models import CorePATCredential

        self.service_account.scopes = ['manage_pats', 'manage_service_accounts']
        self.service_account.save(update_fields=['scopes', 'updated_at'])

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='limited-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.post(
            '/api/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.service_account.public_id,
                'scope_codes': ['manage_service_accounts'],
                'display_name': 'Escalated PAT',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_machine_pat_cannot_spoof_human_login_markers(self):
        from identity_access.models import CorePATCredential

        self.service_account.scopes = ['manage_pats']
        self.service_account.save(update_fields=['scopes', 'updated_at'])

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.post(
            '/api/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.service_account.public_id,
                'scope_codes': ['manage_pats'],
                'display_name': 'login:spoofed',
                'audit_reason': 'core login',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_forged_human_markers_without_human_session_flag_do_not_bypass_scope_guard(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='login:forged',
            audit_reason='core login',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/core/v1/partner/pats/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_service_account_detail_route_requires_manage_service_accounts_scope(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='detail-machine-token',
            audit_reason='machine_pat',
        )

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get(f'/core/v1/service-accounts/{self.service_account.public_id}')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_pat_from_disabled_service_account_cannot_authenticate(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='disabled-service-account-token',
            audit_reason='machine_pat',
        )
        self.service_account.status = CoreServiceAccount.StatusChoices.DISABLED
        self.service_account.save(update_fields=['status', 'updated_at'])

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        response = client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_refresh_token_from_disabled_service_account_is_rejected(self):
        from identity_access.models import CorePATCredential

        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['manage_pats'],
            label='disabled-refresh-token',
            audit_reason='machine_pat',
        )
        self.service_account.status = CoreServiceAccount.StatusChoices.DISABLED
        self.service_account.save(update_fields=['status', 'updated_at'])

        client = APIClient()
        response = client.post('/api/auth/token/refresh/', {'refresh': raw_secret}, format='json')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(credential.public_id, credential.public_id)

    def test_cannot_disable_last_active_service_account(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.patch(
            f'/core/v1/service-accounts/{self.service_account.public_id}',
            {'status': CoreServiceAccount.StatusChoices.DISABLED},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.service_account.refresh_from_db()
        self.assertEqual(self.service_account.status, CoreServiceAccount.StatusChoices.ACTIVE)

    def test_cannot_delete_last_active_service_account(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.delete(f'/core/v1/service-accounts/{self.service_account.public_id}')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            CoreServiceAccount.objects.filter(pk=self.service_account.pk).exists()
        )