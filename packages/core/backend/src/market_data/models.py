"""
Market Data domain models for packages/core.

DailyPrice: canonical OHLCV daily candle, replaces legacy portfolio data.
StockProfile: fundamental stock metadata.
VnstockRuntimeConfig: runtime configuration for vnstock adapter.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from django.db import models


class StockProfile(models.Model):
    """
    Static/slowly-changing stock metadata.
    """

    class ExchangeChoices(models.TextChoices):
        HOSE = 'HOSE', 'HOSE'
        HNX = 'HNX', 'HNX'
        UPCOM = 'UPCOM', 'UPCOM'
        UNLISTED = 'UNLISTED', 'Unlisted'

    class StatusChoices(models.TextChoices):
        ACTIVE = 'active', 'Đang niêm yết'
        SUSPENDED = 'suspended', 'Tạm dừng'
        DELISTED = 'delisted', 'Huỷ niêm yết'

    symbol = models.CharField(max_length=32, unique=True, db_index=True, verbose_name='Mã cổ phiếu')
    company_name = models.CharField(max_length=255, blank=True, default='', verbose_name='Tên công ty')
    exchange = models.CharField(
        max_length=16,
        choices=ExchangeChoices.choices,
        default=ExchangeChoices.HOSE,
        db_index=True,
        verbose_name='Sàn',
    )
    industry = models.CharField(max_length=128, blank=True, default='', verbose_name='Ngành')
    status = models.CharField(
        max_length=16,
        choices=StatusChoices.choices,
        default=StatusChoices.ACTIVE,
        db_index=True,
    )
    outstanding_shares = models.BigIntegerField(null=True, blank=True, verbose_name='Số CP lưu hành')
    metadata = models.JSONField(default=dict, blank=True)
    # Migration tracking
    legacy_symbol = models.CharField(max_length=32, blank=True, default='', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Hồ sơ cổ phiếu'
        verbose_name_plural = 'Hồ sơ cổ phiếu'
        ordering = ['symbol']

    def __str__(self) -> str:
        return f'{self.symbol} ({self.exchange})'


class DailyPrice(models.Model):
    """
    OHLCV daily price candle. One row per symbol per date.
    Source: vnstock adapter. Replaces legacy TickerSessionClose as the long-term canonical.
    """

    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    date = models.DateField(db_index=True, verbose_name='Ngày giao dịch')
    open = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá mở cửa')
    high = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá cao nhất')
    low = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá thấp nhất')
    close = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá đóng cửa')
    volume = models.BigIntegerField(verbose_name='Khối lượng khớp lệnh')
    value = models.BigIntegerField(null=True, blank=True, verbose_name='Giá trị khớp lệnh (VNĐ)')
    change_pct = models.DecimalField(max_digits=8, decimal_places=4, null=True, blank=True, verbose_name='% thay đổi')
    # Source / quality
    source = models.CharField(max_length=32, default='vnstock', verbose_name='Nguồn dữ liệu')
    is_adjusted = models.BooleanField(default=False, verbose_name='Đã điều chỉnh')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Giá ngày'
        verbose_name_plural = 'Giá ngày'
        unique_together = [('symbol', 'date')]
        ordering = ['-date', 'symbol']
        indexes = [
            models.Index(fields=['symbol', 'date']),
        ]

    def __str__(self) -> str:
        return f'{self.symbol} {self.date} close={self.close}'


class VnstockRuntimeConfig(models.Model):
    """
    Runtime configuration for the vnstock data adapter.
    Controls fetch concurrency, retry policy, rate limits, etc.
    """

    class SourceChoices(models.TextChoices):
        VCI = 'VCI', 'VCI (default)'
        KBS = 'KBS', 'KBS'
        TCBS = 'TCBS', 'TCBS'
        SSI = 'SSI', 'SSI'
        MSI = 'MSI', 'MSI'

    name = models.CharField(max_length=64, unique=True, verbose_name='Tên cấu hình')
    is_active = models.BooleanField(default=False, db_index=True, verbose_name='Đang kích hoạt')
    data_source = models.CharField(
        max_length=16,
        choices=SourceChoices.choices,
        default=SourceChoices.VCI,
        verbose_name='Nguồn dữ liệu vnstock',
    )
    max_workers = models.IntegerField(default=4, verbose_name='Số luồng tối đa')
    request_delay_ms = models.IntegerField(default=200, verbose_name='Độ trễ giữa request (ms)')
    max_retries = models.IntegerField(default=3, verbose_name='Số lần retry tối đa')
    batch_size = models.IntegerField(default=50, verbose_name='Số mã mỗi batch')
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình vnstock runtime'
        verbose_name_plural = 'Cấu hình vnstock runtime'

    def __str__(self) -> str:
        active_flag = ' [ACTIVE]' if self.is_active else ''
        return f'{self.name} ({self.data_source}){active_flag}'
