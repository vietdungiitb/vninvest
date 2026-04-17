"""
OpenCore Analytics & Usage Tracking

Ghi lại mọi API call, feature usage, để:
- Tính billing (per-usage model)
- Phân tích user behavior
- Detect anomalies
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.cache import cache
import json
from datetime import datetime, timedelta
from typing import Dict, Optional, List
import logging

logger = logging.getLogger(__name__)


class DPIAPICallLog(models.Model):
    """
    Log mọi API call để tracking usage.
    Dùng để compute:
    - Usage metrics
    - Quota enforcement
    - Billing (per-call model)
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_call_logs')
    
    endpoint = models.CharField(max_length=255)
    method = models.CharField(max_length=10)
    
    # Request details
    request_params = models.JSONField(default=dict, blank=True)
    response_status = models.IntegerField()
    response_time_ms = models.IntegerField(default=0)
    
    # Cost & quota
    api_weight = models.IntegerField(default=1)  # API point cost
    is_cached = models.BooleanField(default=False)
    
    # Feature tracking
    feature_used = models.CharField(max_length=100, blank=True)
    indicator_calculated = models.CharField(max_length=100, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        verbose_name = 'API Call Log'
        verbose_name_plural = 'API Call Logs'
        indexes = [
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['endpoint']),
            models.Index(fields=['feature_used']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.endpoint} ({self.created_at})"
    
    @classmethod
    def log_call(cls, user: User, endpoint: str, method: str,
                 status_code: int, response_time_ms: int = 0,
                 api_weight: int = 1, feature: str = '', indicator: str = '',
                 params: Dict = None, is_cached: bool = False):
        """Log an API call."""
        return cls.objects.create(
            user=user,
            endpoint=endpoint,
            method=method,
            response_status=status_code,
            response_time_ms=response_time_ms,
            api_weight=api_weight,
            feature_used=feature,
            indicator_calculated=indicator,
            request_params=params or {},
            is_cached=is_cached,
        )


class DPIFeatureUsage(models.Model):
    """
    Tổng hợp usage cho từng premium feature.
    Dùng để:
    - Track feature popularity
    - Billing per-feature
    - Usage analytics
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feature_usage')
    
    feature_key = models.CharField(max_length=100)
    feature_name = models.CharField(max_length=200)
    
    # Usage count
    usage_count = models.IntegerField(default=0)
    unique_call_count = models.IntegerField(default=0)
    last_used = models.DateTimeField(null=True, blank=True)
    
    # Performance metrics
    avg_response_time_ms = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)
    
    # Cost
    total_api_weight_used = models.IntegerField(default=0)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Feature Usage'
        verbose_name_plural = 'Feature Usages'
        unique_together = [['user', 'feature_key']]
        indexes = [
            models.Index(fields=['user', 'feature_key']),
            models.Index(fields=['feature_key']),
            models.Index(fields=['-last_used']),
        ]
    
    def __str__(self):
        return f"{self.user.username} - {self.feature_name}"
    
    @classmethod
    def increment_usage(cls, user: User, feature_key: str, feature_name: str = '',
                       api_weight: int = 1, response_time_ms: int = 0):
        """Increment usage counter for feature."""
        obj, created = cls.objects.get_or_create(
            user=user,
            feature_key=feature_key,
            defaults={'feature_name': feature_name}
        )
        obj.usage_count += 1
        obj.unique_call_count += 1
        obj.last_used = timezone.now()
        obj.total_api_weight_used += api_weight
        
        if obj.avg_response_time_ms == 0:
            obj.avg_response_time_ms = response_time_ms
        else:
            # Calculate rolling average
            obj.avg_response_time_ms = (obj.avg_response_time_ms + response_time_ms) // 2
        
        obj.save()
        return obj


class DPIQuotaTracker(models.Model):
    """
    Track quota usage per month / period.
    Used for:
    - Enforcing API limits
    - Monthly reset
    - Quota warnings
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='quota_tracker')
    
    period_start = models.DateTimeField(default=timezone.now)
    period_end = models.DateTimeField()
    
    # Quota usage
    api_calls_used = models.IntegerField(default=0)
    api_weight_used = models.IntegerField(default=0)
    
    # Limits (from license)
    api_call_limit = models.IntegerField(default=5000)
    api_weight_limit = models.IntegerField(default=10000)
    
    # Status
    is_exceeded = models.BooleanField(default=False)
    warned_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Quota Tracker'
        verbose_name_plural = 'Quota Trackers'
    
    def __str__(self):
        return f"{self.user.username} - {self.period_start.strftime('%Y-%m')}"
    
    def is_within_quota(self, api_weight: int = 1) -> bool:
        """Check if user can make API call."""
        return (self.api_calls_used < self.api_call_limit and
                self.api_weight_used + api_weight <= self.api_weight_limit)
    
    def add_quota_usage(self, api_weight: int = 1):
        """Record API call against quota."""
        self.api_calls_used += 1
        self.api_weight_used += api_weight
        if self.api_calls_used >= self.api_call_limit:
            self.is_exceeded = True
        self.save(update_fields=['api_calls_used', 'api_weight_used', 'is_exceeded'])
    
    @classmethod
    def get_or_create_current(cls, user: User):
        """Get current month quota tracker."""
        now = timezone.now()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)

        obj = cls.objects.filter(
            user=user,
            period_start__gte=period_start,
            period_start__lte=period_end,
        ).order_by('-period_start').first()
        if obj is not None:
            return obj

        obj = cls.objects.create(
            user=user,
            period_start=period_start,
            period_end=period_end,
        )
        return obj


class DPIAnalyticsSnapshot(models.Model):
    """
    Daily/weekly analytics snapshot.
    Used for dashboards and reporting.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='analytics_snapshots')
    
    snapshot_date = models.DateField(auto_now_add=True)
    
    # Daily stats
    api_calls_today = models.IntegerField(default=0)
    unique_endpoints_called = models.IntegerField(default=0)
    total_response_time_ms = models.IntegerField(default=0)
    
    # Feature stats
    features_used = models.IntegerField(default=0)
    indicators_calculated = models.IntegerField(default=0)
    
    # Cache hit rate
    cache_hits = models.IntegerField(default=0)
    cache_misses = models.IntegerField(default=0)
    
    # Error tracking
    error_count = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Analytics Snapshot'
        verbose_name_plural = 'Analytics Snapshots'
        unique_together = [['user', 'snapshot_date']]
        ordering = ['-snapshot_date']
    
    def __str__(self):
        return f"{self.user.username} - {self.snapshot_date}"
    
    @property
    def cache_hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total = self.cache_hits + self.cache_misses
        if total == 0:
            return 0.0
        return (self.cache_hits / total) * 100


# Helper functions for analytics
def track_api_call(user: User, endpoint: str, method: str, status_code: int,
                   response_time_ms: int = 0, feature: str = '', indicator: str = '',
                   api_weight: int = 1, is_cached: bool = False):
    """Track API call and update metrics."""

    try:
        # Log the call
        DPIAPICallLog.log_call(
            user=user,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            response_time_ms=response_time_ms,
            api_weight=api_weight,
            feature=feature,
            indicator=indicator,
            is_cached=is_cached,
        )

        # Update feature usage if applicable
        if feature:
            DPIFeatureUsage.increment_usage(
                user=user,
                feature_key=feature,
                api_weight=api_weight,
                response_time_ms=response_time_ms
            )

        # Update quota
        quota = DPIQuotaTracker.get_or_create_current(user)
        if quota.is_within_quota(api_weight):
            quota.add_quota_usage(api_weight)
        else:
            logger.warning("opencore.quota.exceeded username=%s", user.username)
    except Exception as exc:
        # Analytics side effects should not crash functional APIs.
        logger.warning(
            "opencore.analytics.track_failed user_id=%s endpoint=%s error=%s",
            getattr(user, 'id', None),
            endpoint,
            exc,
        )


def get_monthly_usage_summary(user: User) -> Dict:
    """Get user's monthly usage summary."""
    try:
        quota = DPIQuotaTracker.get_or_create_current(user)

        features = DPIFeatureUsage.objects.filter(user=user)
        top_features = features.order_by('-usage_count')[:5]

        return {
            'period': f"{quota.period_start.strftime('%Y-%m')}",
            'api_calls_used': quota.api_calls_used,
            'api_calls_limit': quota.api_call_limit,
            'api_weight_used': quota.api_weight_used,
            'api_weight_limit': quota.api_weight_limit,
            'is_over_quota': quota.is_exceeded,
            'top_features': [
                {'name': f.feature_name, 'usage': f.usage_count}
                for f in top_features
            ],
            'total_features_used': features.count(),
        }
    except Exception as exc:
        logger.warning(
            "opencore.analytics.summary_failed user_id=%s error=%s",
            getattr(user, 'id', None),
            exc,
        )
        return {
            'period': timezone.now().strftime('%Y-%m'),
            'api_calls_used': 0,
            'api_calls_limit': 0,
            'api_weight_used': 0,
            'api_weight_limit': 0,
            'is_over_quota': False,
            'top_features': [],
            'total_features_used': 0,
        }
