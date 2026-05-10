"""
Native realtime unified-alerts compat tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import datetime
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient
from unittest.mock import patch

from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from user_workspace.models import Watchlist, WatchlistItem
from vninvest_core.compat_views import RealtimeUnifiedAlertsView


class RealtimeUnifiedAlertsNativeApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='alerts-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

        self.watchlist = Watchlist.objects.create(
            user=self.user,
            name='Realtime Watchlist',
            legacy_group_id=77,
        )
        WatchlistItem.objects.create(watchlist=self.watchlist, symbol='FPT')

    def test_unified_alerts_route_resolves_to_native_compat_view(self):
        self.assertIs(resolve('/api/realtime/unified-alerts/').func.view_class, RealtimeUnifiedAlertsView)

    def test_unified_alerts_returns_legacy_contract_from_core_tables(self):
        now = timezone.now()
        whale_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale FPT',
            body='Core whale event',
            value=750000000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='whale-001',
            metadata={'display_score': 88},
        )
        WhaleAlertCanonical.objects.create(
            alert=whale_alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=120000,
            volume=1000,
            matched_value=750000000,
            is_dark_flow=False,
            order_id='order-001',
            executed_at=now,
        )

        dark_flow_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='HPG',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='Dark Flow HPG',
            body='Core dark flow event',
            value=250000000,
            direction=UnifiedAlert.DirectionChoices.NEUTRAL,
            session_date=now.date(),
            triggered_at=now - datetime.timedelta(minutes=1),
            source_ref='dark-flow-001',
            metadata={'source': 'test'},
        )
        OrderFlowEvent.objects.create(
            symbol='HPG',
            session_date=now.date(),
            signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
            side=OrderFlowEvent.SideChoices.NEUTRAL,
            strength=65.0,
            whale_intensity=0.4,
            cvd_at_signal=0.25,
            source_ref='dark-flow-001',
            unified_alert=dark_flow_alert,
            triggered_at=now - datetime.timedelta(minutes=1),
        )

        response = self.client.get('/api/realtime/unified-alerts/?symbols=FPT,HPG&window=session&limit=10&include_market_top_tier=false')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['meta']['contract_version'], '2.0')
        self.assertEqual(response.data['filters']['scope'], 'custom')
        self.assertEqual(response.data['filters']['scope_source'], 'symbols_param')
        self.assertEqual(response.data['filters']['symbols'], ['FPT', 'HPG'])
        self.assertFalse(response.data['has_more'])
        self.assertIsNone(response.data['next_cursor'])
        self.assertEqual(len(response.data['results']), 2)
        sources = {item['source'] for item in response.data['results']}
        self.assertEqual(sources, {'whale', 'dark_flow'})
        whale_row = next(item for item in response.data['results'] if item['source'] == 'whale')
        dark_flow_row = next(item for item in response.data['results'] if item['source'] == 'dark_flow')
        self.assertEqual(whale_row['type'], 'buy')
        self.assertEqual(whale_row['to'], '/whale-alerts/FPT')
        self.assertEqual(dark_flow_row['type'], 'flow')
        self.assertEqual(dark_flow_row['to'], '/stocks/HPG')

    def test_unified_alerts_accepts_watchlist_group_ids_from_core_watchlists(self):
        now = timezone.now()
        whale_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale FPT',
            body='Core whale event',
            value=750000000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='whale-002',
        )
        WhaleAlertCanonical.objects.create(
            alert=whale_alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=120000,
            volume=1000,
            matched_value=750000000,
            is_dark_flow=False,
            order_id='order-002',
            executed_at=now,
        )

        response = self.client.get('/api/realtime/unified-alerts/?watchlist_group_ids=77&window=session&limit=10&include_market_top_tier=false')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'watchlist')
        self.assertEqual(response.data['filters']['watchlist_group_ids'], [77])
        self.assertEqual([item['symbol'] for item in response.data['results']], ['FPT'])

    def test_unified_alerts_respects_severity_min_and_cursor_pagination(self):
        now = timezone.now()
        critical_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.CRITICAL,
            title='Critical whale',
            body='Critical core whale event',
            value=900000000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='whale-critical',
        )
        WhaleAlertCanonical.objects.create(
            alert=critical_alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=120000,
            volume=1000,
            matched_value=900000000,
            is_dark_flow=False,
            order_id='order-critical',
            executed_at=now,
        )
        high_alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='High whale',
            body='High core whale event',
            value=600000000,
            direction=UnifiedAlert.DirectionChoices.SELL,
            session_date=now.date(),
            triggered_at=now - datetime.timedelta(minutes=1),
            source_ref='whale-high',
        )
        WhaleAlertCanonical.objects.create(
            alert=high_alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.SELL,
            price=120000,
            volume=1000,
            matched_value=600000000,
            is_dark_flow=False,
            order_id='order-high',
            executed_at=now - datetime.timedelta(minutes=1),
        )

        critical_only = self.client.get('/api/realtime/unified-alerts/?symbols=FPT&window=session&limit=10&severity_min=critical&include_market_top_tier=false')
        self.assertEqual(critical_only.status_code, status.HTTP_200_OK)
        self.assertEqual(len(critical_only.data['results']), 1)
        self.assertEqual(critical_only.data['results'][0]['severity'], 'critical')

        page_one = self.client.get('/api/realtime/unified-alerts/?symbols=FPT&window=session&limit=1&severity_min=low&include_market_top_tier=false')
        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertTrue(page_one.data['has_more'])
        self.assertIsNotNone(page_one.data['next_cursor'])
        first_event_id = page_one.data['results'][0]['event_id']

        page_two = self.client.get(
            f"/api/realtime/unified-alerts/?symbols=FPT&window=session&limit=1&severity_min=low&include_market_top_tier=false&cursor={page_one.data['next_cursor']}"
        )
        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_two.data['results']), 1)
        self.assertNotEqual(first_event_id, page_two.data['results'][0]['event_id'])

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_unified_alerts_falls_back_to_legacy_bridge_when_core_scope_is_empty(self, mock_bridge):
        mock_bridge.return_value = Response(
            {
                'results': [
                    {
                        'event_id': 'legacy-1',
                        'symbol': 'FPT',
                        'source': 'whale',
                        'severity': 'high',
                        'type': 'buy',
                        'headline': 'Legacy whale',
                        'detail': 'Legacy payload',
                        'ts': timezone.now().isoformat(),
                        'to': '/whale-alerts/FPT',
                    }
                ],
                'meta': {'contract_version': '2.0'},
                'filters': {'scope': 'custom', 'scope_source': 'symbols_param'},
                'next_cursor': None,
                'has_more': False,
            },
            status=status.HTTP_200_OK,
        )

        response = self.client.get('/api/realtime/unified-alerts/?symbols=FPT&window=session&limit=5&severity_min=low')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'][0]['event_id'], 'legacy-1')
        mock_bridge.assert_called_once()