"""M0 fix — importer PHẢI đi qua vnbroker bulk_year (không phải local fetcher)."""
from unittest.mock import patch

from django.test import SimpleTestCase

from market_data.cafef import importer

ROWS = [{
    'symbol': 'TPB', 'date': __import__('datetime').date(2022, 1, 4),
    'close_raw': __import__('decimal').Decimal('42750.00'),
    'close_adjusted': __import__('decimal').Decimal('17940.00'),
    'open_raw': __import__('decimal').Decimal('41500.00'),
    'high_raw': __import__('decimal').Decimal('43250.00'),
    'low_raw': __import__('decimal').Decimal('41300.00'),
    'volume': 11034900, 'value': 467260000000, 'source': 'cafef',
}]


def _frame():
    class F:
        empty = False

        def to_dict(self, _orient):
            return [dict(r) for r in ROWS]
    return F()


class ImporterSourceTests(SimpleTestCase):
    def test_preview_import_uses_vnbroker(self):
        with patch('market_data.cafef.importer._fetch_rows', return_value=ROWS) as fetch:
            r = importer.preview_import('HOSE', 2022)
        fetch.assert_called_once_with('HOSE', 2022)
        self.assertEqual(r['row_count'], 1)

    def test_run_import_uses_vnbroker(self):
        with patch('market_data.cafef.importer._fetch_rows', return_value=ROWS) as fetch:
            r = importer.run_import('HOSE', 2022, dry_run=True)
        fetch.assert_called_once_with('HOSE', 2022)
        self.assertEqual(r['row_count'], 1)

    def test_fetch_rows_calls_reference_bulk_year(self):
        ref = type('R', (), {'bulk_year': lambda self, ex, y: _frame()})()
        client = type('V', (), {'reference': lambda self, name: ref})()
        with patch('vnbroker.Vnbroker', return_value=client):
            rows = importer._fetch_rows('HOSE', 2022)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['symbol'], 'TPB')
