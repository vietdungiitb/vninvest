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

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from market_data.tests.envelope import unwrapped
from market_data.models import StockProfile
from market_data.stock_mgmt_native_views import (
    StockManagementGroupsView,
    StockManagementPriceAlertDetailView,
    StockManagementPriceAlertTriggerView,
    StockManagementPriceAlertsView,
    StockManagementSeedView,
    StockManagementTrackedSymbolBulkThresholdView,
    StockManagementTrackedSymbolDetailView,
    StockManagementTrackedSymbolsView,
)


class StockManagementCompatApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='stock-management-owner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-mgmt-tenant-1',
            display_name='Stock Management Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corporation',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Technology',
            status=StockProfile.StatusChoices.ACTIVE,
        )

    @override_settings(LEGACY_BACKEND_URL='')
    def test_seed_populates_groups_and_groups_view_returns_renderable_shape(self):
        resolver_groups = resolve('/core/v1/stock-management/groups/')
        self.assertIs(resolver_groups.func.view_class, StockManagementGroupsView)

        resolver_seed = resolve('/core/v1/stock-management/seed/')
        self.assertIs(resolver_seed.func.view_class, StockManagementSeedView)

        seed_response = self.client.post('/core/v1/stock-management/seed/', {}, format='json')
        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)
        self.assertIn('nhóm', unwrapped(seed_response)['message'].lower())

        groups_response = self.client.get('/core/v1/stock-management/groups/')
        self.assertEqual(groups_response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(unwrapped(groups_response)), 0)

        first_group = unwrapped(groups_response)[0]
        self.assertIn('group_type', first_group)
        self.assertIn('color', first_group)
        self.assertIn('order', first_group)
        self.assertIsInstance(first_group['items'], list)
        self.assertGreater(len(first_group['items']), 0)

        first_item = first_group['items'][0]
        self.assertIn('symbol', first_item)
        self.assertIn('current_price', first_item)
        self.assertIn('change_pct', first_item)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal', CELERY_TASK_ALWAYS_EAGER=True)
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', return_value=[{'symbol': 'FPT', 'source': 'native'}])
    @patch('data_ingest.tasks.run_global_market_data_planner.apply_async')
    def test_groups_seed_sync_and_remaining_stock_routes_are_native(self, mock_apply_async, fetch_price_board_snapshot_mock):
        mock_apply_async.return_value.id = 'planner-task-1'
        auth_header = 'Bearer vni_pat_bridge_test'

        groups_response = self.client.get('/core/v1/stock-management/groups/?page=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(groups_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(unwrapped(groups_response), list)

        seed_response = self.client.post('/core/v1/stock-management/seed/', {}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)

        sync_response = self.client.post('/core/v1/stock-management/sync/', {'days': 5}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(sync_response.status_code, status.HTTP_200_OK)
        mock_apply_async.assert_called_once()

        tracked_list_response = self.client.get('/core/v1/stock-management/tracked-symbols/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(tracked_list_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(unwrapped(tracked_list_response), list)

        price_alert_list_response = self.client.get('/core/v1/stock-management/price-alerts/?page=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(price_alert_list_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(unwrapped(price_alert_list_response), list)

        technicals_response = self.client.post('/core/v1/stock-management/technicals/bulk/', {'symbols': ['FPT']}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(technicals_response.status_code, status.HTTP_200_OK)

        profile_response = self.client.get('/core/v1/stock-management/stocks/FPT/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)

        overview_response = self.client.get('/core/v1/stock-management/stocks/FPT/overview/', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(overview_response.status_code, status.HTTP_200_OK)

        chart_response = self.client.get('/core/v1/stock-management/stocks/FPT/chart/?days=30&timeframe=1D', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(chart_response.status_code, status.HTTP_200_OK)

        order_flow_response = self.client.get('/core/v1/stock-management/stocks/FPT/order-flow/?window=30m', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(order_flow_response.status_code, status.HTTP_200_OK)

        news_response = self.client.get('/core/v1/stock-management/stocks/FPT/news/?force=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(news_response.status_code, status.HTTP_200_OK)

        summary_response = self.client.post('/core/v1/stock-management/stocks/FPT/news/ai-summary/', {'force_refresh': True}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)

        advisory_response = self.client.get('/core/v1/stock-management/stocks/FPT/ai-advisory-session/?contract=v2', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(advisory_response.status_code, status.HTTP_200_OK)

        observability_response = self.client.get('/core/v1/stock-management/stocks/FPT/ai-advisory-observability/?limit=5', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(observability_response.status_code, status.HTTP_200_OK)

        generate_component_response = self.client.post('/core/v1/stock-management/stocks/FPT/ai-advisory-components/generate/', {'mode': 'manual'}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertIn(generate_component_response.status_code, {status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_403_FORBIDDEN})

        clear_deleted_response = self.client.delete('/core/v1/stock-management/stocks/FPT/ai-advisory-components/deleted/', HTTP_AUTHORIZATION=auth_header)
        self.assertIn(clear_deleted_response.status_code, {status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED})

        regenerate_summary_response = self.client.post('/core/v1/stock-management/stocks/FPT/ai-advisory-summary/regenerate/', {'force': True}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertIn(regenerate_summary_response.status_code, {status.HTTP_200_OK, status.HTTP_201_CREATED, status.HTTP_403_FORBIDDEN})

        from advisory.models import AdvisoryRecord
        latest_record = AdvisoryRecord.objects.filter(user=self.user, symbol='FPT').order_by('-created_at').first()
        advisory_id = latest_record.advisory_id if latest_record else ''
        components = latest_record.context_snapshot.get('components', []) if latest_record else []
        component_id = components[0]['id'] if components else 1

        toggle_component_response = self.client.post(f'/core/v1/stock-management/ai-advisory-components/{component_id}/toggle-include/?advisory_id={advisory_id}', {}, format='json', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(toggle_component_response.status_code, status.HTTP_200_OK)

        portfolio_digest_response = self.client.get('/core/v1/stock-management/portfolio/news-digest/?page=1', HTTP_AUTHORIZATION=auth_header)
        self.assertEqual(portfolio_digest_response.status_code, status.HTTP_200_OK)

    def test_stock_management_detail_and_price_alert_routes_are_native(self):
        auth_header = 'Bearer vni_pat_bridge_test'

        tracked_detail_response = self.client.patch(
            '/core/v1/stock-management/tracked-symbols/7/',
            {'whale_alert_threshold_million': 250},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertIn(tracked_detail_response.status_code, {status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST})

        tracked_bulk_response = self.client.post(
            '/core/v1/stock-management/tracked-symbols/bulk-threshold/',
            {'tracked_symbol_ids': [7], 'whale_alert_threshold_million': 250},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertIn(tracked_bulk_response.status_code, {status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND})

        price_alert_create_response = self.client.post(
            '/core/v1/stock-management/price-alerts/',
            {'symbol': 'VCB', 'condition': 'ABOVE', 'target_price': 100000, 'cooldown_seconds': 300},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertIn(price_alert_create_response.status_code, {status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST})

        price_alert_patch_response = self.client.patch(
            '/core/v1/stock-management/price-alerts/11/',
            {'is_active': False},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertIn(price_alert_patch_response.status_code, {status.HTTP_200_OK, status.HTTP_404_NOT_FOUND})

        price_alert_delete_response = self.client.delete(
            '/core/v1/stock-management/price-alerts/11/',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertIn(price_alert_delete_response.status_code, {status.HTTP_204_NO_CONTENT, status.HTTP_404_NOT_FOUND})

        price_alert_trigger_response = self.client.post(
            '/core/v1/stock-management/price-alerts/11/mark-triggered/',
            {},
            format='json',
            HTTP_AUTHORIZATION=auth_header,
        )
        self.assertIn(price_alert_trigger_response.status_code, {status.HTTP_200_OK, status.HTTP_404_NOT_FOUND})
