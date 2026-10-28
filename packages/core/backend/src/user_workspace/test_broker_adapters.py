"""Phase C tests: BrokerAdapter interface + normalize 3 lanes (stub, không network).

Chạy: python manage.py test user_workspace.test_broker_adapters
"""
import sys
import types
from unittest.mock import MagicMock

from django.test import SimpleTestCase

from user_workspace.broker.adapters import (
    BrokerAdapterError,
    BrokerUnavailableError,
    adapter_to_dict,
    dto_to_dict,
    get_broker_adapter,
)


def _stub_module(path, **members):
    # Vô điều kiện thay bằng stub (hermetic): stub có điều kiện `if name not in
    # sys.modules` rò rỉ khi lane thật đã được import trước đó trong cùng process.
    saved = {}
    parts = path.split('.')
    for i in range(1, len(parts) + 1):
        name = '.'.join(parts[:i])
        saved[name] = sys.modules.get(name)
        mod = types.ModuleType(name)
        mod.__path__ = []
        sys.modules[name] = mod
    leaf = sys.modules[path]
    for key, value in members.items():
        setattr(leaf, key, value)
    parent = '.'.join(parts[:-1])
    if parent in sys.modules:
        setattr(sys.modules[parent], parts[-1], leaf)
    return saved


def _unstub(saved):
    for name, mod in saved.items():
        if mod is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = mod


class BrokerAdapterFactoryTests(SimpleTestCase):
    def test_unknown_provider_raises(self):
        with self.assertRaises(BrokerAdapterError):
            get_broker_adapter('xyz')

    def test_factory_ids(self):
        self.assertEqual(get_broker_adapter('dnse').provider_id, 'dnse')
        self.assertEqual(get_broker_adapter('SSI').provider_id, 'ssi')
        self.assertEqual(get_broker_adapter('Tcbs').provider_id, 'tcbs')

    def test_dto_to_dict(self):
        from user_workspace.broker.adapters import BrokerAccount
        adapter = get_broker_adapter('dnse', client_id='a', client_secret='b')
        d = adapter_to_dict(adapter)
        self.assertEqual(d['provider'], 'dnse')
        self.assertIn('available', d)
        acc = dto_to_dict(BrokerAccount(external_id='A1', display_name='N1'))
        self.assertEqual(acc['external_id'], 'A1')


class SsiAdapterNormalizeTests(SimpleTestCase):
    def test_kwargs_and_normalize(self):
        client = MagicMock()
        client.get_balance.return_value = {'cashBalance': '100', 'stockValue': '200',
                                           'netAsset': '300', 'purchasingPower': '150'}
        client.get_holdings.return_value = [{'symbol': 'ssi', 'quantity': 10,
                                             'avgPrice': 20, 'marketPrice': 25}]
        client.get_orders.return_value = [{'orderId': 'o1', 'symbol': 'HPG',
                                           'buySell': 'BUY', 'price': 30,
                                           'quantity': 100, 'status': 'Filled'}]
        client.list_accounts.return_value = [{'account': '1234561'}]
        factory2 = MagicMock(return_value=client)
        saved2 = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=factory2)
        try:
            adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
            self.assertTrue(adapter.is_available())
            accs = adapter.list_accounts()
            self.assertEqual(accs[0].external_id, '1234561')
            bal = adapter.get_balance('1234561')
            self.assertAlmostEqual(bal.cash, 100.0)
            self.assertAlmostEqual(bal.buying_power, 150.0)
            pos = adapter.get_positions('1234561')
            self.assertEqual(pos[0].symbol, 'SSI')
            self.assertAlmostEqual(pos[0].market_price, 25.0)
            orders = adapter.get_orders('1234561')
            self.assertEqual(orders[0].order_id, 'o1')
            _, kwargs = factory2.call_args
            self.assertEqual(kwargs.get('api_key'), 'K')
        finally:
            _unstub(saved2)

    def test_unavailable_without_lane(self):
        # Giả lập lane thiếu bằng stub client KHÔNG có SSIBrokerClient
        # (pop sys.modules không đủ vì venv có vnbroker thật → re-import được)
        saved = _stub_module('vnbroker.broker.ssi.client')
        try:
            adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
            self.assertFalse(adapter.is_available())
            with self.assertRaises(BrokerUnavailableError):
                adapter.list_accounts()
        finally:
            _unstub(saved)


class TcbsAdapterNormalizeTests(SimpleTestCase):
    def test_normalize_and_kwargs(self):
        client = MagicMock()
        client.get_account_list.return_value = [{'accountNo': '105C1', 'accountName': 'A1'}]
        client.get_balance.return_value = [{'cash': 50, 'stockValue': 60, 'netEquity': 110}]
        client.get_holdings.return_value = [{'symbol': 'acb', 'quantity': 5,
                                             'avgPrice': 10, 'marketPrice': 12}]
        client.get_orders.return_value = [{'orderId': 't1', 'symbol': 'ACB'}]
        factory = MagicMock(return_value=client)
        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        try:
            adapter = get_broker_adapter('tcbs', api_key='TK')
            accs = adapter.list_accounts()
            self.assertEqual(accs[0].display_name, 'A1')
            bal = adapter.get_balance('105C1')
            self.assertAlmostEqual(bal.net_equity, 110.0)
            pos = adapter.get_positions('105C1')
            self.assertEqual(pos[0].symbol, 'ACB')
            orders = adapter.get_orders('105C1')
            self.assertEqual(orders[0].order_id, 't1')
            _, kwargs = factory.call_args
            self.assertEqual(kwargs.get('api_key'), 'TK')
        finally:
            _unstub(saved)


class DnseAdapterNormalizeTests(SimpleTestCase):
    def test_normalize_with_mocked_compat(self):
        import user_workspace.vnbroker_dnse_compat as compat
        orig = (compat.build_dnse_client, compat.fetch_sub_accounts,
                compat.fetch_account_balance, compat.fetch_order_history)
        compat.build_dnse_client = lambda **kw: MagicMock()
        compat.fetch_sub_accounts = lambda client: [
            {'account_number': 'A1', 'account_name': 'N1', 'account_type': '1'}]
        compat.fetch_account_balance = lambda client, acc: {
            'cash': 1, 'stock_value': 2, 'debt': 0, 'net_equity': 3}
        compat.fetch_order_history = lambda client, acc, f, t: [
            {'order_id': 'd1', 'symbol': 'HPG', 'type': 'BUY',
             'price': 10, 'quantity': 5, 'status': 'done', 'date': '2026-01-01'}]
        try:
            adapter = get_broker_adapter('dnse', client_id='A', client_secret='B')
            accs = adapter.list_accounts()
            self.assertEqual(accs[0].external_id, 'A1')
            bal = adapter.get_balance('A1')
            self.assertAlmostEqual(bal.net_equity, 3.0)
            orders = adapter.get_orders('A1')
            self.assertEqual(orders[0].order_id, 'd1')
            self.assertEqual(orders[0].side, 'BUY')
        finally:
            (compat.build_dnse_client, compat.fetch_sub_accounts,
             compat.fetch_account_balance, compat.fetch_order_history) = orig
