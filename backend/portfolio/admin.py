from django.contrib import admin
from .models import Portfolio, SubAccount, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, TrackedSymbol, StockProfile, ScreenerRule

# Đăng ký StockProfile vào admin
@admin.register(StockProfile)
class StockProfileAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'company_name', 'industry', 'exchange', 'is_active', 'updated_at')
    list_filter = ('exchange', 'industry', 'is_active')
    search_fields = ('symbol', 'company_name', 'industry')
    ordering = ('symbol',)
    readonly_fields = ('updated_at',)

# Đăng ký ScreenerRule nếu muốn quản lý bộ lọc động
@admin.register(ScreenerRule)
class ScreenerRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active', 'user')
    search_fields = ('name', 'user__username')
    ordering = ('-created_at',)


class TransactionInline(admin.TabularInline):
    """Hiển thị danh sách giao dịch ngay trong trang chi tiết SubAccount."""
    model = Transaction
    extra = 1
    fields = ('symbol', 'transaction_type', 'date', 'price', 'quantity', 'fee', 'notes')
    ordering = ('-date',)
    fk_name = 'sub_account'


@admin.register(SubAccount)
class SubAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'portfolio', 'type', 'margin_ratio', 'created_at')
    list_filter = ('type', 'portfolio')
    search_fields = ('name',)
    inlines = [TransactionInline]

@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'subaccount_count')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')
    inlines = []

    @admin.display(description='Số tiểu khoản')
    def subaccount_count(self, obj):
        return obj.sub_accounts.count()


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'symbol', 'transaction_type', 'date',
        'price', 'quantity', 'fee', 'total_value_display', 'sub_account',
    )
    list_filter = ('transaction_type', 'sub_account', 'symbol')
    search_fields = ('symbol', 'sub_account__name', 'sub_account__portfolio__name')
    ordering = ('-date',)
    date_hierarchy = 'date'

    @admin.display(description='Giá trị lệnh (VNĐ)')
    def total_value_display(self, obj):
        return f'{obj.total_value:,.0f}'


@admin.register(DailyPrice)
class DailyPriceAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')
    list_filter = ('symbol',)
    search_fields = ('symbol',)
    ordering = ('-date', 'symbol')
    date_hierarchy = 'date'
    readonly_fields = ('created_at',)


class SecuritiesItemInline(admin.TabularInline):
    model = SecuritiesItem
    verbose_name = 'Mã theo dõi'
    verbose_name_plural = 'Mã theo dõi'
    extra = 3
    fields = ('symbol', 'order')


@admin.register(SecuritiesGroup)
class SecuritiesGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'group_type', 'user', 'item_count', 'order', 'color')
    list_filter = ('group_type', 'user')
    search_fields = ('name',)
    inlines = [SecuritiesItemInline]

    @admin.display(description='Số mã')
    def item_count(self, obj):
        return obj.items.count()


@admin.register(SecuritiesItem)
class SecuritiesItemAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'group', 'order', 'added_at')
    list_filter = ('group',)
    search_fields = ('symbol',)


@admin.register(TrackedSymbol)
class TrackedSymbolAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'user', 'source_group', 'added_at')
    list_filter = ('user', 'source_group')
    search_fields = ('symbol', 'user__username')
    ordering = ('-added_at',)
