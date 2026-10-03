from django.contrib import admin

from .models import AuditEvent, RequestTrace


@admin.register(AuditEvent)
class AuditEventAdmin(admin.ModelAdmin):
    list_display = ('action', 'resource_type', 'resource_id', 'actor_label', 'tenant_id', 'ip_address', 'occurred_at')
    list_filter = ('action', 'resource_type', 'occurred_at')
    search_fields = ('actor_label', 'resource_type', 'resource_id', 'tenant_id', 'request_id')
    readonly_fields = ('event_id', 'occurred_at')
    ordering = ('-occurred_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(RequestTrace)
class RequestTraceAdmin(admin.ModelAdmin):
    list_display = ('method', 'path', 'status_code', 'actor_user_id', 'tenant_id', 'duration_ms', 'traced_at')
    list_filter = ('method', 'status_code', 'traced_at')
    search_fields = ('path', 'request_id', 'tenant_id')
    readonly_fields = ('request_id', 'traced_at')
    ordering = ('-traced_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
