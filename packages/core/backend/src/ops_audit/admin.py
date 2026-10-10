from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, VNReadOnlyMixin, decimal_vi, datetime_vi

from .models import AuditEvent, RequestTrace


@admin.register(AuditEvent)
class AuditEventAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('action', 'resource_type', 'resource_id', 'actor_label', 'tenant_id', 'ip_address', 'occurred_at')
    list_filter = ('action', 'resource_type', 'occurred_at')
    search_fields = ('actor_label', 'resource_type', 'resource_id', 'tenant_id', 'request_id')
    readonly_fields = ('event_id', 'occurred_at')
    date_hierarchy = 'occurred_at'
    ordering = ('-occurred_at',)


@admin.register(RequestTrace)
class RequestTraceAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('method', 'path', 'status_code_badge', 'actor_user_id', 'tenant_id', 'duration_ms', 'traced_at')
    list_filter = ('method', 'status_code', 'traced_at')
    search_fields = ('path', 'request_id', 'tenant_id')
    readonly_fields = ('request_id', 'traced_at')
    date_hierarchy = 'traced_at'
    ordering = ('-traced_at',)

    @admin.display(description='Mã trạng thái', ordering='status_code')
    def status_code_badge(self, obj):
        # Nhóm theo vùng HTTP, không theo từng mã: 2xx khoẻ · 3xx chuyển hướng
        # · 4xx lỗi phía khách · 5xx lỗi phía hệ thống. Người vận hành cần phân
        # biệt 4xx/5xx trước khi đọc con số cụ thể.
        code = obj.status_code or 0
        if 200 <= code < 300:
            return badge(str(code), 'success')
        if 300 <= code < 400:
            return badge(str(code), 'neutral')
        if 400 <= code < 500:
            return badge(str(code), 'warning')
        if code >= 500:
            return badge(str(code), 'danger')
        return badge(str(code) if code else '\u2014', 'neutral')
