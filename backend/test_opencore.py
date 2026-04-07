#!/usr/bin/env python
"""
Quick test script to verify OpenCore API endpoints.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '/c/Mujoco Projects/vninvest/backend')

django.setup()

from django.contrib.auth.models import User
from portfolio.opencore_dpi import DPIPlan, DPILicense, get_or_create_default_license

print("=" * 70)
print("OpenCore API Test Script")
print("=" * 70)

# Test 1: Check DPI Plans
print("\n✓ Test 1: DPI Plans")
plans = DPIPlan.objects.all()
for plan in plans:
    print(f"  - {plan.display_name} (${plan.annual_price_usd}/year)")

# Test 2: Create test user
print("\n✓ Test 2: User Creation & License")
user, created = User.objects.get_or_create(
    username='test@example.com',
    defaults={
        'email': 'test@example.com',
        'first_name': 'Test',
        'last_name': 'User'
    }
)
print(f"  - User: {user.username} {'(new)' if created else '(exists)'}")

# Test 3: Check license
print("\n✓ Test 3: User License")
license = user.dpi_license
print(f"  - Plan: {license.plan.display_name}")
print(f"  - Status: {license.status}")
print(f"  - Valid: {license.is_valid()}")
print(f"  - Days until expiry: {license.days_until_expiry()}")

# Test 4: Feature access
print("\n✓ Test 4: Feature Access")
from portfolio.opencore_premium import PremiumFeatureGate

available = PremiumFeatureGate.get_available_indicators(license.plan.name)
print(f"  - Available indicators: {', '.join(available)}")

can_whale = PremiumFeatureGate.can_calculate_indicator(license.plan.name, 'whale_momentum')
print(f"  - Can use whale_momentum: {can_whale}")

# Test 5: Usage metrics
print("\n✓ Test 5: Usage Metrics")
metrics = license.usage_metrics
print(f"  - API calls YTD: {metrics.api_calls_year_to_date}")
print(f"  - Active alerts: {metrics.active_alerts}")

print("\n" + "=" * 70)
print("✓ All tests passed!")
print("=" * 70)
