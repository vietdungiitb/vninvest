"""
Integration and security tests for Machine PAT Tenant Binding.

Tests cover:
1. Full-stack: middleware + DRF auth + permission → response
2. Security: PAT scope isolation across tenants
3. Edge cases: superuser, exempt paths, rotating PATs
"""

import json
import uuid

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.test import RequestFactory, TestCase
from rest_framework.exceptions import PermissionDenied

from identity_access.middleware import TenantResolutionMiddleware
from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
)
from identity_access.permissions import (
    is_machine_pat_request,
    require_pat_scopes_or_human_session,
)

User = get_user_model()


def _parse_json_response(response):
    return json.loads(response.content.decode('utf-8'))


class MachinePATTenantBindingIntegrationTests(TestCase):
    """Full-stack integration tests for machine PAT tenant binding."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantResolutionMiddleware(get_response=lambda r: JsonResponse({'status': 'ok'}))

        # Tenant 1 (PAT belongs to this tenant)
        self.owner_user = User.objects.create_user(
            username='owner_user', email='owner@test.com', password='testpass123',
        )
        self.tenant1 = CoreTenant.objects.create(
            public_id='tenant1_uuid', tenant_code='tenant1',
            display_name='Tenant 1', owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        self.sa1 = CoreServiceAccount.objects.create(
            tenant=self.tenant1, name='SA1', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant', 'market:read'],
        )

        # Tenant 2 (user is member, PAT does NOT belong here)
        # Must use different owner_user because CoreTenant.owner_user is OneToOne
        self.tenant2_owner = User.objects.create_user(
            username='tenant2_owner', email='tenant2_owner@test.com', password='testpass123',
        )
        self.tenant2 = CoreTenant.objects.create(
            public_id='tenant2_uuid', tenant_code='tenant2',
            display_name='Tenant 2', owner_user=self.tenant2_owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.FREE,
        )
        TenantMember.objects.create(
            tenant=self.tenant2, user=self.owner_user, role=TenantMember.RoleChoices.VIEWER,
        )

    def _create_machine_pat(self, tenant, scopes=None):
        sa = CoreServiceAccount.objects.create(
            tenant=tenant, name=f'SA_{uuid.uuid4().hex[:8]}',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=scopes or ['manage_tenant'],
        )
        return CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=scopes or ['manage_tenant'],
            label='Machine PAT', audit_reason='test', is_human_session=False,
        )

    def _create_human_pat(self, tenant, scopes=None):
        sa = CoreServiceAccount.objects.create(
            tenant=tenant, name=f'SA_{uuid.uuid4().hex[:8]}',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=scopes or ['manage_tenant'],
        )
        return CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=scopes or ['manage_tenant'],
            label='login:test', audit_reason='core login', is_human_session=True,
        )

    def test_machine_pat_cannot_access_tenant2_via_header(self):
        """Machine PAT for T1 with X-Tenant-ID=T2 → 403 pat_tenant_mismatch."""
        pat, raw_token = self._create_machine_pat(self.tenant1)
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant2.public_id)
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
        request.user = self.owner_user

        response = self.middleware(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(_parse_json_response(response)['error'], 'pat_tenant_mismatch')

    def test_machine_pat_can_access_own_tenant(self):
        """Machine PAT for T1 with X-Tenant-ID=T1 → 200."""
        pat, raw_token = self._create_machine_pat(self.tenant1)
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant1.public_id)
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
        request.user = self.owner_user

        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant1)

    def test_human_session_pat_can_switch_tenants(self):
        """Human session PAT for T1 with X-Tenant-ID=T2 → 200 (đa tenant)."""
        pat, raw_token = self._create_human_pat(self.tenant1)
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant2.public_id)
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
        request.user = self.owner_user

        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant2)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.VIEWER)

    def test_machine_pat_without_header_resolves_to_own_tenant(self):
        """Machine PAT without X-Tenant-ID → fallback to credential's tenant → 200."""
        pat, raw_token = self._create_machine_pat(self.tenant1)
        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
        request.user = self.owner_user

        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant1)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)

    def test_rotating_pat_still_enforces_tenant_binding(self):
        """Machine PAT in ROTATING status with correct tenant → 200."""
        pat, raw_token = self._create_machine_pat(self.tenant1)
        pat.mark_rotating(grace_period_seconds=3600, reason='test rotation')

        request = self.factory.get('/api/core/v1/partner/tenant/')
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant1.public_id)
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
        request.user = self.owner_user

        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(request.tenant, self.tenant1)


class PATScopeTenantIsolationTests(TestCase):
    """Security tests: verify PAT scopes cannot be used across tenants."""

    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = TenantResolutionMiddleware(get_response=lambda r: JsonResponse({'status': 'ok'}))

        # Tenant A
        self.owner_a = User.objects.create_user(
            username='owner_a', email='owner_a@test.com', password='testpass123',
        )
        self.tenant_a = CoreTenant.objects.create(
            public_id='tenant_a_uuid', tenant_code='tenant_a',
            display_name='Tenant A', owner_user=self.owner_a,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        self.sa_a = CoreServiceAccount.objects.create(
            tenant=self.tenant_a, name='SA_A', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant', 'market:read', 'signals:read'],
        )
        self.pat_a, self.pat_a_token = CorePATCredential.issue_for_service_account(
            service_account=self.sa_a, scopes=['manage_tenant', 'market:read'],
            label='PAT A', audit_reason='test', is_human_session=False,
        )

        # Tenant B (owner_a is member)
        self.owner_b = User.objects.create_user(
            username='owner_b', email='owner_b@test.com', password='testpass123',
        )
        self.tenant_b = CoreTenant.objects.create(
            public_id='tenant_b_uuid', tenant_code='tenant_b',
            display_name='Tenant B', owner_user=self.owner_b,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.FREE,
        )
        TenantMember.objects.create(
            tenant=self.tenant_b, user=self.owner_a, role=TenantMember.RoleChoices.VIEWER,
        )

    def _run_middleware(self, request):
        """Run middleware to set request.tenant and request.tenant_role."""
        return self.middleware(request)

    def test_is_machine_pat_request(self):
        """is_machine_pat_request correctly identifies machine PATs."""
        request = self.factory.get('/')
        request.auth = self.pat_a
        self.assertTrue(is_machine_pat_request(request))

        human_pat, _ = CorePATCredential.issue_for_service_account(
            service_account=self.sa_a, scopes=['manage_tenant'],
            label='login:test', audit_reason='core login', is_human_session=True,
        )
        request.auth = human_pat
        self.assertFalse(is_machine_pat_request(request))

    def test_require_pat_scopes_passes_for_valid_scope(self):
        """require_pat_scopes_or_human_session passes when scope is granted."""
        request = self.factory.get('/')
        request.auth = self.pat_a
        request.user = self.owner_a
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {self.pat_a_token}'
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant_a.public_id)
        self._run_middleware(request)
        # Should not raise
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        require_pat_scopes_or_human_session(request, 'market:read')

    def test_require_pat_scopes_fails_for_missing_scope(self):
        """require_pat_scopes_or_human_session raises when scope is missing."""
        request = self.factory.get('/')
        request.auth = self.pat_a
        request.user = self.owner_a
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {self.pat_a_token}'
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant_a.public_id)
        self._run_middleware(request)
        with self.assertRaises(PermissionDenied):
            require_pat_scopes_or_human_session(request, 'ai:invoke')

    def test_require_pat_scopes_passes_for_human_session(self):
        """Human session PATs bypass scope checks."""
        human_pat, _ = CorePATCredential.issue_for_service_account(
            service_account=self.sa_a, scopes=[],
            label='login:test', audit_reason='core login', is_human_session=True,
        )
        request = self.factory.get('/')
        request.auth = human_pat
        request.user = self.owner_a
        # Should not raise even with no scopes
        require_pat_scopes_or_human_session(request, 'manage_tenant', 'ai:invoke')

    def test_assert_pat_tenant_match_raises_when_request_tenant_missing(self):
        """_assert_pat_tenant_match raises PermissionDenied khi request.tenant=None (fail-closed)."""
        from identity_access.permissions import _assert_pat_tenant_match
        request = self.factory.get('/')
        request.auth = self.pat_a
        request.user = self.owner_a
        # Don't run middleware - request.tenant should be None
        with self.assertRaises(PermissionDenied) as ctx:
            _assert_pat_tenant_match(request, self.pat_a)
        self.assertIn('tenant context', str(ctx.exception.detail).lower())

    def test_assert_pat_tenant_match_passes_when_tenant_matches(self):
        """_assert_pat_tenant_match passes khi request.tenant khớp credential tenant."""
        from identity_access.permissions import _assert_pat_tenant_match
        request = self.factory.get('/')
        request.auth = self.pat_a
        request.tenant = self.tenant_a
        _assert_pat_tenant_match(request, self.pat_a)

    def test_assert_pat_tenant_match_fails_when_tenant_mismatches(self):
        """_assert_pat_tenant_match raises khi request.tenant khác credential tenant."""
        from identity_access.permissions import _assert_pat_tenant_match
        request = self.factory.get('/')
        request.auth = self.pat_a
        request.tenant = self.tenant_b
        with self.assertRaises(PermissionDenied) as ctx:
            _assert_pat_tenant_match(request, self.pat_a)
        self.assertIn('không được phép', str(ctx.exception.detail).lower())

    def test_drf_auth_reuses_middleware_credential_avoids_double_query(self):
        """DRF auth reuses request._pat_credential nếu prefix match — không gọi DB lần 2."""
        from unittest.mock import patch

        from identity_access.authentication import CorePATAuthentication

        pat, raw_token = CorePATCredential.issue_for_service_account(
            service_account=self.sa_a, scopes=['manage_tenant'],
            label='Cache Test', audit_reason='test', is_human_session=False,
        )
        request = self.factory.get('/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'
        request._pat_credential = pat

        auth_backend = CorePATAuthentication()
        with patch.object(CorePATCredential, 'resolve_from_raw_secret') as mock_resolve:
            user, cred = auth_backend.authenticate(request)
            mock_resolve.assert_not_called()
        self.assertEqual(cred, pat)

    def test_drf_auth_falls_back_to_db_when_credential_not_cached(self):
        """DRF auth gọi DB khi request._pat_credential chưa được set."""
        from identity_access.authentication import CorePATAuthentication

        pat, raw_token = CorePATCredential.issue_for_service_account(
            service_account=self.sa_a, scopes=['manage_tenant'],
            label='Fallback Test', audit_reason='test', is_human_session=False,
        )
        request = self.factory.get('/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw_token}'

        auth_backend = CorePATAuthentication()
        user, cred = auth_backend.authenticate(request)
        self.assertEqual(cred.pk, pat.pk)

    def _assert_middleware_blocks_cross_tenant(self, path, method='get'):
        """Assert middleware trả 403 pat_tenant_mismatch khi PAT T_A cố truy cập T_B."""
        mw = TenantResolutionMiddleware(get_response=lambda r: JsonResponse({'status': 'ok'}))
        factory_method = getattr(self.factory, method)
        request = factory_method(path)
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant_b.public_id)
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {self.pat_a_token}'
        request.user = self.owner_a
        response = mw(request)
        self.assertEqual(response.status_code, 403,
            msg=f'Expected 403 for {method.upper()} {path} with cross-tenant PAT')
        self.assertEqual(_parse_json_response(response)['error'], 'pat_tenant_mismatch')

    def test_machine_pat_t1_cannot_access_webhooks_in_t2(self):
        """PAT T_A với manage_tenant scope không được list webhooks của T_B."""
        self._assert_middleware_blocks_cross_tenant('/api/core/v1/partner/webhooks/')

    def test_machine_pat_t1_cannot_list_members_in_t2(self):
        """PAT T_A với manage_tenant scope không được list members của T_B."""
        self._assert_middleware_blocks_cross_tenant('/api/core/v1/tenant-members/')

    def test_machine_pat_t1_cannot_invite_user_into_t2(self):
        """PAT T_A với manage_tenant scope không được invite user vào T_B."""
        self._assert_middleware_blocks_cross_tenant('/api/core/v1/tenant-members/invites/', method='post')

    def test_machine_pat_t1_cannot_issue_pat_for_t2(self):
        """PAT T_A không được issue PAT mới trong context T_B."""
        self._assert_middleware_blocks_cross_tenant('/api/core/v1/partner/pats/', method='post')
