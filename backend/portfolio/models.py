from django.db import models, transaction
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core import signing
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

from .ai_options import ADVISORY_CAPABILITY, PROVIDER_CHOICES, get_default_model, is_model_allowed_for_capability, is_valid_model, is_valid_provider
from .encryption_utils import decrypt_text, encrypt_text

# ============================================================================
# OpenCore models - Import for Django to recognize them
# ============================================================================
try:
    from .opencore_dpi import (
        DPIPlan, DPILicense, DPIUsageMetrics, DPIEntitlement,
        DPIAuditLog, get_or_create_default_license, check_feature_access
    )
    from .opencore_analytics import (
        DPIAPICallLog, DPIFeatureUsage, DPIQuotaTracker,
        DPIAnalyticsSnapshot, track_api_call, get_monthly_usage_summary
    )
    from .opencore_premium import (
        PremiumFeatureGate, get_plan_features, PREMIUM_INDICATORS, ADVANCED_FEATURES_BY_PLAN
    )
    from .opencore_revenue import (
        DPIInvoice, DPIRevenuePlan, DPISubscription, DPIPayment,
        calculate_monthly_bill, generate_monthly_invoice
    )
except ImportError:
    pass  # These will be imported when needed

# ---------------------------------------------------------------------------
# ScreenerRule: Bộ lọc động do user tự định nghĩa
# ---------------------------------------------------------------------------
class ScreenerRule(models.Model):
    """
    Bộ lọc động (screener) do user tự định nghĩa, lưu dưới dạng JSON.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='screener_rules', verbose_name='Người dùng',
    )
    name = models.CharField(max_length=100, verbose_name='Tên bộ lọc')
    rules_json = models.JSONField(verbose_name='Luật lọc (JSON)')
    is_active = models.BooleanField(default=True, verbose_name='Kích hoạt')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Bộ lọc động'
        verbose_name_plural = 'Bộ lọc động'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.user.username})'

# ---------------------------------------------------------------------------
# StockProfile: Thông tin tĩnh về mã chứng khoán
# ---------------------------------------------------------------------------
class StockProfile(models.Model):
    """
    Thông tin tĩnh về mã chứng khoán: tên, ngành, sàn, v.v.
    """
    symbol = models.CharField(max_length=10, primary_key=True, verbose_name='Mã CK')
    company_name = models.CharField(max_length=255, verbose_name='Tên công ty')
    industry = models.CharField(max_length=100, verbose_name='Ngành')
    exchange = models.CharField(max_length=20, verbose_name='Sàn giao dịch')
    listed_date = models.DateField(null=True, blank=True, verbose_name='Ngày niêm yết')
    is_active = models.BooleanField(default=True, verbose_name='Đang giao dịch')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Hồ sơ mã chứng khoán'
        verbose_name_plural = 'Hồ sơ mã chứng khoán'
        ordering = ['symbol']

    def __str__(self):
        return f'{self.symbol} - {self.company_name}'
# ---------------------------------------------------------------------------
# WatchlistGroup/WatchlistItem: Danh sách theo dõi cá nhân hóa
# ---------------------------------------------------------------------------
class WatchlistGroup(models.Model):
    """
    Nhóm watchlist cá nhân của user (ví dụ: "Theo dõi sát", "Cổ phiếu lướt sóng").
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='watchlist_groups', verbose_name='Người dùng',
    )
    name = models.CharField(max_length=100, verbose_name='Tên danh sách theo dõi')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Danh sách theo dõi cá nhân'
        verbose_name_plural = 'Danh sách theo dõi cá nhân'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.user.username})'


class WatchlistItem(models.Model):
    """
    Một mã chứng khoán do user chọn theo dõi, thuộc một nhóm watchlist cá nhân.
    """
    group = models.ForeignKey(
        WatchlistGroup, on_delete=models.CASCADE,
        related_name='items', verbose_name='Danh sách theo dõi cá nhân',
    )
    symbol = models.CharField(max_length=10, verbose_name='Mã chứng khoán', db_index=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã trong danh sách theo dõi'
        verbose_name_plural = 'Mã trong danh sách theo dõi'
        unique_together = [('group', 'symbol')]
        ordering = ['-added_at']

    def __str__(self):
        return f'{self.symbol} ({self.group.name} - {self.group.user.username})'



class SubAccount(models.Model):
    """
    Tiểu khoản thuộc danh mục: đuôi 1 (Tiền mặt), đuôi 3 (Chuyên biệt), đuôi 6 (Margin).
    """
    class TypeChoices(models.TextChoices):
        CASH = '1', 'Đuôi 1 - Tiền mặt'
        SPECIAL = '3', 'Đuôi 3 - Chuyên biệt'
        MARGIN = '6', 'Đuôi 6 - Margin'

    portfolio = models.ForeignKey(
        'Portfolio',
        on_delete=models.CASCADE,
        related_name='sub_accounts',
        verbose_name='Danh mục cha',
    )

    type = models.CharField(
        max_length=1,
        choices=TypeChoices.choices,
        default=TypeChoices.CASH,
        verbose_name='Loại tiểu khoản',
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Tên tiểu khoản',
    )
    margin_ratio = models.DecimalField(
        max_digits=5,
        decimal_places=3,
        default=Decimal('1.000'),
        verbose_name='Tỷ lệ ký quỹ (Margin)',
        help_text='1.0 = 100% (không vay), 0.5 = 50% margin',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Tiểu khoản'
        verbose_name_plural = 'Tiểu khoản'
        unique_together = ['portfolio', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_type_display()}) - {self.portfolio.name}'


class Portfolio(models.Model):
    """
    Danh mục đầu tư của một người dùng.
    Một user có thể có nhiều danh mục (ví dụ: "Dài hạn", "Ngắn hạn").
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='portfolios',
        verbose_name='Người dùng',
    )
    name = models.CharField(
        max_length=100,
        verbose_name='Tên danh mục',
    )
    description = models.TextField(
        blank=True,
        default='',
        verbose_name='Mô tả',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Cập nhật lần cuối')

    class Meta:
        verbose_name = 'Danh mục đầu tư'
        verbose_name_plural = 'Danh mục đầu tư'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.user.username})'


class Transaction(models.Model):
    """
    Lưu chi tiết từng lệnh giao dịch: MUA, BÁN, hoặc nhận CỔ TỨC tiền mặt.
    """
    class TransactionType(models.TextChoices):
        BUY = 'BUY', 'Mua'
        SELL = 'SELL', 'Bán'
        DIVIDEND = 'DIVIDEND', 'Cổ tức tiền mặt'

    sub_account = models.ForeignKey(
        'SubAccount',
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name='Tiểu khoản',
    )
    symbol = models.CharField(
        max_length=10,
        verbose_name='Mã chứng khoán',
        help_text='Ví dụ: VNM, VIC, HPG',
        db_index=True,
    )
    transaction_type = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
        verbose_name='Loại lệnh',
    )
    date = models.DateField(
        verbose_name='Ngày giao dịch',
        db_index=True,
    )
    price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Giá khớp (VNĐ)',
    )
    quantity = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Khối lượng (cổ phiếu)',
    )
    fee = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name='Phí giao dịch (VNĐ)',
    )
    notes = models.TextField(
        blank=True,
        default='',
        verbose_name='Ghi chú',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo bản ghi')

    class Meta:
        verbose_name = 'Giao dịch'
        verbose_name_plural = 'Giao dịch'
        ordering = ['-date', '-created_at']

    def __str__(self):
        return (
            f'{self.get_transaction_type_display()} {self.quantity} {self.symbol} '
            f'@ {self.price:,.0f} ngày {self.date}'
        )

    @property
    def total_value(self):
        """Tổng giá trị lệnh bao gồm phí (dương = tiền ra, âm không áp dụng ở đây)."""
        return self.price * self.quantity + self.fee


class DailyPrice(models.Model):
    """
    Lưu giá đóng cửa (End-of-Day) hàng ngày của từng mã chứng khoán.
    Dữ liệu được kéo từ vnstock và lưu cache vào đây để tránh gọi API liên tục.
    """
    symbol = models.CharField(
        max_length=10,
        verbose_name='Mã chứng khoán',
        db_index=True,
    )
    date = models.DateField(
        verbose_name='Ngày',
        db_index=True,
    )
    open_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Giá mở cửa',
    )
    high_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Giá cao nhất',
    )
    low_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='Giá thấp nhất',
    )
    close_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        verbose_name='Giá đóng cửa',
    )
    volume = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name='Khối lượng khớp lệnh',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời điểm lưu')

    class Meta:
        verbose_name = 'Giá hàng ngày'
        verbose_name_plural = 'Giá hàng ngày'
        unique_together = [('symbol', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f'{self.symbol} | {self.date} | Đóng cửa: {self.close_price:,.0f}'


class TickerSessionClose(models.Model):
    """
    Snapshot giá đóng cửa theo từng phiên thị trường.
    Dùng làm fallback chuẩn ngoài giờ giao dịch và giữ lịch sử ngắn hạn.
    """

    symbol = models.CharField(max_length=10, db_index=True, verbose_name='Mã chứng khoán')
    market_code = models.CharField(max_length=32, default='VN_STOCK', db_index=True, verbose_name='Mã thị trường')
    timezone_name = models.CharField(max_length=64, default='Asia/Ho_Chi_Minh', verbose_name='Múi giờ phiên')
    session_date = models.DateField(db_index=True, verbose_name='Ngày phiên')
    close_price = models.DecimalField(max_digits=15, decimal_places=2, verbose_name='Giá đóng cửa')
    prev_close_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Giá đóng trước đó')
    change_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Biến động giá trị')
    change_pct = models.DecimalField(max_digits=9, decimal_places=4, null=True, blank=True, verbose_name='Biến động phần trăm')
    open_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Giá mở cửa')
    high_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Giá cao nhất')
    low_price = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True, verbose_name='Giá thấp nhất')
    volume = models.BigIntegerField(null=True, blank=True, verbose_name='Khối lượng')
    source = models.CharField(max_length=64, default='prefetch', verbose_name='Nguồn ghi nhận')
    captured_at = models.DateTimeField(auto_now=True, verbose_name='Thời điểm ghi nhận')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')

    class Meta:
        verbose_name = 'Snapshot đóng cửa phiên'
        verbose_name_plural = 'Snapshot đóng cửa phiên'
        unique_together = [('symbol', 'market_code', 'session_date')]
        indexes = [
            models.Index(fields=['market_code', 'session_date']),
            models.Index(fields=['symbol', 'session_date']),
        ]
        ordering = ['-session_date', 'symbol']

    def __str__(self):
        return f'{self.symbol} | {self.market_code} | {self.session_date} | close={self.close_price}'


class SecuritiesGroup(models.Model):
    """
    Nhóm theo dõi cổ phiếu (theo ngành hoặc vốn hóa).
    Ví dụ: Ngân hàng, VN30, Midcap, Bất động sản...
    """
    class GroupType(models.TextChoices):
        SECTOR = 'SECTOR', 'Nhóm ngành'
        MARKET_CAP = 'MARKET_CAP', 'Nhóm vốn hóa'
        CUSTOM = 'CUSTOM', 'Tùy chỉnh'

    name = models.CharField(max_length=100, verbose_name='Tên nhóm')
    group_type = models.CharField(
        max_length=20, choices=GroupType.choices,
        default=GroupType.CUSTOM, verbose_name='Loại nhóm',
    )
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    color = models.CharField(max_length=7, default='#22c55e', verbose_name='Màu (hex)')
    order = models.PositiveIntegerField(default=0, verbose_name='Thứ tự')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nhóm thị trường'
        verbose_name_plural = 'Nhóm thị trường'
        unique_together = [('name', 'group_type')]
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


SecuritiesGroupAlias = SecuritiesGroup  # backward-compat alias


class SecuritiesItem(models.Model):
    """Một mã chứng khoán trong một nhóm thị trường."""
    group = models.ForeignKey(
        SecuritiesGroup, on_delete=models.CASCADE,
        related_name='items', verbose_name='Nhóm thị trường',
    )
    symbol = models.CharField(max_length=10, verbose_name='Mã chứng khoán', db_index=True)
    order = models.PositiveIntegerField(default=0, verbose_name='Thứ tự')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã trong nhóm thị trường'
        verbose_name_plural = 'Mã trong nhóm thị trường'
        unique_together = [('group', 'symbol')]
        ordering = ['order', 'symbol']

    def __str__(self):
        return f'{self.symbol} → {self.group.name}'


SecuritiesItemAlias = SecuritiesItem  # backward-compat alias


class TrackedSymbol(models.Model):
    """
    Danh sách Mã Theo dõi cá nhân của người dùng.
    Khác với WatchlistItem (thuộc nhóm ngành), TrackedSymbol là flat list cá nhân.
    Người dùng chọn từ nhóm ngành → mã CK → thêm vào đây.
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='tracked_symbols', verbose_name='Người dùng',
    )
    symbol = models.CharField(max_length=10, verbose_name='Mã Chứng khoán', db_index=True)
    source_group = models.ForeignKey(
        SecuritiesGroup, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tracked_from', verbose_name='Nhóm thị trường nguồn',
    )
    whale_alert_threshold_million = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('1'))],
        verbose_name='Ngưỡng whale riêng (triệu VNĐ)',
    )
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Mã theo dõi tổng hợp'
        verbose_name_plural = 'Mã theo dõi tổng hợp'
        unique_together = [('user', 'symbol')]
        ordering = ['-added_at']

    def __str__(self):
        return f'{self.symbol} ({self.user.username})'


class PriceAlertRule(models.Model):
    class Condition(models.TextChoices):
        ABOVE = 'ABOVE', 'Vượt lên trên'
        BELOW = 'BELOW', 'Rơi xuống dưới'

    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='price_alert_rules', verbose_name='Người dùng',
    )
    symbol = models.CharField(max_length=10, verbose_name='Mã chứng khoán', db_index=True)
    condition = models.CharField(
        max_length=10,
        choices=Condition.choices,
        default=Condition.ABOVE,
        verbose_name='Điều kiện cảnh báo',
    )
    target_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Mức giá mục tiêu (VNĐ)',
    )
    cooldown_seconds = models.PositiveIntegerField(
        default=300,
        verbose_name='Thời gian chờ lặp lại (giây)',
    )
    is_active = models.BooleanField(default=True, verbose_name='Đang kích hoạt')
    last_triggered_at = models.DateTimeField(null=True, blank=True, verbose_name='Lần trigger gần nhất')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cảnh báo giá'
        verbose_name_plural = 'Cảnh báo giá'
        ordering = ['-created_at']
        unique_together = [('user', 'symbol', 'condition', 'target_price')]

    def __str__(self):
        return f'{self.symbol} {self.condition} {self.target_price:,.0f} ({self.user.username})'


class MarketGroupSyncLog(models.Model):
    class ScopeChoices(models.TextChoices):
        USER = 'USER', 'Theo user'
        GLOBAL = 'GLOBAL', 'Toàn hệ thống'

    class ModeChoices(models.TextChoices):
        ALL = 'all', 'Toàn bộ'
        SECTORS = 'sectors', 'Nhóm ngành'
        CAPS = 'caps', 'Nhóm vốn hóa'
        MANUAL = 'manual', 'Danh sách cứng'

    scope = models.CharField(
        max_length=10,
        choices=ScopeChoices.choices,
        default=ScopeChoices.USER,
        verbose_name='Phạm vi đồng bộ',
    )
    target_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='market_group_sync_logs',
        verbose_name='User được đồng bộ',
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_market_group_sync_logs',
        verbose_name='Người chạy đồng bộ',
    )
    mode = models.CharField(
        max_length=20,
        choices=ModeChoices.choices,
        default=ModeChoices.ALL,
        verbose_name='Chế độ đồng bộ',
    )
    clear_existing = models.BooleanField(default=False, verbose_name='Xóa nhóm hiện có trước khi sync')
    success = models.BooleanField(default=False, verbose_name='Thành công')
    total_users = models.PositiveIntegerField(default=0, verbose_name='Số user ảnh hưởng')
    total_groups = models.PositiveIntegerField(default=0, verbose_name='Số nhóm đầu vào')
    created_groups = models.PositiveIntegerField(default=0, verbose_name='Số nhóm tạo mới')
    updated_groups = models.PositiveIntegerField(default=0, verbose_name='Số nhóm cập nhật')
    added_symbols = models.PositiveIntegerField(default=0, verbose_name='Số mã thêm mới')
    source = models.CharField(max_length=20, default='vnstock', verbose_name='Nguồn dữ liệu')
    message = models.TextField(blank=True, default='', verbose_name='Thông báo kết quả')
    error = models.TextField(blank=True, default='', verbose_name='Lỗi chi tiết')
    started_at = models.DateTimeField(auto_now_add=True, verbose_name='Bắt đầu lúc')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='Kết thúc lúc')

    class Meta:
        verbose_name = 'Log đồng bộ nhóm thị trường'
        verbose_name_plural = 'Log đồng bộ nhóm thị trường'
        ordering = ['-started_at']

    def __str__(self):
        target = self.target_user.username if self.target_user else 'toan_he_thong'
        return f'{self.scope} | {target} | {self.started_at:%Y-%m-%d %H:%M}'


class StockProfileSyncLog(models.Model):
    class ScopeChoices(models.TextChoices):
        GLOBAL = 'GLOBAL', 'Toàn hệ thống'

    class ModeChoices(models.TextChoices):
        ALL = 'all', 'Toàn bộ'
        SECTORS = 'sectors', 'Nhóm ngành'
        CAPS = 'caps', 'Nhóm vốn hóa'
        MANUAL = 'manual', 'Danh sách cứng'

    scope = models.CharField(
        max_length=10,
        choices=ScopeChoices.choices,
        default=ScopeChoices.GLOBAL,
        verbose_name='Phạm vi đồng bộ',
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requested_stock_profile_sync_logs',
        verbose_name='Người chạy đồng bộ',
    )
    mode = models.CharField(
        max_length=20,
        choices=ModeChoices.choices,
        default=ModeChoices.ALL,
        verbose_name='Chế độ đồng bộ',
    )
    success = models.BooleanField(default=False, verbose_name='Thành công')
    total_symbols = models.PositiveIntegerField(default=0, verbose_name='Tổng số mã đầu vào')
    created_symbols = models.PositiveIntegerField(default=0, verbose_name='Số mã tạo mới')
    updated_symbols = models.PositiveIntegerField(default=0, verbose_name='Số mã cập nhật')
    source = models.CharField(max_length=20, default='vnstock', verbose_name='Nguồn dữ liệu')
    message = models.TextField(blank=True, default='', verbose_name='Thông báo kết quả')
    error = models.TextField(blank=True, default='', verbose_name='Lỗi chi tiết')
    started_at = models.DateTimeField(auto_now_add=True, verbose_name='Bắt đầu lúc')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='Kết thúc lúc')

    class Meta:
        verbose_name = 'Log đồng bộ hồ sơ mã chứng khoán'
        verbose_name_plural = 'Log đồng bộ hồ sơ mã chứng khoán'
        ordering = ['-started_at']

    def __str__(self):
        return f'STOCKPROFILE | {self.mode} | {self.started_at:%Y-%m-%d %H:%M}'



# ---------------------------------------------------------------------------
# AccountSnapshot: Lưu NAV cuối ngày cho từng sub_account
# ---------------------------------------------------------------------------
class AccountSnapshot(models.Model):
    """
    Lưu snapshot NAV cuối ngày cho từng tiểu khoản (sub_account).
    Dùng để vẽ biểu đồ hiệu suất, tính TWR, so sánh với VN-Index.
    """
    sub_account = models.ForeignKey(
        'SubAccount',
        on_delete=models.CASCADE,
        related_name='snapshots',
        verbose_name='Tiểu khoản',
    )
    date = models.DateField(db_index=True, verbose_name='Ngày')
    net_equity = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        verbose_name='Giá trị tài sản ròng (NAV)',
    )
    daily_profit = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        verbose_name='Lãi/lỗ trong ngày',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Snapshot NAV'
        verbose_name_plural = 'Snapshot NAV'
        unique_together = [('sub_account', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f'{self.sub_account} | {self.date} | NAV: {self.net_equity:,.0f}'


# ...existing code...
class UserConfig(models.Model):
    """
    Cấu hình cá nhân của người dùng.
    whale_alert_threshold: ngưỡng lệnh cá mập (triệu VNĐ).
    theme: 'dark' hoặc 'light'.
    plan: gói dịch vụ (free/basic/pro/premium/admin).
    """
    class PlanChoices(models.TextChoices):
        FREE    = 'free',    'Miễn phí'
        BASIC   = 'basic',   'Cơ bản'
        PRO     = 'pro',     'Chuyên nghiệp'
        PREMIUM = 'premium', 'Cao cấp'
        ADMIN   = 'admin',   'Quản trị viên'

    class LanguageChoices(models.TextChoices):
        VI = 'vi', 'Tiếng Việt'
        EN = 'en', 'English'

    class PlanSourceChoices(models.TextChoices):
        SYSTEM_DEFAULT = 'system_default', 'Hệ thống mặc định'
        ONBOARDING_TRIAL = 'onboarding_trial', 'Onboarding trial'
        MANUAL_ADMIN = 'manual_admin', 'Admin chỉnh thủ công'
        PAID = 'paid', 'Đã trả phí'

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='user_config',
        verbose_name='Người dùng',
    )
    whale_alert_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        default=500,
        validators=[MinValueValidator(Decimal('1'))],
        verbose_name='Ngưỡng lệnh cá mập (triệu VNĐ)',
    )
    theme = models.CharField(
        max_length=10,
        choices=[('dark', 'Dark'), ('light', 'Light')],
        default='dark',
        verbose_name='Chủ đề giao diện',
    )
    language = models.CharField(
        max_length=5,
        choices=LanguageChoices.choices,
        default=LanguageChoices.VI,
        verbose_name='Ngôn ngữ giao diện',
    )
    plan = models.CharField(
        max_length=20,
        choices=PlanChoices.choices,
        default=PlanChoices.FREE,
        verbose_name='Gói dịch vụ',
        db_index=True,
    )
    plan_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Ngày hết hạn gói',
        help_text='Null = không hết hạn (admin hoặc lifetime)',
    )
    plan_source = models.CharField(
        max_length=30,
        choices=PlanSourceChoices.choices,
        default=PlanSourceChoices.SYSTEM_DEFAULT,
        verbose_name='Nguồn gói dịch vụ',
        db_index=True,
    )
    auto_downgrade_enabled = models.BooleanField(
        default=True,
        verbose_name='Cho phép tự động hạ gói',
        help_text='Nếu tắt, job tự động sẽ không hạ gói khi hết hạn.',
    )
    plan_locked_by_admin = models.BooleanField(
        default=False,
        verbose_name='Khóa gói bởi quản trị',
        help_text='Nếu bật, tác vụ hệ thống không được tự động đổi gói.',
    )
    plan_assigned_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Thời điểm gán gói gần nhất',
    )
    downgraded_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Thời điểm hạ gói gần nhất',
    )
    oauth_provider = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='OAuth provider',
        help_text='google | facebook | (trống = username/password)',
    )
    oauth_uid = models.CharField(
        max_length=255,
        blank=True,
        default='',
        verbose_name='OAuth UID',
    )
    email_verified = models.BooleanField(default=False, verbose_name='Email da xac thuc')
    email_verification_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Lan gui email xac thuc gan nhat',
    )
    email_verified_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Thoi diem xac thuc email',
    )
    starter_portfolios_seeded = models.BooleanField(
        default=False,
        verbose_name='Da tao bo danh muc mac dinh',
    )
    starter_portfolios_seeded_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Thoi diem tao bo danh muc mac dinh',
    )
    starter_portfolios_template_version = models.CharField(
        max_length=16,
        default='v1',
        verbose_name='Phien ban template danh muc mac dinh',
    )
    ai_provider = models.CharField(
        max_length=50,
        choices=PROVIDER_CHOICES,
        default='openclaw',
        verbose_name='AI provider',
    )
    ai_model = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='AI model',
        help_text='VD: gpt-4o, claude-3-5-sonnet-20240620',
    )
    ai_api_key = models.TextField(
        blank=True,
        default='',
        verbose_name='AI API key (encrypted)',
    )
    
    # PHASE 1 fields: Advisory auto-generation & cost control
    advisory_auto_generation_enabled = models.BooleanField(
        default=True,
        verbose_name='Cho phép tạo khuyến nghị tự động (mỗi 4h)',
    )
    advisory_whale_signal_enabled = models.BooleanField(
        default=True,
        verbose_name='Cho phép tạo khuyến nghị khi phát hiện tín hiệu cá voi',
    )
    advisory_manual_refresh_enabled = models.BooleanField(
        default=True,
        verbose_name='Cho phép user làm mới khuyến nghị thủ công',
    )
    advisory_refresh_interval_hours = models.PositiveIntegerField(
        default=24,
        validators=[MinValueValidator(1)],
        verbose_name='Khoảng thời gian refresh tự động (giờ)',
        help_text='Advisory sẽ được tạo lại khi tuổi > số giờ này',
    )
    advisory_max_auto_refreshes_per_day = models.PositiveIntegerField(
        default=24,
        validators=[MinValueValidator(1)],
        verbose_name='Số lần auto refresh advisory tối đa mỗi ngày',
        help_text='Giới hạn số advisory do periodic job tự tạo/làm mới trong ngày',
    )
    advisory_max_tokens_per_day = models.PositiveIntegerField(
        default=5000,
        validators=[MinValueValidator(1000)],
        verbose_name='Ngân sách token AI mỗi ngày',
        help_text='Giới hạn tokens dùng cho tạo/refresh khuyến nghị',
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình người dùng'
        verbose_name_plural = 'Cấu hình người dùng'

    def __str__(self):
        return f'Cấu hình {self.user.username} (plan={self.plan}, threshold: {self.whale_alert_threshold:,}M)'

    @property
    def ai_api_key_configured(self) -> bool:
        return bool(self.ai_api_key)

    def get_effective_ai_model(self) -> str:
        return (self.ai_model or '').strip() or get_default_model(self.ai_provider)

    def set_ai_api_key(self, raw_key: str) -> None:
        raw = str(raw_key or '').strip()
        self.ai_api_key = encrypt_text(raw) if raw else ''

    def get_ai_api_key(self) -> str:
        return decrypt_text(self.ai_api_key)


class RuntimeVnstockConfig(models.Model):
    """Singleton runtime config cho vnstock adapter, hỗ trợ cập nhật không cần restart."""

    max_concurrency = models.PositiveIntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(50)],
        verbose_name='Giới hạn concurrent requests',
    )
    retry_attempts = models.PositiveIntegerField(
        default=1,
        validators=[MaxValueValidator(5)],
        verbose_name='Số lần retry',
    )
    retry_backoff_seconds = models.FloatField(
        default=0.35,
        validators=[MinValueValidator(0.0), MaxValueValidator(5.0)],
        verbose_name='Backoff retry (giây)',
    )
    rate_limit_cooldown_seconds = models.PositiveIntegerField(
        default=20,
        validators=[MinValueValidator(5), MaxValueValidator(120)],
        verbose_name='Cooldown khi rate limit (giây)',
    )
    timeout_config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Timeout theo channel',
    )
    price_board_source = models.CharField(
        max_length=16,
        default='KBS',
        verbose_name='Provider chính cho price board',
    )
    fallback_sources = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Provider fallback',
    )
    enable_caching = models.BooleanField(default=True, verbose_name='Bật cache adapter')
    enable_rate_limit_detection = models.BooleanField(default=True, verbose_name='Bật nhận diện rate limit')
    enable_concurrent_limit = models.BooleanField(default=True, verbose_name='Bật giới hạn đồng thời')
    changelog = models.JSONField(default=list, blank=True, verbose_name='Lịch sử thay đổi')
    updated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='vnstock_runtime_config_updates',
        verbose_name='Người cập nhật gần nhất',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Runtime Vnstock Config'
        verbose_name_plural = 'Runtime Vnstock Config'

    def __str__(self):
        return f'RuntimeVnstockConfig#{self.pk or 1} ({self.price_board_source})'

    @classmethod
    def default_timeout_config(cls):
        return {
            'price_board': 8,
            'intraday': 8,
            'financial_ratio': 10,
            'history': 12,
            'listing': 12,
            'general': 8,
        }

    @classmethod
    def default_fallback_sources(cls):
        return ['VCI']

    @classmethod
    def get_or_create_singleton(cls):
        instance, _created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'timeout_config': cls.default_timeout_config,
                'fallback_sources': cls.default_fallback_sources,
            },
        )
        return instance

    def clean(self):
        super().clean()
        if not isinstance(self.timeout_config, dict):
            raise ValidationError({'timeout_config': 'timeout_config phải là object.'})
        if not isinstance(self.fallback_sources, list):
            raise ValidationError({'fallback_sources': 'fallback_sources phải là danh sách.'})

    def to_runtime_dict(self):
        return {
            'max_concurrency': int(self.max_concurrency),
            'retry_attempts': int(self.retry_attempts),
            'retry_backoff_seconds': float(self.retry_backoff_seconds),
            'rate_limit_cooldown_seconds': int(self.rate_limit_cooldown_seconds),
            'timeout_config': self.timeout_config if isinstance(self.timeout_config, dict) else self.default_timeout_config(),
            'price_board_source': str(self.price_board_source or 'KBS').strip().upper(),
            'fallback_sources': self.fallback_sources if isinstance(self.fallback_sources, list) else self.default_fallback_sources(),
            'enable_caching': bool(self.enable_caching),
            'enable_rate_limit_detection': bool(self.enable_rate_limit_detection),
            'enable_concurrent_limit': bool(self.enable_concurrent_limit),
        }

    def append_changelog(self, actor=None, changes=None, reason='update_config'):
        history = list(self.changelog or [])
        history.insert(
            0,
            {
                'timestamp': timezone.now().isoformat(),
                'actor': getattr(actor, 'username', None),
                'reason': str(reason or 'update_config'),
                'changes': changes or {},
            },
        )
        self.changelog = history[:100]


class SystemAISettings(models.Model):
    """Cấu hình AI mặc định toàn hệ thống (singleton)."""

    name = models.CharField(max_length=80, default='default', unique=True, verbose_name='Tên cấu hình')
    is_active = models.BooleanField(default=True, verbose_name='Đang kích hoạt')
    ai_provider = models.CharField(
        max_length=50,
        choices=PROVIDER_CHOICES,
        default='openclaw',
        verbose_name='AI provider hệ thống',
    )
    ai_model = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='AI model hệ thống',
        help_text='Để trống để dùng model mặc định theo provider.',
    )
    ai_api_key = models.TextField(
        blank=True,
        default='',
        verbose_name='AI API key hệ thống (encrypted)',
    )
    allow_env_fallback = models.BooleanField(
        default=True,
        verbose_name='Cho phép fallback API key từ biến môi trường',
        help_text='Nếu không lưu key trong DB, hệ thống sẽ thử đọc biến môi trường tương ứng provider.',
    )
    notes = models.TextField(blank=True, default='', verbose_name='Ghi chú vận hành')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'System AI Settings'
        verbose_name_plural = 'System AI Settings'
        ordering = ['-is_active', '-updated_at']

    def __str__(self):
        status = 'active' if self.is_active else 'inactive'
        return f'{self.name} ({self.ai_provider}/{self.get_effective_ai_model()}) [{status}]'

    @classmethod
    def get_active(cls):
        return cls.objects.filter(is_active=True).order_by('-updated_at', '-id').first() or cls.objects.order_by('-updated_at', '-id').first()

    @property
    def ai_api_key_configured(self) -> bool:
        return bool(self.ai_api_key)

    def get_effective_ai_model(self) -> str:
        return (self.ai_model or '').strip() or get_default_model(self.ai_provider)

    def set_ai_api_key(self, raw_key: str) -> None:
        raw = str(raw_key or '').strip()
        self.ai_api_key = encrypt_text(raw) if raw else ''

    def get_ai_api_key(self) -> str:
        return decrypt_text(self.ai_api_key)

    def clean(self):
        provider = str(self.ai_provider or '').strip().lower()
        model = self.get_effective_ai_model()

        if not is_valid_provider(provider):
            raise ValidationError({'ai_provider': 'AI provider không hợp lệ.'})
        if not is_valid_model(provider, model):
            raise ValidationError({'ai_model': 'AI model không thuộc provider đã chọn.'})
        if not is_model_allowed_for_capability(provider, model, ADVISORY_CAPABILITY):
            raise ValidationError({'ai_model': 'AI model này chưa được hỗ trợ cho luồng advisory hiện tại.'})

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = 'default'
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_active:
                type(self).objects.exclude(pk=self.pk).filter(is_active=True).update(is_active=False)


class SystemAISettingsAuditLog(models.Model):
    ACTION_CHOICES = [
        ('update_settings', 'Update settings'),
        ('test_connection_success', 'Test connection success'),
        ('test_connection_failed', 'Test connection failed'),
    ]

    settings = models.ForeignKey(
        SystemAISettings,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        verbose_name='System AI settings',
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_ai_audit_logs',
        verbose_name='Người thao tác',
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, db_index=True, verbose_name='Hành động')
    reason = models.TextField(blank=True, default='', verbose_name='Mô tả')
    before_json = models.JSONField(default=dict, blank=True, verbose_name='Trạng thái trước')
    after_json = models.JSONField(default=dict, blank=True, verbose_name='Trạng thái sau')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'System AI Audit Log'
        verbose_name_plural = 'System AI Audit Logs'
        indexes = [
            models.Index(fields=['action', 'created_at'], name='sysai_act_created_idx'),
            models.Index(fields=['actor', 'created_at'], name='sysai_actor_created_idx'),
        ]

    def __str__(self):
        return f'{self.action} by {self.actor_id} at {self.created_at}'


class OnboardingPlanPolicy(models.Model):
    """Chính sách gói trải nghiệm áp dụng cho người dùng đăng ký mới."""

    class TrialPlanChoices(models.TextChoices):
        FREE = UserConfig.PlanChoices.FREE
        BASIC = UserConfig.PlanChoices.BASIC
        PRO = UserConfig.PlanChoices.PRO
        PREMIUM = UserConfig.PlanChoices.PREMIUM

    is_active = models.BooleanField(default=False, verbose_name='Đang kích hoạt')
    trial_plan = models.CharField(
        max_length=20,
        choices=TrialPlanChoices.choices,
        default=TrialPlanChoices.BASIC,
        verbose_name='Gói trải nghiệm',
    )
    trial_duration_days = models.PositiveIntegerField(
        default=30,
        verbose_name='Thời lượng trải nghiệm (ngày)',
        validators=[MinValueValidator(1)],
    )
    fallback_plan = models.CharField(
        max_length=20,
        choices=TrialPlanChoices.choices,
        default=TrialPlanChoices.BASIC,
        verbose_name='Gói sau khi hết hạn',
    )
    effective_from = models.DateTimeField(null=True, blank=True, verbose_name='Hiệu lực từ')
    effective_to = models.DateTimeField(null=True, blank=True, verbose_name='Hiệu lực đến')
    created_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_onboarding_policies',
        verbose_name='Tạo bởi',
    )
    updated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_onboarding_policies',
        verbose_name='Cập nhật bởi',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Chính sách onboarding trial'
        verbose_name_plural = 'Chính sách onboarding trial'
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='uniq_active_onboarding_policy',
            ),
        ]

    def clean(self):
        super().clean()
        if self.effective_from and self.effective_to and self.effective_to <= self.effective_from:
            raise ValidationError({'effective_to': 'Hiệu lực đến phải lớn hơn hiệu lực từ.'})

    def __str__(self):
        state = 'ACTIVE' if self.is_active else 'INACTIVE'
        return f'Policy {self.pk} | {self.trial_plan}->{self.fallback_plan} | {state}'


class PlanAssignmentLog(models.Model):
    """Audit trail cho mọi lần thay đổi gói dịch vụ của user."""

    class ReasonChoices(models.TextChoices):
        SIGNUP_TRIAL = 'signup_trial', 'Gán trial khi đăng ký'
        TRIAL_EXPIRED = 'trial_expired', 'Hết hạn trial tự động hạ gói'
        ADMIN_OVERRIDE = 'admin_override', 'Quản trị chỉnh thủ công'
        PAYMENT_UPGRADE = 'payment_upgrade', 'Nâng cấp từ thanh toán'

    class ActorTypeChoices(models.TextChoices):
        SYSTEM = 'system', 'Hệ thống'
        ADMIN = 'admin', 'Quản trị'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='plan_assignment_logs',
        verbose_name='Người dùng',
    )
    old_plan = models.CharField(max_length=20, blank=True, default='', verbose_name='Gói cũ')
    new_plan = models.CharField(max_length=20, verbose_name='Gói mới')
    old_expires_at = models.DateTimeField(null=True, blank=True, verbose_name='Hết hạn cũ')
    new_expires_at = models.DateTimeField(null=True, blank=True, verbose_name='Hết hạn mới')
    reason = models.CharField(
        max_length=30,
        choices=ReasonChoices.choices,
        verbose_name='Lý do',
        db_index=True,
    )
    actor_type = models.CharField(
        max_length=20,
        choices=ActorTypeChoices.choices,
        default=ActorTypeChoices.SYSTEM,
        verbose_name='Nguồn tác động',
        db_index=True,
    )
    actor_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='plan_assignment_actions',
        verbose_name='Người thao tác',
    )
    metadata_json = models.JSONField(null=True, blank=True, verbose_name='Metadata JSON')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Nhật ký thay đổi gói'
        verbose_name_plural = 'Nhật ký thay đổi gói'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_plan_log_user_created'),
            models.Index(fields=['reason', '-created_at'], name='idx_plan_log_reason_created'),
        ]

    def __str__(self):
        return f'{self.user.username}: {self.old_plan}->{self.new_plan} ({self.reason})'


class SystemEmailAccount(models.Model):
    class AuthTypeChoices(models.TextChoices):
        SMTP_PASSWORD = 'smtp_password', 'SMTP Password'
        GOOGLE_OAUTH2 = 'google_oauth2', 'Google OAuth2'

    class TestStatusChoices(models.TextChoices):
        NEVER = 'never', 'Chưa kiểm tra'
        SUCCESS = 'success', 'Kiểm tra thành công'
        FAILED = 'failed', 'Kiểm tra thất bại'

    name = models.CharField(max_length=120, unique=True, verbose_name='Tên cấu hình')
    auth_type = models.CharField(
        max_length=20,
        choices=AuthTypeChoices.choices,
        default=AuthTypeChoices.SMTP_PASSWORD,
        verbose_name='Kiểu xác thực gửi mail',
    )
    oauth_provider = models.CharField(max_length=30, blank=True, default='', verbose_name='OAuth provider')
    host = models.CharField(max_length=255, verbose_name='SMTP host')
    port = models.PositiveIntegerField(default=587, verbose_name='SMTP port')
    username = models.CharField(max_length=255, blank=True, default='', verbose_name='Tên đăng nhập SMTP')
    password_ciphertext = models.TextField(blank=True, default='', verbose_name='Mật khẩu SMTP đã mã hóa')
    google_client_id = models.CharField(max_length=255, blank=True, default='', verbose_name='Google Client ID')
    google_client_secret_ciphertext = models.TextField(blank=True, default='', verbose_name='Google Client Secret đã mã hóa')
    google_refresh_token_ciphertext = models.TextField(blank=True, default='', verbose_name='Google Refresh Token đã mã hóa')
    google_token_scope = models.TextField(blank=True, default='', verbose_name='Google token scope')
    google_account_email = models.EmailField(blank=True, default='', verbose_name='Google account email')
    oauth_connected_at = models.DateTimeField(null=True, blank=True, verbose_name='Thời điểm kết nối OAuth')
    token_last_refreshed_at = models.DateTimeField(null=True, blank=True, verbose_name='Lần refresh token gần nhất')
    token_last_error = models.TextField(blank=True, default='', verbose_name='Lỗi token gần nhất')
    use_tls = models.BooleanField(default=True, verbose_name='Dùng TLS')
    use_ssl = models.BooleanField(default=False, verbose_name='Dùng SSL')
    timeout_seconds = models.PositiveIntegerField(default=20, verbose_name='Timeout kết nối (giây)')
    from_email = models.EmailField(verbose_name='Email người gửi mặc định')
    from_name = models.CharField(max_length=255, blank=True, default='', verbose_name='Tên người gửi')
    reply_to_email = models.EmailField(blank=True, default='', verbose_name='Reply-to email')
    is_active = models.BooleanField(default=True, verbose_name='Đang kích hoạt')
    is_default = models.BooleanField(default=False, verbose_name='Là cấu hình mặc định')
    notes = models.TextField(blank=True, default='', verbose_name='Ghi chú vận hành')
    last_tested_at = models.DateTimeField(null=True, blank=True, verbose_name='Lần kiểm tra gần nhất')
    last_test_status = models.CharField(
        max_length=20,
        choices=TestStatusChoices.choices,
        default=TestStatusChoices.NEVER,
        verbose_name='Trạng thái kiểm tra',
    )
    last_test_message = models.TextField(blank=True, default='', verbose_name='Kết quả kiểm tra gần nhất')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tài khoản gửi mail'
        verbose_name_plural = 'Tài khoản gửi mail'
        ordering = ['-is_default', 'name']

    def __str__(self):
        default_suffix = ' [default]' if self.is_default else ''
        return f'{self.name} ({self.from_email}){default_suffix}'

    def set_smtp_password(self, raw_password: str):
        if raw_password:
            self.password_ciphertext = signing.dumps(raw_password, salt='portfolio.system-email-account')

    def get_smtp_password(self) -> str:
        if not self.password_ciphertext:
            return ''
        try:
            return signing.loads(self.password_ciphertext, salt='portfolio.system-email-account')
        except signing.BadSignature:
            return ''

    def set_google_client_secret(self, raw_secret: str):
        if raw_secret:
            self.google_client_secret_ciphertext = signing.dumps(raw_secret, salt='portfolio.system-email-google-client-secret')

    def get_google_client_secret(self) -> str:
        if not self.google_client_secret_ciphertext:
            return ''
        try:
            return signing.loads(self.google_client_secret_ciphertext, salt='portfolio.system-email-google-client-secret')
        except signing.BadSignature:
            return ''

    def set_google_refresh_token(self, raw_token: str):
        if raw_token:
            self.google_refresh_token_ciphertext = signing.dumps(raw_token, salt='portfolio.system-email-google-refresh-token')

    def clear_google_refresh_token(self):
        self.google_refresh_token_ciphertext = ''

    def get_google_refresh_token(self) -> str:
        if not self.google_refresh_token_ciphertext:
            return ''
        try:
            return signing.loads(self.google_refresh_token_ciphertext, salt='portfolio.system-email-google-refresh-token')
        except signing.BadSignature:
            return ''

    @property
    def has_google_refresh_token(self) -> bool:
        return bool(self.google_refresh_token_ciphertext)

    def clean(self):
        if self.use_tls and self.use_ssl:
            raise ValidationError('Không thể bật đồng thời cả TLS và SSL cho cùng một cấu hình SMTP.')

        if self.auth_type == self.AuthTypeChoices.GOOGLE_OAUTH2:
            if not self.google_client_id:
                raise ValidationError('Google Client ID là bắt buộc khi dùng Google OAuth2.')
            if not self.google_client_secret_ciphertext:
                raise ValidationError('Google Client Secret là bắt buộc khi dùng Google OAuth2.')
            self.oauth_provider = 'google'

    def save(self, *args, **kwargs):
        if self.is_default:
            self.is_active = True

        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_default:
                type(self).objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)


# ---------------------------------------------------------------------------
# WhaleAdvisory: Tư vấn AI từ OpenClaw về tín hiệu cá mập
# ---------------------------------------------------------------------------
class WhaleAdvisory(models.Model):
    """
    Kết quả phân tích AI (OpenClaw) cho mỗi tín hiệu whale_alert.
    summary: ~50 từ dành cho gói Pro+.
    detail: ~200 từ dành cho gói Premium+.
    Cooldown 15 phút / symbol để tránh spam token.
    
    PHASE 1 Enhancement: Support auto-generation + auto-refresh + token tracking
    """
    class SourceChoices(models.TextChoices):
        WHALE_SIGNAL = 'whale_signal', 'Phát hiện tín hiệu cá voi'
        PERIODIC_JOB = 'periodic_job', 'Công việc định kỳ auto-gen'
        USER_REFRESH = 'user_refresh', 'Làm mới thủ công bởi user'

    class AdvisoryTypeChoices(models.TextChoices):
        DEFAULT = 'default', 'Whale signal mặc định'
        REVERSAL = 'reversal', 'Đảo chiều dòng tiền'

    class SeverityChoices(models.TextChoices):
        URGENT = 'urgent', 'Khẩn cấp'
        WARNING = 'warning', 'Cảnh báo'
        INFO = 'info', 'Thông tin'
    
    user              = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, related_name='whale_advisories', verbose_name='Người dùng')
    symbol            = models.CharField(max_length=10, db_index=True, verbose_name='Mã CK')
    matched_value     = models.BigIntegerField(verbose_name='Giá trị khớp lệnh (VNĐ)')
    side              = models.CharField(max_length=10, verbose_name='Chiều lệnh')   # BUY/SELL/UNKNOWN
    threshold         = models.FloatField(default=0, verbose_name='Ngưỡng cá mập')
    ai_summary        = models.TextField(verbose_name='Tóm tắt AI (Pro+)')
    ai_detail         = models.TextField(blank=True, default='', verbose_name='Phân tích chi tiết (Premium+)')
    ai_provider       = models.CharField(max_length=50, default='openclaw', verbose_name='AI provider')
    ai_model          = models.CharField(max_length=100, blank=True, default='', verbose_name='AI model')
    prompt_tokens     = models.PositiveIntegerField(default=0, verbose_name='Prompt tokens dùng')
    completion_tokens = models.PositiveIntegerField(default=0, verbose_name='Completion tokens dùng')
    created_at        = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thời điểm tạo')
    
    # PHASE 1 fields: Auto-generation & refresh tracking
    next_refresh_at   = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='Lần refresh tự động tiếp theo')
    refresh_count     = models.PositiveIntegerField(default=0, verbose_name='Số lần refresh')
    is_auto_generated = models.BooleanField(default=False, verbose_name='Được tạo tự động?')
    aggregate_snapshot = models.ForeignKey(
        'AdvisoryAggregateSnapshot',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='advisories',
        verbose_name='Snapshot aggregate tham chiếu',
    )
    source            = models.CharField(max_length=20, choices=SourceChoices.choices, default=SourceChoices.WHALE_SIGNAL, verbose_name='Nguồn')
    merged_sources    = models.JSONField(default=list, blank=True, verbose_name='Nguồn trigger gộp')
    primary_source    = models.CharField(max_length=30, blank=True, default='', verbose_name='Nguồn trigger chính')
    advisory_type     = models.CharField(max_length=20, choices=AdvisoryTypeChoices.choices, default=AdvisoryTypeChoices.DEFAULT, db_index=True, verbose_name='Loại advisory')
    severity          = models.CharField(max_length=10, choices=SeverityChoices.choices, default=SeverityChoices.INFO, db_index=True, verbose_name='Mức độ nghiêm trọng')

    class Meta:
        verbose_name = 'Tư vấn AI Whale'
        verbose_name_plural = 'Tư vấn AI Whale'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'symbol', 'created_at']),
            models.Index(fields=['symbol', 'created_at']),
            models.Index(fields=['user', 'next_refresh_at'], name='idx_wha_user_refresh_at'),  # PHASE 1
            models.Index(fields=['symbol', 'next_refresh_at'], name='idx_wha_symb_refresh_at'),  # PHASE 1
        ]

    def __str__(self):
        owner = self.user.username if self.user_id else 'legacy'
        return f'{owner}:{self.symbol} {self.side} | {self.ai_summary[:60]}'


# ---------------------------------------------------------------------------
# IntradayTick: Lưu từng tick giao dịch trong phiên (từ Redis Streams)
# ---------------------------------------------------------------------------
class IntradayTick(models.Model):
    """
    Lưu từng tick khớp lệnh intraday, được consumer DbWriter ghi từ Redis Stream.
    Dùng để phân tích lịch sử trong ngày, VWAP, phát hiện cá mập, v.v.
    """
    class Side(models.TextChoices):
        BUY = 'BUY', 'Mua chủ động'
        SELL = 'SELL', 'Bán chủ động'
        UNKNOWN = 'UNKNOWN', 'Không xác định'

    symbol = models.CharField(max_length=10, verbose_name='Mã CK', db_index=True)
    trade_date = models.DateField(verbose_name='Ngày giao dịch', db_index=True)
    trade_time = models.TimeField(verbose_name='Giờ khớp lệnh')
    price = models.DecimalField(max_digits=15, decimal_places=2, verbose_name='Giá khớp (VNĐ)')
    volume = models.BigIntegerField(verbose_name='KL khớp (cổ phiếu)')
    side = models.CharField(
        max_length=10, choices=Side.choices,
        default=Side.UNKNOWN, verbose_name='Chiều lệnh',
    )
    match_type = models.CharField(max_length=20, blank=True, default='', verbose_name='Loại khớp')
    stream_id = models.CharField(
        max_length=30, blank=True, default='',
        verbose_name='Redis Stream ID', db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Thời điểm ghi')

    class Meta:
        verbose_name = 'Tick khớp lệnh intraday'
        verbose_name_plural = 'Tick khớp lệnh intraday'
        indexes = [
            models.Index(fields=['symbol', 'trade_date', 'trade_time']),
            models.Index(fields=['symbol', 'trade_date', 'side'], name='idx_intraday_sym_date_side'),
        ]
        ordering = ['-trade_date', '-trade_time']

    def __str__(self):
        return f'{self.symbol} | {self.trade_date} {self.trade_time} | {self.side} {self.volume}@{self.price:,.0f}'


# ---------------------------------------------------------------------------
# Sprint 14 Mission Control - Global Whale Alerts Config
# ---------------------------------------------------------------------------
class WhaleConfigVersion(models.Model):
    class StatusChoices(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        APPROVED = 'approved', 'Approved'
        ACTIVE = 'active', 'Active'
        ARCHIVED = 'archived', 'Archived'
        ROLLED_BACK = 'rolled_back', 'Rolled back'

    version_code = models.CharField(max_length=64, unique=True, verbose_name='Mã phiên bản')
    config_json = models.JSONField(default=dict, verbose_name='Cấu hình JSON')
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.DRAFT, db_index=True
    )
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='whale_config_versions_created'
    )
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='whale_config_versions_approved'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    activated_at = models.DateTimeField(null=True, blank=True)
    rollback_of = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='rollback_children'
    )
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Whale Config Version'
        verbose_name_plural = 'Whale Config Versions'

    def __str__(self):
        return f'{self.version_code} ({self.status})'


class WhaleConfigDraft(models.Model):
    class StatusChoices(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        REJECTED = 'rejected', 'Rejected'
        APPROVED = 'approved', 'Approved'

    name = models.CharField(max_length=120)
    config_json = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=StatusChoices.choices, default=StatusChoices.DRAFT, db_index=True)
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='whale_config_drafts_created'
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    linked_version = models.ForeignKey(
        WhaleConfigVersion, on_delete=models.SET_NULL, null=True, blank=True, related_name='source_drafts'
    )
    reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Whale Config Draft'
        verbose_name_plural = 'Whale Config Drafts'

    def __str__(self):
        return f'{self.name} ({self.status})'


class WhaleConfigApproval(models.Model):
    class DecisionChoices(models.TextChoices):
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    draft = models.ForeignKey(WhaleConfigDraft, on_delete=models.CASCADE, related_name='approvals')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='whale_config_reviews')
    decision = models.CharField(max_length=20, choices=DecisionChoices.choices, db_index=True)
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Whale Config Approval'
        verbose_name_plural = 'Whale Config Approvals'

    def clean(self):
        if self.draft and self.reviewer_id and self.draft.created_by_id == self.reviewer_id:
            raise ValidationError('Maker-checker violation: người tạo draft không được tự phê duyệt.')

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.draft_id} - {self.decision} by {self.reviewer_id}'


class WhaleConfigRollout(models.Model):
    class ModeChoices(models.TextChoices):
        NOW = 'now', 'Apply now'
        SCHEDULED = 'scheduled', 'Scheduled'
        CANARY = 'canary', 'Canary'

    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Pending'
        RUNNING = 'running', 'Running'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'
        ROLLED_BACK = 'rolled_back', 'Rolled back'

    version = models.ForeignKey(WhaleConfigVersion, on_delete=models.CASCADE, related_name='rollouts')
    mode = models.CharField(max_length=20, choices=ModeChoices.choices, default=ModeChoices.NOW, db_index=True)
    status = models.CharField(max_length=20, choices=StatusChoices.choices, default=StatusChoices.PENDING, db_index=True)
    initiated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='whale_config_rollouts')
    effective_from = models.DateTimeField(null=True, blank=True)
    canary_scope_json = models.JSONField(default=dict, blank=True)
    note = models.TextField(blank=True, default='')
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Whale Config Rollout'
        verbose_name_plural = 'Whale Config Rollouts'

    def __str__(self):
        return f'rollout#{self.id} {self.mode}/{self.status}'


class WhaleConfigWorkerAck(models.Model):
    rollout = models.ForeignKey(WhaleConfigRollout, on_delete=models.CASCADE, related_name='worker_acks')
    worker_name = models.CharField(max_length=120)
    worker_version = models.CharField(max_length=64, blank=True, default='')
    acked = models.BooleanField(default=False)
    acked_at = models.DateTimeField(null=True, blank=True)
    details = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('rollout', 'worker_name')]
        ordering = ['-created_at']
        verbose_name = 'Whale Config Worker ACK'
        verbose_name_plural = 'Whale Config Worker ACKs'

    def __str__(self):
        return f'{self.worker_name} ack={self.acked}'


class WhaleConfigAuditLog(models.Model):
    ACTION_CHOICES = [
        ('create_draft', 'Create draft'),
        ('update_draft', 'Update draft'),
        ('submit_draft', 'Submit draft'),
        ('approve', 'Approve'),
        ('reject', 'Reject'),
        ('apply', 'Apply'),
        ('rollback', 'Rollback'),
    ]

    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='whale_config_audit_logs')
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, db_index=True)
    draft = models.ForeignKey(WhaleConfigDraft, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    version = models.ForeignKey(WhaleConfigVersion, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    rollout = models.ForeignKey(WhaleConfigRollout, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    reason = models.TextField(blank=True, default='')
    before_json = models.JSONField(default=dict, blank=True)
    after_json = models.JSONField(default=dict, blank=True)
    ticket_ref = models.CharField(max_length=120, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Whale Config Audit Log'
        verbose_name_plural = 'Whale Config Audit Logs'

    def __str__(self):
        return f'{self.action} by {self.actor_id} at {self.created_at}'


# ---------------------------------------------------------------------------
# Sprint 28 — LegalPage: Nội dung pháp lý (Giới thiệu, Tuyên bố trách nhiệm)
# ---------------------------------------------------------------------------
class LegalPage(models.Model):
    """
    Nội dung pháp lý do admin quản lý: Giới thiệu và Tuyên bố trách nhiệm.
    Mỗi (slug, locale) chỉ có 1 bản active (UniqueConstraint).
    Hiển thị công khai tại trang đăng nhập/đăng ký và menu người dùng.
    """

    class SlugChoices(models.TextChoices):
        ABOUT = 'about', 'Giới thiệu'
        DISCLAIMER = 'disclaimer', 'Tuyên bố trách nhiệm'

    class LocaleChoices(models.TextChoices):
        VI = 'vi', 'Tiếng Việt'
        EN = 'en', 'English'

    slug = models.CharField(
        max_length=30,
        choices=SlugChoices.choices,
        verbose_name='Loại trang',
        db_index=True,
    )
    locale = models.CharField(
        max_length=10,
        choices=LocaleChoices.choices,
        default=LocaleChoices.VI,
        verbose_name='Ngôn ngữ',
        db_index=True,
    )
    title = models.CharField(max_length=255, verbose_name='Tiêu đề')
    summary = models.TextField(
        blank=True,
        default='',
        verbose_name='Tóm tắt (hiển thị dưới form đăng nhập)',
    )
    content_markdown = models.TextField(verbose_name='Nội dung (Markdown)')
    is_active = models.BooleanField(default=False, verbose_name='Đang hiển thị', db_index=True)
    version = models.PositiveSmallIntegerField(default=1, verbose_name='Phiên bản')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='Ngày công bố')
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='legal_pages_updated',
        verbose_name='Người cập nhật',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Ngày cập nhật')

    class Meta:
        verbose_name = 'Trang pháp lý'
        verbose_name_plural = 'Trang pháp lý'
        ordering = ['slug', 'locale', '-version']
        constraints = [
            models.UniqueConstraint(
                fields=['slug', 'locale'],
                condition=models.Q(is_active=True),
                name='uniq_active_legal_page_slug_locale',
            )
        ]

    def __str__(self):
        return f'[{self.get_locale_display()}] {self.get_slug_display()} v{self.version} ({"active" if self.is_active else "draft"})'


# ---------------------------------------------------------------------------
# Sprint 15 — Order Flow & Dark Money Detection
# ---------------------------------------------------------------------------
class OrderFlowSignal(models.Model):
    """
    Lưu kết quả phân tích Order Flow cho mỗi lần chạy detector.
    Ghi khi signal_type != 'none' hoặc strength > 20.
    """
    class SignalType(models.TextChoices):
        NONE       = 'none',        'Không có tín hiệu'
        ABSORPTION = 'absorption',  'Hấp thụ (Absorption)'
        ICEBERG    = 'iceberg',     'Lệnh tảng băng (Iceberg)'
        TWAP_BOT   = 'twap_bot',    'TWAP Bot'
        MIXED      = 'mixed',       'Kết hợp nhiều dấu hiệu'

    class SeverityChoices(models.TextChoices):
        INFO     = 'info',     'Thông tin'
        WARNING  = 'warning',  'Cảnh báo'
        URGENT   = 'urgent',   'Khẩn cấp'

    symbol            = models.CharField(max_length=10, db_index=True, verbose_name='Mã CK')
    signal_type       = models.CharField(
        max_length=20, choices=SignalType.choices, default=SignalType.NONE,
        verbose_name='Loại tín hiệu',
    )
    strength          = models.FloatField(default=0, verbose_name='Cường độ (0-100)')
    confidence        = models.CharField(max_length=10, default='low', verbose_name='Mức độ tin cậy')
    tick_rate         = models.FloatField(default=0, verbose_name='Tick rate/phút')
    small_order_ratio = models.FloatField(default=0, verbose_name='Tỷ lệ lệnh nhỏ')
    cvd_at_signal     = models.FloatField(default=0, verbose_name='CVD tại lúc phát tín hiệu')
    price_at_signal   = models.FloatField(default=0, verbose_name='Giá tại lúc phát tín hiệu')
    window_seconds    = models.PositiveIntegerField(default=300, verbose_name='Cửa sổ phân tích (s)')
    components_json   = models.JSONField(default=dict, verbose_name='Chi tiết các thành phần')
    event_id          = models.TextField(null=True, blank=True, db_index=True, unique=True, verbose_name='Event ID (deterministic)')
    severity          = models.CharField(max_length=10, choices=SeverityChoices.choices, default=SeverityChoices.INFO, verbose_name='Mức độ nghiêm trọng')
    created_at        = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Thời điểm ghi')

    class Meta:
        verbose_name = 'Order Flow Signal'
        verbose_name_plural = 'Order Flow Signals'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['symbol', 'created_at']),
            models.Index(fields=['symbol', 'created_at', 'id']),  # For pagination tiebreaker
            models.Index(fields=['event_id']),  # For uniqueness lookups
        ]

    def __str__(self):
        return f'{self.symbol} | {self.signal_type} | strength={self.strength:.1f} | {self.created_at}'


# ---------------------------------------------------------------------------
# Sprint 17 — AI Advisory Multi-Tab Component Records
# ---------------------------------------------------------------------------
class AIAdvisoryComponentRecord(models.Model):
    class ComponentType(models.TextChoices):
        PRICE_ACTION = 'price_action', 'Price Action'
        INDICATOR = 'indicator', 'Indicator'
        VOLUME_ORDERFLOW = 'volume_orderflow', 'Volume / Order Flow'
        SENTIMENT = 'sentiment', 'Sentiment'

    class StatusChoice(models.TextChoices):
        OVERBOUGHT = 'overbought', 'Qua mua'
        OVERSOLD = 'oversold', 'Qua ban'
        ACCUMULATION = 'accumulation', 'Dang tich luy'
        BREAKOUT = 'breakout', 'Pha vo'
        NEUTRAL = 'neutral', 'Trung tinh'

    class SuggestedAction(models.TextChoices):
        WATCH = 'watch', 'Theo doi'
        BUY = 'buy', 'Mua'
        SELL = 'sell', 'Ban'
        HOLD_OFF = 'hold_off', 'Dung ngoai'

    class TimeframeChoice(models.TextChoices):
        M5 = '5m', '5m'
        M15 = '15m', '15m'
        M30 = '30m', '30m'
        H1 = '1h', '1h'
        D1 = '1d', '1d'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_advisory_components')
    symbol = models.CharField(max_length=10, db_index=True)
    component_type = models.CharField(max_length=30, choices=ComponentType.choices, default=ComponentType.INDICATOR)
    indicator_name = models.CharField(max_length=100, default='General')
    status = models.CharField(max_length=20, choices=StatusChoice.choices, default=StatusChoice.NEUTRAL)
    confidence_score = models.PositiveSmallIntegerField(default=5)
    suggested_action = models.CharField(max_length=20, choices=SuggestedAction.choices, default=SuggestedAction.WATCH)
    rationale_text = models.TextField(blank=True, default='')
    timeframe = models.CharField(max_length=10, choices=TimeframeChoice.choices, default=TimeframeChoice.M30)
    include_in_summary = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'symbol', 'created_at']),
            models.Index(fields=['symbol', 'include_in_summary', 'is_deleted']),
        ]

    def __str__(self):
        return f'{self.symbol} | {self.component_type} | {self.indicator_name}'


class AIAdvisoryExecutiveSummary(models.Model):
    class StrategyAction(models.TextChoices):
        BUY = 'BUY', 'BUY'
        SELL = 'SELL', 'SELL'
        HOLD = 'HOLD', 'HOLD'
        STAND_ASIDE = 'STAND_ASIDE', 'STAND_ASIDE'

    class RiskLevel(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='ai_advisory_summaries')
    symbol = models.CharField(max_length=10, db_index=True)
    strategy_action = models.CharField(max_length=20, choices=StrategyAction.choices, default=StrategyAction.HOLD)
    synthesis_text = models.TextField(blank=True, default='')
    target_price_zone = models.CharField(max_length=120, blank=True, default='')
    stop_loss_zone = models.CharField(max_length=120, blank=True, default='')
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices, default=RiskLevel.MEDIUM)
    overall_confidence = models.PositiveSmallIntegerField(default=5)
    used_component_ids = models.JSONField(default=list)
    summary_version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'symbol', 'summary_version']),
            models.Index(fields=['symbol', 'created_at']),
        ]

    def __str__(self):
        return f'{self.symbol} v{self.summary_version} | {self.strategy_action}'


# ---------------------------------------------------------------------------
# UserPlanLifecycle: Trial và Grace period (Slice C)
# ---------------------------------------------------------------------------
class UserPlanLifecycle(models.Model):
    """
    Theo dõi vòng đời trial/grace của user:
    - trial_starts_at: ngày bắt đầu trial (mặc định None).
    - trial_ends_at: ngày kết thúc trial (trial_starts_at + 7 ngày).
    - grace_ends_at: ngày kết thúc grace (trial_ends_at + 7 ngày).
    - source: "manual_create" khi admin tạo, "api" khi user request.
    """
    class SourceChoices(models.TextChoices):
        MANUAL_CREATE = "manual_create", "Admin tạo"
        API = "api", "User request qua API"
        SYSTEM = "system", "Tự động hệ thống"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="plan_lifecycle",
        verbose_name="Người dùng",
    )
    trial_starts_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Ngày bắt đầu trial",
    )
    trial_ends_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Ngày kết thúc trial",
    )
    grace_ends_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Ngày kết thúc grace period",
    )
    source = models.CharField(
        max_length=20,
        choices=SourceChoices.choices,
        default=SourceChoices.SYSTEM,
        verbose_name="Nguồn tạo",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Thời điểm tạo")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Thời điểm cập nhật")

    class Meta:
        verbose_name = "Vòng đời Trial/Grace"
        verbose_name_plural = "Vòng đời Trial/Grace"

    def __str__(self):
        return f"{self.user.username} | trial={self.trial_starts_at} -> grace={self.grace_ends_at}"


# ---------------------------------------------------------------------------
# AdvisoryTokenLog: PHASE 1 - Track token usage for advisory generation
# ---------------------------------------------------------------------------
class AdvisoryTokenLog(models.Model):
    """
    PHASE 1: Log từng lần dùng token để tạo/refresh khuyến nghị AI.
    Dùng để tracking chi phí API cho từng user và enforce daily budget.
    """
    class SourceChoices(models.TextChoices):
        AUTO_GENERATION = 'auto_generation', 'Tạo tự động'
        WHALE_SIGNAL = 'whale_signal', 'Phát hiện tín hiệu cá voi'
        MANUAL_REFRESH = 'manual_refresh', 'Làm mới thủ công'
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='advisory_token_logs',
        verbose_name='Người dùng',
    )
    advisory = models.ForeignKey(
        WhaleAdvisory,
        on_delete=models.CASCADE,
        related_name='token_logs',
        null=True,
        blank=True,
        verbose_name='Khuyến nghị',
    )
    tokens_used = models.PositiveIntegerField(
        default=0,
        verbose_name='Số token sử dụng (prompt + completion)',
    )
    source = models.CharField(
        max_length=20,
        choices=SourceChoices.choices,
        default=SourceChoices.WHALE_SIGNAL,
        verbose_name='Nguồn tạo khuyến nghị',
        db_index=True,
    )
    symbol = models.CharField(
        max_length=10,
        blank=True,
        default='',
        verbose_name='Mã chứng khoán',
        db_index=True,
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Thời điểm sử dụng token',
    )
    
    class Meta:
        verbose_name = 'Log token khuyến nghị'
        verbose_name_plural = 'Log token khuyến nghị'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='idx_adv_token_log_user_date'),
            models.Index(fields=['source', 'created_at'], name='idx_adv_token_log_source_date'),
            models.Index(fields=['user', '-created_at'], name='idx_adv_tok_user_created'),
        ]
    
    def __str__(self):
        return f'{self.user.username} | {self.symbol} | {self.get_source_display()} | {self.tokens_used} tokens'


# ---------------------------------------------------------------------------
# F4 Models: Advisory Aggregate State (Holistic Advisory foundation)
# ---------------------------------------------------------------------------
class AdvisoryAggregateSnapshot(models.Model):
    """
    F4 Model: Snapshot of 24h aggregate advisory state.
    
    Stores immutable snapshots of the aggregate decision tree for replay capability.
    Each advisory generation can reference its source snapshot_id for audit trail.
    
    Snapshot contract (stored in state_json):
    {
        "whale": {"signal_count": int, "max_value": float, "max_threshold": float},
        "dark_flow": {"detection_count": int, "max_strength": float, "max_confidence": str},
        "order_flow": {"event_count": int, "latest_severity": str},
        "market": {"context": str, "benchmark": dict},
        "history": [{"timestamp": str, "event": str}],
        "quality": {"actionability": float, "noise_ratio": float, "consistency": float},
        "updated_at": str,
        "seq": int
    }
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='advisory_aggregate_snapshots',
        verbose_name='Người dùng',
    )
    symbol = models.CharField(
        max_length=10,
        db_index=True,
        verbose_name='Mã chứng khoán',
    )
    snapshot_seq = models.PositiveIntegerField(
        verbose_name='Sequence number for ordering',
        db_index=True,
    )
    state_json = models.JSONField(
        default=dict,
        verbose_name='Aggregate state snapshot (immutable)',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Thời điểm snapshot',
    )
    expires_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name='TTL expiry (30d retention policy)',
    )
    
    class Meta:
        verbose_name = 'Advisory Aggregate Snapshot'
        verbose_name_plural = 'Advisory Aggregate Snapshots'
        ordering = ['-created_at']
        unique_together = [('user', 'symbol', 'snapshot_seq')]
        indexes = [
            models.Index(fields=['user', 'symbol', '-created_at'], name='idx_snap_user_symbol_date'),
            models.Index(fields=['user', 'expires_at'], name='idx_snap_user_expires'),
        ]
    
    def __str__(self):
        return f'{self.user.username}:{self.symbol} snap#{self.snapshot_seq}'


class AdvisoryAggregateAuditLog(models.Model):
    """
    F4 Model: Audit trail for aggregate state transitions.
    
    Records every decision made by Holistic Advisory engine:
    - State transition: before_state_json → after_state_json
    - Reason: why decision was made (enum: "new_whale", "dark_flow_detected", "threshold_updated", etc.)
    - Actor: who/what triggered it (enum: "system", "user", "scheduler")
    - Metadata: additional context (e.g., token cost, latency_ms)
    
    For compliance + decision replay capability.
    """
    class ReasonChoices(models.TextChoices):
        NEW_WHALE_EVENT = 'new_whale_event', 'New whale signal'
        DARK_FLOW_DETECTED = 'dark_flow_detected', 'Dark flow detection'
        THRESHOLD_UPDATED = 'threshold_updated', 'Threshold override changed'
        MANUAL_REFRESH = 'manual_refresh', 'User requested refresh'
        AUTO_GENERATION = 'auto_generation', 'Automatic generation'
        STATE_COMPACTION = 'state_compaction', 'State cleanup/compaction'
        HOLISTIC_ROLLOUT_DENY = 'holistic_rollout_deny', 'Holistic rollout gate denied request'
    
    class ActorChoices(models.TextChoices):
        SYSTEM = 'system', 'Automated system'
        USER = 'user', 'User action'
        SCHEDULER = 'scheduler', 'Periodic job'
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='advisory_audit_logs',
        verbose_name='Người dùng',
    )
    symbol = models.CharField(
        max_length=10,
        db_index=True,
        verbose_name='Mã chứng khoán',
    )
    before_state_json = models.JSONField(
        default=dict,
        verbose_name='Trạng thái trước',
    )
    after_state_json = models.JSONField(
        default=dict,
        verbose_name='Trạng thái sau',
    )
    reason = models.CharField(
        max_length=30,
        choices=ReasonChoices.choices,
        verbose_name='Lý do thay đổi',
        db_index=True,
    )
    actor = models.CharField(
        max_length=20,
        choices=ActorChoices.choices,
        default=ActorChoices.SYSTEM,
        verbose_name='Người/hệ thống thực hiện',
    )
    actor_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Actor identifier (user_id, job_id, etc.)',
    )
    metadata_json = models.JSONField(
        default=dict,
        verbose_name='Additional context (token_cost, latency_ms, etc.)',
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='Thời điểm audit',
    )
    
    class Meta:
        verbose_name = 'Advisory Aggregate Audit Log'
        verbose_name_plural = 'Advisory Aggregate Audit Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'symbol', '-created_at'], name='idx_audit_user_symbol_date'),
            models.Index(fields=['reason', 'created_at'], name='idx_audit_reason_date'),
            models.Index(fields=['user', '-created_at'], name='idx_audit_user_created'),
        ]
    
    def __str__(self):
        return f'{self.user.username}:{self.symbol} {self.reason} by {self.actor}'


class PortfolioNewsDigest(models.Model):
    """
    Sprint35 Layer 3: Bản tóm tắt tin tức danh mục hàng ngày.
    Celery Beat task tạo sau 16:05 ICT (sau khi sàn đóng cửa).
    Một bản digest/user/ngày.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='portfolio_news_digests',
        verbose_name='Người dùng',
    )
    date = models.DateField(
        db_index=True,
        verbose_name='Ngày giao dịch',
    )
    symbols = models.JSONField(
        default=list,
        verbose_name='Danh sách mã chứng khoán',
    )
    digest_summary = models.TextField(
        verbose_name='Tóm tắt ngắn (~50 từ)',
    )
    digest_full = models.TextField(
        blank=True,
        default='',
        verbose_name='Nội dung đầy đủ',
    )
    item_count = models.PositiveIntegerField(
        default=0,
        verbose_name='Số tin tức đã xử lý',
    )
    ai_model = models.CharField(
        max_length=100,
        blank=True,
        default='',
        verbose_name='Mô hình AI được dùng',
    )
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Portfolio News Digest'
        verbose_name_plural = 'Portfolio News Digests'
        ordering = ['-created_at']
        unique_together = [('user', 'date')]
        indexes = [
            models.Index(fields=['user', '-date'], name='idx_digest_user_date'),
        ]

    def __str__(self):
        symbol_count = len(self.symbols) if isinstance(self.symbols, list) else 0
        return f'{self.user.username}: digest {self.date} ({symbol_count} mã)'


# ---------------------------------------------------------------------------
# SystemSetting: Cấu hình hệ thống (Admin-configurable key-value store)
# ---------------------------------------------------------------------------
class SystemSetting(models.Model):
    """
    Bảng cấu hình hệ thống dạng key-value.
    Admin có thể thay đổi từ Django Admin mà không cần deploy lại.

    Các key mặc định:
    - system_timezone  : Múi giờ hiển thị toàn hệ thống (mặc định Asia/Ho_Chi_Minh)
    """
    key = models.CharField(
        max_length=100, unique=True,
        verbose_name='Khóa cấu hình',
        help_text='Ví dụ: system_timezone, market_open_hour, …',
    )
    value = models.TextField(
        verbose_name='Giá trị',
        help_text='Giá trị dạng văn bản. Với timezone, nhập IANA name, ví dụ: Asia/Ho_Chi_Minh',
    )
    description = models.TextField(
        blank=True, default='',
        verbose_name='Mô tả',
        help_text='Giải thích ý nghĩa và các giá trị hợp lệ của cấu hình này.',
    )
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='system_settings_updated',
        verbose_name='Người cập nhật',
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Cập nhật lúc')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Tạo lúc')

    class Meta:
        verbose_name = 'Cấu hình hệ thống'
        verbose_name_plural = 'Cấu hình hệ thống'
        ordering = ['key']

    def __str__(self):
        return f'{self.key} = {self.value}'
