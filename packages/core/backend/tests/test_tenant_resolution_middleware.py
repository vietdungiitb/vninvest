"""Tests for TenantResolutionMiddleware."""

import os
import sys
from unittest.mock import patch

# Set required environment variables BEFORE importing Django settings
os.environ.setdefault('DJANGO_DEBUG', 'true')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver')
os.environ.setdefault('CORE_PAT_PEPPER', 'test-pat-pepper-for-testing-only')
os.environ.setdefault('DJANGO_SECRET_KEY', 'test-secret-key-for-testing-only')

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpResponse
from django.test import RequestFactory, TestCase
from django.utils import timezone

from identity_access.middleware import TenantResolutionMiddleware
from identity_access.models import CoreTenant, TenantMember


class TenantResolutionMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

        # Create owner user and tenant
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='test-tenant-1',
            display_name='Test Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        # Create member user
        self.member_user = User.objects.create_user(
            username='member',
            email='member@example.com',
            password='testpass123',
        )
        self.member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.member_user,
            role=TenantMember.RoleChoices.EDITOR,
            invited_by=self.owner,
        )

        # Create another tenant for cross-tenant tests
        self.other_owner = User.objects.create_user(
            username='other_owner',
            email='other_owner@example.com',
            password='testpass123',
        )
        self.other_tenant = CoreTenant.objects.create(
            owner_user=self.other_owner,
            tenant_code='other-tenant-1',
            display_name='Other Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        # Create suspended tenant
        self.suspended_owner = User.objects.create_user(
            username='suspended_owner',
            email='suspended_owner@example.com',
            password='testpass123',
        )
        self.suspended_tenant = CoreTenant.objects.create(
            owner_user=self.suspended_owner,
            tenant_code='suspended-tenant-1',
            display_name='Suspended Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.SUSPENDED,
        )

        # Create superuser
        self.superuser = User.objects.create_superuser(
            username='superuser',
            email='superuser@example.com',
            password='testpass123',
        )

    def _request(self, path, user=None, tenant_header=None):
        request = self.factory.get(path)
        if user is not None:
            request.user = user
        else:
            request.user = AnonymousUser()
        if tenant_header:
            request.META['HTTP_X_TENANT_ID'] = tenant_header
        return request

    def _middleware(self):
        return TenantResolutionMiddleware(lambda request: HttpResponse('ok'))

    def test_header_valid_tenant_resolves_correct_tenant(self):
        """Test 1: Header X-Tenant-ID đúng -> resolves correct tenant."""
        request = self._request('/core/v1/partner/tenant/', self.owner, self.tenant.public_id)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_header_invalid_tenant_returns_403(self):
        """Test 2: Header X-Tenant-ID sai -> 403 Forbidden."""
        request = self._request('/core/v1/partner/tenant/', self.owner, 'invalid-tenant-id')
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 403)
        import json
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data['error'], 'tenant_not_found')

    def test_no_header_fallback_owner_resolved(self):
        """Test 3: Không có header -> fallback owner -> resolved."""
        request = self._request('/core/v1/partner/tenant/', self.owner)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_no_header_fallback_member_resolved(self):
        """Test 4: Không có header, không là owner, có là member -> fallback member -> resolved."""
        request = self._request('/core/v1/partner/tenant/', self.member_user)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.EDITOR)

    def test_suspended_tenant_returns_403(self):
        """Test 5: Tenant status là SUSPENDED -> 403 Forbidden."""
        request = self._request('/core/v1/partner/tenant/', self.suspended_owner)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 403)
        import json
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data['error'], 'tenant_suspended')

    def test_deprovisioned_tenant_returns_403(self):
        """Test: Tenant status là DEPROVISIONED -> 403 Forbidden."""
        # Create a new user for deprovisioned tenant
        deprovisioned_owner = User.objects.create_user(
            username='deprovisioned_owner',
            email='deprovisioned_owner@example.com',
            password='testpass123',
        )
        deprovisioned_tenant = CoreTenant.objects.create(
            owner_user=deprovisioned_owner,
            tenant_code='deprovisioned-tenant-1',
            display_name='Deprovisioned Tenant',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.DEPROVISIONED,
        )
        request = self._request('/core/v1/partner/tenant/', deprovisioned_owner)
        
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 403)
        import json
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data['error'], 'tenant_suspended')

    def test_cross_tenant_header_returns_403(self):
        """Test: User tries to access another tenant via header -> 403."""
        request = self._request('/core/v1/partner/tenant/', self.owner, self.other_tenant.public_id)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 403)
        import json
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data['error'], 'tenant_not_found')

    def test_member_cross_tenant_header_returns_403(self):
        """Test: Member tries to access another tenant via header -> 403."""
        request = self._request('/core/v1/partner/tenant/', self.member_user, self.other_tenant.public_id)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 403)
        import json
        data = json.loads(response.content.decode('utf-8'))
        self.assertEqual(data['error'], 'tenant_not_found')

    def test_exempt_paths_bypass_resolution(self):
        """Test: Exempt paths (health, auth) bypass tenant resolution."""
        exempt_paths = [
            '/health',
            '/api/core/v1/auth/login',
            '/core/v1/auth/login',
            '/api/public/some-endpoint',
            '/admin/',
            '/static/css/style.css',
        ]
        
        for path in exempt_paths:
            request = self._request(path, self.owner)
            response = self._middleware()(request)
            self.assertEqual(response.status_code, 200, f"Path {path} should be exempt")

    def test_unauthenticated_request_passes_through(self):
        """Test: Unauthenticated requests pass through without tenant resolution."""
        request = self._request('/core/v1/partner/tenant/')
        request.user = AnonymousUser()
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertFalse(hasattr(request, 'tenant'))

    def test_superuser_bypass_with_header(self):
        """Test: Superuser with valid header gets tenant context."""
        request = self._request('/core/v1/partner/tenant/', self.superuser, self.tenant.public_id)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_superuser_fallback_to_owned_tenant(self):
        """Test: Superuser without header falls back to owned tenant."""
        # Create a tenant owned by superuser
        superuser_tenant = CoreTenant.objects.create(
            owner_user=self.superuser,
            tenant_code='superuser-tenant',
            display_name='Superuser Tenant',
            plan=CoreTenant.PlanChoices.INTERNAL,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        request = self._request('/core/v1/partner/tenant/', self.superuser)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, superuser_tenant)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_member_role_admin(self):
        """Test: Member with ADMIN role gets correct role."""
        admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
        )
        TenantMember.objects.create(
            tenant=self.tenant,
            user=admin_user,
            role=TenantMember.RoleChoices.ADMIN,
            invited_by=self.owner,
        )
        
        request = self._request('/core/v1/partner/tenant/', admin_user)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.ADMIN)

    def test_member_role_viewer(self):
        """Test: Member with VIEWER role gets correct role."""
        viewer_user = User.objects.create_user(
            username='viewer',
            email='viewer@example.com',
            password='testpass123',
        )
        TenantMember.objects.create(
            tenant=self.tenant,
            user=viewer_user,
            role=TenantMember.RoleChoices.VIEWER,
            invited_by=self.owner,
        )
        
        request = self._request('/core/v1/partner/tenant/', viewer_user)
        response = self._middleware()(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.VIEWER)