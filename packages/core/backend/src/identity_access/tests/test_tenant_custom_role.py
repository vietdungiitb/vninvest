"""
Sprint 4 Phase A: TenantCustomRole + permission resolution tests.

Tests TenantCustomRole model, SYSTEM_ROLE_PERMISSIONS, get_tenant_permissions(),
require_tenant_permission(), and F2 wiring of request.tenant_member.
"""

from django.contrib.auth import get_user_model
from django.test import TestCase, RequestFactory
from rest_framework.exceptions import PermissionDenied

from identity_access.models import (
    CoreTenant, CoreServiceAccount, TenantMember, TenantCustomRole,
    TenantInvite,
)
from identity_access.tests.envelope import unwrapped
from identity_access.utils.resolve_tenant import (
    SYSTEM_ROLE_PERMISSIONS, KNOWN_PERMISSION_TOKENS,
    get_tenant_permissions, require_tenant_permission,
)

User = get_user_model()


class TenantCustomRoleModelTests(TestCase):
    """Test TenantCustomRole model creation and constraints."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='cr_owner', email='cr_owner@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='cr_tenant', tenant_code='cr_tenant',
            display_name='CR Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )

    def test_create_custom_role(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst',
            permissions=['usage:read', 'forecast:read'],
        )
        self.assertTrue(role.public_id)
        self.assertEqual(role.name, 'Analyst')
        self.assertEqual(role.permissions, ['usage:read', 'forecast:read'])
        self.assertFalse(role.is_system)

    def test_unique_together_tenant_name(self):
        TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst', permissions=[],
        )
        with self.assertRaises(Exception):
            TenantCustomRole.objects.create(
                tenant=self.tenant, name='Analyst', permissions=[],
            )

    def test_system_role_flag(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='SystemRole', permissions=['*'], is_system=True,
        )
        self.assertTrue(role.is_system)

    def test_member_custom_role_fk_set_null(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='TempRole', permissions=['usage:read'],
        )
        member = TenantMember.objects.create(
            tenant=self.tenant, user=self.owner,
            role=TenantMember.RoleChoices.VIEWER, custom_role=role,
        )
        self.assertEqual(member.custom_role, role)
        role.delete()
        member.refresh_from_db()
        self.assertIsNone(member.custom_role)

    def test_str_representation(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='Editor', permissions=[],
        )
        self.assertIn('Editor', str(role))
        self.assertIn('CR Tenant', str(role))


class SystemRolePermissionsTests(TestCase):
    """Test SYSTEM_ROLE_PERMISSIONS constant."""

    def test_owner_has_wildcard(self):
        self.assertEqual(SYSTEM_ROLE_PERMISSIONS['owner'], ['*'])

    def test_all_roles_defined(self):
        for role in ('owner', 'admin', 'editor', 'viewer'):
            self.assertIn(role, SYSTEM_ROLE_PERMISSIONS)

    def test_viewer_read_only(self):
        viewer_perms = SYSTEM_ROLE_PERMISSIONS['viewer']
        for perm in viewer_perms:
            self.assertTrue(perm.endswith(':read'), f'Viewer has write perm: {perm}')

    def test_admin_has_all_admin_perms(self):
        admin_perms = set(SYSTEM_ROLE_PERMISSIONS['admin'])
        self.assertIn('member:write', admin_perms)
        self.assertIn('settings:write', admin_perms)
        self.assertIn('tenant:write', admin_perms)

    def test_known_tokens_complete(self):
        all_perms = set()
        for perms in SYSTEM_ROLE_PERMISSIONS.values():
            if perms == ['*']:
                continue
            all_perms.update(perms)
        self.assertTrue(all_perms.issubset(KNOWN_PERMISSION_TOKENS))


class GetTenantPermissionsTests(TestCase):
    """Test get_tenant_permissions() resolution logic."""

    def setUp(self):
        self.factory = RequestFactory()
        self.owner = User.objects.create_user(
            username='perm_owner', email='perm_owner@test.com', password='testpass123',
        )
        self.editor = User.objects.create_user(
            username='perm_editor', email='perm_editor@test.com', password='testpass123',
        )
        self.viewer = User.objects.create_user(
            username='perm_viewer', email='perm_viewer@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='perm_tenant', tenant_code='perm_tenant',
            display_name='Perm Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        self.editor_member = TenantMember.objects.create(
            tenant=self.tenant, user=self.editor,
            role=TenantMember.RoleChoices.EDITOR,
        )
        self.viewer_member = TenantMember.objects.create(
            tenant=self.tenant, user=self.viewer,
            role=TenantMember.RoleChoices.VIEWER,
        )

    def test_owner_wildcard(self):
        request = self.factory.get('/')
        request.user = self.owner
        request.tenant = self.tenant
        request.tenant_role = 'owner'
        request.tenant_member = None
        perms = get_tenant_permissions(request)
        self.assertEqual(perms, {'*'})

    def test_editor_permissions(self):
        request = self.factory.get('/')
        request.user = self.editor
        request.tenant = self.tenant
        request.tenant_role = 'editor'
        request.tenant_member = self.editor_member
        perms = get_tenant_permissions(request)
        self.assertIn('usage:read', perms)
        self.assertIn('sa:write', perms)
        self.assertNotIn('settings:write', perms)
        self.assertNotIn('webhook:write', perms)

    def test_viewer_read_only(self):
        request = self.factory.get('/')
        request.user = self.viewer
        request.tenant = self.tenant
        request.tenant_role = 'viewer'
        request.tenant_member = self.viewer_member
        perms = get_tenant_permissions(request)
        self.assertIn('usage:read', perms)
        self.assertNotIn('sa:write', perms)
        self.assertNotIn('settings:write', perms)

    def test_custom_role_overrides_system_role(self):
        custom = TenantCustomRole.objects.create(
            tenant=self.tenant, name='CustomAnalyst',
            permissions=['usage:read', 'forecast:read', 'dashboard:read'],
        )
        self.editor_member.custom_role = custom
        self.editor_member.save(update_fields=['custom_role'])

        request = self.factory.get('/')
        request.user = self.editor
        request.tenant = self.tenant
        request.tenant_role = 'editor'
        request.tenant_member = self.editor_member
        perms = get_tenant_permissions(request)
        self.assertEqual(perms, {'usage:read', 'forecast:read', 'dashboard:read'})
        self.assertNotIn('sa:write', perms)  # editor had this but custom overrides

    def test_caching(self):
        request = self.factory.get('/')
        request.user = self.viewer
        request.tenant = self.tenant
        request.tenant_role = 'viewer'
        request.tenant_member = self.viewer_member

        perms1 = get_tenant_permissions(request)
        perms2 = get_tenant_permissions(request)
        self.assertEqual(perms1, perms2)
        self.assertTrue(hasattr(request, '_tenant_permissions'))


class RequireTenantPermissionTests(TestCase):
    """Test require_tenant_permission() guard."""

    def setUp(self):
        self.factory = RequestFactory()
        self.owner = User.objects.create_user(
            username='rtp_owner', email='rtp_owner@test.com', password='testpass123',
        )
        self.editor = User.objects.create_user(
            username='rtp_editor', email='rtp_editor@test.com', password='testpass123',
        )
        self.viewer = User.objects.create_user(
            username='rtp_viewer', email='rtp_viewer@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='rtp_tenant', tenant_code='rtp_tenant',
            display_name='RTP Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        self.editor_member = TenantMember.objects.create(
            tenant=self.tenant, user=self.editor,
            role=TenantMember.RoleChoices.EDITOR,
        )
        self.viewer_member = TenantMember.objects.create(
            tenant=self.tenant, user=self.viewer,
            role=TenantMember.RoleChoices.VIEWER,
        )

    def _make_request(self, user, tenant, role, member=None):
        request = self.factory.get('/')
        request.user = user
        request.tenant = tenant
        request.tenant_role = role
        request.tenant_member = member
        return request

    def test_owner_passes_all(self):
        request = self._make_request(self.owner, self.tenant, 'owner', None)
        # Should not raise
        require_tenant_permission(request, 'settings:write', 'tenant:write', 'member:write')

    def test_editor_passes_sa_write(self):
        request = self._make_request(self.editor, self.tenant, 'editor', self.editor_member)
        require_tenant_permission(request, 'sa:write')  # Should not raise

    def test_editor_fails_settings_write(self):
        request = self._make_request(self.editor, self.tenant, 'editor', self.editor_member)
        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'settings:write')

    def test_viewer_fails_sa_write(self):
        request = self._make_request(self.viewer, self.tenant, 'viewer', self.viewer_member)
        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'sa:write')

    def test_viewer_passes_usage_read(self):
        request = self._make_request(self.viewer, self.tenant, 'viewer', self.viewer_member)
        require_tenant_permission(request, 'usage:read')  # Should not raise

    def test_custom_role_grants_permission(self):
        custom = TenantCustomRole.objects.create(
            tenant=self.tenant, name='ForecastAnalyst',
            permissions=['forecast:read', 'forecast:write'],
        )
        self.viewer_member.custom_role = custom
        self.viewer_member.save(update_fields=['custom_role'])

        request = self._make_request(self.viewer, self.tenant, 'viewer', self.viewer_member)
        require_tenant_permission(request, 'forecast:write')  # Should not raise

    def test_custom_role_blocks_unlisted_permission(self):
        custom = TenantCustomRole.objects.create(
            tenant=self.tenant, name='ForecastAnalyst',
            permissions=['forecast:read'],
        )
        self.viewer_member.custom_role = custom
        self.viewer_member.save(update_fields=['custom_role'])

        request = self._make_request(self.viewer, self.tenant, 'viewer', self.viewer_member)
        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'forecast:write')

    def test_multiple_permissions_all_required(self):
        request = self._make_request(self.editor, self.tenant, 'editor', self.editor_member)
        # Editor has sa:write but not settings:write
        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'sa:write', 'settings:write')


class TenantMemberRoleMatrixIntegrationTests(TestCase):
    """Integration tests: custom roles work with the full role resolution chain."""

    def setUp(self):
        self.factory = RequestFactory()
        self.owner = User.objects.create_user(
            username='matrix_owner', email='matrix_owner@test.com', password='testpass123',
        )
        self.member_user = User.objects.create_user(
            username='matrix_member', email='matrix_member@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='matrix_tenant', tenant_code='matrix_tenant',
            display_name='Matrix Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        self.tenant_member = TenantMember.objects.create(
            tenant=self.tenant, user=self.member_user,
            role=TenantMember.RoleChoices.VIEWER,
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant, name='Matrix SA',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
        )

    def test_default_viewer_no_write(self):
        request = self.factory.get('/')
        request.user = self.member_user
        request.tenant = self.tenant
        request.tenant_role = 'viewer'
        request.tenant_member = self.tenant_member

        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'member:write')

    def test_custom_role_grants_write(self):
        custom = TenantCustomRole.objects.create(
            tenant=self.tenant, name='MemberAdmin',
            permissions=['member:read', 'member:write', 'usage:read'],
        )
        self.tenant_member.custom_role = custom
        self.tenant_member.save(update_fields=['custom_role'])

        request = self.factory.get('/')
        request.user = self.member_user
        request.tenant = self.tenant
        request.tenant_role = 'viewer'  # Original role stays viewer
        request.tenant_member = self.tenant_member

        # Custom role grants member:write even though system role is viewer
        require_tenant_permission(request, 'member:write')

        # Original role field unchanged
        self.tenant_member.refresh_from_db()
        self.assertEqual(self.tenant_member.role, 'viewer')

    def test_remove_custom_role_falls_back_to_system(self):
        custom = TenantCustomRole.objects.create(
            tenant=self.tenant, name='TempAdmin',
            permissions=['settings:write'],
        )
        self.tenant_member.custom_role = custom
        self.tenant_member.save(update_fields=['custom_role'])

        # Remove custom role
        self.tenant_member.custom_role = None
        self.tenant_member.save(update_fields=['custom_role'])

        request = self.factory.get('/')
        request.user = self.member_user
        request.tenant = self.tenant
        request.tenant_role = 'viewer'
        request.tenant_member = self.tenant_member

        # Falls back to viewer system perms — no settings:write
        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'settings:write')


class PartnerRoleCRUDAPITests(TestCase):
    """Test PartnerRoleListCreateView + PartnerRoleDetailView endpoints.

    Uses APIClient + force_authenticate (user) and X-Tenant-ID header so the
    real TenantResolutionMiddleware sets request.tenant / tenant_role. This
    exercises the full DRF permission_classes (IsAuthenticated, IsTenantActive)
    + require_pat_scopes_or_human_session + require_tenant_permission stack.
    """

    def setUp(self):
        self.owner = User.objects.create_user(
            username='crud_owner', email='crud_owner@test.com', password='testpass123',
        )
        self.admin = User.objects.create_user(
            username='crud_admin', email='crud_admin@test.com', password='testpass123',
        )
        self.viewer = User.objects.create_user(
            username='crud_viewer', email='crud_viewer@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='crud_tenant', tenant_code='crud_tenant',
            display_name='CRUD Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.admin, role=TenantMember.RoleChoices.ADMIN,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.viewer, role=TenantMember.RoleChoices.VIEWER,
        )

    def _client(self, user):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(user=user)
        # X-Tenant-ID header lets TenantResolutionMiddleware resolve tenant + role
        client.credentials(HTTP_X_TENANT_ID=str(self.tenant.public_id))
        return client

    def test_list_roles_empty(self):
        client = self._client(self.owner)
        response = client.get('/core/v1/partner/roles/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(unwrapped(response)['roles'], [])

    def test_create_custom_role(self):
        client = self._client(self.owner)
        data = {'name': 'Analyst', 'permissions': ['usage:read', 'forecast:read']}
        response = client.post('/core/v1/partner/roles/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(unwrapped(response)['name'], 'Analyst')
        self.assertEqual(unwrapped(response)['permissions'], ['usage:read', 'forecast:read'])
        self.assertFalse(unwrapped(response)['is_system'])

    def test_create_duplicate_name_rejected(self):
        TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst', permissions=['usage:read'],
        )
        client = self._client(self.owner)
        data = {'name': 'Analyst', 'permissions': ['usage:read']}
        response = client.post('/core/v1/partner/roles/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_create_invalid_token_rejected(self):
        client = self._client(self.owner)
        data = {'name': 'Bad', 'permissions': ['nonexistent:token']}
        response = client.post('/core/v1/partner/roles/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_admin_can_create(self):
        client = self._client(self.admin)
        data = {'name': 'AdminRole', 'permissions': ['member:read']}
        response = client.post('/core/v1/partner/roles/', data, format='json')
        self.assertEqual(response.status_code, 201)

    def test_viewer_cannot_create(self):
        client = self._client(self.viewer)
        data = {'name': 'ViewerRole', 'permissions': ['member:read']}
        response = client.post('/core/v1/partner/roles/', data, format='json')
        # viewer lacks settings:write → 403
        self.assertEqual(response.status_code, 403)

    def test_get_role_detail(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst', permissions=['usage:read'],
        )
        client = self._client(self.owner)
        response = client.get(f'/core/v1/partner/roles/{role.public_id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(unwrapped(response)['name'], 'Analyst')

    def test_update_role(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst', permissions=['usage:read'],
        )
        client = self._client(self.owner)
        data = {'permissions': ['usage:read', 'forecast:read']}
        response = client.patch(f'/core/v1/partner/roles/{role.public_id}/', data, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(unwrapped(response)['permissions'], ['usage:read', 'forecast:read'])

    def test_delete_role_reassigns_members(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst', permissions=['usage:read'],
        )
        member = TenantMember.objects.get(tenant=self.tenant, user=self.viewer)
        member.custom_role = role
        member.save(update_fields=['custom_role'])

        client = self._client(self.owner)
        response = client.delete(f'/core/v1/partner/roles/{role.public_id}/')
        self.assertEqual(response.status_code, 204)

        member.refresh_from_db()
        self.assertIsNone(member.custom_role)
        self.assertFalse(TenantCustomRole.objects.filter(public_id=role.public_id).exists())

    def test_system_role_not_editable(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='SystemRole', permissions=['*'], is_system=True,
        )
        client = self._client(self.owner)
        response = client.patch(f'/core/v1/partner/roles/{role.public_id}/', {'name': 'X'}, format='json')
        # System roles are immutable → 403 (denied in the view body)
        self.assertEqual(response.status_code, 403)

    def test_system_role_not_deletable(self):
        role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='SystemRole', permissions=['*'], is_system=True,
        )
        client = self._client(self.owner)
        response = client.delete(f'/core/v1/partner/roles/{role.public_id}/')
        self.assertEqual(response.status_code, 403)

    def test_get_nonexistent_role_404(self):
        client = self._client(self.owner)
        response = client.get('/core/v1/partner/roles/nonexistent/')
        self.assertEqual(response.status_code, 404)


class InviteCustomRoleTests(TestCase):
    """Test invite flow with custom_role_id: create → accept → propagation."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.owner = User.objects.create_user(
            username='inv_owner', email='inv_owner@test.com', password='testpass123',
        )
        self.invitee = User.objects.create_user(
            username='inv_invitee', email='inv_invitee@test.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            public_id='inv_tenant', tenant_code='inv_tenant',
            display_name='Invite Tenant', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE, plan=CoreTenant.PlanChoices.PRO,
        )
        TenantMember.objects.create(
            tenant=self.tenant, user=self.owner, role=TenantMember.RoleChoices.OWNER,
        )
        self.custom_role = TenantCustomRole.objects.create(
            tenant=self.tenant, name='Analyst',
            permissions=['usage:read', 'forecast:read'],
        )
        self.client_owner = APIClient()
        self.client_owner.force_authenticate(user=self.owner)
        self.client_owner.credentials(HTTP_X_TENANT_ID=str(self.tenant.public_id))

    def test_invite_with_custom_role(self):
        data = {
            'invited_email': 'inv_invitee@test.com',
            'role': 'viewer',
            'custom_role_id': self.custom_role.public_id,
        }
        response = self.client_owner.post('/core/v1/tenant-members/invites/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(unwrapped(response)['custom_role_id'], self.custom_role.public_id)
        self.assertEqual(unwrapped(response)['custom_role_name'], 'Analyst')

    def test_invite_with_invalid_custom_role_404(self):
        data = {
            'invited_email': 'inv_invitee@test.com',
            'role': 'viewer',
            'custom_role_id': 'nonexistent-id',
        }
        response = self.client_owner.post('/core/v1/tenant-members/invites/', data, format='json')
        self.assertEqual(response.status_code, 404)

    def test_invite_without_custom_role(self):
        data = {
            'invited_email': 'inv_invitee@test.com',
            'role': 'editor',
        }
        response = self.client_owner.post('/core/v1/tenant-members/invites/', data, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(unwrapped(response).get('custom_role_id'))

    def test_accept_invite_propagates_custom_role(self):
        from datetime import timedelta
        from django.utils import timezone as tz
        from rest_framework.test import APIClient
        # Create invite with custom role
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email=self.invitee.email,
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role='viewer',
            custom_role=self.custom_role,
            expires_at=tz.now() + timedelta(days=7),
        )

        # Accept via API
        client_invitee = APIClient()
        client_invitee.force_authenticate(user=self.invitee)
        client_invitee.credentials(HTTP_X_TENANT_ID=str(self.tenant.public_id))
        response = client_invitee.post(
            f'/core/v1/tenant-members/invites/{invite.token}/accept/',
        )
        self.assertEqual(response.status_code, 201)

        # Verify member got custom_role
        member = TenantMember.objects.get(tenant=self.tenant, user=self.invitee)
        self.assertEqual(member.custom_role_id, self.custom_role.id)
        self.assertEqual(member.custom_role.name, 'Analyst')

    def test_accept_invite_without_custom_role(self):
        from datetime import timedelta
        from django.utils import timezone as tz
        from rest_framework.test import APIClient
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email=self.invitee.email,
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role='editor',
            custom_role=None,
            expires_at=tz.now() + timedelta(days=7),
        )

        client_invitee = APIClient()
        client_invitee.force_authenticate(user=self.invitee)
        client_invitee.credentials(HTTP_X_TENANT_ID=str(self.tenant.public_id))
        response = client_invitee.post(
            f'/core/v1/tenant-members/invites/{invite.token}/accept/',
        )
        self.assertEqual(response.status_code, 201)

        member = TenantMember.objects.get(tenant=self.tenant, user=self.invitee)
        self.assertIsNone(member.custom_role)
        self.assertEqual(member.role, 'editor')
