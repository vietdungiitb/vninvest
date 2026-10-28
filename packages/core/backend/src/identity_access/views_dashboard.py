"""
Dashboard views for tenant-admin home page.

Provides composite summary and usage trend data for the tenant admin
dashboard home (Phase 0 of the Tenant Admin Upgrade Plan).
"""
import logging

from datetime import date, timedelta

from django.db.models import Count
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from drf_spectacular.utils import extend_schema
from vninvest_core.api_envelope import envelope_response

from .envelope import envelope
from .models import CorePATCredential, CoreServiceAccount
from .permissions import IsTenantActive, require_human_session
from .schema import PartnerDashboardUsageTrendSerializer
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission

logger = logging.getLogger(__name__)


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
        logger.warning("dashboard summary: _build_recent_events fallback", exc_info=True)
        return []


def _count_active_members_today(tenant):
    today = date.today()
    from .models import TenantMember
    return TenantMember.objects.filter(
        tenant=tenant,
        user__last_login__date=today,
    ).count()


#: `data` free-form: payload dựng tay ~15 key kèm khối lồng
#: (`service_accounts`, `health_breakdown`, `pats_expiring_soon`,
#: `recent_events`) — key **động** theo dữ liệu. Liệt kê cứng sẽ bắt client
#: tin có field không tồn tại; xem bảng "Khi nào KHÔNG tạo serializer" ở
#: `identity_access/schema.py`.
@extend_schema(
    responses={200: envelope_response()},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_dashboard_summary(request):
    require_human_session(request)
    _require_tenant_permission(request, 'dashboard:read')
    tenant = _get_request_tenant(request)
    today = date.today()

    members_total = tenant.members.count()
    members_active_today = _count_active_members_today(tenant)

    # `QuotaRecord.api_calls_used` la tong TICH LUY TRONG THANG (xem
    # `commercial/quota_period.py`), khong phai so goi trong ngay. Bien ten cu
    # la trung thuc; khoa JSON `api_calls_today` giu nguyen de khong pha FE
    # contract (`TenantAdminHomePage.tsx:399`).
    api_calls_used_period = 0
    api_calls_limit = -1
    try:
        from commercial.models import QuotaRecord
        qr = QuotaRecord.objects.filter(
            tenant=tenant,
            period_start__lte=today,
            period_end__gte=today,
        ).first()
        if qr:
            api_calls_used_period = qr.api_calls_used or 0
            api_calls_limit = qr.api_calls_limit if qr.api_calls_limit and qr.api_calls_limit > 0 else -1
    except Exception:
        logger.warning("dashboard summary: QuotaRecord fallback", exc_info=True)

    quota_headroom_pct = 100
    if api_calls_limit > 0:
        # Cung don vi: used(thang) / limit(thang). Truoc day `api_calls_used`
        # chi luu gia tri cua MOT ngay nen headroom luon ~100%.
        quota_headroom_pct = max(0, 100 - int((api_calls_used_period / max(api_calls_limit, 1)) * 100))

    member_activity_pct = int((members_active_today / max(members_total, 1)) * 100) if members_total > 0 else 100
    base_score = 30
    health_score = int((quota_headroom_pct * 0.4) + (member_activity_pct * 0.3) + base_score)
    health_breakdown = {
        'quota': quota_headroom_pct,
        'activity': member_activity_pct,
        'base': base_score,
    }

    sa_active = CoreServiceAccount.objects.filter(tenant=tenant, status='active').count()
    sa_disabled = CoreServiceAccount.objects.filter(tenant=tenant, status='disabled').count()

    now = timezone.now()
    pats_expiring = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        status='active',
        expires_at__lte=now + timedelta(days=7),
        expires_at__gte=now,
    ).count()
    # REV2: additive pats_total for checklist PAT semantics (F04b)
    pats_total = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        status='active',
    ).count()

    # Phase 1 F04a: sso_configured + webhook_count (additive, optional FE)
    sso_configured = False
    webhook_count = 0
    try:
        from .models import TenantSSOConfig, TenantWebhookConfig
        sso_configured = TenantSSOConfig.objects.filter(tenant=tenant, is_enabled=True).exists()
        webhook_count = TenantWebhookConfig.objects.filter(tenant=tenant, is_active=True).count()
    except Exception:
        logger.warning("dashboard summary: sso/webhook fallback", exc_info=True)

    # Phase 1 KPI delta: yesterday values for Δ vs previous day
    yesterday = today - timedelta(days=1)
    api_calls_yesterday = 0
    members_active_yesterday = 0
    try:
        from commercial.models import QuotaHistory
        qh_y = QuotaHistory.objects.filter(tenant=tenant, meter_code='api_calls', date=yesterday).first()
        if qh_y:
            api_calls_yesterday = qh_y.consumed_amount or 0
    except Exception:
        logger.warning("dashboard summary: api_calls_yesterday fallback", exc_info=True)
    try:
        from .models import TenantMember
        members_active_yesterday = TenantMember.objects.filter(tenant=tenant, user__last_login__date=yesterday).count()
    except Exception:
        logger.warning("dashboard summary: members_active_yesterday fallback", exc_info=True)

    recent_events = _build_recent_events(tenant, limit=10)

    trial_remaining_days = None
    if tenant.status == 'trial' and tenant.trial_ends_at:
        trial_end = tenant.trial_ends_at
        if hasattr(trial_end, 'date'):
            trial_remaining_days = (trial_end.date() - today).days
        else:
            trial_remaining_days = (trial_end - today).days

    return envelope({
        'health_score': health_score,
        'health_breakdown': health_breakdown,
        'members_active_today': members_active_today,
        'members_total': members_total,
        'api_calls_today': api_calls_used_period,
        'api_calls_limit': api_calls_limit,
        'quota_headroom_pct': quota_headroom_pct,
        'api_calls_yesterday': api_calls_yesterday,
        'members_active_yesterday': members_active_yesterday,
        'plan': tenant.plan,
        'plan_status': tenant.status,
        'trial_remaining_days': trial_remaining_days if trial_remaining_days and trial_remaining_days >= 0 else None,
        'service_accounts': {'active': sa_active, 'disabled': sa_disabled},
        'pats_expiring_soon': pats_expiring,
        'pats_total': pats_total,
        'sso_configured': sso_configured,
        'webhook_count': webhook_count,
        'recent_events': recent_events,
    })


@extend_schema(
    responses={200: envelope_response(PartnerDashboardUsageTrendSerializer)},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_dashboard_usage_trend(request):
    require_human_session(request)
    _require_tenant_permission(request, 'dashboard:read')
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

    # F03 fix: single GROUP BY query for active_members, avoid N queries
    active_by_date = {}
    try:
        rows = (
            TenantMember.objects.filter(
                tenant=tenant,
                user__last_login__date__gte=start,
                user__last_login__date__lte=today,
            )
            .values('user__last_login__date')
            .annotate(c=Count('id'))
        )
        for r in rows:
            d = r['user__last_login__date']
            if d:
                active_by_date[d.isoformat()] = r['c']
    except Exception:
        logger.warning("dashboard usage-trend: active_members GROUP BY fallback", exc_info=True)

    daily = []
    for offset in range(days):
        d = start + timedelta(days=offset)
        d_str = d.isoformat()

        daily.append({
            'date': d_str,
            'api_calls': api_calls_by_date.get(d_str, 0),
            'active_members': active_by_date.get(d_str, 0),
        })

    return envelope({'daily': daily, 'days': days})
