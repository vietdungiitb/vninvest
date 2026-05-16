from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from signal_intelligence.materializers import (
    materialize_ai_signal_alerts,
    materialize_market_anomaly_alerts,
    materialize_stale_quote_alerts,
    materialize_unified_alerts,
    materialize_whale_feed_aggregate,
)
from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical, UserAlertDelivery
from signal_intelligence.views import AIAlertsFeedView, AlertCenterFeedView
from market_serving.models import SymbolSnapshot
from identity_access.models import UserProfile
from user_workspace.models import Portfolio, Transaction, Watchlist, WatchlistItem


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
        self.assertEqual(alert.confidence, 0.95)
        self.assertEqual(alert.freshness_state, 'fresh')
        self.assertEqual(alert.value, Decimal('1000000000'))
        self.assertEqual(alert.metadata['source'], 'native_order_flow_events')
        self.assertEqual(alert.evidence['matched_value'], 1000000000)
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
        self.assertEqual(alert.confidence, 0.85)
        self.assertEqual(alert.freshness_state, 'fresh')
        self.assertEqual(alert.value, Decimal('1200000000'))
        self.assertEqual(alert.metadata['source'], 'native_order_flow_events')
        self.assertEqual(alert.evidence['signal_type'], OrderFlowEvent.SignalTypeChoices.DARK_FLOW)
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

    def test_unified_alert_list_view_defaults_to_main_lane_and_supports_ai_lane(self):
        now = timezone.now()
        main_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.92,
            freshness_state='fresh',
            title='Main lane whale',
            body='',
            session_date=now.date(),
            triggered_at=now,
            evidence={'source': 'native_order_flow_events'},
        )
        ai_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.AI_ALERT,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.LOW,
            confidence=0.66,
            freshness_state='fresh',
            title='AI lane suggestion',
            body='',
            session_date=now.date(),
            triggered_at=now,
            evidence={'source': 'ai_lane'},
        )

        user = get_user_model().objects.create_user(username='signal-tester', password='password123')
        watchlist = Watchlist.objects.create(user=user, name='Theo doi lane', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        factory = APIRequestFactory()

        main_request = factory.get('/signals/alert-center/feed')
        force_authenticate(main_request, user=user)
        main_response = AlertCenterFeedView.as_view()(main_request)
        self.assertEqual(main_response.status_code, 200)
        self.assertEqual(main_response.data['results'][0]['alert_id'], str(main_alert.alert_id))
        self.assertEqual(main_response.data['results'][0]['lane'], 'main')

        ai_request = factory.get('/signals/ai-alerts/feed')
        force_authenticate(ai_request, user=user)
        ai_response = AIAlertsFeedView.as_view()(ai_request)
        self.assertEqual(ai_response.status_code, 200)
        self.assertEqual(ai_response.data['results'][0]['alert_id'], str(ai_alert.alert_id))
        self.assertEqual(ai_response.data['results'][0]['lane'], 'ai')

    def test_materialize_stale_quote_alerts_creates_system_alert_from_snapshot(self):
        now = timezone.now()
        snapshot = SymbolSnapshot.objects.create(
            symbol='SSI',
            session_date=now.date(),
            price=Decimal('25000.00'),
            price_change=Decimal('0.00'),
            price_change_pct=Decimal('0.00'),
            volume=1000,
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )
        SymbolSnapshot.objects.filter(pk=snapshot.pk).update(stale=True)

        result = materialize_stale_quote_alerts.run(symbol='SSI')

        alert = UnifiedAlert.objects.get(source_ref='stale_quote:SSI:' + now.date().isoformat())
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['created'], 1)
        self.assertEqual(alert.alert_type, UnifiedAlert.AlertTypeChoices.SYSTEM)
        self.assertEqual(alert.freshness_state, 'stale')
        self.assertEqual(alert.evidence['stale'], True)

    def test_materialize_market_anomaly_alerts_creates_signal_alert_from_snapshot(self):
        now = timezone.now()
        snapshot = SymbolSnapshot.objects.create(
            symbol='VCI',
            session_date=now.date(),
            price=Decimal('40000.00'),
            price_change=Decimal('3500.00'),
            price_change_pct=Decimal('8.75'),
            volume=1500,
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )

        result = materialize_market_anomaly_alerts.run(symbol='VCI')

        alert = UnifiedAlert.objects.get(source_ref='market_anomaly:VCI:' + now.date().isoformat())
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['created'], 1)
        self.assertEqual(alert.alert_type, UnifiedAlert.AlertTypeChoices.SIGNAL)
        self.assertEqual(alert.severity, UnifiedAlert.SeverityChoices.MEDIUM)
        self.assertEqual(alert.confidence, 0.8)
        self.assertEqual(alert.evidence['price_change_pct'], 8.75)

    def test_materialize_ai_signal_alerts_creates_ai_lane_alert(self):
        now = timezone.now()
        OrderFlowEvent.objects.create(
            symbol='FPT',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.OTHER,
            side=OrderFlowEvent.SideChoices.NEUTRAL,
            strength=0.88,
            whale_intensity=0.2,
            source_ref='ai-signal-fpt',
            metadata={
                'ai_signal': 'price_momentum_breakout',
                'title': 'AI breakout',
                'body': 'Momentum breakout detected',
                'confidence': 0.93,
            },
            triggered_at=now,
        )

        result = materialize_ai_signal_alerts.run(symbol='FPT')

        alert = UnifiedAlert.objects.get(source_ref='ai-signal-fpt')
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['created'], 1)
        self.assertEqual(alert.alert_type, UnifiedAlert.AlertTypeChoices.AI_ALERT)
        self.assertEqual(alert.confidence, 0.93)
        self.assertEqual(alert.metadata['source'], 'signal_intelligence.ai_signal_events')
        self.assertEqual(alert.evidence['ai_signal'], 'price_momentum_breakout')

    def test_alert_center_feed_filters_by_user_symbols_and_threshold(self):
        now = timezone.now()
        user = get_user_model().objects.create_user(username='delivery-user', password='password123')
        UserProfile.objects.create(user=user, whale_alert_threshold=700)
        watchlist = Watchlist.objects.create(user=user, name='Theo dõi', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        portfolio = Portfolio.objects.create(user=user, name='Danh mục', is_default=True)
        Transaction.objects.create(
            portfolio=portfolio,
            symbol='FPT',
            transaction_type=Transaction.TransactionType.BUY,
            date=now.date(),
            price=Decimal('10000.00'),
            quantity=10,
        )
        allowed_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.95,
            freshness_state='fresh',
            title='Whale VCI',
            body='',
            value=Decimal('1000000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='delivery-allowed',
            evidence={'source': 'test'},
        )
        filtered_by_threshold = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            confidence=0.8,
            freshness_state='fresh',
            title='Whale nhỏ VCI',
            body='',
            value=Decimal('600000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='delivery-threshold',
            evidence={'source': 'test'},
        )
        filtered_by_symbol = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM,
            symbol='SSI',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            confidence=0.8,
            freshness_state='stale',
            title='SSI stale',
            body='',
            session_date=now.date(),
            triggered_at=now,
            source_ref='delivery-symbol',
            evidence={'source': 'test'},
        )

        factory = APIRequestFactory()
        request = factory.get('/signals/alert-center/feed')
        force_authenticate(request, user=user)

        response = AlertCenterFeedView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        result_ids = {item['alert_id'] for item in response.data['results']}
        self.assertIn(str(allowed_alert.alert_id), result_ids)
        self.assertNotIn(str(filtered_by_threshold.alert_id), result_ids)
        self.assertNotIn(str(filtered_by_symbol.alert_id), result_ids)

    def test_alert_center_routes_are_registered_under_core_v1(self):
        now = timezone.now()
        user = get_user_model().objects.create_user(username='delivery-route-user', password='password123')
        UserProfile.objects.create(user=user, whale_alert_threshold=500)
        watchlist = Watchlist.objects.create(user=user, name='Theo dõi route', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.91,
            freshness_state='fresh',
            title='Whale route VCI',
            body='',
            value=Decimal('800000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='delivery-route-allowed',
            evidence={'source': 'test'},
        )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get('/core/v1/signals/alert-center/feed')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['results']), 1)

    def test_legacy_unified_alert_routes_are_removed(self):
        user = get_user_model().objects.create_user(username='legacy-removed-user', password='password123')
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/core/v1/unified-alert/delivery')
        self.assertEqual(response.status_code, 404)

    def test_alert_center_ack_and_mute_flow(self):
        now = timezone.now()
        user = get_user_model().objects.create_user(username='ack-mute-user', password='password123')
        UserProfile.objects.create(user=user, whale_alert_threshold=100)
        watchlist = Watchlist.objects.create(user=user, name='Theo doi ACK', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            freshness_state='fresh',
            title='Whale VCI ACK',
            body='',
            value=Decimal('1000000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='ack-mute-vci',
            evidence={'source': 'test'},
        )

        client = APIClient()
        client.force_authenticate(user=user)

        ack_response = client.post(f'/core/v1/signals/alert-center/events/{alert.alert_id}/ack')
        self.assertEqual(ack_response.status_code, 200)
        self.assertEqual(ack_response.json()['delivery_state'], 'acknowledged')
        self.assertTrue(UserAlertDelivery.objects.filter(user=user, alert=alert, delivery_state='acknowledged').exists())

        mute_response = client.post(
            '/core/v1/signals/alert-center/preferences/mute',
            data={'symbol': 'VCI', 'alert_family': 'whale', 'mute_minutes': 30},
            format='json',
        )
        self.assertEqual(mute_response.status_code, 200)

        feed_response = client.get('/core/v1/signals/alert-center/feed')
        self.assertEqual(feed_response.status_code, 200)
        self.assertEqual(len(feed_response.json()['results']), 0)

    def test_alert_center_feed_supports_alert_family_filter_and_summary_payload(self):
        now = timezone.now()
        user = get_user_model().objects.create_user(username='family-filter-user', password='password123')
        UserProfile.objects.create(user=user, whale_alert_threshold=100)
        watchlist = Watchlist.objects.create(user=user, name='Theo doi family', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')

        price_shock_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.87,
            freshness_state='fresh',
            title='Gia tang dot bien VCI',
            body='Price changed 8.50% in short window',
            value=Decimal('1500000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='market_anomaly:VCI:' + now.date().isoformat(),
            evidence={'source': 'test'},
        )
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            freshness_state='fresh',
            title='Whale VCI',
            body='Matched value high',
            value=Decimal('1700000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='family-whale-vci',
            evidence={'source': 'test'},
        )

        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get('/core/v1/signals/alert-center/feed', {'alert_family': 'price_shock'})

        self.assertEqual(response.status_code, 200)
        payload = response.json()['results']
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]['alert_id'], str(price_shock_alert.alert_id))
        self.assertEqual(payload[0]['alert_family'], 'price_shock')
        self.assertTrue(payload[0]['summary'])