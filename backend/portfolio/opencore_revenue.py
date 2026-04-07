"""
OpenCore Revenue Model & Billing

Định nghĩa các revenue streams:
1. SaaS subscription (annual/monthly)
2. Usage-based billing (per-API-call)
3. Enterprise licensing
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
from typing import Dict, Optional
import json
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class DPIInvoice(models.Model):
    """
    Hóa đơn hàng tháng / năm cho user.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('issued', 'Issued'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dpi_invoices')
    
    invoice_number = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    # Dates
    issue_date = models.DateField()
    due_date = models.DateField()
    paid_date = models.DateField(null=True, blank=True)
    
    # Amounts (USD)
    subscription_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    usage_based_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Payment details
    payment_method = models.CharField(
        max_length=50,
        choices=[('stripe', 'Stripe'), ('momo', 'MoMo'), ('bank', 'Bank Transfer'), ('offline', 'Offline')],
        null=True,
        blank=True
    )
    transaction_id = models.CharField(max_length=200, blank=True)
    
    # Metadata
    line_items = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'DPI Invoice'
        verbose_name_plural = 'DPI Invoices'
        ordering = ['-issue_date']
        indexes = [
            models.Index(fields=['user', '-issue_date']),
            models.Index(fields=['status']),
            models.Index(fields=['invoice_number']),
        ]
    
    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.user.username}"
    
    def mark_paid(self, payment_method: str = '', transaction_id: str = ''):
        """Mark invoice as paid."""
        self.status = 'paid'
        self.paid_date = timezone.now().date()
        if payment_method:
            self.payment_method = payment_method
        if transaction_id:
            self.transaction_id = transaction_id
        self.save()


class DPIRevenuePlan(models.Model):
    """
    Mô hình revenue cho mỗi gói (free/pro/enterprise).
    Định nghĩa:
    - Base subscription price
    - Per-unit costs (e.g., per API call, per user in team)
    - Discount tiers
    """
    PLAN_CHOICES = [
        ('free', 'Free'),
        ('pro', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]
    
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, unique=True, primary_key=True)
    
    # Base subscription
    annual_price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly_price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Usage-based (overage)
    per_api_call_cost = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    per_team_member_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Included in subscription
    included_api_calls = models.IntegerField(default=0)
    included_team_members = models.IntegerField(default=1)
    
    # Volume discounts
    discount_tiers = models.JSONField(default=list, blank=True)  # List of (usage, discount_percent)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'DPI Revenue Plan'
        verbose_name_plural = 'DPI Revenue Plans'
    
    def __str__(self):
        return f"{self.plan} - ${self.annual_price_usd}/year"
    
    def calculate_monthly_cost(self, usage_apis: int = 0, team_members: int = 1) -> Decimal:
        """Calculate monthly cost with usage."""
        cost = Decimal(str(self.monthly_price_usd))
        
        # Overage for API calls
        if usage_apis > self.included_api_calls:
            overage = usage_apis - self.included_api_calls
            cost += Decimal(str(overage)) * Decimal(str(self.per_api_call_cost))
        
        # Overage for team members
        if team_members > self.included_team_members:
            overage = team_members - self.included_team_members
            cost += Decimal(str(overage)) * Decimal(str(self.per_team_member_cost))
        
        return cost


class DPISubscription(models.Model):
    """
    Active subscription record.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='dpi_subscription')
    plan = models.ForeignKey(DPIRevenuePlan, on_delete=models.PROTECT)
    
    # Billing cycle
    billing_cycle = models.CharField(
        max_length=10,
        choices=[('monthly', 'Monthly'), ('annual', 'Annual')],
        default='annual'
    )
    
    # Dates
    start_date = models.DateField(default=timezone.now)
    renewal_date = models.DateField()
    auto_renew = models.BooleanField(default=True)
    
    # Payment
    payment_method = models.CharField(
        max_length=50,
        choices=[('stripe', 'Stripe'), ('momo', 'MoMo'), ('bank', 'Bank Transfer')],
        null=True,
        blank=True
    )
    
    # Discounts
    discount_percent = models.IntegerField(default=0)
    discount_reason = models.CharField(max_length=200, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'DPI Subscription'
        verbose_name_plural = 'DPI Subscriptions'
    
    def __str__(self):
        return f"{self.user.username} - {self.plan.plan}"
    
    def is_active(self) -> bool:
        """Check if subscription is active."""
        return self.renewal_date >= timezone.now().date()
    
    def days_until_renewal(self) -> int:
        """Days until renewal."""
        delta = self.renewal_date - timezone.now().date()
        return max(0, delta.days)


class DPIPayment(models.Model):
    """
    Individual payment transactions.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dpi_payments')
    invoice = models.OneToOneField(DPIInvoice, on_delete=models.SET_NULL, null=True, blank=True)
    
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Payment gateway
    provider = models.CharField(max_length=50)  # stripe, momo, etc
    transaction_id = models.CharField(max_length=200, unique=True)
    provider_response = models.JSONField(default=dict, blank=True)
    
    # Retry logic
    retry_count = models.IntegerField(default=0)
    last_retry_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'DPI Payment'
        verbose_name_plural = 'DPI Payments'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.username} - ${self.amount} ({self.status})"
    
    def mark_completed(self):
        """Mark payment as completed."""
        self.status = 'completed'
        self.save()
        
        if self.invoice:
            self.invoice.mark_paid(
                payment_method=self.provider,
                transaction_id=self.transaction_id
            )


# Helper functions for billing
def calculate_monthly_bill(user: User, api_calls_this_month: int = 0,
                          team_members: int = 1) -> Dict:
    """
    Calculate what user should be billed for this month.
    """
    try:
        subscription = user.dpi_subscription
    except:
        return {'error': 'No active subscription'}
    
    revenue_plan = subscription.plan
    base_cost = revenue_plan.calculate_monthly_cost(
        usage_apis=api_calls_this_month,
        team_members=team_members
    )
    
    # Apply discount
    if subscription.discount_percent:
        discount = base_cost * Decimal(subscription.discount_percent) / Decimal(100)
        base_cost -= discount
    
    # Add tax (Vietnam 10% VAT)
    tax = base_cost * Decimal('0.10')
    
    return {
        'plan': revenue_plan.plan,
        'base_cost': float(base_cost),
        'tax': float(tax),
        'total': float(base_cost + tax),
        'api_calls': api_calls_this_month,
        'team_members': team_members,
        'billing_cycle': subscription.billing_cycle,
    }


def generate_monthly_invoice(user: User, api_calls: int = 0,
                            team_members: int = 1) -> Optional[DPIInvoice]:
    """
    Generate monthly invoice for user.
    """
    try:
        subscription = user.dpi_subscription
    except:
        logger.error(f"No subscription for user {user.username}")
        return None
    
    # Calculate amounts
    breakdown = calculate_monthly_bill(user, api_calls, team_members)
    if 'error' in breakdown:
        return None
    
    # Create invoice
    now = timezone.now()
    invoice = DPIInvoice.objects.create(
        user=user,
        invoice_number=f"INV-{user.id}-{now.strftime('%Y%m%d%H%M%S')}",
        issue_date=now.date(),
        due_date=(now + timedelta(days=30)).date(),
        subscription_amount=Decimal(str(breakdown['base_cost'])),
        usage_based_amount=0,
        tax_amount=Decimal(str(breakdown['tax'])),
        total_amount=Decimal(str(breakdown['total'])),
        line_items=[
            {
                'description': f"{subscription.plan.plan.title()} Subscription",
                'amount': float(breakdown['base_cost']),
            }
        ],
    )
    
    return invoice
