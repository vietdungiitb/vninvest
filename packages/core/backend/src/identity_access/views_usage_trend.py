"""
Per-Meter Usage Trend views for tenant-admin.

Provides historical daily consumption for specific meters (Phase 1 of Tenant Admin Upgrade Plan).
"""
from datetime import date, timedelta
from django.db.models import Sum

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from .envelope import envelope
from .models import CoreTenant
from .permissions import IsTenantActive, require_human_session
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_trend(request):
    """
    Get daily consumption history for a specific meter.
    
    Query params:
    - meter_code: required (api_calls, ai_regenerate, whale_symbols, exports)
    - days: 1-365 (default 30)
    """
    require_human_session(request)
    _require_tenant_permission(request, 'usage:read')
    tenant = _get_request_tenant(request)

    meter_code = request.GET.get('meter_code')
    if not meter_code:
        return Response(
            {'detail': 'meter_code is required'},
            status=400
        )

    valid_meters = ['api_calls', 'ai_regenerate', 'whale_symbols', 'exports']
    if meter_code not in valid_meters:
        return Response(
            {'detail': f'Invalid meter_code. Must be one of: {", ".join(valid_meters)}'},
            status=400
        )

    days = 30
    try:
        days = max(1, min(int(request.GET.get('days', 30)), 365))
    except (TypeError, ValueError):
        days = 30

    today = date.today()
    start = today - timedelta(days=days - 1)

    from commercial.models import QuotaHistory

    records = QuotaHistory.objects.filter(
        tenant=tenant,
        meter_code=meter_code,
        date__gte=start,
        date__lte=today,
    ).order_by('date')

    consumed_by_date = {r.date.isoformat(): r.consumed_amount for r in records}

    daily = []
    for offset in range(days):
        d = start + timedelta(days=offset)
        d_str = d.isoformat()
        daily.append({
            'date': d_str,
            'consumed': consumed_by_date.get(d_str, 0)
        })

    return envelope({
        'meter_code': meter_code,
        'daily': daily,
        'days': days,
        'start_date': start.isoformat(),
        'end_date': today.isoformat(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_trend_all(request):
    """
    Get daily consumption history for ALL meters.
    
    Query params:
    - days: 1-365 (default 30)
    """
    require_human_session(request)
    _require_tenant_permission(request, 'usage:read')
    tenant = _get_request_tenant(request)

    days = 30
    try:
        days = max(1, min(int(request.GET.get('days', 30)), 365))
    except (TypeError, ValueError):
        days = 30

    today = date.today()
    start = today - timedelta(days=days - 1)

    from commercial.models import QuotaHistory

    meters = ['api_calls', 'ai_regenerate', 'whale_symbols', 'exports']
    
    records = QuotaHistory.objects.filter(
        tenant=tenant,
        meter_code__in=meters,
        date__gte=start,
        date__lte=today,
    ).order_by('date')

    lookup = {}
    for r in records:
        lookup[(r.meter_code, r.date.isoformat())] = r.consumed_amount

    result = {}
    for meter_code in meters:
        daily = []
        for offset in range(days):
            d = start + timedelta(days=offset)
            d_str = d.isoformat()
            daily.append({
                'date': d_str,
                'consumed': lookup.get((meter_code, d_str), 0)
            })
        result[meter_code] = daily

    return envelope({
        'meters': result,
        'days': days,
        'start_date': start.isoformat(),
        'end_date': today.isoformat(),
    })
