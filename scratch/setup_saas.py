from django.contrib.auth.models import User
from identity_access.models import CoreTenant, CoreServiceAccount
import sys

def setup():
    username = 'admin'
    email = 'admin@vninvest.local'
    password = 'test@123456'
    
    u, created = User.objects.get_or_create(username=username, defaults={'email': email, 'is_staff': True, 'is_superuser': True})
    if created or not u.check_password(password):
        u.set_password(password)
        u.save()
    print(f'User {username} ready')

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
