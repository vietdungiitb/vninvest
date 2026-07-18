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
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission


def _forecast_meter(tenant, meter_code, lookback_days=30):
    """Calculate forecast for a single meter code."""
    from commercial.models import QuotaHistory

    # Get the latest history record for this tenant and meter_code to act as current meter status
    latest_record = QuotaHistory.objects.filter(
        tenant=tenant, meter_code=meter_code
    ).order_by('-date').first()

    if not latest_record:
        # Fallback default entitlements if no history exists yet
        entitled = 5000 if meter_code == 'api_calls' else 100
        consumed = 0
    else:
        entitled = latest_record.entitled_amount
        consumed = latest_record.consumed_amount

    # Get historical daily consumption
    end_date = date.today()
    start_date = end_date - timedelta(days=lookback_days - 1)

    records = QuotaHistory.objects.filter(
        tenant=tenant,
        meter_code=meter_code,
        date__gte=start_date,
        date__lte=end_date,
    ).order_by('date')

    daily_rates = list(records.values_list('consumed_amount', flat=True))
    valid_days = [r for r in daily_rates if r > 0]

    if len(valid_days) < 3:
        return {
            'meter_code': meter_code,
            'daily_rate': None,
            'days_remaining': None,
            'forecast_exhaust_date': None,
            'confidence': 'insufficient_data',
            'total_entitled': entitled,
            'total_consumed': consumed,
            'remaining': max(0, entitled - consumed),
        }

    avg_daily = sum(valid_days) / len(valid_days)
    remaining = max(0, entitled - consumed)

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
        'total_entitled': entitled,
        'total_consumed': consumed,
        'remaining': remaining,
        'lookback_days': lookback_days,
        'valid_data_points': len(valid_days),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_forecast(request):
    require_human_session(request)
    _require_tenant_permission(request, 'forecast:write')
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
    meters = ['api_calls', 'ai_regenerate', 'whale_symbols', 'exports']

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
    _require_tenant_permission(request, 'forecast:write')
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
    from commercial.models import QuotaHistory
    end_date = date.today()
    start_date = end_date - timedelta(days=lookback_days - 1)

    daily_records = QuotaHistory.objects.filter(
        tenant=tenant,
        meter_code=meter_code,
        date__gte=start_date,
        date__lte=end_date,
    ).order_by('date').values('date', 'consumed_amount')

    forecast['historical'] = [
        {'date': r['date'].isoformat(), 'consumed': r['consumed_amount']}
        for r in daily_records
    ]

    return Response(forecast)
