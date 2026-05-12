#!/usr/bin/env python
"""
Quick setup: Create admin user + tenant for dev testing.
Run from backend directory.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
sys.path.insert(0, '.')

# Add packages/core to path for identity_access imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

django.setup()

from django.contrib.auth.models import User

# Import core models with fallback for dev environment where packages/core not in INSTALLED_APPS
try:
    from identity_access.models import CoreTenant, TenantMember
    HAS_CORE = True
except (ImportError, RuntimeError) as e:
    print(f"⚠ Warning: Could not import core models: {e}")
    HAS_CORE = False

try:
    from portfolio.models import UserConfig
except (ImportError, RuntimeError):
    UserConfig = None

print("Setting up admin user + tenant...\n")

# 1. Create/update admin user
admin, created = User.objects.get_or_create(
    username='admin',
    defaults={
        'email': 'admin@localhost',
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
    }
)

# Set password
admin.set_password('test@123456')
admin.save()

status = "created" if created else "updated"
print(f"✓ Admin user {status}: {admin.username} (id={admin.pk})")

# 2. Create default tenant (if core models available)
if HAS_CORE:
    tenant, created = CoreTenant.objects.get_or_create(
        slug='default',
        defaults={'name': 'Default Tenant'}
    )
    print(f"✓ Tenant: {tenant.name} (id={tenant.pk})")

    # 3. Add admin to tenant as owner
    member, created = TenantMember.objects.get_or_create(
        tenant=tenant,
        user=admin,
        defaults={'role': 'owner'}
    )
    print(f"✓ Tenant membership: {member.role}")
else:
    print("⚠ Tenant setup skipped (packages/core not available)")
    tenant = None

# 4. Verify UserConfig + email verification
if UserConfig is not None:
    cfg, created = UserConfig.objects.get_or_create(
        user=admin,
        defaults={'email_verified': True}
    )
    if not cfg.email_verified:
        cfg.email_verified = True
        cfg.save()
        print(f"✓ UserConfig: email_verified updated to True")
    else:
        print(f"✓ UserConfig: email_verified=True (already set)")
else:
    print(f"⚠ UserConfig: not available (packages/core may not be in INSTALLED_APPS)")

print("\n" + "=" * 60)
print("✅ Setup Complete!")
print("=" * 60)
print("\nLogin with:")
print("  curl -X POST http://localhost:8000/api/auth/token/ \\")
print("    -H 'Content-Type: application/json' \\")
print("    -d '{\"username\": \"admin\", \"password\": \"test@123456\"}'")
print()
