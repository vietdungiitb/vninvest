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
