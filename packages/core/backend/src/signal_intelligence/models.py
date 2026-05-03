"""
Signal intelligence models for packages/core.

UnifiedAlert: canonical model for all alert types.
WhaleAlertCanonical: whale alert with full metadata.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import uuid

from django.db import models


class UnifiedAlert(models.Model):
    class AlertTypeChoices(models.TextChoices):
        WHALE = 'whale', 'Whale'
        DARK_FLOW = 'dark_flow', 'Dark Flow'
        SIGNAL = 'signal', 'Signal'
        SYSTEM = 'system', 'System'

    class SeverityChoices(models.TextChoices):
        CRITICAL = 'critical', 'Critical'
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'

    class DirectionChoices(models.TextChoices):
        BUY = 'buy', 'Buy'
        SELL = 'sell', 'Sell'
        NEUTRAL = 'neutral', 'Neutral'

    alert_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    alert_type = models.CharField(max_length=16, choices=AlertTypeChoices.choices, db_index=True)
    symbol = models.CharField(max_length=32, db_index=True)
    severity = models.CharField(max_length=16, choices=SeverityChoices.choices, default=SeverityChoices.MEDIUM, db_index=True)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default='')
    value = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    direction = models.CharField(
        max_length=8,
        choices=DirectionChoices.choices,
        null=True,
        blank=True,
    )
    session_date = models.DateField(db_index=True)
    triggered_at = models.DateTimeField(db_index=True)
    source_ref = models.CharField(max_length=255, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Unified Alert'
        verbose_name_plural = 'Unified Alerts'
        ordering = ['-triggered_at', '-pk']
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'alert_type']),
            models.Index(fields=['severity', 'triggered_at']),
        ]

    def __str__(self):
        return f'[{self.alert_type}/{self.severity}] {self.symbol}: {self.title}'


class WhaleAlertCanonical(models.Model):
    class SideChoices(models.TextChoices):
        BUY = 'buy', 'Buy'
        SELL = 'sell', 'Sell'

    alert = models.OneToOneField(
        UnifiedAlert,
        on_delete=models.CASCADE,
        related_name='whale_detail',
        primary_key=True,
    )
    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)
    side = models.CharField(max_length=4, choices=SideChoices.choices, db_index=True)
    price = models.DecimalField(max_digits=18, decimal_places=2)
    volume = models.BigIntegerField()
    matched_value = models.BigIntegerField()
    is_dark_flow = models.BooleanField(default=False, db_index=True)
    order_id = models.CharField(max_length=64, blank=True, default='')
    executed_at = models.DateTimeField()

    class Meta:
        verbose_name = 'Whale Alert Canonical'
        verbose_name_plural = 'Whale Alert Canonicals'
        ordering = ['-executed_at', '-pk']
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'side']),
            models.Index(fields=['is_dark_flow', 'executed_at']),
        ]

    def __str__(self):
        return f'{self.side.upper()} {self.symbol} {self.matched_value:,}đ'
