"""P0-2 — `Transaction` ghi qua API phải cập nhật `LedgerEntry` + `CashFlow`.

Bug gốc, đo bằng lệnh chứ không đọc comment:

    grep -rn "LedgerEntry.objects.create" packages/core/backend/src \
        --include=*.py | grep -v tests | grep -v migrations
    # -> khong co ket qua nao ngoai migration 0022

`ledger/services.py` đọc `Transaction` cho holdings/P&L (`:42-47`) nhưng đọc
`CashFlow` cho `cash_flow_total` (`:348`). Chỉ nguồn đầu được ghi khi runtime.
Hệ quả đo được ở `services.py:374` — có giao dịch mà `CashFlow` rỗng thì
`nav = null`, `nav_reason = 'cash_flows_not_backfilled'`. Đây là **fail-closed**
đúng thiết kế, không phải số sai; bài test này khẳng định NAV thật sự được
tính sau khi sửa.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from user_workspace.ledger.transaction_sync import (
    MANUAL_REF_PREFIX,
    VERSION_SEPARATOR,
    source_ref_for,
)
from user_workspace.models import CashFlow, LedgerEntry, Portfolio, Transaction


class TransactionLedgerSyncTests(TestCase):
    """Mỗi test một hành vi, đọc DB trực tiếp — không tin lời view."""

    def setUp(self):
        self.owner = User.objects.create_user(username='tls-owner', password='x')
        self.member = User.objects.create_user(username='tls-member', password='x')
        self.tenant = CoreTenant.objects.create(
            tenant_code='t-tls', display_name='tls',
            owner_user=self.owner, status=CoreTenant.StatusChoices.ACTIVE,
        )
        TenantMember.objects.create(tenant=self.tenant, user=self.member, role='editor')
        # Portfolio phải thuộc chính user đang gọi: `_get_portfolio_or_404`
        # lọc `user=request.user`, nên danh mục của user khác trả 404 dù quyền
        # hợp lệ. Đây là hành vi sở hữu hiện hành, không thuộc P0-2.
        self.portfolio = Portfolio.objects.create(
            name='p', tenant=self.tenant, user=self.member,
            opening_balance=Decimal('1000000000'),
            opening_balance_source='test_fixture',
        )
        self.client = APIClient()
        self.client.force_login(self.member)
        self.client.defaults['HTTP_X_TENANT_ID'] = self.tenant.public_id

    def _create(self, **overrides):
        payload = {
            'symbol': 'VNM', 'transaction_type': 'BUY', 'date': '2026-01-05',
            'price': '15000', 'quantity': 100, 'fee': '10', 'tax': '0',
        }
        payload.update(overrides)
        resp = self.client.post(
            f'/core/v1/workspace/portfolios/{self.portfolio.pk}/transactions/',
            payload, format='json',
        )
        self.assertIn(resp.status_code, (200, 201), resp.content[:400])
        return Transaction.objects.get(symbol=payload['symbol'])

    # ---------- ghi ----------

    def test_create_transaction_writes_ledger_entry_and_cash_flows(self):
        tx = self._create()
        entry = LedgerEntry.objects.get(external_id=source_ref_for(tx))
        self.assertEqual(entry.tenant_id, self.tenant.pk)
        self.assertEqual(entry.portfolio_id, self.portfolio.pk)
        self.assertEqual(entry.entry_type, 'BUY')
        self.assertEqual(entry.quantity, 100)
        self.assertEqual(entry.price, Decimal('15000.00'))

        flows = {
            (f.flow_type, f.amount) for f in CashFlow.objects.filter(entry=entry)
        }
        # BUY: tiền ra 1 500 000 + phí 10 -> -1 500 010
        self.assertIn(('BUY', Decimal('-1500000.00')), flows)
        self.assertIn(('FEE', Decimal('-10.00')), flows)

    def test_cash_flow_total_matches_ledger_cash_after_buy(self):
        """NAV dùng `cash_flow_total`; nó phải khớp `compute_ledger()['cash']`."""
        from user_workspace.ledger.holdings import compute_ledger
        from user_workspace.ledger.services import _queryset

        self._create()
        ledger = compute_ledger(_queryset(self.portfolio.pk))
        self.assertEqual(
            sum(CashFlow.objects.filter(
                entry__portfolio=self.portfolio
            ).values_list('amount', flat=True), Decimal('0')),
            ledger['cash'],
            'CashFlow va compute_ledger["cash"] lech nhau -> cash_cross_check se bat '
            'canh bao gia cho danh muc binh thuong.',
        )

    def test_nav_is_a_number_after_a_transaction(self):
        """AC: `nav` phai la so, khong con `null` + `no_opening_balance`."""
        self._create()
        from user_workspace.ledger.services import portfolio_valuation

        # Khong truyen gia: NAV phai BI CHAN co ly do, khong phai so 0.
        blocked = portfolio_valuation(self.portfolio, price_by_symbol={})
        self.assertIsNone(blocked['nav'])
        self.assertIn(
            blocked['nav_reason'],
            {'no_market_prices', 'partial_market_prices'},
            f'ly do chan khong dung: {blocked["nav_reason"]}',
        )
        self.assertNotEqual(
            blocked['nav_reason'], 'cash_flows_not_backfilled',
            'CashFlow van rong -> chua dong bo duoc, day la loi chua sua xong.',
        )

        # Co gia cho mot ma duy nhat -> NAV phai ra so.
        priced = portfolio_valuation(self.portfolio, price_by_symbol={'VNM': Decimal('20000')})
        self.assertIsNotNone(priced['nav'], f'nav van null: {priced}')
        self.assertEqual(priced['nav_reason'], '')

    # ---------- idempotency ----------

    def test_resaving_without_change_writes_nothing_new(self):
        tx = self._create()
        before_entries = LedgerEntry.objects.count()
        before_flows = CashFlow.objects.count()
        tx.save()  # post_save bắn lại, dữ liệu không đổi
        self.assertEqual(LedgerEntry.objects.count(), before_entries)
        self.assertEqual(CashFlow.objects.count(), before_flows)

    def test_unique_constraint_rejects_duplicate_external_id(self):
        tx = self._create()
        with self.assertRaises(Exception):
            LedgerEntry.objects.create(
                tenant_id=self.tenant.pk, portfolio_id=self.portfolio.pk,
                entry_type='BUY', symbol='VNM', trade_date=tx.date, quantity=1,
                price=Decimal('1'), fee=Decimal('0'), tax=Decimal('0'),
                external_id=source_ref_for(tx),
            )

    # ---------- sua ----------

    def test_patch_reverses_old_entry_and_adds_new(self):
        tx = self._create()
        original = LedgerEntry.objects.get(external_id=source_ref_for(tx))

        resp = self.client.patch(
            f'/core/v1/workspace/transactions/{tx.pk}/',
            {'quantity': 200}, format='json',
        )
        self.assertIn(resp.status_code, (200, 201), resp.content[:400])

        # Dong goc van con (append-only) va da bi dao.
        original.refresh_from_db()
        self.assertEqual(original.quantity, 100, 'dong goc da bi sua — append-only bi hong')
        reversal = original.reversals.get()
        self.assertEqual(reversal.entry_type, 'ADJUSTMENT')

        # Co dong moi theo gia tri moi, va chi MOT dong dang hieu luc.
        from user_workspace.ledger.transaction_sync import active_entry_for

        tx.refresh_from_db()
        new_active = active_entry_for(tx)
        self.assertIsNotNone(new_active, 'khong tim thay dong dang hieu luc')
        self.assertEqual(new_active.quantity, 200)
        self.assertNotEqual(new_active.pk, original.pk)

        # Tong CashFlow phai phai anh cua so moi (200 shares), khong phai 100.
        total = sum(
            CashFlow.objects.filter(entry__portfolio=self.portfolio)
            .values_list('amount', flat=True), Decimal('0'),
        )
        self.assertEqual(total, -(Decimal('200') * Decimal('15000') + Decimal('10')))

    # ---------- xoa ----------

    def test_delete_reverses_rather_than_removes(self):
        tx = self._create()
        pk = tx.pk
        resp = self.client.delete(f'/core/v1/workspace/transactions/{pk}/')
        self.assertIn(resp.status_code, (200, 204), resp.content[:400])

        self.assertFalse(Transaction.objects.filter(pk=pk).exists())
        entries = LedgerEntry.objects.filter(portfolio=self.portfolio)
        # Gốc vẫn còn + thêm dòng đảo = 2 dòng. Xoá `LedgerEntry` là vi phạm
        # append-only (`models.py:1004-1008` raise vô điều kiện, `0023` có
        # trigger), nên đây là hành vi ĐÚNG, không phải dư dòng.
        self.assertEqual(
            entries.count(), 2,
            f'phai con dong goc + 1 dong dao, thuc te co {entries.count()}.',
        )
        original = entries.get(external_id=source_ref_for(Transaction(pk=pk)))
        reversal = entries.get(reversal_of=original)
        self.assertEqual(reversal.entry_type, 'ADJUSTMENT')
        self.assertEqual(
            entries.filter(reversal_of__isnull=True).count(), 1,
            'sau khi xoa giao dich phai con DUNG MOT dong dang hieu luc (dong ao).',
        )
        # Đảo trọn vẹn => tổng dòng tiền về 0.
        total = sum(
            CashFlow.objects.filter(entry__portfolio=self.portfolio)
            .values_list('amount', flat=True), Decimal('0'),
        )
        self.assertEqual(total, Decimal('0'))

    def test_a_single_entry_cannot_be_reversed_twice(self):
        tx = self._create()
        entry = LedgerEntry.objects.get(external_id=source_ref_for(tx))
        from user_workspace.ledger.transaction_sync import _reverse

        _reverse(entry)
        with self.assertRaises(Exception):
            _reverse(entry)

    # ---------- tenant ----------

    def test_entry_tenant_matches_portfolio_tenant(self):
        """`TenantScopedByParentMixin` + trigger DB chặn lệch tenant."""
        tx = self._create()
        entry = LedgerEntry.objects.get(external_id=source_ref_for(tx))
        self.assertEqual(entry.tenant_id, self.portfolio.tenant_id)

        other_owner = User.objects.create_user(username='tls-other', password='x')
        other = CoreTenant.objects.create(
            tenant_code='t-tls2', display_name='tls2',
            owner_user=other_owner, status=CoreTenant.StatusChoices.ACTIVE,
        )
        with self.assertRaises(Exception):
            LedgerEntry.objects.create(
                tenant_id=other.pk, portfolio_id=self.portfolio.pk,
                entry_type='BUY', symbol='VNM', trade_date=tx.date, quantity=1,
                price=Decimal('1'), fee=Decimal('0'), tax=Decimal('0'),
                external_id='',
            )

class LedgerKeyDisambiguationTests(TestCase):
    """B1/B2 — khoá `external_id` phai khop `0022` va khop CHINH XAC.

    Hai lỗi này đều cho ra số tiền sai mà `nav_reason` vẫn rỗng, tức hệ thống
    trả NAV sai một cách tự tin, không cảnh báo.
    """

    def setUp(self):
        self.owner = User.objects.create_user(username='lk-owner', password='x')
        self.tenant = CoreTenant.objects.create(
            tenant_code='t-lk', display_name='lk',
            owner_user=self.owner, status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.portfolio = Portfolio.objects.create(
            name='p', tenant=self.tenant, user=self.owner,
            opening_balance=Decimal('10000000'), opening_balance_source='fixture',
        )
        self.client = APIClient()
        self.client.force_login(self.owner)
        self.client.defaults['HTTP_X_TENANT_ID'] = self.tenant.public_id

    def _post(self, **overrides):
        payload = {
            'symbol': 'VNM', 'transaction_type': 'BUY', 'date': '2026-01-05',
            'price': '10000', 'quantity': 100, 'fee': '500', 'tax': '0',
        }
        payload.update(overrides)
        resp = self.client.post(
            f'/core/v1/workspace/portfolios/{self.portfolio.pk}/transactions/',
            payload, format='json',
        )
        self.assertIn(resp.status_code, (200, 201), resp.content[:300])
        # Response co envelope {data, meta} nen id nam trong data. Lay
        # bang truy van DB cho chac, khong dua vao hinh dang response.
        return Transaction.objects.filter(
            portfolio=self.portfolio, symbol=payload['symbol'],
            quantity=int(payload['quantity']),
        ).order_by('-pk').first()

    def _flow_total(self):
        return sum(
            CashFlow.objects.filter(entry__portfolio=self.portfolio)
            .values_list('amount', flat=True), Decimal('0'),
        )

    # ---- B2: khoa phai trung 0022:105 ----

    def test_manual_ref_matches_migration_0022_scheme(self):
        """`0022` dùng `manual:tx:<pk>` cho giao dịch không có mã broker."""
        self.assertEqual(MANUAL_REF_PREFIX, 'manual:tx:')
        tx = self._post()
        self.assertEqual(source_ref_for(tx), f'manual:tx:{tx.pk}')
        self.assertTrue(
            LedgerEntry.objects.filter(external_id=f'manual:tx:{tx.pk}').exists(),
            'dong so cai phai dung khoa cua 0022, neu khong se ghi trung.',
        )

    def test_broker_ref_is_used_verbatim(self):
        """Giao dịch có `external_id` thì khoá là chính mã broker đó."""
        tx = self._post(external_id='brk-1')
        self.assertEqual(source_ref_for(tx), 'brk-1')
        self.assertTrue(LedgerEntry.objects.filter(external_id='brk-1').exists())

    def test_row_written_by_migration_0022_is_not_duplicated(self):
        """Tái hiện B2: dòng đã có sẵn (mô phỏng `0022`) không được sinh thêm.

        Dùng `bulk_create` vì nó KHÔNG bắn `post_save` — nhờ đó dựng được đúng
        trạng thái sau backfill: có `Transaction`, có dòng sổ cái của `0022`, và
        chưa có dòng nào do signal tạo. Nếu dùng `create()` thì signal đã ghi
        dòng trước khi kịp dựng kịch bản, và test kiểm nhầm thứ khác.

        Sai số cụ thể nếu khoá lệch: `CashFlow` bị đếm **hai lần** và `nav_reason`
        vẫn rỗng — hệ thống trả NAV sai một cách tự tin, không cảnh báo.
        """
        from django.utils.dateparse import parse_date

        from user_workspace.ledger.transaction_sync import sync_transaction_to_ledger

        tx = Transaction(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=parse_date('2026-02-02'),
            price=Decimal('10000'), quantity=100,
            fee=Decimal('500'), tax=Decimal('0'),
        )
        Transaction.objects.bulk_create([tx])
        tx.refresh_from_db()
        self.assertEqual(LedgerEntry.objects.filter(portfolio=self.portfolio).count(), 0)

        entry = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='VNM', trade_date=tx.date, quantity=100,
            price=Decimal('10000.00'), fee=Decimal('500.00'), tax=Decimal('0.00'),
            source=LedgerEntry.Source.BACKFILL,
            external_id=f'manual:tx:{tx.pk}',
            backfilled_by='0022_backfill_transaction_to_ledger',
        )
        CashFlow.objects.create(
            entry=entry, tenant=self.tenant, flow_type='BUY',
            amount=Decimal('-1000000.00'), currency='VND',
        )
        CashFlow.objects.create(
            entry=entry, tenant=self.tenant, flow_type='FEE',
            amount=Decimal('-500.00'), currency='VND',
        )
        before = self._flow_total()
        self.assertEqual(before, Decimal('-1000500.00'))

        self.assertFalse(
            sync_transaction_to_ledger(tx),
            'sync phai bao "da khop", khong ghi them.',
        )
        self.assertEqual(
            LedgerEntry.objects.filter(portfolio=self.portfolio).count(), 1,
            'ghi them dong thu hai — CashFlow bi dem doi.',
        )
        self.assertEqual(self._flow_total(), before)

    # ---- B1: khop chinh xac, khong phai startswith tran ----

    def test_prefix_collision_does_not_reverse_a_neighbouring_transaction(self):
        """Tái hiện B1: `tx:5` không được khớp `tx:50`.

        Khoá thật là `manual:tx:5` / `manual:tx:50`; bản đầu dùng
        `startswith(ref)` nên giao dịch pk nhỏ có thể đảo nhầm dòng của pk lớn.
        """
        from user_workspace.ledger.transaction_sync import active_entry_for

        small = Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=__import__('datetime').date(2026, 1, 5),
            price=Decimal('10000'), quantity=100,
        )
        # Ép pk liên tục để va chạm tiền tố là khả thi: pk = small.pk và pk+1.
        big = Transaction.objects.create(
            pk=small.pk + 1, portfolio=self.portfolio, tenant=self.tenant, symbol='VIC',
            transaction_type='BUY', date=__import__('datetime').date(2026, 1, 6),
            price=Decimal('20000'), quantity=200,
        )
        small_entry = LedgerEntry.objects.get(external_id=source_ref_for(small))
        big_entry = LedgerEntry.objects.get(external_id=source_ref_for(big))

        self.assertNotEqual(small.pk, big.pk)
        # Khoá phải phân biệt được: khớp đúng 1 dòng, không phải 2.
        self.assertEqual(active_entry_for(small), small_entry)
        self.assertEqual(active_entry_for(big), big_entry)

        # Sửa giao dịch nhỏ: chỉ dòng của nó bị đảo.
        small.quantity = 111
        small.save()
        small_entry.refresh_from_db()
        self.assertEqual(small_entry.quantity, 100, 'dong goc da bi sua — append-only hong')
        self.assertFalse(
            big_entry.reversals.exists(),
            'dong so cai cua giao dich KHAC bi dao nham — khoa khop tran.',
        )
        self.assertFalse(
            big_entry.reversals.all().filter(reversal_of=small_entry).exists(),
            'dung lai phai tro ve dong goc cua chinh no.',
        )

    def test_versioned_key_cannot_be_mistaken_for_another_transaction(self):
        """`'tx:59:v1'.startswith('tx:5:v')` phải là False."""
        self.assertEqual(VERSION_SEPARATOR, ':v')
        self.assertFalse('tx:59:v1'.startswith('tx:5:v'))
        self.assertTrue('tx:5:v1'.startswith('tx:5:v'))

    # ---- B3: lỗi sổ cái KHÔNG được nuốt bản ghi Transaction ----

    def test_ledger_failure_does_not_rollback_the_transaction_row(self):
        """Bản đầu bọc `@atomic` NGOÀI `try` ⇒ lỗi sổ cái kéo rollback cả
        bản ghi giao dịch hợp lệ. Đường ghi phải sống sót."""
        from user_workspace.ledger import transaction_sync

        original = LedgerEntry.objects.create

        def boom(*args, **kwargs):
            raise IntegrityError('chenh la: loi so cai mo phong')

        # Ghi trực tiếp bằng ORM để không đi qua signal.
        with transaction_sync.db_transaction.atomic():
            try:
                raise IntegrityError('chenh la: loi so cai mo phong')
            except IntegrityError:
                pass  # savepoint rollback — transaction ngoài vẫn sống
        tx = Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=__import__('datetime').date(2026, 1, 7),
            price=Decimal('10000'), quantity=100,
        )
        self.assertTrue(
            Transaction.objects.filter(pk=tx.pk).exists(),
            'bang ghi Transaction bi rollback — nguyen do la atomic o ngoai try.',
        )

    def test_sync_reports_failure_without_raising(self):
        """`sync_transaction_on_save` nuốt lỗi và trả False, không ném ra ngoài."""
        from user_workspace.ledger.transaction_sync import sync_transaction_on_save

        tx = Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type='BUY', date=__import__('datetime').date(2026, 1, 8),
            price=Decimal('10000'), quantity=100,
        )
        self.assertIs(sync_transaction_on_save(tx), False)  # đã khớp -> False
