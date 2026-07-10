"""
Dashboard views for tenant-admin home page.

Provides composite summary and usage trend data for the tenant admin
dashboard home (Phase 0 of the Tenant Admin Upgrade Plan).
"""
from datetime import date, timedelta

from django.db.models import Q, Sum
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CorePATCredential, CoreServiceAccount, CoreTenant
from .permissions import IsTenantActive, require_human_session


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


def _build_recent_events(tenant, limit=10):
    try:
        from tenant_lifecycle.models import TenantLifecycleEvent
        events = TenantLifecycleEvent.objects.filter(
            tenant=tenant
        ).select_related('actor_user').order_by('-created_at')[:limit]
        return [
            {
                'event_type': e.event_type,
                'created_at': e.created_at.isoformat(),
                'actor': e.actor_user.username if e.actor_user else None,
                'description': e.metadata.get('description', '') if e.metadata else '',
            }
            for e in events
        ]
    except Exception:
        return []


def _count_active_members_today(tenant):
    today = date.today()
    from .models import TenantMember
    from django.contrib.auth.models import User
    return TenantMember.objects.filter(
        tenant=tenant,
        user__last_login__date=today,
    ).count()


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_dashboard_summary(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)
    today = date.today()

    members_total = tenant.members.count()
    members_active_today = _count_active_members_today(tenant)

    api_calls_today = 0
    api_calls_limit = -1
    try:
        from commercial.models import QuotaRecord
        qr = QuotaRecord.objects.filter(
            tenant=tenant,
            period_start__lte=today,
            period_end__gte=today,
        ).first()
        if qr:
            api_calls_today = qr.api_calls_used or 0
            api_calls_limit = qr.api_calls_limit if qr.api_calls_limit and qr.api_calls_limit > 0 else -1
    except Exception:
        pass

    quota_headroom_pct = 100
    if api_calls_limit > 0:
        quota_headroom_pct = max(0, 100 - int((api_calls_today / max(api_calls_limit, 1)) * 100))

    member_activity_pct = int((members_active_today / max(members_total, 1)) * 100) if members_total > 0 else 100
    health_score = int((quota_headroom_pct * 0.4) + (member_activity_pct * 0.3) + 30)

    sa_active = CoreServiceAccount.objects.filter(tenant=tenant, status='active').count()
    sa_disabled = CoreServiceAccount.objects.filter(tenant=tenant, status='disabled').count()

    now = timezone.now()
    pats_expiring = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        status='active',
        expires_at__lte=now + timedelta(days=7),
        expires_at__gte=now,
    ).count()

    recent_events = _build_recent_events(tenant, limit=10)

    trial_remaining_days = None
    if tenant.status == 'trial' and tenant.trial_ends_at:
        trial_end = tenant.trial_ends_at
        if hasattr(trial_end, 'date'):
            trial_remaining_days = (trial_end.date() - today).days
        else:
            trial_remaining_days = (trial_end - today).days

    return Response({
        'health_score': health_score,
        'members_active_today': members_active_today,
        'members_total': members_total,
        'api_calls_today': api_calls_today,
        'api_calls_limit': api_calls_limit,
        'quota_headroom_pct': quota_headroom_pct,
        'plan': tenant.plan,
        'plan_status': tenant.status,
        'trial_remaining_days': trial_remaining_days if trial_remaining_days and trial_remaining_days >= 0 else None,
        'service_accounts': {'active': sa_active, 'disabled': sa_disabled},
        'pats_expiring_soon': pats_expiring,
        'recent_events': recent_events,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_dashboard_usage_trend(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)
    days = 7
    try:
        days = max(1, min(int(request.GET.get('days', 7)), 90))
    except (TypeError, ValueError):
        days = 7

    today = date.today()
    start = today - timedelta(days=days - 1)

    from commercial.models import QuotaHistory
    
    # Fetch daily api_calls consumption in one query
    history_records = QuotaHistory.objects.filter(
        tenant=tenant,
        meter_code='api_calls',
        date__gte=start,
        date__lte=today,
    )
    api_calls_by_date = {r.date.isoformat(): r.consumed_amount for r in history_records}

    from .models import TenantMember

    daily = []
    for offset in range(days):
        d = start + timedelta(days=offset)
        d_str = d.isoformat()

        active_members = TenantMember.objects.filter(
            tenant=tenant,
            user__last_login__date=d,
        ).count()

        daily.append({
            'date': d_str,
            'api_calls': api_calls_by_date.get(d_str, 0),
            'active_members': active_members,
        })

    return Response({'daily': daily, 'days': days})
