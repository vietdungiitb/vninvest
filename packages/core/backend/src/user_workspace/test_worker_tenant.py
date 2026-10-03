"""P0-DATA-01 / P0-DATA-02 — worker DNSE + `Transaction` financial invariants.

P0-DATA-01 (bảng trong đề bài):
- `tasks.py:78` chọn "first portfolio" không rõ tenant; `tasks.py:80-84` tạo
  `Portfolio` không truyền tenant.
- `tasks.py:103-119` `SubAccount.objects.update_or_create(...)` không truyền
  tenant ⇒ **lỗ hổng thật duy nhất**: không signal nào cover `SubAccount`
  (`signals.py:68-72` chỉ có Portfolio/Watchlist/TrackedSymbol/PriceAlert/ScreenerRule).
  `SubAccount.tenant` là NOT NULL ⇒ `IntegrityError` tại nhánh CREATE.
- `Transaction` được signal `signals.py:84-87` cứu (tenant = portfolio.tenant).

P0-DATA-02: `Transaction` không có `validators=` cho price/quantity/fee/tax
(`models.py:89-92`); `MinValueValidator` đã import ở `:12` nhưng chỉ dùng 1 lần
(`:213` `PriceAlert.threshold`).

Chạy: python manage.py test user_workspace.test_worker_tenant
"""
from decimal import Decimal
from unittest import mock

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from identity_access.models import CoreTenant, TenantMember, UserProfile
from user_workspace.models import DNSECredential, Portfolio, SubAccount, Transaction
from user_workspace.tasks import sync_dnse_accounts_task

DNSE_ACCOUNTS = [
    {'account_number': '1234567', 'account_type': '1', 'account_name': 'TK DNSE'},
    {'account_number': '7654321', 'account_type': '6', 'account_name': 'TK MARGIN'},
]


def _bootstrap_ok(*_args, **_kwargs):
    return {'session': mock.Mock(name='dnse-session')}


class _WorkerFixtureMixin:
    def _make_tenant(self, code, owner=None):
        owner = owner or User.objects.create_user(username=f'w-{code}', password='x')
        return CoreTenant.objects.create(
            owner_user=owner, tenant_code=code, display_name=code, plan='starter')

    def _make_user(self, name, tenant=None, *, multi=()):
        user = User.objects.create_user(username=name, password='x')
        if tenant is not None:
            TenantMember.objects.create(user=user, tenant=tenant, role='viewer')
        for extra in multi:
            TenantMember.objects.create(user=user, tenant=extra, role='viewer')
        return user

    def _make_dnse_credential(self, user):
        return DNSECredential.objects.create(user=user, is_active=True)


class SubAccountSignalTenantTests(_WorkerFixtureMixin, TestCase):
    """AC-5 — `SubAccount` tạo không truyền tenant qua signal ⇒ KHÔNG IntegrityError."""

    def test_signal_assigns_tenant_for_single_tenant_user(self):
        tenant = self._make_tenant('sig-t1')
        user = self._make_user('sig-single', tenant)
        sub = SubAccount.objects.create(
            user=user, broker='DNSE', display_name='SA-1')
        sub.refresh_from_db()
        self.assertEqual(sub.tenant_id, tenant.pk)

    def test_signal_uses_core_profile_tenant(self):
        tenant = self._make_tenant('sig-t2')
        user = self._make_user('sig-profile')
        UserProfile.objects.create(user=user, tenant=tenant)
        sub = SubAccount.objects.create(
            user=user, broker='DNSE', display_name='SA-2')
        sub.refresh_from_db()
        self.assertEqual(sub.tenant_id, tenant.pk)

    def test_signal_prefers_portfolio_tenant(self):
        tenant_a = self._make_tenant('sig-t3a')
        tenant_b = self._make_tenant('sig-t3b')
        user = self._make_user('sig-portfolio', tenant_a, multi=(tenant_b,))
        portfolio = Portfolio.objects.create(user=user, tenant=tenant_b, name='P-B')
        sub = SubAccount.objects.create(
            user=user, portfolio=portfolio, broker='DNSE', display_name='SA-3')
        sub.refresh_from_db()
        self.assertEqual(sub.tenant_id, tenant_b.pk)

    def test_explicit_tenant_never_overwritten_by_signal(self):
        tenant_a = self._make_tenant('sig-t4a')
        tenant_b = self._make_tenant('sig-t4b')
        user = self._make_user('sig-explicit', tenant_a)
        sub = SubAccount.objects.create(
            user=user, tenant=tenant_b, broker='DNSE', display_name='SA-4')
        sub.refresh_from_db()
        self.assertEqual(sub.tenant_id, tenant_b.pk)

    def test_ambiguous_multi_tenant_user_fails_closed(self):
        """Đa tenant + không portfolio + không tenant ⇒ KHÔNG đoán ⇒ IntegrityError.

        Đây là fail-closed có chủ đích: `tenant` NOT NULL ở tầng DB, nên "đoán bừa"
        còn tệ hơn là từ chối. Worker path không bao giờ đi tới đây (xem
        `WorkerTenantResolutionTests`) vì task chặn trước.
        """
        tenant_a = self._make_tenant('sig-t5a')
        tenant_b = self._make_tenant('sig-t5b')
        user = self._make_user('sig-ambiguous', tenant_a, multi=(tenant_b,))
        with self.assertRaises(IntegrityError):
            SubAccount.objects.create(user=user, broker='DNSE', display_name='SA-5')

    def test_user_without_tenant_is_autoprovisioned(self):
        """User chưa thuộc tenant nào ⇒ auto-provision tenant riêng (hành vi cũ).

        Cần giữ: `user_workspace/tests.py:331-348` dựa vào hành vi này và file đó
        nằm NGOÀI phạm vi slice này. Rủi ro "ghi dữ liệu trong `save()`" đã ghi
        backlog, xem `_autoprovision_tenant_for` trong `models.py`.
        """
        user = self._make_user('sig-orphan')
        sub = SubAccount.objects.create(user=user, broker='DNSE', display_name='SA-6')
        sub.refresh_from_db()
        self.assertIsNotNone(sub.tenant_id)
        self.assertEqual(CoreTenant.objects.filter(owner_user=user).count(), 1)
        self.assertEqual(sub.tenant_id, CoreTenant.objects.get(owner_user=user).pk)

    def test_multi_tenant_user_never_gets_arbitrary_tenant(self):
        """Regression: code cũ dùng `TenantMember.objects.filter(user=…).first()`.

        Bản cũ gán tenant tùy ý cho SubAccount của user đa tenant — dữ liệu tài
        chính rơi sai tenant scope. Nay phải từ chối.
        """
        tenant_a = self._make_tenant('sig-t6a')
        tenant_b = self._make_tenant('sig-t6b')
        user = self._make_user('sig-two-tenants', tenant_a, multi=(tenant_b,))
        with self.assertRaises(IntegrityError):
            SubAccount.objects.create(user=user, broker='DNSE', display_name='SA-7')


class WorkerTenantResolutionTests(_WorkerFixtureMixin, TestCase):
    """AC-6 — user ≥ 2 tenant, task không truyền `tenant_id` ⇒ TỪ CHỐI."""

    def setUp(self):
        self.tenant_a = self._make_tenant('wk-t1a')
        self.tenant_b = self._make_tenant('wk-t1b')
        self._make_dnse_credential_owner_a()

    def _make_dnse_credential_owner_a(self):
        self.multi = self._make_user('wk-multi', self.tenant_a, multi=(self.tenant_b,))
        self._make_dnse_credential(self.multi)
        self.solo = self._make_user('wk-solo', self.tenant_a)
        self._make_dnse_credential(self.solo)

    def _run(self, user, tenant_id=None):
        with mock.patch('user_workspace.tasks.bootstrap_dnse_session', _bootstrap_ok), \
             mock.patch('user_workspace.tasks.fetch_sub_accounts', return_value=DNSE_ACCOUNTS):
            if tenant_id is None:
                return sync_dnse_accounts_task(user.pk)
            return sync_dnse_accounts_task(user.pk, tenant_id=tenant_id)

    def test_multi_tenant_without_tenant_id_is_refused(self):
        result = self._run(self.multi)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'tenant_required')
        self.assertEqual(SubAccount.objects.count(), 0)
        self.assertEqual(Portfolio.objects.count(), 0)

    def test_multi_tenant_with_tenant_id_creates_in_that_tenant(self):
        result = self._run(self.multi, self.tenant_b.pk)
        self.assertTrue(result['ok'], result)
        self.assertEqual(result['synced_count'], len(DNSE_ACCOUNTS))
        subs = SubAccount.objects.all()
        self.assertEqual(subs.count(), len(DNSE_ACCOUNTS))
        for sub in subs:
            self.assertEqual(sub.tenant_id, self.tenant_b.pk)
        portfolio = Portfolio.objects.get()
        self.assertEqual(portfolio.tenant_id, self.tenant_b.pk)

    def test_tenant_id_not_owned_by_user_is_refused(self):
        outsider = self._make_tenant('wk-outsider')
        result = self._run(self.multi, outsider.pk)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'tenant_not_allowed')
        self.assertEqual(SubAccount.objects.count(), 0)

    def test_single_tenant_user_resolves_without_tenant_id(self):
        result = self._run(self.solo)
        self.assertTrue(result['ok'], result)
        sub = SubAccount.objects.get(external_id='1234567')
        self.assertEqual(sub.tenant_id, self.tenant_a.pk)

    def test_first_portfolio_fallback_is_gone(self):
        """`tasks.py:78` cũ dùng `Portfolio.objects.filter(user_id=…).first()`
        ⇒ user đa tenant có portfolio ở tenant A sẽ bị ghi record vào tenant A
        dù caller đang đồng bộ tenant B. Nay phải tạo portfolio riêng cho B."""
        Portfolio.objects.create(user=self.multi, tenant=self.tenant_a, name='P-A')
        result = self._run(self.multi, self.tenant_b.pk)
        self.assertTrue(result['ok'], result)
        portfolio_b = Portfolio.objects.get(tenant=self.tenant_b)
        self.assertNotEqual(portfolio_b.name, 'P-A')
        for sub in SubAccount.objects.filter(tenant=self.tenant_b):
            self.assertEqual(sub.portfolio_id, portfolio_b.pk)

    def test_update_or_create_never_steals_other_tenant_subaccount(self):
        self._run(self.multi, self.tenant_a.pk)
        before = SubAccount.objects.get(tenant=self.tenant_a, external_id='1234567')
        self._run(self.multi, self.tenant_b.pk)
        before.refresh_from_db()
        self.assertEqual(before.tenant_id, self.tenant_a.pk)
        self.assertEqual(
            SubAccount.objects.filter(external_id='1234567').count(), 2)

    def test_user_without_any_tenant_is_refused(self):
        orphan = self._make_user('wk-orphan')
        self._make_dnse_credential(orphan)
        result = self._run(orphan)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'tenant_not_found')
        self.assertEqual(SubAccount.objects.count(), 0)


class TransactionValidatorMatrixTests(_WorkerFixtureMixin, TestCase):
    """AC-7 — ma trận validator price / quantity / fee / tax theo loại lệnh."""

    def setUp(self):
        self.tenant = self._make_tenant('tx-t1')
        self.user = self._make_user('tx-user', self.tenant)
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='P')

    def _tx(self, **kwargs):
        base = dict(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VNM',
            transaction_type=Transaction.TransactionType.BUY,
            date='2026-02-02', price=Decimal('10500'), quantity=1000,
        )
        base.update(kwargs)
        return Transaction(**base)

    def _assert_rejected(self, **kwargs):
        with self.assertRaises(ValidationError):
            self._tx(**kwargs).full_clean()

    def test_buy_accepts_valid_values(self):
        self._tx().full_clean()

    def test_sell_accepts_valid_values(self):
        self._tx(transaction_type=Transaction.TransactionType.SELL).full_clean()

    def test_quantity_negative_rejected(self):
        self._assert_rejected(quantity=-1)

    def test_quantity_zero_rejected_for_buy(self):
        self._assert_rejected(quantity=0)

    def test_quantity_zero_rejected_for_sell(self):
        self._assert_rejected(
            transaction_type=Transaction.TransactionType.SELL, quantity=0)

    def test_price_negative_rejected(self):
        self._assert_rejected(price=Decimal('-1'))

    def test_price_zero_rejected_for_buy(self):
        self._assert_rejected(price=Decimal('0'))

    def test_price_zero_rejected_for_sell(self):
        self._assert_rejected(
            transaction_type=Transaction.TransactionType.SELL, price=Decimal('0'))

    def test_fee_negative_rejected(self):
        self._assert_rejected(fee=Decimal('-0.01'))

    def test_tax_negative_rejected(self):
        self._assert_rejected(tax=Decimal('-1000'))

    def test_fee_and_tax_zero_accepted(self):
        self._tx(fee=Decimal('0'), tax=Decimal('0')).full_clean()

    def test_dividend_with_valid_quantity_accepted(self):
        """Cổ tức: cash flow, KHÔNG giảm cost basis (plan D-06) — không ép giá > 0."""
        self._tx(transaction_type=Transaction.TransactionType.DIVIDEND,
                 price=Decimal('0'), quantity=1000).full_clean()

    def test_dividend_negative_fee_still_rejected(self):
        self._assert_rejected(
            transaction_type=Transaction.TransactionType.DIVIDEND,
            price=Decimal('0'), fee=Decimal('-1'))

    def test_serializer_enforces_same_matrix(self):
        """DRF `ModelSerializer` tự kế thừa `validators` của model field ⇒
        API chặn luôn mà không cần sửa `serializers.py` (ngoài phạm vi)."""
        from user_workspace.serializers import TransactionSerializer
        payload = {
            'symbol': 'VNM', 'transaction_type': 'BUY', 'date': '2026-02-02',
            'price': '-1', 'quantity': '1000',
        }
        serializer = TransactionSerializer(data=payload)
        self.assertFalse(serializer.is_valid())
        self.assertIn('price', serializer.errors)

        payload_ok = dict(payload, price='10500', quantity='-5')
        serializer_ok = TransactionSerializer(data=payload_ok)
        self.assertFalse(serializer_ok.is_valid())
        self.assertIn('quantity', serializer_ok.errors)
