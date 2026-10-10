from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, VNReadOnlyMixin, badge_for, decimal_vi

from .models import AdCampaign, AdClickLog, AdDailySummary, AdImpressionLog


@admin.register(AdCampaign)
class AdCampaignAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'campaign_type', 'status_badge', 'weight', 'start_date', 'end_date', 'tenant')
    list_filter = ('campaign_type', 'status', 'tenant')
    search_fields = ('name', 'destination_url')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('tenant',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(AdDailySummary)
class AdDailySummaryAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'date', 'impressions_count', 'clicks_count', 'ctr_display')
    list_filter = ('date', 'symbol', 'tenant')
    search_fields = ('campaign__name', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'date', 'impressions_count', 'clicks_count')
    list_select_related = ('campaign', 'tenant')
    date_hierarchy = 'date'
    ordering = ('-date',)

    @admin.display(description='Tỉ lệ nhấp')
    def ctr_display(self, obj):
        impressions = obj.impressions_count or 0
        if not impressions:
            return ''
        return decimal_vi(obj.clicks_count * 100 / impressions, decimals=2) + '%'


@admin.register(AdImpressionLog)
class AdImpressionLogAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'ip_address', 'created_at')
    list_filter = ('created_at', 'campaign')
    search_fields = ('campaign__name', 'ip_address', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'ip_address', 'user_agent', 'created_at')
    list_select_related = ('campaign', 'tenant')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(AdClickLog)
class AdClickLogAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'ip_address', 'created_at')
    list_filter = ('created_at', 'campaign')
    search_fields = ('campaign__name', 'ip_address', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'ip_address', 'user_agent', 'created_at')
    list_select_related = ('campaign', 'tenant')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)
