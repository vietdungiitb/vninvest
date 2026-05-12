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