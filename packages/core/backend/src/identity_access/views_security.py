"""
Security Dashboard views for tenant-admin.
Login Activity, Active Sessions, Session Revocation.
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import CoreTenant, LoginAttempt
from .permissions import IsTenantActive, require_human_session
from .security_utils import LoginRecorder


def _get_request_tenant(request) -> CoreTenant:
    tenant = getattr(request, 'tenant', None)
    if tenant is not None:
        return tenant
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        try:
            tenant = CoreTenant.objects.get(owner_user=user)
        except CoreTenant.DoesNotExist:
            from .models import TenantMember
            member = TenantMember.objects.filter(user=user).select_related('tenant').first()
            if member:
                tenant = member.tenant
    if tenant is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Không tìm thấy tenant.')
    return tenant


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_login_activity(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)
    days = int(request.query_params.get('days', 30))
    days = max(1, min(365, days))

    since = timezone.now() - timedelta(days=days)

    daily = (
        LoginAttempt.objects
        .filter(tenant=tenant, created_at__gte=since)
        .extra(select={'date': "date(created_at)"})
        .values('date')
        .annotate(
            success=Count('id', filter=Q(success=True)),
            failed=Count('id', filter=Q(success=False)),
        )
        .order_by('date')
    )

    total_logins = LoginAttempt.objects.filter(tenant=tenant, created_at__gte=since).count()
    total_failed = LoginAttempt.objects.filter(tenant=tenant, created_at__gte=since, success=False).count()
    unique_ips = (
        LoginAttempt.objects.filter(tenant=tenant, created_at__gte=since)
        .values('ip_address')
        .distinct()
        .count()
    )
    unique_users = (
        LoginAttempt.objects.filter(tenant=tenant, created_at__gte=since)
        .values('username')
        .distinct()
        .count()
    )
    success_rate_pct = round((total_logins - total_failed) / max(total_logins, 1) * 100, 1)

    recent_failures_raw = (
        LoginAttempt.objects
        .filter(tenant=tenant, success=False, created_at__gte=timezone.now() - timedelta(hours=24))
        .values('username', 'ip_address')
        .annotate(attempts=Count('id'))
        .annotate(last_at=Count('created_at'))
        .order_by('-attempts')[:10]
    )
    recent_failures = [
        {
            'username': r['username'],
            'ip': r['ip_address'],
            'attempts': r['attempts'],
            'last_at': LoginAttempt.objects.filter(tenant=tenant, username=r['username'], ip_address=r['ip_address'], success=False).latest('created_at').created_at.isoformat() if LoginAttempt.objects.filter(tenant=tenant, username=r['username'], ip_address=r['ip_address'], success=False).exists() else None,
        }
        for r in recent_failures_raw
    ]

    return Response({
        'daily': list(daily),
        'summary': {
            'total_logins': total_logins,
            'total_failed': total_failed,
            'success_rate_pct': success_rate_pct,
            'unique_ips': unique_ips,
            'unique_users': unique_users,
            'most_active_day': max(daily, key=lambda d: d['success'] + d['failed']).get('date') if daily else None,
            'recent_failures': recent_failures,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_active_sessions(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)

    sessions_qs = LoginRecorder.get_active_sessions(tenant)
    current_cred = getattr(request, 'auth', None)
    current_id = current_cred.id if current_cred else None

    sessions = []
    for cred in sessions_qs:
        sessions.append({
            'session_id': cred.id,
            'user_id': cred.service_account.tenant.owner_user.id,
            'username': cred.service_account.tenant.owner_user.username,
            'ip_address': cred.service_account.metadata.get('login_ip', ''),
            'user_agent': cred.service_account.metadata.get('login_user_agent', ''),
            'login_at': cred.created_at.isoformat(),
            'last_active_at': (cred.last_used_at or cred.created_at).isoformat(),
            'token_prefix': cred.token_prefix,
            'is_current': cred.id == current_id,
        })

    return Response({
        'sessions': sessions,
        'total_active': len(sessions),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_revoke_session(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)
    current_cred = getattr(request, 'auth', None)
    current_id = current_cred.id if current_cred else None

    session_id = request.data.get('session_id')
    revoke_all = request.data.get('revoke_all_except_current', False)

    if revoke_all:
        LoginRecorder.revoke_all_sessions_except(tenant, exclude_session_id=current_id)
        return Response({'detail': 'Đã thu hồi tất cả phiên ngoại trừ phiên hiện tại.'}, status=status.HTTP_200_OK)

    if not session_id:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'detail': 'session_id là bắt buộc.'})

    LoginRecorder.revoke_session(session_id, tenant)
    return Response({'detail': 'Phiên đã được thu hồi.'}, status=status.HTTP_200_OK)
