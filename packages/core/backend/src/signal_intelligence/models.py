"""
Signal intelligence models for packages/core.

UnifiedAlert: canonical model for all alert types.
WhaleAlertCanonical: whale alert with full metadata.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import uuid

from django.conf import settings
from django.db import models


class UnifiedAlert(models.Model):
    class AlertTypeChoices(models.TextChoices):
        WHALE = 'whale', 'Whale'
        DARK_FLOW = 'dark_flow', 'Dark Flow'
        SIGNAL = 'signal', 'Signal'
        SYSTEM = 'system', 'System'
        AI_ALERT = 'ai_alert', 'AI Alert'
        AI_SUGGEST = 'ai_suggest', 'AI Suggest'

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
    confidence = models.FloatField(default=0.0, db_index=True)
    freshness_state = models.CharField(max_length=16, default='fresh', db_index=True)
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
    evidence = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Unified Alert'
        verbose_name_plural = 'Unified Alerts'
        ordering = ['-triggered_at', '-pk']
        constraints = [
            models.UniqueConstraint(
                fields=['source_ref'],
                condition=~models.Q(source_ref=''),
                name='uq_unified_alert_source_ref_nonempty',
            ),
        ]
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


class OrderFlowEvent(models.Model):
    """
    Canonical order flow signal event in the SaaS core.

    Mirrors portfolio_orderflowsignal from legacy DB.
    ISOLATION RULE: No FK to backend.portfolio models.
    """

    class SideChoices(models.TextChoices):
        BUY = 'buy', 'Buy'
        SELL = 'sell', 'Sell'
        NEUTRAL = 'neutral', 'Neutral'

    class SignalTypeChoices(models.TextChoices):
        WHALE_BUY = 'whale_buy', 'Whale Buy'
        WHALE_SELL = 'whale_sell', 'Whale Sell'
        DARK_FLOW = 'dark_flow', 'Dark Flow'
        ORDER_IMBALANCE = 'order_imbalance', 'Order Imbalance'
        CVD_DIVERGENCE = 'cvd_divergence', 'CVD Divergence'
        OTHER = 'other', 'Other'

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)
    signal_type = models.CharField(max_length=32, choices=SignalTypeChoices.choices, db_index=True)
    side = models.CharField(max_length=8, choices=SideChoices.choices, default=SideChoices.NEUTRAL, db_index=True)
    # Core signal metrics
    strength = models.FloatField(default=0.0)
    whale_intensity = models.FloatField(default=0.0)
    cvd_at_signal = models.FloatField(null=True, blank=True)
    price_at_signal = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    volume_at_signal = models.BigIntegerField(null=True, blank=True)
    # Forensic linkage
    source_ref = models.CharField(max_length=255, blank=True, default='', db_index=True)
    unified_alert = models.ForeignKey(
        UnifiedAlert,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='order_flow_events',
    )
    metadata = models.JSONField(default=dict, blank=True)
    triggered_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Order Flow Event'
        verbose_name_plural = 'Order Flow Events'
        ordering = ['-triggered_at', '-pk']
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'signal_type']),
            models.Index(fields=['side', 'triggered_at']),
        ]

    def __str__(self) -> str:
        return f'[{self.signal_type}] {self.symbol} @ {self.session_date}'


class MarketAnomalyEvent(models.Model):
    class EventTypeChoices(models.TextChoices):
        PRICE_SHOCK = 'price_shock', 'Price Shock'
        STALE_QUOTE = 'stale_quote', 'Stale Quote'

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)
    event_type = models.CharField(max_length=16, choices=EventTypeChoices.choices, db_index=True)
    severity = models.CharField(max_length=16, choices=UnifiedAlert.SeverityChoices.choices, db_index=True)
    confidence = models.FloatField(default=0.0, db_index=True)
    direction = models.CharField(
        max_length=8,
        choices=UnifiedAlert.DirectionChoices.choices,
        default=UnifiedAlert.DirectionChoices.NEUTRAL,
        db_index=True,
    )
    value = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    source_ref = models.CharField(max_length=255, blank=True, default='', db_index=True)
    evidence = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    triggered_at = models.DateTimeField(db_index=True)
    unified_alert = models.ForeignKey(
        UnifiedAlert,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='market_anomaly_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Market Anomaly Event'
        verbose_name_plural = 'Market Anomaly Events'
        ordering = ['-triggered_at', '-pk']
        constraints = [
            models.UniqueConstraint(
                fields=['source_ref'],
                condition=~models.Q(source_ref=''),
                name='uq_market_anomaly_event_source_ref_nonempty',
            ),
        ]
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'event_type']),
            models.Index(fields=['severity', 'triggered_at']),
        ]

    def __str__(self) -> str:
        return f'[{self.event_type}] {self.symbol} @ {self.session_date}'


class AdvisorySignalEvent(models.Model):
    class SignalTypeChoices(models.TextChoices):
        AI_ALERT = 'ai_alert', 'AI Alert'
        AI_SUGGEST = 'ai_suggest', 'AI Suggest'

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    symbol = models.CharField(max_length=32, db_index=True)
    session_date = models.DateField(db_index=True)
    signal_type = models.CharField(max_length=16, choices=SignalTypeChoices.choices, db_index=True)
    severity = models.CharField(max_length=16, choices=UnifiedAlert.SeverityChoices.choices, db_index=True)
    confidence = models.FloatField(default=0.0, db_index=True)
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True, default='')
    value = models.DecimalField(max_digits=24, decimal_places=2, null=True, blank=True)
    source_ref = models.CharField(max_length=255, blank=True, default='', db_index=True)
    evidence = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    triggered_at = models.DateTimeField(db_index=True)
    unified_alert = models.ForeignKey(
        UnifiedAlert,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='advisory_signal_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Advisory Signal Event'
        verbose_name_plural = 'Advisory Signal Events'
        ordering = ['-triggered_at', '-pk']
        constraints = [
            models.UniqueConstraint(
                fields=['source_ref'],
                condition=~models.Q(source_ref=''),
                name='uq_advisory_signal_event_source_ref_nonempty',
            ),
        ]
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'signal_type']),
            models.Index(fields=['severity', 'triggered_at']),
        ]

    def __str__(self) -> str:
        return f'[{self.signal_type}] {self.symbol} @ {self.session_date}'


class UserAlertDelivery(models.Model):
    class DeliveryStateChoices(models.TextChoices):
        NEW = 'new', 'New'
        SEEN = 'seen', 'Seen'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        MUTED = 'muted', 'Muted'
        SUPPRESSED = 'suppressed', 'Suppressed'

    delivery_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alert_deliveries')
    alert = models.ForeignKey(UnifiedAlert, on_delete=models.CASCADE, related_name='deliveries')
    delivery_state = models.CharField(max_length=16, choices=DeliveryStateChoices.choices, default=DeliveryStateChoices.NEW, db_index=True)
    delivered_at = models.DateTimeField(auto_now_add=True, db_index=True)
    seen_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    suppression_reason = models.CharField(max_length=255, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Alert Delivery'
        verbose_name_plural = 'User Alert Deliveries'
        ordering = ['-delivered_at', '-pk']
        constraints = [
            models.UniqueConstraint(fields=['user', 'alert'], name='uq_user_alert_delivery_user_alert'),
        ]
        indexes = [
            models.Index(fields=['user', 'delivery_state', 'delivered_at']),
            models.Index(fields=['alert', 'delivery_state']),
        ]

    def __str__(self) -> str:
        return f'{self.user_id}:{self.alert_id}:{self.delivery_state}'


class UserAlertPreference(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alert_preferences')
    symbol = models.CharField(max_length=32, db_index=True)
    alert_family = models.CharField(max_length=32, db_index=True)
    mute_until = models.DateTimeField(null=True, blank=True)
    cooldown_seconds = models.PositiveIntegerField(default=0)
    channel_policy = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User Alert Preference'
        verbose_name_plural = 'User Alert Preferences'
        ordering = ['user_id', 'symbol', 'alert_family']
        constraints = [
            models.UniqueConstraint(fields=['user', 'symbol', 'alert_family'], name='uq_user_alert_preference_scope'),
        ]
        indexes = [
            models.Index(fields=['user', 'symbol', 'alert_family']),
            models.Index(fields=['mute_until']),
        ]

    def __str__(self) -> str:
        return f'{self.user_id}:{self.symbol}:{self.alert_family}'
