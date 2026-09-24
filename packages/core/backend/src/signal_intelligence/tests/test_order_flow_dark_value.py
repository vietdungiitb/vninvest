"""
F1-darkflow-value – Regression tests cho đơn vị price/volume của dark_flow event.

Bug gốc: tasks.py nhánh dark truyền volume = tổng buy_count (số ĐẾM tick) vào
volume_at_signal (ngữ nghĩa: số CỔ PHIẾU) → materializer tính
matched_value = price × volume ra vài triệu đồng, trong khi evidence window
buy_value hàng tỷ đồng (DGW: 2.102.200đ vs 1.767.185.000đ).

T-F1: 10 BUY ticks × (50.000đ × 1.000 cp) = buy_value 500M → event phải có
      volume_at_signal = 10.000 (shares), price_at_signal = 50.000 (VWAP),
      và sau materialize alert.value = 500.000.000 (KHÔNG phải 500.000).
T-F2: SELL áp đảo (buy_ratio < 0.65) → không sinh dark_flow event.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from django.test import TestCase


def _make_ticks(symbol, day, price, volume, side, count, start_minute=0):
    from market_data.models import IntradayTick
    base = datetime(day.year, day.month, day.day, 9, 0, 0, tzinfo=timezone.utc)
    rows = [
        IntradayTick(
            symbol=symbol,
            timestamp=base + timedelta(seconds=start_minute * 60 + i * 20),
            price=price,
            volume=volume,
            side=side,
            source='test',
        )
        for i in range(count)
    ]
    IntradayTick.objects.bulk_create(rows)


class DarkFlowValueUnitTests(TestCase):
    def _run_task(self, session_date, symbol):
        from signal_intelligence.tasks import detect_and_store_global_whale_alerts
        return detect_and_store_global_whale_alerts.apply(
            kwargs={'session_date': session_date, 'symbol': symbol}
        ).get()

    def test_dark_flow_event_uses_share_volume_not_tick_count(self):
        """T-F1: volume_at_signal = tổng shares; alert.value = window buy_value."""
        from datetime import date
        from signal_intelligence.models import OrderFlowEvent, UnifiedAlert
        from signal_intelligence.materializers import materialize_unified_alerts

        day = date(2026, 9, 24)
        _make_ticks('TST', day, price=50000, volume=1000, side='BUY', count=10)

        result = self._run_task('2026-09-24', 'TST')
        self.assertEqual(result.get('status'), 'ok')

        event = OrderFlowEvent.objects.get(
            source_ref='tick_session:TST:2026-09-24:dark_flow',
        )
        # 10 ticks × 1.000 cp = 10.000 shares (trước fix: 10 = số đếm tick)
        self.assertEqual(event.volume_at_signal, 10000)
        self.assertEqual(event.price_at_signal, Decimal('50000'))
        self.assertEqual(
            event.metadata['windows'][0]['buy_value'], 500000000.0,
        )

        materialize_unified_alerts.run()
        alert = UnifiedAlert.objects.get(
            source_ref='tick_session:TST:2026-09-24:dark_flow',
        )
        # 50.000 × 10.000 = 500M (trước fix: 50.000 × 10 = 500.000)
        self.assertEqual(alert.value, Decimal('500000000'))
        self.assertIn('500,000,000', alert.title)

    def test_sell_dominated_session_creates_no_dark_flow_event(self):
        """T-F2: buy_ratio < ngưỡng → không có dark_flow event."""
        from datetime import date
        from signal_intelligence.models import OrderFlowEvent

        day = date(2026, 9, 24)
        _make_ticks('SLL', day, price=50000, volume=1000, side='SELL', count=8)
        _make_ticks('SLL', day, price=50000, volume=1000, side='BUY', count=2,
                    start_minute=10)

        result = self._run_task('2026-09-24', 'SLL')
        self.assertEqual(result.get('status'), 'ok')
        self.assertFalse(
            OrderFlowEvent.objects.filter(
                source_ref='tick_session:SLL:2026-09-24:dark_flow',
            ).exists()
        )
