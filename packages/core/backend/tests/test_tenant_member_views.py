"""
Tests for tenant member and invite views — T09.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from tenant_lifecycle.models import TenantLifecycleEvent
from identity_access.models import CoreTenant, TenantMember, TenantInvite

User = get_user_model()


class TenantMemberInviteTest(TestCase):
    """T09: TenantMember + TenantInvite tests."""

    def setUp(self):
        """Create owner, tenant, and API client."""
        self.client = APIClient()
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='password',
            is_active=True,
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            display_name='Test Tenant',
            tenant_code='test-001',
            plan=CoreTenant.PlanChoices.FREE,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        # Create another user to invite
        self.invitee = User.objects.create_user(
            username='invitee',
            email='invitee@example.com',
            password='password',
            is_active=True,
        )

    def test_invite_member_creates_tenantinvite_with_token(self):
        """Test: Owner POST invite → TenantInvite created with 64-char token."""
        self.client.force_authenticate(user=self.owner)
        payload = {
            'invited_email': 'newmember@example.com',
            'role': 'editor',
        }
        
        response = self.client.post('/core/v1/tenant-members/invites/', payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertEqual(len(response.data['token']), 64)
        self.assertEqual(response.data['invited_email'], 'newmember@example.com')
        self.assertEqual(response.data['role'], 'editor')
        
        # Verify TenantInvite created
        invite = TenantInvite.objects.filter(invited_email='newmember@example.com').first()
        self.assertIsNotNone(invite)
        self.assertEqual(invite.status, TenantInvite.StatusChoices.PENDING)

    def test_accept_invite_with_valid_token(self):
        """Test: Accept invite with valid token → TenantMember created, status=accepted."""
        # Create invite
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email=self.invitee.email,
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            expires_at=timezone.now() + timedelta(days=7),
        )
        
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(
            f'/core/v1/tenant-members/invites/{invite.token}/accept/',
            {},
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['role'], 'editor')
        
        # Verify TenantMember created
        member = TenantMember.objects.filter(tenant=self.tenant, user=self.invitee).first()
        self.assertIsNotNone(member)
        self.assertEqual(member.role, TenantMember.RoleChoices.EDITOR)
        
        # Verify invite updated
        invite.refresh_from_db()
        self.assertEqual(invite.status, TenantInvite.StatusChoices.ACCEPTED)
        self.assertEqual(invite.invited_user, self.invitee)

    def test_accept_invite_already_accepted_409(self):
        """Test: Accept invite already accepted → 409."""
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email=self.invitee.email,
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            status=TenantInvite.StatusChoices.ACCEPTED,
            invited_user=self.invitee,
            expires_at=timezone.now() + timedelta(days=7),
        )
        
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(
            f'/core/v1/tenant-members/invites/{invite.token}/accept/',
            {},
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_accept_invite_expired_410(self):
        """Test: Accept expired invite → 410 Gone."""
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email=self.invitee.email,
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            expires_at=timezone.now() - timedelta(days=1),
        )
        
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(
            f'/core/v1/tenant-members/invites/{invite.token}/accept/',
            {},
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_410_GONE)

    def test_invite_member_non_owner_403(self):
        """Test: Non-owner/non-admin POST invite → 403."""
        # Create a non-owner user with EDITOR role
        non_owner = User.objects.create_user(
            username='non_owner',
            email='non_owner@example.com',
            password='password',
        )
        # Add non_owner to tenant with EDITOR role
        TenantMember.objects.create(
            tenant=self.tenant,
            user=non_owner,
            role=TenantMember.RoleChoices.EDITOR,
            invited_by=self.owner,
        )
        
        self.client.force_authenticate(user=non_owner)
        payload = {
            'invited_email': 'newmember@example.com',
            'role': 'editor',
        }
        
        response = self.client.post('/core/v1/tenant-members/invites/', payload, format='json')
        
        # Non-admin cannot invite, should get 403
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_remove_member_deletes_and_logs_event(self):
        """Test: DELETE member → TenantMember removed, TenantLifecycleEvent(MEMBER_REMOVED) logged."""
        member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.invitee,
            role=TenantMember.RoleChoices.EDITOR,
            invited_by=self.owner,
        )
        
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(
            f'/core/v1/tenant-members/{member.public_id}/',
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        
        # Verify member deleted
        remaining = TenantMember.objects.filter(public_id=member.public_id).first()
        self.assertIsNone(remaining)
        
        # Verify lifecycle event logged
        event = TenantLifecycleEvent.objects.filter(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_REMOVED,
        ).first()
        self.assertIsNotNone(event)

    def test_remove_member_cannot_remove_owner(self):
        """Test: Cannot remove tenant owner."""
        self.client.force_authenticate(user=self.owner)
        
        # Try to "remove" owner (they are implicitly the owner, not a TenantMember row)
        # This tests that even if we create a TenantMember row for owner, we can't delete it
        owner_member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.owner,
            role=TenantMember.RoleChoices.OWNER,
        )
        
        response = self.client.delete(
            f'/core/v1/tenant-members/{owner_member.public_id}/',
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_remove_member_cannot_remove_self(self):
        """Test: Cannot remove self from tenant."""
        member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.owner,
            role=TenantMember.RoleChoices.ADMIN,
        )
        
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(
            f'/core/v1/tenant-members/{member.public_id}/',
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unique_tenant_user_constraint(self):
        """Test: unique_together(tenant, user) prevents duplicate members."""
        # Create member
        TenantMember.objects.create(
            tenant=self.tenant,
            user=self.invitee,
            role=TenantMember.RoleChoices.VIEWER,
        )
        
        # Try to create duplicate
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            TenantMember.objects.create(
                tenant=self.tenant,
                user=self.invitee,
                role=TenantMember.RoleChoices.EDITOR,
            )

    def test_invite_duplicate_email_409(self):
        """Test: Duplicate invite email for same tenant → 409."""
        self.client.force_authenticate(user=self.owner)
        payload = {'invited_email': 'newmember@example.com', 'role': 'editor'}
        
        # First invite
        response1 = self.client.post('/core/v1/tenant-members/invites/', payload, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Second invite (duplicate)
        response2 = self.client.post('/core/v1/tenant-members/invites/', payload, format='json')
        self.assertEqual(response2.status_code, status.HTTP_409_CONFLICT)

    def test_list_members(self):
        """Test: List members of tenant."""
        member = TenantMember.objects.create(
            tenant=self.tenant,
            user=self.invitee,
            role=TenantMember.RoleChoices.EDITOR,
        )
        
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/core/v1/tenant-members/', format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('members', response.data)
        self.assertEqual(len(response.data['members']), 1)
        self.assertEqual(response.data['members'][0]['username'], self.invitee.username)

    def test_list_invites(self):
        """Test: List pending invites for tenant."""
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email='newmember@example.com',
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            expires_at=timezone.now() + timedelta(days=7),
        )
        
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/core/v1/tenant-members/invites/', format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('invites', response.data)
        self.assertEqual(len(response.data['invites']), 1)
        self.assertEqual(response.data['invites'][0]['invited_email'], 'newmember@example.com')

    def test_invite_creates_lifecycle_event(self):
        """Test: Invite creation logs TenantLifecycleEvent(MEMBER_INVITED)."""
        self.client.force_authenticate(user=self.owner)
        payload = {'invited_email': 'newmember@example.com', 'role': 'editor'}
        
        response = self.client.post('/core/v1/tenant-members/invites/', payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        event = TenantLifecycleEvent.objects.filter(
            tenant=self.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
        ).first()
        self.assertIsNotNone(event)

    def test_accept_invite_email_mismatch_403(self):
        """Test: Accept invite with mismatched email → 403."""
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email='newmember@example.com',
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            expires_at=timezone.now() + timedelta(days=7),
        )
        
        # Try to accept with different email
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(
            f'/core/v1/tenant-members/invites/{invite.token}/accept/',
            {},
            format='json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cancel_invite_success(self):
        """Test: Owner cancel pending invite → invite deleted."""
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email='newmember@example.com',
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/core/v1/tenant-members/invites/{invite.public_id}/cancel/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TenantInvite.objects.filter(public_id=invite.public_id).exists())

    def test_cancel_invite_not_found(self):
        """Test: Cancel non-existent invite → 404."""
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            '/core/v1/tenant-members/invites/non-existent-id/cancel/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cancel_invite_already_accepted_400(self):
        """Test: Cancel already accepted invite → 400 Bad Request."""
        invite = TenantInvite.objects.create(
            tenant=self.tenant,
            invited_email='newmember@example.com',
            inviter=self.owner,
            token=TenantInvite.generate_token(),
            role=TenantMember.RoleChoices.EDITOR,
            status=TenantInvite.StatusChoices.ACCEPTED,
            expires_at=timezone.now() + timedelta(days=7),
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/core/v1/tenant-members/invites/{invite.public_id}/cancel/',
            {},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
