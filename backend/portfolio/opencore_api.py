"""
OpenCore REST API

Cung cấp các endpoint untuk:
- License / Subscription management
- Usage analytics
- Premium indicator access
- Team workspace management
"""

from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .opencore_dpi import (
    DPIPlan, DPILicense, DPIUsageMetrics, DPIEntitlement,
    DPIAuditLog, check_feature_access
)
from .opencore_analytics import (
    DPIAPICallLog, DPIFeatureUsage, DPIQuotaTracker,
    get_monthly_usage_summary
)
from .opencore_premium import PremiumFeatureGate, get_plan_features
from .opencore_revenue import DPISubscription, DPIInvoice, calculate_monthly_bill
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# Serializers
# ============================================================================

class DPIPlanSerializer(serializers.ModelSerializer):
    features = serializers.SerializerMethodField()
    
    class Meta:
        model = DPIPlan
        fields = ['name', 'display_name', 'description', 'annual_price_usd',
                  'monthly_price_usd', 'max_watchlist_items', 'max_portfolio_accounts',
                  'max_alerts', 'max_api_calls_per_month', 'features', 'is_active']
    
    def get_features(self, obj):
        """Get feature details."""
        return get_plan_features(obj.name)


class DPILicenseSerializer(serializers.ModelSerializer):
    plan_details = DPIPlanSerializer(source='plan', read_only=True)
    days_until_expiry = serializers.SerializerMethodField()
    available_features = serializers.SerializerMethodField()
    
    class Meta:
        model = DPILicense
        fields = ['id', 'plan', 'plan_details', 'status', 'billing_cycle',
                  'start_date', 'expiry_date', 'is_in_grace', 'days_until_expiry',
                  'api_calls_this_month', 'available_features']
        read_only_fields = ['id', 'start_date', 'expiry_date', 'api_calls_this_month']
    
    def get_days_until_expiry(self, obj):
        return obj.days_until_expiry()
    
    def get_available_features(self, obj):
        """List of available features for plan."""
        return PremiumFeatureGate.get_available_indicators(obj.plan.name)


class DPIUsageMetricsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DPIUsageMetrics
        fields = '__all__'


class DPIQuotaTrackerSerializer(serializers.ModelSerializer):
    quota_percentage = serializers.SerializerMethodField()
    is_warning = serializers.SerializerMethodField()
    
    class Meta:
        model = DPIQuotaTracker
        fields = ['api_calls_used', 'api_calls_limit', 'api_weight_used',
                  'api_weight_limit', 'is_exceeded', 'quota_percentage', 'is_warning']
    
    def get_quota_percentage(self, obj):
        if obj.api_call_limit == 0:
            return 0
        return (obj.api_calls_used / obj.api_call_limit) * 100
    
    def get_is_warning(self, obj):
        return (obj.api_calls_used / obj.api_call_limit) > 0.8 if obj.api_call_limit > 0 else False


class DPIAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DPIAuditLog
        fields = ['id', 'action', 'description', 'details', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_at']


class DPIInvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DPIInvoice
        fields = ['id', 'invoice_number', 'status', 'issue_date', 'due_date',
                  'subscription_amount', 'usage_based_amount', 'tax_amount',
                  'total_amount', 'payment_method', 'transaction_id']
        read_only_fields = ['id', 'invoice_number', 'subscription_amount', 'tax_amount', 'total_amount']


# ============================================================================
# ViewSets & API Views
# ============================================================================

class DPILicenseViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoints for user license management.
    
    GET /api/opencore/license/ - Get user's current license
    GET /api/opencore/license/available-plans/ - List all plans
    """
    serializer_class = DPILicenseSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Only show user's own license."""
        return DPILicense.objects.filter(user=self.request.user)
    
    def get_object(self):
        """Get user's license."""
        return get_object_or_404(DPILicense, user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def available_plans(self, request):
        """List available plans."""
        plans = DPIPlan.objects.filter(is_active=True)
        serializer = DPIPlanSerializer(plans, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_license(self, request):
        """Get user's current license."""
        try:
            license = request.user.dpi_license
            serializer = self.get_serializer(license)
            return Response(serializer.data)
        except DPILicense.DoesNotExist:
            return Response(
                {'error': 'No license found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=False, methods=['get'])
    def status(self, request):
        """Get license status summary."""
        try:
            license = request.user.dpi_license
            return Response({
                'plan': license.plan.name,
                'status': license.status,
                'is_valid': license.is_valid(),
                'days_until_expiry': license.days_until_expiry(),
                'features_available': PremiumFeatureGate.get_available_indicators(license.plan.name),
            })
        except DPILicense.DoesNotExist:
            return Response({'error': 'No license found'}, status=404)


class DPIUsageViewSet(viewsets.ViewSet):
    """
    API endpoints for usage analytics.
    
    GET /api/opencore/usage/summary/ - Get usage summary
    GET /api/opencore/usage/quota/ - Get quota status
    GET /api/opencore/usage/top-features/ - Get top used features
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get monthly usage summary."""
        summary = get_monthly_usage_summary(request.user)
        return Response(summary)
    
    @action(detail=False, methods=['get'])
    def quota(self, request):
        """Get current quota status."""
        quota = DPIQuotaTracker.get_or_create_current(request.user)
        serializer = DPIQuotaTrackerSerializer(quota)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def top_features(self, request):
        """Get top 10 used features."""
        features = DPIFeatureUsage.objects.filter(user=request.user).order_by('-usage_count')[:10]
        data = [
            {
                'feature': f.feature_name,
                'usage_count': f.usage_count,
                'last_used': f.last_used,
                'avg_response_time_ms': f.avg_response_time_ms,
            }
            for f in features
        ]
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def audit_log(self, request):
        """Get license audit log."""
        try:
            license = request.user.dpi_license
            logs = DPIAuditLog.objects.filter(license=license).order_by('-created_at')[:50]
            serializer = DPIAuditLogSerializer(logs, many=True)
            return Response(serializer.data)
        except DPILicense.DoesNotExist:
            return Response({'error': 'No license found'}, status=404)


class DPIPremiumIndicatorsViewSet(viewsets.ViewSet):
    """
    API for checking premium indicator access.
    
    GET /api/opencore/indicators/available/ - Get available indicators for user
    GET /api/opencore/indicators/can-use/ - Check access to specific indicator
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def available(self, request):
        """Get indicators available to user."""
        try:
            license = request.user.dpi_license
            indicators = PremiumFeatureGate.get_available_indicators(license.plan.name)
            return Response({'indicators': indicators})
        except DPILicense.DoesNotExist:
            return Response({'indicators': []})
    
    @action(detail=False, methods=['get'])
    def can_use(self, request):
        """Check if user can use specific indicator."""
        indicator_key = request.query_params.get('indicator', '')
        
        try:
            license = request.user.dpi_license
            can_use = PremiumFeatureGate.can_calculate_indicator(license.plan.name, indicator_key)
            
            indicator = PremiumFeatureGate.get_indicator(indicator_key)
            return Response({
                'indicator': indicator_key,
                'can_use': can_use,
                'plan_required': indicator.min_plan if indicator else None,
                'user_plan': license.plan.name,
            })
        except DPILicense.DoesNotExist:
            return Response({'error': 'No license found'}, status=404)


class DPIBillingViewSet(viewsets.ViewSet):
    """
    API for billing and invoices.
    
    GET /api/opencore/billing/invoices/ - Get user's invoices
    GET /api/opencore/billing/current-bill/ - Get estimated current bill
    """
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def invoices(self, request):
        """Get user's invoices."""
        invoices = DPIInvoice.objects.filter(user=request.user).order_by('-issue_date')[:12]
        serializer = DPIInvoiceSerializer(invoices, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def current_bill(self, request):
        """Get estimated bill for current month."""
        try:
            quota = DPIQuotaTracker.get_or_create_current(request.user)
            breakdown = calculate_monthly_bill(request.user, quota.api_calls_used)
            if 'error' not in breakdown:
                return Response(breakdown)
            else:
                return Response(breakdown, status=404)
        except Exception as e:
            logger.error(f"Error calculating bill for {request.user}: {e}")
            return Response({'error': str(e)}, status=400)
    
    @action(detail=False, methods=['get'])
    def subscription(self, request):
        """Get user's subscription details."""
        try:
            subscription = request.user.dpi_subscription
            return Response({
                'plan': subscription.plan.plan,
                'billing_cycle': subscription.billing_cycle,
                'start_date': subscription.start_date,
                'renewal_date': subscription.renewal_date,
                'auto_renew': subscription.auto_renew,
                'days_until_renewal': subscription.days_until_renewal(),
            })
        except DPISubscription.DoesNotExist:
            return Response({'error': 'No subscription found'}, status=404)


# ============================================================================
# Helper decorators for API views
# ============================================================================

def require_feature(feature_key: str):
    """
    Decorator to check feature access before executing view.
    Usage:
        @require_feature('whale_detection')
        def my_view(request):
            pass
    """
    def decorator(view_func):
        def wrapper(request, *args, **kwargs):
            can_access, reason = check_feature_access(request.user, feature_key)
            if not can_access:
                return Response(
                    {'error': f'Feature not available: {reason}'},
                    status=status.HTTP_403_FORBIDDEN
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
