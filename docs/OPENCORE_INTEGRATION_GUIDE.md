"""
OpenCore Integration Guide for Developers

HISTORICAL ARTIFACT NOTICE (2026-04-18)
- Tai lieu nay la quick reference ky thuat duoc tao o giai doan som cua OpenCore.
- Khong dung tai lieu nay de suy ra rang OpenCore dang launch-ready hay public-ready.
- Truoc khi ap dung bat ky huong dan nao ben duoi, doi chieu voi bo tai lieu canonical: OC-12, OC-13, OC-14, OC-15.

Quick reference for integrating OpenCore licensing into existing code.
"""

# ============================================================================
# 1. CHECK USER'S LICENSE STATUS
# ============================================================================

from portfolio.opencore_dpi import check_feature_access

def my_api_view(request):
    # Check if user can access a feature
    can_access, reason = check_feature_access(request.user, 'whale_detection')
    
    if not can_access:
        return Response(
            {'error': f'Access denied: {reason}'},
            status=403
        )
    
    # Proceed with feature
    return Response({'data': ...})


# ============================================================================
# 2. TRACK API USAGE (Automatic for REST views using opencore_api.py)
# ============================================================================

from portfolio.opencore_analytics import track_api_call

# In any view that needs quota tracking:
def calculate_indicator(request, indicator_key):
    # ... do calculation ...
    
    # Track the call
    track_api_call(
        user=request.user,
        endpoint=request.path,
        method=request.method,
        status_code=200,
        feature=indicator_key,
        api_weight=PremiumFeatureGate.get_api_weight(indicator_key),
        response_time_ms=elapsed_ms
    )
    
    return Response(...)


# ============================================================================
# 3. GATE PREMIUM INDICATORS BY TIER
# ============================================================================

from portfolio.opencore_premium import PremiumFeatureGate

def get_available_indicators(user):
    """Get only the indicators user's tier allows."""
    license = user.dpi_license
    available = PremiumFeatureGate.get_available_indicators(license.plan.name)
    return available


# Example: User is Pro tier
available = get_available_indicators(user)
# Returns: ['sma', 'rsi', 'volume_profile', 'whale_momentum', 'dark_pool_flow', ...]


# ============================================================================
# 4. REQUIRE FEATURE DECORATOR
# ============================================================================

from portfolio.opencore_api import require_feature
from rest_framework.response import Response

@require_feature('whale_detection')
def whale_detection_view(request):
    """This endpoint is only accessible if user has whale_detection feature."""
    return Response({'whales': [...]})


# ============================================================================
# 5. CHECK QUOTA BEFORE HEAVY OPERATIONS
# ============================================================================

from portfolio.opencore_analytics import DPIQuotaTracker

def heavy_calculation_view(request):
    quota = DPIQuotaTracker.get_or_create_current(request.user)
    
    # Check if user has room in quota
    if not quota.is_within_quota(api_weight=5):  # 5 points for heavy op
        return Response(
            {'error': 'Monthly API quota exceeded'},
            status=429  # Too Many Requests
        )
    
    # Do the heavy calculation
    result = calculate_expensive_thing()
    
    # Record usage
    quota.add_quota_usage(api_weight=5)
    
    return Response(result)


# ============================================================================
# 6. GET USER'S USAGE SUMMARY
# ============================================================================

from portfolio.opencore_analytics import get_monthly_usage_summary

def usage_dashboard(request):
    """Show user their current usage."""
    summary = get_monthly_usage_summary(request.user)
    
    return Response({
        'period': summary['period'],           # '2026-04'
        'api_calls': summary['api_calls_used'],
        'api_limit': summary['api_call_limit'],
        'percent_used': (summary['api_calls_used'] / summary['api_call_limit']) * 100,
        'is_over_quota': summary['is_over_quota'],
        'top_features': summary['top_features'],
    })


# ============================================================================
# 7. AUTOMATIC SIGN-UP - USER GETS FREE LICENSE
# ============================================================================

# This happens automatically via django signals!
# When you create a User:

from django.contrib.auth.models import User

user = User.objects.create_user(
    username='john@example.com',
    email='john@example.com',
    password='password123'
)

# You'll automatically get:
license = user.dpi_license  # OneToOne relationship
print(license.plan.name)    # 'free'
print(license.is_valid())   # True (30-day trial)


# ============================================================================
# 8. UPGRADE USER TO PREMIUM
# ============================================================================

from portfolio.opencore_dpi import DPIPlan, DPIAuditLog

def upgrade_user_to_pro(user):
    """Upgrade user from Free to Pro tier."""
    license = user.dpi_license
    
    # Change plan
    pro_plan = DPIPlan.objects.get(name='pro')
    license.plan = pro_plan
    license.status = 'active'  # Trial ends, now active
    license.save()
    
    # Log the change
    DPIAuditLog.objects.create(
        license=license,
        action='plan_upgraded',
        description=f'Upgraded from {license.plan.name} to pro',
        created_by='admin'
    )
    
    return license


# ============================================================================
# 9. CHECK FEATURE IN PERMISSION CLASS
# ============================================================================

from rest_framework.permissions import BasePermission

class HasWhaleDetectionFeature(BasePermission):
    """Permission class for whale detection feature."""
    
    def has_permission(self, request, view):
        from portfolio.opencore_dpi import check_feature_access
        can_access, _ = check_feature_access(request.user, 'whale_detection')
        return can_access


# Usage in view:
from rest_framework.views import APIView

class WhaleDetectionView(APIView):
    permission_classes = [HasWhaleDetectionFeature]
    
    def post(self, request):
        # If here, user passed permission check
        return Response({...})


# ============================================================================
# 10. QUERYSET FILTERING BY PLAN
# ============================================================================

from portfolio.opencore_dpi import DPIPlan

def get_indicators_for_plan(plan_name):
    """Get all indicators user's tier can access."""
    from portfolio.opencore_premium import PremiumFeatureGate
    return PremiumFeatureGate.get_available_indicators(plan_name)


# ============================================================================
# 11. CALCULATE MONTHLY BILL FOR USER
# ============================================================================

from portfolio.opencore_revenue import calculate_monthly_bill

def get_user_estimated_bill(user, api_calls_used=None):
    """Get estimated monthly bill for user."""
    if api_calls_used is None:
        from portfolio.opencore_analytics import DPIQuotaTracker
        quota = DPIQuotaTracker.get_or_create_current(user)
        api_calls_used = quota.api_calls_used
    
    bill = calculate_monthly_bill(user, api_calls_used)
    
    return {
        'tier': bill['plan'],
        'base_cost': bill['base_cost'],
        'tax': bill['tax'],
        'total': bill['total'],
    }


# ============================================================================
# 12. COMMON USAGE PATTERNS
# ============================================================================

# Pattern 1: Gate endpoint by feature
@require_feature('whale_momentum')
def whale_momentum_view(request):
    """Requires Pro or Enterprise tier."""
    return Response({...})


# Pattern 2: Track custom metric
track_api_call(
    user=request.user,
    endpoint='/api/whale-scan/',
    method='POST',
    status_code=200,
    feature='whale_detection',
    api_weight=3  # Heavy operation = 3 points
)


# Pattern 3: Check before starting long operation
quota = DPIQuotaTracker.get_or_create_current(request.user)
if not quota.is_within_quota(api_weight=10):
    raise PermissionDenied("Quota exceeded")


# Pattern 4: Provide tier-aware response
plan_name = request.user.dpi_license.plan.name
if plan_name == 'free':
    features = ['sma', 'rsi']  # Limited
elif plan_name == 'pro':
    features = ['sma', 'rsi', 'whale_momentum', ...]  # Full
else:
    features = [...]  # Enterprise - all


# ============================================================================
# 13. DEBUGGING & ADMIN TASKS
# ============================================================================

# Django shell commands

# Get all active licenses
from portfolio.opencore_dpi import DPILicense
active = DPILicense.objects.filter(status='active')

# Get over-quota users
from portfolio.opencore_analytics import DPIQuotaTracker
over_quota = DPIQuotaTracker.objects.filter(is_exceeded=True)

# View user's audit log
for log in user.dpi_license.audit_logs.all():
    print(f"{log.created_at}: {log.action} - {log.created_by}")

# Reset user's monthly quota manually
quota = DPIQuotaTracker.get_or_create_current(user)
quota.api_calls_used = 0
quota.is_exceeded = False
quota.save()

# Check license expiry
days_left = user.dpi_license.days_until_expiry()
print(f"License expires in {days_left} days")

# Generate invoice for user
from portfolio.opencore_revenue import generate_monthly_invoice
quota = DPIQuotaTracker.get_or_create_current(user)
invoice = generate_monthly_invoice(user, quota.api_calls_used)
print(f"Invoice {invoice.invoice_number} for ${invoice.total_amount}")


# ============================================================================
# 14. API RESPONSE EXAMPLES
# ============================================================================

# GET /api/opencore/license/my-license/
{
    "plan": "pro",
    "status": "active",
    "start_date": "2026-03-01T00:00:00Z",
    "expiry_date": "2027-03-01T00:00:00Z",
    "days_until_expiry": 358,
    "available_features": [
        "sma", "rsi", "volume_profile", "whale_momentum", 
        "dark_pool_flow", "correlation_matrix", ...
    ]
}

# GET /api/opencore/usage/summary/
{
    "period": "2026-04",
    "api_calls_used": 1523,
    "api_calls_limit": 10000,
    "api_weight_used": 2840,
    "api_weight_limit": 15000,
    "is_over_quota": false,
    "top_features": [
        {"name": "whale_momentum", "usage": 156},
        {"name": "sma", "usage": 89},
        ...
    ]
}

# GET /api/opencore/billing/current-bill/
{
    "plan": "pro",
    "base_cost": 99.0,
    "tax": 9.9,
    "total": 108.9,
    "api_calls": 1523,
    "team_members": 1,
    "billing_cycle": "annual"
}


# ============================================================================
# 15. TESTING TIPS
# ============================================================================

# Test with different tiers
from portfolio.opencore_dpi import DPIPlan

for plan_name in ['free', 'pro', 'enterprise']:
    plan = DPIPlan.objects.get(name=plan_name)
    user.dpi_license.plan = plan
    user.dpi_license.save()
    
    # Test behavior for this tier
    available = get_available_indicators(user)
    print(f"{plan_name}: {len(available)} indicators")


# Test quota enforcement
user.dpi_license.usage_metrics.api_calls_year_to_date = 4999
user.dpi_license.usage_metrics.save()

# User almost at limit (Free = 5000/month)
quota = DPIQuotaTracker.get_or_create_current(user)
print(f"Remaining: {quota.api_call_limit - quota.api_calls_used}")

# See what happens when quota exceeded
for i in range(5):
    quota.add_quota_usage(api_weight=1000)

print(quota.is_exceeded)  # True


# ============================================================================
# Documentation & Help
# ============================================================================
"""
For more info, see:
- /docs/OPEN_CORE_IMPLEMENTATION_COMPLETE.md
- portfolio/opencore_*.py files
- Admin interface: /admin/portfolio/dpilicense/

API Documentation:
- /api/opencore/license/
- /api/opencore/usage/
- /api/opencore/indicators/
- /api/opencore/billing/
"""
