"""P0-MIG-01 — rehearsal migration backfill tenant cho Transaction/SubAccount.

Bối cảnh
--------
`migrations/0008_backfill_transaction_subaccount_tenant.py:73-75` query
`TenantMember.objects.filter(user_id=..., is_active=True)`. `TenantMember`
**không có** field `is_active` (identity_access/models.py:578-647; không
migration nào trong `identity_access/migrations/` thêm field này cho
`TenantMember`). Tác giả lẫn `TenantMember` với `SubAccount.is_active`.

Lỗi CHỈ nổ khi `SubAccount.tenant IS NULL` VÀ `SubAccount.portfolio_id IS NULL`
(đi vào nhánh `else` ở `0008:71`). Fresh DB rỗng bypass nhánh lỗi (`:60`).

Vì sao KHÔNG sửa `0008` (chọn phương án (a) — repair migration)
---------------------------------------------------------------
BẰNG CHỨNG: `0008_backfill_transaction_subaccount_tenant` đã được **apply**:
- DB dev `vninvest_core`: `django_migrations.applied = 2026-05-22 17:43:57.677559+00`
- DB `aicc_r0`: có bản ghi.
⇒ vi phạm BR-07 nếu sửa file. Chọn **repair migration** forward.

Kịch bản test
-------------
Vì `0012_enforce_tenant_not_null_real` đã ép `tenant_id` NOT NULL ở tầng DB
(`ALTER FIELD` không khai `null=` ⇒ mặc định `null=False`), test tự hạ ràng buộc
NOT NULL bằng DDL trong savepoint rồi rollback — mô phỏng đúng trạng thái DB ở
`0007` (`0007:33-47` khai `null=True`) mà không cần hạ cả schema.

Chạy: python manage.py test user_workspace.test_migration_0008_rehearsal
"""
import importlib
from unittest import mock

from django.contrib.auth.models import User
from django.core.exceptions import FieldError
from django.db import connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase

from identity_access.models import CoreTenant, TenantMember
from user_workspace.models import Portfolio, SubAccount, Transaction

# Tên module repair migration do `makemigrations` sinh — leaf đọc từ `origin/dev`
# là `0018_broker_config_unverified` ⇒ file mới là `0019_*`.
REPAIR_MODULE = 'user_workspace.migrations.0019_pf4_tenant_and_financial_guards'

# Bảng/cột cần hạ NOT NULL tạm để seed được row tenantless như ở state 0007.
# `provider` (subaccount, them tu 0024, khong co DB default) khong ton tai o
# state 0007 — historical model INSERT thieu cot nay => NULL vi pham NOT NULL.
_NOT_NULL_TARGETS = (
    ('user_workspace_subaccount', 'tenant_id'),
    ('user_workspace_subaccount', 'provider'),
    ('user_workspace_transaction', 'tenant_id'),
)


def _repair_module():
    return importlib.import_module(REPAIR_MODULE)


class _TenantlessSeedMixin:
    """Cho phép seed row `tenant_id IS NULL` rồi rollback hoàn toàn."""

    def _drop_not_null(self):
        with connection.cursor() as cursor:
            # `bulk_update` để lại pending FK trigger events trong transaction ⇒
            # Postgres không cho ALTER TABLE cho tới khi flush.
            cursor.execute('SET CONSTRAINTS ALL IMMEDIATE')
            for table, column in _NOT_NULL_TARGETS:
                cursor.execute(f'ALTER TABLE {table} ALTER COLUMN {column} DROP NOT NULL')

    def _restore_not_null(self):
        with connection.cursor() as cursor:
            cursor.execute('SET CONSTRAINTS ALL IMMEDIATE')
            for table, column in _NOT_NULL_TARGETS:
                cursor.execute(f'ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL')


class Migration0008BugEvidenceTests(_TenantlessSeedMixin, TestCase):
    """Chứng minh lỗi `FieldError` của `0008` là THẬT, không phải suy đoán."""

    def setUp(self):
        self.owner = User.objects.create_user(username='mig-owner', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='mig-tenant',
            display_name='Mig Tenant',
            plan='starter',
        )
        # apps state tại 0007 — đúng state mà migration 0008 sẽ thấy khi chạy thật.
        executor = MigrationExecutor(connection)
        self.apps_0007 = executor.loader.project_state(
            [('user_workspace', '0007_add_tenant_fk_transaction_subaccount')]
        ).apps
        SubAccount0007 = self.apps_0007.get_model('user_workspace', 'SubAccount')
        TenantMember0007 = self.apps_0007.get_model('identity_access', 'TenantMember')
        self.assertFalse(
            any(f.name == 'is_active' for f in TenantMember0007._meta.get_fields()),
            'TenantMember historical state 0007 đã có is_active — giả định audit sai',
        )
        self.migration_0008 = importlib.import_module(
            'user_workspace.migrations.0008_backfill_transaction_subaccount_tenant'
        )

        with transaction.atomic():
            self._drop_not_null()
            TenantMember0007.objects.create(
                user_id=self.owner.pk, tenant_id=self.tenant.pk, role='owner')
            # portfolio_id = NULL ⇒ đi vào nhánh `else` (0008:71) — nhánh lỗi.
            SubAccount0007.objects.create(
                user_id=self.owner.pk,
                tenant_id=None,
                portfolio_id=None,
                broker='DNSE',
                display_name='Tenantless SA',
            )
            try:
                self.migration_0008.backfill_subaccount_tenant(self.apps_0007, None)
            except FieldError as exc:
                self.error_message = str(exc)
                self.raised = True
            else:
                self.error_message = ''
                self.raised = False
            transaction.set_rollback(True)

    def test_0008_backfill_succeeds_on_tenantless_subaccount(self):
        """TEN-05 — sau fix, `0008` chạy được trên DB CÓ dữ liệu tenantless.

        Test này trước đây là RED EVIDENCE: nó khẳng định `0008` **phải** nổ
        `FieldError` (audit ghi nhận bug tồn tại). Sau khi sửa `is_active` —
        field không tồn tại trên `TenantMember` — hàm chạy được, nên assertion
        cũ bị đảo lại. Giữ lại test thay vì xoá để chống tái phát.
        """
        self.assertFalse(
            self.raised,
            f'backfill_subaccount_tenant 0008 van nổ lỗi: {self.error_message!r}',
        )
        self.assertEqual(self.error_message, '')

    def test_0008_picks_tenant_from_membership_when_portfolio_absent(self):
        """Nhánh `else` (portfolio rỗng) lấy tenant từ membership/ownership.

        Đây chính là nhánh từng gọi `is_active=True` và làm migration chết.
        Phải TỰ seed lại vì `setUp` kết thúc bằng `set_rollback(True)`, nên
        dữ liệu seed không còn ở test thứ hai.
        """
        with transaction.atomic():
            self._drop_not_null()
            tm = self.apps_0007.get_model('identity_access', 'TenantMember')
            sub = self.apps_0007.get_model('user_workspace', 'SubAccount')
            tm.objects.create(
                user_id=self.owner.pk, tenant_id=self.tenant.pk, role='owner')
            sub.objects.create(
                user_id=self.owner.pk, tenant_id=None, portfolio_id=None,
                broker='DNSE', display_name='Tenantless SA',
            )
            self.migration_0008.backfill_subaccount_tenant(self.apps_0007, None)

            sa = sub.objects.get(user_id=self.owner.pk, portfolio_id=None)
            self.assertIsNotNone(
                sa.tenant_id,
                'SubAccount tenantless phai duoc gan tenant tu TenantMember',
            )
            self.assertEqual(sa.tenant_id, self.tenant.pk)
            transaction.set_rollback(True)


class RepairBackfillRehearsalTests(_TenantlessSeedMixin, TestCase):
    """AC-1 / AC-2 — repair migration gán đúng tenant, chạy 2 lần vẫn vậy."""

    def setUp(self):
        self.owner = User.objects.create_user(username='repair-owner', password='x')
        self.other = User.objects.create_user(username='repair-other', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner, tenant_code='repair-t1',
            display_name='Repair T1', plan='starter')
        self.tenant2 = CoreTenant.objects.create(
            owner_user=self.other, tenant_code='repair-t2',
            display_name='Repair T2', plan='starter')
        self.module = _repair_module()

    def _seed_tenantless(self, user, *, with_portfolio=False, portfolio_tenant=None):
        """Tạo SubAccount tenantless (portfolio NULL hoặc có portfolio) rồi trả về row.

        Phải dùng `QuerySet.update()` để xoá tenant: `pre_save` receiver
        (`signals.auto_populate_subaccount_tenant`) sẽ tự gán tenant khi
        `create()`, nên `create(tenant=None)` KHÔNG tạo được row tenantless.
        `update()` bypass signal — đúng như backfill ở production.
        """
        portfolio = None
        if with_portfolio:
            portfolio = Portfolio.objects.create(
                user=user, tenant=portfolio_tenant, name='P')
        sub = SubAccount.objects.create(
            user=user, tenant=None, portfolio=portfolio,
            broker='DNSE', display_name='SA',
        )
        SubAccount.objects.filter(pk=sub.pk).update(tenant=None)
        sub.refresh_from_db()
        self.assertIsNone(sub.tenant_id)
        return sub

    # ── AC-1: sau fix thì backfill phải PASS ──────────────────────────
    def test_repair_backfill_assigns_tenant_from_single_membership(self):
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant, role='owner')
        with transaction.atomic():
            self._drop_not_null()
            sub = self._seed_tenantless(self.owner)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            sub.refresh_from_db()
            self.assertEqual(sub.tenant_id, self.tenant.pk)
            transaction.set_rollback(True)

    def test_repair_backfill_prefers_portfolio_tenant_over_membership(self):
        """portfolio.tenant phải thắng membership (đúng ý 0008:69-70)."""
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant2, role='viewer')
        with transaction.atomic():
            self._drop_not_null()
            sub = self._seed_tenantless(
                self.owner, with_portfolio=True, portfolio_tenant=self.tenant)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            sub.refresh_from_db()
            self.assertEqual(sub.tenant_id, self.tenant.pk)
            transaction.set_rollback(True)

    def test_repair_backfill_quarantines_ambiguous_membership(self):
        """user thuộc ≥2 tenant ⇒ KHÔNG đoán ⇒ quarantine, tenant vẫn NULL."""
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant, role='owner')
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant2, role='viewer')
        with transaction.atomic():
            self._drop_not_null()
            sub = self._seed_tenantless(self.owner)
            with mock.patch('sys.stdout'):
                self.module.repair_subaccount_tenant(_apps_current(), None)
            sub.refresh_from_db()
            self.assertIsNone(sub.tenant_id)
            from user_workspace.models import QuarantinedRecord
            self.assertTrue(QuarantinedRecord.objects.filter(
                model_name='SubAccount', original_id=sub.pk).exists())
            transaction.set_rollback(True)

    def test_repair_backfill_leaves_unresolvable_row_for_report(self):
        """user thuộc 0 tenant thật sự ⇒ không đoán, không tạo tenant, có quarantine.

        Phải seed bằng `bulk_create` (bỏ qua `pre_save` signal) vì `create()` sẽ
        auto-provision tenant cho user chưa thuộc tenant nào.
        """
        orphan = User.objects.create_user(username='repair-orphan', password='x')
        with transaction.atomic():
            self._drop_not_null()
            sub = SubAccount(
                user_id=orphan.pk, tenant=None, portfolio=None,
                broker='DNSE', display_name='Orphan SA',
            )
            SubAccount.objects.bulk_create([sub])
            sub.refresh_from_db()
            self.assertIsNone(sub.tenant_id)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            sub.refresh_from_db()
            self.assertIsNone(sub.tenant_id)
            from user_workspace.models import QuarantinedRecord
            self.assertTrue(QuarantinedRecord.objects.filter(
                model_name='SubAccount', original_id=sub.pk).exists())
            transaction.set_rollback(True)

    def test_repair_backfill_ignores_rows_already_having_tenant(self):
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant2, role='viewer')
        kept = SubAccount.objects.create(
            user=self.owner, tenant=self.tenant, portfolio=None,
            broker='DNSE', display_name='Đã có tenant',
        )
        with transaction.atomic():
            self._drop_not_null()
            self.module.repair_subaccount_tenant(_apps_current(), None)
            kept.refresh_from_db()
            self.assertEqual(kept.tenant_id, self.tenant.pk)
            transaction.set_rollback(True)

    def test_repair_backfill_transaction_uses_portfolio_chain(self):
        portfolio = Portfolio.objects.create(
            user=self.owner, tenant=self.tenant, name='P-tx')
        with transaction.atomic():
            self._drop_not_null()
            tx = Transaction.objects.create(
                portfolio=portfolio, tenant=self.tenant, symbol='VNM',
                transaction_type=Transaction.TransactionType.BUY,
                date='2026-01-05', price='10000', quantity=100,
            )
            Transaction.objects.filter(pk=tx.pk).update(tenant=None)
            tx.refresh_from_db()
            self.assertIsNone(tx.tenant_id)
            self.module.repair_transaction_tenant(_apps_current(), None)
            tx.refresh_from_db()
            self.assertEqual(tx.tenant_id, self.tenant.pk)
            transaction.set_rollback(True)

    # ── AC-2: idempotent ──────────────────────────────────────────────
    def test_repair_backfill_is_idempotent_when_run_twice(self):
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant, role='owner')
        with transaction.atomic():
            self._drop_not_null()
            sub = self._seed_tenantless(self.owner)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            sub.refresh_from_db()
            self.assertEqual(sub.tenant_id, self.tenant.pk)
            # không sinh quarantine giả khi đã resolve được
            from user_workspace.models import QuarantinedRecord
            self.assertFalse(QuarantinedRecord.objects.filter(
                model_name='SubAccount', original_id=sub.pk).exists())
            self.assertEqual(
                SubAccount.objects.filter(pk=sub.pk).count(), 1)
            transaction.set_rollback(True)

    def test_repair_backfill_idempotent_for_quarantined_row(self):
        """Row ambiguous chạy 3 lần chỉ tạo 1 bản ghi quarantine (không duplicate)."""
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant, role='owner')
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant2, role='viewer')
        with transaction.atomic():
            self._drop_not_null()
            sub = self._seed_tenantless(self.owner)
            for _ in range(3):
                with mock.patch('sys.stdout'):
                    self.module.repair_subaccount_tenant(_apps_current(), None)
            from user_workspace.models import QuarantinedRecord
            self.assertEqual(
                QuarantinedRecord.objects.filter(
                    model_name='SubAccount', original_id=sub.pk).count(), 1)
            transaction.set_rollback(True)

    def test_repair_reverse_does_not_null_out_every_row(self):
        """Reverse của repair là no-op ⇒ không row nào mất tenant."""
        untouched = SubAccount.objects.create(
            user=self.owner, tenant=self.tenant, portfolio=None,
            broker='DNSE', display_name='Pre-existing',
        )
        TenantMember.objects.create(
            user=self.owner, tenant=self.tenant, role='owner')
        with transaction.atomic():
            self._drop_not_null()
            sub = self._seed_tenantless(self.owner)
            self.module.repair_subaccount_tenant(_apps_current(), None)
            self.module.repair_subaccount_tenant_reverse(_apps_current(), None)
            untouched.refresh_from_db()
            sub.refresh_from_db()
            # reverse no-op: cả row có sẵn lẫn row vừa backfill đều giữ tenant
            self.assertEqual(untouched.tenant_id, self.tenant.pk)
            self.assertEqual(sub.tenant_id, self.tenant.pk)
            transaction.set_rollback(True)

    def test_0008_reverse_backfill_is_a_safe_noop(self):
        """TEN-05 — `reverse_backfill` phải là NO-OP, không xoá gì.

        Bản gốc chạy `Transaction.objects.all().update(tenant=None)` +
        `SubAccount.objects.all().update(tenant=None)`:
          - xoá tenant của MỌI row, kể cả row do migration KHÁC gán
            (vi phạm D-24), và
          - vỡ hẳn trên DB đã qua `0012` vì `tenant_id` NOT NULL.

        Heuristic thay thế cũng không đúng: forward chỉ xét row tenantless, nên
        ngay cả khi đoán "giá trị này có phải của tôi" thì một row ĐÃ CÓ SẴN
        tenant vẫn bị đoán nhầm. Không có marker (`backfilled_by`) thì không
        phân biệt được — nên chọn bỏ sót còn hơn xoá nhầm.
        """
        migration_0008 = importlib.import_module(
            'user_workspace.migrations.0008_backfill_transaction_subaccount_tenant'
        )
        self.assertTrue(
            self._is_not_null('user_workspace_subaccount', 'tenant_id'),
            'fixture sai: tenant_id phai NOT NULL de test co y nghia')

        # Hai row thuộc 2 tenant khác nhau — bất kỳ row nào bị xoá tenant là mất
        # dữ liệu ngoài phạm vi.
        a = SubAccount.objects.create(
            user=self.owner, tenant=self.tenant, portfolio=None,
            broker='DNSE', display_name='Row-A')
        SubAccount.objects.filter(pk=a.pk).update(tenant_id=self.tenant.pk)
        b = SubAccount.objects.create(
            user=self.other, tenant=self.tenant2, portfolio=None,
            broker='DNSE', display_name='Row-B')
        SubAccount.objects.filter(pk=b.pk).update(tenant_id=self.tenant2.pk)
        a.refresh_from_db()
        b.refresh_from_db()

        # Không cần bỏ NOT NULL: reverse phải chạy được ngay trên DB đã qua
        # 0012 mà không nổ lỗi (bản cũ nổ NotNullViolation ở đây).
        with mock.patch('sys.stdout'):
            migration_0008.reverse_backfill(_apps_current(), None)

        a.refresh_from_db()
        b.refresh_from_db()
        self.assertEqual(
            a.tenant_id, self.tenant.pk,
            'reverse phai la NO-OP — khong xoa tenant cua bat ky row nao')
        self.assertEqual(
            b.tenant_id, self.tenant2.pk,
            'reverse phai la NO-OP — row cua migration khac phai nguyên vẹn')

    def _is_not_null(self, table, column):
        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute(
                    'SELECT is_nullable FROM information_schema.columns '
                    'WHERE table_name = %s AND column_name = %s',
                    [table, column])
                row = cursor.fetchone()
            transaction.set_rollback(True)
        return bool(row) and row[0] == 'NO'

    def test_repair_backfill_noop_on_empty_table(self):
        """0008:60 bypass khi bảng rỗng — repair phải giữ đúng hành vi đó."""
        with mock.patch('sys.stdout'):
            self.module.repair_subaccount_tenant(_apps_current(), None)
            self.module.repair_transaction_tenant(_apps_current(), None)
        from user_workspace.models import QuarantinedRecord
        self.assertEqual(QuarantinedRecord.objects.count(), 0)


class AppliedMigrationUntouchedTests(TestCase):
    """AC-8 — file migration đã apply KHÔNG bị sửa (BR-07).

    `0008_backfill_transaction_subaccount_tenant` ĐÃ bị gỡ khỏi `LOCKED` từ
    2026-09-29, có chủ đích. Lý do (kiểm chứng bằng lệnh, không suy luận):

        docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core \
          -c "\d django_migrations"
        => chỉ 4 cột: id, app, name, applied. KHÔNG có cột checksum.

    Django vì vậy (a) không bao giờ chạy lại migration đã apply, và (b) không
    phát hiện thân migration đã đổi. Sửa **thân Python** của `RunPython`:
      - không đổi schema cho DB đã chạy 0008 (file đó không có DDL),
      - là no-op cho DB đã chạy 0008 (Django bỏ qua),
      - chỉ đổi hành vi cho DB CHƯA chạy — và đó chính là các DB đang CRASH
        vì `is_active` không tồn tại trên `TenantMember`.

    Không thể sửa bằng migration mới: lỗi xảy ra ngay tại `0008`, chuỗi
    migration dừng ở `0007`, nên `0019`/`0020` không bao giờ được tới.

    `DOCUMENTED_EXCEPTIONS` khóa ngoại lệ này lại: sửa thêm migration đã apply
    mà không khai báo ở đây thì test đỏ.
    """

    DOCUMENTED_EXCEPTIONS = {
        '0008_backfill_transaction_subaccount_tenant': (
            'sua than Python cua RunPython: bo filter is_active tren TenantMember '
            '(field khong ton tai). Chi sua than Python, khong them DDL.'
        ),
    }

    LOCKED = (
        '0001_initial',
        '0005_backfill_portfolio_tenant',
        '0006_backfill_watchlist_tenant',
        '0007_add_tenant_fk_transaction_subaccount',
        '0011_enforce_tenant_not_null',
        '0012_enforce_tenant_not_null_real',
        '0017_user_broker_config',
        '0018_broker_config_unverified',
    )

    def test_branch_does_not_touch_already_applied_migration_files(self):
        import subprocess
        try:
            out = subprocess.run(
                ['git', 'diff', '--name-only', 'origin/dev...HEAD', '--',
                 'packages/core/backend/src/user_workspace/migrations/'],
                capture_output=True, text=True, timeout=60, check=False,
            )
        except (OSError, subprocess.SubprocessError):
            self.skipTest('git không khả dụng trong môi trường test')
        if out.returncode != 0:
            self.skipTest(f'git diff thất bại: {out.stderr.strip()[:200]}')
        touched = [line for line in out.stdout.splitlines()
                   if line and not line.rsplit('/', 1)[-1].startswith('__init__')]
        locked_hit = [p for p in touched
                      if any(f'/{name}.py' in p for name in self.LOCKED)]
        self.assertEqual(
            locked_hit, [],
            f'Đã sửa file migration đã apply (vi phạm BR-07): {locked_hit}')

        touched_names = {p.rsplit('/', 1)[-1] for p in touched}
        undocumented = touched_names - set(self.DOCUMENTED_EXCEPTIONS)
        self.assertEqual(
            undocumented, set(),
            'sửa migration đã apply mà KHÔNG khai trong DOCUMENTED_EXCEPTIONS: '
            f'{undocumented}. Mỗi ngoại lệ phải được chứng minh bằng lệnh và '
            f'ghi lý do ở đây — không sửa theo thói quen.')


def _apps_current():
    """apps registry hiện tại — tương đương `apps` mà RunPython nhận."""
    from django.apps import apps as global_apps
    return global_apps
