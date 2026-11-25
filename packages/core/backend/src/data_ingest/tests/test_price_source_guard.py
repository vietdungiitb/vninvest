"""M3 — guard: nightly ingest KHÔNG ghi đè dòng price_source='cafef' (TDD)."""
import os
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import SimpleTestCase

from data_ingest import tasks
from data_ingest.tasks import _classify_daily_price_rows

HISTORY = [{
    'symbol': 'TPB', 'date': date(2022, 1, 4), 'open': 1, 'high': 2,
    'low': 0.5, 'close': 1.5, 'volume': 10, 'source': 'vci',
}]


def _existing(price_source):
    return {date(2022, 1, 4): {
        'date': date(2022, 1, 4), 'open': Decimal('42750'), 'high': Decimal('43250'),
        'low': Decimal('41300'), 'close': Decimal('42750'), 'volume': 11034900,
        'source': 'vnbroker_vci', 'price_source': price_source,
    }}


class PriceSourceGuardTests(SimpleTestCase):
    def test_cafef_row_is_skipped(self):
        objs, ins, upd, skipped = _classify_daily_price_rows(
            _existing('cafef'), [dict(r) for r in HISTORY], 'VCI')
        self.assertEqual(objs, [])
        self.assertEqual((ins, upd, skipped), (0, 0, 1))

    def test_unmapped_cafef_row_is_also_skipped(self):
        """M6a: 298 dòng HOSE 2022 bị đánh dấu unmapped_cafef (adj_close hỏng
        đã dọn NULL) cũng KHÔNG được provider ghi đè khi beat chạy lại."""
        objs, ins, upd, skipped = _classify_daily_price_rows(
            _existing('unmapped_cafef'), [dict(r) for r in HISTORY], 'VCI')
        self.assertEqual(objs, [])
        self.assertEqual((ins, upd, skipped), (0, 0, 1))

    def test_legacy_row_still_updated(self):
        objs, ins, upd, skipped = _classify_daily_price_rows(
            _existing('vnbroker_legacy'), [dict(r) for r in HISTORY], 'VCI')
        self.assertEqual(len(objs), 1)
        self.assertEqual(upd, 1)

    def test_missing_row_still_inserted(self):
        objs, ins, upd, skipped = _classify_daily_price_rows(
            {}, [dict(r) for r in HISTORY], 'VCI')
        self.assertEqual(len(objs), 1)
        self.assertEqual(ins, 1)

    def test_backfill_task_skipped_when_paused(self):
        """Pause chặn MỌI callsite (beat + 4 on-demand), không chỉ beat."""
        with patch.dict(os.environ, {'PRICE_MIGRATION_PAUSED': '1'}), \
             patch.object(tasks, '_backfill_daily_prices_impl') as impl:
            result = tasks.backfill_daily_prices.run(days=1)
        self.assertTrue(result['skipped'])
        impl.assert_not_called()
