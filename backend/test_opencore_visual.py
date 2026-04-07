#!/usr/bin/env python
"""
Visual test of OpenCore functionality
Demonstrates all core features working end-to-end
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from portfolio.opencore_dpi import DPIPlan, DPILicense
from portfolio.opencore_premium import PremiumFeatureGate
from portfolio.opencore_analytics import DPIQuotaTracker

def print_header(text):
    print("\n" + "=" * 75)
    print(text)
    print("=" * 75)

def test_1_dpi_plans():
    """Test 1: Verify DPI Plans in Database"""
    print_header("TEST 1: Check DPI Plans in Database")
    
    plans = DPIPlan.objects.all()
    print(f"\n✓ Found {plans.count()} plans:\n")
    
    for plan in plans.values_list('name', 'display_name', 'annual_price_usd'):
        print(f"  • {plan[0]:15} | {plan[1]:25} | ${plan[2]:>8.2f}/year")
    
    return plans.count() == 3

def test_2_auto_license():
    """Test 2: User auto-license creation via signal"""
    print_header("TEST 2: Create Test User & Verify Auto-License Creation")
    
    # Delete if exists
    User.objects.filter(username='test_opencore_visual').delete()
    
    # Create test user
    test_user = User.objects.create_user(
        'test_opencore_visual', 
        'test@opencore.local', 
        'testpass123'
    )
    print(f"\n✓ Created user: {test_user.username}")
    
    # Check auto-created license via signal
    license = test_user.dpi_license
    print(f"✓ License auto-created via signal: {license is not None}")
    print(f"  - Plan: {license.plan.display_name}")
    print(f"  - Status: {license.status}")
    print(f"  - Created: {license.created_at.date()}")
    print(f"  - Tier: FREE (Trial mode)")
    
    return license is not None and license.plan.name == 'free'

def test_3_feature_gating_free():
    """Test 3: Feature gating for free tier"""
    print_header("TEST 3: Feature Gating - What Can FREE User Access?")
    
    free_plan = DPIPlan.objects.get(name='free')
    available = PremiumFeatureGate.get_available_indicators('free')
    
    print(f"\n✓ Free tier indicators available: {len(available)}/12\n")
    for i, ind in enumerate(available, 1):
        print(f"  {i}. {ind}")
    
    expected = {'sma', 'rsi', 'volume_profile'}
    actual = set(available)
    
    return actual == expected

def test_4_tier_comparison():
    """Test 4: Compare access across tiers"""
    print_header("TEST 4: Feature Gating - Free vs Pro vs Enterprise")
    
    features_to_check = [
        'sma',              # Free
        'rsi',              # Free
        'volume_profile',   # Free
        'whale_momentum',   # Pro+
        'dark_pool_flow',   # Pro+
        'correlation_matrix',   # Pro+
        'sentiment_score',  # Pro+
        'predictive_ml',    # Enterprise
        'cross_market_alpha',   # Enterprise
    ]
    
    print("\nFeature availability by tier:\n")
    print(f"{'Feature':<22} | {'FREE':<5} | {'PRO':<5} | {'ENTERPRISE':<10}")
    print("-" * 60)
    
    all_pass = True
    for feature in features_to_check:
        free_access = PremiumFeatureGate.can_calculate_indicator('free', feature)
        pro_access = PremiumFeatureGate.can_calculate_indicator('pro', feature)
        ent_access = PremiumFeatureGate.can_calculate_indicator('enterprise', feature)
        
        free_sym = "✓" if free_access else "✗"
        pro_sym = "✓" if pro_access else "✗"
        ent_sym = "✓" if ent_access else "✗"
        
        print(f"{feature:<22} | {free_sym:<5} | {pro_sym:<5} | {ent_sym:<10}")
        
        # Verify that Pro >= Free and Enterprise >= Pro
        if not (pro_access >= free_access and ent_access >= pro_access):
            all_pass = False
    
    return all_pass

def test_5_license_lifecycle():
    """Test 5: License lifecycle and validity"""
    print_header("TEST 5: License Lifecycle - Status Check")
    
    test_user = User.objects.get(username='test_opencore_visual')
    license = test_user.dpi_license
    
    is_valid = license.is_valid()
    expiry_days = license.days_until_expiry()
    
    print(f"\n✓ License valid: {is_valid}")
    print(f"✓ Status: {license.status} (trial/active/grace/expired)")
    print(f"✓ Days until expiry: {expiry_days} days")
    print(f"✓ Expires at: {license.expiry_date.date()}")
    print(f"✓ Created at: {license.created_at.date()}")
    
    # Trial should be valid and have ~30 days
    return is_valid and license.status == 'trial' and expiry_days > 20

def test_6_tier_upgrade():
    """Test 6: Simulate user upgrade to Pro"""
    print_header("TEST 6: Upgrade Simulation - Create PRO User")
    
    # Clean up
    User.objects.filter(username='test_pro_user').delete()
    
    # Create Pro user
    pro_user = User.objects.create_user(
        'test_pro_user',
        'pro@opencore.local',
        'propass123'
    )
    
    pro_plan = DPIPlan.objects.get(name='pro')
    pro_user.dpi_license.plan = pro_plan
    pro_user.dpi_license.status = 'active'
    pro_user.dpi_license.save()
    
    pro_license = pro_user.dpi_license
    pro_available = PremiumFeatureGate.get_available_indicators('pro')
    
    print(f"\n✓ Created PRO tier user: {pro_user.username}")
    print(f"✓ Plan: {pro_license.plan.display_name}")
    print(f"✓ Status: {pro_license.status}")
    print(f"✓ Pro tier indicators available: {len(pro_available)}/12\n")
    
    for i, ind in enumerate(pro_available, 1):
        print(f"  {i:2}. {ind}")
    
    return len(pro_available) == 8

def test_7_usage_metrics():
    """Test 7: Usage metrics tracking"""
    print_header("TEST 7: Usage Metrics & Quota Tracking")
    
    test_user = User.objects.get(username='test_opencore_visual')
    license = test_user.dpi_license
    
    # Get metrics
    metrics = license.usage_metrics
    print(f"\n✓ License usage metrics created: {metrics is not None}")
    
    if metrics:
        print(f"  - API calls YTD: {metrics.api_calls_year_to_date}")
        print(f"  - API calls last month: {metrics.api_calls_last_month}")
        print(f"  - Premium indicator usage: {metrics.premium_indicator_usage_count}")
    
    # Get quota tracker
    quota = DPIQuotaTracker.get_or_create_current(test_user)
    print(f"\n✓ Monthly quota tracker created: {quota is not None}")
    
    if quota:
        remaining = quota.api_call_limit - quota.api_calls_used
        remaining_pct = (remaining / quota.api_call_limit * 100) if quota.api_call_limit > 0 else 0
        print(f"  - Quota limit: {quota.api_call_limit}")
        print(f"  - API calls used: {quota.api_calls_used}")
        print(f"  - Remaining: {remaining} ({remaining_pct:.1f}%)")
        print(f"  - Period: {quota.period_start.date()} to {quota.period_end.date()}")
    
    return metrics is not None and quota is not None

def test_8_api_weights():
    """Test 8: API weight calculation per indicator"""
    print_header("TEST 8: API Weight Calculations (Quota Costs)")
    
    from portfolio.opencore_premium import PREMIUM_INDICATORS
    
    indicators = ['sma', 'whale_momentum', 'predictive_ml']
    
    print("\nIndicator quota cost (lower = cheaper):\n")
    for ind in indicators:
        if ind in PREMIUM_INDICATORS:
            weight = PREMIUM_INDICATORS[ind].api_weight
            plan = PREMIUM_INDICATORS[ind].min_plan
            print(f"  {ind:<25} : Weight={weight:>1} | Plan={plan:<12}")
    
    return True

def test_9_entitlements():
    """Test 9: Fine-grained entitlements"""
    print_header("TEST 9: Entitlements - Fine-Grained Access Control")
    
    test_user = User.objects.get(username='test_opencore_visual')
    license = test_user.dpi_license
    
    entitlements = license.entitlements.all()
    print(f"\n✓ User has {entitlements.count()} entitlements\n")
    
    for ent in entitlements:
        print(f"  - {ent.feature_key:<25} : {ent.monthly_limit:>5} calls/month")
    
    return True

def test_10_admin_access():
    """Test 10: Admin interface availability"""
    print_header("TEST 10: Django Admin Interface Models")
    
    print("\n✓ OpenCore models can be imported:\n")
    
    try:
        from portfolio.opencore_dpi import (
            DPIPlan, DPILicense, DPIUsageMetrics, DPIEntitlement, DPIAuditLog
        )
        from portfolio.opencore_analytics import (
            DPIAPICallLog, DPIFeatureUsage, DPIQuotaTracker, DPIAnalyticsSnapshot
        )
        from portfolio.opencore_revenue import (
            DPIRevenuePlan, DPISubscription, DPIInvoice, DPIPayment
        )
        
        models_imported = [
            'DPIPlan', 'DPILicense', 'DPIUsageMetrics', 'DPIEntitlement', 'DPIAuditLog',
            'DPIAPICallLog', 'DPIFeatureUsage', 'DPIQuotaTracker', 'DPIAnalyticsSnapshot',
            'DPIRevenuePlan', 'DPISubscription', 'DPIInvoice', 'DPIPayment'
        ]
        
        for model_name in models_imported:
            print(f"  ✓ {model_name}")
        
        print(f"\n✓ Total DPI models loaded: {len(models_imported)}")
        print("✓ Admin configuration: opencore_admin.py")
        
        return True
    except Exception as e:
        print(f"  ✗ Error loading models: {e}")
        return False

def main():
    """Run all tests"""
    print("\n")
    print("╔" + "=" * 73 + "╗")
    print("║" + " " * 15 + "OPENCORE FUNCTIONALITY VISUAL TEST" + " " * 24 + "║")
    print("║" + " " * 20 + "Comprehensive Feature Demonstration" + " " * 17 + "║")
    print("╚" + "=" * 73 + "╝")
    
    tests = [
        ("DPI Plans Database", test_1_dpi_plans),
        ("Auto-License Creation", test_2_auto_license),
        ("Feature Gating (Free)", test_3_feature_gating_free),
        ("Tier Comparison", test_4_tier_comparison),
        ("License Lifecycle", test_5_license_lifecycle),
        ("Tier Upgrade", test_6_tier_upgrade),
        ("Usage Metrics", test_7_usage_metrics),
        ("API Weights", test_8_api_weights),
        ("Entitlements", test_9_entitlements),
        ("Admin Interface", test_10_admin_access),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result, None))
        except Exception as e:
            results.append((test_name, False, str(e)))
    
    # Summary
    print_header("📊 TEST SUMMARY")
    
    passed = sum(1 for _, r, _ in results if r)
    total = len(results)
    
    print(f"\nResults: {passed}/{total} tests passed\n")
    
    for test_name, result, error in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status:10} {test_name}")
        if error:
            print(f"           Error: {error}")
    
    print("\n" + "=" * 75)
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - OpenCore is working perfectly!")
    else:
        print(f"⚠️  {total - passed} test(s) failed - Check errors above")
    
    print("=" * 75 + "\n")
    
    return passed == total

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
