from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, badge_for, decimal_vi, percent_vi

from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical


class WhaleAlertCanonicalInline(admin.StackedInline):
    model = WhaleAlertCanonical
    extra = 0
    fields = ('side', 'price', 'volume', 'matched_value', 'is_dark_flow', 'executed_at')
    readonly_fields = ('executed_at',)
    can_delete = False


@admin.register(UnifiedAlert)
class UnifiedAlertAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'alert_type', 'severity_badge', 'title', 'direction', 'session_date', 'triggered_at')
    list_filter = ('alert_type', 'severity', 'direction', 'session_date')
    search_fields = ('symbol', 'title', 'body')
    readonly_fields = ('alert_id', 'triggered_at')
    date_hierarchy = 'triggered_at'
    ordering = ('-triggered_at',)
    inlines = [WhaleAlertCanonicalInline]

    @admin.display(description='Mức độ', ordering='severity')
    def severity_badge(self, obj):
        return badge_for(obj.severity)


@admin.register(WhaleAlertCanonical)
class WhaleAlertCanonicalAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'side', 'price', 'volume', 'matched_value', 'is_dark_flow', 'session_date', 'executed_at')
    list_filter = ('side', 'is_dark_flow', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('executed_at',)
    date_hierarchy = 'executed_at'
    ordering = ('-executed_at',)

    @admin.display(description='Giá trị khớp lệnh')
    def matched_value_display(self, obj):
        return decimal_vi(obj.matched_value, decimals=0)


@admin.register(OrderFlowEvent)
class OrderFlowEventAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'signal_type', 'side', 'strength', 'whale_intensity', 'session_date')
    list_filter = ('signal_type', 'side', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('event_id',)
    date_hierarchy = 'session_date'
    ordering = ('-session_date', 'symbol')

    @admin.display(description='Cường độ')
    def strength_display(self, obj):
        return percent_vi(obj.strength)

# --- Import cho khoi WAVE 16 -------------------------------------
from .models import (
    MarketAnomalyEvent,
    AdvisorySignalEvent,
    UserAlertDelivery,
    UserAlertPreference,
)
from vninvest_core.admin_ui import (
    badge_for,
    VNAdminMixin,
    VNReadOnlyMixin,
)
from django.contrib import messages


def _ws_badge(value, mapping=None):
    """Badge có chữ theo bảng màu riêng của nhóm.

    Tách riêng thay vì dùng thẳng `badge_for(..., color=...)` để chỗ gọi
    được đọc là "trạng thái này tô màu này" thay vì lặp lại chuỗi màu.
    """
    if value in (None, ""):
        return "—"
    return badge_for(value, color=(mapping or {}).get(str(value), "blue"))

# --- Sự kiện phát sinh: chỉ đọc, là dữ liệu đầu vào của thông báo ----------
@admin.register(MarketAnomalyEvent)
class MarketAnomalyEventAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Bất thường giá / báo giá cũ — chỉ đọc."""

    list_display = ('triggered_at', 'symbol', 'event_type', 'severity', 'confidence', 'direction', 'value', 'source_ref')
    list_filter = ('event_type', 'severity', 'direction', 'session_date')
    search_fields = ('symbol', 'source_ref')
    autocomplete_fields = ('unified_alert',)
    ordering = ('-triggered_at',)
    date_hierarchy = 'triggered_at'
    list_per_page = 100

    @admin.display(description='Mức', ordering='severity')
    def severity(self, obj):
        return _ws_badge(obj.severity, {
            'critical': 'red', 'high': 'yellow', 'medium': 'blue', 'low': 'gray',
        })


@admin.register(AdvisorySignalEvent)
class AdvisorySignalEventAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Tín hiệu khuyến nghị từ AI — chỉ đọc."""

    list_display = ('triggered_at', 'symbol', 'signal_type', 'severity', 'confidence', 'title', 'value')
    list_filter = ('signal_type', 'severity', 'session_date')
    search_fields = ('symbol', 'title', 'body', 'source_ref')
    autocomplete_fields = ('unified_alert',)
    ordering = ('-triggered_at',)
    date_hierarchy = 'triggered_at'
    list_per_page = 100

    @admin.display(description='Mức', ordering='severity')
    def severity(self, obj):
        return _ws_badge(obj.severity, {
            'critical': 'red', 'high': 'yellow', 'medium': 'blue', 'low': 'gray',
        })


# --- Giao diện người dùng với thông báo: sửa được --------------------------
@admin.register(UserAlertDelivery)
class UserAlertDeliveryAdmin(VNAdminMixin, admin.ModelAdmin):
    """Thông báo đã gửi tới từng user."""

    list_display = ('delivered_at', 'user', 'alert', 'delivery_state', 'seen_at', 'acknowledged_at', 'suppression_reason')
    list_filter = ('delivery_state', 'delivered_at')
    search_fields = ('user__username', 'user__email', 'alert__title', 'suppression_reason')
    autocomplete_fields = ('user', 'alert')
    ordering = ('-delivered_at',)
    date_hierarchy = 'delivered_at'
    readonly_fields = ('delivered_at', 'updated_at')
    list_per_page = 100

    @admin.display(description='Trạng thái', ordering='delivery_state')
    def delivery_state(self, obj):
        return _ws_badge(obj.delivery_state, {
            'new': 'blue', 'seen': 'yellow', 'acknowledged': 'green',
            'muted': 'gray', 'suppressed': 'red',
        })

    actions = ('acknowledge_selected',)

    @admin.action(description='Đánh dấu đã xem các thông báo đã chọn')
    def acknowledge_selected(self, request, queryset):
        from django.utils import timezone as _tz
        n = queryset.filter(delivery_state__in=('new', 'seen')).update(
            delivery_state='acknowledged', acknowledged_at=_tz.now(),
        )
        self.message_user(request, f'Đã đánh dấu {n} thông báo.', level=messages.SUCCESS)


@admin.register(UserAlertPreference)
class UserAlertPreferenceAdmin(VNAdminMixin, admin.ModelAdmin):
    """Tuỳ chọn tắt/giãn cách thông báo của user."""

    list_display = ('user', 'symbol', 'alert_family', 'mute_until', 'cooldown_seconds')
    list_filter = ('alert_family',)
    search_fields = ('user__username', 'user__email', 'symbol', 'alert_family')
    autocomplete_fields = ('user',)
    ordering = ('user__username', 'symbol')
    readonly_fields = ('created_at',)
