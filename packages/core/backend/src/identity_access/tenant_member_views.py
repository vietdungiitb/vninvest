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
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from tenant_lifecycle.models import TenantLifecycleEvent
from .models import CoreTenant, TenantMember, TenantInvite
from .serializers import TenantMemberSerializer, TenantInviteSerializer, TenantInviteCreateSerializer
from .permissions import IsTenantActive, require_human_session, require_pat_scopes_or_human_session


def _get_request_tenant(request) -> CoreTenant:
    """Get tenant from request (set by TenantResolutionMiddleware)."""
    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Không tìm thấy tenant trong request. Middleware chưa chạy hoặc tenant không hợp lệ.')
    return tenant


def _get_request_tenant_role(request) -> str:
    """Get tenant role from request (set by TenantResolutionMiddleware)."""
    role = getattr(request, 'tenant_role', None)
    if role is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Không tìm thấy vai trò tenant trong request.')
    return role


def _require_tenant_role(request, *allowed_roles: str) -> None:
    """Check if request.tenant_role is in allowed_roles."""
    role = _get_request_tenant_role(request)
    if role not in allowed_roles:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied(f'Vai trò {role} không có quyền thực hiện hành động này.')


class TenantMemberListView(APIView):
    """List members of current tenant."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_role(request, 'owner', 'admin')
        tenant = _get_request_tenant(request)

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

    def post(self, request):
        """Create invite for new member."""
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_role(request, 'owner', 'admin')
        tenant = _get_request_tenant(request)

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
            inviter=request.user,
            token=token,
            role=role,
            expires_at=timezone.now() + timedelta(days=7),
        )

        # Log lifecycle event
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_INVITED,
            actor_type='api',
            actor_user=request.user,
            new_value={'invited_email': invited_email, 'role': role},
        )

        result = TenantInviteSerializer(invite)
        return Response(result.data, status=status.HTTP_201_CREATED)

    def get(self, request):
        """List pending invites for tenant."""
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_role(request, 'owner', 'admin')
        tenant = _get_request_tenant(request)

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
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def delete(self, request, member_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_role(request, 'owner', 'admin')
        tenant = _get_request_tenant(request)

        # Find member
        member = TenantMember.objects.filter(public_id=member_id, tenant=tenant).first()
        if not member:
            return Response(
                {'error': 'Member not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Cannot remove owner
        if tenant.owner_user == member.user:
            return Response(
                {'error': 'Cannot remove tenant owner'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Cannot remove self
        if member.user == request.user:
            return Response(
                {'error': 'Cannot remove yourself'},
                status=status.HTTP_403_FORBIDDEN,
            )

        removed_user = member.user

        # Delete member
        member.delete()

        # Log lifecycle event
        TenantLifecycleEvent.objects.create(
            tenant=tenant,
            event_type=TenantLifecycleEvent.EventType.MEMBER_REMOVED,
            actor_type='api',
            actor_user=request.user,
            new_value={'removed_user_id': removed_user.id, 'email': removed_user.email},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)