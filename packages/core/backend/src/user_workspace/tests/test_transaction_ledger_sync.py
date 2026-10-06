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
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
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
        entry = LedgerEntry.objects.get(external_id=f'tx:{tx.pk}')
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
                external_id=f'tx:{tx.pk}',
            )

    # ---------- sua ----------

    def test_patch_reverses_old_entry_and_adds_new(self):
        tx = self._create()
        original = LedgerEntry.objects.get(external_id=f'tx:{tx.pk}')

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
        original = entries.get(external_id=f'tx:{pk}')
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
        entry = LedgerEntry.objects.get(external_id=f'tx:{tx.pk}')
        from user_workspace.ledger.transaction_sync import _reverse

        _reverse(entry)
        with self.assertRaises(Exception):
            _reverse(entry)

    # ---------- tenant ----------

    def test_entry_tenant_matches_portfolio_tenant(self):
        """`TenantScopedByParentMixin` + trigger DB chặn lệch tenant."""
        tx = self._create()
        entry = LedgerEntry.objects.get(external_id=f'tx:{tx.pk}')
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