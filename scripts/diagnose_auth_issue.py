#!/usr/bin/env python
"""
Diagnose and fix auth/tenant issues for admin user.

Usage:
    cd backend
    python ../scripts/diagnose_auth_issue.py
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.path.insert(0, '.')
django.setup()

from django.contrib.auth.models import User
from django.contrib.auth import authenticate

print("=" * 60)
print("AUTH DIAGNOSTIC SCRIPT")
print("=" * 60)

# 1. Check admin user exists
print("\n[1] Checking admin user...")
try:
    admin = User.objects.get(username='admin')
    print(f"  ✓ Admin user found (id={admin.pk})")
    print(f"    - is_active: {admin.is_active}")
    print(f"    - email: {admin.email}")
except User.DoesNotExist:
    print("  ✗ Admin user NOT found - creating...")
    admin = User.objects.create_user(
        username='admin',
        email='admin@localhost',
        password='test@123456',
        is_staff=True,
        is_superuser=True
    )
    print(f"  ✓ Admin user created (id={admin.pk})")

# 2. Test authentication
print("\n[2] Testing authentication...")
authed = authenticate(username='admin', password='test@123456')
if authed:
    print("  ✓ Auth successful with admin/test@123456")
else:
    print("  ✗ Auth failed - checking password hash...")
    admin.set_password('test@123456')
    admin.save()
    print("  ✓ Password reset to test@123456")
    authed = authenticate(username='admin', password='test@123456')
    if authed:
        print("  ✓ Auth now successful")
    else:
        print("  ✗ Still failing - this is a backend issue")

# 3. Check tenant assignment (SaaS requirement)
print("\n[3] Checking tenant assignment (SaaS)...")
try:
    from identity_access.models import CoreTenant, TenantMember
    
    # Check if admin belongs to any tenant
    members = TenantMember.objects.filter(user=admin)
    if members.exists():
        for member in members:
            print(f"  ✓ Tenant: {member.tenant.name} (role: {member.role})")
    else:
        print("  ✗ Admin has NO tenant assigned - this is the 401 issue!")
        print("    Creating default tenant and membership...")
        
        # Create default tenant
        tenant, created = CoreTenant.objects.get_or_create(
            name='Default Tenant',
            defaults={'slug': 'default'}
        )
        print(f"  ✓ Tenant created: {tenant.name}")
        
        # Add admin as owner
        member, created = TenantMember.objects.get_or_create(
            tenant=tenant,
            user=admin,
            defaults={'role': 'owner'}
        )
        print(f"  ✓ Admin added as {member.role} to {tenant.name}")
except ImportError:
    print("  ! CoreTenant models not available - check packages/core import")
except Exception as e:
    print(f"  ! Error: {e}")

# 4. Check UserConfig + email verification
print("\n[4] Checking UserConfig and email verification...")
try:
    from portfolio.models import UserConfig
    
    cfg = UserConfig.objects.filter(user=admin).first()
    if cfg:
        print(f"  ✓ UserConfig exists")
        print(f"    - email_verified: {cfg.email_verified}")
        if not cfg.email_verified:
            print("    → Setting email_verified=True for login...")
            cfg.email_verified = True
            cfg.save()
            print("    ✓ Email marked as verified")
    else:
        print("  ! UserConfig not found - creating...")
        cfg = UserConfig.objects.create(
            user=admin,
            email_verified=True,
        )
        print(f"  ✓ UserConfig created and email verified")
except Exception as e:
    print(f"  ! Error: {e}")

print("\n" + "=" * 60)
print("DIAGNOSIS COMPLETE")
print("=" * 60)
print("\nTest login with:")
print("  curl -X POST http://localhost:8000/api/auth/token/ \\")
print("    -H 'Content-Type: application/json' \\")
print("    -d '{\"username\": \"admin\", \"password\": \"test@123456\"}'")
print()
