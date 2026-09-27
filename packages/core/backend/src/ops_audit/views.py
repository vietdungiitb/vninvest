from rest_framework import generics, permissions

from identity_access.permissions import IsCoreOperator, IsTenantActive
from vninvest_core.pagination import CoreCursorPagination, AuditCursorPagination

from .models import AuditEvent
from .serializers import AuditEventSerializer, TenantLifecycleEventSerializer
from tenant_lifecycle.models import TenantLifecycleEvent


class AuditLogListView(generics.ListAPIView):
    # SFI-B6: Operator-only access for audit logs.
    permission_classes = [permissions.IsAuthenticated, IsCoreOperator]
    pagination_class = AuditCursorPagination

    def get_queryset(self):
        """Fail closed on tenant scoping.

        Was:
            qs = AuditEvent.objects.all().order_by('-occurred_at')
            tenant_id = getattr(getattr(self.request.user, 'core_tenant', None),
                                'public_id', None)
            if tenant_id:
                qs = qs.filter(tenant_id=tenant_id)

        `user.core_tenant` is the reverse side of the CoreTenant.owner_user
        OneToOne, so it is absent for any member-only account. A superuser or
        staff user with no OWNED tenant got tenant_id=None and therefore an
        UNFILTERED, cross-tenant list of every tenant's request log, IPs, actor
        usernames and request ids. The view also ignored `request.tenant`
        entirely, so a staff-switch session was scoped to the wrong tenant.

        Now: prefer the request-scoped tenant resolved by
        TenantResolutionMiddleware, fall back to the owned tenant, and return
        nothing at all when neither resolves.
        """
        qs = AuditEvent.objects.all().order_by('-occurred_at')

        tenant = getattr(self.request, 'tenant', None)
        if tenant is None:
            tenant = getattr(getattr(self.request, 'user', None), 'core_tenant', None)

        tenant_public_id = getattr(tenant, 'public_id', None)
        if not tenant_public_id:
            return qs.none()

        return qs.filter(tenant_id=str(tenant_public_id))

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