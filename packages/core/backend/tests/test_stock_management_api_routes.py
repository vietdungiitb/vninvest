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
from user_workspace.models import TrackedSymbol
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


# Offline replacement for `fetch_listing_symbols`. The industry strings are the
# classifier keywords used by `seed_default_watchlist_groups`
# (`stock_mgmt_native_views.py:3478-3497`), and every one of the six sector
# groups must be covered: groups sort by `display_order` 1..6
# (`_GROUP_METADATA`), so a sector with no StockProfile lands first and makes
# `first_group['items']` empty. Exchanges cover HOSE/HNX/UPCOM so the EXCHANGE
# groups are populated too.
_OFFLINE_LISTING_ROWS = [
    {'symbol': 'VCB', 'exchange': 'HOSE', 'company_name': 'Vietcombank', 'industry': 'Ngân hàng'},
    {'symbol': 'VHM', 'exchange': 'HOSE', 'company_name': 'VinHomes', 'industry': 'Bất động sản'},
    {'symbol': 'HPG', 'exchange': 'HOSE', 'company_name': 'Hoa Phat', 'industry': 'Thép & Vật liệu'},
    {'symbol': 'PVD', 'exchange': 'HOSE', 'company_name': 'PV Drilling', 'industry': 'Dầu khí'},
    {'symbol': 'FPT', 'exchange': 'HOSE', 'company_name': 'FPT Corporation', 'industry': 'Công nghệ'},
    {'symbol': 'SAB', 'exchange': 'HOSE', 'company_name': 'Sabeco', 'industry': 'Bán lẻ'},
    {'symbol': 'SHB', 'exchange': 'HNX', 'company_name': 'Saigon Hanoi', 'industry': 'Ngân hàng'},
    {'symbol': 'HAP', 'exchange': 'UPCOM', 'company_name': 'Hapaco', 'industry': 'Bán lẻ'},
]


class _OfflineVnbrokerListing:
    """Stand-in for `vnbroker.api.listing.Listing` (`vnbroker_adapter.py:358-361`).

    `fetch_symbol_group_members` builds one client PER candidate group and calls
    `symbols_by_group` on it, so any test reaching that path opened a real VCI
    socket per candidate: this file measured 161s, then 475s across runs, and the
    result depended on uplink availability. Returning empty for every call makes
    the adapter fall through to the patched `fetch_listing_symbols` instead, so
    the test becomes hermetic and deterministic.
    """

    def __init__(self, *args, **kwargs):
        pass

    def symbols_by_exchange(self, *args, **kwargs):
        return []

    def all_symbols(self, *args, **kwargs):
        return []

    def symbols_by_industries(self, *args, **kwargs):
        return {}

    def symbols_by_group(self, *args, **kwargs):
        return ['FPT']

    def get_supported_groups(self, *args, **kwargs):
        """One deterministic group, shaped like the provider's DataFrame.

        `sync_cached_symbol_groups` (adapter:1402-1454) only keeps provider groups
        when `get_supported_groups()` returns rows; an AttributeError there sends
        every provider group into the `continue` branch and the seed then emits
        zero groups. `VN30` is chosen because it is a real `_GROUP_METADATA` key,
        so `group_type`/`color`/`display_order` get populated.
        """
        import pandas as pd

        return pd.DataFrame(
            [{'group_name': 'VN30', 'group_code': 'VN30', 'category': 'INDEX', 'description': 'VN30'}]
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
        # `StockManagementTrackedSymbolsView` scopes to
        # `TrackedSymbol.objects.filter(user=...).filter(tenant=...)`
        # (`stock_mgmt_native_views.py:409-415`), so without a row for THIS tenant
        # the list endpoint returned an empty payload. Add the fixture here so the
        # tenant-scoping guard is actually exercised.
        TrackedSymbol.objects.create(
            user=self.user,
            tenant=self.tenant,
            symbol='FPT',
        )

    @override_settings(LEGACY_BACKEND_URL='')
    @patch(
        'market_data.vnbroker_adapter.fetch_listing_symbols',
        return_value=_OFFLINE_LISTING_ROWS,
    )
    @patch(
        'market_data.vnbroker_adapter._load_listing_adapter_class',
        return_value=_OfflineVnbrokerListing,
    )
    @patch('market_data.vnbroker_adapter.fetch_realtime_price', return_value=None)
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshots_batch', return_value={})
    @patch('market_data.vnbroker_adapter.fetch_daily_history', return_value=[])
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', return_value=[{'symbol': 'FPT', 'source': 'native'}])
    def test_seed_populates_groups_and_groups_view_returns_renderable_shape(self, fetch_price_board_snapshot_mock, fetch_daily_history_mock, fetch_price_board_snapshots_batch_mock, fetch_realtime_price_mock, offline_listing_class_mock, fetch_listing_symbols_mock):
        # This test previously had NO network stub and took 210s, opening live
        # VCI sockets for both the seed and the groups call. Same hermetic set as
        # `test_groups_seed_sync_...` above.
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
    # `fetch_listing_symbols` opened a real VCI connection via
    # `listing_client.symbols_by_exchange('HOSE')` (vnbroker_adapter.py:713),
    # so this test took 161-324s and failed whenever the uplink was unavailable.
    # Views import it lazily inside the function, so patching the module
    # attribute is sufficient.
    @patch(
        'market_data.vnbroker_adapter.fetch_listing_symbols',
        return_value=_OFFLINE_LISTING_ROWS,
    )
    @patch(
        'market_data.vnbroker_adapter._load_listing_adapter_class',
        return_value=_OfflineVnbrokerListing,
    )
    # Quote entry points left in place after the listing stubs: each one opens a
    # real quote socket via `_load_quote_class` (adapter:491/524/651). Empty
    # returns are the same shape the adapter already produces on failure, so this
    # tests "no upstream data" deterministically instead of the live market.
    @patch('market_data.vnbroker_adapter.fetch_realtime_price', return_value=None)
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshots_batch', return_value={})
    @patch('market_data.vnbroker_adapter.fetch_daily_history', return_value=[])
    @patch('data_ingest.tasks.run_global_market_data_planner.apply_async')
    def test_groups_seed_sync_and_remaining_stock_routes_are_native(self, mock_apply_async, fetch_daily_history_mock, fetch_price_board_snapshots_batch_mock, fetch_realtime_price_mock, offline_listing_class_mock, fetch_listing_symbols_mock, fetch_price_board_snapshot_mock):
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
