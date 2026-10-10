from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
    decimal_vi,
    money_vi,
)

from .models import Invoice, QuotaRecord, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'plan', 'status_badge', 'current_period_start',
                    'current_period_end', 'cancel_at_period_end')
    list_filter = ('status', 'plan', 'cancel_at_period_end')
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    # AC S3-AC7: `tenant` nằm trong `list_display` ⇒ phải `select_related` để
    # không N+1 khi duyệt danh sách.
    list_select_related = ('tenant',)
    date_hierarchy = 'current_period_start'
    ordering = ('-created_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(QuotaRecord)
class QuotaRecordAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'period_start', 'period_end',
                    'api_calls_used_display', 'api_calls_limit_display', 'symbols_used')
    list_filter = ('period_start',)
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('updated_at',)
    list_select_related = ('tenant',)
    date_hierarchy = 'period_start'
    ordering = ('-period_start',)

    @admin.display(description='Lời gọi đã dùng')
    def api_calls_used_display(self, obj):
        return decimal_vi(obj.api_calls_used, decimals=0)

    @admin.display(description='Hạn mức lời gọi')
    def api_calls_limit_display(self, obj):
        return decimal_vi(obj.api_calls_limit, decimals=0)


@admin.register(Invoice)
class InvoiceAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('invoice_number', 'tenant', 'status_badge',
                    'amount_due_display', 'period_start', 'due_date', 'paid_at')
    list_filter = ('status', 'currency')
    search_fields = ('invoice_number', 'tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('tenant',)
    date_hierarchy = 'period_start'
    ordering = ('-created_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Số tiền còn nợ', ordering='amount_due')
    def amount_due_display(self, obj):
        # AC S3-AC4: `199.000 ₫` — ký hiệu TRƯỚC, dấu chấm phân tách hàng nghìn.
        # Số dương ẩn phần dư cho VND (đơn vị không có phần thập phân).
        return money_vi(obj.amount_due, obj.currency or 'VND')
