"""
Usage Alert Configuration views for tenant-admin.

Provides CRUD for per-meter alert thresholds (Phase 1 of Tenant Admin Upgrade Plan).
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import CoreTenant, UsageAlertConfig
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


def _get_default_configs(tenant):
    """Ensure default alert configs exist for all meter codes."""
    default_meters = [
        ('api_calls', 80, 95),
        ('ai_regenerate', 80, 95),
        ('whale_symbols', 80, 95),
        ('exports', 80, 95),
    ]
    created = []
    for meter_code, warning, critical in default_meters:
        config, was_created = UsageAlertConfig.objects.get_or_create(
            tenant=tenant,
            meter_code=meter_code,
            defaults={
                'warning_pct': warning,
                'critical_pct': critical,
                'enabled': True,
                'notify_email': True,
            }
        )
        if was_created:
            created.append(config)
    return created


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_alert_config_list(request):
    require_human_session(request)
    tenant = _get_request_tenant(request)

    _get_default_configs(tenant)

    configs = UsageAlertConfig.objects.filter(tenant=tenant).order_by('meter_code')
    return Response({
        'configs': [
            {
                'meter_code': c.meter_code,
                'warning_pct': c.warning_pct,
                'critical_pct': c.critical_pct,
                'enabled': c.enabled,
                'notify_email': c.notify_email,
                'created_at': c.created_at.isoformat(),
                'updated_at': c.updated_at.isoformat(),
            }
            for c in configs
        ]
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_usage_alert_config_detail(request, meter_code):
    require_human_session(request)
    tenant = _get_request_tenant(request)

    try:
        config = UsageAlertConfig.objects.get(tenant=tenant, meter_code=meter_code)
    except UsageAlertConfig.DoesNotExist:
        from rest_framework.exceptions import NotFound
        raise NotFound('Alert configuration not found.')

    if request.method == 'GET':
        return Response({
            'meter_code': config.meter_code,
            'warning_pct': config.warning_pct,
            'critical_pct': config.critical_pct,
            'enabled': config.enabled,
            'notify_email': config.notify_email,
            'created_at': config.created_at.isoformat(),
            'updated_at': config.updated_at.isoformat(),
        })

    # PATCH - partial update
    data = request.data
    warning_pct = data.get('warning_pct')
    critical_pct = data.get('critical_pct')
    enabled = data.get('enabled')
    notify_email = data.get('notify_email')

    if warning_pct is not None:
        if not isinstance(warning_pct, int) or warning_pct < 1 or warning_pct > 99:
            return Response({'detail': 'warning_pct must be integer 1-99'}, status=status.HTTP_400_BAD_REQUEST)
        config.warning_pct = warning_pct

    if critical_pct is not None:
        if not isinstance(critical_pct, int) or critical_pct < 2 or critical_pct > 100:
            return Response({'detail': 'critical_pct must be integer 2-100'}, status=status.HTTP_400_BAD_REQUEST)
        config.critical_pct = critical_pct

    if enabled is not None:
        if not isinstance(enabled, bool):
            return Response({'detail': 'enabled must be boolean'}, status=status.HTTP_400_BAD_REQUEST)
        config.enabled = enabled

    if notify_email is not None:
        if not isinstance(notify_email, bool):
            return Response({'detail': 'notify_email must be boolean'}, status=status.HTTP_400_BAD_REQUEST)
        config.notify_email = notify_email

    # Validate warning < critical
    if config.warning_pct >= config.critical_pct:
        return Response(
            {'detail': 'warning_pct must be less than critical_pct'},
            status=status.HTTP_400_BAD_REQUEST
        )

    config.save(update_fields=['warning_pct', 'critical_pct', 'enabled', 'notify_email', 'updated_at'])

    return Response({
        'meter_code': config.meter_code,
        'warning_pct': config.warning_pct,
        'critical_pct': config.critical_pct,
        'enabled': config.enabled,
        'notify_email': config.notify_email,
        'created_at': config.created_at.isoformat(),
        'updated_at': config.updated_at.isoformat(),
    })
