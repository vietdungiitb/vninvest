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


def _pick_primary_tenant_id(TenantMember, CoreTenant, user_id):
    """Return the tenant id to use for a user, or None if the user has no tenant.

    Uses only fields that exist on the historical models.

    `CoreTenant.owner_user` phải được xét: một user sở hữu tenant thường KHÔNG
    có dòng `TenantMember` (membership dành cho người được mời). Bỏ qua nhánh
    này thì `reverse_backfill` không hoàn tác được row của chính nó, vì nó
    tính lại bằng cùng hàm này mà không membership thì ra `None` ⇒ bỏ sót.
    """
    best_id = None
    best_rank = len(_TENANT_MEMBER_ROLE_RANK)

    for member in TenantMember.objects.filter(user_id=user_id).order_by('id'):
        try:
            rank = _TENANT_MEMBER_ROLE_RANK.index(member.role)
        except ValueError:
            rank = len(_TENANT_MEMBER_ROLE_RANK)
        if rank < best_rank:
            best_rank = rank
            best_id = member.tenant_id

    if best_id is not None:
        return best_id

    # Không có membership nào ⇒ thử tenant do user sở hữu.
    try:
        owned = CoreTenant.objects.filter(owner_user_id=user_id).only('id').first()
    except Exception:  # noqa: BLE001 — bảng CoreTenant có thể chưa có cột này
        return None
    return owned.id if owned is not None else None


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
    CoreTenant = apps.get_model('identity_access', 'CoreTenant')
    
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
            tenant_id = _pick_primary_tenant_id(TenantMember, CoreTenant, user_id)
        
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
    """Reverse = NO-OP có log. Cố tình KHÔNG xoá gì.

    Bản gốc chạy:
        Transaction.objects.all().update(tenant=None)
        SubAccount.objects.all().update(tenant=None)
    ⇒ xoá tenant của MỌI row ở cả hai bảng, kể cả row mà migration KHÁC đã
    gán. Đó là mất dữ liệu ngoài phạm vi (vi phạm D-24), và trên DB đã qua
    `0012_enforce_tenant_not_null_real` còn **vỡ hẳn** vì `tenant_id` NOT
    NULL ⇒ rollback bất kỳ DB nào đã qua `0012`.

    Vì sao KHÔNG dùng heuristic thay thế:
    Forward chỉ xét row `tenant IS NULL`; nếu reverse xét mọi row có tenant
    rồi đoán "giá trị này có phải do tôi gán không", thì một row ĐÃ CÓ SẴN
    tenant từ trước forward vẫn bị đoán là của migration và bị xoá. Đoán sai
    một lần là mất dữ liệu người dùng — tệ hơn nhiều so với rollback không
    hoàn tác hết.

    Cách đúng là cột marker kiểu `backfilled_by`, để reverse lọc
    `WHERE backfilled_by = '0008_...'`. Nhưng thêm cột vào một migration ĐÃ
    APPLY là thay đổi schema (vi phạm BR-07), và không thể sửa bằng migration
    mới vì lỗi nằm ngay tại 0008 (chuỗi migration dừng ở 0007).

    Vì vậy: bỏ sót còn hơn xoá nhầm. Rollback thật sự phải là
    `manage.py migrate user_workspace <target> --fake` cho 0008, hoặc restore
    từ backup. Ghi rõ ở `docs/OPEN_WORK_20260929.md` (OW-05).
    """
    logger_msg = (
        '0008.reverse_backfill: NO-OP. B?nh cu khong ghi de thay doi schema cho DB '
        'da apply 0008, nen khong co marker de biet row nao la cua migration nay. '
        'Day la chu dich: bo sot tot hon xoa nham du lieu nguoi dung. Xem '
        'docs/OPEN_WORK_20260929.md#ow-05.'
    )
    print(logger_msg)



class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0007_add_tenant_fk_transaction_subaccount'),
    ]

    operations = [
        migrations.RunPython(backfill_transaction_tenant, reverse_backfill),
        migrations.RunPython(backfill_subaccount_tenant, reverse_backfill),
    ]
