from datetime import timedelta
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

    def test_timeframe_filter_5m_applies_consistently(self):
        recent = self._create_alert(symbol='VCI', source_ref='api-recent-alert')
        old = self._create_alert(symbol='VCI', source_ref='api-old-alert')
        UnifiedAlert.objects.filter(pk=old.pk).update(triggered_at=timezone.now() - timedelta(minutes=30))

        feed = self.client.get('/core/v1/signals/alert-center/feed', {'timeframe': '5m'})
        self.assertEqual(feed.status_code, 200)
        feed_ids = {item['alert_id'] for item in feed.json().get('results', [])}
        self.assertIn(str(recent.alert_id), feed_ids)
        self.assertNotIn(str(old.alert_id), feed_ids)

        summary = self.client.get('/core/v1/signals/alert-center/summary', {'timeframe': '5m'})
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()['total'], 1)

    def test_symbol_stats_matches_summary_scope_main_lane(self):
        self._create_alert(symbol='VCI', source_ref='api-main-vci-1')
        self._create_alert(symbol='VCI', source_ref='api-main-vci-2')
        self._create_alert(symbol='FPT', source_ref='api-main-fpt-1')

        summary = self.client.get('/core/v1/signals/alert-center/summary', {'timeframe': 'session'})
        self.assertEqual(summary.status_code, 200)
        summary_total = int(summary.json().get('total') or 0)

        symbol_stats = self.client.get('/core/v1/signals/alert-center/symbol-stats', {'timeframe': 'session'})
        self.assertEqual(symbol_stats.status_code, 200)
        symbol_stats_json = symbol_stats.json()
        self.assertEqual(int(symbol_stats_json.get('total_alerts_in_scope') or 0), summary_total)

        symbols = symbol_stats_json.get('symbols') or []
        self.assertEqual(sum(int(item.get('count') or 0) for item in symbols), summary_total)
        self.assertIn('VCI', {item.get('symbol') for item in symbols})
        self.assertNotIn('FPT', {item.get('symbol') for item in symbols})

    def test_symbol_stats_matches_summary_scope_ai_lane(self):
        self._create_alert(
            symbol='VCI',
            alert_type=UnifiedAlert.AlertTypeChoices.AI_ALERT,
            source_ref='api-ai-vci-1',
        )
        self._create_alert(
            symbol='FPT',
            alert_type=UnifiedAlert.AlertTypeChoices.AI_SUGGEST,
            source_ref='api-ai-fpt-1',
        )

        summary = self.client.get('/core/v1/signals/ai-alerts/summary', {'timeframe': 'session'})
        self.assertEqual(summary.status_code, 200)
        summary_total = int(summary.json().get('total') or 0)

        symbol_stats = self.client.get('/core/v1/signals/ai-alerts/symbol-stats', {'timeframe': 'session'})
        self.assertEqual(symbol_stats.status_code, 200)
        symbol_stats_json = symbol_stats.json()
        self.assertEqual(int(symbol_stats_json.get('total_alerts_in_scope') or 0), summary_total)

        symbols = symbol_stats_json.get('symbols') or []
        self.assertEqual(sum(int(item.get('count') or 0) for item in symbols), summary_total)
        self.assertIn('VCI', {item.get('symbol') for item in symbols})
        self.assertNotIn('FPT', {item.get('symbol') for item in symbols})
