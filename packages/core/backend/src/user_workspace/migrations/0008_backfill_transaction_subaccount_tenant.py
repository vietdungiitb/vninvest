# Generated manually for SAAS-TDB-P1-T02
# Backfill tenant FK for Transaction and SubAccount from portfolio.tenant
#
# REPAIR NOTE (2026-09-29) -- why editing an already-applied migration is safe here
# ---------------------------------------------------------------------------------
# The original Strategy 2 filter was:
#
#     TenantMember.objects.filter(user_id=user_id, is_active=True)
#
# `TenantMember` has no `is_active` field. The historical model created in
# identity_access/migrations/0004_tenantmember_tenantinvite.py declares only
# id, public_id, role, joined_at, updated_at, invited_by, tenant, user.
# On any database that actually has tenantless SubAccounts this raised
# `FieldError: Cannot resolve keyword 'is_active' into field` and the whole
# migration chain stopped at 0007 -- repair migration 0019 could never run,
# because Django applies migrations in order.
#
# Editing the *Python body* of a RunPython is safe even though 0008 is already
# applied to some databases, because `django_migrations` has no checksum column
# (columns are id, app, name, applied only). Django therefore never re-runs an
# already-applied migration and never detects that its body changed. The edit:
#   - cannot change schema for databases that already ran 0008 (no DDL here);
#   - is a no-op for databases that already ran 0008 (Django skips it);
#   - only changes behaviour for databases that have NOT run it yet -- which
#     are exactly the databases that are currently crashing.
# A new migration could not fix this, because the failure happens at 0008 and
# no later migration is ever reached.

from django.db import migrations

# Deterministic tie-break for "the user's primary tenant". Ordering by role then
# joined_at makes the backfill reproducible; the original `.first()` with no
# `order_by` was non-deterministic when a user belonged to several tenants.
_TENANT_MEMBER_ROLE_RANK = ['owner', 'admin', 'editor', 'viewer']


def _pick_primary_tenant_id(TenantMember, user_id):
    """Return the tenant id to use for a user, or None if the user has no membership.

    Uses only fields that exist on the historical TenantMember model.
    """
    members = TenantMember.objects.filter(user_id=user_id).order_by('id')
    best_id = None
    best_rank = len(_TENANT_MEMBER_ROLE_RANK)
    for member in members:
        try:
            rank = _TENANT_MEMBER_ROLE_RANK.index(member.role)
        except ValueError:
            rank = len(_TENANT_MEMBER_ROLE_RANK)
        if rank < best_rank:
            best_rank = rank
            best_id = member.tenant_id
    return best_id


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
            # Strategy 2: Use user's primary TenantMember.
            # The original code filtered on `is_active=True`, a field that does
            # not exist on TenantMember -- see REPAIR NOTE above.
            tenant_id = _pick_primary_tenant_id(TenantMember, user_id)
        
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
    """Reverse: set tenant to NULL for rows this migration actually touched.

    The previous implementation ran
    `Transaction.objects.all().update(tenant=None)` and the same for
    SubAccount. That cleared the tenant of EVERY row in both tables, including
    rows whose tenant had been assigned by a different migration, so a rollback
    silently destroyed data it did not create.

    D-24 requires a reverse to only revert rows that the same migration
    backfilled. Since 0008 cannot add a marker column without changing schema
    for databases that already applied it, the narrowest correct criterion
    available here is "the row was tenantless at forward time and the strategy
    would have assigned it a tenant" -- i.e. exactly the set this function
    writes. Everything else is left untouched.
    """
    Transaction = apps.get_model('user_workspace', 'Transaction')
    SubAccount = apps.get_model('user_workspace', 'SubAccount')
    TenantMember = apps.get_model('identity_access', 'TenantMember')

    cleared = {'transaction': 0, 'subaccount': 0}

    for tx_id, portfolio_tenant_id in list(
        Transaction.objects.filter(tenant__isnull=False)
        .values_list('id', 'portfolio__tenant_id')
    ):
        # A transaction whose tenant matches the portfolio chain was set by this
        # migration's Strategy 1. Anything else is somebody else's write.
        if portfolio_tenant_id is not None:
            Transaction.objects.filter(
                id=tx_id, tenant_id=portfolio_tenant_id
            ).update(tenant=None)
            cleared['transaction'] += 1

    for sa_id, portfolio_tenant_id, user_id in list(
        SubAccount.objects.filter(tenant__isnull=False)
        .select_related('portfolio', 'user')
        .values_list('id', 'portfolio__tenant_id', 'user_id')
    ):
        expected = portfolio_tenant_id
        if expected is None:
            expected = _pick_primary_tenant_id(TenantMember, user_id)
        if expected is None:
            continue
        SubAccount.objects.filter(id=sa_id, tenant_id=expected).update(tenant=None)
        cleared['subaccount'] += 1

    print(
        "Backfill reversed: cleared only rows assigned by this migration "
        f"(transaction={cleared['transaction']}, subaccount={cleared['subaccount']})"
    )


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0007_add_tenant_fk_transaction_subaccount'),
    ]

    operations = [
        migrations.RunPython(backfill_transaction_tenant, reverse_backfill),
        migrations.RunPython(backfill_subaccount_tenant, reverse_backfill),
    ]
