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
class AdDailySummaryAdmin(VNReadOnlyMixin, admin.ModelAdmin):
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
class AdImpressionLogAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'ip_address', 'created_at')
    list_filter = ('created_at', 'campaign')
    search_fields = ('campaign__name', 'ip_address', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'ip_address', 'user_agent', 'created_at')
    list_select_related = ('campaign', 'tenant')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(AdClickLog)
class AdClickLogAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('campaign', 'tenant', 'symbol', 'ip_address', 'created_at')
    list_filter = ('created_at', 'campaign')
    search_fields = ('campaign__name', 'ip_address', 'symbol')
    readonly_fields = ('campaign', 'tenant', 'symbol', 'ip_address', 'user_agent', 'created_at')
    list_select_related = ('campaign', 'tenant')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

# --- Import cho khoi WAVE 16 -------------------------------------
from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
)

from .models import (
    TrademarkConfig,
)


def _ws_badge(value, mapping=None):
    """Badge có chữ theo bảng màu riêng của nhóm.

    Tách riêng thay vì dùng thẳng `badge_for(..., color=...)` để chỗ gọi
    được đọc là "trạng thái này tô màu này" thay vì lặp lại chuỗi màu.
    """
    if value in (None, ""):
        return "—"
    return badge_for(value, color=(mapping or {}).get(str(value), "blue"))

@admin.register(TrademarkConfig)
class TrademarkConfigAdmin(VNAdminMixin, admin.ModelAdmin):
    """Cấu hình bật/tắt watermark nhãn hiệu — bảng 1 dòng, sửa tay được."""

    list_display = ('enabled', 'version', 'activation_ts', 'updated_at')
    list_filter = ('enabled',)
    readonly_fields = ('updated_at',)
    ordering = ('-updated_at',)

def has_add_permission(self, request):
        # Bang singleton: them dong thu hai chi tao roi du lieu.
        return not TrademarkConfig.objects.exists()
