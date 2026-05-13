# Generated manually for SAAS-TDB-P1-T02
# Backfill tenant FK for Transaction and SubAccount from portfolio.tenant

from django.db import migrations


def backfill_transaction_tenant(apps, schema_editor):
    """
    Assign tenant to Transaction from portfolio.tenant chain.
    Only updates rows where tenant is NULL and portfolio.tenant exists.
    Uses bulk_update with chunk_size=500 for performance.
    """
    Transaction = apps.get_model('user_workspace', 'Transaction')
    
    # Find all transactions with NULL tenant
    transactions_to_update = list(
        Transaction.objects.filter(tenant__isnull=True)
        .select_related('portfolio')
        .values_list('id', 'portfolio__tenant_id')
    )
    
    if not transactions_to_update:
        print("backfill_transaction_tenant: No transactions to update")
        return
    
    # Prepare bulk update objects
    updated_transactions = []
    for tx_id, portfolio_tenant_id in transactions_to_update:
        if portfolio_tenant_id is not None:
            tx = Transaction(id=tx_id, tenant_id=portfolio_tenant_id)
            updated_transactions.append(tx)
    
    # Bulk update in chunks
    chunk_size = 500
    for i in range(0, len(updated_transactions), chunk_size):
        chunk = updated_transactions[i:i+chunk_size]
        Transaction.objects.bulk_update(chunk, ['tenant_id'])
    
    print(f"backfill_transaction_tenant: Updated {len(updated_transactions)} rows")


def backfill_subaccount_tenant(apps, schema_editor):
    """
    Assign tenant to SubAccount from portfolio.tenant or user's primary tenant.
    Strategy:
      1. If portfolio exists, use portfolio.tenant
      2. Else if user has a TenantMember, use that tenant
      3. Else skip (backward compat)
    """
    SubAccount = apps.get_model('user_workspace', 'SubAccount')
    TenantMember = apps.get_model('identity_access', 'TenantMember')
    
    # Find all sub-accounts with NULL tenant
    subaccounts_to_update = list(
        SubAccount.objects.filter(tenant__isnull=True)
        .select_related('portfolio', 'user')
        .values_list('id', 'portfolio__tenant_id', 'user_id')
    )
    
    if not subaccounts_to_update:
        print("backfill_subaccount_tenant: No subaccounts to update")
        return
    
    updated_subaccounts = []
    for sa_id, portfolio_tenant_id, user_id in subaccounts_to_update:
        tenant_id = None
        
        # Strategy 1: Use portfolio.tenant if available
        if portfolio_tenant_id is not None:
            tenant_id = portfolio_tenant_id
        else:
            # Strategy 2: Use user's primary TenantMember
            member = TenantMember.objects.filter(
                user_id=user_id, is_active=True
            ).select_related('tenant').first()
            if member:
                tenant_id = member.tenant_id
        
        if tenant_id is not None:
            sa = SubAccount(id=sa_id, tenant_id=tenant_id)
            updated_subaccounts.append(sa)
    
    # Bulk update in chunks
    chunk_size = 500
    for i in range(0, len(updated_subaccounts), chunk_size):
        chunk = updated_subaccounts[i:i+chunk_size]
        SubAccount.objects.bulk_update(chunk, ['tenant_id'])
    
    print(f"backfill_subaccount_tenant: Updated {len(updated_subaccounts)} rows")


def reverse_backfill(apps, schema_editor):
    """Reverse: set tenant to NULL (safe for backward compat)."""
    Transaction = apps.get_model('user_workspace', 'Transaction')
    SubAccount = apps.get_model('user_workspace', 'SubAccount')
    
    Transaction.objects.all().update(tenant=None)
    SubAccount.objects.all().update(tenant=None)
    print("Backfill reversed: tenant set to NULL")


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0007_add_tenant_fk_transaction_subaccount'),
    ]

    operations = [
        migrations.RunPython(backfill_transaction_tenant, reverse_backfill),
        migrations.RunPython(backfill_subaccount_tenant, reverse_backfill),
    ]
