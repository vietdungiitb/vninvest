"""B3.3 contract tests: pin phía vninvest của contract broker (chống lỗi C1/C2).

- Stub-based (luôn chạy): stub module vnbroker trong sys.modules, gọi
  user_workspace.broker.{ssi,tcbs}.test_connection, assert QUY ƯỚC GỌI
  (keyword args, đúng tên method). Method name sai → AttributeError → test đỏ.
- Live-gated (VNBROKER_RUN_LIVE_CONTRACT=1): import vnbroker thật, assert method
  tồn tại trên TCBSBrokerClient/SSIBrokerClient (pin phía lib).

Chạy: python manage.py test user_workspace.test_vnbroker_broker_signatures
"""
import os
import sys
import types
import unittest
from unittest.mock import MagicMock

from django.test import SimpleTestCase


def _install_stub(package_path, members):
    """Cài stub module vào sys.modules, trả về dict module đã dùng để cleanup."""
    saved = {}
    parts = package_path.split('.')
    for i in range(1, len(parts) + 1):
        name = '.'.join(parts[:i])
        saved[name] = sys.modules.get(name, None)
        mod = types.ModuleType(name)
        mod.__path__ = []
        sys.modules[name] = mod
    leaf = sys.modules[package_path]
    for key, value in members.items():
        setattr(leaf, key, value)
    parent = '.'.join(parts[:-1])
    setattr(sys.modules[parent], parts[-1], leaf)
    return saved


def _restore_stub(saved):
    for name, mod in saved.items():
        if mod is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = mod


class BrokerCallingConventionTests(SimpleTestCase):
    """C2: vninvest PHẢI gọi SSI/TCBS bằng keyword args + đúng tên method."""

    def test_ssi_called_with_kwargs_and_authenticate(self):
        from unittest.mock import MagicMock
        from user_workspace.broker import ssi as ssi_schema

        client = MagicMock()
        client.get_account_list.return_value = [{'a': 1}]
        factory = MagicMock(return_value=client)
        saved = _install_stub('vnbroker.broker.ssi.client', {'SSIBrokerClient': factory})
        try:
            result = ssi_schema.test_connection({'api_key': 'K', 'api_secret': 'S'})
        finally:
            _restore_stub(saved)
        self.assertTrue(result['ok'])
        _, kwargs = factory.call_args
        # C2: api_key/api_secret PHẢI là keyword (positional sẽ gán nhầm client_id)
        self.assertEqual(kwargs.get('api_key'), 'K')
        self.assertEqual(kwargs.get('api_secret'), 'S')
        client.authenticate.assert_called_once_with()

    def test_ssi_wrong_method_name_fails(self):
        """Mô phỏng C1: stub thiếu method → AttributeError, không im lặng."""
        from unittest.mock import MagicMock
        from user_workspace.broker import ssi as ssi_schema

        client = MagicMock(spec=[])  # không có method nào
        factory = MagicMock(return_value=client)
        saved = _install_stub('vnbroker.broker.ssi.client', {'SSIBrokerClient': factory})
        try:
            result = ssi_schema.test_connection({'api_key': 'K', 'api_secret': 'S'})
        finally:
            _restore_stub(saved)
        self.assertFalse(result['ok'])

    def test_tcbs_unverified_never_claims_connected(self):
        from unittest.mock import MagicMock
        from user_workspace.broker import tcbs as tcbs_schema

        sentinel = MagicMock()
        saved = _install_stub('vnbroker.broker.tcbs.client', {'TCBSBrokerClient': sentinel})
        try:
            result = tcbs_schema.test_connection({'api_key': 'K'})
        finally:
            _restore_stub(saved)
        self.assertFalse(result['ok'])
        self.assertTrue(result.get('unverified'))
        sentinel.assert_not_called()  # chưa OTP thì không khởi tạo client

    def test_dnse_uses_get_accounts(self):
        from user_workspace.broker import dnse as dnse_schema

        client = MagicMock()
        client.get_accounts.return_value = [{'account_number': '1'}]
        # dnse.test_connection import build_dnse_client từ compat thật tại call time
        import user_workspace.vnbroker_dnse_compat as compat
        original = compat.build_dnse_client
        compat.build_dnse_client = lambda **kwargs: client
        try:
            result = dnse_schema.test_connection(
                {'client_id': 'A', 'client_secret': 'B'})
        finally:
            compat.build_dnse_client = original
        self.assertTrue(result['ok'])
        self.assertEqual(result['account_count'], 1)
        client.get_accounts.assert_called_once_with(raw=False)


@unittest.skipUnless(os.getenv('VNBROKER_RUN_LIVE_CONTRACT') == '1',
                     'live contract cần vnbroker thật (image v3.4.0+)')
class LiveBrokerContractTests(SimpleTestCase):
    """Pin phía lib: chạy trong image đã bump, skip ở local."""

    def test_tcbs_surface(self):
        try:
            from vnbroker.broker.tcbs.client import TCBSBrokerClient
        except Exception as exc:
            self.skipTest(f'vnbroker TCBS lane unavailable: {exc}')
        import inspect
        # C1: các method vninvest phụ thuộc PHẢI tồn tại
        for method in ('authenticate', 'get_account_list', 'get_balance'):
            self.assertTrue(callable(getattr(TCBSBrokerClient, method, None)), method)
        params = inspect.signature(TCBSBrokerClient.__init__).parameters
        for name in ('api_key', 'base_url', 'custody_code'):
            self.assertIn(name, params)

    def test_ssi_surface(self):
        try:
            from vnbroker.broker.ssi.client import SSIBrokerClient
        except Exception as exc:
            self.skipTest(f'vnbroker SSI lane unavailable: {exc}')
        import inspect
        params = list(inspect.signature(SSIBrokerClient.__init__).parameters)
        # C2: thứ tự (client_id, api_key, api_secret, ...) — gọi positional là sai
        self.assertEqual(params[1:4], ['client_id', 'api_key', 'api_secret'])
        self.assertTrue(callable(getattr(SSIBrokerClient, 'authenticate', None)))
        self.assertTrue(callable(getattr(SSIBrokerClient, 'get_account_list', None)))
