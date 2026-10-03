from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from identity_access.models import UserProfile
from signal_intelligence import delivery_service
from signal_intelligence.models import UnifiedAlert, UserAlertDelivery, UserAlertPreference
from user_workspace.models import Watchlist, WatchlistItem


class DeliveryServiceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='delivery-service-user', password='password123')
        UserProfile.objects.create(user=self.user, whale_alert_threshold=700)
        watchlist = Watchlist.objects.create(user=self.user, name='Theo doi service', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')

    def _create_alert(self, *, symbol='VCI', value='1000000000', alert_type=UnifiedAlert.AlertTypeChoices.WHALE, source_ref='delivery-service-alert'):
        now = timezone.now()
        return UnifiedAlert.objects.create(
            alert_type=alert_type,
            symbol=symbol,
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            freshness_state='fresh',
            title='Service alert',
            body='',
            value=Decimal(value) if value is not None else None,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref=source_ref,
            evidence={'source': 'test'},
        )

    def test_apply_user_delivery_policy_filters_by_threshold_and_preferences(self):
        allowed = self._create_alert(source_ref='allowed')
        self._create_alert(value='600000000', source_ref='below-threshold')
        self._create_alert(symbol='SSI', alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM, value=None, source_ref='out-of-scope')

        queryset = UnifiedAlert.objects.all().order_by('-triggered_at')
        initial_ids = set(delivery_service.apply_user_delivery_policy(user=self.user, queryset=queryset).values_list('id', flat=True))
        self.assertEqual(initial_ids, {allowed.id})

        delivery_service.upsert_user_alert_preference(
            user=self.user,
            symbol='VCI',
            alert_family=UnifiedAlert.AlertTypeChoices.WHALE,
            mute_until=timezone.now() + timedelta(minutes=30),
            cooldown_seconds=60,
        )

        after_mute_ids = set(delivery_service.apply_user_delivery_policy(user=self.user, queryset=queryset).values_list('id', flat=True))
        self.assertEqual(after_mute_ids, set())

    def test_sync_user_delivery_rows_is_idempotent(self):
        alert = self._create_alert(source_ref='sync-row')

        delivery_service.sync_user_delivery_rows(user=self.user, alerts=[alert])
        delivery_service.sync_user_delivery_rows(user=self.user, alerts=[alert])

        rows = UserAlertDelivery.objects.filter(user=self.user, alert=alert)
        self.assertEqual(rows.count(), 1)
        self.assertEqual(rows.first().delivery_state, UserAlertDelivery.DeliveryStateChoices.NEW)

    def test_transition_seen_then_acknowledged(self):
        alert = self._create_alert(source_ref='transition-row')

        seen_row = delivery_service.mark_delivery_seen(user=self.user, alert=alert)
        self.assertEqual(seen_row.delivery_state, UserAlertDelivery.DeliveryStateChoices.SEEN)
        self.assertIsNotNone(seen_row.seen_at)

        ack_row = delivery_service.acknowledge_delivery(user=self.user, alert=alert)
        self.assertEqual(ack_row.delivery_state, UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)
        self.assertIsNotNone(ack_row.acknowledged_at)

    def test_upsert_user_alert_preference_updates_scope(self):
        mute_until = timezone.now() + timedelta(minutes=10)
        pref = delivery_service.upsert_user_alert_preference(
            user=self.user,
            symbol='vci',
            alert_family=UnifiedAlert.AlertTypeChoices.WHALE,
            mute_until=mute_until,
            cooldown_seconds=15,
            metadata={'source': 'test'},
        )
        self.assertEqual(pref.symbol, 'VCI')
        self.assertEqual(pref.cooldown_seconds, 15)

        pref2 = delivery_service.upsert_user_alert_preference(
            user=self.user,
            symbol='VCI',
            alert_family=UnifiedAlert.AlertTypeChoices.WHALE,
            mute_until=mute_until + timedelta(minutes=5),
            cooldown_seconds=60,
            metadata={'source': 'update'},
        )
        self.assertEqual(UserAlertPreference.objects.filter(user=self.user, symbol='VCI').count(), 1)
        self.assertEqual(pref2.cooldown_seconds, 60)
        self.assertEqual(pref2.metadata.get('source'), 'update')