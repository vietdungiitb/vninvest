from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
from decimal import Decimal
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
    name = models.CharField(max_length=100, verbose_name='Tên nhóm')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Nhóm Watchlist'
        verbose_name_plural = 'Nhóm Watchlist'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.user.username})'


class WatchlistItem(models.Model):
    """
    Một mã chứng khoán do user chọn theo dõi, thuộc một nhóm watchlist cá nhân.
    """
    group = models.ForeignKey(
        WatchlistGroup, on_delete=models.CASCADE,
        related_name='items', verbose_name='Nhóm watchlist',
    )
    symbol = models.CharField(max_length=10, verbose_name='Mã chứng khoán', db_index=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã theo dõi'
        verbose_name_plural = 'Mã theo dõi'
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


class SecuritiesGroup(models.Model):
    """
    Nhóm theo dõi cổ phiếu (theo ngành hoặc vốn hóa).
    Ví dụ: Ngân hàng, VN30, Midcap, Bất động sản...
    """
    class GroupType(models.TextChoices):
        SECTOR = 'SECTOR', 'Nhóm ngành'
        MARKET_CAP = 'MARKET_CAP', 'Nhóm vốn hóa'
        CUSTOM = 'CUSTOM', 'Tùy chỉnh'

    user = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='securities_groups', verbose_name='Người dùng',
    )
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
        verbose_name = 'Nhóm Chứng khoán'
        verbose_name_plural = 'Nhóm Chứng khoán'
        ordering = ['order', 'name']

    def __str__(self):
        return f'{self.name} ({self.user.username})'


SecuritiesGroupAlias = SecuritiesGroup  # backward-compat alias


class SecuritiesItem(models.Model):
    """Một mã chứng khoán trong một nhóm."""
    group = models.ForeignKey(
        SecuritiesGroup, on_delete=models.CASCADE,
        related_name='items', verbose_name='Nhóm',
    )
    symbol = models.CharField(max_length=10, verbose_name='Mã chứng khoán', db_index=True)
    order = models.PositiveIntegerField(default=0, verbose_name='Thứ tự')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã chứng khoán'
        verbose_name_plural = 'Mã chứng khoán'
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
        related_name='tracked_from', verbose_name='Nhóm nguồn',
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã Theo dõi'
        verbose_name_plural = 'Mã Theo dõi'
        unique_together = [('user', 'symbol')]
        ordering = ['-added_at']

    def __str__(self):
        return f'{self.symbol} ({self.user.username})'



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
    """
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình người dùng'
        verbose_name_plural = 'Cấu hình người dùng'

    def __str__(self):
        return f'Cấu hình {self.user.username} (threshold: {self.whale_alert_threshold:,}M)'
