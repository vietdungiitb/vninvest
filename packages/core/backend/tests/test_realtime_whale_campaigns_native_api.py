"""
Native realtime whale-campaigns compat tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from datetime import timedelta

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical
from vninvest_core.compat_views import RealtimeWhaleCampaignsView


class RealtimeWhaleCampaignsNativeApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='whale-campaign-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

        CoreTenant.objects.create(
            owner_user=self.user,
            public_id='tenant-whale-campaigns',
            tenant_code='tenant-whale-campaigns',
            display_name='Whale Campaign Tenant',
            plan=CoreTenant.PlanChoices.PRO,
        )

    def _create_whale_event(self, *, symbol, matched_value, executed_at, side, event_id):
        direction = UnifiedAlert.DirectionChoices.BUY if side == 'buy' else UnifiedAlert.DirectionChoices.SELL
        whale_side = WhaleAlertCanonical.SideChoices.BUY if side == 'buy' else WhaleAlertCanonical.SideChoices.SELL
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol=symbol,
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title=f'Whale {symbol} {event_id}',
            body='',
            value=matched_value,
            direction=direction,
            session_date=executed_at.date(),
            triggered_at=executed_at,
            source_ref=event_id,
            metadata={
                'event_id': event_id,
                'threshold': 500000000,
                'threshold_source': 'user_default',
                'display_score': 88,
                'event_score': 92,
                'weights_version': 'weights-v2',
                'source': 'canonical_event_store',
            },
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol=symbol,
            session_date=executed_at.date(),
            side=whale_side,
            price=120000,
            volume=max(int(matched_value / 120000), 1),
            matched_value=matched_value,
            is_dark_flow=False,
            order_id=f'order-{event_id}',
            executed_at=executed_at,
        )

    def _tracked_bridge_side_effect(self, symbols):
        tracked_payload = [{'symbol': symbol} for symbol in symbols]

        def _bridge_side_effect(request, legacy_path, **kwargs):
            if legacy_path == '/api/stock-management/tracked-symbols/':
                return Response(tracked_payload, status=status.HTTP_200_OK)
            return None

        return _bridge_side_effect

    def test_whale_campaigns_route_resolves_to_native_compat_view(self):
        self.assertIs(
            resolve('/api/realtime/whale-campaigns/').func.view_class,
            RealtimeWhaleCampaignsView,
        )

    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_whale_campaigns_groups_core_events_into_native_campaigns(self, mock_bridge):
        base_time = timezone.now()
        self._create_whale_event(
            symbol='FPT',
            matched_value=910000000,
            executed_at=base_time - timedelta(minutes=15),
            side='buy',
            event_id='evt-fpt-1',
        )
        self._create_whale_event(
            symbol='FPT',
            matched_value=870000000,
            executed_at=base_time - timedelta(minutes=9),
            side='buy',
            event_id='evt-fpt-2',
        )
        self._create_whale_event(
            symbol='HPG',
            matched_value=760000000,
            executed_at=base_time - timedelta(minutes=3),
            side='sell',
            event_id='evt-hpg-1',
        )
        mock_bridge.side_effect = self._tracked_bridge_side_effect(['FPT', 'HPG'])

        response = self.client.get('/api/realtime/whale-campaigns/?window=5d&campaign_limit=10&campaign_sort=strength')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'canonical_event_store')
        self.assertEqual(response.data['weights_version'], 'weights-v2')
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['scope_source'], 'default_tracked')
        self.assertEqual(response.data['filters']['campaign_sort'], 'strength')
        self.assertEqual(response.data['meta']['contract_version'], '1.0')
        self.assertEqual(len(response.data['results']), 2)
        first_campaign = response.data['results'][0]
        self.assertEqual(first_campaign['symbol'], 'FPT')
        self.assertEqual(first_campaign['campaign_type'], 'accumulation')
        self.assertEqual(first_campaign['event_count'], 2)
        self.assertGreater(first_campaign['campaign_strength'], 0)
        self.assertEqual(len(first_campaign['events']), 2)
        self.assertEqual(mock_bridge.call_count, 1)
        self.assertEqual(mock_bridge.call_args.args[1], '/api/stock-management/tracked-symbols/')

    def test_whale_campaigns_reject_invalid_campaign_limit(self):
        response = self.client.get('/api/realtime/whale-campaigns/?campaign_limit=0')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('campaign_limit', response.data['detail'])

    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_whale_campaigns_support_cursor_pagination(self, mock_bridge):
        base_time = timezone.now()
        self._create_whale_event(
            symbol='FPT',
            matched_value=910000000,
            executed_at=base_time - timedelta(minutes=20),
            side='buy',
            event_id='evt-page-fpt-1',
        )
        self._create_whale_event(
            symbol='FPT',
            matched_value=860000000,
            executed_at=base_time - timedelta(minutes=14),
            side='buy',
            event_id='evt-page-fpt-2',
        )
        self._create_whale_event(
            symbol='HPG',
            matched_value=830000000,
            executed_at=base_time - timedelta(minutes=5),
            side='sell',
            event_id='evt-page-hpg-1',
        )
        self._create_whale_event(
            symbol='HPG',
            matched_value=810000000,
            executed_at=base_time - timedelta(minutes=2),
            side='sell',
            event_id='evt-page-hpg-2',
        )
        mock_bridge.side_effect = self._tracked_bridge_side_effect(['FPT', 'HPG'])

        first_response = self.client.get('/api/realtime/whale-campaigns/?window=5d&campaign_limit=1&campaign_sort=latest')

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first_response.data['results']), 1)
        self.assertTrue(first_response.data['has_more'])
        self.assertIsNotNone(first_response.data['next_cursor'])
        first_campaign_id = first_response.data['results'][0]['campaign_id']

        second_response = self.client.get(
            f"/api/realtime/whale-campaigns/?window=5d&campaign_limit=1&campaign_sort=latest&cursor={first_response.data['next_cursor']}"
        )

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second_response.data['results']), 1)
        self.assertNotEqual(second_response.data['results'][0]['campaign_id'], first_campaign_id)

    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_whale_campaigns_return_native_empty_for_default_tracked_scope_without_route_fallback(self, mock_bridge):
        mock_bridge.side_effect = self._tracked_bridge_side_effect(['FPT'])

        response = self.client.get('/api/realtime/whale-campaigns/?window=session')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'canonical_event_store')
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['scope_source'], 'default_tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(response.data['results'], [])
        self.assertEqual(mock_bridge.call_count, 1)
        self.assertEqual(mock_bridge.call_args.args[1], '/api/stock-management/tracked-symbols/')