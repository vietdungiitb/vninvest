from django.contrib.auth.models import User
from identity_access.models import CoreTenant, CoreServiceAccount
import os
import secrets
import sys

def setup():
    username = os.environ.get('VNINVEST_ADMIN_USERNAME', 'admin')
    email = os.environ.get('VNINVEST_ADMIN_EMAIL', 'admin@vninvest.local')
    # This account is created with is_staff/is_superuser=True. It previously had
    # a hardcoded password committed to git, which handed every repo reader a
    # superuser login. The password is now supplied by the operator, or
    # generated once and printed.
    password = os.environ.get('VNINVEST_ADMIN_PASSWORD')
    generated = password is None
    if generated:
        password = secrets.token_urlsafe(24)

    u, created = User.objects.get_or_create(username=username, defaults={'email': email, 'is_staff': True, 'is_superuser': True})
    if created or not u.check_password(password):
        u.set_password(password)
        u.save()
    print(f'User {username} ready')
    if generated:
        print(f'  generated admin password (store it now): {password}')

    tenant, t_created = CoreTenant.objects.get_or_create(
        owner_user=u, 
        defaults={
            'tenant_code': 'vni-saas', 
            'display_name': 'VNI SaaS', 
            'plan': 'enterprise'
        }
    )
    print(f'Tenant {tenant.tenant_code} ready')

    sa, sa_created = CoreServiceAccount.objects.get_or_create(
        tenant=tenant, 
        name='Default Service Account', 
        defaults={
            'status': 'active', 
            'scopes': ['*']
        }
    )
    print(f'Service Account {sa.name} ready')

if __name__ == '__main__':
    setup()
