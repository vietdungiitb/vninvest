"""
Usage Forecasting views for tenant-admin.

Provides projected exhaustion dates based on historical consumption (Phase 1/2 of Tenant Admin Upgrade Plan).
"""
from datetime import date, timedelta
from django.db.models import Avg, Sum
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from .models import CoreTenant
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


def _forecast_meter(tenant, meter_code, lookback_days=30):
    """Calculate forecast for a single meter code."""
    from commercial.models import QuotaRecord, UsageMeter

    # Get the meter for this tenant and meter_code
    try:
        meter = UsageMeter.objects.get(tenant=tenant, meter_code=meter_code)
    except UsageMeter.DoesNotExist:
        return None

    # Get historical daily consumption
    end_date = date.today()
    start_date = end_date - timedelta(days=lookback_days - 1)

    records = QuotaRecord.objects.filter(
        tenant=tenant,
        meter_code=meter_code,
        date__gte=start_date,
        date__lte=end_date,
    ).order_by('date')

    daily_rates = list(records.values_list('consumed', flat=True))
    valid_days = [r for r in daily_rates if r > 0]

    if len(valid_days) < 3:
        return {
            'meter_code': meter_code,
            'daily_rate': None,
            'days_remaining': None,
            'forecast_exhaust_date': None,
            'confidence': 'insufficient_data',
            'total_entitled': meter.entitled_amount,
            'total_consumed': meter.consumed_amount,
            'remaining': meter.entitled_amount - meter.consumed_amount,
        }

    avg_daily = sum(valid_days) / len(valid_days)
    remaining = max(0, meter.entitled_amount - meter.consumed_amount)

    if avg_daily <= 0:
        days_remaining = None
        forecast_date = None
    else:
        days_remaining = int(remaining / avg_daily)
        forecast_date = (date.today() + timedelta(days=days_remaining)).isoformat()

    # Confidence based on data points
    if len(valid_days) >= 21:
        confidence = 'high'
    elif len(valid_days) >= 14:
        confidence = 'medium'
    else:
        confidence = 'low'

    return {
        'meter_code': meter_code,
        'daily_rate': round(avg_daily, 1),
        'days_remaining': days_remaining,
        'forecast_exhaust_date': forecast_date,
        'confidence': confidence,
        'total_entitled': meter.entitled_amount,
        'total_consumed': meter.consumed_amount,
        'remaining': remaining,
        'lookback_days': lookback_days,
        'valid_data_points': len(valid_days),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_forecast(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)

    meter_code = request.GET.get('meter_code')
    lookback_days = 30
    try:
        lookback_days = max(7, min(int(request.GET.get('lookback', 30)), 90))
    except (TypeError, ValueError):
        pass

    if meter_code:
        # Single meter forecast
        forecast = _forecast_meter(tenant, meter_code, lookback_days)
        if forecast is None:
            raise NotFound(f'Meter {meter_code} not found for this tenant.')
        return Response(forecast)

    # All meters forecast
    from commercial.models import UsageMeter
    meters = UsageMeter.objects.filter(tenant=tenant).values_list('meter_code', flat=True)

    forecasts = []
    for mc in meters:
        f = _forecast_meter(tenant, mc, lookback_days)
        if f:
            forecasts.append(f)

    return Response({
        'forecasts': forecasts,
        'lookback_days': lookback_days,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_forecast_detail(request, meter_code):
    """Get detailed forecast for a specific meter."""
    require_human_session(request)
    tenant = _get_request_tenant(request)

    lookback_days = 30
    try:
        lookback_days = max(7, min(int(request.GET.get('lookback', 30)), 90))
    except (TypeError, ValueError):
        pass

    forecast = _forecast_meter(tenant, meter_code, lookback_days)
    if forecast is None:
        raise NotFound(f'Meter {meter_code} not found for this tenant.')

    # Add historical daily data for charting
    from commercial.models import QuotaRecord
    end_date = date.today()
    start_date = end_date - timedelta(days=lookback_days - 1)

    daily_records = QuotaRecord.objects.filter(
        tenant=tenant,
        meter_code=meter_code,
        date__gte=start_date,
        date__lte=end_date,
    ).order_by('date').values('date', 'consumed')

    forecast['historical'] = [
        {'date': r['date'].isoformat(), 'consumed': r['consumed']}
        for r in daily_records
    ]

    return Response(forecast)
