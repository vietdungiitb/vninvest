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

# --- Import cho khoi WAVE 16 -------------------------------------
from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
)

from .models import (
    GlobalSymbolCoverage,
    GlobalSymbolDemandSource,
    GlobalSymbolRegistry,
    IntradayBar,
    IntradayTick,
)


def _ws_badge(value, mapping=None):
    """Badge có chữ theo bảng màu riêng của nhóm.

    Tách riêng thay vì dùng thẳng `badge_for(..., color=...)` để chỗ gọi
    được đọc là "trạng thái này tô màu này" thay vì lặp lại chuỗi màu.
    """
    if value in (None, ""):
        return "—"
    return badge_for(value, color=(mapping or {}).get(str(value), "blue"))

# --- Dữ liệu giá nội bộ: khối lượng lớn, chỉ đọc, không cho sửa tay -----------
@admin.register(IntradayBar)
class IntradayBarAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Nến trong ngày — sinh bởi pipeline nạp dữ liệu, không sửa tay."""

    list_display = ('datetime', 'symbol', 'timeframe', 'open', 'high', 'low', 'close', 'volume', 'source')
    list_filter = ('timeframe', 'source', 'datetime')
    search_fields = ('symbol', 'source')
    ordering = ('-datetime',)
    date_hierarchy = 'datetime'
    list_per_page = 100


@admin.register(IntradayTick)
class IntradayTickAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Tick giao dịch trong ngày — chỉ đọc."""

    list_display = ('timestamp', 'symbol', 'price', 'volume', 'side', 'match_type', 'source')
    list_filter = ('side', 'source', 'timestamp')
    search_fields = ('symbol', 'source')
    ordering = ('-timestamp',)
    date_hierarchy = 'timestamp'
    list_per_page = 100


# --- Registry & độ phủ dữ liệu: điều khiển được (quyết định có nạp không) ---
@admin.register(GlobalSymbolRegistry)
class GlobalSymbolRegistryAdmin(VNAdminMixin, admin.ModelAdmin):
    """Danh bạ mã toàn cục + hạng ưu tiên nạp dữ liệu.

    Đây là bảng điều khiển: đổi `current_priority_tier` quyết định mã có được
    ưu tiên tải không. Cho sửa — đây là thứ vận hành cần chỉnh tay.
    """

    list_display = ('symbol', 'is_active', 'current_priority_tier', 'priority_score', 'demand_source_count', 'last_demand_at', 'latest_trade_date')
    list_filter = ('is_active', 'current_priority_tier')
    search_fields = ('symbol',)
    ordering = ('symbol',)
    readonly_fields = ('created_at', 'updated_at')

    @admin.display(description='Ưu tiên', ordering='current_priority_tier')
    def current_priority_tier(self, obj):
        return _ws_badge(obj.current_priority_tier, {
            'hot': 'red', 'warm': 'yellow', 'cold': 'blue', 'recovery': 'green',
        })


@admin.register(GlobalSymbolDemandSource)
class GlobalSymbolDemandSourceAdmin(VNAdminMixin, admin.ModelAdmin):
    """Ai đang yêu cầu mã này (watchlist, giữ chứng khoán, nhóm admin…)."""

    list_display = ('registry', 'source_type', 'source_ref', 'tenant', 'user', 'is_active', 'weight', 'activated_at')
    list_filter = ('source_type', 'is_active', 'tenant')
    search_fields = ('registry__symbol', 'source_ref', 'user__username')
    autocomplete_fields = ('registry', 'tenant', 'user')
    ordering = ('registry__symbol', 'source_type')


@admin.register(GlobalSymbolCoverage)
class GlobalSymbolCoverageAdmin(VNAdminMixin, admin.ModelAdmin):
    """Tình trạng phủ dữ liệu của từng mã theo từng bộ dữ liệu."""

    list_display = ('registry', 'dataset', 'freshness_state', 'latest_available_at', 'gap_score', 'gap_days', 'next_recommended_action')
    list_filter = ('dataset', 'freshness_state')
    search_fields = ('registry__symbol', 'next_recommended_action', 'priority_reason')
    autocomplete_fields = ('registry',)
    ordering = ('registry__symbol', 'dataset')

    @admin.display(description='Tình trạng', ordering='freshness_state')
    def freshness_state(self, obj):
        return _ws_badge(obj.freshness_state, {
            'fresh': 'green', 'warm': 'yellow', 'stale': 'red',
            'missing': 'red', 'error': 'red', 'unknown': 'gray',
        })
