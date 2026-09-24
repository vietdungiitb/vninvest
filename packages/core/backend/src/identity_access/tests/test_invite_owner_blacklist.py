"""H0.3 tests: cấm invite role=owner (chống leo đặc quyền).

Chạy: python manage.py test identity_access.tests.test_invite_owner_blacklist
"""
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantInvite

BASE = '/core/v1/tenant-members/invites/'


class InviteOwnerBlacklistTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='inv_owner', email='owner@test.com', password='x')
        self.tenant = CoreTenant.objects.create(
            tenant_code='inv_t', display_name='Inv T',
            owner_user=self.owner, status=CoreTenant.StatusChoices.ACTIVE)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_invite_owner_rejected(self):
        resp = self.client.post(
            BASE, {'invited_email': 'new@test.com', 'role': 'owner'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_invite_editor_allowed(self):
        resp = self.client.post(
            BASE, {'invited_email': 'new@test.com', 'role': 'editor'}, format='json')
        self.assertEqual(resp.status_code, 201)

    def test_accept_legacy_owner_invite_rejected(self):
        # Invite owner tạo trước blacklist vẫn không accept được.
        invitee = User.objects.create_user(
            username='inv_legacy', email='legacy@test.com', password='x')
        invite = TenantInvite.objects.create(
            tenant=self.tenant, invited_email='legacy@test.com',
            inviter=self.owner, token=TenantInvite.generate_token(),
            role='owner', expires_at=timezone.now() + timedelta(days=7))
        client = APIClient()
        client.force_authenticate(user=invitee)
        resp = client.post(f'/core/v1/tenant-members/invites/{invite.token}/accept/')
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(
            invite.tenant.members.filter(user=invitee).exists())
