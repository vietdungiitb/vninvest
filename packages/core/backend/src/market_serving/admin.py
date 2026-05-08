from django.contrib import admin

from .models import SessionFacts, SymbolSnapshot


@admin.register(SymbolSnapshot)
class SymbolSnapshotAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'price', 'price_change_pct', 'volume', 'market_status', 'source', 'stale', 'fetched_at')
    list_filter = ('market_status', 'source', 'stale', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('fetched_at',)
    ordering = ('-session_date', 'symbol')


@admin.register(SessionFacts)
class SessionFactsAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'cvd_normalized', 'buy_strength', 'institutional_strength', 'whale_net_flow', 'stale', 'computed_at')
    list_filter = ('stale', 'session_date')
    search_fields = ('symbol',)
    readonly_fields = ('computed_at',)
    ordering = ('-session_date', 'symbol')
