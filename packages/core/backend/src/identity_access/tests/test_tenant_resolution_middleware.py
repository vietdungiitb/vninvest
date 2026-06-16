"""
Tests for TenantResolutionMiddleware.

Tests cover:
1. Valid X-Tenant-ID header with user membership
2. Invalid X-Tenant-ID header (tenant not found)
3. X-Tenant-ID header with user not a member
4. Fallback to tenant owner
5. Fallback to first tenant member
6. Suspended tenant returns 403
7. Deprovisioned tenant returns 403
8. Superuser bypass
9. Exempt paths bypass middleware
"""

import json
import uuid
from unittest.mock import patch, MagicMock

from django.contrib.auth import get_user_model
from django.test import TestCase, RequestFactory, override_settings
from django.http import JsonResponse

from identity_access.models import CoreTenant, CoreServiceAccount, CorePATCredential, TenantMember
from identity_access.middleware import TenantResolutionMiddleware

User = get_user_model()


def _parse_json_response(response):
    """Parse JSON response content."""
    return json.loads(response.content.decode('utf-8'))


class TenantResolutionMiddlewareTests(TestCase):
    """Test cases for TenantResolutionMiddleware."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantResolutionMiddleware(get_response=lambda r: JsonResponse({'status': 'ok'}))

        # Create test users
        self.owner_user = User.objects.create_user(
            username='owner_user',
            email='owner@test.com',
            password='testpass123'
        )
        self.member_user = User.objects.create_user(
            username='member_user',
            email='member@test.com',
            password='testpass123'
        )
        self.non_member_user = User.objects.create_user(
            username='non_member_user',
            email='nonmember@test.com',
            password='testpass123'
        )
        self.superuser = User.objects.create_user(
            username='superuser',
            email='super@test.com',
            password='testpass123',
            is_superuser=True
        )

        # Create test tenant
        self.tenant = CoreTenant.objects.create(
            public_id='test_tenant_123',
            tenant_code='test_tenant',
            display_name='Test Tenant',
            owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.FREE
        )

        # Create tenant member
        self.member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member_user,
            role=TenantMember.RoleChoices.ADMIN,
            invited_by=self.owner_user
        )

    def _create_request(self, path='/api/core/v1/partner/tenant/', user=None, tenant_header=None, auth_header=None):
        """Helper to create a request with optional headers and user."""
        request = self.factory.get(path)
        if tenant_header:
            request.META['HTTP_X_TENANT_ID'] = tenant_header
        if auth_header:
            request.META['HTTP_AUTHORIZATION'] = auth_header
        if user:
            request.user = user
        else:
            request.user = MagicMock()
            request.user.is_authenticated = False
        return request

    def test_exempt_path_bypasses_middleware(self):
        """Exempt paths should bypass tenant resolution."""
        exempt_paths = [
            '/health',
            '/api/core/v1/auth/login/',
            '/api/public/',
            '/admin/',
            '/static/',
        ]
        for path in exempt_paths:
            request = self._create_request(path=path)
            response = self.middleware(request)
            self.assertEqual(response.status_code, 200)

    def test_unauthenticated_user_bypasses_middleware(self):
        """Unauthenticated users should bypass tenant resolution."""
        request = self._create_request(user=None)
        request.user = MagicMock()
        request.user.is_authenticated = False
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)

    def test_valid_x_tenant_id_header_with_owner(self):
        """Valid X-Tenant-ID header with owner user should resolve tenant."""
        request = self._create_request(
            user=self.owner_user,
            tenant_header=str(self.tenant.public_id)
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_valid_x_tenant_id_header_with_member(self):
        """Valid X-Tenant-ID header with member user should resolve tenant."""
        request = self._create_request(
            user=self.member_user,
            tenant_header=str(self.tenant.public_id)
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.ADMIN)

    def test_invalid_x_tenant_id_header_returns_403(self):
        """Invalid X-Tenant-ID header should return 403."""
        request = self._create_request(
            user=self.owner_user,
            tenant_header='invalid_tenant_id'
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(_parse_json_response(response)['error'], 'tenant_not_found')

    def test_x_tenant_id_header_user_not_member_returns_403(self):
        """X-Tenant-ID header with user not a member should return 403."""
        request = self._create_request(
            user=self.non_member_user,
            tenant_header=str(self.tenant.public_id)
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(_parse_json_response(response)['error'], 'tenant_not_found')

    def test_fallback_to_tenant_owner(self):
        """Should fallback to tenant owner when no header provided."""
        request = self._create_request(user=self.owner_user)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_fallback_to_first_member(self):
        """Should fallback to first tenant member when user is not owner."""
        request = self._create_request(user=self.member_user)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.ADMIN)

    def test_no_tenant_for_user_returns_403(self):
        """User with no tenant membership should return 403."""
        request = self._create_request(user=self.non_member_user)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(_parse_json_response(response)['error'], 'tenant_not_found')

    def test_suspended_tenant_returns_403(self):
        """Suspended tenant should return 403."""
        self.tenant.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant.save()

        request = self._create_request(user=self.owner_user)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(_parse_json_response(response)['error'], 'tenant_suspended')

    def test_deprovisioned_tenant_returns_403(self):
        """Deprovisioned tenant should return 403."""
        self.tenant.status = CoreTenant.StatusChoices.DEPROVISIONED
        self.tenant.save()

        request = self._create_request(user=self.owner_user)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(_parse_json_response(response)['error'], 'tenant_suspended')

    def test_superuser_bypass_with_header(self):
        """Superuser with valid header should get tenant context."""
        request = self._create_request(
            user=self.superuser,
            tenant_header=str(self.tenant.public_id)
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_superuser_fallback_to_owned_tenant(self):
        """Superuser without header should fallback to owned tenant."""
        # Create a tenant owned by superuser
        superuser_tenant = CoreTenant.objects.create(
            public_id='superuser_tenant_123',
            tenant_code='superuser_tenant',
            display_name='Superuser Tenant',
            owner_user=self.superuser,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.FREE
        )

        request = self._create_request(user=self.superuser)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, superuser_tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_superuser_fallback_to_member_tenant(self):
        """Superuser without owned tenant should fallback to member tenant."""
        # Make superuser a member of the test tenant
        TenantMember.objects.create(
            tenant=self.tenant,
            user=self.superuser,
            role=TenantMember.RoleChoices.EDITOR,
            invited_by=self.owner_user
        )

        request = self._create_request(user=self.superuser)
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.EDITOR)

    def test_pat_authentication_resolves_user(self):
        """PAT authentication should resolve to tenant owner."""
        # Create service account and PAT
        service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Test SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read']
        )
        pat, raw_token = CorePATCredential.issue_for_service_account(
            service_account=service_account,
            scopes=['market:read'],
            label='Test PAT',
            audit_reason='test'
        )

        request = self._create_request(
            tenant_header=str(self.tenant.public_id),
            auth_header=f'Bearer {raw_token}'
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_pat_authentication_invalid_token_bypasses(self):
        """Invalid PAT token should bypass PAT auth and use session user."""
        request = self._create_request(
            user=self.owner_user,
            tenant_header=str(self.tenant.public_id),
            auth_header='Bearer invalid_token'
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_pat_authentication_revoked_token_bypasses(self):
        """Revoked PAT token should bypass PAT auth."""
        service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Test SA 2',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read']
        )
        pat, raw_token = CorePATCredential.issue_for_service_account(
            service_account=service_account,
            scopes=['market:read'],
            label='Test PAT 2',
            audit_reason='test'
        )
        pat.revoke_pat(reason='test')

        request = self._create_request(
            user=self.owner_user,
            tenant_header=str(self.tenant.public_id),
            auth_header=f'Bearer {raw_token}'
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_pat_authentication_disabled_service_account_bypasses(self):
        """PAT for disabled service account should bypass PAT auth."""
        service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Test SA 3',
            status=CoreServiceAccount.StatusChoices.DISABLED,
            scopes=['market:read']
        )
        pat, raw_token = CorePATCredential.issue_for_service_account(
            service_account=service_account,
            scopes=['market:read'],
            label='Test PAT 3',
            audit_reason='test'
        )

        request = self._create_request(
            user=self.owner_user,
            tenant_header=str(self.tenant.public_id),
            auth_header=f'Bearer {raw_token}'
        )
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)


class TenantResolutionMiddlewareIntegrationTests(TestCase):
    """Integration tests for TenantResolutionMiddleware with views."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantResolutionMiddleware(get_response=lambda r: JsonResponse({'status': 'ok'}))

        self.owner_user = User.objects.create_user(
            username='owner_user',
            email='owner@test.com',
            password='testpass123'
        )
        self.member_user = User.objects.create_user(
            username='member_user',
            email='member@test.com',
            password='testpass123'
        )

        self.tenant = CoreTenant.objects.create(
            public_id='test_tenant_123',
            tenant_code='test_tenant',
            display_name='Test Tenant',
            owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE,
            plan=CoreTenant.PlanChoices.FREE
        )

        self.member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member_user,
            role=TenantMember.RoleChoices.ADMIN,
            invited_by=self.owner_user
        )

    def test_middleware_sets_tenant_and_role_on_request(self):
        """Middleware should set request.tenant and request.tenant_role."""
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.user = self.owner_user
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant.public_id)

        response = self.middleware(request)

        self.assertTrue(hasattr(request, 'tenant'))
        self.assertTrue(hasattr(request, 'tenant_role'))
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_middleware_with_different_roles(self):
        """Middleware should set correct role based on membership."""
        # Test owner role
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.user = self.owner_user
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant.public_id)
        self.middleware(request)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

        # Test admin role
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.user = self.member_user
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant.public_id)
        self.middleware(request)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.ADMIN)

        # Test editor role
        self.member.role = TenantMember.RoleChoices.EDITOR
        self.member.save()
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.user = self.member_user
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant.public_id)
        self.middleware(request)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.EDITOR)

        # Test viewer role
        self.member.role = TenantMember.RoleChoices.VIEWER
        self.member.save()
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.user = self.member_user
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant.public_id)
        self.middleware(request)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.VIEWER)
