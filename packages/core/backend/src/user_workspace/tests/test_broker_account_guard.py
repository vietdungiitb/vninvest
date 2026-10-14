"""Wave 0 B0.3 tests: broker_account FK + trigger tenant guard.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_account_guard --noinput

Fail-before: truoc B0.3, `Transaction(broker_account=...)` nem TypeError;
tao dong cross-tenant KHONG bi chan (luu im lang).
"""
from datetime import date

from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase

from user_workspace.models import (
    AccountSnapshot,
    LedgerEntry,
    PositionSnapshot,
    Portfolio,
    SubAccount,
    Transaction,
)
from user_workspace.tests.tenant_test_helpers import grant_tenant


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class BrokerAccountGuardTests(TestCase):
    def setUp(self):
        self.user = _make_user('bacct-b03')
        self.tenant = grant_tenant(self.user)
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM test')
        self.sub = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK test', account_number='0001',
            provider='dnse', external_id='E1')
        other_user = _make_user('bacct-other')
        self.other_tenant = grant_tenant(
            other_user, tenant_code='b03-other', display_name='Other')
        self.other_sub = SubAccount.objects.create(
            user=other_user, tenant=self.other_tenant, broker='SSI',
            display_name='TK other', account_number='0002',
            provider='ssi', external_id='E2')

    def test_broker_account_nullable_all_four(self):
        tx = Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VCB',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=100000, quantity=10)
        le = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='VCB', trade_date=date(2026, 1, 5),
            quantity=10, price=100000)
        ps = PositionSnapshot.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VCB',
            as_of_date=date(2026, 1, 5), calculation_version='test')
        snap = AccountSnapshot.objects.create(
            sub_account=self.sub, date=date(2026, 1, 5))
        for row in (tx, le, ps, snap):
            self.assertIsNone(row.broker_account_id)

    def test_broker_account_link_all_four(self):
        tx = Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VCB',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=100000, quantity=10, broker_account=self.sub)
        le = LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='VCB', trade_date=date(2026, 1, 5),
            quantity=10, price=100000, broker_account=self.sub)
        ps = PositionSnapshot.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VCB',
            as_of_date=date(2026, 1, 5), calculation_version='test',
            broker_account=self.sub)
        snap = AccountSnapshot.objects.create(
            sub_account=self.sub, date=date(2026, 1, 6),
            broker_account=self.sub)
        for row in (tx, le, ps, snap):
            self.assertEqual(row.broker_account_id, self.sub.id)

    def _assert_cross_tenant_blocked(self, make_row):
        with self.assertRaises(IntegrityError):
            make_row()

    def test_trigger_rejects_cross_tenant_transaction(self):
        self._assert_cross_tenant_blocked(lambda: Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VCB',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=100000, quantity=10, broker_account=self.other_sub))

    def test_trigger_rejects_cross_tenant_ledger(self):
        self._assert_cross_tenant_blocked(lambda: LedgerEntry.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, entry_type='BUY',
            symbol='VCB', trade_date=date(2026, 1, 5),
            quantity=10, price=100000, broker_account=self.other_sub))

    def test_trigger_rejects_cross_tenant_position(self):
        self._assert_cross_tenant_blocked(
            lambda: PositionSnapshot.objects.create(
                tenant=self.tenant, portfolio=self.portfolio, symbol='VCB',
                as_of_date=date(2026, 1, 5), calculation_version='test',
                broker_account=self.other_sub))

    def test_trigger_fires_on_queryset_update(self):
        # Trigger DB song sot ca `update()` (khong qua save) — diem hon clean().
        tx = Transaction.objects.create(
            portfolio=self.portfolio, tenant=self.tenant, symbol='VCB',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=100000, quantity=10, broker_account=self.sub)
        with self.assertRaises(IntegrityError):
            Transaction.objects.filter(pk=tx.pk).update(
                broker_account=self.other_sub)

    def test_account_snapshot_has_no_tenant_guard(self):
        # Bat doi xung co chu y (ghi vao PLAN): AccountSnapshot khong co tenant
        # nen khong trigger; tenant suy qua sub_account.
        snap = AccountSnapshot.objects.create(
            sub_account=self.other_sub, date=date(2026, 1, 6),
            broker_account=self.other_sub)
        self.assertEqual(snap.broker_account_id, self.other_sub.id)
