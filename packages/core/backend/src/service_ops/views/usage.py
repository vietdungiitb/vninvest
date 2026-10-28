"""R3: SOC usage fleet aggregates (staff-only, read-only).

GET /api/soc/usage/overview/ — calls today/30d, error rate, top tenants,
quotas near limit. Aggregate DB-side, không kéo rows về Python.
GET /api/soc/usage/export/?days= — stream CSV top tenants + quotas (R8.3).
Nguồn: ops_audit.ApiCallRollup + commercial.QuotaRecord + CoreTenant.
CSV không chứa secret/token. Không migration.
"""
import csv
from datetime import date, timedelta

from django.db.models import Sum
from django.http import StreamingHttpResponse
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema

from commercial.models import QuotaRecord
from identity_access.models import CoreTenant
from ops_audit.models import ApiCallRollup
from vninvest_core.api_envelope import envelope_response

from ..envelope import envelope
from .base import SOCBaseView

NEAR_LIMIT_PCT = 80
EXPORT_MAX_DAYS = 90


def _compute_usage_overview(days: int = 30) -> dict:
    today = date.today()
    start = today - timedelta(days=days - 1)
    base = ApiCallRollup.objects.filter(date__gte=start, date__lte=today)
    agg = base.aggregate(calls=Sum('call_count'), errors=Sum('error_count'))
    calls = agg['calls'] or 0
    errors = agg['errors'] or 0
    calls_today = (
        ApiCallRollup.objects.filter(date=today)
        .aggregate(calls=Sum('call_count'))['calls'] or 0
    )
    top_rows = list(
        base.values('tenant_id')
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
    return {
        'days': days,
        'calls_today': calls_today,
        'calls_total': calls,
        'error_rate': round((errors / calls), 4) if calls else 0.0,
        'top_tenants': top_tenants,
        'quotas_near_limit': near_limit,
    }


@extend_schema(
    summary='UsageOverviewView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class UsageOverviewView(SOCBaseView):
    def get(self, request):
        data = _compute_usage_overview(days=30)
        return envelope({
            'calls_today': data['calls_today'],
            'calls_30d': data['calls_total'],
            'error_rate_30d': data['error_rate'],
            'top_tenants': data['top_tenants'],
            'quotas_near_limit': data['quotas_near_limit'],
        })


@extend_schema(
    summary='UsageExportView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class UsageExportView(SOCBaseView):
    TOP_COLUMNS = ['tenant_id', 'tenant_code', 'display_name', 'calls', 'errors']
    QUOTA_COLUMNS = ['tenant_code', 'display_name', 'meter', 'used_pct']

    def get(self, request):
        try:
            days = int(request.query_params.get('days', 30))
        except (TypeError, ValueError):
            days = 30
        days = max(1, min(days, EXPORT_MAX_DAYS))
        data = _compute_usage_overview(days=days)

        class _Echo:
            def write(self, value):
                return value

        writer = csv.writer(_Echo())

        def gen():
            yield writer.writerow(['section'] + self.TOP_COLUMNS)
            for r in data['top_tenants']:
                yield writer.writerow(
                    ['top_tenants'] + [r.get(c, '') or '' for c in self.TOP_COLUMNS])
            yield writer.writerow([])
            yield writer.writerow(['section'] + self.QUOTA_COLUMNS)
            for r in data['quotas_near_limit']:
                yield writer.writerow(
                    ['quotas_near_limit'] + [r.get(c, '') or '' for c in self.QUOTA_COLUMNS])

        resp = StreamingHttpResponse(gen(), content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="soc-usage.csv"'
        return resp
