# Data migration: Backfill tenant FK for Watchlist

from django.db import migrations


def backfill_watchlist_tenant(apps, schema_editor):
    """
    Backfill tenant FK for Watchlist objects by mapping user -> CoreTenant.
    Strategy:
      1. Try: user owns a tenant (owner_user FK)
      2. Fallback: user is member of a tenant (TenantMember)
      3. Report: orphaned watchlists (user has no tenant affiliation)
    """
    Watchlist = apps.get_model('user_workspace', 'Watchlist')
    CoreTenant = apps.get_model('identity_access', 'CoreTenant')
    TenantMember = apps.get_model('identity_access', 'TenantMember')
    
    backfilled = 0
    orphaned = 0
    
    for watchlist in Watchlist.objects.filter(tenant__isnull=True):
        # Try: user owns a tenant
        tenant = CoreTenant.objects.filter(owner_user=watchlist.user).first()
        
        if not tenant:
            # Fallback: user is member of a tenant
            member = TenantMember.objects.filter(user=watchlist.user).first()
            if member:
                tenant = member.tenant
        
        if tenant:
            watchlist.tenant = tenant
            watchlist.save(update_fields=['tenant'])
            backfilled += 1
        else:
            # Log orphaned watchlist (user has no tenant affiliation)
            orphaned += 1
            print(f"WARNING: Watchlist(id={watchlist.id}, user={watchlist.user.username}) has no tenant affiliation")
    
    print(f"Watchlist tenant backfill complete: {backfilled} updated, {orphaned} orphaned")


def reverse_backfill_watchlist_tenant(apps, schema_editor):
    """
    Reverse operation: clear tenant FK (data loss is expected for backward compatibility).
    """
    Watchlist = apps.get_model('user_workspace', 'Watchlist')
    Watchlist.objects.all().update(tenant=None)


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0005_backfill_portfolio_tenant'),
    ]

    operations = [
        migrations.RunPython(backfill_watchlist_tenant, reverse_backfill_watchlist_tenant),
    ]
