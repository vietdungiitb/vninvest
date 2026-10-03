from django.contrib import admin

from .models import Portfolio, Transaction, Watchlist, WatchlistItem


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    fields = ('symbol', 'transaction_type', 'date', 'quantity', 'price', 'fee')
    ordering = ('-date',)
    show_change_link = True


class WatchlistItemInline(admin.TabularInline):
    model = WatchlistItem
    extra = 0
    fields = ('symbol', 'note', 'added_at')
    readonly_fields = ('added_at',)
    ordering = ('-added_at',)


# ---------------------------------------------------------------------------
# ModelAdmin registrations
# ---------------------------------------------------------------------------

@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'is_default', 'created_at')
    list_filter = ('is_default',)
    search_fields = ('name', 'user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    inlines = [TransactionInline]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'transaction_type', 'date', 'quantity', 'price', 'fee', 'portfolio')
    list_filter = ('transaction_type', 'date')
    search_fields = ('symbol', 'portfolio__name', 'portfolio__user__username')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-date', '-pk')


@admin.register(Watchlist)
class WatchlistAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'is_default')
    list_filter = ('is_default',)
    search_fields = ('name', 'user__username', 'user__email')
    ordering = ('user', 'name')
    inlines = [WatchlistItemInline]


@admin.register(WatchlistItem)
class WatchlistItemAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'watchlist', 'added_at')
    search_fields = ('symbol', 'watchlist__name', 'watchlist__user__username')
    ordering = ('-added_at',)
