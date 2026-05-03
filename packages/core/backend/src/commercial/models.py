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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Invoice'
        ordering = ['-created_at']

    def __str__(self):
        return f'Invoice {self.invoice_number} ({self.status})'
