"""
LED-05 — backfill `Transaction` → `LedgerEntry` + `CashFlow`.

Kịch bản bắt buộc của AC1: **fresh DB**, migrate tới trước backfill, tạo dữ
liệu, rồi chạy backfill. Đây là cách duy nhất bắt được lỗi "migration chạy
được vì DB rỗng" — cũng chính là lỗi đã làm TEN-05 lọt lần trước.

Test chạy migration thật qua `MigratorTestCase`-style: dùng
`MigrationExecutor` để migrate tới `0021`, chèn dữ liệu, rồi migrate tới
`0022`. Đây là lý do file này chậm hơn test thuần — nhưng test nhanh thì
chỉ chứng minh được điều gì đó không liên quan.
"""
from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder
from django.test import TransactionTestCase

from identity_access.models import CoreTenant
from user_workspace.models import CashFlow, LedgerEntry, Portfolio, Transaction

BACKFILL_MARKER = '0022_backfill_transaction_to_ledger'
APP = 'user_workspace'
BEFORE = '0021_portfolio_opening_balance_and_more'
TARGET = '0022_backfill_transaction_to_ledger'

logger = logging.getLogger(__name__)


# ── Vì sao fixture tạo `Transaction` bằng `bulk_create` ──────────────────
#
# Tín hiệu `post_save` trên `Transaction` (`user_workspace/signals.py:113` ->
# `ledger/transaction_sync.py:253`, thêm ở `d7226a591` P0-2 ngày 2026-10-06)
# ghi `LedgerEntry` **mỗi lần giao dịch được lưu**. File test này viết ngày
# 2026-10-03, tứ **trước** hành vi đó — và trước `768d0897f` (2026-10-12) nó
# chưa từng được `manage.py test` chạy tới, nên xung đột nằm im cho tới nay.
#
# Dùng `create()` ở đây thì mọi AC về marker (`backfilled_by=BACKFILL_MARKER`)
# đều hỏng theo cách KHÔNG đại diện cho sản phẩm: dòng sổ cái do tín hiệu sinh
# ra không mang marker, nên `0022` bỏ qua (đúng — nó không được ghi trùng) và
# assertion "backfill ghi 3 dòng" thành sai. Test sẽ đo hành vi của tín hiệu
# chứ không đo hành vi của migration.
#
# `bulk_create` **không** bắn `post_save` ⇒ fixture đúng trạng thái lịch sử
# mà `0022` được thiết kế để chạy trên đó: dữ liệu thô, chưa đồng bộ sổ cái.
_TX_WHY_BULK_CREATE = True


def _discard_test_transactions():
    """Xoá sạch `Transaction` mà test vừa tạo, TRƯỚC khi đi tiếp migration.

    Vì sao cần: `0022.forwards()` **cố ý** raise khi gặp dòng không map được
    (`symbol=''`, `transaction_type='BONUS'`) — và hai test
    `test_unmappable_rows_stop_the_backfill` /
    `test_backfill_refuses_when_too_many_rows_are_unmappable` để lại đúng
    những dòng đó. `TransactionTestCase` flush ở `_fixture_teardown`, tức **sau**
    `tearDown`, nên lúc khôi phục migration thì dữ liệu hỏng vẫn còn trong DB.

    Hệ quả nếu không dọn: `tearDown` nuốt lỗi ở `except` ⇒ `user_workspace` kẹt
    ở `0021` ⇒ `0023` không bao giờ apply ⇒ `ValuationSnapshot.stock_value` còn
    NOT NULL và trigger append-only (LED-01) biến mất. Mọi test chạy sau trong
    cùng process đó sẽ chạy trên schema khác với lúc chạy riêng — đúng loại
    lỗi "chại riêng thì xanh".
    """
    Transaction.objects.all().delete()


def _assert_schema_restored():
    """Nổ lên nếu migration không khôi phục về leaf.

    `tearDown` bắt buộc phải nuốt lỗi: một test cố ý làm migration FAIL sẽ khiến
    `tearDown` thử lại chính migration đó và nổ lần nữa. Nhưng nuốt lỗi cũng
    chính là lý do DB bị bỏ hoang ở `0021` mà **không ai biết**. Vì vậy phần
    kiểm tra nằm ngoài `try/except`: khôi phục hỏng là lỗi của chính test này và
    phải hiện ra, không được âm thầm làm hỏng các test khác.
    """
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    applied = set(MigrationRecorder(connection).applied_migrations())
    stuck = [node for node in executor.loader.graph.leaf_nodes() if node not in applied]
    if stuck:
        raise AssertionError(
            'test_ledger_migration_backfill de lai schema o trang thai migration '
            f'khong day du: thieu {stuck}. Bat buoc khoi phuc ve leaf truoc khi '
            'ket thuc, neu khong moi test chay sau trong cung process se chay tren '
            'schema khac.'
        )


def _tx(portfolio, tenant, **overrides):
    payload = {
        'portfolio': portfolio,
        'tenant': tenant,
        'symbol': 'VNM',
        'transaction_type': 'BUY',
        'date': date(2026, 1, 5),
        'price': Decimal('70000'),
        'quantity': 1000,
        'fee': Decimal('0'),
        'tax': Decimal('0'),
        'external_id': '',
    }
    payload.update(overrides)
    # **`bulk_create`, không `create`** — xem `_TX_WHY_BULK_CREATE` ở trên.
    return Transaction.objects.bulk_create([Transaction(**payload)])[0]


class BackfillMigrationTests(TransactionTestCase):
    """AC1/AC2 — chạy trên DB **có dữ liệu**, không chỉ DB rỗng."""

    available_apps = None
    serialized_rollback = False

    def setUp(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([(APP, BEFORE)])
        self._seed()

    def tearDown(self):
        # Thứ tự này quan trọng. `migrate([(app, 'zero')])` không hợp lệ
        # (`NodeNotFoundError`). Và nếu chỉ migrate tới leaf thì một test cố ý
        # làm migration FAIL sẽ khiến tearDown **thử lại chính migration đó**
        # và nổ lần nữa — lỗi đúng đã được `assertRaises` bắt lại báo thành
        # ERROR ở tearDown, tức test đúng lại bị ghi là hỏng.
        self.executor = MigrationExecutor(connection)
        self.executor.loader.build_graph()
        try:
            self.executor.migrate([(APP, BEFORE)])
            _discard_test_transactions()
            self.executor = MigrationExecutor(connection)
            self.executor.loader.build_graph()
            self.executor.migrate(self.executor.loader.graph.leaf_nodes())
        except Exception as exc:  # noqa: BLE001
            # Test DB bị huỷ ngay sau đó; chỉ cần không che mất lỗi của test.
            logger.info('tearDown: bo qua loi khoi phuc migration: %s', exc)
        _assert_schema_restored()

    def _seed(self):
        self.tenant = CoreTenant.objects.create(
            tenant_code='w2-backfill',
            display_name='w2-backfill',
            owner_user=User.objects.create_user(username='w2-backfill', password='x'),
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.portfolio = Portfolio.objects.create(
            user=self.tenant.owner_user, tenant=self.tenant, name='Backfill')

    def _run_backfill(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([(APP, TARGET)])

    # ── AC1: fresh DB + dữ liệu thật ─────────────────────────────────

    def test_ac1_migration_runs_with_data(self):
        _tx(self.portfolio, self.tenant, external_id='B-1')
        _tx(self.portfolio, self.tenant, transaction_type='SELL',
            date=date(2026, 2, 10), price=Decimal('80000'),
            quantity=400, fee=Decimal('50000'), external_id='B-2')
        _tx(self.portfolio, self.tenant, transaction_type='DIVIDEND',
            date=date(2026, 3, 20), price=Decimal('1500'),
            quantity=1000, tax=Decimal('75000'), external_id='B-3')

        self._run_backfill()

        self.assertEqual(LedgerEntry.objects.count(), 3)
        self.assertEqual(
            LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER).count(), 3)

    def test_ac2_counts_match_between_source_and_target(self):
        for i in range(5):
            _tx(self.portfolio, self.tenant, external_id=f'B-{i}')
        self._run_backfill()

        source = Transaction.objects.count()
        target = LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER).count()
        self.assertEqual(source, target)

    def test_cash_flow_signs_follow_d06(self):
        _tx(self.portfolio, self.tenant, external_id='B-1', fee=Decimal('100000'))
        _tx(self.portfolio, self.tenant, transaction_type='SELL',
            date=date(2026, 2, 10), price=Decimal('80000'),
            quantity=400, fee=Decimal('50000'), tax=Decimal('75000'),
            external_id='B-2')
        _tx(self.portfolio, self.tenant, transaction_type='DIVIDEND',
            date=date(2026, 3, 20), price=Decimal('1500'),
            quantity=1000, tax=Decimal('75000'), external_id='B-3')
        self._run_backfill()

        by_type = {
            flow.flow_type: flow.amount
            for flow in CashFlow.objects.select_related('entry')
        }
        # BUY: −(70 000 × 1 000 + 100 000) = −70 100 000
        self.assertEqual(by_type['BUY'], Decimal('-70100000.00'))
        # SELL: 80 000 × 400 − 50 000 − 75 000 = +31 875 000
        self.assertEqual(by_type['SELL'], Decimal('31875000.00'))
        # DIVIDEND: 1 500 × 1 000 − 0 − 75 000 = +1 425 000
        self.assertEqual(by_type['DIVIDEND'], Decimal('1425000.00'))

    def test_every_entry_has_exactly_one_cash_flow(self):
        for i in range(4):
            _tx(self.portfolio, self.tenant, external_id=f'B-{i}')
        self._run_backfill()
        for entry in LedgerEntry.objects.all():
            self.assertEqual(entry.cash_flows.count(), 1, entry)

    # ── PB2: dòng không map được phải được đếm, không bỏ qua ──────────

    def test_unmappable_rows_stop_the_backfill(self):
        """PB2 viết lại sau review: dòng không map được phải **dừng migration**,
        không phải "bỏ qua có đếm".

        Bản đầu cho phép bỏ sót tới 5% và vẫn báo "thành công" — 4 giao dịch
        trong 100 không có dòng tiền, NAV thiếu hụt một cách âm thầm. Ngưỡng
        phần trăm là ước lượng không có căn cứ; nguyên tắc của cả wave này là
        "thiếu dữ liệu ⇒ null + lý do", kể cả khi chính mình tạo ra phần thiếu.

        Ghi rõ về cách dựng dữ liệu hỏng: `symbol=''` phải tạo bằng
        `bulk_create` vì signal `pre_save` của `Transaction` chặn
        (`ValueError: Thiếu chứng khoản.`). Dữ liệu legacy trong DB thật là
        trạng thái trước khi signal đó có.
        """
        _tx(self.portfolio, self.tenant, external_id='B-good')
        Transaction.objects.bulk_create([
            Transaction(portfolio=self.portfolio, tenant=self.tenant, symbol='',
                        transaction_type='BUY', date=date(2026, 1, 5),
                        price=Decimal('70000'), quantity=1000, external_id='B-blank'),
            Transaction(portfolio=self.portfolio, tenant=self.tenant, symbol='HNG',
                        transaction_type='BONUS', date=date(2026, 1, 6),
                        price=Decimal('1'), quantity=100, external_id='B-badtype'),
        ])

        with self.assertRaises(RuntimeError) as ctx:
            self._run_backfill()

        message = str(ctx.exception)
        self.assertIn('2/3', message)
        self.assertIn('missing_symbol', message)
        self.assertIn('unknown_type:BONUS', message)
        # Lỗi phải kèm câu SQL để operator truy vết được, không phải chỉ con số.
        self.assertIn('SELECT pk, symbol', message)

    def test_clean_dataset_migrates_completely(self):
        """Đối chiếu: dữ liệu sạch thì 100% vào ledger, không bỏ sót gì."""
        for i in range(3):
            _tx(self.portfolio, self.tenant, external_id=f'G-{i}')
        self._run_backfill()
        self.assertEqual(LedgerEntry.objects.count(), 3)
        self.assertEqual(CashFlow.objects.count(), 3)

    def test_backfill_refuses_when_too_many_rows_are_unmappable(self):
        """Giữ lại tên cũ của bài test trước: giờ áp dụng cho **mọi** dòng hỏng,
        không chỉ khi vượt tỉ lệ."""
        _tx(self.portfolio, self.tenant, external_id='B-good')
        _tx(self.portfolio, self.tenant, transaction_type='BONUS', external_id='B-bad')

        with self.assertRaises(RuntimeError) as ctx:
            self._run_backfill()
        self.assertIn('khong map duoc', str(ctx.exception))

    def test_source_rows_are_untouched(self):
        """AC3: dữ liệu cũ còn nguyên sau backfill."""
        original = _tx(self.portfolio, self.tenant, external_id='B-1')
        self._run_backfill()
        original.refresh_from_db()
        self.assertEqual(original.price, Decimal('70000.00'))
        self.assertEqual(original.quantity, 1000)

    def test_rerunning_backfill_creates_no_duplicates(self):
        """`external_id` ổn định nên UNIQUE (tenant, external_id) làm backfill
        idempotent. Chạy lại không nhân bản dữ liệu tài chính."""
        _tx(self.portfolio, self.tenant, external_id='B-1')
        self._run_backfill()
        first = LedgerEntry.objects.count()

        # Migrate lùi rồi tiến lại = chạy lại đúng migration backfill.
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([(APP, BEFORE)])
        self._run_backfill()

        self.assertEqual(LedgerEntry.objects.count(), first)

    def test_manual_transactions_get_a_stable_reference(self):
        """Giao dịch nhập tay có `external_id=''`.

        Rỗng thì UNIQUE constraint cố ý bỏ qua ⇒ chạy lại migration sẽ nhân bản
        mỗi giao dịch tay. Test bản đầu dùng `external_id='B-1'` (không rỗng)
        nên nhánh sinh `manual:tx:<pk>` **chưa bao giờ chạy**.

        Cũng kiểm tiền tố có namespace: `tx-<pk>` trần có thể đụng `order_id` của
        broker (chuỗi tùy ý bên thứ ba), biến sự cố chất lượng dữ liệu thành
        `IntegrityError` mù.
        """
        import importlib

        module = importlib.import_module(
            'user_workspace.migrations.0022_backfill_transaction_to_ledger')
        prefix = module.MANUAL_REF_PREFIX

        tx = _tx(self.portfolio, self.tenant, external_id='')
        self._run_backfill()

        entry = LedgerEntry.objects.get()
        self.assertEqual(entry.external_id, f'{prefix}{tx.pk}')
        self.assertNotEqual(
            prefix, 'tx-', 'tiền tố phải có namespace để không đụng mã broker')

        # Chạy lại: không được nhân bản.
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([(APP, BEFORE)])
        self._run_backfill()
        self.assertEqual(LedgerEntry.objects.count(), 1)



    # ── rollback: chỉ xoá row của chính migration này ──────────────────

    def test_rollback_keeps_hand_written_entries(self):
        _tx(self.portfolio, self.tenant, external_id='B-1')
        self._run_backfill()
        hand_written = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='HNG', trade_date=date(2026, 4, 1), quantity=200,
            price=Decimal('30000'), market='VN_SPOT', source='manual',
        )
        self.assertEqual(LedgerEntry.objects.count(), 2)

        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([(APP, BEFORE)])

        self.assertEqual(LedgerEntry.objects.count(), 1)
        self.assertEqual(LedgerEntry.objects.get().pk, hand_written.pk)
        self.assertEqual(CashFlow.objects.count(), 0)

    def test_rollback_leaves_transactions_intact(self):
        tx = _tx(self.portfolio, self.tenant, external_id='B-1')
        self._run_backfill()
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([(APP, BEFORE)])
        self.assertTrue(Transaction.objects.filter(pk=tx.pk).exists())

    def test_empty_database_is_a_no_op(self):
        """AC1 nửa còn lại: fresh DB rỗng không được lỗi."""
        self._run_backfill()
        self.assertEqual(LedgerEntry.objects.count(), 0)
        self.assertEqual(CashFlow.objects.count(), 0)

    # ── AC: backfill phải chạy được khi sổ cái ĐÃ có dòng cho giao dịch ──

    def test_backfill_does_not_rewrite_entries_the_signal_already_synced(self):
        """**Lỗi thật, đã từng làm hỏng 10 test.**

        Tín hiệu `post_save` trên `Transaction` (`signals.py:113`, P0-2
        `d7226a591`) ghi `LedgerEntry` mỗi lần giao dịch được lưu. Nếu dữ liệu
        được tạo **qua ORM** (đúng đường đi của ứng dụng thật) thì tới lúc
        backfill chạy, dòng sổ cái **đã tồn tại**.

        Bản `forwards()` đầu tiên `bulk_create` không hỏi ⇒ ghi 2 lần ⇒ đụng
        `uniq_ledger_entry_tenant_external_id` ⇒ **cả migration abort**. Đây
        không chỉ là chuyện của test: bất kỳ lần rollback rồi thiết lập lại trên
        DB thật nào cũng đi vào đúng ngõ cụt này.

        Ở đây cố tình dùng `create()` — **không** phải `_tx`/`bulk_create` —
        vì cần đúng cái trạng thái đã đồng bộ sẵn đó.
        """
        Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5), price=Decimal('70000'),
            quantity=1000, fee=Decimal('0'), tax=Decimal('0'), external_id='B-1')

        synced = LedgerEntry.objects.filter(external_id='B-1')
        self.assertEqual(
            synced.count(), 1,
            'tiền đề của test: tín hiệu post_save phải tạo đúng 1 dòng sổ cái')

        # Không được ném `IntegrityError`.
        self._run_backfill()

        self.assertEqual(
            LedgerEntry.objects.filter(external_id='B-1').count(), 1,
            'backfill không được nhân bản dòng đã có')
        self.assertEqual(
            LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER).count(), 0,
            'dòng đã đồng bộ thì không phải việc của backfill — nó không được gắn marker')
        # Dòng đồng bộ sẵn phải giữ nguyên tiền mặt, không bị đụng.
        self.assertEqual(
            CashFlow.objects.filter(entry__external_id='B-1').count(), 1)
