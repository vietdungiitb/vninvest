from django.contrib import admin, messages

from vninvest_core.admin_ui import VNAdminMixin, VNReadOnlyMixin, badge_for, decimal_vi

from .models import (
    AccountSnapshot,
    CashFlow,
    DNSECredential,
    IdempotencyRecord,
    LedgerEntry,
    Portfolio,
    PositionSnapshot,
    PriceAlert,
    QuarantinedRecord,
    ScreenerRule,
    ScreenerRunHistory,
    ScreenerSchedule,
    SubAccount,
    TrackedSymbol,
    Transaction,
    UserBrokerConfig,
    ValuationSnapshot,
    Watchlist,
    WatchlistItem,
)

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

# ===========================================================================
# WAVE 16 — Mở admin cho toàn bộ model `user_workspace`.
#
# Chia 3 nhóm theo tính chất dữ liệu, mỗi nhóm một chính sách riêng:
#   1. Sổ cái / snapshot / lịch sử  → CÓ admin để tra cứu & đối soát, nhưng
#      bất biến về mặt nghiệp vụ (LedgerEntry chỉ được sinh bởi luồng giao dịch),
#      nên KHÔNG cho sửa tay. Không phải chặn tính năng — đây là bảo toàn
#      liệt kê: LedgerEntry sai sẽ làm hỏng vĩnh viễn phần vốn.
#   2. Cấu hình người dùng        → sửa được.
#   3. Khoá/secret                 → xem + xoá, không sửa tay (ciphertext).
# ===========================================================================

_WS_STATUS_COLORS = {
    'ACTIVE': 'green', 'TRIGGERED': 'yellow', 'EXPIRED': 'gray', 'DISABLED': 'gray',
    'connected': 'green', 'never_connected': 'gray', 'unverified': 'yellow',
    'error': 'red', 'expired': 'red',
    'BUY': 'green', 'SELL': 'red', 'DIVIDEND': 'blue', 'SPLIT': 'purple',
    'BONUS': 'purple', 'FEE': 'yellow', 'TAX': 'yellow', 'DEPOSIT': 'green',
    'WITHDRAWAL': 'red', 'INTEREST': 'blue',
    'ACTIVE ': 'green',
}

_WS_SOURCE_COLORS = {
    'manual': 'blue', 'broker': 'green', 'adjustment': 'yellow', 'backfill': 'purple',
}


def _ws_badge(value, mapping=None):
    mapping = mapping or _WS_STATUS_COLORS
    if value in (None, ''):
        return '—'
    return badge_for(value, color=mapping.get(str(value), 'blue'))


# --- 1. Danh sách theo dõi / cảnh báo giá -----------------------------------
@admin.register(TrackedSymbol)
class TrackedSymbolAdmin(VNAdminMixin, admin.ModelAdmin):
    """Mã người dùng đang theo dõi."""

    list_display = ('symbol', 'user', 'tenant', 'source_watchlist', 'whale_alert_threshold_million', 'is_active', 'is_stale', 'added_at')
    list_filter = ('is_active', 'is_stale', 'tenant', 'source_watchlist')
    search_fields = ('symbol', 'user__username', 'user__email', 'tenant__tenant_code')
    autocomplete_fields = ('user', 'tenant', 'source_watchlist')
    ordering = ('-added_at',)
    date_hierarchy = 'added_at'
    list_per_page = 50


@admin.register(PriceAlert)
class PriceAlertAdmin(VNAdminMixin, admin.ModelAdmin):
    """Cảnh báo giá do người dùng tự đặt."""

    list_display = ('symbol', 'user', 'alert_type', 'price_threshold', 'status', 'is_enabled', 'last_triggered_at', 'created_at')
    list_filter = ('alert_type', 'status', 'is_enabled', 'notify_email', 'notify_sms', 'notify_push', 'tenant')
    search_fields = ('symbol', 'user__username', 'user__email')
    autocomplete_fields = ('user', 'tenant')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Trạng thái', ordering='status')
    def status(self, obj):
        return _ws_badge(obj.status)

    actions = ('disable_selected',)

    @admin.action(description='Tắt các cảnh báo đã chọn')
    def disable_selected(self, request, queryset):
        n = queryset.update(is_enabled=False, status='DISABLED')
        self.message_user(request, f'Đã tắt {n} cảnh báo.', level=messages.SUCCESS)


# --- 2. Tài khoản môi giới / danh tính --------------------------------------
@admin.register(SubAccount)
class SubAccountAdmin(VNAdminMixin, admin.ModelAdmin):
    """Tài khoản con tại broker, gắn với một portfolio."""

    list_display = ('display_name', 'portfolio', 'user', 'tenant', 'broker', 'account_number', 'type', 'is_active', 'created_at')
    list_filter = ('broker', 'type', 'is_active', 'tenant')
    search_fields = ('name', 'display_name', 'account_number', 'external_id', 'user__username')
    autocomplete_fields = ('user', 'tenant', 'portfolio')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    readonly_fields = ('sync_status', 'legacy_sub_account_id', 'created_at', 'updated_at')


@admin.register(AccountSnapshot)
class AccountSnapshotAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Ảnh chụp số dư tài khoản theo ngày — dữ liệu đối soát, không sửa tay."""

    list_display = ('sub_account', 'date', 'net_equity', 'cash_balance', 'stock_value', 'debt')
    list_filter = ('date', 'sub_account__broker')
    search_fields = ('sub_account__account_number', 'sub_account__name')
    autocomplete_fields = ('sub_account',)
    ordering = ('-date', 'sub_account')
    date_hierarchy = 'date'
    list_per_page = 100


@admin.register(DNSECredential)
class DNSECredentialAdmin(VNAdminMixin, admin.ModelAdmin):
    """Khoá API DNSE của từng user.

    `*_cipher` là ciphertext — chỉ đọc. Xoá được để thu hồi.
    """

    list_display = ('user', 'is_active', 'last_sync_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('user__username', 'user__email')
    autocomplete_fields = ('user',)
    ordering = ('-updated_at',)
    readonly_fields = ('client_id_cipher', 'client_secret_cipher', 'created_at', 'updated_at')

    def has_add_permission(self, request):
        # Tao qua luong ket noi DNSE, khong tao tay trong admin.
        return False


@admin.register(UserBrokerConfig)
class UserBrokerConfigAdmin(VNAdminMixin, admin.ModelAdmin):
    """Cau hinh broker theo user (BYOK).

    `secrets_cipher` la ciphertext — chi doc. Cac truong trang thai van sua
    duoc vi la phan trang thai, khong phai secret.
    """

    list_display = ('label', 'user', 'tenant', 'provider', 'status', 'last_verified_at', 'updated_at')
    list_filter = ('provider', 'status', 'tenant')
    search_fields = ('label', 'user__username', 'user__email', 'tenant__tenant_code')
    autocomplete_fields = ('user', 'tenant')
    ordering = ('-updated_at',)
    date_hierarchy = 'updated_at'
    readonly_fields = ('secrets_cipher', 'last_verified_at', 'last_error', 'created_at', 'updated_at')

    @admin.display(description='Trạng thái', ordering='status')
    def status(self, obj):
        return _ws_badge(obj.status)


# --- 3. Bộ lọc / screener ---------------------------------------------------
@admin.register(ScreenerRule)
class ScreenerRuleAdmin(VNAdminMixin, admin.ModelAdmin):
    """Bộ quy tắc lọc cổ phiếu do user định nghĩa."""

    list_display = ('name', 'user', 'tenant', 'is_active', 'is_public', 'created_at')
    list_filter = ('is_active', 'is_public', 'tenant')
    search_fields = ('name', 'user__username', 'user__email')
    autocomplete_fields = ('user', 'tenant')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'


@admin.register(ScreenerRunHistory)
class ScreenerRunHistoryAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Lịch sử chạy bộ lọc — kết quả trả về lưu kèm để đối chiếu."""

    list_display = ('run_at', 'rule_name', 'user', 'matched_count', 'total_scanned', 'window_days', 'session_date')
    list_filter = ('run_at', 'rule', 'session_date')
    search_fields = ('rule_name', 'user__username')
    autocomplete_fields = ('user', 'tenant', 'rule')
    ordering = ('-run_at',)
    date_hierarchy = 'run_at'
    list_per_page = 100


@admin.register(ScreenerSchedule)
class ScreenerScheduleAdmin(VNAdminMixin, admin.ModelAdmin):
    """Lịch chạy tự động cho bộ lọc."""

    list_display = ('name', 'user', 'tenant', 'run_time', 'is_active', 'last_run_at', 'next_run_at')
    list_filter = ('is_active', 'tenant')
    search_fields = ('name', 'user__username', 'user__email')
    autocomplete_fields = ('user', 'tenant')
    ordering = ('name',)
    readonly_fields = ('last_run_at', 'next_run_at', 'created_at')


# --- 4. Sổ cái & dòng tiền: bất biến, chỉ đọc ------------------------------
@admin.register(LedgerEntry)
class LedgerEntryAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Sổ cái giao dịch — nguồn sự thật cho mọi phép tính vốn.

    KHÔNG cho sửa/xoá tay: một dòng sai sẽ làm lệch vĩnh viễn tiền và
    phân bổ danh mục. Mọi điều chỉnh đi qua `reversal_of` (bút toán đảo).
    """

    list_display = ('trade_date', 'entry_type', 'symbol', 'quantity', 'price', 'fee', 'tax', 'market', 'source', 'portfolio')
    list_filter = ('entry_type', 'market', 'source', 'trade_date', 'symbol')
    search_fields = ('symbol', 'external_id', 'portfolio__name')
    autocomplete_fields = ('tenant', 'portfolio', 'reversal_of', 'created_by')
    ordering = ('-trade_date', '-pk')
    date_hierarchy = 'trade_date'
    list_per_page = 100

    @admin.display(description='Loại', ordering='entry_type')
    def entry_type(self, obj):
        return _ws_badge(obj.entry_type)

    @admin.display(description='Nguồn', ordering='source')
    def source(self, obj):
        return _ws_badge(obj.source, _WS_SOURCE_COLORS)


@admin.register(CashFlow)
class CashFlowAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Dòng tiền phát sinh từ sổ cái — chỉ đọc vì gắn với LedgerEntry."""

    list_display = ('entry', 'flow_type', 'amount', 'currency', 'tenant', 'created_at')
    list_filter = ('flow_type', 'currency', 'tenant')
    search_fields = ('entry__symbol',)
    autocomplete_fields = ('entry', 'tenant')
    ordering = ('-pk',)
    date_hierarchy = 'created_at'

    @admin.display(description='Loại', ordering='flow_type')
    def flow_type(self, obj):
        return _ws_badge(obj.flow_type)


@admin.register(PositionSnapshot)
class PositionSnapshotAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Ảnh chụp vị thế theo ngày — sinh bởi tính toán, không sửa tay."""

    list_display = ('as_of_date', 'symbol', 'portfolio', 'quantity', 'avg_cost', 'current_price', 'market_value', 'unrealized_pnl', 'weight')
    list_filter = ('as_of_date', 'symbol', 'source')
    search_fields = ('symbol', 'portfolio__name')
    autocomplete_fields = ('tenant', 'portfolio')
    ordering = ('-as_of_date', 'symbol')
    date_hierarchy = 'as_of_date'
    list_per_page = 100

    @admin.display(description='Lãi/lỗ tạm tính', ordering='unrealized_pnl')
    def unrealized_pnl(self, obj):
        return decimal_vi(obj.unrealized_pnl)


@admin.register(ValuationSnapshot)
class ValuationSnapshotAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Ảnh chụp giá trị danh mục (NAV) theo ngày — chỉ đọc."""

    list_display = ('as_of_date', 'portfolio', 'nav', 'stock_value', 'cash', 'debt', 'currency', 'source')
    list_filter = ('as_of_date', 'currency', 'source')
    search_fields = ('portfolio__name', 'nav_reason')
    autocomplete_fields = ('tenant', 'portfolio')
    ordering = ('-as_of_date',)
    date_hierarchy = 'as_of_date'
    list_per_page = 100

    @admin.display(description='NAV')
    def nav(self, obj):
        return decimal_vi(obj.nav)


# --- 5. Hạ tầng vận hành ---------------------------------------------------
@admin.register(IdempotencyRecord)
class IdempotencyRecordAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Khoá idempotency cho các API ghi dữ liệu.

    Xoá tay ở đây SẼ mở lại khả năng xử lý trùng request, nên chỉ đọc.
    """

    list_display = ('created_at', 'scope', 'key', 'actor', 'tenant', 'response_code', 'expires_at')
    list_filter = ('scope', 'created_at', 'tenant')
    search_fields = ('key', 'scope', 'request_hash', 'actor__username')
    autocomplete_fields = ('tenant', 'actor')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_per_page = 100


@admin.register(QuarantinedRecord)
class QuarantinedRecordAdmin(VNAdminMixin, admin.ModelAdmin):
    """Bản ghi bị cách ly vì dữ liệu sai — giữ lại để điều tra, không xoá."""

    list_display = ('created_at', 'model_name', 'original_id', 'reason')
    list_filter = ('model_name', 'created_at')
    search_fields = ('model_name', 'reason', 'original_id')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)
    actions = ('release_records',)

    @admin.action(description='Đánh dấu đã xử lý xong (giữ bản ghi để lưu vết)')
    def release_records(self, request, queryset):
        # Ghi de `reason` de lai dau vet, khong xoa — muc dich cua bang la
        # giu lai bang chung.
        n = queryset.update(reason='Đã xử lý xong (bởi %s)' % request.user.username)
        self.message_user(request, f'Đã đánh dấu {n} bản ghi.', level=messages.SUCCESS)
