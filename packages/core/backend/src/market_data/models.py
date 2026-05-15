"""
Market Data domain models for packages/core.

DailyPrice: canonical OHLCV daily candle, replaces legacy portfolio data.
StockProfile: fundamental stock metadata.
VnbrokerRuntimeConfig: runtime configuration for vnbroker adapter.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


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
    Source: vnbroker adapter. Replaces legacy TickerSessionClose as the long-term canonical.
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
    source = models.CharField(max_length=32, default='vnbroker', verbose_name='Nguồn dữ liệu')
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


class VnbrokerRuntimeConfig(models.Model):
    """
    Runtime configuration for the vnbroker data adapter.
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
        verbose_name='Nguồn dữ liệu vnbroker',
    )
    max_workers = models.IntegerField(default=4, verbose_name='Số luồng tối đa')
    request_delay_ms = models.IntegerField(default=200, verbose_name='Độ trễ giữa request (ms)')
    max_retries = models.IntegerField(default=3, verbose_name='Số lần retry tối đa')
    batch_size = models.IntegerField(default=50, verbose_name='Số mã mỗi batch')
    extra = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình vnbroker runtime'
        verbose_name_plural = 'Cấu hình vnbroker runtime'

    def __str__(self) -> str:
        active_flag = ' [ACTIVE]' if self.is_active else ''
        return f'{self.name} ({self.data_source}){active_flag}'


class IntradayBar(models.Model):
    """
    Intraday OHLCV bars from vnbroker (1m, 5m, 15m, 1H, 2H, 4H, D, W, M).
    Phase 2: Native storage (replaces bridge).
    """

    symbol = models.CharField(max_length=10, db_index=True, verbose_name='Mã cổ phiếu')
    datetime = models.DateTimeField(db_index=True, verbose_name='Thời gian khôi đầu nến')
    timeframe = models.CharField(max_length=5, default='1H', verbose_name='Khung thời gian')
    open = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá mở')
    high = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá cao')
    low = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá thấp')
    close = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá đóng')
    volume = models.BigIntegerField(default=0, verbose_name='Khối lượng')
    source = models.CharField(max_length=50, default='vnbroker', verbose_name='Nguồn dữ liệu')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'market_data_intraday_bar'
        verbose_name = 'Nến intraday'
        verbose_name_plural = 'Nến intraday'
        indexes = [
            models.Index(fields=['symbol', 'datetime']),
            models.Index(fields=['symbol', 'timeframe', 'datetime']),
        ]
        unique_together = [['symbol', 'datetime', 'timeframe']]
        ordering = ['-datetime']

    def __str__(self) -> str:
        return f'{self.symbol} {self.timeframe} {self.datetime} {self.close}'


class IntradayTick(models.Model):
    """
    Individual tick trades from vnbroker (real-time).
    Phase 2: Native storage + Redis cache (5 min TTL).
    """

    class SideChoices(models.TextChoices):
        BUY = 'BUY', 'Mua'
        SELL = 'SELL', 'Bán'
        UNKNOWN = 'UNKNOWN', 'Không xác định'

    symbol = models.CharField(max_length=10, db_index=True, verbose_name='Mã cổ phiếu')
    timestamp = models.DateTimeField(db_index=True, verbose_name='Thời điểm khớp lệnh')
    price = models.DecimalField(max_digits=18, decimal_places=2, verbose_name='Giá khớp lệnh')
    volume = models.BigIntegerField(verbose_name='Khối lượng khớp lệnh')
    side = models.CharField(
        max_length=10,
        choices=SideChoices.choices,
        verbose_name='Hướng giao dịch',
    )
    match_type = models.CharField(max_length=50, blank=True, default='', verbose_name='Loại khớp lệnh')
    source = models.CharField(max_length=50, default='vnbroker', verbose_name='Nguồn dữ liệu')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'market_data_intraday_tick'
        verbose_name = 'Tick lệnh intraday'
        verbose_name_plural = 'Tick lệnh intraday'
        indexes = [
            models.Index(fields=['symbol', 'timestamp']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-timestamp']

    def __str__(self) -> str:
        return f'{self.symbol} {self.timestamp} {self.price} {self.side}'


class GlobalSymbolRegistry(models.Model):
    """
    Persistent SSOT row for a symbol in the shared market-data matrix.
    """

    class PriorityTierChoices(models.TextChoices):
        HOT = 'hot', 'Hot'
        WARM = 'warm', 'Warm'
        COLD = 'cold', 'Cold'
        RECOVERY = 'recovery', 'Recovery'

    symbol = models.CharField(max_length=32, unique=True, db_index=True, verbose_name='Mã cổ phiếu')
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='Đang thuộc active crawl set')
    current_priority_tier = models.CharField(
        max_length=16,
        choices=PriorityTierChoices.choices,
        default=PriorityTierChoices.COLD,
        db_index=True,
        verbose_name='Tier ưu tiên hiện hành',
    )
    priority_score = models.FloatField(default=0.0, verbose_name='Điểm ưu tiên')
    demand_source_count = models.PositiveIntegerField(default=0, verbose_name='Số demand source đang active')
    last_demand_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='Lần demand cuối')
    last_hydrated_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='Lần hydrate cuối')
    latest_trade_date = models.DateField(null=True, blank=True, db_index=True, verbose_name='Phiên dữ liệu đầy đủ gần nhất')
    freshness_state_summary = models.CharField(max_length=16, default='unknown', db_index=True, verbose_name='Tóm tắt freshness')
    coverage_state_summary = models.CharField(max_length=16, default='unknown', db_index=True, verbose_name='Tóm tắt coverage')
    decay_after_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='Thời điểm hết decay window')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Global symbol registry'
        verbose_name_plural = 'Global symbol registry'
        ordering = ['symbol']
        indexes = [
            models.Index(fields=['is_active', 'current_priority_tier'], name='mktdata_gsr_active_tier_idx'),
            models.Index(fields=['freshness_state_summary', 'coverage_state_summary'], name='mktdata_gsr_fresh_cov_idx'),
        ]

    def __str__(self) -> str:
        return f'{self.symbol} [{self.current_priority_tier}]'


class GlobalSymbolDemandSource(models.Model):
    """
    Active/inactive demand edges that pull a symbol into the global matrix.
    """

    class SourceTypeChoices(models.TextChoices):
        SYSTEM_DEFAULT = 'system_default', 'System default'
        ADMIN_GROUP = 'admin_group', 'Admin group'
        HOLDING = 'holding', 'Holding'
        WATCHLIST = 'watchlist', 'Watchlist'
        TRACKED_SYMBOL = 'tracked_symbol', 'Tracked symbol'
        ALERT = 'alert', 'Alert'

    registry = models.ForeignKey(
        GlobalSymbolRegistry,
        on_delete=models.CASCADE,
        related_name='demand_sources',
        verbose_name='Registry',
    )
    source_type = models.CharField(
        max_length=32,
        choices=SourceTypeChoices.choices,
        db_index=True,
        verbose_name='Loại demand source',
    )
    source_ref = models.CharField(max_length=128, db_index=True, verbose_name='Định danh source')
    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.SET_NULL,
        related_name='global_symbol_demand_sources',
        null=True,
        blank=True,
        verbose_name='Tenant',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='global_symbol_demand_sources',
        null=True,
        blank=True,
        verbose_name='Người dùng',
    )
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='Đang active')
    activated_at = models.DateTimeField(default=timezone.now, verbose_name='Thời điểm activate')
    deactivated_at = models.DateTimeField(null=True, blank=True, verbose_name='Thời điểm deactivate')
    weight = models.FloatField(default=1.0, verbose_name='Trọng số demand')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Global symbol demand source'
        verbose_name_plural = 'Global symbol demand sources'
        ordering = ['registry__symbol', 'source_type', 'source_ref']
        constraints = [
            models.UniqueConstraint(
                fields=['registry', 'source_type', 'source_ref'],
                name='mktdata_gsd_unique_source',
            ),
        ]
        indexes = [
            models.Index(fields=['source_type', 'is_active'], name='mktdata_gsd_source_active_idx'),
            models.Index(fields=['tenant', 'source_type', 'is_active'], name='mktdata_gsd_tenant_source_idx'),
            models.Index(fields=['user', 'source_type', 'is_active'], name='mktdata_gsd_user_source_idx'),
        ]

    def __str__(self) -> str:
        return f'{self.registry.symbol}:{self.source_type}:{self.source_ref}'


class GlobalSymbolCoverage(models.Model):
    """
    Coverage/freshness inventory for a symbol per dataset.
    """

    class DatasetChoices(models.TextChoices):
        DAILY_PRICES = 'daily_prices', 'Daily prices'
        PRICE_BOARD_SNAPSHOT = 'price_board_snapshot', 'Price board snapshot'
        INTRADAY_BARS = 'intraday_bars', 'Intraday bars'
        INTRADAY_TICKS = 'intraday_ticks', 'Intraday ticks'
        SESSION_FACTS = 'session_facts', 'Session facts'

    class FreshnessChoices(models.TextChoices):
        FRESH = 'fresh', 'Fresh'
        WARM = 'warm', 'Warm'
        STALE = 'stale', 'Stale'
        MISSING = 'missing', 'Missing'
        ERROR = 'error', 'Error'
        UNKNOWN = 'unknown', 'Unknown'

    registry = models.ForeignKey(
        GlobalSymbolRegistry,
        on_delete=models.CASCADE,
        related_name='coverage_rows',
        verbose_name='Registry',
    )
    dataset = models.CharField(max_length=32, choices=DatasetChoices.choices, db_index=True, verbose_name='Dataset')
    latest_available_at = models.DateTimeField(null=True, blank=True, verbose_name='Mốc dữ liệu mới nhất')
    oldest_available_at = models.DateTimeField(null=True, blank=True, verbose_name='Mốc dữ liệu cũ nhất')
    latest_complete_trade_date = models.DateField(null=True, blank=True, verbose_name='Phiên hoàn chỉnh mới nhất')
    freshness_state = models.CharField(
        max_length=16,
        choices=FreshnessChoices.choices,
        default=FreshnessChoices.UNKNOWN,
        db_index=True,
        verbose_name='Trạng thái freshness',
    )
    missing_ranges = models.JSONField(default=list, blank=True)
    last_verified_at = models.DateTimeField(null=True, blank=True, verbose_name='Lần verify cuối')
    next_recommended_action = models.CharField(max_length=64, blank=True, default='', verbose_name='Hành động kế tiếp')
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Global symbol coverage'
        verbose_name_plural = 'Global symbol coverage'
        ordering = ['registry__symbol', 'dataset']
        constraints = [
            models.UniqueConstraint(
                fields=['registry', 'dataset'],
                name='mktdata_gsc_unique_dataset',
            ),
        ]
        indexes = [
            models.Index(fields=['dataset', 'freshness_state'], name='mktdata_gsc_dataset_state_idx'),
            models.Index(fields=['registry', 'dataset', 'freshness_state'], name='mktdata_gsc_reg_dataset_idx'),
        ]

    def __str__(self) -> str:
        return f'{self.registry.symbol}:{self.dataset}:{self.freshness_state}'
