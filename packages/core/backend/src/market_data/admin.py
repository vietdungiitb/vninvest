from django.contrib import admin

from .models import DailyPrice, StockProfile, VnstockRuntimeConfig


@admin.register(StockProfile)
class StockProfileAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'company_name', 'exchange', 'industry', 'status', 'outstanding_shares', 'updated_at')
    list_filter = ('exchange', 'status')
    search_fields = ('symbol', 'company_name', 'industry')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('symbol',)


@admin.register(DailyPrice)
class DailyPriceAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'date', 'open', 'high', 'low', 'close', 'volume', 'change_pct', 'source', 'is_adjusted')
    list_filter = ('source', 'is_adjusted', 'date')
    search_fields = ('symbol',)
    readonly_fields = ('created_at',)
    ordering = ('-date', 'symbol')


@admin.register(VnstockRuntimeConfig)
class VnstockRuntimeConfigAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'data_source', 'max_workers', 'request_delay_ms', 'max_retries', 'batch_size', 'updated_at')
    list_filter = ('is_active', 'data_source')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-is_active', 'name')
