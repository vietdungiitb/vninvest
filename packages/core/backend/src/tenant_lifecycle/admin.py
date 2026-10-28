from django.contrib import admin

from vninvest_core.admin_ui import VNReadOnlyMixin

from tenant_lifecycle.models import TenantLifecycleEvent


@admin.register(TenantLifecycleEvent)
class TenantLifecycleEventAdmin(VNReadOnlyMixin, admin.ModelAdmin):
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
    list_select_related = ('tenant', 'actor_user')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)
