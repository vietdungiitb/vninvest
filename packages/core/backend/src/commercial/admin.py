from django.contrib import admin

from .models import Invoice, QuotaRecord, Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'plan', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end')
    list_filter = ('status', 'plan')
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(QuotaRecord)
class QuotaRecordAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'period_start', 'period_end', 'api_calls_used', 'api_calls_limit', 'symbols_used', 'updated_at')
    list_filter = ('period_start',)
    search_fields = ('tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('updated_at',)
    ordering = ('-period_start',)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'tenant', 'status', 'amount_due', 'currency', 'period_start', 'period_end', 'paid_at')
    list_filter = ('status', 'currency')
    search_fields = ('invoice_number', 'tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
