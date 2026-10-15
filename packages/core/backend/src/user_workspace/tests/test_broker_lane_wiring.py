"""Wave 1 B1.2 tests: noi positions 3 lane (vnbroker 3.7.2, khong mang).

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_lane_wiring --noinput

Fail-before: `DnseBrokerAdapter.get_positions` raise BrokerAdapterError.
Stub client: doi tuong gia, khong import vnbroker, khong mang.
Quy tac mock: chi kieu du lieu that (khong MagicMock vao response).
"""
import pandas as pd
from django.test import SimpleTestCase

from user_workspace.broker.adapters import (
    BrokerAdapterError,
    DnseBrokerAdapter,
    SsiBrokerAdapter,
    TcbsBrokerAdapter,
)


class StubClient:
    """Client gia: tra du lieu cung, ghi lai kwargs."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = {}

    def _record(self, name, **kwargs):
        self.calls[name] = kwargs
        return self.payload

    def get_positions(self, *args, **kwargs):
        return self._record('get_positions', **kwargs)

    def get_holdings(self, *args, **kwargs):
        return self._record('get_holdings', **kwargs)


def _ssi_adapter(payload):
    adapter = SsiBrokerAdapter(api_key='K', api_secret='S')
    adapter._client = StubClient(payload)
    adapter._session_fingerprint = adapter.session_fingerprint()
    adapter._verified = True
    return adapter


def _tcbs_adapter(payload, credentials=None):
    creds = {'api_key': 'K'}
    creds.update(credentials or {})
    adapter = TcbsBrokerAdapter(**creds)
    adapter._client = StubClient(payload)
    adapter._session_fingerprint = adapter.session_fingerprint()
    return adapter


class DnsePositionsWiringTests(SimpleTestCase):
    def test_get_positions_calls_stock_market_type(self):
        from user_workspace import vnbroker_dnse_compat as compat
        stub = StubClient([
            {'symbol': 'VCB', 'quantity': 10, 'avg_price': 90.0,
             'market_price': 100.0},
        ])
        rows = compat.fetch_positions(stub, '0001')
        self.assertEqual(stub.calls['get_positions'].get('market_type'), 'STOCK')
        self.assertEqual(rows[0]['symbol'], 'VCB')
        self.assertEqual(rows[0]['quantity'], 10.0)

    def test_fetch_positions_normalizes_variants(self):
        from user_workspace import vnbroker_dnse_compat as compat
        stub = StubClient([
            {'ticker': 'hpg', 'volume': 5, 'costPrice': 20.0,
             'currentPrice': 25.0},
            {'no_symbol': True},
        ])
        rows = compat.fetch_positions(stub, '0001')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['symbol'], 'HPG')
        self.assertEqual(rows[0]['avg_price'], 20.0)
        self.assertEqual(rows[0]['market_price'], 25.0)

    def test_fetch_positions_empty(self):
        from user_workspace import vnbroker_dnse_compat as compat
        self.assertEqual(compat.fetch_positions(StubClient([]), '0001'), [])
        self.assertEqual(compat.fetch_positions(StubClient(None), '0001'), [])

    def test_adapter_get_positions_no_longer_raises(self):
        adapter = DnseBrokerAdapter(client_id='C', client_secret='S')
        adapter._client = StubClient([
            {'symbol': 'VCB', 'quantity': 10, 'avgPrice': 90.0,
             'marketPrice': 100.0},
        ])
        from user_workspace import vnbroker_dnse_compat as compat
        adapter._fetch = {
            'balance': lambda c, a: {},
            'orders': lambda c, a, s, e: [],
            'accounts': lambda c: [],
            'positions': compat.fetch_positions,
        }
        positions = adapter.get_positions('0001')
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].symbol, 'VCB')
        self.assertEqual(positions[0].market_price, 100.0)


class SsiPositionsWiringTests(SimpleTestCase):
    def test_positions_from_list(self):
        adapter = _ssi_adapter([
            {'symbol': 'SSI', 'quantity': 7, 'avgPrice': 30.0,
             'marketPrice': 35.0},
        ])
        positions = adapter.get_positions('A1')
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].symbol, 'SSI')
        self.assertEqual(positions[0].avg_price, 30.0)

    def test_positions_from_dataframe(self):
        adapter = _ssi_adapter(pd.DataFrame([
            {'ticker': 'MBB', 'totalVol': 3, 'costPrice': 20.0,
             'currentPrice': 22.0},
        ]))
        positions = adapter.get_positions('A1')
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].symbol, 'MBB')
        self.assertEqual(positions[0].quantity, 3.0)


class TcbsPositionsWiringTests(SimpleTestCase):
    def test_positions_unverified_read_no_otp(self):
        # Read path TCBS khong doi OTP (chi trade can) — fail-closed dung.
        adapter = _tcbs_adapter([
            {'symbol': 'TCB', 'quantity': 4, 'avgPrice': 40.0,
             'marketPrice': 44.0},
        ])
        positions = adapter.get_positions('A1')
        self.assertEqual(len(positions), 1)
        self.assertEqual(positions[0].symbol, 'TCB')

    def test_adapter_error_shape(self):
        with self.assertRaises(BrokerAdapterError):
            from user_workspace.broker.adapters import get_broker_adapter
            get_broker_adapter('unknown-lane')
