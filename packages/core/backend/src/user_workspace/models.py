"""
User Workspace domain models for packages/core.

Portfolio, Transaction, Watchlist/WatchlistItem replacing legacy counterparts.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from django.contrib.auth.models import User
from django.db import models


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
    Dùng để phân nhóm danh mục theo tài khoản chứng khoán thực tế.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='core_sub_accounts',
        verbose_name='Người dùng',
    )
    broker = models.CharField(max_length=50, verbose_name='Tên công ty chứng khoán')
    account_number = models.CharField(max_length=64, blank=True, default='', verbose_name='Số tài khoản')
    display_name = models.CharField(max_length=100, verbose_name='Tên hiển thị')
    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
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
