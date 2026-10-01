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
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from tenant_lifecycle.models import TenantLifecycleEvent
from .envelope import envelope
from .models import CoreTenant, TenantMember, TenantInvite
from .serializers import TenantMemberSerializer, TenantInviteSerializer, TenantInviteCreateSerializer
from .permissions import IsTenantActive, require_human_session, require_pat_scopes_or_human_session
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission
from vninvest_core.exceptions import (
    ValidationErrorException,
    NotFoundErrorException,
    ConflictErrorException,
    PermissionErrorException,
    CoreAPIException,
)


class InviteThrottle(UserRateThrottle):
    """Rate limit: 10 invites per hour per user."""
    scope = 'tenant_invite'
    rate = '10/hour'


class TenantMemberListView(APIView):
    """List members of current tenant."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'member:read')
        tenant = _get_request_tenant(request)

        # List members
        members = TenantMember.objects.filter(tenant=tenant).select_related('user', 'invited_by')
        serializer = TenantMemberSerializer(members, many=True)
        return envelope({'members': serializer.data})


class TenantInvitesCombinedView(APIView):
    """
    Combined view for tenant invites:
    - POST: Create new invite (owner/admin only)
    - GET: List pending invites (owner/admin only)
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]
    throttle_classes = [InviteThrottle]

    def post(self, request):
        """Create invite for new member."""
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'member:write')
        tenant = _get_request_tenant(request)

        # Validate input
        serializer = TenantInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        invited_email = serializer.validated_data['invited_email'].lower().strip()
        role = serializer.validated_data['role']
        custom_role_id = serializer.validated_data.get('custom_role_id') or None

        # Validate custom_role_id belongs to same tenant
        custom_role = None
        if custom_role_id:
            from identity_access.models import TenantCustomRole
            custom_role = TenantCustomRole.objects.filter(
                public_id=custom_role_id, tenant=tenant,
            ).first()
            if not custom_role:
                raise NotFoundErrorException('Custom role not found in this tenant')

        # Enforce member limit per plan
        PLAN_MEMBER_LIMITS = {
            'free': 3, 'starter': 5, 'pro': 25,
            'enterprise': None, 'custom': None, 'internal': None,
        }
        current_count = TenantMember.objects.filter(tenant=tenant).count()
        pending_count = TenantInvite.objects.filter(
            tenant=tenant, status=TenantInvite.StatusChoices.PENDING,
        ).count()
        limit = PLAN_MEMBER_LIMITS.get(tenant.plan)
        if limit is not None and (current_count + pending_count) >= limit:
            raise PermissionErrorException(
                f'Member limit reached for {tenant.plan} plan. '
                f'Current: {current_count} members, {pending_count} pending invites. '
                f'Max: {limit}.'
            )

        # Check if user already member
        existing_member = TenantMember.objects.filter(
            tenant=tenant,
            user__email__iexact=invited_email,
        ).first()
        if existing_member:
            raise ConflictErrorException('User is already a member')

        # Check for pending invite
        pending_invite = TenantInvite.objects.filter(
            tenant=tenant,
            invited_email__iexact=invited_email,
            status=TenantInvite.StatusChoices.PENDING,
        ).first()
        if pending_invite:
            raise ConflictErrorException('Invite already pending for this email')

        # Create invite
        token = TenantInvite.generate_token()
        invite = TenantInvite.objects.create(
            tenant=tenant,
            invited_email=invited_email,
            inviter=request.user,
            token=token,
            role=role,
            custom_role=custom_role,
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

        # Enqueue invite email (async, non-critical)
        try:
            from identity_access.email_tasks import send_invite_email
            send_invite_email.delay(invite.id)
        except Exception as e:
            import logging as _logging
            _logging.getLogger(__name__).error(
                'Invite email enqueue failed for invite=%s: %s', invite.id, e, exc_info=True,
            )

        result = TenantInviteSerializer(invite)
        return envelope(result.data, status=status.HTTP_201_CREATED)

    def get(self, request):
        """List pending invites for tenant."""
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'member:read')
        tenant = _get_request_tenant(request)

        # List pending invites
        invites = TenantInvite.objects.filter(
            tenant=tenant,
            status=TenantInvite.StatusChoices.PENDING,
        ).select_related('inviter')
        serializer = TenantInviteSerializer(invites, many=True)
        return envelope({'invites': serializer.data})


class TenantInviteAcceptView(APIView):
    """Accept invitation via token."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def post(self, request, token):
        require_human_session(request)
        user = request.user

        # Find invite
        invite = TenantInvite.objects.filter(token=token).first()
        if not invite:
            raise NotFoundErrorException('Invalid or expired token')

        # Check status
        if invite.status != TenantInvite.StatusChoices.PENDING:
            if invite.status == TenantInvite.StatusChoices.ACCEPTED:
                raise ConflictErrorException('Invite already accepted')
            raise ValidationErrorException('Invite is not pending')

        # Check expiry
        if invite.is_expired:
            invite.status = TenantInvite.StatusChoices.EXPIRED
            invite.save()
            raise CoreAPIException(
                detail='Invite has expired',
                code='expired',
                status_code=status.HTTP_410_GONE,
            )

        # Check email match
        if user.email.lower().strip() != invite.invited_email.lower().strip():
            raise PermissionErrorException('Email does not match invited email')

        # H0.3b: invite cũ role=owner (tạo trước blacklist) không được accept —
        # chuyển chủ sở hữu là flow riêng có xác nhận.
        if invite.role == TenantMember.RoleChoices.OWNER:
            raise PermissionErrorException(
                'Invite owner đã bị vô hiệu. Chuyển chủ sở hữu dùng flow riêng.')

        # Enforce member limit per plan
        PLAN_MEMBER_LIMITS = {
            'free': 3, 'starter': 5, 'pro': 25,
            'enterprise': None, 'custom': None, 'internal': None,
        }
        tenant = invite.tenant
        current_count = TenantMember.objects.filter(tenant=tenant).count()
        limit = PLAN_MEMBER_LIMITS.get(tenant.plan)
        if limit is not None and current_count >= limit:
            raise PermissionErrorException(
                f'Member limit reached for {tenant.plan} plan. '
                f'Current: {current_count} members. Max: {limit}.'
            )

        # Accept invite: create member (propagate custom_role if set)
        defaults = {
            'role': invite.role,
            'invited_by': invite.inviter,
        }
        if invite.custom_role_id:
            defaults['custom_role'] = invite.custom_role
        member, created = TenantMember.objects.get_or_create(
            tenant=invite.tenant,
            user=user,
            defaults=defaults,
        )

        if not created:
            raise ConflictErrorException('User is already a member')

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
        return envelope(result.data, status=status.HTTP_201_CREATED)


class TenantMemberRemoveView(APIView):
    """Remove member from tenant."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def delete(self, request, member_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'member:write')
        tenant = _get_request_tenant(request)

        # Find member
        member = TenantMember.objects.filter(public_id=member_id, tenant=tenant).first()
        if not member:
            raise NotFoundErrorException('Member not found')

        # Cannot remove owner
        if tenant.owner_user == member.user:
            raise PermissionErrorException('Cannot remove tenant owner')

        # Cannot remove self
        if member.user == request.user:
            raise PermissionErrorException('Cannot remove yourself')

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


class TenantInviteCancelView(APIView):
    """Cancel tenant invitation."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def post(self, request, invite_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'member:write')
        tenant = _get_request_tenant(request)

        # Find invite
        invite = TenantInvite.objects.filter(public_id=invite_id, tenant=tenant).first()
        if not invite:
            raise NotFoundErrorException('Invite not found')

        if invite.status != TenantInvite.StatusChoices.PENDING:
            raise ValidationErrorException('Only pending invites can be canceled')

        # Delete the invite record
        invite.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)