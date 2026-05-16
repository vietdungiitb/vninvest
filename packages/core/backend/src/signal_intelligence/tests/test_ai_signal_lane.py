from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import UserProfile
from signal_intelligence.materializers import materialize_ai_signal_alerts
from signal_intelligence.models import OrderFlowEvent
from user_workspace.models import Watchlist, WatchlistItem


class AISignalLaneTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='ai-lane-user', password='password123')
        UserProfile.objects.create(user=self.user, whale_alert_threshold=100)
        watchlist = Watchlist.objects.create(user=self.user, name='AI lane', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='FPT')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_ai_signal_materialization_goes_to_ai_lane_only(self):
        now = timezone.now()
        OrderFlowEvent.objects.create(
            symbol='FPT',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.OTHER,
            side=OrderFlowEvent.SideChoices.NEUTRAL,
            strength=0.8,
            whale_intensity=0.2,
            source_ref='ai-lane-fpt',
            metadata={
                'ai_signal': 'momentum_breakout',
                'title': 'AI breakout FPT',
                'body': 'AI detects momentum breakout',
                'confidence': 0.91,
            },
            triggered_at=now,
        )

        materialize_ai_signal_alerts.run(symbol='FPT')

        ai_feed = self.client.get('/core/v1/signals/ai-alerts/feed')
        self.assertEqual(ai_feed.status_code, 200)
        self.assertEqual(len(ai_feed.json()['results']), 1)
        self.assertIn(ai_feed.json()['results'][0]['alert_type'], ['ai_alert', 'ai_suggest'])

        main_feed = self.client.get('/core/v1/signals/alert-center/feed')
        self.assertEqual(main_feed.status_code, 200)
        self.assertEqual(len(main_feed.json()['results']), 0)
