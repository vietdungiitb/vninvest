"""
Analytics views for partner billing cost trends.
"""
import logging
from datetime import timedelta

from django.db.models import Count, Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions

from identity_access.permissions import (
    IsTenantActive,
    require_pat_scopes_or_human_session,
)
from identity_access.utils.resolve_tenant import resolve_tenant
from vninvest_core.api_envelope import envelope_response

from .envelope import envelope
from .permissions import RequiresTenantPermission
from .schema import (
    PartnerCostTrendDataSerializer,
)

logger = logging.getLogger(__name__)

TENANT_PERMISSION_CLASSES = [
    permissions.IsAuthenticated,
    IsTenantActive,
    RequiresTenantPermission,
]


def _get_tenant(request):
    return resolve_tenant(request)


@extend_schema(
    responses={200: envelope_response(PartnerCostTrendDataSerializer)},
)
class PartnerCostTrendView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/billing/cost-trend/?months=6

    Returns monthly cost breakdown for the last N months.
    Uses Invoice model (status='paid') grouped by month.
    Falls back gracefully if insufficient data.
    """
    permission_classes = TENANT_PERMISSION_CLASSES
    # Cost in VND per month. Money, so the billing token -- `viewer` and
    # `editor` do not hold it (SYSTEM_ROLE_PERMISSIONS, resolve_tenant.py:27).
    required_tenant_permissions = ('billing:read',)

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')

        try:
            from commercial.models import Invoice
        except ImportError:
            return envelope({'monthly': [], 'note': 'commercial app not available'})

        tenant = _get_tenant(request)
        months = int(request.query_params.get('months', 6))
        cutoff = timezone.now().date() - timedelta(days=months * 30)

        qs = Invoice.objects.filter(
            tenant=tenant,
            status='paid',
            created_at__date__gte=cutoff,
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            total=Sum('amount_due'),
            count=Count('id')
        ).order_by('month')

        monthly = []
        for row in qs:
            month_str = row['month'].strftime('%Y-%m') if row['month'] else None
            items = {}
            monthly.append({
                'month': month_str,
                'total': float(row['total']) if row['total'] else 0,
                'items': items,
                'count': row['count'],
            })

        total_6m = sum(m['total'] for m in monthly)
        monthly_avg = total_6m / len(monthly) if monthly else 0

        projected = None
        projected_change_pct = None
        if len(monthly) >= 2:
            recent = monthly[-3:] if len(monthly) >= 3 else monthly
            weights = list(range(1, len(recent) + 1))
            weighted_sum = sum(m['total'] * w for m, w in zip(recent, weights))
            weight_total = sum(weights)
            projected = round(weighted_sum / weight_total, 2) if weight_total > 0 else 0
            if monthly_avg > 0:
                projected_change_pct = round((projected - monthly_avg) / monthly_avg * 100, 1)

        return envelope({
            'monthly': monthly,
            'total_6m': total_6m,
            'monthly_avg': round(monthly_avg, 2),
            'projected_next': projected,
            'projected_change_pct': projected_change_pct,
            'currency': 'VND',
        })
