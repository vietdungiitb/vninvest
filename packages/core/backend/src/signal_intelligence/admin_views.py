"""
SFI-B6: Admin views for signal_intelligence — operator-only endpoints.

These views provide admin-level access to signal configuration and runtime KPIs.
Protected by IsCoreOperator permission (is_staff or is_superuser required).
"""
from rest_framework import permissions, status
from rest_framework.views import APIView

from identity_access.permissions import IsCoreOperator

from .envelope import envelope
from .models import UnifiedAlert


class SignalAdminStatsView(APIView):
    """
    SFI-B6: GET /core/v1/admin/signal-stats/
    Returns signal feed statistics for operator dashboard.
    Requires IsCoreOperator.
    """
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]

    def get(self, request):
        from django.utils import timezone
        from datetime import timedelta

        cutoff = timezone.now() - timedelta(hours=24)
        total_alerts = UnifiedAlert.objects.filter(created_at__gte=cutoff).count()
        whale_alerts = UnifiedAlert.objects.filter(
            created_at__gte=cutoff,
            alert_type__icontains='whale',
        ).count()

        return envelope({
            'period': '24h',
            'total_alerts': total_alerts,
            'whale_alerts': whale_alerts,
            'other_alerts': total_alerts - whale_alerts,
        })


class SignalAdminFlushView(APIView):
    """
    SFI-B6: POST /core/v1/admin/signal-flush/
    Operator-only: triggers cache flush for signal feeds.
    """
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]

    def post(self, request):
        from django.core.cache import cache
        # Flush signal-related cache keys
        patterns = ['core:snapshot:*', 'core:session_facts:*', 'core:unified_alert:*']
        for pattern in patterns:
            try:
                cache.delete_pattern(pattern)
            except (AttributeError, Exception):  # noqa: BLE001
                # delete_pattern not available on all cache backends (e.g. LocMemCache)
                pass

        return envelope({'detail': 'Signal cache flush triggered.'}, status=status.HTTP_200_OK)
