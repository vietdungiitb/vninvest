"""
Security Dashboard views for tenant-admin.
Login Activity, Active Sessions, Session Revocation.
"""
from datetime import timedelta

from django.db import connection
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from drf_spectacular.utils import extend_schema
from vninvest_core.api_envelope import envelope_response

from .envelope import envelope, paginated_envelope
from .models import CoreTenant, LoginAttempt
from .permissions import IsTenantActive, require_human_session
from .schema import (
    DetailPayloadSerializer,
    PartnerActiveSessionsSerializer,
    PartnerLoginActivitySerializer,
)
from .security_utils import LoginRecorder
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission


def _query_daily_login_activity(tenant_id: int, since):
    """Raw SQL: avoids Django ORM nested-aggregate bug with TruncDate + Count(filter=)."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT date(created_at) AS "date",
                   COUNT(*) FILTER (WHERE success = true)  AS success,
                   COUNT(*) FILTER (WHERE success = false) AS failed
            FROM core_login_attempt
            WHERE tenant_id = %s AND created_at >= %s
            GROUP BY "date"
            ORDER BY "date"
            """,
            [tenant_id, since],
        )
        cols = [col[0] for col in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]


@extend_schema(
    responses={200: envelope_response(PartnerLoginActivitySerializer)},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_login_activity(request):
    require_human_session(request)
    _require_tenant_permission(request, 'security:read')
    tenant = _get_request_tenant(request)
    days = int(request.query_params.get('days', 30))
    days = max(1, min(365, days))

    since = timezone.now() - timedelta(days=days)

    daily = _query_daily_login_activity(tenant.id, since)

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

    return envelope({
        'daily': daily,
        'summary': {
            'total_logins': total_logins,
            'total_failed': total_failed,
            'success_rate_pct': success_rate_pct,
            'unique_ips': unique_ips,
            'unique_users': unique_users,
            'most_active_day': max(daily, key=lambda d: d['success'] + d['failed'])['date'] if daily else None,
            'recent_failures': recent_failures,
        },
    })


@extend_schema(
    responses={200: envelope_response(PartnerActiveSessionsSerializer)},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_active_sessions(request):
    require_human_session(request)
    _require_tenant_permission(request, 'security:read')
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

    return paginated_envelope({
        'sessions': sessions,
        'total_active': len(sessions),
    })


@extend_schema(
    responses={200: envelope_response(DetailPayloadSerializer)},
)
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_revoke_session(request):
    require_human_session(request)
    _require_tenant_permission(request, 'security:read')
    tenant = _get_request_tenant(request)
    current_cred = getattr(request, 'auth', None)
    current_id = current_cred.id if current_cred else None

    session_id = request.data.get('session_id')
    revoke_all = request.data.get('revoke_all_except_current', False)

    if revoke_all:
        LoginRecorder.revoke_all_sessions_except(tenant, exclude_session_id=current_id)
        return envelope({'detail': 'Đã thu hồi tất cả phiên ngoại trừ phiên hiện tại.'}, status=status.HTTP_200_OK)

    if not session_id:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'detail': 'session_id là bắt buộc.'})

    LoginRecorder.revoke_session(session_id, tenant)
    return envelope({'detail': 'Phiên đã được thu hồi.'}, status=status.HTTP_200_OK)
