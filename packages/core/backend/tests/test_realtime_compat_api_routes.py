"""
Core realtime compat route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

import httpx
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from vninvest_core.compat_views import RealtimeLegacyBridgeView


class RealtimeCompatApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='realtime-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_realtime_routes_resolve_to_bridge_view(self):
        self.assertIs(resolve('/api/realtime/ticker/FPT/').func.view_class, RealtimeLegacyBridgeView)
        self.assertIs(resolve('/api/realtime/tickers/').func.view_class, RealtimeLegacyBridgeView)
        self.assertIs(resolve('/api/realtime/symbol-investigation/FPT/').func.view_class, RealtimeLegacyBridgeView)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.legacy_http_bridge.httpx.request')
    def test_realtime_routes_bridge_to_legacy_backend(self, mock_request):
        mock_request.side_effect = [
            httpx.Response(200, json={'symbol': 'FPT', 'source': 'cache'}),
            httpx.Response(200, json={'FPT': {'symbol': 'FPT'}}),
            httpx.Response(200, json={'symbol': 'FPT', 'trades': []}),
            httpx.Response(200, json={'symbol': 'FPT', 'bids': [], 'asks': []}),
            httpx.Response(200, json={'symbol': 'FPT', 'breadth': []}),
            httpx.Response(200, json={'symbol': 'FPT', 'events': []}),
            httpx.Response(200, json={'results': []}),
            httpx.Response(200, json={'symbol': 'FPT', 'buckets': []}),
            httpx.Response(200, json={'symbol': 'FPT', 'levels': []}),
        ]
        auth_header = 'Bearer vni_pat_bridge_test'

        ticker_response = self.client.get('/api/realtime/ticker/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(ticker_response.status_code, status.HTTP_200_OK)

        tickers_response = self.client.get('/api/realtime/tickers/?symbols=FPT', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(tickers_response.status_code, status.HTTP_200_OK)

        intraday_response = self.client.get('/api/realtime/intraday/FPT/?page_size=50', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(intraday_response.status_code, status.HTTP_200_OK)

        price_board_response = self.client.get('/api/realtime/price-board/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(price_board_response.status_code, status.HTTP_200_OK)

        breadth_response = self.client.get('/api/realtime/breadth/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(breadth_response.status_code, status.HTTP_200_OK)

        whale_feed_response = self.client.get('/api/realtime/whale-feed/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(whale_feed_response.status_code, status.HTTP_200_OK)

        investigation_response = self.client.get('/api/realtime/symbol-investigation/FPT/?window=session', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(investigation_response.status_code, status.HTTP_200_OK)

        rvol_response = self.client.get('/api/realtime/rvol/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(rvol_response.status_code, status.HTTP_200_OK)

        depth_chart_response = self.client.get('/api/realtime/depth-chart/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(depth_chart_response.status_code, status.HTTP_200_OK)

        self.assertEqual(mock_request.call_count, 9)
        first_call = mock_request.call_args_list[0].kwargs
        second_call = mock_request.call_args_list[1].kwargs
        seventh_call = mock_request.call_args_list[6].kwargs
        self.assertEqual(first_call['url'], 'http://legacy.internal/api/realtime/ticker/FPT/')
        self.assertEqual(first_call['headers']['Authorization'], auth_header)
        self.assertEqual(first_call['headers']['Host'], 'testserver')
        self.assertEqual(second_call['url'], 'http://legacy.internal/api/realtime/tickers/')
        self.assertEqual(second_call['params'], {'symbols': 'FPT'})
        self.assertEqual(seventh_call['url'], 'http://legacy.internal/api/realtime/symbol-investigation/FPT/')
        self.assertEqual(seventh_call['params'], {'window': 'session'})
