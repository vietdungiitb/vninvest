from django.contrib import admin

from tenant_lifecycle.models import TenantLifecycleEvent


@admin.register(TenantLifecycleEvent)
class TenantLifecycleEventAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'event_type', 'actor_type', 'actor_user', 'created_at')
    list_filter = ('event_type', 'actor_type', 'created_at')
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = (
        'tenant',
        'event_type',
        'actor_type',
        'actor_user',
        'old_value',
        'new_value',
        'ip_address',
        'metadata',
        'created_at',
    )
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
