"""
OpenCore Distribution Pricing Intelligence (DPI) Model

Provides:
- Entity relationships for licensing, usage, and entitlements
- Core business logic for multi-tier feature access
- Integration with Celery async tasks
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
import json
from typing import Dict, List, Optional, Tuple


class DPIPlan(models.Model):
    """
    Định nghĩa các gói đăng ký / license tiers.
    Ví dụ: Free, Pro, Enterprise
    """
    TIER_CHOICES = [
        ('free', 'Community'),
        ('pro', 'Professional'),
        ('enterprise', 'Enterprise'),
    ]
    
    name = models.CharField(max_length=50, choices=TIER_CHOICES, unique=True, primary_key=True)
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Pricing
    annual_price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monthly_price_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Quota limits
    max_watchlist_items = models.IntegerField(default=50)
    max_portfolio_accounts = models.IntegerField(default=1)
    max_alerts = models.IntegerField(default=10)
    max_api_calls_per_month = models.IntegerField(default=5000)
    
    # Feature flags (JSON)
    features = models.JSONField(default=dict, blank=True)
    
    # Metadata
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['name']
        verbose_name = 'DPI Plan (License Tier)'
        verbose_name_plural = 'DPI Plans'
    
    def __str__(self):
        return f"{self.display_name} ({self.name})"
    
    def get_features(self) -> Dict:
        """Get all feature flags for this plan."""
        return self.features or {}
    
    def has_feature(self, feature_key: str) -> bool:
        """Check if feature is enabled in this plan."""
        features = self.get_features()
        return features.get(feature_key, False)


class DPILicense(models.Model):
    """
    License bản quyền cho user/team.
    Ghi lại:
    - Plan hiện tại
    - Billing cycle (annual, monthly)
    - Status (active, suspended, expired)
    - Grace period info
    """
    STATUS_CHOICES = [
        ('trial', 'Trial'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('expired', 'Expired'),
        ('grace', 'Grace Period'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='dpi_license')
    plan = models.ForeignKey(DPIPlan, on_delete=models.PROTECT)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    billing_cycle = models.CharField(
        max_length=10,
        choices=[('monthly', 'Monthly'), ('annual', 'Annual')],
        default='annual'
    )
    
    start_date = models.DateTimeField(default=timezone.now)
    expiry_date = models.DateTimeField()
    renewal_date = models.DateTimeField(null=True, blank=True)
    
    # Grace period
    grace_until = models.DateTimeField(null=True, blank=True)
    is_in_grace = models.BooleanField(default=False)
    
    # Usage tracking
    api_calls_this_month = models.IntegerField(default=0)
    last_api_call = models.DateTimeField(null=True, blank=True)
    
    # Payment reference
    invoice_number = models.CharField(max_length=100, blank=True)
    payment_method = models.CharField(
        max_length=20,
        choices=[('stripe', 'Stripe'), ('momo', 'MoMo'), ('bank', 'Bank Transfer')],
        null=True,
        blank=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'DPI License'
        verbose_name_plural = 'DPI Licenses'
        indexes = [
            models.Index(fields=['user', 'status']),
            models.Index(fields=['plan']),
            models.Index(fields=['expiry_date']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.plan.display_name}"
    
    def is_valid(self) -> bool:
        """Check if license is currently valid."""
        now = timezone.now()
        if self.status in ['active', 'trial']:
            return now < self.expiry_date
        elif self.status == 'grace':
            return self.grace_until and now < self.grace_until
        return False
    
    def days_until_expiry(self) -> int:
        """Days remaining until expiry."""
        delta = self.expiry_date - timezone.now()
        return max(0, delta.days)
    
    def can_use_feature(self, feature_key: str) -> bool:
        """Check if user can access feature."""
        if not self.is_valid():
            return False
        return self.plan.has_feature(feature_key)


class DPIUsageMetrics(models.Model):
    """
    Ghi lại usage metrics cho mỗi user/license.
    Dùng để:
    - Track tổng usage
    - Tính billing per usage
    - Display analytics
    """
    license = models.OneToOneField(DPILicense, on_delete=models.CASCADE, related_name='usage_metrics')
    
    # Monthly usage
    api_calls_year_to_date = models.IntegerField(default=0)
    api_calls_last_month = models.IntegerField(default=0)
    active_watchlists = models.IntegerField(default=0)
    active_alerts = models.IntegerField(default=0)
    
    # Feature usage
    ai_advisory_queries = models.IntegerField(default=0)
    whale_detection_events = models.IntegerField(default=0)
    order_flow_detections = models.IntegerField(default=0)
    
    # Premium features
    premium_indicator_usage_count = models.IntegerField(default=0)
    team_member_count = models.IntegerField(default=1)
    
    # Timestamps
    last_reset = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'DPI Usage Metrics'
        verbose_name_plural = 'DPI Usage Metrics'
    
    def __str__(self):
        return f"Usage for {self.license.user.username}"
    
    def reset_monthly(self):
        """Reset monthly counters."""
        self.api_calls_last_month = 0
        self.last_reset = timezone.now()
        self.save()


class DPIEntitlement(models.Model):
    """
    Bảng ghi nhận quyền truy cập chi tiết cho mỗi feature.
    Cho phép fine-grained permission control.
    """
    license = models.ForeignKey(DPILicense, on_delete=models.CASCADE, related_name='entitlements')
    
    feature_key = models.CharField(max_length=100)
    feature_name = models.CharField(max_length=200)
    
    is_active = models.BooleanField(default=True)
    limit_per_month = models.IntegerField(null=True, blank=True)
    used_this_month = models.IntegerField(default=0)
    
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'DPI Entitlement'
        verbose_name_plural = 'DPI Entitlements'
        unique_together = [['license', 'feature_key']]
        indexes = [
            models.Index(fields=['license', 'is_active']),
            models.Index(fields=['feature_key']),
        ]
    
    def __str__(self):
        return f"{self.license.user.username} - {self.feature_name}"
    
    def can_use(self) -> bool:
        """Check if entitlement is valid and within limits."""
        now = timezone.now()
        if not self.is_active:
            return False
        if self.expires_at and now > self.expires_at:
            return False
        if self.limit_per_month and self.used_this_month >= self.limit_per_month:
            return False
        return True
    
    def increment_usage(self):
        """Increment usage counter."""
        self.used_this_month += 1
        self.save(update_fields=['used_this_month'])


class DPIAuditLog(models.Model):
    """
    Audit trail của tất cả thay đổi license, entitlement, usage.
    """
    ACTION_CHOICES = [
        ('license_created', 'License Created'),
        ('license_renewed', 'License Renewed'),
        ('license_expired', 'License Expired'),
        ('plan_upgraded', 'Plan Upgraded'),
        ('plan_downgraded', 'Plan Downgraded'),
        ('feature_granted', 'Feature Granted'),
        ('feature_revoked', 'Feature Revoked'),
        ('grace_enabled', 'Grace Period Enabled'),
        ('usage_limit_exceeded', 'Usage Limit Exceeded'),
    ]
    
    license = models.ForeignKey(DPILicense, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    
    created_by = models.CharField(max_length=100, blank=True)  # admin username or 'system'
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'DPI Audit Log'
        verbose_name_plural = 'DPI Audit Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['license', '-created_at']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.license.user.username} - {self.action}"


def get_or_create_default_license(user: User) -> DPILicense:
    """
    Create default Free tier license if doesn't exist.
    Called on user creation.
    """
    license, created = DPILicense.objects.get_or_create(
        user=user,
        defaults={
            'plan': DPIPlan.objects.get(name='free'),
            'status': 'trial',
            'expiry_date': timezone.now() + timezone.timedelta(days=30),
        }
    )
    
    # Create usage metrics
    DPIUsageMetrics.objects.get_or_create(license=license)
    
    return license


def check_feature_access(user: User, feature_key: str) -> Tuple[bool, Optional[str]]:
    """
    Helper to check if user can access feature.
    Returns (can_access, reason_if_denied)
    """
    try:
        license = user.dpi_license
    except DPILicense.DoesNotExist:
        return False, "No license found"
    
    if not license.is_valid():
        return False, f"License {license.status}"
    
    if not license.can_use_feature(feature_key):
        return False, f"Feature not in {license.plan.name} plan"
    
    entitlements = license.entitlements.filter(feature_key=feature_key, is_active=True)
    if entitlements.exists():
        entitlement = entitlements.first()
        if not entitlement.can_use():
            return False, "Entitlement limit exceeded or expired"
    
    return True, None
