from django.contrib import admin
from .models import AdCampaign, AdDailySummary, AdImpressionLog, AdClickLog


@admin.register(AdCampaign)
class AdCampaignAdmin(admin.ModelAdmin):
    list_display = ('name', 'campaign_type', 'status', 'weight', 'start_date', 'end_date', 'tenant')
    list_filter = ('campaign_type', 'status', 'tenant')
    search_fields = ('name', 'destination_url')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(AdDailySummary)
class AdDailySummaryAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'date', 'impressions_count', 'clicks_count')
    list_filter = ('date', 'symbol', 'tenant')
    search_fields = ('campaign__name', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'date', 'impressions_count', 'clicks_count')
    ordering = ('-date',)

    def has_add_permission(self, request):
        return False


@admin.register(AdImpressionLog)
class AdImpressionLogAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'ip_address', 'created_at')
    list_filter = ('created_at', 'campaign')
    search_fields = ('campaign__name', 'ip_address', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'ip_address', 'user_agent', 'created_at')
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False


@admin.register(AdClickLog)
class AdClickLogAdmin(admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'ip_address', 'created_at')
    list_filter = ('created_at', 'campaign')
    search_fields = ('campaign__name', 'ip_address', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'ip_address', 'user_agent', 'created_at')
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False
