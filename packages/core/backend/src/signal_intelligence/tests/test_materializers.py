from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from signal_intelligence.materializers import materialize_unified_alerts, materialize_whale_feed_aggregate
from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical


class WhaleMaterializerTests(TestCase):
    def test_materialize_whale_feed_aggregate_uses_order_flow_facts_only(self):
        now = timezone.now()
        event = OrderFlowEvent.objects.create(
            symbol='VCI',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
            side=OrderFlowEvent.SideChoices.BUY,
            strength=0.9,
            whale_intensity=0.95,
            price_at_signal=Decimal('25000.00'),
            volume_at_signal=40000,
            source_ref='orderflow-vci-whale',
            triggered_at=now,
        )

        result = materialize_whale_feed_aggregate.run(symbol='VCI')

        event.refresh_from_db()
        alert = UnifiedAlert.objects.get(source_ref='orderflow-vci-whale')
        canonical = WhaleAlertCanonical.objects.get(alert=alert)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['created'], 1)
        self.assertEqual(result['skipped'], 0)
        self.assertEqual(result['source'], 'native_order_flow_events')
        self.assertEqual(alert.alert_type, UnifiedAlert.AlertTypeChoices.WHALE)
        self.assertEqual(alert.direction, UnifiedAlert.DirectionChoices.BUY)
        self.assertEqual(alert.value, Decimal('1000000000'))
        self.assertEqual(alert.metadata['source'], 'native_order_flow_events')
        self.assertEqual(event.unified_alert_id, alert.pk)
        self.assertEqual(canonical.symbol, 'VCI')
        self.assertEqual(canonical.side, WhaleAlertCanonical.SideChoices.BUY)
        self.assertEqual(canonical.price, Decimal('25000.00'))
        self.assertEqual(canonical.volume, 40000)
        self.assertEqual(canonical.matched_value, 1000000000)

    def test_materialize_whale_feed_aggregate_skips_incomplete_native_facts(self):
        now = timezone.now()
        OrderFlowEvent.objects.create(
            symbol='SSI',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_SELL,
            side=OrderFlowEvent.SideChoices.SELL,
            strength=0.8,
            whale_intensity=0.9,
            price_at_signal=None,
            volume_at_signal=60000,
            source_ref='orderflow-ssi-whale-incomplete',
            triggered_at=now,
        )

        result = materialize_whale_feed_aggregate.run(symbol='SSI')

        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['created'], 0)
        self.assertEqual(result['skipped'], 1)
        self.assertEqual(result['source'], 'native_order_flow_events')
        self.assertFalse(UnifiedAlert.objects.filter(source_ref='orderflow-ssi-whale-incomplete').exists())
        self.assertFalse(WhaleAlertCanonical.objects.filter(symbol='SSI').exists())

    def test_materialize_whale_feed_aggregate_is_idempotent_for_existing_event(self):
        now = timezone.now()
        OrderFlowEvent.objects.create(
            symbol='KBS',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
            side=OrderFlowEvent.SideChoices.BUY,
            strength=0.85,
            whale_intensity=0.92,
            price_at_signal=Decimal('30000.00'),
            volume_at_signal=50000,
            source_ref='orderflow-kbs-whale',
            triggered_at=now,
        )

        first = materialize_whale_feed_aggregate.run(symbol='KBS')
        second = materialize_whale_feed_aggregate.run(symbol='KBS')

        self.assertEqual(first['created'], 1)
        self.assertEqual(second['created'], 0)
        self.assertEqual(UnifiedAlert.objects.filter(source_ref='orderflow-kbs-whale').count(), 1)
        self.assertEqual(WhaleAlertCanonical.objects.filter(symbol='KBS').count(), 1)


class UnifiedAlertMaterializerTests(TestCase):
    def test_materialize_unified_alerts_creates_dark_flow_alert_from_order_flow_event(self):
        now = timezone.now()
        event = OrderFlowEvent.objects.create(
            symbol='SSI',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
            side=OrderFlowEvent.SideChoices.SELL,
            strength=0.7,
            whale_intensity=0.15,
            price_at_signal=Decimal('24000.00'),
            volume_at_signal=50000,
            source_ref='orderflow-ssi-dark',
            triggered_at=now,
        )

        result = materialize_unified_alerts.run()

        event.refresh_from_db()
        alert = UnifiedAlert.objects.get(source_ref='orderflow-ssi-dark')
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['dark_synced'], 1)
        self.assertEqual(alert.alert_type, UnifiedAlert.AlertTypeChoices.DARK_FLOW)
        self.assertEqual(alert.direction, UnifiedAlert.DirectionChoices.SELL)
        self.assertEqual(alert.value, Decimal('1200000000'))
        self.assertEqual(alert.metadata['source'], 'native_order_flow_events')
        self.assertEqual(event.unified_alert_id, alert.pk)

    def test_materialize_unified_alerts_is_idempotent_for_dark_flow_event(self):
        now = timezone.now()
        OrderFlowEvent.objects.create(
            symbol='VCI',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
            side=OrderFlowEvent.SideChoices.BUY,
            strength=0.8,
            whale_intensity=0.12,
            price_at_signal=Decimal('20000.00'),
            volume_at_signal=60000,
            source_ref='orderflow-vci-dark',
            triggered_at=now,
        )

        first = materialize_unified_alerts.run()
        second = materialize_unified_alerts.run()

        self.assertEqual(first['dark_synced'], 1)
        self.assertEqual(second['dark_synced'], 0)
        self.assertEqual(UnifiedAlert.objects.filter(source_ref='orderflow-vci-dark').count(), 1)