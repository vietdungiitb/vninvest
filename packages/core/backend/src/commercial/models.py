import uuid
"""
Commercial models: Subscription, QuotaRecord, Invoice.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
from django.db import models

from identity_access.models import CoreTenant


class Subscription(models.Model):
    class StatusChoices(models.TextChoices):
        ACTIVE = 'active', 'Active'
        CANCELLED = 'cancelled', 'Cancelled'
        PAST_DUE = 'past_due', 'Past Due'
        TRIALING = 'trialing', 'Trialing'

    tenant = models.OneToOneField(
        CoreTenant,
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.CharField(max_length=32)
    status = models.CharField(max_length=16, choices=StatusChoices.choices, default=StatusChoices.ACTIVE, db_index=True)
    current_period_start = models.DateField()
    current_period_end = models.DateField()
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Subscription'

    def __str__(self):
        return f'{self.tenant} — {self.plan} ({self.status})'


class QuotaRecord(models.Model):
    """Usage quota tracking per tenant per period."""
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='quota_records')
    period_start = models.DateField()
    period_end = models.DateField()
    api_calls_used = models.BigIntegerField(default=0)
    api_calls_limit = models.BigIntegerField(default=-1)  # -1 = unlimited
    symbols_used = models.IntegerField(default=0)
    symbols_limit = models.IntegerField(default=-1)
    users_used = models.IntegerField(default=0)
    users_limit = models.IntegerField(default=-1)
    storage_mb_used = models.IntegerField(default=0)
    storage_mb_limit = models.IntegerField(default=-1)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Quota Record'
        unique_together = [('tenant', 'period_start', 'period_end')]

    def __str__(self):
        return f'{self.tenant} quota {self.period_start}→{self.period_end}'


class Invoice(models.Model):
    class StatusChoices(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        OPEN = 'open', 'Open'
        PAST_DUE = 'past_due', 'Past Due'
        PAID = 'paid', 'Paid'
        VOID = 'void', 'Void'
        UNCOLLECTIBLE = 'uncollectible', 'Uncollectible'

    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(max_length=64, unique=True, db_index=True)
    status = models.CharField(max_length=16, choices=StatusChoices.choices, default=StatusChoices.DRAFT, db_index=True)
    amount_due = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default='VND')
    period_start = models.DateField()
    period_end = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    line_items = models.JSONField(default=dict, blank=True, help_text='Breakdown: {"subscription": 1500000, "api_overage": 500000, "storage": 0}')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Invoice'
        ordering = ['-created_at']

    def __str__(self):
        return f'Invoice {self.invoice_number} ({self.status})'


class PaymentTransaction(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        REFUNDED = 'refunded', 'Refunded'

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='payments')
    txn_ref = models.CharField(max_length=64, unique=True, db_index=True)  # vnp_TxnRef
    vnp_transaction_no = models.CharField(max_length=64, null=True, blank=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    plan = models.CharField(max_length=32, null=True, blank=True, db_index=True,
                            help_text='Canonical plan code (starter/pro/enterprise) captured at payment creation.')
    status = models.CharField(max_length=16, choices=StatusChoices.choices, default=StatusChoices.PENDING, db_index=True)
    pay_url = models.TextField(null=True, blank=True)
    error_code = models.CharField(max_length=16, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Payment Transaction'

    def __str__(self):
        return f'{self.txn_ref} — {self.amount} ({self.status})'


class VNPayIPNLog(models.Model):
    txn_ref = models.CharField(max_length=64, db_index=True)
    raw_query = models.TextField()
    is_valid_signature = models.BooleanField(default=False)
    processed = models.BooleanField(default=False)
    error_message = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'VNPay IPN Log'

    def __str__(self):
        return f'IPN Log {self.txn_ref} at {self.created_at}'


class QuotaHistory(models.Model):
    """Daily snapshot of quota usage for historical tracking and charts."""
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name='quota_history')
    date = models.DateField(db_index=True)
    meter_code = models.CharField(max_length=64, db_index=True)
    meter_name = models.CharField(max_length=128)
    unit = models.CharField(max_length=32)
    consumed_amount = models.BigIntegerField(default=0)
    entitled_amount = models.BigIntegerField(default=-1)  # -1 = unlimited
    remaining_amount = models.BigIntegerField(default=0)
    risk_state = models.CharField(max_length=16, choices=[
        ('normal', 'Normal'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ], default='normal')
    hard_stop = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Quota History'
        verbose_name_plural = 'Quota History'
        unique_together = [('tenant', 'date', 'meter_code')]
        ordering = ['-date', 'meter_code']
        indexes = [
            models.Index(fields=['tenant', 'date']),
            models.Index(fields=['tenant', 'meter_code', 'date']),
        ]

    def __str__(self):
        return f'{self.tenant} — {self.meter_code} on {self.date}: {self.consumed_amount}/{self.entitled_amount}'

import uuid


class LicenseKey(models.Model):
    class TierChoices(models.TextChoices):
        PRO = "pro", "Pro"
        ENTERPRISE = "enterprise", "Enterprise"
        ACADEMIC = "academic", "Academic"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(CoreTenant, on_delete=models.CASCADE, related_name="license_keys")
    key_blob = models.TextField(help_text="Signed license blob")
    tier = models.CharField(max_length=20, choices=TierChoices.choices)
    domain_binding = models.CharField(max_length=255, blank=True, help_text="Allowed hostname")
    issued_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    issued_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "License Key"
        ordering = ["-issued_at"]
        indexes = [models.Index(fields=["tenant", "revoked_at"])]

    def __str__(self):
        return f"{self.tenant} - {self.tier} (expires {self.expires_at.date()})"

    @property
    def is_revoked(self):
        return self.revoked_at is not None

    @property
    def is_expired(self):
        from django.utils import timezone
        return self.expires_at < timezone.now()
