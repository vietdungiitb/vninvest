# Data migration: Backfill tenant FK for Portfolio

from django.db import migrations


def backfill_portfolio_tenant(apps, schema_editor):
    """
    Backfill tenant FK for Portfolio objects by mapping user -> CoreTenant.
    Strategy:
      1. Try: user owns a tenant (owner_user FK)
      2. Fallback: user is member of a tenant (TenantMember)
      3. Report: orphaned portfolios (user has no tenant affiliation)
    """
    Portfolio = apps.get_model('user_workspace', 'Portfolio')
    CoreTenant = apps.get_model('identity_access', 'CoreTenant')
    TenantMember = apps.get_model('identity_access', 'TenantMember')
    
    backfilled = 0
    orphaned = 0
    
    for portfolio in Portfolio.objects.filter(tenant__isnull=True):
        # Try: user owns a tenant
        tenant = CoreTenant.objects.filter(owner_user=portfolio.user).first()
        
        if not tenant:
            # Fallback: user is member of a tenant
            member = TenantMember.objects.filter(user=portfolio.user).first()
            if member:
                tenant = member.tenant
        
        if tenant:
            portfolio.tenant = tenant
            portfolio.save(update_fields=['tenant'])
            backfilled += 1
        else:
            # Log orphaned portfolio (user has no tenant affiliation)
            orphaned += 1
            print(f"WARNING: Portfolio(id={portfolio.id}, user={portfolio.user.username}) has no tenant affiliation")
    
    print(f"Portfolio tenant backfill complete: {backfilled} updated, {orphaned} orphaned")


def reverse_backfill_portfolio_tenant(apps, schema_editor):
    """
    Reverse operation: clear tenant FK (data loss is expected for backward compatibility).
    """
    Portfolio = apps.get_model('user_workspace', 'Portfolio')
    Portfolio.objects.all().update(tenant=None)


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0004_add_tenant_fk_and_pricealert'),
    ]

    operations = [
        migrations.RunPython(backfill_portfolio_tenant, reverse_backfill_portfolio_tenant),
    ]
