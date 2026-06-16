from rest_framework import generics, permissions

from identity_access.permissions import IsCoreOperator, IsTenantActive
from vninvest_core.pagination import CoreCursorPagination

from .models import AuditEvent
from .serializers import AuditEventSerializer, TenantLifecycleEventSerializer
from tenant_lifecycle.models import TenantLifecycleEvent


class AuditLogListView(generics.ListAPIView):
    # SFI-B6: Operator-only access for audit logs.
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]
    pagination_class = CoreCursorPagination

    def get_queryset(self):
        qs = AuditEvent.objects.all().order_by('-occurred_at')
        tenant_id = getattr(getattr(self.request.user, 'core_tenant', None), 'public_id', None)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        return qs

    def get_serializer_class(self):
        return AuditEventSerializer


class PartnerAuditLogsView(generics.ListAPIView):
    """
    Partner-facing audit logs API for tenant admins.
    
    GET /api/core/v1/partner/audit-logs/
    
    Returns TenantLifecycleEvent records for the authenticated tenant.
    Supports filtering by event_type, start_date, end_date.
    Uses CoreCursorPagination for performance with large datasets.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]
    pagination_class = CoreCursorPagination
    serializer_class = TenantLifecycleEventSerializer

    def get_queryset(self):
        # Get tenant from request (set by TenantResolutionMiddleware)
        tenant = getattr(self.request, 'tenant', None)
        if tenant is None:
            return TenantLifecycleEvent.objects.none()

        qs = TenantLifecycleEvent.objects.filter(tenant=tenant).order_by('-created_at')

        # Filter by event_type
        event_type = self.request.query_params.get('event_type')
        if event_type:
            qs = qs.filter(event_type=event_type)

        # Filter by start_date
        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)

        # Filter by end_date
        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        return qs