from django.contrib import admin
from django.contrib import messages
from django.contrib.auth.models import User
from django.db.models import Max
from django.http import HttpResponseRedirect
from django.shortcuts import redirect
from django.urls import path, reverse
from django.utils import timezone
import pandas as pd

from .models import (
    AccountSnapshot,
    DailyPrice,
    MarketGroupSyncLog,
    Portfolio,
    PriceAlertRule,
    ScreenerRule,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    StockProfileSyncLog,
    SubAccount,
    TrackedSymbol,
    Transaction,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
)
from .services import sync_market_groups_for_user, sync_market_groups_for_users, sync_stock_profiles


admin.site.site_header = 'VNInvest - Trang quản trị hệ thống'
admin.site.site_title = 'VNInvest Admin'
admin.site.index_title = 'Sơ đồ chức năng hệ thống'


_original_each_context = admin.site.each_context
_original_get_app_list = admin.site.get_app_list
_original_admin_get_urls = admin.site.get_urls


def _push_market_group_sync_messages(request, result):
    if result.get('success'):
        messages.success(request, result.get('message', 'Đồng bộ nhóm thị trường thành công.'))
        if result.get('warning'):
            messages.warning(request, result['warning'])
    else:
        messages.error(request, result.get('error') or result.get('message') or 'Đồng bộ nhóm thị trường thất bại.')


def _push_stock_profile_sync_messages(request, result):
    if result.get('success'):
        messages.success(request, result.get('message', 'Đồng bộ hồ sơ mã chứng khoán thành công.'))
        if result.get('warning'):
            messages.warning(request, result['warning'])
    else:
        messages.error(request, result.get('error') or result.get('message') or 'Đồng bộ hồ sơ mã chứng khoán thất bại.')


def _admin_market_group_sync_view(request):
    if request.method != 'POST':
        return redirect('admin:index')

    mode = request.POST.get('mode', 'all')
    clear_existing = request.POST.get('clear_existing') in {'1', 'true', 'on'}
    username = (request.POST.get('username') or '').strip()
    next_url = request.POST.get('next') or reverse('admin:index')

    if username:
        try:
            target_user = User.objects.get(username=username)
        except User.DoesNotExist:
            messages.error(request, f'Không tìm thấy user "{username}" để đồng bộ nhóm thị trường.')
            return HttpResponseRedirect(next_url)

        result = sync_market_groups_for_user(
            target_user,
            requested_by=request.user,
            mode=mode,
            clear_existing=clear_existing,
        )
        _push_market_group_sync_messages(request, result)
        return HttpResponseRedirect(next_url)

    result = sync_market_groups_for_users(
        User.objects.filter(is_active=True).order_by('username'),
        requested_by=request.user,
        mode=mode,
        clear_existing=clear_existing,
    )
    _push_market_group_sync_messages(request, result)
    return HttpResponseRedirect(next_url)


def _admin_stock_profile_sync_view(request):
    if request.method != 'POST':
        return redirect('admin:index')

    mode = request.POST.get('mode', 'all')
    next_url = request.POST.get('next') or reverse('admin:index')
    result = sync_stock_profiles(requested_by=request.user, mode=mode)
    _push_stock_profile_sync_messages(request, result)
    return HttpResponseRedirect(next_url)


def _vninvest_admin_get_urls():
    return [
        path(
            'market-groups/sync/',
            admin.site.admin_view(_admin_market_group_sync_view),
            name='market-group-sync',
        ),
        path(
            'stock-profiles/sync/',
            admin.site.admin_view(_admin_stock_profile_sync_view),
            name='stock-profile-sync',
        ),
        *_original_admin_get_urls(),
    ]


def _duration_display(started_at, finished_at):
    if not started_at or not finished_at:
        return '—'
    delta = finished_at - started_at
    total_seconds = int(delta.total_seconds())
    minutes, seconds = divmod(max(total_seconds, 0), 60)
    if minutes:
        return f'{minutes}m {seconds}s'
    return f'{seconds}s'


def _vninvest_each_context(request):
    context = _original_each_context(request)
    today = timezone.localdate()
    allowed_windows = [30, 90, 180]
    try:
        selected_window = int(request.GET.get('window_days', 90))
    except (TypeError, ValueError):
        selected_window = 90
    if selected_window not in allowed_windows:
        selected_window = 90

    from_date = today - timezone.timedelta(days=selected_window)

    context['system_quick_stats'] = {
        'portfolio_count': Portfolio.objects.count(),
        'subaccount_count': SubAccount.objects.count(),
        'transaction_count': Transaction.objects.count(),
        'transaction_today_count': Transaction.objects.filter(date=today).count(),
        'tracked_symbol_count': TrackedSymbol.objects.count(),
        'stock_profile_count': StockProfile.objects.count(),
        'daily_price_count': DailyPrice.objects.count(),
    }

    tx_rows = list(
        Transaction.objects.filter(date__gte=from_date).values(
            'symbol',
            'transaction_type',
            'price',
            'quantity',
            'date',
        )
    )
    price_rows = list(
        DailyPrice.objects.values('symbol').annotate(latest_date=Max('date')).values(
            'symbol',
            'latest_date',
        )
    )

    insights = {
        'top_symbols': [],
        'type_breakdown': [],
        'freshness': {'fresh': 0, 'warning': 0, 'stale': 0},
        'window_days': selected_window,
        'window_options': allowed_windows,
    }

    if tx_rows:
        df_tx = pd.DataFrame(tx_rows)
        df_tx['price'] = pd.to_numeric(df_tx['price'])
        df_tx['quantity'] = pd.to_numeric(df_tx['quantity'])
        df_tx['turnover'] = df_tx['price'] * df_tx['quantity']

        top_symbols = (
            df_tx.groupby('symbol', as_index=False)['turnover']
            .sum()
            .sort_values('turnover', ascending=False)
            .head(5)
        )
        insights['top_symbols'] = [
            {
                'symbol': row['symbol'],
                'turnover': float(row['turnover']),
            }
            for _, row in top_symbols.iterrows()
        ]

        type_breakdown = (
            df_tx.groupby('transaction_type', as_index=False)['turnover']
            .sum()
            .sort_values('turnover', ascending=False)
        )
        insights['type_breakdown'] = [
            {
                'transaction_type': row['transaction_type'],
                'turnover': float(row['turnover']),
            }
            for _, row in type_breakdown.iterrows()
        ]

    if price_rows:
        df_price = pd.DataFrame(price_rows)
        df_price['latest_date'] = pd.to_datetime(df_price['latest_date'])
        df_price['lag_days'] = (pd.Timestamp(today) - df_price['latest_date']).dt.days

        insights['freshness'] = {
            'fresh': int((df_price['lag_days'] <= 3).sum()),
            'warning': int(((df_price['lag_days'] > 3) & (df_price['lag_days'] <= 7)).sum()),
            'stale': int((df_price['lag_days'] > 7).sum()),
        }

    context['pandas_insights'] = insights
    latest_market_sync = MarketGroupSyncLog.objects.select_related('target_user', 'requested_by').first()
    recent_market_sync_logs = list(
        MarketGroupSyncLog.objects
        .select_related('target_user', 'requested_by')
        .all()[:5]
    )
    latest_stock_profile_sync = StockProfileSyncLog.objects.select_related('requested_by').first()
    recent_stock_profile_sync_logs = list(
        StockProfileSyncLog.objects
        .select_related('requested_by')
        .all()[:5]
    )
    context['market_group_sync_status'] = {
        'latest': latest_market_sync,
        'recent_logs': recent_market_sync_logs,
        'total_group_count': SecuritiesGroup.objects.count(),
        'total_symbol_count': SecuritiesItem.objects.count(),
    }
    context['stock_profile_sync_status'] = {
        'latest': latest_stock_profile_sync,
        'recent_logs': recent_stock_profile_sync_logs,
        'duration': _duration_display(latest_stock_profile_sync.started_at, latest_stock_profile_sync.finished_at) if latest_stock_profile_sync else '—',
    }
    return context


def _vninvest_get_app_list(request, app_label=None):
    app_list = _original_get_app_list(request, app_label)
    portfolio_app = next((app for app in app_list if app.get('app_label') == 'portfolio'), None)
    menu_name_override = {
        'Portfolio': 'Danh mục đầu tư',
        'SubAccount': 'Tiểu khoản',
        'Transaction': 'Giao dịch',
        'AccountSnapshot': 'Snapshot NAV',
        'MarketGroupSyncLog': 'Log đồng bộ Nhóm thị trường',
        'StockProfileSyncLog': 'Log đồng bộ Hồ sơ mã chứng khoán',
        'SecuritiesGroup': 'Nhóm thị trường',
        'SecuritiesItem': 'Mã trong nhóm thị trường',
        'TrackedSymbol': 'Danh sách mã theo dõi tổng hợp',
        'PriceAlertRule': 'Cảnh báo giá',
        'WatchlistGroup': 'Danh sách theo dõi cá nhân',
        'WatchlistItem': 'Mã trong danh sách theo dõi',
        'ScreenerRule': 'Bộ lọc động',
        'StockProfile': 'Hồ sơ mã chứng khoán',
        'DailyPrice': 'Dữ liệu giá hàng ngày',
        'UserConfig': 'Cấu hình người dùng',
        'User': 'Người dùng',
        'Group': 'Nhóm quyền',
    }

    for app in app_list:
        for model in app.get('models', []):
            object_name = model.get('object_name')
            if object_name in menu_name_override:
                model['name'] = menu_name_override[object_name]
            # Menu chi dung de dieu huong, khong hien thi thao tac them moi.
            model['add_url'] = None

    for app in app_list:
        if app.get('app_label') == 'auth':
            app['name'] = '05. Hệ thống xác thực và phân quyền'

    if not portfolio_app:
        return app_list

    models_by_name = {
        model.get('object_name'): model
        for model in portfolio_app.get('models', [])
    }

    grouped_definitions = [
        (
            'portfolio_tracker',
            '01. Portfolio Tracker',
            [
                'Portfolio',
                'SubAccount',
                'Transaction',
                'AccountSnapshot',
            ],
        ),
        (
            'market_watch',
            '02. Market Watch và theo dõi cá nhân',
            [
                'WatchlistGroup',
                'WatchlistItem',
                'SecuritiesGroup',
                'SecuritiesItem',
                'TrackedSymbol',
                'PriceAlertRule',
                'ScreenerRule',
            ],
        ),
        (
            'data_hub_sync',
            '03. Data Hub và đồng bộ',
            [
                'StockProfile',
                'DailyPrice',
                'MarketGroupSyncLog',
                'StockProfileSyncLog',
            ],
        ),
        (
            'system_configuration',
            '04. Cấu hình hệ thống',
            [
                'UserConfig',
            ],
        ),
    ]

    grouped_apps = []
    for pseudo_label, title, model_names in grouped_definitions:
        grouped_models = [models_by_name[name] for name in model_names if name in models_by_name]
        if not grouped_models:
            continue

        grouped_apps.append(
            {
                'name': title,
                'app_label': pseudo_label,
                'app_url': '',
                'has_module_perms': True,
                'models': grouped_models,
            }
        )

    non_portfolio_apps = [app for app in app_list if app.get('app_label') != 'portfolio']
    return grouped_apps + non_portfolio_apps


admin.site.each_context = _vninvest_each_context
admin.site.get_app_list = _vninvest_get_app_list
admin.site.get_urls = _vninvest_admin_get_urls


class TransactionInline(admin.TabularInline):
    model = Transaction
    extra = 0
    fields = ('symbol', 'transaction_type', 'date', 'price', 'quantity', 'fee', 'notes')
    ordering = ('-date',)
    fk_name = 'sub_account'


class SecuritiesItemInline(admin.TabularInline):
    model = SecuritiesItem
    verbose_name = 'Mã trong nhóm thị trường'
    verbose_name_plural = 'Mã trong nhóm thị trường'
    extra = 0
    fields = ('symbol', 'order')
    readonly_fields = ('symbol', 'order')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class WatchlistItemInline(admin.TabularInline):
    model = WatchlistItem
    verbose_name = 'Mã trong danh sách theo dõi'
    verbose_name_plural = 'Mã trong danh sách theo dõi'
    extra = 1
    fields = ('symbol',)


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'subaccount_count')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')
    ordering = ('-created_at',)

    @admin.display(description='So tieu khoan')
    def subaccount_count(self, obj):
        return obj.sub_accounts.count()


@admin.register(SubAccount)
class SubAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'portfolio', 'type', 'margin_ratio', 'created_at')
    list_filter = ('type', 'portfolio')
    search_fields = ('name', 'portfolio__name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    inlines = [TransactionInline]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'symbol',
        'transaction_type',
        'date',
        'price',
        'quantity',
        'fee',
        'total_value_display',
        'sub_account',
    )
    list_filter = ('transaction_type', 'sub_account', 'symbol')
    search_fields = ('symbol', 'sub_account__name', 'sub_account__portfolio__name')
    ordering = ('-date',)
    date_hierarchy = 'date'

    @admin.display(description='Gia tri lenh (VND)')
    def total_value_display(self, obj):
        return f'{obj.total_value:,.0f}'


@admin.register(AccountSnapshot)
class AccountSnapshotAdmin(admin.ModelAdmin):
    list_display = ('sub_account', 'date', 'net_equity', 'daily_profit', 'created_at')
    list_filter = ('sub_account',)
    search_fields = ('sub_account__name', 'sub_account__portfolio__name')
    ordering = ('-date',)
    date_hierarchy = 'date'


@admin.register(UserConfig)
class UserConfigAdmin(admin.ModelAdmin):
    list_display = ('user', 'whale_alert_threshold', 'theme', 'updated_at')
    list_filter = ('theme',)
    search_fields = ('user__username',)
    ordering = ('user__username',)


@admin.register(SecuritiesGroup)
class SecuritiesGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'group_type', 'item_count', 'order', 'color')
    list_filter = ('group_type',)
    search_fields = ('name',)
    ordering = ('order', 'name')
    inlines = [SecuritiesItemInline]
    actions = ['sync_shared_market_groups', 'sync_shared_market_groups_clear']
    change_list_template = 'admin/portfolio/securitiesgroup/change_list.html'
    readonly_fields = ('name', 'group_type', 'description', 'color', 'order', 'created_at')

    @admin.display(description='Số mã trong nhóm')
    def item_count(self, obj):
        return obj.items.count()

    @admin.action(description='Đồng bộ lại taxonomy Nhóm thị trường dùng chung')
    def sync_shared_market_groups(self, request, queryset):
        result = sync_market_groups_for_users(
            User.objects.filter(is_active=True).order_by('username'),
            requested_by=request.user,
            mode='all',
            clear_existing=False,
        )
        _push_market_group_sync_messages(request, result)

    @admin.action(description='Xóa taxonomy hiện có và đồng bộ lại Nhóm thị trường dùng chung')
    def sync_shared_market_groups_clear(self, request, queryset):
        result = sync_market_groups_for_users(
            User.objects.filter(is_active=True).order_by('username'),
            requested_by=request.user,
            mode='all',
            clear_existing=True,
        )
        _push_market_group_sync_messages(request, result)

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj) or super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SecuritiesItem)
class SecuritiesItemAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'group', 'order', 'added_at')
    list_filter = ('group',)
    search_fields = ('symbol', 'group__name')
    ordering = ('group', 'order', 'symbol')
    readonly_fields = ('symbol', 'group', 'order', 'added_at')

    def has_view_permission(self, request, obj=None):
        return super().has_view_permission(request, obj) or super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(TrackedSymbol)
class TrackedSymbolAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'user', 'source_group', 'added_at')
    list_filter = ('user', 'source_group')
    search_fields = ('symbol', 'user__username')
    ordering = ('-added_at',)
    readonly_fields = ('added_at',)

    fieldsets = (
        ('Thông tin danh sách theo dõi tổng hợp', {
            'fields': ('user', 'symbol', 'source_group', 'added_at'),
        }),
    )

    def has_add_permission(self, request):
        # TrackedSymbol duoc su dung nhu danh sach tong hop trong luong theo doi.
        return False


@admin.register(PriceAlertRule)
class PriceAlertRuleAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'condition', 'target_price', 'user', 'cooldown_seconds', 'is_active', 'last_triggered_at')
    list_filter = ('condition', 'is_active', 'user')
    search_fields = ('symbol', 'user__username')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'last_triggered_at')

    fieldsets = (
        ('Thông tin cảnh báo giá', {
            'fields': ('user', 'symbol', 'condition', 'target_price', 'cooldown_seconds', 'is_active'),
        }),
        ('Theo dõi trigger', {
            'fields': ('last_triggered_at', 'created_at', 'updated_at'),
        }),
    )


@admin.register(StockProfile)
class StockProfileAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'company_name', 'industry', 'exchange', 'is_active', 'updated_at')
    list_filter = ('exchange', 'industry', 'is_active')
    search_fields = ('symbol', 'company_name', 'industry')
    ordering = ('symbol',)
    change_list_template = 'admin/portfolio/stockprofile/change_list.html'


@admin.register(DailyPrice)
class DailyPriceAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')
    list_filter = ('symbol',)
    search_fields = ('symbol',)
    ordering = ('-date', 'symbol')
    date_hierarchy = 'date'
    readonly_fields = ('created_at',)


@admin.register(WatchlistGroup)
class WatchlistGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at', 'item_count')
    list_filter = ('user',)
    search_fields = ('name', 'user__username')
    ordering = ('name',)
    inlines = [WatchlistItemInline]

    @admin.display(description='Số mã trong danh sách')
    def item_count(self, obj):
        return obj.items.count()


@admin.register(WatchlistItem)
class WatchlistItemAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'group', 'added_at')
    list_filter = ('group',)
    search_fields = ('symbol', 'group__name', 'group__user__username')
    ordering = ('-added_at',)


@admin.register(ScreenerRule)
class ScreenerRuleAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active', 'user')
    search_fields = ('name', 'user__username')
    ordering = ('-created_at',)


@admin.register(MarketGroupSyncLog)
class MarketGroupSyncLogAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'finished_at', 'duration_display', 'scope', 'target_user', 'requested_by', 'mode', 'source', 'success', 'created_groups', 'updated_groups', 'added_symbols')
    list_filter = ('scope', 'mode', 'source', 'success', 'clear_existing')
    search_fields = ('target_user__username', 'requested_by__username', 'message', 'error')
    ordering = ('-started_at',)
    date_hierarchy = 'started_at'
    readonly_fields = ('scope', 'target_user', 'requested_by', 'mode', 'clear_existing', 'success', 'total_users', 'total_groups', 'created_groups', 'updated_groups', 'added_symbols', 'source', 'message', 'error', 'started_at', 'finished_at')

    @admin.display(description='Thời gian chạy')
    def duration_display(self, obj):
        return _duration_display(obj.started_at, obj.finished_at)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(StockProfileSyncLog)
class StockProfileSyncLogAdmin(admin.ModelAdmin):
    list_display = ('started_at', 'finished_at', 'duration_display', 'requested_by', 'mode', 'source', 'success', 'total_symbols', 'created_symbols', 'updated_symbols')
    list_filter = ('mode', 'source', 'success')
    search_fields = ('requested_by__username', 'message', 'error')
    ordering = ('-started_at',)
    date_hierarchy = 'started_at'
    readonly_fields = ('scope', 'requested_by', 'mode', 'success', 'total_symbols', 'created_symbols', 'updated_symbols', 'source', 'message', 'error', 'started_at', 'finished_at')

    @admin.display(description='Thời gian chạy')
    def duration_display(self, obj):
        return _duration_display(obj.started_at, obj.finished_at)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
