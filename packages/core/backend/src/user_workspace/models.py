"""
User Workspace domain models for packages/core.

Portfolio, Transaction, Watchlist/WatchlistItem replacing legacy counterparts.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Portfolio(models.Model):
    """
    Danh mục đầu tư của một người dùng trong core SaaS.
    Mirrors legacy Portfolio model.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_portfolios',
        verbose_name='Người dùng',
    )
    name = models.CharField(max_length=100, verbose_name='Tên danh mục')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    is_default = models.BooleanField(default=False, verbose_name='Danh mục mặc định')
    # Migration tracking
    legacy_portfolio_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Danh mục đầu tư'
        verbose_name_plural = 'Danh mục đầu tư'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.name} ({self.user.username})'


class Transaction(models.Model):
    """
    Giao dịch trong danh mục đầu tư core SaaS.
    """

    class TransactionType(models.TextChoices):
        BUY = 'BUY', 'Mua'
        SELL = 'SELL', 'Bán'
        DIVIDEND = 'DIVIDEND', 'Cổ tức tiền mặt'

    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='transactions',
        verbose_name='Danh mục',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    transaction_type = models.CharField(
        max_length=10,
        choices=TransactionType.choices,
        verbose_name='Loại lệnh',
    )
    date = models.DateField(db_index=True, verbose_name='Ngày giao dịch')
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá khớp (VNĐ)')
    quantity = models.BigIntegerField(verbose_name='Số lượng cổ phiếu')
    fee = models.DecimalField(max_digits=18, decimal_places=2, default=0, verbose_name='Phí giao dịch')
    tax = models.DecimalField(max_digits=18, decimal_places=2, default=0, verbose_name='Thuế')
    external_id = models.CharField(max_length=100, blank=True, default='', db_index=True, verbose_name='Mã tham chiếu broker')
    note = models.TextField(blank=True, default='', verbose_name='Ghi chú')
    # Migration tracking
    legacy_transaction_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Giao dịch'
        verbose_name_plural = 'Giao dịch'
        ordering = ['-date', '-pk']
        indexes = [
            models.Index(fields=['portfolio', 'symbol', 'date']),
        ]

    def __str__(self) -> str:
        return f'{self.transaction_type} {self.quantity} {self.symbol} @ {self.price}'


class Watchlist(models.Model):
    """
    Danh sách theo dõi cổ phiếu cá nhân.
    Mirrors legacy WatchlistGroup model.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_watchlists',
        verbose_name='Người dùng',
    )
    name = models.CharField(max_length=100, verbose_name='Tên danh sách')
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    is_default = models.BooleanField(default=False, verbose_name='Danh sách mặc định')
    # Migration tracking
    legacy_group_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Danh sách theo dõi'
        verbose_name_plural = 'Danh sách theo dõi'
        ordering = ['name']

    def __str__(self) -> str:
        return f'{self.name} ({self.user.username})'


class WatchlistItem(models.Model):
    """
    Một mã cổ phiếu trong danh sách theo dõi core.
    """

    watchlist = models.ForeignKey(
        Watchlist,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name='Danh sách',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    note = models.CharField(max_length=255, blank=True, default='', verbose_name='Ghi chú')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Mã theo dõi'
        verbose_name_plural = 'Mã theo dõi'
        unique_together = [('watchlist', 'symbol')]
        ordering = ['-added_at']

    def __str__(self) -> str:
        return f'{self.symbol} ({self.watchlist.name})'


class SubAccount(models.Model):
    """
    SFI-B4: Tiểu khoản môi giới (broker sub-account) của người dùng.
    """

    class TypeChoices(models.TextChoices):
        CASH = '1', 'Tiền mặt'
        MARGIN = '6', 'Ký quỹ'
        SPECIAL = '3', 'Đặc biệt'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_sub_accounts',
        verbose_name='Người dùng',
    )
    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='sub_accounts',
        null=True,
        blank=True,
        verbose_name='Danh mục',
    )
    broker = models.CharField(max_length=50, verbose_name='Tên công ty chứng khoán')
    account_number = models.CharField(max_length=64, blank=True, default='', verbose_name='Số tài khoản')
    name = models.CharField(max_length=100, blank=True, default='', verbose_name='Tên (legacy)')
    display_name = models.CharField(max_length=100, verbose_name='Tên hiển thị')
    type = models.CharField(
        max_length=10,
        choices=TypeChoices.choices,
        default=TypeChoices.CASH,
        verbose_name='Loại tài khoản'
    )
    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    
    # DNSE Integration fields
    external_id = models.CharField(max_length=100, blank=True, default='', db_index=True, verbose_name='Broker Account ID')
    broker_source = models.CharField(max_length=50, blank=True, default='', verbose_name='Nguồn Broker')
    sync_status = models.JSONField(default=dict, blank=True, verbose_name='Trạng thái đồng bộ')

    # Migration tracking
    legacy_sub_account_id = models.IntegerField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Tiểu khoản'
        verbose_name_plural = 'Tiểu khoản'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.display_name} — {self.broker} ({self.user.username})'


class DNSECredential(models.Model):
    """
    SFI-DNSE: Lưu trữ thông tin xác thực DNSE LightSpeed API của người dùng.

    Auth flow chuẩn: POST /v2/authentication/token với client_id + client_secret
    → nhận access_token (Bearer), cache ngắn hạn trong Redis.

    TUYỆT ĐỐI không lưu username/password tài khoản cá nhân DNSE —
    đó là retail login flow, không phải LightSpeed API integration.

    Dữ liệu được mã hóa Fernet trước khi lưu xuống DB.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='dnse_credential',
        verbose_name='Người dùng',
    )
    # LightSpeed API credentials — lấy từ trang quản lý EntradeX/LightSpeed
    client_id_cipher = models.TextField(blank=True, default='', verbose_name='Client ID (Encrypted)')
    client_secret_cipher = models.TextField(blank=True, default='', verbose_name='Client Secret (Encrypted)')

    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    last_sync_at = models.DateTimeField(null=True, blank=True, verbose_name='Đồng bộ cuối')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'DNSE LightSpeed Credential'
        verbose_name_plural = 'DNSE LightSpeed Credentials'

    def __str__(self):
        return f"DNSE LightSpeed Credential for {self.user.username}"

    def set_client_id(self, raw_val: str) -> None:
        from vninvest_core.utils.encryption import encrypt_string
        self.client_id_cipher = encrypt_string(raw_val)

    def get_client_id(self) -> str:
        from vninvest_core.utils.encryption import decrypt_string
        return decrypt_string(self.client_id_cipher)

    def set_client_secret(self, raw_val: str) -> None:
        from vninvest_core.utils.encryption import encrypt_string
        self.client_secret_cipher = encrypt_string(raw_val)

    def get_client_secret(self) -> str:
        from vninvest_core.utils.encryption import decrypt_string
        return decrypt_string(self.client_secret_cipher)

    def has_credentials(self) -> bool:
        """Kiểm tra đã cấu hình đủ client_id và client_secret chưa."""
        return bool(self.client_id_cipher and self.client_secret_cipher)


class AccountSnapshot(models.Model):
    """
    SFI-DNSE: Lưu snapshot tài khoản định kỳ.
    """
    sub_account = models.ForeignKey(
        SubAccount,
        on_delete=models.CASCADE,
        related_name='snapshots',
        verbose_name='Tiểu khoản',
    )
    date = models.DateField(db_index=True, verbose_name='Ngày')
    net_equity = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='NAV')
    cash_balance = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='Số dư tiền')
    stock_value = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='Giá trị chứng khoán')
    debt = models.DecimalField(max_digits=20, decimal_places=2, default=0, verbose_name='Nợ')
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Account Snapshot'
        verbose_name_plural = 'Account Snapshots'
        unique_together = [('sub_account', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f"{self.sub_account.display_name} @ {self.date}"

    @property
    def nav(self):
        return self.net_equity
