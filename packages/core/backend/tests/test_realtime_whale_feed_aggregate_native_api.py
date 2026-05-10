"""
Native realtime whale-feed aggregate compat tests.

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

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical
from user_workspace.models import Watchlist, WatchlistItem
from vninvest_core.compat_views import RealtimeWhaleFeedAggregateView


class RealtimeWhaleFeedAggregateNativeApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='whale-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

        CoreTenant.objects.create(
            owner_user=self.user,
            public_id='tenant-whale-aggregate',
            tenant_code='tenant-whale-aggregate',
            display_name='Whale Aggregate Tenant',
            plan=CoreTenant.PlanChoices.PRO,
        )

        self.watchlist = Watchlist.objects.create(
            user=self.user,
            name='Whale Watchlist',
            legacy_group_id=88,
        )
        WatchlistItem.objects.create(watchlist=self.watchlist, symbol='FPT')

    def test_whale_feed_aggregate_route_resolves_to_native_compat_view(self):
        self.assertIs(
            resolve('/api/realtime/whale-feed/aggregate/').func.view_class,
            RealtimeWhaleFeedAggregateView,
        )

    def test_whale_feed_aggregate_returns_legacy_contract_from_core_tables(self):
        now = timezone.now()
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Whale FPT',
            body='Core whale aggregate event',
            value=900000000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='evt-001',
            metadata={
                'event_id': 'evt-001',
                'threshold': 500000000,
                'threshold_source': 'user_default',
                'display_score': 87,
                'event_score': 84,
                'weights_version': 'weights-v1',
                'size_class': 'whale',
                'source': 'canonical_event_store',
            },
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=120000,
            volume=9000,
            matched_value=900000000,
            is_dark_flow=False,
            order_id='order-001',
            executed_at=now,
        )

        response = self.client.get('/api/realtime/whale-feed/aggregate/?symbols=FPT&sort=ts&window=session&limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'canonical_event_store')
        self.assertEqual(response.data['weights_version'], 'weights-v1')
        self.assertEqual(response.data['meta']['contract_version'], '1.1')
        self.assertEqual(response.data['filters']['scope'], 'custom')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertTrue(response.data['entitlements']['can_read_whale_advisory'])
        self.assertFalse(response.data['entitlements']['can_read_whale_advisory_detail'])
        self.assertEqual(len(response.data['results']), 1)
        result = response.data['results'][0]
        self.assertEqual(result['symbol'], 'FPT')
        self.assertEqual(result['side'], 'buy')
        self.assertEqual(result['matched_value'], 900000000.0)
        self.assertEqual(result['display_score'], 87)
        self.assertEqual(result['event_score'], 84)
        self.assertEqual(result['threshold_source'], 'user_default')

    def test_whale_feed_aggregate_accepts_watchlist_group_ids_from_core_watchlists(self):
        now = timezone.now()
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            title='Whale watchlist FPT',
            body='',
            value=700000000,
            direction=UnifiedAlert.DirectionChoices.SELL,
            session_date=now.date(),
            triggered_at=now,
            source_ref='evt-watchlist',
            metadata={'event_id': 'evt-watchlist'},
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.SELL,
            price=118000,
            volume=7000,
            matched_value=700000000,
            is_dark_flow=False,
            order_id='order-watchlist',
            executed_at=now,
        )

        response = self.client.get('/api/realtime/whale-feed/aggregate/?watchlist_group_ids=88&sort=ts')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'watchlist')
        self.assertEqual(response.data['filters']['watchlist_group_ids'], [88])
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(len(response.data['results']), 1)

    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_whale_feed_aggregate_defaults_to_tracked_symbols_via_legacy_bridge_input(self, mock_bridge):
        now = timezone.now()
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='FPT',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Tracked whale FPT',
            body='',
            value=910000000,
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='evt-tracked',
            metadata={'event_id': 'evt-tracked'},
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='FPT',
            session_date=now.date(),
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=121000,
            volume=9100,
            matched_value=910000000,
            is_dark_flow=False,
            order_id='order-tracked',
            executed_at=now,
        )

        def _bridge_side_effect(request, legacy_path, **kwargs):
            if legacy_path == '/api/stock-management/tracked-symbols/':
                return Response([{'symbol': 'FPT'}, {'symbol': '   '}], status=status.HTTP_200_OK)
            return None

        mock_bridge.side_effect = _bridge_side_effect

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=session')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['scope_source'], 'default_tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(mock_bridge.call_count, 1)
        self.assertEqual(mock_bridge.call_args.args[1], '/api/stock-management/tracked-symbols/')

    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_whale_feed_aggregate_returns_native_empty_for_default_tracked_scope_without_route_fallback(self, mock_bridge):
        def _bridge_side_effect(request, legacy_path, **kwargs):
            if legacy_path == '/api/stock-management/tracked-symbols/':
                return Response([{'symbol': 'FPT'}], status=status.HTTP_200_OK)
            return Response({'results': [{'symbol': 'LEGACY'}], 'source': 'legacy'}, status=status.HTTP_200_OK)

        mock_bridge.side_effect = _bridge_side_effect

        response = self.client.get('/api/realtime/whale-feed/aggregate/?window=session')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'canonical_event_store')
        self.assertEqual(response.data['filters']['scope'], 'tracked')
        self.assertEqual(response.data['filters']['scope_source'], 'default_tracked')
        self.assertEqual(response.data['filters']['symbols'], ['FPT'])
        self.assertEqual(response.data['results'], [])
        self.assertEqual(mock_bridge.call_count, 1)
        self.assertEqual(mock_bridge.call_args.args[1], '/api/stock-management/tracked-symbols/')

    def test_whale_feed_aggregate_respects_matched_value_cursor_pagination(self):
        base_time = timezone.now()
        values = [950000000, 850000000, 750000000]
        for index, matched_value in enumerate(values, start=1):
            alert = UnifiedAlert.objects.create(
                alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
                symbol='FPT',
                severity=UnifiedAlert.SeverityChoices.HIGH,
                title=f'Whale {index}',
                body='',
                value=matched_value,
                direction=UnifiedAlert.DirectionChoices.BUY,
                session_date=base_time.date(),
                triggered_at=base_time - datetime.timedelta(minutes=index),
                source_ref=f'evt-{index}',
                metadata={'event_id': f'evt-{index}'},
            )
            WhaleAlertCanonical.objects.create(
                alert=alert,
                symbol='FPT',
                session_date=base_time.date(),
                side=WhaleAlertCanonical.SideChoices.BUY,
                price=120000,
                volume=5000 + index,
                matched_value=matched_value,
                is_dark_flow=False,
                order_id=f'order-{index}',
                executed_at=base_time - datetime.timedelta(minutes=index),
            )

        page_one = self.client.get('/api/realtime/whale-feed/aggregate/?symbols=FPT&sort=matched_value&limit=2')

        self.assertEqual(page_one.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_one.data['results']), 2)
        self.assertTrue(page_one.data['has_more'])
        page_one_ids = [item['id'] for item in page_one.data['results']]

        page_two = self.client.get(
            f"/api/realtime/whale-feed/aggregate/?symbols=FPT&sort=matched_value&limit=2&cursor={page_one.data['next_cursor']}"
        )

        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page_two.data['results']), 1)
        self.assertFalse(page_two.data['has_more'])
        self.assertNotIn(page_two.data['results'][0]['id'], page_one_ids)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.compat_views.legacy_bridge_response')
    def test_whale_feed_aggregate_falls_back_to_legacy_bridge_when_core_scope_is_empty(self, mock_bridge):
        mock_bridge.return_value = Response({'results': [{'symbol': 'FPT'}], 'source': 'legacy'}, status=status.HTTP_200_OK)

        response = self.client.get('/api/realtime/whale-feed/aggregate/?symbols=FPT&limit=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['source'], 'legacy')
        mock_bridge.assert_called_once()