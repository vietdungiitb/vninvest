"""S4b — rebase fetches ALL-export per year, not the failing per-symbol endpoint."""
from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from data_ingest.tasks import rebase_symbol_from_cafef


def _record(day, close, adj):
    return {
        'symbol': 'TPB', 'date': day, 'close_raw': close,
        'close_adjusted': adj, 'change_pct': None,
    }


class RebaseBulkFetch(SimpleTestCase):
    @patch('market_data.models.DailyPrice.objects.bulk_update')
    @patch('market_data.models.DailyPrice.objects.filter')
    @patch('vnbroker.reference.client.bulk_year')
    def test_bulk_year_feed_produces_applied_rebase(self, mock_bulk, mock_filter, mock_update):
        mock_bulk.return_value = [
            _record('2022-01-04', 42750.0, 17940.0),
            _record('2022-01-05', 42000.0, 17640.0),
            {'symbol': 'OTHER', 'date': '2022-01-04', 'close_raw': 10.0,
             'close_adjusted': 5.0, 'change_pct': None},
        ]
        old_rows = [
            SimpleNamespace(
                date=date(2022, 1, 4), close=Decimal('42750'),
                adj_close=Decimal('17940'), adj_factor=Decimal('0.4196491228'),
                price_source='cafef',
            ),
            SimpleNamespace(
                date=date(2022, 1, 5), close=Decimal('42000'),
                adj_close=Decimal('17640'), adj_factor=Decimal('0.42'),
                price_source='cafef',
            ),
        ]
        mock_filter.return_value.order_by.return_value = old_rows
        result = rebase_symbol_from_cafef.run(
            'TPB', exchange='HOSE', trigger='e2e', from_year=2026,
        )
        self.assertEqual(result['status'], 'applied')
        self.assertEqual(result['rows_updated'], 2)
        self.assertEqual(mock_update.call_count, 1)
        # Chỉ gọi bulk_year cho năm được yêu cầu, không gọi daily_bars.
        self.assertEqual(mock_bulk.call_count, 1)
        self.assertEqual(mock_bulk.call_args.args[1], 2026)
