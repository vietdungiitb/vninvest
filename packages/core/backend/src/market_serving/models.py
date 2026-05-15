"""
Market serving read models for packages/core.

SymbolSnapshot and SessionFacts are materializer-populated read models.
Data is written by Celery materializers (SAAS-14 scope).

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from django.db import models


class SymbolSnapshot(models.Model):
    """
    Latest price/volume snapshot for a symbol.
    Materializer-populated; updated on every session tick.
    """
    class MarketStatusChoices(models.TextChoices):
        OPEN = 'open', 'Open'
        CLOSED = 'closed', 'Closed'
        PRE_OPEN = 'pre-open', 'Pre-Open'
        HALTED = 'halted', 'Halted'
        ATO = 'ato', 'ATO'
        ATC = 'atc', 'ATC'

    class SourceChoices(models.TextChoices):
        LIVE = 'live', 'Live'
        CACHE = 'cache', 'Cache'
        DEGRADED = 'degraded', 'Degraded'
        LEGACY_SYNC = 'legacy_sync', 'Legacy Sync'
        CORE = 'core', 'Core'

    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)
    price = models.DecimalField(max_digits=18, decimal_places=2)
    price_change = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    price_change_pct = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    volume = models.BigIntegerField(default=0)
    reference_price = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, help_text="Previous close price (nền giá)")
    ceiling = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, help_text="Price ceiling (trần = reference * 1.07)")
    floor = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, help_text="Price floor (sàn = reference * 0.93)")
    open = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, help_text="Session open price (giá mở cửa phiên)")
    high = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, help_text="Session high price (giá cao nhất phiên)")
    low = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, help_text="Session low price (giá thấp nhất phiên)")
    market_status = models.CharField(
        max_length=16,
        choices=MarketStatusChoices.choices,
        default=MarketStatusChoices.CLOSED,
    )
    source = models.CharField(
        max_length=16,
        choices=SourceChoices.choices,
        default=SourceChoices.CACHE,
    )
    stale = models.BooleanField(default=False, db_index=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Symbol Snapshot'
        verbose_name_plural = 'Symbol Snapshots'
        unique_together = [('symbol', 'session_date')]
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'stale']),
        ]

    def __str__(self):
        return f'{self.symbol} @ {self.session_date} = {self.price}'


class SessionFacts(models.Model):
    """
    Session aggregate facts per symbol: CVD, strengths, whale flow.
    Materializer-populated (SAAS-14 scope).
    """
    class SourceChoices(models.TextChoices):
        LIVE = 'live', 'Live'
        CACHE = 'cache', 'Cache'
        DEGRADED = 'degraded', 'Degraded'
        COMPUTED = 'computed', 'Computed'

    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)

    # CVD normalized [-1, 1]
    cvd_normalized = models.FloatField(default=0.0)
    # Strengths [0, 1]
    buy_strength = models.FloatField(default=0.0)
    institutional_strength = models.FloatField(default=0.0)
    # Whale flow (VND)
    whale_net_flow = models.BigIntegerField(default=0)
    dark_flow_score = models.FloatField(default=0.0)
    # Volume aggregates
    total_buy_volume = models.BigIntegerField(default=0)
    total_sell_volume = models.BigIntegerField(default=0)

    source = models.CharField(
        max_length=16,
        choices=SourceChoices.choices,
        default=SourceChoices.CACHE,
    )
    stale = models.BooleanField(default=False, db_index=True)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Session Facts'
        verbose_name_plural = 'Session Facts'
        unique_together = [('symbol', 'session_date')]
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'stale']),
        ]

    def __str__(self):
        return f'{self.symbol} @ {self.session_date} CVD={self.cvd_normalized:.2f}'


class SessionFactsBucket(models.Model):
    """
    Materialized flow buckets for a specific SessionFacts row and window.
    """

    session_facts = models.ForeignKey(
        SessionFacts,
        on_delete=models.CASCADE,
        related_name='buckets',
    )
    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)
    window = models.CharField(max_length=8, db_index=True)
    bucket_minutes = models.PositiveIntegerField()
    bucket_ts = models.DateTimeField(db_index=True)
    cumulative_cvd = models.FloatField(default=0.0)
    buy_strength = models.FloatField(default=0.0)
    institutional_strength = models.FloatField(default=0.0)
    buy_volume = models.BigIntegerField(default=0)
    sell_volume = models.BigIntegerField(default=0)

    class Meta:
        verbose_name = 'Session Facts Bucket'
        verbose_name_plural = 'Session Facts Buckets'
        ordering = ['session_date', 'window', 'bucket_ts', 'pk']
        unique_together = [('session_facts', 'window', 'bucket_ts')]
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'window', 'bucket_ts']),
            models.Index(fields=['session_facts', 'window', 'bucket_ts']),
        ]

    def __str__(self):
        return f'{self.symbol} {self.session_date} {self.window} {self.bucket_ts.isoformat()}'
