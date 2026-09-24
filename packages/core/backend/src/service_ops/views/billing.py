"""R2: SOC billing fleet aggregates (staff-only, read-only).

GET /api/soc/billing/overview/ — MRR/ARR/plan-mix/trials/failed/revenue-6m
GET /api/soc/billing/invoices/ — cross-tenant invoice list (filter + paginate)
GET /api/soc/billing/invoices/?format=csv — stream CSV toàn bộ filter (R8.3)
Không migration. Nguồn: commercial.Subscription/Invoice + CoreTenant.
CSV không bao giờ chứa secret/token (chỉ số liệu hóa đơn công khai nội bộ).
"""
import csv
from datetime import date, timedelta

from django.db.models import Count, Q, Sum
from django.http import StreamingHttpResponse
from rest_framework.response import Response

from commercial.models import Invoice, Subscription
from commercial.plan_catalog import PLAN_PRICES_VND
from identity_access.models import CoreTenant
from vninvest_core.pagination import StandardPageNumberPagination

from .base import SOCBaseView

VALID_INVOICE_STATUSES = {c for c, _ in Invoice.StatusChoices.choices}


def _month_key(d: date) -> str:
    return d.strftime('%Y-%m')


class BillingOverviewView(SOCBaseView):
    def get(self, request):
        active_subs = Subscription.objects.filter(
            status=Subscription.StatusChoices.ACTIVE,
        ).select_related('tenant')
        mrr = sum(PLAN_PRICES_VND.get(s.plan, 0) for s in active_subs)

        plan_rows = (
            Subscription.objects.filter(status=Subscription.StatusChoices.ACTIVE)
            .values('plan')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        plan_mix = [
            {'plan': r['plan'], 'count': r['count'],
             'mrr': PLAN_PRICES_VND.get(r['plan'], 0) * r['count']}
            for r in plan_rows
        ]

        today = date.today()
        trials = CoreTenant.objects.filter(
            status=CoreTenant.StatusChoices.TRIAL,
        ).count()
        failed_30d = Invoice.objects.filter(
            status=Invoice.StatusChoices.PAST_DUE,
            created_at__date__gte=today - timedelta(days=30),
        ).count()

        revenue_6m = []
        for back in range(5, -1, -1):
            # Tính lùi từng tháng từ tháng hiện tại.
            year, month = today.year, today.month - back
            while month <= 0:
                month += 12
                year -= 1
            m_start = date(year, month, 1)
            m_end = date(year + (1 if month == 12 else 0),
                         1 if month == 12 else month + 1, 1)
            total = (Invoice.objects
                     .filter(status=Invoice.StatusChoices.PAID,
                             paid_at__date__gte=m_start, paid_at__date__lt=m_end)
                     .aggregate(total=Sum('amount_due'))['total'] or 0)
            revenue_6m.append({'month': _month_key(m_start), 'total': str(total)})

        return Response({
            'mrr': mrr,
            'arr': mrr * 12,
            'currency': 'VND',
            'plan_mix': plan_mix,
            'trials_active': trials,
            'invoices_failed_30d': failed_30d,
            'revenue_6m': revenue_6m,
        })


class BillingInvoiceListView(SOCBaseView):
    COLUMNS = ['invoice_number', 'status', 'amount_due', 'currency',
               'period_start', 'period_end', 'paid_at', 'tenant_code',
               'tenant_name', 'tenant_plan', 'created_at']
    CSV_MAX_ROWS = 5000

    def _filtered_qs(self, request):
        qs = Invoice.objects.select_related('tenant').order_by('-created_at')
        status_filter = (request.query_params.get('status') or '').strip()
        plan_filter = (request.query_params.get('plan') or '').strip()
        search = (request.query_params.get('search') or '').strip()
        if status_filter:
            if status_filter not in VALID_INVOICE_STATUSES:
                return None
            qs = qs.filter(status=status_filter)
        if plan_filter:
            qs = qs.filter(tenant__plan=plan_filter)
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search)
                | Q(tenant__tenant_code__icontains=search)
                | Q(tenant__display_name__icontains=search)
            )
        return qs

    def get(self, request):
        qs = self._filtered_qs(request)
        if qs is None:
            return Response({'detail': 'Trạng thái hóa đơn không hợp lệ.'},
                            status=400)
        if (request.query_params.get('download') or '').strip() == 'csv':
            return self._csv_response(qs)
        paginator = StandardPageNumberPagination()
        page = paginator.paginate_queryset(qs, request)
        rows = [self._serialize(inv) for inv in page]
        return paginator.get_paginated_response(rows)

    @staticmethod
    def _serialize(inv) -> dict:
        return {
            'id': inv.id,
            'invoice_number': inv.invoice_number,
            'status': inv.status,
            'amount_due': str(inv.amount_due),
            'currency': inv.currency,
            'period_start': inv.period_start.isoformat(),
            'period_end': inv.period_end.isoformat(),
            'paid_at': inv.paid_at.isoformat() if inv.paid_at else None,
            'tenant_code': inv.tenant.tenant_code,
            'tenant_id': inv.tenant.public_id,
            'tenant_name': inv.tenant.display_name,
            'tenant_plan': inv.tenant.plan,
            'created_at': inv.created_at.isoformat(),
        }

    def _csv_response(self, qs):
        class _Echo:
            def write(self, value):
                return value

        writer = csv.writer(_Echo())

        def gen():
            yield writer.writerow(self.COLUMNS)
            for inv in qs[:self.CSV_MAX_ROWS].iterator(chunk_size=1000):
                row = self._serialize(inv)
                yield writer.writerow([row.get(c, '') or '' for c in self.COLUMNS])

        resp = StreamingHttpResponse(gen(), content_type='text/csv')
        resp['Content-Disposition'] = 'attachment; filename="soc-invoices.csv"'
        return resp
