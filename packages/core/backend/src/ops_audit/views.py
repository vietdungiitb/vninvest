from rest_framework import generics, permissions

from vninvest_core.pagination import AuditCursorPagination

from .models import AuditEvent


class AuditLogListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AuditCursorPagination

    def get_queryset(self):
        qs = AuditEvent.objects.all().order_by('-occurred_at')
        tenant_id = getattr(getattr(self.request.user, 'core_tenant', None), 'public_id', None)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        return qs

    def get_serializer_class(self):
        from .serializers import AuditEventSerializer
        return AuditEventSerializer
