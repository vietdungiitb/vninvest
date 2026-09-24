"""R3: SOC usage fleet aggregates (staff-only, read-only).

GET /api/soc/usage/overview/ — calls today/30d, error rate, top tenants,
quotas near limit. Aggregate DB-side, không kéo rows về Python.
Nguồn: ops_audit.ApiCallRollup + commercial.QuotaRecord + CoreTenant.
Không migration.
"""
from datetime import date, timedelta

from django.db.models import Sum
from rest_framework.response import Response

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import ApiCallRollup

from .base import SOCBaseView

NEAR_LIMIT_PCT = 80


class UsageOverviewView(SOCBaseView):
    def get(self, request):
        today = date.today()
        start_30d = today - timedelta(days=29)

        base_30d = ApiCallRollup.objects.filter(date__gte=start_30d, date__lte=today)
        agg_30d = base_30d.aggregate(
            calls=Sum('call_count'), errors=Sum('error_count'))
        calls_30d = agg_30d['calls'] or 0
        errors_30d = agg_30d['errors'] or 0
        calls_today = (
            ApiCallRollup.objects.filter(date=today)
            .aggregate(calls=Sum('call_count'))['calls'] or 0
        )
        error_rate = (errors_30d / calls_30d) if calls_30d else 0.0

        top_rows = list(
            base_30d.values('tenant_id')
            .annotate(calls=Sum('call_count'), errors=Sum('error_count'))
            .order_by('-calls')[:10]
        )
        tenants = CoreTenant.objects.in_bulk(
            [r['tenant_id'] for r in top_rows], field_name='public_id')
        top_tenants = [{
            'tenant_id': r['tenant_id'],
            'tenant_code': getattr(tenants.get(r['tenant_id']), 'tenant_code', r['tenant_id']),
            'display_name': getattr(tenants.get(r['tenant_id']), 'display_name', ''),
            'calls': r['calls'] or 0,
            'errors': r['errors'] or 0,
        } for r in top_rows]

        # Quota kỳ hiện tại mới nhất mỗi tenant (1 query, gộp bằng Python).
        current = QuotaRecord.objects.filter(
            period_start__lte=today, period_end__gte=today,
        ).select_related('tenant').order_by('tenant_id', '-period_end')
        latest = {}
        for rec in current:
            latest.setdefault(rec.tenant_id, rec)
        near_limit = []
        for rec in latest.values():
            limit = rec.api_calls_limit or 0
            if limit > 0:
                pct = (rec.api_calls_used / limit) * 100.0
                if pct >= NEAR_LIMIT_PCT:
                    near_limit.append({
                        'tenant_code': rec.tenant.tenant_code,
                        'display_name': rec.tenant.display_name,
                        'meter': 'api_calls',
                        'used_pct': round(pct, 1),
                    })
        near_limit.sort(key=lambda r: r['used_pct'], reverse=True)

        return Response({
            'calls_today': calls_today,
            'calls_30d': calls_30d,
            'error_rate_30d': round(error_rate, 4),
            'top_tenants': top_tenants,
            'quotas_near_limit': near_limit,
        })
