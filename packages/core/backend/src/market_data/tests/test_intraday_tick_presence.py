"""
D06 – Integration tests cho IntradayTick presence check behaviour.

T-G1: bulk_create với ignore_conflicts=True không raise khi có duplicate.
T-G2: filter(timestamp__date=date) trả về đúng ticks của ngày đó.
T-G3: bulk_create 0 records khi ticks=[] trả về created=0.
"""
from datetime import datetime, timezone, date

from django.test import TestCase


class IntradayTickPresenceTest(TestCase):

    def _create_tick(self, symbol, dt, price=25000.0, volume=1_000_000, side='BUY'):
        from market_data.models import IntradayTick
        return IntradayTick.objects.create(
            symbol=symbol,
            timestamp=dt,
            price=price,
            volume=volume,
            side=side,
            source='test',
        )

    def test_bulk_create_ignore_conflicts(self):
        """T-G1: bulk_create với ignore_conflicts=True không raise khi có duplicate."""
        from market_data.models import IntradayTick

        dt = datetime(2026, 5, 10, 9, 0, 0, tzinfo=timezone.utc)
        self._create_tick('ABC', dt)

        # Tạo object cùng primary key sẽ bị conflict → ignore
        new_tick = IntradayTick(
            symbol='ABC2',
            timestamp=dt,
            price=26000.0,
            volume=2_000_000,
            side='SELL',
            source='test',
        )
        try:
            IntradayTick.objects.bulk_create([new_tick], ignore_conflicts=True)
        except Exception as e:
            self.fail(f'bulk_create raised {e}')

    def test_filter_by_timestamp_date(self):
        """T-G2: filter(timestamp__date=...) trả về đúng ticks của ngày."""
        dt_today = datetime(2026, 5, 10, 10, 0, 0, tzinfo=timezone.utc)
        dt_other = datetime(2026, 5, 9, 10, 0, 0, tzinfo=timezone.utc)

        self._create_tick('XYZ', dt_today)
        self._create_tick('XYZ', dt_other)

        from market_data.models import IntradayTick
        qs = IntradayTick.objects.filter(symbol='XYZ', timestamp__date=date(2026, 5, 10))
        self.assertEqual(qs.count(), 1)

    def test_empty_ticks_no_db_write(self):
        """T-G3: bulk_create([]) → không ghi gì."""
        from market_data.models import IntradayTick
        count_before = IntradayTick.objects.count()
        IntradayTick.objects.bulk_create([], ignore_conflicts=True)
        self.assertEqual(IntradayTick.objects.count(), count_before)
