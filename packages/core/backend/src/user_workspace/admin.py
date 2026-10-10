from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, decimal_vi

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
class PortfolioAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'user', 'is_default', 'transaction_count', 'created_at')
    list_filter = ('is_default',)
    search_fields = ('name', 'user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('user',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    inlines = [TransactionInline]

    @admin.display(description='Số giao dịch')
    def transaction_count(self, obj):
        # Chỉ đếm khi mở trang chi tiết một danh mục — không thêm truy vấn vào
        # changelist (nếu không, mỗi dòng sẽ thêm 1 truy vấn ⇒ N+1).
        return decimal_vi(getattr(obj, 'transaction_count', None), decimals=0)


@admin.register(Transaction)
class TransactionAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'transaction_type', 'date', 'quantity', 'price_display', 'fee_display', 'portfolio')
    list_filter = ('transaction_type', 'date')
    search_fields = ('symbol', 'portfolio__name', 'portfolio__user__username')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('portfolio',)
    date_hierarchy = 'date'
    ordering = ('-date', '-pk')

    @admin.display(description='Giá')
    def price_display(self, obj):
        return decimal_vi(obj.price)

    @admin.display(description='Phí')
    def fee_display(self, obj):
        return decimal_vi(obj.fee)


@admin.register(Watchlist)
class WatchlistAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'user', 'is_default', 'item_count')
    list_filter = ('is_default',)
    search_fields = ('name', 'user__username', 'user__email')
    list_select_related = ('user',)
    ordering = ('user', 'name')
    date_hierarchy = 'created_at'
    inlines = [WatchlistItemInline]

    @admin.display(description='Số mã')
    def item_count(self, obj):
        return decimal_vi(getattr(obj, 'item_count', None), decimals=0)


@admin.register(WatchlistItem)
class WatchlistItemAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'watchlist', 'added_at')
    search_fields = ('symbol', 'watchlist__name', 'watchlist__user__username')
    list_select_related = ('watchlist',)
    ordering = ('-added_at',)
    date_hierarchy = 'added_at'
