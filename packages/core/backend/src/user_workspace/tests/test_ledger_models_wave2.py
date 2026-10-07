"""
LED-01/02/03/06 — model + migration + NAV engine.

Cách đọc file này: mỗi test có bảng số viết tay trong docstring. Số đó do
`test_valuation_nav.py` kiểm lại, và ở đây chỉ kiểm phần model/ràng buộc.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from identity_access.models import CoreTenant
from user_workspace.models import (
    CashFlow,
    IdempotencyRecord,
    LedgerEntry,
    LedgerEntryImmutable,
    PositionSnapshot,
    Portfolio,
    Transaction,
    ValuationSnapshot,
)

MIGRATION_MARKER = '0021_wave2_expand'


def _tenant(username='w2-owner'):
    return CoreTenant.objects.create(
        tenant_code=f'w2-{username}',
        display_name=username,
        owner_user=User.objects.create_user(username=username, password='x'),
        status=CoreTenant.StatusChoices.ACTIVE,
    )


def _portfolio(tenant, name='Danh mục A'):
    return Portfolio.objects.create(user=tenant.owner_user, tenant=tenant, name=name)


def _entry(tenant, portfolio, **overrides):
    payload = {
        'tenant': tenant,
        'portfolio': portfolio,
        'entry_type': LedgerEntry.EntryType.BUY,
        'symbol': 'VNM',
        'trade_date': date(2026, 1, 5),
        'quantity': 1000,
        'price': Decimal('70000'),
        'fee': Decimal('0'),
        'tax': Decimal('0'),
        'market': LedgerEntry.Market.VN_SPOT,
        'source': LedgerEntry.Source.MANUAL,
    }
    payload.update(overrides)
    return LedgerEntry.objects.create(**payload)


# ══════════════════════════════════════════════════════════════════
# LED-01
# ══════════════════════════════════════════════════════════════════


class LedgerEntryModelTests(TestCase):
    def setUp(self):
        self.tenant = _tenant()
        self.portfolio = _portfolio(self.tenant)

    def test_create_valid_buy(self):
        entry = _entry(self.tenant, self.portfolio)
        self.assertEqual(entry.entry_type, 'BUY')
        self.assertIsNotNone(entry.pk)

    def test_tenant_is_mandatory_at_db_level(self):
        """D-03: không có entry nào tenant-less.

        Ghi rõ vì sao dùng `bulk_create` chứ không `create()`: signal
        `pre_save` tự điền `tenant` từ `portfolio` cho mọi model
        user_workspace (xem `resolve_tenant_for_user_workspace_instance`), nên
        qua ORM thì **không tạo được** entry thiếu tenant. Ràng buộc NOT NULL
        chỉ thật sự được kiểm khi bypass signal — đó mới là thứ ta muốn chứng
        minh.
        """
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                LedgerEntry.objects.bulk_create([LedgerEntry(
                    portfolio=self.portfolio,
                    entry_type='BUY', symbol='VNM', trade_date=date(2026, 1, 5),
                    quantity=100, price=Decimal('1'),
                )])

    def test_pre_save_signal_fills_tenant_from_portfolio(self):
        """Hệ quả của điều trên — ghi ra để người đọc không tưởng là lỗi."""
        entry = _entry(self.tenant, self.portfolio)
        self.assertEqual(entry.tenant_id, self.tenant.pk)

    def test_duplicate_external_id_in_same_tenant_raises(self):
        """AC2."""
        _entry(self.tenant, self.portfolio, external_id='DNSE-1')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                _entry(self.tenant, self.portfolio, external_id='DNSE-1')

    def test_same_external_id_in_other_tenant_is_allowed(self):
        other = _tenant('w2-other')
        other_portfolio = _portfolio(other, 'Danh mục B')
        _entry(self.tenant, self.portfolio, external_id='DNSE-1')
        _entry(other, other_portfolio, external_id='DNSE-1')

    def test_manual_entries_share_the_blank_external_id(self):
        """`external_id=''` nên bỏ qua UNIQUE partial, nếu không nhập tay
        giao dịch thứ hai là tự chặn mình."""
        _entry(self.tenant, self.portfolio, external_id='')
        _entry(self.tenant, self.portfolio, external_id='')

    def test_update_after_commit_is_refused(self):
        """R2 append-only."""
        entry = _entry(self.tenant, self.portfolio)
        entry.price = Decimal('1')
        with self.assertRaises(LedgerEntryImmutable):
            entry.save()

    def test_delete_is_refused(self):
        entry = _entry(self.tenant, self.portfolio)
        with self.assertRaises(LedgerEntryImmutable):
            entry.delete()

    def test_reversal_is_allowed_and_unique(self):
        """Sửa sai số = thêm entry ADJUSTMENT trỏ dòng gốc, không sửa dòng gốc."""
        original = _entry(self.tenant, self.portfolio)
        reversal = _entry(
            self.tenant, self.portfolio,
            entry_type=LedgerEntry.EntryType.ADJUSTMENT,
            source=LedgerEntry.Source.ADJUSTMENT,
            quantity=0, price=Decimal('0'),
            reversal_of=original,
        )
        self.assertEqual(reversal.reversals.count(), 0)
        self.assertEqual(original.reversals.count(), 1)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                _entry(
                    self.tenant, self.portfolio,
                    entry_type=LedgerEntry.EntryType.ADJUSTMENT,
                    quantity=0, price=Decimal('0'),
                    reversal_of=original,
                )

    def test_reversal_of_missing_row_is_rejected(self):
        """AC3.

        Không dùng `assertRaises(IntegrityError)` quanh `create()`: Django tạo
        FK constraint ở dạng `DEFERRABLE INITIALLY DEFERRED`, nên Postgres chỉ
        kiểm tra lúc COMMIT — mà `TestCase` không COMMIT trong test. Test đó sẽ
        **báo xanh dù ràng buộc hỏng**. `full_clean()` mới là tầng kiểm đúng,
        và API gọi nó trước khi ghi.
        """
        candidate = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='BUY', trade_date=date(2026, 1, 5),
            quantity=100, price=Decimal('70000'), reversal_of_id=999_999_999,
        )
        with self.assertRaises(ValidationError) as ctx:
            candidate.full_clean()
        self.assertIn('reversal_of', ctx.exception.message_dict)

    def test_negative_quantity_rejected(self):
        """R6 — qua `full_clean()`. `MinValueValidator` KHÔNG được DB enforce;
        nếu gọi thẳng `create()` thì dữ liệu âm lọt vào bảng."""
        candidate = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='BUY', trade_date=date(2026, 1, 5),
            quantity=-100, price=Decimal('70000'),
        )
        with self.assertRaises(ValidationError) as ctx:
            candidate.full_clean()
        self.assertIn('quantity', ctx.exception.message_dict)

    def test_negative_fee_rejected(self):
        candidate = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='BUY', trade_date=date(2026, 1, 5),
            quantity=100, price=Decimal('70000'), fee=Decimal('-1'),
        )
        with self.assertRaises(ValidationError) as ctx:
            candidate.full_clean()
        self.assertIn('fee', ctx.exception.message_dict)

    def test_all_entry_types_exist(self):
        self.assertEqual(
            {c.value for c in LedgerEntry.EntryType},
            {'BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'BONUS', 'FEE', 'TAX', 'ADJUSTMENT'},
        )

    def test_index_exists_on_portfolio_symbol_date(self):
        names = {tuple(idx.fields) for idx in LedgerEntry._meta.indexes}
        self.assertIn(('portfolio', 'symbol', 'trade_date'), names)

    def test_backfilled_by_marker_roundtrip(self):
        """LED-05 R3: row backfill phải mang marker để reverse chỉ revert nó."""
        entry = _entry(self.tenant, self.portfolio, backfilled_by=MIGRATION_MARKER)
        entry.refresh_from_db()
        self.assertEqual(entry.backfilled_by, MIGRATION_MARKER)


class LedgerEntryCleanTests(TestCase):
    def setUp(self):
        self.tenant = _tenant()
        self.portfolio = _portfolio(self.tenant)

    def test_buy_zero_quantity_rejected(self):
        candidate = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='BUY', trade_date=date(2026, 1, 5),
            quantity=0, price=Decimal('70000'),
        )
        with self.assertRaises(Exception) as ctx:
            candidate.full_clean()
        self.assertIn('quantity', ctx.exception.message_dict)

    def test_buy_zero_price_rejected(self):
        candidate = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='BUY', trade_date=date(2026, 1, 5),
            quantity=100, price=Decimal('0'),
        )
        with self.assertRaises(Exception) as ctx:
            candidate.full_clean()
        self.assertIn('price', ctx.exception.message_dict)

    def test_dividend_uses_share_count_not_zero(self):
        """Ghi rõ quyết định lệch với tài liệu slice.

        Slice doc LED-04 R2 nói DIVIDEND có `quantity = 0`. Điều đó mâu thuẫn
        với D-06 và với `holdings.py` (gross = price × quantity), và sẽ khiến
        mọi dòng cổ tức từ broker bị từ chối. Ở đây DIVIDEND cần quantity > 0.
        """
        good = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='DIVIDEND', trade_date=date(2026, 6, 1),
            quantity=1000, price=Decimal('1200'),
        )
        good.full_clean()

        bad = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='DIVIDEND', trade_date=date(2026, 6, 1),
            quantity=0, price=Decimal('1200'),
        )
        with self.assertRaises(Exception) as ctx:
            bad.full_clean()
        self.assertIn('quantity', ctx.exception.message_dict)

    def test_dividend_may_have_zero_price(self):
        """Cổ tức 0 là dữ liệu vô nghĩa nhưng không phải dữ liệu sai về hình thức
        — luật giá > 0 chỉ áp cho MUA/BÁN."""
        candidate = LedgerEntry(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VNM',
            entry_type='DIVIDEND', trade_date=date(2026, 6, 1),
            quantity=1000, price=Decimal('0'),
        )
        candidate.full_clean()


class CashFlowTests(TestCase):
    def setUp(self):
        self.tenant = _tenant()
        self.portfolio = _portfolio(self.tenant)
        self.entry = _entry(self.tenant, self.portfolio)

    def test_signed_amount(self):
        out = CashFlow.objects.create(
            entry=self.entry, tenant=self.tenant,
            flow_type='SELL', amount=Decimal('-7000000'))
        self.assertLess(out.amount, Decimal('0'))

    def test_flow_cascade_with_entry(self):
        CashFlow.objects.create(
            entry=self.entry, tenant=self.tenant,
            flow_type='BUY', amount=Decimal('-70000000'))
        self.assertEqual(self.entry.cash_flows.count(), 1)

    def test_defaults_to_vnd(self):
        flow = CashFlow.objects.create(
            entry=self.entry, tenant=self.tenant,
            flow_type='FEE', amount=Decimal('-1000'))
        self.assertEqual(flow.currency, 'VND')


# ══════════════════════════════════════════════════════════════════
# LED-02
# ══════════════════════════════════════════════════════════════════


class PositionSnapshotTests(TestCase):
    def setUp(self):
        self.tenant = _tenant()
        self.portfolio = _portfolio(self.tenant)

    def _snap(self, **overrides):
        payload = {
            'tenant': self.tenant, 'portfolio': self.portfolio, 'symbol': 'VNM',
            'as_of_date': date(2026, 3, 31), 'quantity': Decimal('1000'),
            'avg_cost': Decimal('70000'), 'current_price': Decimal('75000'),
            'market_value': Decimal('75000000'),
            'unrealized_pnl': Decimal('5000000'),
            'calculation_version': 'holdings-wa-v1',
        }
        payload.update(overrides)
        return PositionSnapshot.objects.create(**payload)

    def test_duplicate_portfolio_symbol_date_raises(self):
        """AC1."""
        self._snap()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._snap()

    def test_same_date_different_symbol_ok(self):
        self._snap()
        self._snap(symbol='HNG')

    def test_calculation_version_is_required(self):
        snap = self._snap()
        self.assertTrue(snap.calculation_version)

    def test_price_may_be_null_never_zero(self):
        snap = self._snap(current_price=None, market_value=None, unrealized_pnl=None)
        snap.refresh_from_db()
        self.assertIsNone(snap.current_price)


# ══════════════════════════════════════════════════════════════════
# LED-03 (phần model; phần engine trong test_valuation_nav.py)
# ══════════════════════════════════════════════════════════════════


class ValuationSnapshotTests(TestCase):
    def setUp(self):
        self.tenant = _tenant()
        self.portfolio = _portfolio(self.tenant)

    def _snap(self, **overrides):
        payload = {
            'tenant': self.tenant, 'portfolio': self.portfolio,
            'as_of_date': date(2026, 3, 31),
            'stock_value': Decimal('75000000'), 'cash': Decimal('5000000'),
            'debt': Decimal('0'), 'nav': Decimal('80000000'),
            'calculation_version': 'nav-wa-v1',
        }
        payload.update(overrides)
        return ValuationSnapshot.objects.create(**payload)

    def test_duplicate_portfolio_date_raises(self):
        self._snap()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._snap()

    def test_nav_may_be_null_with_reason(self):
        snap = self._snap(nav=None, nav_reason='no_opening_balance')
        snap.refresh_from_db()
        self.assertIsNone(snap.nav)
        self.assertEqual(snap.nav_reason, 'no_opening_balance')

    def test_opening_balance_starts_null(self):
        self.assertIsNone(Portfolio.objects.get(pk=self.portfolio.pk).opening_balance)


# ══════════════════════════════════════════════════════════════════
# LED-06
# ══════════════════════════════════════════════════════════════════


class IdempotencyRecordTests(TestCase):
    def setUp(self):
        self.tenant = _tenant()
        self.user = self.tenant.owner_user

    def _rec(self, key, scope='place-order', hash_='h1'):
        return IdempotencyRecord.objects.create(
            tenant=self.tenant, actor=self.user, scope=scope, key=key,
            request_hash=hash_,
            expires_at=timezone.now() + timedelta(days=7),
        )

    def test_duplicate_tenant_actor_scope_key_raises(self):
        """UNIQUE ở tầng DB — đây là thứ cache KHÔNG làm được."""
        self._rec('k1')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._rec('k1')

    def test_other_scope_is_independent(self):
        self._rec('k1', scope='place-order')
        self._rec('k1', scope='cancel-order')

    def test_other_actor_is_independent(self):
        other = User.objects.create_user(username='w2-actor-2', password='x')
        self._rec('k1')
        IdempotencyRecord.objects.create(
            tenant=self.tenant, actor=other, scope='place-order', key='k1',
            request_hash='h1', expires_at=timezone.now() + timedelta(days=7),
        )

    def test_expires_at_is_indexed(self):
        """`db_index=True` tạo index ngầm — nó KHÔNG nằm trong `_meta.indexes`
        (danh sách đó chỉ chứa index khai báo tay qua `Meta.indexes`)."""
        field = IdempotencyRecord._meta.get_field('expires_at')
        self.assertTrue(field.db_index)


# ══════════════════════════════════════════════════════════════════
# LED-05 — bảo toàn dữ liệu cũ
# ══════════════════════════════════════════════════════════════════


class ExpandPhaseIsNonDestructiveTests(TestCase):
    """Migration 0021 là **expand**: bảng mới + cột nullable.

    Nếu test này đỏ, nghĩa là đã ai đó đặt NOT NULL hoặc drop bảng cũ — đúng thứ
    D-24 cấm ở phase này.
    """

    def test_transaction_table_still_writable(self):
        tenant = _tenant('w2-expand')
        portfolio = _portfolio(tenant, 'Danh mục expand')
        tx = Transaction.objects.create(
            portfolio=portfolio, tenant=tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=Decimal('70000'), quantity=1000,
        )
        tx.full_clean()
        self.assertEqual(Transaction.objects.count(), 1)
        # Trước P0-2 assertion này là `== 0`, khẳng định lưu `Transaction`
        # không sinh bản ghi ledger. P0-2 (`signals.py`
        # `sync_transaction_to_ledger_on_save`) đã đồng bộ `Transaction` →
        # `LedgerEntry` + `CashFlow`, nên `== 0` thành sai lệch.
        #
        # Ý đồ của test là D-24: phase expand **không phá** bảng cũ. Giữ đúng
        # ý đồ: bảng `Transaction` còn ghi được, và ledger sinh đúng 1 entry
        # cho 1 transaction — nhiều hơn 1 cũng là sai (double-write).
        self.assertEqual(LedgerEntry.objects.count(), 1)
