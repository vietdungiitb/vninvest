"""
Core-native stock-management compat route tests.

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

from vninvest_core.compat_views import StockManagementGroupsView, StockManagementSeedView


class StockManagementCompatApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='stock-management-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

    @override_settings(LEGACY_BACKEND_URL='')
    def test_seed_populates_groups_and_groups_view_returns_renderable_shape(self):
        resolver_groups = resolve('/api/stock-management/groups/')
        self.assertIs(resolver_groups.func.view_class, StockManagementGroupsView)

        resolver_seed = resolve('/api/stock-management/seed/')
        self.assertIs(resolver_seed.func.view_class, StockManagementSeedView)

        seed_response = self.client.post('/api/stock-management/seed/', {}, format='json')
        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)
        self.assertIn('nhóm', seed_response.data['message'].lower())

        groups_response = self.client.get('/api/stock-management/groups/')
        self.assertEqual(groups_response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(groups_response.data), 0)

        first_group = groups_response.data[0]
        self.assertIn('group_type', first_group)
        self.assertIn('color', first_group)
        self.assertIn('order', first_group)
        self.assertIsInstance(first_group['items'], list)
        self.assertGreater(len(first_group['items']), 0)

        first_item = first_group['items'][0]
        self.assertIn('symbol', first_item)
        self.assertIn('current_price', first_item)
        self.assertIn('change_pct', first_item)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.legacy_http_bridge.httpx.request')
    def test_groups_seed_sync_and_remaining_stock_routes_bridge_to_legacy(self, mock_request):
        mock_request.side_effect = [
            httpx.Response(200, json=[{'id': 1, 'name': 'VN30', 'items': [{'symbol': 'FPT'}]}]),
            httpx.Response(200, json={'created': [{'group': 'VN30'}], 'message': 'ok'}),
            httpx.Response(200, json={'synced': ['FPT'], 'total_symbols': 1}),
            httpx.Response(200, json={'results': [{'symbol': 'FPT', 'rsi': 65.0}]}),
            httpx.Response(200, json={'symbol': 'FPT'}),
            httpx.Response(200, json={'symbol': 'FPT', 'overview': {'tracked': True}}),
            httpx.Response(200, json={'candles': []}),
            httpx.Response(200, json={'results': []}),
            httpx.Response(200, json={'results': []}),
            httpx.Response(200, json={'summary': 'ok'}),
            httpx.Response(200, json={'session': {'symbol': 'FPT'}}),
            httpx.Response(200, json={'trace': []}),
            httpx.Response(200, json={'task_id': 'job-1'}),
            httpx.Response(200, json={'deleted': True}),
            httpx.Response(200, json={'refreshed': True}),
            httpx.Response(200, json={'component': {'id': 5}}),
            httpx.Response(200, json={'digest': []}),
        ]
        auth_header = 'Bearer vni_pat_bridge_test'

        groups_response = self.client.get('/api/stock-management/groups/?page=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(groups_response.status_code, status.HTTP_200_OK)
        self.assertEqual(groups_response.data[0]['name'], 'VN30')

        seed_response = self.client.post('/api/stock-management/seed/', {}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)

        sync_response = self.client.post('/api/stock-management/sync/', {'days': 5}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(sync_response.status_code, status.HTTP_200_OK)

        technicals_response = self.client.post('/api/stock-management/technicals/bulk/', {'symbols': ['FPT']}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(technicals_response.status_code, status.HTTP_200_OK)

        profile_response = self.client.get('/api/stock-management/stocks/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)

        overview_response = self.client.get('/api/stock-management/stocks/FPT/overview/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(overview_response.status_code, status.HTTP_200_OK)

        chart_response = self.client.get('/api/stock-management/stocks/FPT/chart/?days=30&timeframe=1D', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(chart_response.status_code, status.HTTP_200_OK)

        order_flow_response = self.client.get('/api/stock-management/stocks/FPT/order-flow/?window=30m', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(order_flow_response.status_code, status.HTTP_200_OK)

        news_response = self.client.get('/api/stock-management/stocks/FPT/news/?force=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(news_response.status_code, status.HTTP_200_OK)

        summary_response = self.client.post('/api/stock-management/stocks/FPT/news/ai-summary/', {'force_refresh': True}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)

        advisory_response = self.client.get('/api/stock-management/stocks/FPT/ai-advisory-session/?contract=v2', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(advisory_response.status_code, status.HTTP_200_OK)

        observability_response = self.client.get('/api/stock-management/stocks/FPT/ai-advisory-observability/?limit=5', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(observability_response.status_code, status.HTTP_200_OK)

        generate_component_response = self.client.post('/api/stock-management/stocks/FPT/ai-advisory-components/generate/', {'mode': 'manual'}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(generate_component_response.status_code, status.HTTP_200_OK)

        clear_deleted_response = self.client.delete('/api/stock-management/stocks/FPT/ai-advisory-components/deleted/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(clear_deleted_response.status_code, status.HTTP_200_OK)

        regenerate_summary_response = self.client.post('/api/stock-management/stocks/FPT/ai-advisory-summary/regenerate/', {'force': True}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(regenerate_summary_response.status_code, status.HTTP_200_OK)

        toggle_component_response = self.client.post('/api/stock-management/ai-advisory-components/5/toggle-include/', {}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(toggle_component_response.status_code, status.HTTP_200_OK)

        portfolio_digest_response = self.client.get('/api/stock-management/portfolio/news-digest/?page=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(portfolio_digest_response.status_code, status.HTTP_200_OK)

        self.assertEqual(mock_request.call_count, 17)
        first_call = mock_request.call_args_list[0].kwargs
        fourth_call = mock_request.call_args_list[3].kwargs
        sixteenth_call = mock_request.call_args_list[15].kwargs
        seventeenth_call = mock_request.call_args_list[16].kwargs
        self.assertEqual(first_call['url'], 'http://legacy.internal/api/stock-management/groups/')
        self.assertEqual(first_call['params'], {'page': '1'})
        self.assertEqual(first_call['headers']['Authorization'], auth_header)
        self.assertEqual(first_call['headers']['Host'], 'testserver')
        self.assertEqual(fourth_call['url'], 'http://legacy.internal/api/stock-management/technicals/bulk/')
        self.assertEqual(fourth_call['json'], {'symbols': ['FPT']})
        self.assertEqual(sixteenth_call['url'], 'http://legacy.internal/api/stock-management/ai-advisory-components/5/toggle-include/')
        self.assertEqual(seventeenth_call['url'], 'http://legacy.internal/api/stock-management/portfolio/news-digest/')
        self.assertEqual(seventeenth_call['params'], {'page': '1'})

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal')
    @patch('vninvest_core.legacy_http_bridge.httpx.request')
    def test_stock_management_compat_detail_and_price_alert_routes_bridge_to_legacy(self, mock_request):
        mock_request.side_effect = [
            httpx.Response(200, json={'id': 7, 'symbol': 'FPT', 'whale_alert_threshold_million': 250}),
            httpx.Response(204),
            httpx.Response(200, json={'updated_count': 1, 'rows': [{'id': 7, 'symbol': 'FPT'}]}),
            httpx.Response(200, json=[{'id': 11, 'symbol': 'FPT', 'condition': 'gte'}]),
            httpx.Response(201, json={'id': 12, 'symbol': 'VCB', 'condition': 'gte'}),
            httpx.Response(200, json={'id': 11, 'symbol': 'FPT', 'is_active': False}),
            httpx.Response(204),
            httpx.Response(200, json={'id': 11, 'symbol': 'FPT', 'is_triggered': True}),
        ]
        auth_header = 'Bearer vni_pat_bridge_test'

        tracked_patch_response = self.client.patch(
            '/api/stock-management/tracked-symbols/7/',
            {'whale_alert_threshold_million': 250},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(tracked_patch_response.status_code, status.HTTP_200_OK)

        tracked_delete_response = self.client.delete(
            '/api/stock-management/tracked-symbols/7/',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(tracked_delete_response.status_code, status.HTTP_204_NO_CONTENT)

        tracked_bulk_response = self.client.post(
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            {'tracked_symbol_ids': [7], 'whale_alert_threshold_million': 250},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(tracked_bulk_response.status_code, status.HTTP_200_OK)

        price_alert_list_response = self.client.get(
            '/api/stock-management/price-alerts/?page=1',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(price_alert_list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(price_alert_list_response.data[0]['symbol'], 'FPT')

        price_alert_create_response = self.client.post(
            '/api/stock-management/price-alerts/',
            {'symbol': 'VCB', 'condition': 'gte', 'target_price': 100000},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(price_alert_create_response.status_code, status.HTTP_201_CREATED)

        price_alert_patch_response = self.client.patch(
            '/api/stock-management/price-alerts/11/',
            {'is_active': False},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(price_alert_patch_response.status_code, status.HTTP_200_OK)

        price_alert_delete_response = self.client.delete(
            '/api/stock-management/price-alerts/11/',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(price_alert_delete_response.status_code, status.HTTP_204_NO_CONTENT)

        price_alert_trigger_response = self.client.post(
            '/api/stock-management/price-alerts/11/mark-triggered/',
            {},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertEqual(price_alert_trigger_response.status_code, status.HTTP_200_OK)

        self.assertEqual(mock_request.call_count, 8)
        first_call = mock_request.call_args_list[0].kwargs
        fourth_call = mock_request.call_args_list[3].kwargs
        self.assertEqual(first_call['url'], 'http://legacy.internal/api/stock-management/tracked-symbols/7/')
        self.assertEqual(first_call['headers']['Authorization'], auth_header)
        self.assertEqual(first_call['headers']['Host'], 'testserver')
        self.assertEqual(fourth_call['url'], 'http://legacy.internal/api/stock-management/price-alerts/')
        self.assertEqual(fourth_call['params'], {'page': '1'})
