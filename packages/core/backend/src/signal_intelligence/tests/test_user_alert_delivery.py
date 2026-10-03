from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import UserProfile
from signal_intelligence.models import UnifiedAlert, UserAlertDelivery
from signal_intelligence.tests.envelope import unwrapped_json
from user_workspace.models import Watchlist, WatchlistItem


class UserAlertDeliveryAPITests(TestCase):
    def setUp(self):
        self.user_a = get_user_model().objects.create_user(username='delivery-user-a', password='password123')
        self.user_b = get_user_model().objects.create_user(username='delivery-user-b', password='password123')
        UserProfile.objects.create(user=self.user_a, whale_alert_threshold=100)
        UserProfile.objects.create(user=self.user_b, whale_alert_threshold=100)

        watchlist_a = Watchlist.objects.create(user=self.user_a, name='A', is_default=True)
        watchlist_b = Watchlist.objects.create(user=self.user_b, name='B', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist_a, symbol='VCI')
        WatchlistItem.objects.create(watchlist=watchlist_b, symbol='SSI')

        self.alert_vci = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            freshness_state='fresh',
            title='Whale VCI',
            body='',
            value=Decimal('1000000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=timezone.now().date(),
            triggered_at=timezone.now(),
            source_ref='delivery-vci',
            evidence={'source': 'test'},
        )

    def test_cross_user_ack_is_blocked_by_scope(self):
        client_b = APIClient()
        client_b.force_authenticate(user=self.user_b)

        response = client_b.post(f'/core/v1/signals/alert-center/events/{self.alert_vci.alert_id}/ack')
        self.assertEqual(response.status_code, 404)

    def test_ack_and_mute_flow_for_user_scope(self):
        client_a = APIClient()
        client_a.force_authenticate(user=self.user_a)

        ack_response = client_a.post(f'/core/v1/signals/alert-center/events/{self.alert_vci.alert_id}/ack')
        self.assertEqual(ack_response.status_code, 200)
        self.assertEqual(unwrapped_json(ack_response)['delivery_state'], 'acknowledged')
        self.assertTrue(UserAlertDelivery.objects.filter(user=self.user_a, alert=self.alert_vci, delivery_state='acknowledged').exists())

        mute_response = client_a.post(
            '/core/v1/signals/alert-center/preferences/mute',
            data={'symbol': 'VCI', 'alert_family': 'whale', 'mute_minutes': 15},
            format='json',
        )
        self.assertEqual(mute_response.status_code, 200)

        feed_response = client_a.get('/core/v1/signals/alert-center/feed')
        self.assertEqual(feed_response.status_code, 200)
        self.assertEqual(len(feed_response.json()['results']), 0)
