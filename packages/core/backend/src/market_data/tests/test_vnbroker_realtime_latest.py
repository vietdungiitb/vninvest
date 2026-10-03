"""VCI-400 investigation: _pick_latest_bar chọn bar mới nhất mọi thứ tự provider.

Chạy: python manage.py test market_data.tests.test_vnbroker_realtime_latest
"""
import pandas as pd
from django.test import SimpleTestCase

from market_data.vnbroker_adapter import _pick_latest_bar


def _frame(rows):
    return pd.DataFrame([{
        'time': t, 'open': 1.0, 'high': 2.0, 'low': 0.5, 'close': c, 'volume': 10,
    } for t, c in rows])


class PickLatestBarTests(SimpleTestCase):
    def test_ascending_picks_last(self):
        frame = _frame([('2026-09-21', 100.0), ('2026-09-22', 101.0), ('2026-09-23', 102.0)])
        self.assertAlmostEqual(float(_pick_latest_bar(frame)['close']), 102.0)

    def test_descending_picks_first(self):
        frame = _frame([('2026-09-23', 102.0), ('2026-09-22', 101.0), ('2026-09-21', 100.0)])
        self.assertAlmostEqual(float(_pick_latest_bar(frame)['close']), 102.0)

    def test_no_time_column_falls_back_iloc0(self):
        frame = pd.DataFrame([{'close': 1.0}, {'close': 2.0}])
        self.assertAlmostEqual(float(_pick_latest_bar(frame)['close']), 1.0)

    def test_unparsable_time_falls_back_iloc0(self):
        frame = pd.DataFrame([{'time': 'n/a', 'close': 7.0}])
        self.assertAlmostEqual(float(_pick_latest_bar(frame)['close']), 7.0)

    def test_datetime_objects(self):
        import datetime
        frame = pd.DataFrame([
            {'time': datetime.datetime(2026, 9, 21, 9, 0), 'close': 1.0},
            {'time': datetime.datetime(2026, 9, 23, 9, 0), 'close': 3.0},
        ])
        self.assertAlmostEqual(float(_pick_latest_bar(frame)['close']), 3.0)
