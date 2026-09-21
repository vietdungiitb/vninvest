"""
Slice F corrective (live-measured) — snapshot bulk rewrite.

materialize_symbol_snapshot_from_vnbroker từng chạy 2 DailyPrice queries + 1
update_or_create MỖI symbol (~3100 queries + 1551 writes ≈ 7+ phút > interval 60s).
Rewrite: 2 batch queries + 1 bulk upsert. Test đảo ngược insert/update/skip.
"""
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from market_data.models import DailyPrice
from market_serving.models import SymbolSnapshot
from market_serving.vnbroker_materializer import materialize_symbol_snapshot_from_vnbroker


def _live(symbols, price='20.00'):
    return {
        s: {'close': price, 'volume': 1000, 'open': price, 'high': price, 'low': price}
        for s in symbols
    }


class SnapshotBulkTest(TestCase):
    def setUp(self):
        self.today = date.today()
        self.yesterday = self.today - timedelta(days=3)
        for sym in ('AAA', 'BBB', 'CCC'):
            DailyPrice.objects.create(
                symbol=sym, date=self.yesterday, open=Decimal('19.00'),
                high=Decimal('19.50'), low=Decimal('18.50'), close=Decimal('19.00'),
                volume=1000,
            )

    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshots_batch')
    def test_insert_then_skip_existing(self, batch_mock):
        # Giá 20.90/19.00 → change 1.90 exact, pct 10.0 exact (tránh Decimal precision
        # pre-existing khiến compare lệch: DB numeric(10,4) vs Decimal 38 chữ số).
        batch_mock.return_value = _live(['AAA', 'BBB', 'CCC'], price='20.90')
        r1 = materialize_symbol_snapshot_from_vnbroker(symbols=['AAA', 'BBB', 'CCC'])
        self.assertEqual(r1['status'], 'ok')
        self.assertEqual(r1['inserted'], 3)
        self.assertEqual(SymbolSnapshot.objects.filter(session_date=self.today).count(), 3)

        r2 = materialize_symbol_snapshot_from_vnbroker(symbols=['AAA', 'BBB', 'CCC'])
        self.assertEqual(r2['skipped_existing'], 3)
        self.assertEqual(r2['inserted'], 0)
        self.assertEqual(SymbolSnapshot.objects.filter(session_date=self.today).count(), 3)

    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshots_batch')
    def test_price_change_updates(self, batch_mock):
        batch_mock.return_value = _live(['AAA'])
        materialize_symbol_snapshot_from_vnbroker(symbols=['AAA'])
        batch_mock.return_value = _live(['AAA'], price='21.00')
        r = materialize_symbol_snapshot_from_vnbroker(symbols=['AAA'])
        self.assertEqual(r['updated'], 1)
        snap = SymbolSnapshot.objects.get(symbol='AAA', session_date=self.today)
        self.assertEqual(snap.price, Decimal('21.00'))

    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshots_batch')
    def test_no_mass_stale_on_provider_failure(self, batch_mock):
        batch_mock.side_effect = RuntimeError('provider down')
        with self.assertRaises(RuntimeError):
            materialize_symbol_snapshot_from_vnbroker(symbols=['AAA'])
        self.assertEqual(SymbolSnapshot.objects.filter(stale=True).count(), 0)
