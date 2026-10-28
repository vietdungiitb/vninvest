"""R8: SOC analytics fleet (staff-only, read-only, không migration).

GET /api/soc/analytics/growth/?days=30|90 — signups/trials/paid/churn theo ngày
(DB-aggregate, ngày trống = 0).
GET /api/soc/analytics/cohorts/ — trial.active/expired, ever-paid, conversion,
plan-mix, upgrades/downgrades 30d (từ AuditEvent set-plan).
Định nghĩa conversion ghi显式 trong response.notes.
"""
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.db.models import Count
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema

from commercial.models import Invoice, QuotaRecord, Subscription
from identity_access.models import CoreTenant
from ops_audit.models import AuditEvent
from vninvest_core.api_envelope import envelope_response

from ..envelope import envelope
from .base import SOCBaseView

DEFAULT_DAYS = 30
MAX_DAYS = 90


def _parse_days(request) -> int:
    try:
        days = int(request.query_params.get('days', DEFAULT_DAYS))
    except (TypeError, ValueError):
        days = DEFAULT_DAYS
    return max(1, min(days, MAX_DAYS))


def _daily_counts(qs, day_field: str, start: date, days: int) -> list:
    rows = (qs.filter(**{f'{day_field}__date__gte': start})
            .values(f'{day_field}__date')
            .annotate(count=Count('pk'))
            .order_by(f'{day_field}__date'))
    by_day = {r[f'{day_field}__date'].isoformat(): r['count'] for r in rows}
    return [{'date': (start + timedelta(days=i)).isoformat(),
             'count': by_day.get((start + timedelta(days=i)).isoformat(), 0)}
            for i in range(days)]


@extend_schema(
    summary='AnalyticsGrowthView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AnalyticsGrowthView(SOCBaseView):
    def get(self, request):
        days = _parse_days(request)
        today = date.today()
        start = today - timedelta(days=days - 1)
        return envelope({
            'days': days,
            'start_date': start.isoformat(),
            'end_date': today.isoformat(),
            'signups': _daily_counts(
                User.objects.all(), 'date_joined', start, days),
            'trials': _daily_counts(
                CoreTenant.objects.filter(status=CoreTenant.StatusChoices.TRIAL),
                'created_at', start, days),
            'paid_new': _daily_counts(
                Subscription.objects.all(), 'created_at', start, days),
            'churned': _daily_counts(
                CoreTenant.objects.filter(
                    status__in=(CoreTenant.StatusChoices.SUSPENDED,
                                CoreTenant.StatusChoices.DEPROVISIONED)),
                'updated_at', start, days),
        })


@extend_schema(
    summary='AnalyticsCohortsView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AnalyticsCohortsView(SOCBaseView):
    def get(self, request):
        today = date.today()
        trial_active = CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL).count()
        trial_expired = CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL,
            trial_ends_at__date__lt=today).count()
        ever_trial = CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL).count()
        # Conversion (distinct, theo Invoice paid — đúng plan R8.2):
        # converted = tenants có ≥1 invoice PAID;
        # ever_trial = trial_active + converted − overlap (trial đã trả phí).
        paid_tenant_ids = set(Invoice.objects.filter(
            status=Invoice.StatusChoices.PAID,
        ).values_list('tenant_id', flat=True))
        converted = len(paid_tenant_ids)
        trial_ids = set(CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL).values_list('id', flat=True))
        overlap = len(trial_ids & paid_tenant_ids)
        ever_trial_total = trial_active + converted - overlap
        conversion_rate = (converted / ever_trial_total) if ever_trial_total else 0.0

        plan_rows = list(
            CoreTenant.objects.values('plan')
            .annotate(count=Count('id')).order_by('-count'))
        since_30d = today - timedelta(days=29)
        upgrades = downgrades = 0
        for e in AuditEvent.objects.filter(
                resource_type='tenant',
                occurred_at__date__gte=since_30d):
            meta = e.metadata or {}
            frm, to = meta.get('from_plan'), meta.get('to_plan')
            if frm and to and frm != to:
                # Thứ tự plan theo giá trị gói chuẩn.
                order = {'free': 0, 'starter': 1, 'pro': 2, 'enterprise': 3,
                         'custom': 4, 'internal': 5}
                if order.get(to, -1) > order.get(frm, -1):
                    upgrades += 1
                else:
                    downgrades += 1

        return envelope({
            'trial_active': trial_active,
            'trial_expired': trial_expired,
            'ever_trial': ever_trial,
            'converted_paid': converted,
            'conversion_rate': round(conversion_rate, 4),
            'plan_mix': [{'plan': r['plan'], 'count': r['count']} for r in plan_rows],
            'upgrades_30d': upgrades,
            'downgrades_30d': downgrades,
            'notes': ('conversion = tenants có ≥1 invoice PAID / '
                      '(trial_active + converted − overlap trial-đã-trả-phí); '
                      'upgrades/downgrades đếm từ '
                      'AuditEvent set-plan 30 ngày có metadata from_plan/to_plan.'),
        })


@extend_schema(
    summary='AnalyticsAlertsView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AnalyticsAlertsView(SOCBaseView):
    def get(self, request):
        from commercial.models import Invoice

        today = date.today()
        alerts = []

        expiring = CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL,
            trial_ends_at__date__gte=today,
            trial_ends_at__date__lte=today + timedelta(days=3),
        ).order_by('trial_ends_at')[:50]
        for t in expiring:
            alerts.append({
                'kind': 'trial_expiring',
                'severity': 'warning',
                'tenant_code': t.tenant_code,
                'tenant_id': t.public_id,
                'detail': (t.trial_ends_at.date().isoformat()
                           if t.trial_ends_at else ''),
            })

        critical_quotas = []
        current = QuotaRecord.objects.filter(
            period_start__lte=today, period_end__gte=today,
        ).select_related('tenant')
        seen = set()
        for rec in current.order_by('tenant_id', '-period_end'):
            if rec.tenant_id in seen:
                continue
            seen.add(rec.tenant_id)
            limit = rec.api_calls_limit or 0
            if limit > 0 and (rec.api_calls_used / limit) * 100.0 >= 90:
                critical_quotas.append({
                    'kind': 'quota_critical',
                    'severity': 'critical',
                    'tenant_code': rec.tenant.tenant_code,
                    'tenant_id': rec.tenant.public_id,
                    'detail': f"api_calls {rec.api_calls_used}/{limit}",
                })
        alerts.extend(critical_quotas)

        overdue = Invoice.objects.filter(
            status=Invoice.StatusChoices.PAST_DUE,
        ).select_related('tenant').order_by('-updated_at')[:50]
        for inv in overdue:
            alerts.append({
                'kind': 'invoice_past_due',
                'severity': 'critical',
                'tenant_code': inv.tenant.tenant_code,
                'tenant_id': inv.tenant.public_id,
                'detail': f'{inv.invoice_number} {inv.amount_due} {inv.currency}',
            })

        week_ago = today - timedelta(days=6)
        suspended_recent = CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.SUSPENDED,
            suspended_at__date__gte=week_ago,
        ).count()
        return envelope({
            'alerts': alerts,
            'suspended_spike_7d': suspended_recent,
        })
