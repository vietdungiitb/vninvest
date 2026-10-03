"""
Sprint 1 Phase B + Sprint 4 Prereq: Editor/Viewer role enforcement tests.

VERIFIED BY EVIDENCE (2026-07-18):
The auth model now carries the real member role. `CorePATCredential.issued_for_member`
(FK, nullable) links a human-session PAT to the issuing TenantMember. The login,
refresh, and SSO flows all pass `issued_for_member` into `issue_for_service_account`,
and `_get_user_from_pat` / `authentication.authenticate` resolve
`user = member.user` + `request.tenant_role = member.role`. Machine PATs and
owner-equivalent PATs (issued_for_member=None) still collapse to the tenant owner.

=> Role-based differentiation (editor/viewer) IS NOW ENFORCED: a viewer's PAT is
   rejected (403) from owner-only writes. These tests assert that enforcement.

Frontend uses PAT Bearer tokens (`coreApiAdapter.js:172`), so production traffic
hits the same role-aware resolution.
"""

import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase

from identity_access.models import CoreTenant, CoreServiceAccount, CorePATCredential, TenantMember

User = get_user_model()


def _parse_json_response(response):
    return json.loads(response.content.decode('utf-8'))


class TenantRoleDeclarationTests(TestCase):
    """Guards are declared per Role Matrix; auth-model limitation is recorded."""

    def setUp(self):
        self.owner_user = User.objects.create_user(
            username='rbac_owner', email='rbac_owner@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='rbac_tenant', tenant_code='rbac_tenant',
            display_name='RBAC Tenant', owner_user=self.owner_user,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.owner_user, role=TenantMember.RoleChoices.OWNER,
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='RBAC_SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE, scopes=['manage_tenant'],
        )
        self.editor_user = User.objects.create_user(
            username='rbac_editor', email='rbac_editor@test.com', password='testpass123',
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.editor_user, role=TenantMember.RoleChoices.EDITOR,
        )
        self.viewer_user = User.objects.create_user(
            username='rbac_viewer', email='rbac_viewer@test.com', password='testpass123',
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.viewer_user, role=TenantMember.RoleChoices.VIEWER,
        )

    def _human_pat(self, user):
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name=f'SA_{uuid.uuid4().hex[:8]}',
            status=CoreServiceAccount.StatusChoices.ACTIVE, scopes=['manage_tenant', 'market:read'],
        )
        member = TenantMember.objects.filter(tenant=self.tenant, user=user).first()
        pat, raw = CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=['manage_tenant', 'market:read'],
            label='login:test', audit_reason='core login', is_human_session=True,
            issued_for_member=member,
        )
        return raw

    def _headers(self, raw_token):
        return {
            'HTTP_AUTHORIZATION': f'Bearer {raw_token}',
            'HTTP_X_TENANT_ID': self.tenant.public_id,
        }

    # --- Auth-model fix: viewer PAT is rejected from owner-only writes (Sprint 4 prereq) ---
    def test_viewer_pat_rejected_from_owner_write(self):
        """After the auth-model fix the viewer PAT carries the real member role,
        so owner-only endpoints reject it with 403 (was 200 before the fix)."""
        raw = self._human_pat(self.viewer_user)
        resp = self.client.put(
            '/core/v1/partner/settings/',
            data=json.dumps({'theme': 'light'}),
            content_type='application/json',
            **self._headers(raw),
        )
        self.assertEqual(resp.status_code, 403)

    # --- Editor (write role) can still issue PATs ---
    def test_editor_pat_can_issue_pat(self):
        raw = self._human_pat(self.editor_user)
        resp = self.client.post(
            '/core/v1/partner/pats/issue/',
            data=json.dumps({'service_account_id': self.sa.public_id, 'label': 't'}),
            content_type='application/json',
            **self._headers(raw),
        )
        self.assertIn(resp.status_code, (200, 201))

    # --- Owner can invite members ---
    def test_owner_pat_can_invite_member(self):
        raw = self._human_pat(self.owner_user)
        resp = self.client.post(
            '/core/v1/tenant-members/invites/',
            data=json.dumps({'email': 'new@example.com', 'role': 'viewer'}),
            content_type='application/json',
            **self._headers(raw),
        )
        self.assertIn(resp.status_code, (201, 400))

    # --- Unit: issued_for_member resolves the real role on the request ---
    def test_pat_issued_for_member_resolves_role(self):
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='SA_role', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant'],
        )
        editor_member = TenantMember.objects.get(tenant=self.tenant, user=self.editor_user)
        raw = self._human_pat(self.editor_user)
        # Decode via middleware path: simulate a request resolved by the PAT.
        from identity_access.middleware import TenantResolutionMiddleware
        from django.test import RequestFactory
        rf = RequestFactory()
        req = rf.post('/core/v1/partner/pats/issue/')
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {raw}'
        req.META['HTTP_X_TENANT_ID'] = self.tenant.public_id
        req.session = {}
        mw = TenantResolutionMiddleware(lambda r: None)
        mw(req)
        self.assertEqual(req.tenant_role, TenantMember.RoleChoices.EDITOR)

    # --- Machine PAT (no member) still collapses to owner ---
    def test_machine_pat_still_owner(self):
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='SA_machine', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['manage_tenant'],
        )
        pat, raw = CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=['manage_tenant'], label='ci', audit_reason='ci',
            is_human_session=False, issued_for_member=None,
        )
        from identity_access.middleware import TenantResolutionMiddleware
        from django.test import RequestFactory
        rf = RequestFactory()
        req = rf.post('/x')
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {raw}'
        req.META['HTTP_X_TENANT_ID'] = self.tenant.public_id
        req.session = {}
        mw = TenantResolutionMiddleware(lambda r: None)
        mw(req)
        self.assertEqual(req.tenant_role, TenantMember.RoleChoices.OWNER)

    # --- P0 Bug 1: refresh must preserve issued_for_member (no role escalation) ---
    def test_refresh_preserves_member_role(self):
        """A viewer's login PAT carries issued_for_member; after refresh the new
        PAT must STILL carry it, otherwise the viewer silently becomes owner."""
        raw = self._human_pat(self.viewer_user)
        resp = self.client.post(
            '/core/v1/auth/token/refresh/',
            data=json.dumps({'refresh': raw}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        body = _parse_json_response(resp)
        data = body.get('data', body)
        new_raw = data.get('access') or data.get('token') or data.get('refresh')
        self.assertIsNotNone(new_raw)
        # Decode the refreshed PAT and assert it still binds the viewer member.
        from identity_access.models import CorePATCredential
        refreshed = CorePATCredential.resolve_from_raw_secret(new_raw)
        self.assertIsNotNone(refreshed)
        self.assertIsNotNone(refreshed.issued_for_member)
        self.assertEqual(refreshed.issued_for_member.user_id, self.viewer_user.id)
        # And the refreshed PAT must be rejected from owner-only writes (still viewer).
        resp2 = self.client.put(
            '/core/v1/partner/settings/',
            data=json.dumps({'theme': 'light'}),
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {new_raw}',
            HTTP_X_TENANT_ID=self.tenant.public_id,
        )
        self.assertEqual(resp2.status_code, 403)

    # --- P0 Bug 2 guard: SSO-style issue keeps issued_for_member + human flag ---
    def test_sso_style_issue_keeps_member_role(self):
        """Mirrors views/sso.py issue path: human-session PAT for a member must
        carry issued_for_member (not collapse to owner)."""
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='SA_sso', status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=['market:read', 'signals:read', 'ai:invoke'],
        )
        member = TenantMember.objects.get(tenant=self.tenant, user=self.viewer_user)
        pat, raw = CorePATCredential.issue_for_service_account(
            service_account=sa, scopes=sa.scopes, label='login:v',
            audit_reason='core login', allowed_cidr_blocks=[],
            is_human_session=True, issued_for_member=member,
        )
        self.assertTrue(pat.is_human_session)
        self.assertEqual(pat.issued_for_member_id, member.id)
        from identity_access.middleware import TenantResolutionMiddleware
        from django.test import RequestFactory
        rf = RequestFactory()
        req = rf.post('/x')
        req.META['HTTP_AUTHORIZATION'] = f'Bearer {raw}'
        req.META['HTTP_X_TENANT_ID'] = self.tenant.public_id
        req.session = {}
        TenantResolutionMiddleware(lambda r: None)(req)
        self.assertEqual(req.tenant_role, TenantMember.RoleChoices.VIEWER)
