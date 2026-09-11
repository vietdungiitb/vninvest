"""
Analytics views for partner billing cost trends.
"""
import logging
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, Count
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.response import Response

from identity_access.models import CoreTenant, CoreServiceAccount
from identity_access.permissions import IsTenantActive, require_pat_scopes_or_human_session

logger = logging.getLogger(__name__)

TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]


def _get_tenant(user):
    return CoreTenant.objects.get(owner_user=user)


class PartnerCostTrendView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/billing/cost-trend/?months=6

    Returns monthly cost breakdown for the last N months.
    Uses Invoice model (status='paid') grouped by month.
    Falls back gracefully if insufficient data.
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')

        try:
            from commercial.models import Invoice
        except ImportError:
            return Response({'monthly': [], 'note': 'commercial app not available'})

        tenant = _get_tenant(request.user)
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

        return Response({
            'monthly': monthly,
            'total_6m': total_6m,
            'monthly_avg': round(monthly_avg, 2),
            'projected_next': projected,
            'projected_change_pct': projected_change_pct,
            'currency': 'VND',
        })
