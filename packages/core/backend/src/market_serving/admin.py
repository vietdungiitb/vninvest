from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, badge, decimal_vi, percent_vi

from .models import SessionFacts, SymbolSnapshot


@admin.register(SymbolSnapshot)
class SymbolSnapshotAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'price_display', 'price_change_badge',
                    'volume_display', 'market_status', 'source', 'stale', 'fetched_at')
    list_filter = ('market_status', 'source', 'stale', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('fetched_at',)
    date_hierarchy = 'session_date'
    ordering = ('-session_date', 'symbol')

    @admin.display(description='Giá')
    def price_display(self, obj):
        return decimal_vi(obj.price, decimals=0)

    @admin.display(description='Thay đổi %')
    def price_change_badge(self, obj):
        # L-F08: chuẩn Bloomberg — tăng là XANH, giảm là ĐỎ.
        if obj.price_change_pct is None:
            return ''
        tone = 'gain' if obj.price_change_pct > 0 else ('loss' if obj.price_change_pct < 0 else 'neutral')
        return badge(percent_vi(obj.price_change_pct), tone)

    @admin.display(description='Khối lượng')
    def volume_display(self, obj):
        return decimal_vi(obj.volume, decimals=0)


@admin.register(SessionFacts)
class SessionFactsAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'cvd_normalized', 'buy_strength',
                    'institutional_strength', 'whale_net_flow_badge', 'stale', 'computed_at')
    list_filter = ('stale', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('computed_at',)
    date_hierarchy = 'session_date'
    ordering = ('-session_date', 'symbol')

    @admin.display(description='Dòng tiền cá voi')
    def whale_net_flow_badge(self, obj):
        # L-F08: chuẩn Bloomberg — dương là XANH, âm là ĐỎ.
        if obj.whale_net_flow is None:
            return ''
        tone = 'gain' if obj.whale_net_flow > 0 else ('loss' if obj.whale_net_flow < 0 else 'neutral')
        return badge(decimal_vi(obj.whale_net_flow), tone)

# --- Import cho khoi WAVE 16 -------------------------------------
from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
)

from .models import (
    SessionFactsBucket,
)


def _ws_badge(value, mapping=None):
    """Badge có chữ theo bảng màu riêng của nhóm.

    Tách riêng thay vì dùng thẳng `badge_for(..., color=...)` để chỗ gọi
    được đọc là "trạng thái này tô màu này" thay vì lặp lại chuỗi màu.
    """
    if value in (None, ""):
        return "—"
    return badge_for(value, color=(mapping or {}).get(str(value), "blue"))

@admin.register(SessionFactsBucket)
class SessionFactsBucketAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Bucket số liệu theo phiên — sinh bởi pipeline, chỉ đọc."""

    list_display = ('session_date', 'window', 'symbol', 'bucket_ts', 'bucket_minutes', 'cumulative_cvd', 'buy_volume', 'sell_volume')
    list_filter = ('session_date', 'window', 'symbol')
    search_fields = ('symbol',)
    autocomplete_fields = ('session_facts',)
    ordering = ('-session_date', '-window', 'symbol', '-bucket_ts')
    date_hierarchy = 'session_date'
    list_per_page = 100
