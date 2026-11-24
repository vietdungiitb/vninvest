"""M1 — dry-run diff helpers (TDD). Không ghi DB."""
from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from market_data.cafef.diff import classify_db_only, diff_row, ratio_stats


class CafefDiffTests(SimpleTestCase):
    def test_diff_row_reports_all_fields(self):
        old = {
            'close': Decimal('16783.00'), 'adj_close': Decimal('5159.60'),
            'open': Decimal('16700'), 'high': Decimal('16900'), 'low': Decimal('16500'),
            'volume': 1000, 'value': 100,
        }
        new = {
            'close_raw': Decimal('42750.00'), 'close_adjusted': Decimal('17940.00'),
            'open_raw': Decimal('41500'), 'high_raw': Decimal('43250'), 'low_raw': Decimal('41300'),
            'volume': 11034900, 'value': 467260000000,
        }
        d = diff_row('TPB', date(2022, 1, 4), old, new)
        self.assertEqual(d['symbol'], 'TPB')
        self.assertEqual(d['close_old'], Decimal('16783.00'))
        self.assertEqual(d['close_new'], Decimal('42750.00'))
        self.assertEqual(d['adj_close_new'], Decimal('17940.00'))
        self.assertEqual(d['volume_new'], 11034900)
        self.assertAlmostEqual(d['close_ratio'], 42750 / 16783, places=4)
        self.assertEqual(d['fields_changed'], 7)

    def test_diff_row_missing_adj_close_is_flagged(self):
        old = {'close': Decimal('100'), 'adj_close': None, 'open': Decimal('100'),
               'high': Decimal('100'), 'low': Decimal('100'), 'volume': 1, 'value': None}
        new = {'close_raw': Decimal('100'), 'close_adjusted': None,
               'open_raw': Decimal('100'), 'high_raw': Decimal('100'), 'low_raw': Decimal('100'),
               'volume': 1, 'value': None}
        d = diff_row('X', date(2022, 1, 4), old, new)
        self.assertTrue(d['adj_close_missing'])
        self.assertFalse(d['unit_suspected'])

    def test_diff_row_flags_unit_error(self):
        old = {'close': Decimal('100'), 'adj_close': None, 'open': Decimal('100'),
               'high': Decimal('100'), 'low': Decimal('100'), 'volume': 1, 'value': None}
        new = {'close_raw': Decimal('100000'), 'close_adjusted': None,
               'open_raw': Decimal('100000'), 'high_raw': Decimal('100000'), 'low_raw': Decimal('100000'),
               'volume': 1, 'value': None}
        d = diff_row('X', date(2022, 1, 4), old, new)
        self.assertTrue(d['unit_suspected'])  # ratio 1000x ⇒ halt

    def test_classify_db_only_benchmark(self):
        self.assertEqual(classify_db_only('VNINDEX'), 'benchmark')
        self.assertEqual(classify_db_only('HNX30'), 'benchmark')

    def test_classify_db_only_symbol_suffixes(self):
        # Chỉ những nhãn có bằng chứng trong tên mới tự phân loại được;
        # phần còn lại để M1 báo cáo cho owner, KHÔNG đoán.
        self.assertEqual(classify_db_only('ABC'), 'legacy_garbage')
        self.assertIn(classify_db_only('VNMF2025'), ('delisted_or_etf', 'legacy_garbage'))

    def test_ratio_stats(self):
        stats = ratio_stats([Decimal('1.0'), Decimal('1.001'), Decimal('0.999')])
        self.assertAlmostEqual(stats['mean'], 1.0, places=3)
        self.assertLess(stats['std'], 0.01)
        self.assertFalse(stats['halt'])

    def test_ratio_stats_halt_on_unit_spike(self):
        stats = ratio_stats([Decimal('1.0'), Decimal('1000')])
        self.assertTrue(stats['halt'])
