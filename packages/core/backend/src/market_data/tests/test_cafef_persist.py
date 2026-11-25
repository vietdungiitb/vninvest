"""M4 — persist planner (TDD). Không ghi DB ở lớp này."""
from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from market_data.cafef.persist import build_migration_plan, classify_row


class CafefPersistTests(SimpleTestCase):
    def test_classify_row_matched(self):
        old = {'close': Decimal('16783'), 'adj_close': Decimal('5159.60'),
               'price_source': 'vnbroker_legacy', 'open': Decimal('1'),
               'high': Decimal('1'), 'low': Decimal('1'),
               'volume': 1, 'value': None, 'change_pct': None}
        new = {'symbol': 'TPB', 'date': date(2022, 1, 4),
               'close_raw': Decimal('42750'), 'close_adjusted': Decimal('17940'),
               'open_raw': Decimal('41500'), 'high_raw': Decimal('43250'),
               'low_raw': Decimal('41300'), 'volume': 11034900,
               'value': 467260000000, 'change_pct': Decimal('4.01')}
        result = classify_row(old, new, 'cafef')
        self.assertEqual(result['action'], 'update')
        self.assertEqual(result['close_new'], Decimal('42750'))
        self.assertEqual(result['adj_factor'],
                         (Decimal('17940') / Decimal('42750')).quantize(Decimal('0.0000000001')))
        self.assertEqual(result['price_source'], 'cafef')

    def test_classify_row_db_only_sets_adj_close_null(self):
        old = {'close': Decimal('100'), 'adj_close': Decimal('30'),
               'price_source': 'vnbroker_legacy'}
        result = classify_row(old, None, 'cafef')
        self.assertEqual(result['action'], 'keep_unmapped')
        self.assertIsNone(result['adj_close_new'])
        self.assertEqual(result['price_source'], 'unmapped_cafef')

    def test_classify_row_cafef_only_insert(self):
        new = {'symbol': 'ABC', 'date': date(2022, 1, 4),
               'close_raw': Decimal('100'), 'close_adjusted': Decimal('50'),
               'volume': 1, 'value': None, 'change_pct': None}
        result = classify_row(None, new, 'cafef')
        self.assertEqual(result['action'], 'insert')

    def test_plan_counts_and_keys(self):
        matched = {('TPB', date(2022, 1, 4)): 1}
        db_only = {('VIC', date(2022, 1, 4)): 1}
        cafef_only = {('ABC', date(2022, 1, 4)): 1}
        plan = build_migration_plan('HOSE', 2022, matched, db_only, cafef_only)
        self.assertEqual(plan['exchange'], 'HOSE')
        self.assertEqual(plan['year'], 2022)
        self.assertEqual(plan['update_count'], 1)
        self.assertEqual(plan['keep_unmapped_count'], 1)
        self.assertEqual(plan['insert_count'], 1)
        self.assertIn('inserted_keys', plan)
