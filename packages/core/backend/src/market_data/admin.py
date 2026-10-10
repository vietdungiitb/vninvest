from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    badge,
    badge_for,
    decimal_vi,
    percent_vi,
)

from .models import DailyPrice, StockProfile, VnbrokerRuntimeConfig


@admin.register(StockProfile)
class StockProfileAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'company_name', 'exchange', 'industry', 'status_badge', 'outstanding_shares_display', 'updated_at')
    list_filter = ('exchange', 'status')
    search_fields = ('symbol', 'company_name', 'industry')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('symbol',)
    date_hierarchy = 'created_at'

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Số cổ phiếu lưu hành')
    def outstanding_shares_display(self, obj):
        return decimal_vi(obj.outstanding_shares, decimals=0)


@admin.register(DailyPrice)
class DailyPriceAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'date', 'open', 'high', 'low', 'close', 'volume', 'change_badge', 'source', 'is_adjusted')
    list_filter = ('source', 'is_adjusted', 'date')
    search_fields = ('symbol',)
    readonly_fields = ('created_at',)
    date_hierarchy = 'date'
    ordering = ('-date', 'symbol')

    @admin.display(description='Thay đổi %', ordering='change_pct')
    def change_badge(self, obj):
        # L-F08: chuẩn Bloomberg — tăng XANH, giảm ĐỎ.
        if obj.change_pct is None:
            return ''
        tone = 'gain' if obj.change_pct > 0 else ('loss' if obj.change_pct < 0 else 'neutral')
        return badge(percent_vi(obj.change_pct), tone)


@admin.register(VnbrokerRuntimeConfig)
class VnbrokerRuntimeConfigAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'is_active', 'data_source', 'max_workers', 'request_delay_ms', 'max_retries', 'batch_size', 'updated_at')
    list_filter = ('is_active', 'data_source')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-is_active', 'name')
    date_hierarchy = 'created_at'
