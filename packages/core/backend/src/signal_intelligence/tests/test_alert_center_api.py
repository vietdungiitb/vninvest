from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import UserProfile
from signal_intelligence.models import UnifiedAlert
from user_workspace.models import Watchlist, WatchlistItem


class AlertCenterAPITests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='alert-center-api-user', password='password123')
        UserProfile.objects.create(user=self.user, whale_alert_threshold=100)
        watchlist = Watchlist.objects.create(user=self.user, name='Theo doi API', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_alert(self, *, symbol='VCI', alert_type=UnifiedAlert.AlertTypeChoices.WHALE, source_ref='api-alert'):
        now = timezone.now()
        return UnifiedAlert.objects.create(
            alert_type=alert_type,
            symbol=symbol,
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.9,
            freshness_state='fresh',
            title='Alert API',
            body='Body API',
            value=Decimal('1000000000') if alert_type in {UnifiedAlert.AlertTypeChoices.WHALE, UnifiedAlert.AlertTypeChoices.DARK_FLOW} else None,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref=source_ref,
            evidence={'source': 'test'},
        )

    def test_feed_summary_detail_context_endpoints(self):
        alert = self._create_alert(source_ref='api-main-alert')

        feed = self.client.get('/core/v1/signals/alert-center/feed')
        self.assertEqual(feed.status_code, 200)
        self.assertEqual(len(feed.json()['results']), 1)

        summary = self.client.get('/core/v1/signals/alert-center/summary')
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()['total'], 1)

        detail = self.client.get(f'/core/v1/signals/alert-center/events/{alert.alert_id}')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()['alert_id'], str(alert.alert_id))

        context = self.client.get('/core/v1/signals/alert-center/symbols/VCI/context')
        self.assertEqual(context.status_code, 200)
        self.assertEqual(context.json()['symbol'], 'VCI')
        self.assertEqual(context.json()['total'], 1)

    def test_ai_feed_and_ai_summary_lane(self):
        self._create_alert(
            alert_type=UnifiedAlert.AlertTypeChoices.AI_ALERT,
            source_ref='api-ai-alert',
        )

        ai_feed = self.client.get('/core/v1/signals/ai-alerts/feed')
        self.assertEqual(ai_feed.status_code, 200)
        self.assertEqual(len(ai_feed.json()['results']), 1)

        ai_summary = self.client.get('/core/v1/signals/ai-alerts/summary')
        self.assertEqual(ai_summary.status_code, 200)
        self.assertEqual(ai_summary.json()['total'], 1)
