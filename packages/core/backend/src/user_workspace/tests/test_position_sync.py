"""Wave 1 B1.3 tests: position-first sync idempotent.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_position_sync --noinput

Fail-before: truoc B1.3, import sync_account_positions nem ImportError.
Khong I/O that: service dung stub adapter, khong vnbroker/khong mang.
"""
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase

from user_workspace.broker.adapters import (
    BrokerAccount,
    BrokerAdapter,
    BrokerBalance,
    BrokerPosition,
)
from user_workspace.broker.sync_service import BrokerSyncService
from user_workspace.models import (
    AccountSnapshot,
    Portfolio,
    PositionSnapshot,
    SubAccount,
)
from user_workspace.tests.tenant_test_helpers import grant_tenant


class StubAdapter(BrokerAdapter):
    provider_id = 'stub'

    def __init__(self, positions=None, balance=None, **kwargs):
        super().__init__(**kwargs)
        self._positions = positions or []
        self._balance = balance or BrokerBalance()

    def is_available(self) -> bool:
        return True

    def list_accounts(self):
        return [BrokerAccount(external_id='A1', display_name='Stub A1')]

    def get_balance(self, account_no: str):
        return self._balance

    def get_positions(self, account_no: str):
        return list(self._positions)

    def get_orders(self, account_no: str):
        return []


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class PositionSyncTests(TestCase):
    def setUp(self):
        self.user = _make_user('possync-b13')
        self.tenant = grant_tenant(self.user)
        self.portfolio = Portfolio.objects.create(
            user=self.user, tenant=self.tenant, name='DM test',
            kind='broker_backed')
        self.sub = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK test', account_number='0001',
            provider='dnse', external_id='E1')
        self.as_of = date(2026, 10, 15)

    def _service(self, positions=None, balance=None):
        return BrokerSyncService(
            StubAdapter(positions=positions, balance=balance))

    def test_sync_writes_position_and_balance(self):
        from user_workspace.broker.position_sync import sync_account_positions
        svc = self._service(
            positions=[BrokerPosition(
                symbol='VCB', quantity=10.0, avg_price=90.0, market_price=100.0)],
            balance=BrokerBalance(
                cash=1000.0, stock_value=1000.0, debt=0.0, net_equity=2000.0))
        stats = sync_account_positions(svc, self.sub, as_of_date=self.as_of)
        self.assertEqual(stats['positions_written'], 1)
        snap = PositionSnapshot.objects.get(
            portfolio=self.portfolio, symbol='VCB', as_of_date=self.as_of)
        self.assertEqual(snap.source, 'broker')
        self.assertEqual(snap.broker_account_id, self.sub.id)
        self.assertEqual(float(snap.quantity), 10.0)
        self.assertEqual(float(snap.market_value), 1000.0)
        bal = AccountSnapshot.objects.get(
            sub_account=self.sub, date=self.as_of)
        self.assertEqual(float(bal.net_equity), 2000.0)

    def test_sync_is_idempotent(self):
        from user_workspace.broker.position_sync import sync_account_positions
        first = [BrokerPosition(
            symbol='VCB', quantity=10.0, avg_price=90.0, market_price=100.0)]
        changed = [BrokerPosition(
            symbol='VCB', quantity=12.0, avg_price=90.0, market_price=110.0)]
        sync_account_positions(
            self._service(positions=first), self.sub, as_of_date=self.as_of)
        stats = sync_account_positions(
            self._service(positions=changed), self.sub, as_of_date=self.as_of)
        self.assertEqual(stats['positions_written'], 1)
        self.assertEqual(
            PositionSnapshot.objects.filter(
                portfolio=self.portfolio, symbol='VCB',
                as_of_date=self.as_of).count(), 1)
        snap = PositionSnapshot.objects.get(
            portfolio=self.portfolio, symbol='VCB', as_of_date=self.as_of)
        self.assertEqual(float(snap.quantity), 12.0)

    def test_collision_skipped_and_reported(self):
        # Cung (portfolio, symbol, ngay) nhung tieu khoan khac => skip + bao,
        # khong ghi de (quyet dinh PLAN: khong crash, khong sai so lieu).
        from user_workspace.broker.position_sync import sync_account_positions
        other = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=self.portfolio,
            broker='DNSE', display_name='TK 2', account_number='0002',
            provider='dnse', external_id='E2')
        PositionSnapshot.objects.create(
            tenant=self.tenant, portfolio=self.portfolio, symbol='VCB',
            as_of_date=self.as_of, quantity=5, avg_cost=80,
            calculation_version='test', source='broker',
            broker_account=other)
        svc = self._service(positions=[BrokerPosition(
            symbol='VCB', quantity=10.0, avg_price=90.0, market_price=100.0)])
        stats = sync_account_positions(svc, self.sub, as_of_date=self.as_of)
        self.assertEqual(stats['positions_written'], 0)
        self.assertEqual(len(stats['collisions']), 1)
        kept = PositionSnapshot.objects.get(
            portfolio=self.portfolio, symbol='VCB', as_of_date=self.as_of)
        self.assertEqual(kept.broker_account_id, other.id)
        self.assertEqual(float(kept.quantity), 5.0)

    def test_missing_portfolio_skipped(self):
        from user_workspace.broker.position_sync import sync_account_positions
        lone = SubAccount.objects.create(
            user=self.user, tenant=self.tenant, portfolio=None,
            broker='DNSE', display_name='TK roi', account_number='0009',
            provider='dnse', external_id='E9')
        svc = self._service(positions=[BrokerPosition(symbol='VCB')])
        stats = sync_account_positions(svc, lone, as_of_date=self.as_of)
        self.assertEqual(stats['positions_written'], 0)
        self.assertEqual(len(stats['skipped_no_portfolio']), 1)

    def test_zero_market_price_becomes_null(self):
        # Khong gia 0 gia (quy tac ledger: NULL khi chua biet, khong phai 0).
        from user_workspace.broker.position_sync import sync_account_positions
        svc = self._service(positions=[BrokerPosition(
            symbol='VCB', quantity=10.0, avg_price=90.0, market_price=0.0)])
        sync_account_positions(svc, self.sub, as_of_date=self.as_of)
        snap = PositionSnapshot.objects.get(
            portfolio=self.portfolio, symbol='VCB', as_of_date=self.as_of)
        self.assertIsNone(snap.current_price)
        self.assertIsNone(snap.market_value)
