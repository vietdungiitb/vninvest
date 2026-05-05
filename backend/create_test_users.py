#!/usr/bin/env python
"""Create test users for OpenCore visual testing (Day 5-7 features)."""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth.models import User
from django.core.management import call_command
from portfolio.models import UserConfig, UserPlanLifecycle
from portfolio.opencore_dpi import DPIPlan, DPILicense
from django.utils import timezone
from datetime import timedelta

TEST_PASSWORD = 'test@123456'

# Clean up old test users
User.objects.filter(username__in=['testfree', 'testpro', 'testpremium']).delete()

# Ensure test users inherit the canonical feature matrix instead of ad-hoc empty plan shells.
call_command('initialize_dpi_plans', verbosity=0)
free_plan = DPIPlan.objects.get(name='free')
pro_plan = DPIPlan.objects.get(name='pro')

# 1. FREE USER (should get 403 on premium endpoints)
user_free = User.objects.create_user('testfree', 'free@test.local', TEST_PASSWORD)
UserConfig.objects.create(user=user_free, plan='free', email_verified=True)
# License auto-created via signal, just update it
license_free = user_free.dpi_license
license_free.plan = free_plan
license_free.status = 'active'
license_free.expiry_date = timezone.now() + timedelta(days=30)
license_free.start_date = timezone.now()
license_free.save()
print(f"✅ Created free user: testfree / {TEST_PASSWORD}")

# 2. PRO USER (should get 200 on premium endpoints, track quota)
user_pro = User.objects.create_user('testpro', 'pro@test.local', TEST_PASSWORD)
config_pro = UserConfig.objects.create(user=user_pro, plan='pro', email_verified=True)
# License auto-created via signal, update it to pro
license_pro = user_pro.dpi_license
pro_plan.refresh_from_db()
license_pro.plan = pro_plan
license_pro.status = 'active'
license_pro.expiry_date = timezone.now() + timedelta(days=30)
license_pro.start_date = timezone.now()
license_pro.save()
lifecycle_pro = UserPlanLifecycle.objects.create(
    user=user_pro,
    trial_starts_at=timezone.now() - timedelta(days=2),
    trial_ends_at=timezone.now() + timedelta(days=5),  # Still in trial
)
print(f"✅ Created pro user (trial): testpro / {TEST_PASSWORD}")
print(f"   Trial ends in 5 days: {lifecycle_pro.trial_ends_at}")

# 3. TEST FEATURE GATES
from portfolio.opencore_dpi import check_feature_access
can_free, reason_free = check_feature_access(user_free, 'sentiment_score')
can_pro, reason_pro = check_feature_access(user_pro, 'sentiment_score')
print(f"\n✅ Feature access checks:")
print(f"   Free user (sentiment_score): {can_free} ({reason_free})")
print(f"   Pro user (sentiment_score): {can_pro} ({reason_pro})")

# 4. CHECK ENTITLEMENTS
from portfolio.permissions import resolve_user_entitlements
ent_free = resolve_user_entitlements(user_free)
ent_pro = resolve_user_entitlements(user_pro)
print(f"\n✅ Entitlements:")
print(f"   Free: plan={ent_free['plan']}, trial_state={ent_free['trial_state']}")
print(f"   Pro: plan={ent_pro['plan']}, trial_state={ent_pro['trial_state']}")
print(f"   Pro trial_ends_at: {ent_pro['trial_ends_at']}")

print(f"\n🎉 All test users ready! Login to frontend:")
print(f"   testfree / {TEST_PASSWORD}  (gets 403 on premium endpoints)")
print(f"   testpro / {TEST_PASSWORD}   (gets 200 + tracking)")
