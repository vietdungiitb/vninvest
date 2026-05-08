from django.contrib import admin

from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical


class WhaleAlertCanonicalInline(admin.StackedInline):
    model = WhaleAlertCanonical
    extra = 0
    fields = ('side', 'price', 'volume', 'matched_value', 'is_dark_flow', 'executed_at')
    readonly_fields = ('executed_at',)
    can_delete = False


@admin.register(UnifiedAlert)
class UnifiedAlertAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'alert_type', 'severity', 'title', 'direction', 'session_date', 'triggered_at')
    list_filter = ('alert_type', 'severity', 'direction', 'session_date')
    search_fields = ('symbol', 'title', 'body')
    readonly_fields = ('alert_id', 'triggered_at')
    ordering = ('-triggered_at',)
    inlines = [WhaleAlertCanonicalInline]


@admin.register(WhaleAlertCanonical)
class WhaleAlertCanonicalAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'side', 'price', 'volume', 'matched_value', 'is_dark_flow', 'session_date', 'executed_at')
    list_filter = ('side', 'is_dark_flow', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('executed_at',)
    ordering = ('-executed_at',)


@admin.register(OrderFlowEvent)
class OrderFlowEventAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'signal_type', 'side', 'strength', 'whale_intensity', 'session_date')
    list_filter = ('signal_type', 'side', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('event_id',)
    ordering = ('-session_date', 'symbol')
