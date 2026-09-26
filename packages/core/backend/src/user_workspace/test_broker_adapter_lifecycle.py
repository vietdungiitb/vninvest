"""P1-AUTH-01: vòng đời session cho BrokerAdapter — authenticate/refresh/close + fail-closed.

Bằng chứng trước slice này (audit `AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D2):
- `BrokerAdapter` (`broker/adapters.py:94-115`) chỉ có 5 method read, 0 lifecycle.
- `SsiBrokerAdapter._new_client()` (`:210-219`) chỉ construct, KHÔNG gọi `authenticate`;
  read `:228-279` tạo client MỚI mỗi lệnh (`:229,239,252,267`).
- `TcbsBrokerAdapter` (`:287-296`, `:305-359`) lặp lại y hệt, và im lặng coi như connected
  trong khi `broker/tcbs.py:87` cố ý trả `unverified` vì cần OTP.

`vnbroker` là package private editable và KHÔNG cài được ở đây ⇒ mọi client trong test
đều là fake; capability detection dùng `hasattr` nên test không phụ thuộc body thư viện.
Chạy: python manage.py test user_workspace.test_broker_adapter_lifecycle
"""
import sys
import types

from django.test import SimpleTestCase

from user_workspace.broker.adapters import (
    BrokerAdapterError,
    BrokerUnavailableError,
    get_broker_adapter,
)


def _stub_module(path, **members):
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


class FakeClient:
    """Client giả đủ capability: authenticate/refresh/close + read methods."""

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.authenticate_calls = 0
        self.refresh_calls = 0
        self.close_calls = 0
        self.read_calls = []

    def authenticate(self, *args, **kwargs):
        self.authenticate_calls += 1
        return True

    def refresh(self, *args, **kwargs):
        self.refresh_calls += 1
        return True

    def close(self, *args, **kwargs):
        self.close_calls += 1

    def list_accounts(self):
        self.read_calls.append('list_accounts')
        return [{'account': '1234561'}]

    def get_balance(self, account_no):
        self.read_calls.append('get_balance')
        return {'cashBalance': '100', 'stockValue': '200'}

    def get_holdings(self, account_no):
        self.read_calls.append('get_holdings')
        return [{'symbol': 'ssi', 'quantity': 10, 'marketPrice': 25}]

    def get_orders(self, account_no):
        self.read_calls.append('get_orders')
        return [{'orderId': 'o1', 'symbol': 'HPG', 'buySell': 'BUY'}]


class NoAuthClient:
    """Client KHÔNG có `authenticate` (capability thiếu) — read KHÔNG được gọi."""

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.read_calls = []

    def list_accounts(self):
        self.read_calls.append('list_accounts')
        return [{'account': '1'}]

    def get_balance(self, account_no):
        self.read_calls.append('get_balance')
        return {}


class FakeTcbsClient(FakeClient):
    """TCBS: `authenticate(otp)` BẮT BUỘC otp; có `is_token_valid` để capability detect."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.is_token_valid = False

    def get_account_list(self):
        self.read_calls.append('get_account_list')
        return [{'accountNo': '105C1', 'accountName': 'A1'}]


class SsiAuthRequiredTests(SimpleTestCase):
    """AC-8 + AC-9: read path phải authenticate đúng 1 lần, cache client, không auth→read."""

    def _adapter(self, client_cls):
        created = []

        def factory(**kwargs):
            client = client_cls(**kwargs)
            created.append(client)
            return client

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=factory)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S', client_id='1234561')
        return adapter, created

    def test_client_without_authenticate_raises_and_never_reads(self):
        adapter, created = self._adapter(NoAuthClient)
        with self.assertRaises(BrokerAdapterError) as ctx:
            adapter.list_accounts()
        self.assertEqual(ctx.exception.code, 'broker_client_auth_unsupported')
        self.assertEqual(created[0].read_calls, [])

    def test_authenticate_called_once_across_many_reads(self):
        adapter, created = self._adapter(FakeClient)
        adapter.list_accounts()
        adapter.get_balance('1234561')
        adapter.get_positions('1234561')
        adapter.get_orders('1234561')
        self.assertEqual(len(created), 1, 'client phải được cache, không tạo mới mỗi read')
        self.assertEqual(created[0].authenticate_calls, 1)
        self.assertEqual(sorted(created[0].read_calls),
                         ['get_balance', 'get_holdings', 'get_orders', 'list_accounts'])

    def test_read_values_still_normalized(self):
        adapter, created = self._adapter(FakeClient)
        self.assertEqual(adapter.list_accounts()[0].external_id, '1234561')
        self.assertAlmostEqual(adapter.get_balance('1234561').cash, 100.0)
        self.assertEqual(adapter.get_positions('1234561')[0].symbol, 'SSI')
        self.assertEqual(adapter.get_orders('1234561')[0].order_id, 'o1')

    def test_explicit_authenticate_is_idempotent(self):
        adapter, created = self._adapter(FakeClient)
        adapter.authenticate()
        adapter.authenticate()
        adapter.list_accounts()
        self.assertEqual(created[0].authenticate_calls, 1)

    def test_client_cache_keyed_by_credential_fingerprint(self):
        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=FakeClient)
        self.addCleanup(_unstub, saved)
        a1 = get_broker_adapter('ssi', api_key='K1', api_secret='S')
        a1.list_accounts()
        a1.close()
        a2 = get_broker_adapter('ssi', api_key='K2', api_secret='S')
        a2.list_accounts()
        # fingerprint khác ⇒ không dùng lại client của credential khác
        self.assertNotEqual(a1.session_fingerprint(), a2.session_fingerprint())
        self.assertEqual(a1.client_factory_calls(), 1)
        self.assertEqual(a2.client_factory_calls(), 1)

    def test_unavailable_lane_still_raises_unavailable(self):
        saved = _stub_module('vnbroker.broker.ssi.client')
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        with self.assertRaises(BrokerUnavailableError):
            adapter.list_accounts()


class SsiCloseLifecycleTests(SimpleTestCase):
    """AC-11: close() giải phóng session; lỗi close KHÔNG làm hỏng read đã thành công."""

    def test_close_releases_cached_client(self):
        clients = []

        class Counting(FakeClient):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
                clients.append(self)

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=Counting)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        adapter.list_accounts()
        adapter.close()
        self.assertEqual(clients[0].close_calls, 1)
        self.assertFalse(adapter.has_open_session())
        adapter.list_accounts()
        self.assertEqual(len(clients), 2, 'sau close phải tạo session mới')

    def test_close_is_idempotent(self):
        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=FakeClient)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        adapter.list_accounts()
        adapter.close()
        adapter.close()  # không raise

    def test_close_without_session_is_noop(self):
        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=FakeClient)
        self.addCleanup(_unstub, saved)
        get_broker_adapter('ssi', api_key='K', api_secret='S').close()

    def test_close_error_does_not_break_previous_read_result(self):
        class BadClose(FakeClient):
            def close(self, *args, **kwargs):
                raise RuntimeError('socket already closed')

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=BadClose)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        accounts = adapter.list_accounts()
        self.assertEqual(accounts[0].external_id, '1234561')
        adapter.close()  # lỗi bị nuốt + log, không propagate
        self.assertFalse(adapter.has_open_session())

    def test_context_manager_closes_session(self):
        clients = []

        class Counting(FakeClient):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
                clients.append(self)

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=Counting)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        with adapter as ctx:
            ctx.list_accounts()
        self.assertEqual(clients[0].close_calls, 1)
        self.assertFalse(adapter.has_open_session())

    def test_refresh_reauthenticates_open_session(self):
        clients = []

        class Counting(FakeClient):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
                clients.append(self)

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=Counting)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        adapter.list_accounts()
        adapter.refresh()
        self.assertEqual(clients[0].refresh_calls, 1)
        adapter.list_accounts()
        self.assertEqual(len(clients), 1)
        self.assertEqual(clients[0].authenticate_calls, 1)

    def test_refresh_opens_session_when_none(self):
        clients = []

        class Counting(FakeClient):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
                clients.append(self)

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=Counting)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        adapter.refresh()
        self.assertTrue(adapter.has_open_session())
        self.assertEqual(clients[0].authenticate_calls, 1)

    def test_refresh_without_capability_fails_closed(self):
        class NoRefresh(NoAuthClient):
            pass

        saved = _stub_module('vnbroker.broker.ssi.client', SSIBrokerClient=NoRefresh)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('ssi', api_key='K', api_secret='S')
        with self.assertRaises(BrokerAdapterError) as ctx:
            adapter.refresh()
        self.assertEqual(ctx.exception.code, 'broker_client_refresh_unsupported')


class TcbsUnverifiedTests(SimpleTestCase):
    """AC-10: TCBS chưa xác minh OTP ⇒ `unverified`, KHÔNG BAO GIỜ `connected`."""

    def _adapter(self, credentials=None, client_cls=FakeTcbsClient):
        clients = []

        def factory(**kwargs):
            client = client_cls(**kwargs)
            clients.append(client)
            return client

        saved = _stub_module('vnbroker.broker.tcbs.client', TCBSBrokerClient=factory)
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('tcbs', **(credentials or {'api_key': 'TK'}))
        return adapter, clients

    def test_status_unverified_before_otp(self):
        adapter, clients = self._adapter()
        status = adapter.connection_status()
        self.assertEqual(status['state'], 'unverified')
        self.assertFalse(status['connected'])
        self.assertTrue(status['unverified'])
        self.assertEqual(status['code'], 'otp_required')

    def test_reads_never_mark_connected(self):
        adapter, clients = self._adapter()
        adapter.list_accounts()
        adapter.get_balance('105C1')
        self.assertFalse(adapter.connection_status()['connected'])
        self.assertEqual(adapter.connection_status()['state'], 'unverified')

    def test_otp_authenticates_and_marks_connected(self):
        adapter, clients = self._adapter({'api_key': 'TK', 'otp': '123456'})
        status = adapter.authenticate()
        self.assertTrue(status['connected'])
        self.assertFalse(status['unverified'])
        self.assertEqual(clients[0].authenticate_calls, 1)

    def test_authenticate_without_otp_fails_closed(self):
        adapter, clients = self._adapter()
        with self.assertRaises(BrokerAdapterError) as ctx:
            adapter.authenticate()
        self.assertEqual(ctx.exception.code, 'broker_otp_required')
        self.assertFalse(adapter.connection_status()['connected'])
        self.assertEqual(clients, [], 'không được dựng client khi thiếu OTP')

    def test_token_valid_flag_upgrades_status(self):
        class TokenValid(FakeTcbsClient):
            def __init__(self, **kwargs):
                super().__init__(**kwargs)
                self.is_token_valid = True

        adapter, clients = self._adapter(client_cls=TokenValid)
        adapter.list_accounts()
        status = adapter.connection_status()
        self.assertTrue(status['connected'])
        self.assertEqual(status['state'], 'connected')

    def test_read_client_is_cached(self):
        adapter, clients = self._adapter()
        adapter.list_accounts()
        adapter.get_balance('105C1')
        adapter.get_positions('105C1')
        adapter.get_orders('105C1')
        self.assertEqual(len(clients), 1, 'TCBS cũng phải cache client (X.8)')
        adapter.close()
        self.assertEqual(clients[0].close_calls, 1)

    def test_connection_status_survives_missing_lane(self):
        saved = _stub_module('vnbroker.broker.tcbs.client')
        self.addCleanup(_unstub, saved)
        adapter = get_broker_adapter('tcbs', api_key='TK')
        status = adapter.connection_status()
        self.assertEqual(status['state'], 'error')
        self.assertFalse(status['connected'])
        self.assertEqual(status['code'], 'vnbroker_unavailable')

    def test_connection_status_never_leaks_secret(self):
        adapter, clients = self._adapter({'api_key': 'SUPER-SECRET-KEY'})
        blob = repr(adapter.connection_status())
        self.assertNotIn('SUPER-SECRET-KEY', blob)
