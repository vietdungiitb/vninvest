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

django.setup()

from django.contrib.auth.models import User
from identity_access.models import CoreTenant, TenantMember
from portfolio.models import UserConfig

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

# 2. Create default tenant
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

# 4. Verify UserConfig + email verification
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

print("\n" + "=" * 60)
print("✅ Setup Complete!")
print("=" * 60)
print("\nLogin with:")
print("  curl -X POST http://localhost:8000/api/auth/token/ \\")
print("    -H 'Content-Type: application/json' \\")
print("    -d '{\"username\": \"admin\", \"password\": \"test@123456\"}'")
print()
