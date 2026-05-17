from unittest.mock import patch

from decimal import Decimal
from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord
from identity_access.models import CoreTenant
from market_data.models import DailyPrice, GlobalSymbolDemandSource, GlobalSymbolRegistry, IntradayBar, StockProfile
from user_workspace.models import PriceAlert, TrackedSymbol, Watchlist, WatchlistItem

User = get_user_model()


class StockManagementNativeApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='stock-native-api',
            email='stock-native-api@test.local',
            password='pass123',
        )
        StockProfile.objects.create(
            symbol='TPB',
            company_name='Tien Phong Bank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corporation',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Technology',
            status=StockProfile.StatusChoices.ACTIVE,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_stock_search_is_native_and_paginated(self):
        response = self.client.get('/api/stock-management/stocks/?search=TPB')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('count', payload)
        self.assertIn('results', payload)
        self.assertEqual(payload['count'], 1)
        self.assertEqual(payload['results'][0]['symbol'], 'TPB')
        self.assertTrue(payload['results'][0]['is_active'])

    def test_stock_overview_returns_object_envelope_without_snapshot(self):
        response = self.client.get('/api/stock-management/stocks/FPT/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertIn('current_price', payload)
        self.assertIn('market_group_refs', payload)
        self.assertIn('watchlist_memberships', payload)
        self.assertFalse(payload['is_tracked'])

    def test_stock_overview_works_without_profile_if_daily_price_exists(self):
        today = timezone.localdate()
        DailyPrice.objects.create(
            symbol='ZZZ',
            date=today,
            open=10.0,
            high=10.5,
            low=9.9,
            close=10.2,
            volume=42000,
            source='core',
        )

        response = self.client.get('/api/stock-management/stocks/ZZZ/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'ZZZ')
        self.assertEqual(payload['company_name'], 'ZZZ')
        self.assertEqual(payload['current_price'], 10.2)
        self.assertTrue(payload['is_active'])

    def test_stock_overview_maps_native_watchlist_tracking_fields(self):
        watchlist = Watchlist.objects.create(user=self.user, name='Danh mục theo dõi', description='')
        item = WatchlistItem.objects.create(watchlist=watchlist, symbol='TPB')
        DailyPrice.objects.create(
            symbol='TPB',
            date=timezone.localdate() - timedelta(days=1),
            open=17.55,
            high=17.95,
            low=17.40,
            close=17.90,
            volume=11111,
            source='core',
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=timezone.localdate(),
            open=18.00,
            high=18.40,
            low=17.95,
            close=18.25,
            volume=123456,
            source='core',
        )

        response = self.client.get('/api/stock-management/stocks/TPB/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload['is_tracked'])
        self.assertEqual(payload['tracked_symbol_id'], item.pk)
        self.assertEqual(payload['market_group_refs'][0]['id'], watchlist.pk)
        self.assertEqual(payload['watchlist_memberships'][0]['item_id'], item.pk)
        self.assertEqual(payload['current_price'], 18.25)
        self.assertEqual(payload['reference_price'], 17.9)

    def test_stock_overview_prefers_native_tracked_symbol_source_group(self):
        group = Watchlist.objects.create(user=self.user, name='Ngân hàng', description='Nhóm ngân hàng')
        tracked_symbol = TrackedSymbol.objects.create(
            user=self.user,
            symbol='TPB',
            source_watchlist=group,
            whale_alert_threshold_million=Decimal('850'),
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=timezone.localdate() - timedelta(days=1),
            open=17.8,
            high=18.1,
            low=17.7,
            close=18.0,
            volume=9500,
            source='core',
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=timezone.localdate(),
            open=18.0,
            high=18.5,
            low=17.9,
            close=18.3,
            volume=11000,
            source='core',
        )

        response = self.client.get('/api/stock-management/stocks/TPB/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload['is_tracked'])
        self.assertEqual(payload['tracked_symbol_id'], tracked_symbol.pk)
        self.assertEqual(payload['source_group_name'], group.name)
        self.assertEqual(payload['market_group_refs'][0]['id'], group.pk)

    def test_stock_chart_returns_envelope_when_no_native_candles(self):
        response = self.client.get('/api/stock-management/stocks/FPT/chart/?timeframe=1H&days=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['timeframe'], '1H')
        self.assertEqual(payload['points'], [])
        self.assertEqual(payload['technical']['bias'], 'neutral')

    def test_stock_chart_reads_intraday_bars_from_native_core_tables(self):
        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        IntradayBar.objects.create(
            symbol='TPB',
            datetime=now - timedelta(hours=1),
            timeframe='1H',
            open=18.00,
            high=18.30,
            low=17.95,
            close=18.20,
            volume=10000,
            source='core',
        )
        IntradayBar.objects.create(
            symbol='TPB',
            datetime=now,
            timeframe='1H',
            open=18.20,
            high=18.45,
            low=18.10,
            close=18.40,
            volume=12000,
            source='core',
        )

        response = self.client.get('/api/stock-management/stocks/TPB/chart/?timeframe=1H&days=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['interval'], '1H')
        self.assertEqual(len(payload['points']), 2)
        self.assertEqual(payload['points'][-1]['close'], 18.4)

    def test_stock_chart_reads_daily_prices_with_native_envelope(self):
        today = timezone.localdate()
        DailyPrice.objects.create(
            symbol='TPB',
            date=today - timedelta(days=1),
            open=17.8,
            high=18.1,
            low=17.7,
            close=18.0,
            volume=9500,
            source='core',
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=today,
            open=18.0,
            high=18.5,
            low=17.9,
            close=18.3,
            volume=11000,
            source='core',
        )

        response = self.client.get('/api/stock-management/stocks/TPB/chart/?timeframe=D&days=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['timeframe'], 'D')
        self.assertEqual(len(payload['points']), 2)
        self.assertEqual(payload['points'][-1]['close'], 18.3)
        self.assertIn('latest_close', payload['technical'])

    def test_stock_chart_uses_market_data_even_when_profile_missing(self):
        today = timezone.localdate()
        DailyPrice.objects.create(
            symbol='VGC',
            date=today,
            open=43.5,
            high=44.1,
            low=43.2,
            close=43.9,
            volume=9000,
            source='core',
        )

        response = self.client.get('/api/stock-management/stocks/VGC/chart/?timeframe=D&days=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'VGC')
        self.assertEqual(len(payload['points']), 1)
        self.assertEqual(payload['points'][0]['close'], 43.9)

    def test_stock_chart_returns_not_found_when_symbol_absent_from_all_sources(self):
        response = self.client.get('/api/stock-management/stocks/ZZZZ/chart/?timeframe=D&days=30')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_daily_history', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_realtime_price', side_effect=AssertionError('provider path must not run in advisory request path'))
    def test_ai_advisory_session_reads_native_advisory_record(
        self,
        fetch_realtime_price_mock,
        fetch_daily_history_mock,
        fetch_price_board_snapshot_mock,
        fetch_intraday_tape_mock,
    ):
        AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Native advisory payload',
            tokens_used=321,
            generated_at=timezone.now(),
        )

        response = self.client.get('/api/stock-management/stocks/TPB/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['status'], AdvisoryRecord.StatusChoices.GENERATED)
        self.assertEqual(payload['advisory_text'], 'Native advisory payload')
        fetch_realtime_price_mock.assert_not_called()
        fetch_daily_history_mock.assert_not_called()
        fetch_price_board_snapshot_mock.assert_not_called()
        fetch_intraday_tape_mock.assert_not_called()

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_daily_history', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_realtime_price', side_effect=AssertionError('provider path must not run in advisory request path'))
    def test_ai_advisory_generate_routes_to_native_manual_trigger(
        self,
        fetch_realtime_price_mock,
        fetch_daily_history_mock,
        fetch_price_board_snapshot_mock,
        fetch_intraday_tape_mock,
    ):
        CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-native-api-advisory',
            display_name='Stock Native Advisory Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        response = self.client.post(
            '/api/stock-management/stocks/TPB/ai-advisory-components/generate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['status'], AdvisoryRecord.StatusChoices.PENDING)
        self.assertIn('manual_trigger', payload)

        record = AdvisoryRecord.objects.get(symbol='TPB', user=self.user, session_date=timezone.localdate())
        self.assertEqual(record.status, AdvisoryRecord.StatusChoices.PENDING)
        self.assertEqual(record.context_snapshot['manual_trigger']['job_key'], 'advisory_refresh')
        fetch_realtime_price_mock.assert_not_called()
        fetch_daily_history_mock.assert_not_called()
        fetch_price_board_snapshot_mock.assert_not_called()
        fetch_intraday_tape_mock.assert_not_called()

    @patch(
        'market_data.stock_mgmt_native_views.fetch_symbol_group_members',
        side_effect=lambda group_id: ['FPT', 'HPG'] if str(group_id).lower() == 'vn30' else ['FPT', 'HPG', 'TPB'],
    )
    def test_groups_seed_detail_and_items_are_native(self, fetch_symbol_group_members_mock):
        seed_response = self.client.post('/api/stock-management/seed/', {}, format='json')

        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)
        self.assertIn('message', seed_response.json())
        self.assertEqual(fetch_symbol_group_members_mock.call_count, 2)
        self.assertEqual({call.args[0] for call in fetch_symbol_group_members_mock.call_args_list}, {'vn30', 'vn100'})

        admin_group_registry = GlobalSymbolRegistry.objects.get(symbol='HPG')
        admin_group_edge = GlobalSymbolDemandSource.objects.filter(
            registry=admin_group_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP,
            source_ref='admin_group:thép_&_vật_liệu',
        ).first()
        self.assertIsNotNone(admin_group_edge)
        self.assertTrue(admin_group_edge.is_active)

        system_default_registry = GlobalSymbolRegistry.objects.get(symbol='FPT')
        system_default_edge = GlobalSymbolDemandSource.objects.filter(
            registry=system_default_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
            source_ref='system_default:vn30',
        ).first()
        self.assertIsNotNone(system_default_edge)
        self.assertTrue(system_default_edge.is_active)

        vn100_edge = GlobalSymbolDemandSource.objects.filter(
            registry=system_default_registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
            source_ref='system_default:vn100',
        ).first()
        self.assertIsNotNone(vn100_edge)
        self.assertTrue(vn100_edge.is_active)

        list_response = self.client.get('/api/stock-management/groups/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        groups = list_response.json()
        self.assertGreater(len(groups), 0)
        first_group = groups[0]
        self.assertIn('group_type', first_group)
        self.assertIn('items', first_group)
        self.assertGreater(len(first_group['items']), 0)

        detail_response = self.client.get(f"/api/stock-management/groups/{first_group['id']}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.json()['id'], first_group['id'])

        items_response = self.client.get(f"/api/stock-management/groups/{first_group['id']}/items/")
        self.assertEqual(items_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(items_response.json(), list)
        self.assertGreater(len(items_response.json()), 0)

    def test_tracked_symbol_endpoints_are_native(self):
        group = Watchlist.objects.create(user=self.user, name='Ngân hàng', description='Nhóm ngân hàng')
        DailyPrice.objects.create(
            symbol='TPB',
            date=timezone.localdate() - timedelta(days=1),
            open=17.55,
            high=17.95,
            low=17.40,
            close=17.90,
            volume=11111,
            source='core',
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=timezone.localdate(),
            open=18.00,
            high=18.40,
            low=17.95,
            close=18.25,
            volume=123456,
            source='core',
        )

        create_response = self.client.post(
            '/api/stock-management/tracked-symbols/',
            {
                'symbol': 'TPB',
                'source_group_id': group.pk,
                'whale_alert_threshold_million': 850,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tracked_row = create_response.json()
        self.assertEqual(tracked_row['source_group_id'], group.pk)
        self.assertEqual(tracked_row['whale_alert_threshold_million'], 850.0)
        self.assertEqual(tracked_row['current_price'], 18.25)

        registry = GlobalSymbolRegistry.objects.get(symbol='TPB')
        demand_edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.TRACKED_SYMBOL,
            source_ref=f"tracked_symbol:{tracked_row['id']}",
        )
        self.assertTrue(demand_edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.HOT)

        list_response = self.client.get('/api/stock-management/tracked-symbols/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        tracked_rows = list_response.json()
        self.assertEqual(len(tracked_rows), 1)
        self.assertEqual(tracked_rows[0]['symbol'], 'TPB')

        patch_response = self.client.patch(
            f"/api/stock-management/tracked-symbols/{tracked_row['id']}/",
            {'whale_alert_threshold_million': 920},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.json()['whale_alert_threshold_million'], 920.0)

        bulk_response = self.client.post(
            '/api/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [tracked_row['id']],
                'whale_alert_threshold_million': None,
            },
            format='json',
        )
        self.assertEqual(bulk_response.status_code, status.HTTP_200_OK)
        self.assertEqual(bulk_response.json()['updated_count'], 1)
        self.assertIsNone(bulk_response.json()['rows'][0]['whale_alert_threshold_million'])

        delete_response = self.client.delete(f"/api/stock-management/tracked-symbols/{tracked_row['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TrackedSymbol.objects.filter(pk=tracked_row['id']).exists())
        registry.refresh_from_db()
        demand_edge.refresh_from_db()
        self.assertFalse(demand_edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_price_alert_endpoints_are_native(self):
        DailyPrice.objects.create(
            symbol='FPT',
            date=timezone.localdate() - timedelta(days=1),
            open=99900,
            high=100500,
            low=99500,
            close=100000,
            volume=8800,
            source='core',
        )
        DailyPrice.objects.create(
            symbol='FPT',
            date=timezone.localdate(),
            open=100000,
            high=101500,
            low=99800,
            close=101000,
            volume=9600,
            source='core',
        )

        create_response = self.client.post(
            '/api/stock-management/price-alerts/',
            {
                'symbol': 'FPT',
                'condition': 'ABOVE',
                'target_price': 100500,
                'cooldown_seconds': 120,
                'is_active': True,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        alert_row = create_response.json()
        self.assertEqual(alert_row['condition'], 'ABOVE')
        self.assertEqual(alert_row['cooldown_seconds'], 120)
        self.assertTrue(alert_row['is_triggered'])

        registry = GlobalSymbolRegistry.objects.get(symbol='FPT')
        demand_edge = GlobalSymbolDemandSource.objects.get(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.ALERT,
            source_ref=f"price_alert:{alert_row['id']}",
        )
        self.assertTrue(demand_edge.is_active)

        list_response = self.client.get('/api/stock-management/price-alerts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        alert_rows = list_response.json()
        self.assertEqual(len(alert_rows), 1)
        self.assertEqual(alert_rows[0]['symbol'], 'FPT')

        patch_response = self.client.patch(
            f"/api/stock-management/price-alerts/{alert_row['id']}/",
            {'is_active': False},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertFalse(patch_response.json()['is_active'])
        registry.refresh_from_db()
        demand_edge.refresh_from_db()
        self.assertFalse(demand_edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

        trigger_response = self.client.post(
            f"/api/stock-management/price-alerts/{alert_row['id']}/mark-triggered/",
            {},
            format='json',
        )
        self.assertEqual(trigger_response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(trigger_response.json()['last_triggered_at'])

        delete_response = self.client.delete(f"/api/stock-management/price-alerts/{alert_row['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PriceAlert.objects.filter(pk=alert_row['id']).exists())

    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', side_effect=AssertionError('provider path must not run in request path'))
    @patch('market_data.stock_mgmt_native_views.create_global_planner_run')
    def test_sync_routes_user_scope_through_global_planner(self, create_global_planner_run_mock, fetch_price_board_snapshot_mock):
        watchlist = Watchlist.objects.create(user=self.user, name='Ngân hàng', description='Nhóm ngân hàng')
        WatchlistItem.objects.create(watchlist=watchlist, symbol='TPB')
        create_global_planner_run_mock.return_value = {
            'queued': True,
            'status': 'queued',
            'run_id': 'planner-run-1',
            'celery_task_id': 'task-1',
            'plan_summary': {
                'planned_items': 1,
                'skipped_items': 0,
            },
        }

        response = self.client.post('/api/stock-management/sync/', {'days': 5}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['synced'], ['TPB'])
        self.assertEqual(payload['total_symbols'], 1)
        self.assertEqual(payload['requested_symbols'], 1)
        self.assertEqual(payload['scope'], 'global_ssot')
        self.assertEqual(payload['source'], 'global_planner')
        self.assertTrue(payload['queued'])
        self.assertEqual(payload['status'], 'queued')
        self.assertEqual(payload['run_id'], 'planner-run-1')
        self.assertEqual(payload['celery_task_id'], 'task-1')
        self.assertEqual(payload['plan_summary']['planned_items'], 1)
        create_global_planner_run_mock.assert_called_once_with(
            symbols=['TPB'],
            datasets=['price_board_snapshot'],
            mode='missing_only',
            force_refresh=False,
            reason='stock_management_user_sync',
            execution_mode='async',
            trigger='market_data.stock_management.sync',
            planner_queue='manual_on_demand',
            extra_input_summary={
                'scope': 'user_demand',
                'requested_symbols': 1,
            },
        )
        fetch_price_board_snapshot_mock.assert_not_called()