"""S4 — rebase safety gate: hồi tố toàn chuỗi nhưng KHÔNG ghi khi dữ liệu hỏng."""
from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from market_data.cafef.rebase import validate_rebase


def _series(factor_before, factor_after, ex=date(2024, 6, 1), close=Decimal('100')):
    rows = {}
    for i in range(10):
        day = date(2024, 1, 1 + i)
        f = factor_before if day < ex else factor_after
        rows[day] = {
            'close': close,
            'adj_close': close * f,
            'adj_factor': f,
        }
    return rows


class RebaseSafetyGate(SimpleTestCase):
    def test_new_event_rebase_is_accepted(self):
        old = _series(Decimal('0.5'), Decimal('1.0'))
        new = _series(Decimal('0.4'), Decimal('1.0'))
        ok, reason = validate_rebase(old, new, ex_date=date(2024, 6, 1))
        self.assertTrue(ok, reason)
        self.assertEqual(reason, 'ok')

    def test_raw_close_corruption_halts(self):
        old = _series(Decimal('0.5'), Decimal('1.0'))
        new = _series(Decimal('0.5'), Decimal('1.0'))
        first = min(new)
        new[first] = dict(new[first], close=Decimal('50'))
        ok, reason = validate_rebase(old, new, ex_date=date(2024, 6, 1))
        self.assertFalse(ok)
        self.assertEqual(reason, 'raw_close_changed')

    def test_factor_out_of_bounds_halts(self):
        old = _series(Decimal('0.5'), Decimal('1.0'))
        new = _series(Decimal('0.001'), Decimal('1.0'))
        ok, reason = validate_rebase(old, new, ex_date=date(2024, 6, 1))
        self.assertFalse(ok)
        self.assertEqual(reason, 'factor_out_of_bounds')

    def test_fetch_error_is_reported_not_raised(self):
        from unittest.mock import patch

        from data_ingest.tasks import rebase_symbol_from_cafef
        with patch('vnbroker.reference.client.bulk_year') as mock_bulk:
            mock_bulk.side_effect = RuntimeError('HTTP 503')
            result = rebase_symbol_from_cafef.run('TPB', exchange='HOSE', trigger='e2e')
        self.assertEqual(result['status'], 'fetch_error')
        self.assertIn('503', result['reason'])

    def test_beat_entry_and_task_are_registered(self):
        from django.conf import settings

        from data_ingest.tasks import rebase_cafef_all_symbols, rebase_symbol_from_cafef

        self.assertIn('rebase-cafef-nightly-1900', settings.CELERY_BEAT_SCHEDULE)
        self.assertTrue(hasattr(rebase_symbol_from_cafef, 'delay'))
        self.assertTrue(hasattr(rebase_cafef_all_symbols, 'delay'))

    def test_missing_sessions_halts(self):
        old = _series(Decimal('0.5'), Decimal('1.0'))
        new = _series(Decimal('0.5'), Decimal('1.0'))
        del new[max(new)]
        ok, reason = validate_rebase(old, new, ex_date=date(2024, 6, 1))
        self.assertFalse(ok)
        self.assertEqual(reason, 'insufficient_coverage')
