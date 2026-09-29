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
from django.test import TransactionTestCase

from identity_access.models import CoreTenant
from user_workspace.models import CashFlow, LedgerEntry, Portfolio, Transaction

BACKFILL_MARKER = '0022_backfill_transaction_to_ledger'
APP = 'user_workspace'
BEFORE = '0021_portfolio_opening_balance_and_more'
TARGET = '0022_backfill_transaction_to_ledger'

logger = logging.getLogger(__name__)


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
    return Transaction.objects.create(**payload)


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
            self.executor = MigrationExecutor(connection)
            self.executor.loader.build_graph()
            self.executor.migrate(self.executor.loader.graph.leaf_nodes())
        except Exception as exc:  # noqa: BLE001
            # Test DB bị huỷ ngay sau đó; chỉ cần không che mất lỗi của test.
            logger.info('tearDown: bo qua loi khoi phuc migration: %s', exc)

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
        """`external_id` được giữ nên UNIQUE (tenant, external_id) làm backfill
        idempotent. Chạy lại không nhân bản dữ liệu tài chính."""
        _tx(self.portfolio, self.tenant, external_id='B-1')
        self._run_backfill()
        first = LedgerEntry.objects.count()

        # Migrate lùi rồi tiến lại = chạy lại đúng migration backfill.
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([(APP, BEFORE)])
        self._run_backfill()

        self.assertEqual(LedgerEntry.objects.count(), first)

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
