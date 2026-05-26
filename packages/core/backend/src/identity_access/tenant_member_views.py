"""
Tenant member and invite management views for T09.

Endpoints:
    GET    /api/core/v1/tenant-members/          — list members (owner/admin only)
    POST   /api/core/v1/tenant-members/invites/  — create invite (owner/admin only)
    GET    /api/core/v1/tenant-members/invites/  — list pending invites (owner/admin only)
    POST   /api/core/v1/tenant-members/invites/{token}/accept/  — accept invite
    DELETE /api/core/v1/tenant-members/{member_id}/  — remove member (owner/admin only)
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant_lifecycle.models import TenantLifecycleEvent
from .models import CoreTenant, TenantMember, TenantInvite
from .serializers import TenantMemberSerializer, TenantInviteSerializer, TenantInviteCreateSerializer
from .permissions import IsTenantActive, require_human_session, require_pat_scopes_or_human_session


class IsTenantOwnerOrAdmin(permissions.BasePermission):
    """Permission: user must be tenant owner or admin."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, CoreTenant):
            tenant = obj
        elif hasattr(obj, 'tenant'):
            tenant = obj.tenant
        else:
            return False

        # Owner is always allowed
        if tenant.owner_user == request.user:
            return True

        # Superuser bypass
        if request.user.is_superuser:
            return True

        # Check membership: must be OWNER or ADMIN
        member = TenantMember.objects.filter(
            tenant=tenant,
            user=request.user,
        ).first()
        if member is None:
            return False
        return member.role in [TenantMember.RoleChoices.OWNER, TenantMember.RoleChoices.ADMIN]


class TenantMemberListView(APIView):
    """List members of current tenant."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        user = request.user
        # Find user's primary tenant
        tenant = CoreTenant.objects.filter(owner_user=user).first()
        if not tenant:
            return Response(
                {'error': 'User has no tenant'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # List members
        members = TenantMember.objects.filter(tenant=tenant).select_related('user', 'invited_by')
        serializer = TenantMemberSerializer(members, many=True)
        return Response({'members': serializer.data})


class TenantInvitesCombinedView(APIView):
    """
    Combined view for tenant invites:
    - POST: Create new invite (owner/admin only)
    - GET: List pending invites (owner/admin only)
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def _get_tenant_for_user(self, user):
        """Get the user's primary tenant (owner-owned) or first accessible tenant."""
        # Try to find tenant owned by user
        tenant = CoreTenant.objects.filter(owner_user=user).first()
        if tenant:
            return tenant
        # If not found, try to find any tenant where user is a member
        member = TenantMember.objects.filter(user=user).select_related('tenant').first()
        if member:
            return member.tenant
        return None

    def post(self, request):
        """Create invite for new member."""
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        user = request.user
        tenant = self._get_tenant_for_user(user)
        if not tenant:
            return Response(
                {'error': 'User has no tenant'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check permission (owner/admin)
        perm = IsTenantOwnerOrAdmin()
        if not perm.has_object_permission(request, None, tenant):
            return Response(
                {'error': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validate input
        serializer = TenantInviteCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        invited_email = serializer.validated_data['invited_email'].lower().strip()
        role = serializer.validated_data['role']

        # Check if user already member
        existing_member = TenantMember.objects.filter(
            tenant=tenant,
            user__email__iexact=invited_email,
        ).first()
        if existing_member:
            return Response(
                {'error': 'User is already a member'},
                status=status.HTTP_409_CONFLICT,
            )

        # Check for pending invite
        pending_invite = TenantInvite.objects.filter(
            tenant=tenant,
            invited_email__iexact=invited_email,
            status=TenantInvite.StatusChoices.PENDING,
        ).first()
        if pending_invite:
            return Response(
                {'error': 'Invite already pending for this email'},
                status=status.HTTP_409_CONFLICT,
            )

        # Create invite
        token = TenantInvite.generate_token()
        invite = TenantInvite.objects.create(
            tenant=tenant,
            invited_email=invited_email,
            inviter=user,
            token=token,
            role=role,
            expires_at=timezone.now() + timedelta(days=7),
        )

        # Log lifecycle event
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=user,
            new_value={'invited_email': invited_email, 'role': role},
        )

        result = TenantInviteSerializer(invite)
        return Response(result.data, status=status.HTTP_201_CREATED)

    def get(self, request):
        """List pending invites for tenant."""
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        user = request.user
        tenant = self._get_tenant_for_user(user)
        if not tenant:
            return Response(
                {'error': 'User has no tenant'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check permission (owner/admin)
        perm = IsTenantOwnerOrAdmin()
        if not perm.has_object_permission(request, None, tenant):
            return Response(
                {'error': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # List pending invites
        invites = TenantInvite.objects.filter(
            tenant=tenant,
            status=TenantInvite.StatusChoices.PENDING,
        ).select_related('inviter')
        serializer = TenantInviteSerializer(invites, many=True)
        return Response({'invites': serializer.data})


class TenantInviteAcceptView(APIView):
    """Accept invitation via token."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def post(self, request, token):
        require_human_session(request)
        user = request.user

        # Find invite
        invite = TenantInvite.objects.filter(token=token).first()
        if not invite:
            return Response(
                {'error': 'Invalid or expired token'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check status
        if invite.status != TenantInvite.StatusChoices.PENDING:
            if invite.status == TenantInvite.StatusChoices.ACCEPTED:
                return Response(
                    {'error': 'Invite already accepted'},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {'error': 'Invite is not pending'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check expiry
        if invite.is_expired:
            invite.status = TenantInvite.StatusChoices.EXPIRED
            invite.save()
            return Response(
                {'error': 'Invite has expired'},
                status=status.HTTP_410_GONE,
            )

        # Check email match
        if user.email.lower().strip() != invite.invited_email.lower().strip():
            return Response(
                {'error': 'Email does not match invited email'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Accept invite: create member
        member, created = TenantMember.objects.get_or_create(
            tenant=invite.tenant,
            user=user,
            defaults={
                'role': invite.role,
                'invited_by': invite.inviter,
            },
        )

        if not created:
            return Response(
                {'error': 'User is already a member'},
                status=status.HTTP_409_CONFLICT,
            )

        # Update invite
        invite.status = TenantInvite.StatusChoices.ACCEPTED
        invite.invited_user = user
        invite.accepted_at = timezone.now()
        invite.save()

        # Log lifecycle events
        TenantLifecycleEvent.objects.create(
            tenant=invite.tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_JOINED,
            actor_type='api',
            actor_user=user,
            new_value={'user_id': user.id, 'role': invite.role},
        )

        result = TenantMemberSerializer(member)
        return Response(result.data, status=status.HTTP_201_CREATED)


class TenantMemberRemoveView(APIView):
    """Remove member from tenant."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive, IsTenantOwnerOrAdmin]

    def delete(self, request, member_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        user = request.user

        # Find member
        member = TenantMember.objects.filter(public_id=member_id).first()
        if not member:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check permission
        self.check_object_permissions(request, member)

        # Cannot remove owner
        if member.tenant.owner_user == member.user:
            return Response(
                {'error': 'Cannot remove tenant owner'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot remove self
        if member.user == user:
            return Response(
                {'error': 'Cannot remove yourself'},
                status=status.HTTP_403_FORBIDDEN,
            )

        tenant = member.tenant
        removed_user = member.user

        # Delete member
        member.delete()

        # Log lifecycle event
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_REMOVED,
            actor_type='api',
            actor_user=user,
            new_value={'removed_user_id': removed_user.id, 'email': removed_user.email},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
