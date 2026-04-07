"""
OpenCore Admin Registration

Register all OpenCore models với Django admin.
"""

from django.contrib import admin
from django.utils.html import format_html
from .opencore_dpi import (
    DPIPlan, DPILicense, DPIUsageMetrics, DPIEntitlement, DPIAuditLog
)
from .opencore_analytics import (
    DPIAPICallLog, DPIFeatureUsage, DPIQuotaTracker, DPIAnalyticsSnapshot
)
from .opencore_revenue import DPIInvoice, DPIRevenuePlan, DPISubscription, DPIPayment


@admin.register(DPIPlan)
class DPIPlanAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'display_name', 'annual_price_usd', 'max_api_calls_per_month', 'is_active'
    ]
    list_filter = ['is_active', 'name']
    search_fields = ['name', 'display_name']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Cơ bản', {
            'fields': ['name', 'display_name', 'description', 'is_active']
        }),
        ('Giá', {
            'fields': ['annual_price_usd', 'monthly_price_usd']
        }),
        ('Quota', {
            'fields': [
                'max_watchlist_items', 'max_portfolio_accounts',
                'max_alerts', 'max_api_calls_per_month'
            ]
        }),
        ('Features', {
            'fields': ['features']
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse']
        }),
    )


@admin.register(DPILicense)
class DPILicenseAdmin(admin.ModelAdmin):
    list_display = [
        'user', 'plan', 'status_badge', 'billing_cycle', 'days_until_expiry'
    ]
    list_filter = ['status', 'plan', 'billing_cycle', 'expiry_date']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at', 'is_valid']
    date_hierarchy = 'expiry_date'
    fieldsets = (
        ('Người dùng & Plan', {
            'fields': ['user', 'plan']
        }),
        ('Trạng thái', {
            'fields': ['status', 'is_valid', 'is_in_grace']
        }),
        ('Dates', {
            'fields': ['start_date', 'expiry_date', 'renewal_date', 'grace_until']
        }),
        ('Billing', {
            'fields': ['billing_cycle', 'payment_method', 'invoice_number']
        }),
        ('API Usage', {
            'fields': ['api_calls_this_month', 'last_api_call'],
            'classes': ['collapse']
        }),
        ('Timestamps', {
            'fields': ['created_at', 'updated_at'],
            'classes': ['collapse']
        }),
    )
    
    def status_badge(self, obj):
        colors = {
            'active': 'green',
            'trial': 'blue',
            'grace': 'orange',
            'suspended': 'red',
            'expired': 'gray',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(DPIUsageMetrics)
class DPIUsageMetricsAdmin(admin.ModelAdmin):
    list_display = ['license', 'api_calls_year_to_date', 'active_alerts', 'ai_advisory_queries']
    list_filter = ['license__plan']
    search_fields = ['license__user__username']
    readonly_fields = ['last_reset', 'last_updated']


@admin.register(DPIEntitlement)
class DPIEntitlementAdmin(admin.ModelAdmin):
    list_display = ['license', 'feature_key', 'feature_name', 'is_active', 'used_this_month']
    list_filter = ['is_active', 'feature_key', 'license__plan']
    search_fields = ['license__user__username', 'feature_key', 'feature_name']
    readonly_fields = ['granted_at']


@admin.register(DPIAuditLog)
class DPIAuditLogAdmin(admin.ModelAdmin):
    list_display = ['license', 'action', 'created_by', 'created_at']
    list_filter = ['action', 'created_at']
    search_fields = ['license__user__username', 'created_by']
    readonly_fields = ['created_at', 'details']
    date_hierarchy = 'created_at'


@admin.register(DPIAPICallLog)
class DPIAPICallLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'endpoint', 'method', 'response_status', 'response_time_ms', 'created_at']
    list_filter = ['method', 'response_status', 'feature_used', 'created_at']
    search_fields = ['user__username', 'endpoint']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'


@admin.register(DPIFeatureUsage)
class DPIFeatureUsageAdmin(admin.ModelAdmin):
    list_display = ['user', 'feature_name', 'usage_count', 'last_used', 'avg_response_time_ms']
    list_filter = ['feature_key', 'last_used']
    search_fields = ['user__username', 'feature_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(DPIQuotaTracker)
class DPIQuotaTrackerAdmin(admin.ModelAdmin):
    list_display = ['user', 'period_start', 'quota_percentage', 'is_exceeded']
    list_filter = ['is_exceeded', 'period_start']
    search_fields = ['user__username']
    readonly_fields = []
    
    def quota_percentage(self, obj):
        if obj.api_call_limit == 0:
            return '0%'
        percent = (obj.api_calls_used / obj.api_call_limit) * 100
        color = 'red' if percent > 90 else 'orange' if percent > 70 else 'green'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{:.1f}%</span>',
            color, percent
        )
    quota_percentage.short_description = 'Quota Usage'


@admin.register(DPIAnalyticsSnapshot)
class DPIAnalyticsSnapshotAdmin(admin.ModelAdmin):
    list_display = ['user', 'snapshot_date', 'api_calls_today', 'features_used', 'cache_hit_rate']
    list_filter = ['snapshot_date']
    search_fields = ['user__username']
    readonly_fields = ['created_at']
    date_hierarchy = 'snapshot_date'


@admin.register(DPIRevenuePlan)
class DPIRevenuePlanAdmin(admin.ModelAdmin):
    list_display = ['plan', 'annual_price_usd', 'per_api_call_cost', 'included_api_calls']
    fieldsets = (
        ('Plan', {'fields': ['plan']}),
        ('Subscription Pricing', {
            'fields': ['annual_price_usd', 'monthly_price_usd']
        }),
        ('Usage-based', {
            'fields': [
                'per_api_call_cost', 'per_team_member_cost',
                'included_api_calls', 'included_team_members'
            ]
        }),
        ('Volume Discounts', {
            'fields': ['discount_tiers']
        }),
    )


@admin.register(DPISubscription)
class DPISubscriptionAdmin(admin.ModelAdmin):
    list_display = ['user', 'plan', 'billing_cycle', 'renewal_date', 'is_active_display']
    list_filter = ['plan', 'billing_cycle', 'auto_renew']
    search_fields = ['user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    
    def is_active_display(self, obj):
        return format_html(
            '<span style="color: {};">{}</span>',
            'green' if obj.is_active() else 'red',
            'Active' if obj.is_active() else 'Inactive'
        )
    is_active_display.short_description = 'Status'


@admin.register(DPIInvoice)
class DPIInvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'user', 'status_badge', 'total_amount', 'issue_date']
    list_filter = ['status', 'issue_date', 'payment_method']
    search_fields = ['invoice_number', 'user__username', 'user__email']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'issue_date'
    
    def status_badge(self, obj):
        colors = {
            'draft': 'blue',
            'issued': 'gray',
            'paid': 'green',
            'overdue': 'red',
            'cancelled': 'black',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'


@admin.register(DPIPayment)
class DPIPaymentAdmin(admin.ModelAdmin):
    list_display = ['transaction_id', 'user', 'amount', 'status_badge', 'created_at']
    list_filter = ['status', 'provider', 'created_at']
    search_fields = ['transaction_id', 'user__username']
    readonly_fields = ['created_at', 'updated_at']
    date_hierarchy = 'created_at'
    
    def status_badge(self, obj):
        colors = {
            'pending': 'orange',
            'processing': 'blue',
            'completed': 'green',
            'failed': 'red',
            'refunded': 'gray',
        }
        color = colors.get(obj.status, 'gray')
        return format_html(
            '<span style="background-color: {}; color: white; padding: 3px 10px; border-radius: 3px;">{}</span>',
            color, obj.get_status_display()
        )
    status_badge.short_description = 'Status'
