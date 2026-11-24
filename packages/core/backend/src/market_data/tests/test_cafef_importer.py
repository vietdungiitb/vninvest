"""C3 importer: idempotent + dry-run (TDD)."""
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from market_data.cafef.importer import preview_import, run_import
from market_data.models import CafefDailyPrice

ROWS = [
    {
        'symbol': 'TPB', 'date': date(2022, 1, 4),
        'close_raw': Decimal('42750.00'), 'close_adjusted': Decimal('17940.00'),
        'open_raw': Decimal('41500.00'), 'high_raw': Decimal('43250.00'),
        'low_raw': Decimal('41300.00'), 'volume': 11034900,
        'value': 467260000000, 'source': 'cafef',
    }
]


def _mock_fetch(_exchange, _year):
    return b'PK-mock'


class CafefImporterTests(TestCase):
    def setUp(self):
        patcher = patch('market_data.cafef.importer.fetch_xlsx', side_effect=_mock_fetch)
        patcher.start()
        self.addCleanup(patcher.stop)
        def _mock_parse(_payload, with_rejected=False):
            data = [dict(r) for r in ROWS]
            return (data, []) if with_rejected else data

        patcher2 = patch(
            'market_data.cafef.importer.parse_xlsx_rows',
            side_effect=_mock_parse,
        )
        patcher2.start()
        self.addCleanup(patcher2.stop)

    def test_preview_reports_row_count_without_writing(self):
        result = preview_import('HOSE', 2022)
        self.assertEqual(result['row_count'], 1)
        self.assertEqual(result['source'], 'live_fetch')
        self.assertEqual(CafefDailyPrice.objects.count(), 0)

    def test_dry_run_writes_nothing(self):
        result = run_import('HOSE', 2022, dry_run=True)
        self.assertTrue(result['dry_run'])
        self.assertEqual(result['inserted'], 0)
        self.assertEqual(CafefDailyPrice.objects.count(), 0)

    def test_apply_then_rerun_is_idempotent(self):
        first = run_import('HOSE', 2022)
        self.assertEqual(first['inserted'], 1)
        self.assertEqual(first['updated'], 0)
        self.assertEqual(CafefDailyPrice.objects.count(), 1)

        second = run_import('HOSE', 2022)
        self.assertEqual(second['inserted'], 0)
        self.assertEqual(second['updated'], 1)
        self.assertEqual(CafefDailyPrice.objects.count(), 1)
