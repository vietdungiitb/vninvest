"""Wave 1 B1.1 tests: BrokerSyncService interface + registry 3 lane.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_sync_service --noinput

Fail-before: truoc B1.1, import BrokerSyncService nem ImportError.
Khong I/O that: adapter la fake inject, khong vnbroker, khong mang.
"""
from django.contrib.auth.models import User
from django.test import TestCase

from user_workspace.broker.adapters import (
    BrokerAccount,
    BrokerAdapter,
    BrokerAdapterError,
    BrokerBalance,
    BrokerOrder,
    BrokerPosition,
    get_broker_adapter,
)
from user_workspace.models import set_user_broker_secrets
from user_workspace.tests.tenant_test_helpers import grant_tenant


class FakeAdapter(BrokerAdapter):
    """Adapter gia: tra DTO cung, ghi lai calls. Khong I/O."""

    provider_id = 'fake'

    def __init__(self, **credentials):
        super().__init__(**credentials)
        self.calls = []

    def is_available(self) -> bool:
        return True

    def list_accounts(self):
        self.calls.append('list_accounts')
        return [BrokerAccount(external_id='A1', display_name='Fake A1')]

    def get_balance(self, account_no: str):
        self.calls.append(('get_balance', account_no))
        return BrokerBalance(cash=100.0, net_equity=150.0)

    def get_positions(self, account_no: str):
        self.calls.append(('get_positions', account_no))
        return [BrokerPosition(symbol='VCB', quantity=10.0, avg_price=90.0)]

    def get_orders(self, account_no: str):
        self.calls.append(('get_orders', account_no))
        return [BrokerOrder(order_id='O1', symbol='VCB', side='BUY')]


def _make_user(name):
    return User.objects.create_user(username=name, password='x')


class BrokerSyncServiceTests(TestCase):
    def setUp(self):
        self.user = _make_user('syncsvc-b11')
        self.tenant = grant_tenant(self.user)

    def _service(self, **kw):
        from user_workspace.broker.sync_service import BrokerSyncService
        return BrokerSyncService(FakeAdapter(), **kw)

    def test_list_accounts_delegates(self):
        svc = self._service()
        accounts = svc.list_accounts()
        self.assertEqual([a.external_id for a in accounts], ['A1'])
        self.assertIn('list_accounts', svc.adapter.calls)

    def test_balance_positions_orders_delegate(self):
        svc = self._service()
        balance = svc.get_balance('A1')
        self.assertEqual(balance.cash, 100.0)
        positions = svc.get_positions('A1')
        self.assertEqual(positions[0].symbol, 'VCB')
        orders = svc.get_orders('A1')
        self.assertEqual(orders[0].order_id, 'O1')

    def test_error_code_propagates(self):
        from user_workspace.broker.sync_service import BrokerSyncService

        class BoomAdapter(FakeAdapter):
            def get_balance(self, account_no: str):
                raise BrokerAdapterError('otp thieu', code='broker_otp_required')

        svc = BrokerSyncService(BoomAdapter())
        with self.assertRaises(BrokerAdapterError) as ctx:
            svc.get_balance('A1')
        self.assertEqual(ctx.exception.code, 'broker_otp_required')

    def test_for_config_resolves_credentials(self):
        from user_workspace.broker.sync_service import BrokerSyncService
        set_user_broker_secrets(
            self.user, 'dnse',
            {'client_id': 'CID', 'client_secret': 'CSEC'},
            tenant=self.tenant)
        svc = BrokerSyncService.for_user(
            self.user, 'dnse', tenant=self.tenant)
        self.assertEqual(svc.provider_id, 'dnse')
        self.assertEqual(svc.adapter.credentials.get('client_id'), 'CID')

    def test_for_user_missing_config_raises_code(self):
        from user_workspace.broker.sync_service import (
            BrokerConfigMissingError,
            BrokerSyncService,
        )
        with self.assertRaises(BrokerConfigMissingError) as ctx:
            BrokerSyncService.for_user(self.user, 'ssi', tenant=self.tenant)
        self.assertEqual(ctx.exception.code, 'broker_config_missing')

    def test_for_user_unknown_provider_raises(self):
        from user_workspace.broker.sync_service import BrokerSyncService
        with self.assertRaises(BrokerAdapterError):
            BrokerSyncService.for_user(self.user, 'xyz', tenant=self.tenant)

    def test_registry_returns_three_lanes(self):
        adapters = {
            provider: get_broker_adapter(provider)
            for provider in ('dnse', 'ssi', 'tcbs')
        }
        self.assertEqual(adapters['dnse'].provider_id, 'dnse')
        self.assertEqual(adapters['ssi'].provider_id, 'ssi')
        self.assertEqual(adapters['tcbs'].provider_id, 'tcbs')
