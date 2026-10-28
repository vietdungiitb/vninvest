from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AdvisoryRecord
from identity_access.models import CoreTenant, UserProfile
from market_data.models import (
    DailyPrice,
    GlobalSymbolDemandSource,
    GlobalSymbolRegistry,
    IntradayBar,
    IntradayTick,
    StockProfile,
)
from market_data.tests.envelope import unwrapped_json
from service_ops.models import CachedSymbolGroup, CachedSymbolGroupMember
from signal_intelligence.models import UnifiedAlert
from user_workspace.models import PriceAlert, TrackedSymbol, Watchlist, WatchlistItem

User = get_user_model()


class _OfflineVnbrokerListing:
    """Stand-in for `vnbroker.api.listing.Listing` (`vnbroker_adapter.py:358-361`).

    Every read returns empty so no test can open a live VCI socket. This exists
    because `sync_cached_symbol_groups` (adapter:1406-1463) iterates
    `_PROVIDER_SYNC_ORDER` and each miss costs a retry cycle (~4s, and it raises
    `RetryError` outright when the uplink is down).
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
        return []

    def get_supported_groups(self, *args, **kwargs):
        """Empty on purpose.

        Provider groups are deliberately NOT faked here. The seed resolves members
        from two call sites: the INDEX loop (`stock_mgmt_native_views.py:3528`) and
        the system-default loop (`:3590`, ids `vn30/vn100/hnx30` from
        `default_groups.py:212`). Returning one extra INDEX group makes the INDEX
        loop fire once more, so `fetch_symbol_group_members` is called 4 times
        instead of 3. Empty keeps the count assertion meaningful: exactly the 3
        system-default groups are resolved.
        """
        import pandas as pd

        return pd.DataFrame(columns=['group_name', 'group_code', 'category', 'description'])


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class StockManagementNativeApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.tenant_owner = User.objects.create_user(
            username='stock-native-api-tenant-owner',
            email='stock-native-api-owner@test.local',
            password='pass123',
        )
        cls.tenant = CoreTenant.objects.create(
            tenant_code='stock-native-api-default-tenant',
            display_name='Default Test Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
            owner_user=cls.tenant_owner,
        )
        cls.user = User.objects.create_user(
            username='stock-native-api',
            email='stock-native-api@test.local',
            password='pass123',
        )
        UserProfile.objects.create(user=cls.user, tenant=cls.tenant)
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
        response = self.client.get('/core/v1/stock-management/stocks/?search=TPB')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertIn('results', payload)
        self.assertEqual(len(payload['results']), 1)
        self.assertEqual(payload['results'][0]['symbol'], 'TPB')
        self.assertTrue(payload['results'][0]['is_active'])

    def test_stock_overview_returns_object_envelope_without_snapshot(self):
        response = self.client.get('/core/v1/stock-management/stocks/FPT/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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

        response = self.client.get('/core/v1/stock-management/stocks/ZZZ/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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

        response = self.client.get('/core/v1/stock-management/stocks/TPB/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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

        response = self.client.get('/core/v1/stock-management/stocks/TPB/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertTrue(payload['is_tracked'])
        self.assertEqual(payload['tracked_symbol_id'], tracked_symbol.pk)
        self.assertEqual(payload['source_group_name'], group.name)
        self.assertEqual(payload['market_group_refs'][0]['id'], group.pk)

    def test_stock_chart_returns_envelope_when_no_native_candles(self):
        response = self.client.get('/core/v1/stock-management/stocks/FPT/chart/?timeframe=1H&days=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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

        response = self.client.get('/core/v1/stock-management/stocks/TPB/chart/?timeframe=1H&days=5')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['interval'], '1H')
        self.assertEqual(len(payload['points']), 2)
        self.assertEqual(payload['points'][-1]['close'], 18.4)

    def test_stock_chart_accepts_30m_timeframe_alias(self):
        now = timezone.now().replace(second=0, microsecond=0)
        IntradayBar.objects.create(
            symbol='TPB',
            datetime=now - timedelta(minutes=30),
            timeframe='30m',
            open=18.00,
            high=18.10,
            low=17.95,
            close=18.05,
            volume=5000,
            source='core',
        )

        response = self.client.get('/core/v1/stock-management/stocks/TPB/chart/?timeframe=30m&days=2')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['timeframe'], '30m')
        self.assertEqual(payload['interval'], '30m')
        self.assertEqual(len(payload['points']), 1)

    def test_stock_dark_money_history_returns_native_envelope(self):
        now = timezone.now().replace(second=0, microsecond=0)
        IntradayBar.objects.create(
            symbol='TPB',
            datetime=now,
            timeframe='1H',
            open=18.00,
            high=18.30,
            low=17.90,
            close=18.20,
            volume=15000,
            source='core',
        )
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='TPB',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.82,
            title='Dark flow TPB',
            body='',
            value=Decimal('1200000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=timezone.localdate(),
            triggered_at=now,
            source_ref='test-dark-money-history',
            metadata={'signal_type': 'dark_flow', 'strength': 68},
            evidence={},
        )

        response = self.client.get('/core/v1/stock-management/stocks/TPB/dark-money-history/?interval=1h&period=1M')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertTrue(payload['ok'])
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['interval'], '1h')
        self.assertEqual(payload['period'], '1M')
        self.assertIn('candles', payload)
        self.assertIn('dark_flow_series', payload)
        self.assertIn('whale_signals', payload)
        self.assertIn('moving_averages', payload)
        self.assertIn('smfi', payload)
        self.assertIn('strategy_table', payload)

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

        response = self.client.get('/core/v1/stock-management/stocks/TPB/chart/?timeframe=D&days=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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

        response = self.client.get('/core/v1/stock-management/stocks/VGC/chart/?timeframe=D&days=30')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'VGC')
        self.assertEqual(len(payload['points']), 1)
        self.assertEqual(payload['points'][0]['close'], 43.9)

    def test_stock_chart_returns_not_found_when_symbol_absent_from_all_sources(self):
        response = self.client.get('/core/v1/stock-management/stocks/ZZZZ/chart/?timeframe=D&days=30')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_core_v1_stock_profile_route_matches_public_contract(self):
        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['symbol'], 'TPB')

    def test_core_v1_stock_overview_route_matches_public_contract(self):
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

        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/overview/')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/overview/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['symbol'], 'TPB')

    def test_core_v1_stock_chart_route_matches_public_contract(self):
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

        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/chart/?timeframe=D&days=30')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/chart/?timeframe=D&days=30')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['timeframe'], 'D')

    def test_core_v1_stock_dark_money_history_route_matches_public_contract(self):
        now = timezone.now().replace(second=0, microsecond=0)
        IntradayBar.objects.create(
            symbol='TPB',
            datetime=now,
            timeframe='1H',
            open=18.00,
            high=18.30,
            low=17.90,
            close=18.20,
            volume=15000,
            source='core',
        )
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='TPB',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.82,
            title='Dark flow TPB',
            body='',
            value=Decimal('1200000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=timezone.localdate(),
            triggered_at=now,
            source_ref='test-dark-money-history-core',
            metadata={'signal_type': 'dark_flow', 'strength': 68},
            evidence={},
        )

        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/dark-money-history/?interval=1h&period=1M')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/dark-money-history/?interval=1h&period=1M')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))

    def test_core_v1_stock_order_flow_route_matches_public_contract(self):
        now = timezone.now()
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='TPB',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.91,
            title='Dark flow TPB tăng mạnh',
            body='',
            value=Decimal('2200000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=timezone.localdate(),
            triggered_at=now,
            source_ref='stock-native-order-flow-dark-core',
            metadata={'signal_type': 'dark_flow', 'whale_intensity': 0.82},
            evidence={},
        )
        IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(minutes=1),
            price=18.2,
            volume=100,
            side=IntradayTick.SideChoices.BUY,
            source='core',
        )

        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/order-flow/?window=30m&limit=10')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/order-flow/?window=30m&limit=10')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['symbol'], 'TPB')

    def test_core_v1_stock_news_route_matches_public_contract(self):
        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/news/')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/news/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['note'],
            'news_loaded_successfully')

    def test_core_v1_stock_news_ai_summary_route_matches_public_contract(self):
        native_response = self.client.post('/core/v1/stock-management/stocks/TPB/news/ai-summary/', {}, format='json')
        public_response = self.client.post('/core/v1/stock-management/stocks/TPB/news/ai-summary/', {}, format='json')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['note'],
            'ai_summary_not_available_in_native')

    def test_core_v1_stock_financials_route_matches_public_contract(self):
        native_response = self.client.get('/core/v1/stock-management/stocks/TPB/financials/')
        public_response = self.client.get('/core/v1/stock-management/stocks/TPB/financials/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['note'],
            'financials_loaded_successfully')

    def test_stock_management_technicals_bulk_returns_compatible_technical_payload(self):
        start_date = timezone.localdate() - timedelta(days=70)
        for offset in range(60):
            trade_date = start_date + timedelta(days=offset)
            close_price = 18.0 + (offset * 0.12)
            DailyPrice.objects.create(
                symbol='TPB',
                date=trade_date,
                open=close_price - 0.15,
                high=close_price + 0.2,
                low=close_price - 0.25,
                close=close_price,
                volume=10000 + (offset * 150),
                source='core',
            )

        response = self.client.get('/core/v1/stock-management/technicals/bulk/?symbols=TPB,FPT')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertIn('technicals', payload)
        self.assertIn('results', payload)
        self.assertEqual(payload['requested_count'], 2)
        self.assertEqual(payload['resolved_count'], 2)

        tpb_row = next(item for item in payload['technicals'] if item['symbol'] == 'TPB')
        self.assertIn('rsi_14', tpb_row)
        self.assertIn('sma20', tpb_row)
        self.assertIn('sma50', tpb_row)
        self.assertIn('momentum_20d_pct', tpb_row)
        self.assertIsNotNone(tpb_row['rsi_14'])
        self.assertIsNotNone(tpb_row['sma20'])
        self.assertIsNotNone(tpb_row['sma50'])
        self.assertIsNotNone(tpb_row['momentum_20d_pct'])
        self.assertEqual(payload['results'][0].keys(), payload['technicals'][0].keys())

        fpt_row = next(item for item in payload['technicals'] if item['symbol'] == 'FPT')
        self.assertIsNone(fpt_row['rsi_14'])
        self.assertIsNone(fpt_row['sma20'])
        self.assertIsNone(fpt_row['sma50'])
        self.assertIsNone(fpt_row['momentum_20d_pct'])

    def test_core_v1_market_data_technicals_bulk_route_returns_native_contract(self):
        start_date = timezone.localdate() - timedelta(days=70)
        for offset in range(60):
            trade_date = start_date + timedelta(days=offset)
            close_price = 18.0 + (offset * 0.12)
            DailyPrice.objects.create(
                symbol='TPB',
                date=trade_date,
                open=close_price - 0.15,
                high=close_price + 0.2,
                low=close_price - 0.25,
                close=close_price,
                volume=10000 + (offset * 150),
                source='core',
            )

        response = self.client.get('/core/v1/market-data/technicals/bulk/?symbols=TPB')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['requested_count'], 1)
        self.assertEqual(payload['resolved_count'], 1)
        self.assertEqual(len(payload['technicals']), 1)
        self.assertEqual(payload['technicals'][0]['symbol'], 'TPB')
        self.assertIn('rsi_14', payload['technicals'][0])
        self.assertIn('sma20', payload['technicals'][0])
        self.assertIn('momentum_20d_pct', payload['technicals'][0])
        self.assertEqual(payload['results'][0]['symbol'], 'TPB')
        self.assertEqual(payload['results'][0]['rsi_14'], payload['technicals'][0]['rsi_14'])

    def test_stock_order_flow_returns_radar_contract_fields(self):
        now = timezone.now()
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            symbol='TPB',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.91,
            title='Dark flow TPB tăng mạnh',
            body='',
            value=Decimal('2200000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=timezone.localdate(),
            triggered_at=now,
            source_ref='stock-native-order-flow-dark',
            metadata={'signal_type': 'dark_flow', 'whale_intensity': 0.82},
            evidence={},
        )
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='TPB',
            severity=UnifiedAlert.SeverityChoices.MEDIUM,
            confidence=0.74,
            title='Whale buy TPB',
            body='',
            value=Decimal('980000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=timezone.localdate(),
            triggered_at=now - timedelta(minutes=2),
            source_ref='stock-native-order-flow-whale',
            metadata={'signal_type': 'whale_buy', 'whale_intensity': 0.68},
            evidence={},
        )
        IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(minutes=1),
            price=18.2,
            volume=100,
            side=IntradayTick.SideChoices.BUY,
            source='core',
        )
        IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(minutes=2),
            price=18.21,
            volume=1200,
            side=IntradayTick.SideChoices.SELL,
            source='core',
        )
        IntradayTick.objects.create(
            symbol='TPB',
            timestamp=now - timedelta(minutes=3),
            price=18.22,
            volume=5200,
            side=IntradayTick.SideChoices.BUY,
            source='core',
        )

        response = self.client.get('/core/v1/stock-management/stocks/TPB/order-flow/?window=30m&limit=10')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['window'], '30m')
        self.assertIn('dark_flow', payload)
        self.assertIn('latest_signal', payload)
        self.assertIn('signals', payload)
        self.assertIn('tick_rate', payload)
        self.assertIn('size_distribution', payload)
        self.assertGreaterEqual(len(payload['signals']), 1)
        self.assertIsNotNone(payload['latest_signal'])
        self.assertGreater(payload['tick_rate']['tick_rate_per_min'], 0)
        self.assertIn('small_ratio', payload['size_distribution'])

    def test_stock_order_flow_returns_empty_shape_without_alerts(self):
        response = self.client.get('/core/v1/stock-management/stocks/FPT/order-flow/?window=15m')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['window'], '15m')
        self.assertEqual(payload['signals'], [])
        self.assertIsNone(payload['latest_signal'])
        self.assertIn('dark_flow', payload)
        self.assertEqual(payload['tick_rate']['tick_rate_per_min'], 0.0)
        self.assertEqual(payload['size_distribution']['small_count'], 0)

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
        record_b = AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Native advisory payload',
            tokens_used=321,
            generated_at=timezone.now(),
        )

        response = self.client.get('/core/v1/stock-management/stocks/TPB/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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
    def test_core_v1_ai_advisory_session_reads_native_advisory_record(
        self,
        fetch_realtime_price_mock,
        fetch_daily_history_mock,
        fetch_price_board_snapshot_mock,
        fetch_intraday_tape_mock,
    ):
        record_b = AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Native advisory payload',
            tokens_used=321,
            generated_at=timezone.now(),
        )

        response = self.client.get('/core/v1/stock-management/stocks/TPB/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_core_v1_ai_advisory_session_post_routes_to_native_manual_trigger(
        self,
        mock_generate_advisory_delay,
        fetch_realtime_price_mock,
        fetch_daily_history_mock,
        fetch_price_board_snapshot_mock,
        fetch_intraday_tape_mock,
    ):
        CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-native-api-advisory-session-post',
            display_name='Stock Native Advisory Session POST Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        response = self.client.post(
            '/core/v1/stock-management/stocks/TPB/ai-advisory-session/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['status'], AdvisoryRecord.StatusChoices.PENDING)
        self.assertIn('manual_trigger', payload)
        fetch_realtime_price_mock.assert_not_called()
        fetch_daily_history_mock.assert_not_called()
        fetch_price_board_snapshot_mock.assert_not_called()
        fetch_intraday_tape_mock.assert_not_called()

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_daily_history', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_realtime_price', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_ai_advisory_generate_routes_to_native_manual_trigger(
        self,
        mock_generate_advisory_delay,
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
            '/core/v1/stock-management/stocks/TPB/ai-advisory-components/generate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
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

    @patch('market_data.vnbroker_adapter.fetch_intraday_tape', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_daily_history', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('market_data.vnbroker_adapter.fetch_realtime_price', side_effect=AssertionError('provider path must not run in advisory request path'))
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_core_v1_ai_advisory_generate_routes_to_native_manual_trigger(
        self,
        mock_generate_advisory_delay,
        fetch_realtime_price_mock,
        fetch_daily_history_mock,
        fetch_price_board_snapshot_mock,
        fetch_intraday_tape_mock,
    ):
        CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-native-api-core-v1-advisory',
            display_name='Stock Native Core V1 Advisory Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        response = self.client.post(
            '/core/v1/stock-management/stocks/TPB/ai-advisory-components/generate/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['status'], AdvisoryRecord.StatusChoices.PENDING)
        self.assertIn('manual_trigger', payload)
        fetch_realtime_price_mock.assert_not_called()
        fetch_daily_history_mock.assert_not_called()
        fetch_price_board_snapshot_mock.assert_not_called()
        fetch_intraday_tape_mock.assert_not_called()

    def test_core_v1_ai_advisory_support_routes_are_native(self):
        advisory = AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Native advisory payload',
            tokens_used=321,
            generated_at=timezone.now(),
            context_snapshot={
                'components': [
                    {
                        'id': 1,
                        'symbol': 'TPB',
                        'component_type': 'indicator',
                        'indicator_name': 'RSI',
                        'status': 'neutral',
                        'confidence_score': 7,
                        'suggested_action': 'watch',
                        'rationale_text': 'Active component',
                        'timeframe': '30m',
                        'include_in_summary': True,
                        'is_deleted': False,
                        'created_at': timezone.now().isoformat(),
                        'updated_at': timezone.now().isoformat(),
                    },
                ],
                'deleted_components': [
                    {
                        'id': 2,
                        'symbol': 'TPB',
                        'component_type': 'flow',
                        'indicator_name': 'Whale Flow',
                        'status': 'bullish',
                        'confidence_score': 6,
                        'suggested_action': 'follow',
                        'rationale_text': 'Deleted component',
                        'timeframe': '30m',
                        'include_in_summary': False,
                        'is_deleted': True,
                        'created_at': timezone.now().isoformat(),
                        'updated_at': timezone.now().isoformat(),
                    },
                ],
                'executive_summary': {
                    'id': 1,
                    'summary_id': 1,
                    'summary_version': 1,
                    'symbol': 'TPB',
                    'session_date': timezone.localdate().isoformat(),
                    'strategy_action': 'hold',
                    'risk_level': 'medium',
                    'overall_confidence': 6.5,
                    'score_band': 'medium',
                    'summary_text': 'Native summary',
                    'component_ids': [1],
                    'active_components_count': 1,
                    'deleted_components_count': 1,
                    'generated_at': timezone.now().isoformat(),
                    'source': 'native',
                },
                'executive_summaries': [
                    {
                        'id': 1,
                        'summary_id': 1,
                        'summary_version': 1,
                        'symbol': 'TPB',
                        'session_date': timezone.localdate().isoformat(),
                        'strategy_action': 'hold',
                        'risk_level': 'medium',
                        'overall_confidence': 6.5,
                        'score_band': 'medium',
                        'summary_text': 'Native summary',
                        'component_ids': [1],
                        'active_components_count': 1,
                        'deleted_components_count': 1,
                        'generated_at': timezone.now().isoformat(),
                        'source': 'native',
                    },
                ],
                'manual_trigger': {
                    'job_key': 'advisory_refresh',
                },
            },
        )
        advisory_id = str(advisory.advisory_id)
        observability_get_response = self.client.get('/core/v1/stock-management/stocks/TPB/ai-advisory-observability/')
        observability_post_response = self.client.post(
            '/core/v1/stock-management/stocks/TPB/ai-advisory-observability/',
            {'event': 'open'},
            format='json',
        )
        deleted_response = self.client.get('/core/v1/stock-management/stocks/TPB/ai-advisory-components/deleted/')
        summary_regenerate_response = self.client.post(
            f'/core/v1/stock-management/stocks/TPB/ai-advisory-summary/regenerate/?advisory_id={advisory_id}',
            {'component_ids': [1]},
            format='json',
        )
        toggle_response = self.client.post(f'/core/v1/stock-management/ai-advisory-components/1/toggle-include/?advisory_id={advisory_id}', {}, format='json')
        refresh_response = self.client.post(f'/core/v1/stock-management/ai-advisory-components/1/refresh/?advisory_id={advisory_id}', {}, format='json')
        restore_response = self.client.post(f'/core/v1/stock-management/ai-advisory-components/2/restore/?advisory_id={advisory_id}', {}, format='json')
        detail_response = self.client.get(f'/core/v1/stock-management/ai-advisory-components/1/?advisory_id={advisory_id}')
        delete_response = self.client.delete(f'/core/v1/stock-management/ai-advisory-components/1/?advisory_id={advisory_id}')
        summary_delete_response = self.client.delete(f'/core/v1/stock-management/stocks/TPB/ai-advisory-summary/1/?advisory_id={advisory_id}')

        self.assertEqual(observability_get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(observability_get_response)['symbol'], 'TPB')
        self.assertEqual(observability_post_response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(unwrapped_json(observability_post_response)['received'])
        self.assertEqual(deleted_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(unwrapped_json(deleted_response)['deleted']), 1)
        self.assertEqual(unwrapped_json(deleted_response)['deleted'][0]['id'], 2)
        self.assertEqual(summary_regenerate_response.status_code, status.HTTP_201_CREATED)
        summary = unwrapped_json(summary_regenerate_response)
        self.assertEqual(summary['executive_summary']['deleted_components_count'], 1)
        self.assertEqual(toggle_response.status_code, status.HTTP_200_OK)
        toggle = unwrapped_json(toggle_response)
        self.assertFalse(toggle['component']['include_in_summary'])
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(refresh_response)['component']['id'], 1)
        self.assertEqual(restore_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(restore_response)['component']['id'], 2)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(detail_response)['component']['id'], 1)
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(summary_delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_core_v1_ai_advisory_component_routes_require_advisory_id_when_ids_collide(self):
        record_a = AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='First native advisory payload',
            tokens_used=111,
            generated_at=timezone.now(),
            context_snapshot={
                'components': [
                    {
                        'id': 3,
                        'symbol': 'TPB',
                        'component_type': 'indicator',
                        'indicator_name': 'RSI',
                        'status': 'neutral',
                        'confidence_score': 7,
                        'suggested_action': 'watch',
                        'rationale_text': 'First record',
                        'timeframe': '30m',
                        'include_in_summary': True,
                        'is_deleted': False,
                        'created_at': timezone.now().isoformat(),
                        'updated_at': timezone.now().isoformat(),
                    },
                ],
                'deleted_components': [],
            },
        )
        record_b = AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Second native advisory payload',
            tokens_used=112,
            generated_at=timezone.now(),
            context_snapshot={
                'components': [
                    {
                        'id': 3,
                        'symbol': 'TPB',
                        'component_type': 'indicator',
                        'indicator_name': 'MACD',
                        'status': 'bearish',
                        'confidence_score': 4,
                        'suggested_action': 'reduce',
                        'rationale_text': 'Second record',
                        'timeframe': '30m',
                        'include_in_summary': True,
                        'is_deleted': False,
                        'created_at': timezone.now().isoformat(),
                        'updated_at': timezone.now().isoformat(),
                    },
                ],
                'deleted_components': [],
            },
        )

        ambiguous_response = self.client.post('/core/v1/stock-management/ai-advisory-components/3/toggle-include/', {}, format='json')
        scoped_response = self.client.post(
            f'/core/v1/stock-management/ai-advisory-components/3/toggle-include/?advisory_id={record_a.advisory_id}',
            {},
            format='json',
        )

        self.assertEqual(ambiguous_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(scoped_response.status_code, status.HTTP_200_OK)
        record_a.refresh_from_db()
        record_b.refresh_from_db()
        self.assertIsNotNone(record_a.context_snapshot)
        self.assertIsNotNone(record_b)
        self.assertFalse(record_a.context_snapshot['components'][0]['include_in_summary'])
        self.assertEqual(record_b.context_snapshot['components'][0]['indicator_name'], 'MACD')

    def test_core_v1_ai_advisory_component_route_rejects_malformed_advisory_id(self):
        AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=self.user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Native advisory payload',
            tokens_used=111,
            generated_at=timezone.now(),
            context_snapshot={
                'components': [
                    {
                        'id': 7,
                        'symbol': 'TPB',
                        'component_type': 'indicator',
                        'indicator_name': 'RSI',
                        'status': 'neutral',
                        'confidence_score': 7,
                        'suggested_action': 'watch',
                        'rationale_text': 'Malformed advisory_id test',
                        'timeframe': '30m',
                        'include_in_summary': True,
                        'is_deleted': False,
                        'created_at': timezone.now().isoformat(),
                        'updated_at': timezone.now().isoformat(),
                    },
                ],
                'deleted_components': [],
            },
        )

        response = self.client.post('/core/v1/stock-management/ai-advisory-components/7/toggle-include/?advisory_id=not-a-uuid', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('advisory_id', unwrapped_json(response).get('message', ''))

    def test_core_v1_ai_advisory_session_does_not_leak_other_users_record(self):
        other_user = User.objects.create_user(
            username='stock-native-ai-other',
            email='stock-native-ai-other@test.local',
            password='pass123',
        )
        AdvisoryRecord.objects.create(
            symbol='TPB',
            session_date=timezone.localdate(),
            user=other_user,
            status=AdvisoryRecord.StatusChoices.GENERATED,
            ai_model='gpt-4o-mini',
            advisory_text='Other user advisory',
            tokens_used=111,
            generated_at=timezone.now(),
        )

        response = self.client.get('/core/v1/stock-management/stocks/TPB/ai-advisory-session/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['reason'], 'no_advisory_data')
        self.assertIsNone(payload['advisory'])

    @patch(
        'market_data.vnbroker_adapter.fetch_symbol_group_members',
        side_effect=lambda group_id: ['FPT', 'HPG'] if str(group_id).lower() == 'vn30' else ['FPT', 'HPG', 'TPB'],
    )
    @patch(
        'market_data.vnbroker_adapter.fetch_listing_symbols',
        return_value=[
            {'symbol': 'FPT', 'exchange': 'HOSE', 'company_name': 'FPT', 'industry': 'Công nghệ'},
            {'symbol': 'HPG', 'exchange': 'HOSE', 'company_name': 'Hoa Phat', 'industry': 'Thép & Vật liệu'},
            {'symbol': 'TPB', 'exchange': 'HOSE', 'company_name': 'Tien Phong', 'industry': 'Ngân hàng'},
        ],
    )
    @patch(
        'market_data.vnbroker_adapter._load_listing_adapter_class',
        return_value=_OfflineVnbrokerListing,
    )
    def test_groups_seed_detail_and_items_are_native(self, offline_listing_class_mock, fetch_listing_symbols_mock, fetch_symbol_group_members_mock):
        # Patch target is `vnbroker_adapter`, NOT `stock_mgmt_native_views`:
        # `seed_default_watchlist_groups` re-imports the symbol locally
        # (`stock_mgmt_native_views.py:3433`), which shadows the module-level import
        # at line 43. Patching the views module therefore never fired
        # (call_count 0 != 3) and the test hit live VCI: 142s then RetryError.
        seed_response = self.client.post('/core/v1/stock-management/seed/', {}, format='json')

        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)
        self.assertIn('message', unwrapped_json(seed_response))
        # Assert the exact group ids before the bare count: a count-only assertion
        # hides WHICH groups were requested, which is the part that actually
        # regresses when the SSOT group list changes.
        self.assertEqual({call.args[0] for call in fetch_symbol_group_members_mock.call_args_list}, {'vn30', 'vn100', 'hnx30'})
        self.assertEqual(fetch_symbol_group_members_mock.call_count, 3)

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

        list_response = self.client.get('/core/v1/stock-management/groups/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        groups = unwrapped_json(list_response)
        self.assertGreater(len(groups), 0)
        first_group = groups[0]
        self.assertIn('group_type', first_group)
        self.assertIn('items', first_group)
        self.assertGreater(len(first_group['items']), 0)

        detail_response = self.client.get(f"/core/v1/stock-management/groups/{first_group['id']}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(detail_response)['id'], first_group['id'])

        items_response = self.client.get(f"/core/v1/stock-management/groups/{first_group['id']}/items/")
        self.assertEqual(items_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(unwrapped_json(items_response), list)
        self.assertGreater(len(unwrapped_json(items_response)), 0)

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
            '/core/v1/stock-management/tracked-symbols/',
            {
                'symbol': 'TPB',
                'source_group_id': group.pk,
                'whale_alert_threshold_million': 850,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tracked_row = unwrapped_json(create_response)
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

        list_response = self.client.get('/core/v1/stock-management/tracked-symbols/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        tracked_rows = unwrapped_json(list_response)
        self.assertEqual(len(tracked_rows), 1)
        self.assertEqual(tracked_rows[0]['symbol'], 'TPB')

        patch_response = self.client.patch(
            f"/core/v1/stock-management/tracked-symbols/{tracked_row['id']}/",
            {'whale_alert_threshold_million': 920},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        patched = unwrapped_json(patch_response)
        self.assertEqual(patched['whale_alert_threshold_million'], 920.0)

        bulk_response = self.client.post(
            '/core/v1/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [tracked_row['id']],
                'whale_alert_threshold_million': None,
            },
            format='json',
        )
        self.assertEqual(bulk_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(bulk_response)['updated_count'], 1)
        bulk = unwrapped_json(bulk_response)
        self.assertIsNone(bulk['rows'][0]['whale_alert_threshold_million'])

        delete_response = self.client.delete(f"/core/v1/stock-management/tracked-symbols/{tracked_row['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TrackedSymbol.objects.filter(pk=tracked_row['id']).exists())
        registry.refresh_from_db()
        demand_edge.refresh_from_db()
        self.assertFalse(demand_edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

    def test_core_v1_tracked_symbols_list_route_matches_public_contract(self):
        group = Watchlist.objects.create(user=self.user, name='Ngân hàng', description='Nhóm ngân hàng')
        TrackedSymbol.objects.create(
            user=self.user,
            symbol='TPB',
            source_watchlist=group,
            whale_alert_threshold_million=Decimal('850'),
        )
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

        native_response = self.client.get('/core/v1/stock-management/tracked-symbols/')
        public_response = self.client.get('/core/v1/stock-management/tracked-symbols/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)[0]['symbol'], 'TPB')
        self.assertEqual(unwrapped_json(native_response)[0]['source_group_id'],
            group.pk)

    def test_core_v1_tracked_symbols_list_route_requires_authentication(self):
        anonymous_client = APIClient()
        response = anonymous_client.get('/core/v1/stock-management/tracked-symbols/')
        self.assertIn(
            response.status_code,
            {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN},
        )

    def test_core_v1_groups_route_blocks_suspended_tenant(self):
        CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-native-api-tenant',
            display_name='Stock Native API Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )

        response = self.client.get('/core/v1/stock-management/groups/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_core_v1_stock_management_mutation_and_detail_routes_block_suspended_tenant(self):
        tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-native-api-route-tenant',
            display_name='Stock Native API Route Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )
        watchlist = Watchlist.objects.create(
            user=self.user,
            tenant=tenant,
            name='Ngân hàng',
            description='Nhóm ngân hàng',
        )
        WatchlistItem.objects.create(watchlist=watchlist, symbol='TPB', note='Theo dõi ngân hàng')

        seed_response = self.client.post('/core/v1/stock-management/seed/', {}, format='json')
        sync_response = self.client.post('/core/v1/stock-management/sync/', {'days': 5}, format='json')
        price_alert_list_response = self.client.get('/core/v1/stock-management/price-alerts/')
        price_alert_create_response = self.client.post(
            '/core/v1/stock-management/price-alerts/',
            {
                'symbol': 'FPT',
                'condition': 'ABOVE',
                'target_price': 100500,
                'cooldown_seconds': 120,
                'is_active': True,
            },
            format='json',
        )
        group_detail_response = self.client.get(f'/core/v1/stock-management/groups/{watchlist.pk}/')
        group_items_response = self.client.get(f'/core/v1/stock-management/groups/{watchlist.pk}/items/')

        self.assertEqual(seed_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(sync_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(price_alert_list_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(price_alert_create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(group_detail_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(group_items_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_core_v1_ai_advisory_routes_block_suspended_tenant(self):
        CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='stock-native-api-ai-tenant',
            display_name='Stock Native API AI Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )

        session_get_response = self.client.get('/core/v1/stock-management/stocks/TPB/ai-advisory-session/')
        session_post_response = self.client.post('/core/v1/stock-management/stocks/TPB/ai-advisory-session/', {}, format='json')
        generate_response = self.client.post('/core/v1/stock-management/stocks/TPB/ai-advisory-components/generate/', {}, format='json')
        toggle_response = self.client.post('/core/v1/stock-management/ai-advisory-components/1/toggle-include/', {}, format='json')

        self.assertEqual(session_get_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(session_post_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(generate_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(toggle_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_core_v1_groups_route_blocks_suspended_tenant_member(self):
        owner = User.objects.create_user(
            username='stock-native-owner',
            email='stock-native-owner@test.local',
            password='pass123',
        )
        member = User.objects.create_user(
            username='stock-native-member',
            email='stock-native-member@test.local',
            password='pass123',
        )
        tenant = CoreTenant.objects.create(
            owner_user=owner,
            tenant_code='stock-native-api-member-tenant',
            display_name='Stock Native API Member Tenant',
            status=CoreTenant.StatusChoices.SUSPENDED,
        )
        UserProfile.objects.create(user=member, tenant=tenant)
        member_client = APIClient()
        member_client.force_authenticate(user=member)

        response = member_client.get('/core/v1/stock-management/groups/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_core_v1_groups_list_route_matches_public_contract(self):
        group = CachedSymbolGroup.objects.create(
            group_name='Ngân hàng', group_type='SECTOR', description='Nhóm ngân hàng',
            is_active=True, display_order=1,
        )
        CachedSymbolGroupMember.objects.create(group=group, symbol='TPB', display_order=0)
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

        native_response = self.client.get('/core/v1/stock-management/groups/')
        public_response = self.client.get('/core/v1/stock-management/groups/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)[0]['name'], 'Ngân hàng')
        self.assertEqual(unwrapped_json(native_response)[0]['items'][0]['symbol'],
            'TPB')

    @patch(
        'market_data.vnbroker_adapter.fetch_symbol_group_members',
        side_effect=lambda group_id: ['FPT', 'HPG'] if str(group_id).lower() == 'vn30' else ['FPT', 'HPG', 'TPB'],
    )
    @patch(
        'market_data.vnbroker_adapter.fetch_listing_symbols',
        return_value=[
            {'symbol': 'FPT', 'exchange': 'HOSE', 'company_name': 'FPT', 'industry': 'Công nghệ'},
            {'symbol': 'HPG', 'exchange': 'HOSE', 'company_name': 'Hoa Phat', 'industry': 'Thép & Vật liệu'},
            {'symbol': 'TPB', 'exchange': 'HOSE', 'company_name': 'Tien Phong', 'industry': 'Ngân hàng'},
        ],
    )
    @patch(
        'market_data.vnbroker_adapter._load_listing_adapter_class',
        return_value=_OfflineVnbrokerListing,
    )
    def test_core_v1_groups_seed_detail_and_items_routes_are_native(self, offline_listing_class_mock, fetch_listing_symbols_mock, fetch_symbol_group_members_mock):
        # Same wrong-patch-target bug as `test_groups_seed_detail_and_items_are_native`:
        # the seed re-imports `fetch_symbol_group_members` from `vnbroker_adapter`
        # inside the function (`stock_mgmt_native_views.py:3433`), shadowing the
        # views-module attribute these tests used to patch.
        seed_response = self.client.post('/core/v1/stock-management/seed/', {}, format='json')

        self.assertEqual(seed_response.status_code, status.HTTP_200_OK)
        self.assertIn('message', unwrapped_json(seed_response))
        self.assertEqual({call.args[0] for call in fetch_symbol_group_members_mock.call_args_list}, {'vn30', 'vn100', 'hnx30'})
        self.assertEqual(fetch_symbol_group_members_mock.call_count, 3)

        list_response = self.client.get('/core/v1/stock-management/groups/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        groups = unwrapped_json(list_response)
        self.assertGreater(len(groups), 0)
        first_group = groups[0]

        detail_response = self.client.get(f"/core/v1/stock-management/groups/{first_group['id']}/")
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(detail_response)['id'], first_group['id'])

        items_response = self.client.get(f"/core/v1/stock-management/groups/{first_group['id']}/items/")
        self.assertEqual(items_response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(unwrapped_json(items_response), list)
        self.assertGreater(len(unwrapped_json(items_response)), 0)

    def test_core_v1_portfolio_news_digest_route_matches_public_contract(self):
        native_response = self.client.get('/core/v1/stock-management/portfolio/news-digest/')
        public_response = self.client.get('/core/v1/stock-management/portfolio/news-digest/')

        self.assertEqual(native_response.status_code, status.HTTP_200_OK)
        self.assertEqual(public_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(native_response),
            unwrapped_json(public_response))
        self.assertEqual(unwrapped_json(native_response)['news'], [])
        self.assertEqual(unwrapped_json(native_response)['note'],
            'news_digest_not_available_in_native')

    def test_core_v1_tracked_symbol_mutation_routes_are_native(self):
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
            '/core/v1/stock-management/tracked-symbols/',
            {
                'symbol': 'TPB',
                'source_group_id': group.pk,
                'whale_alert_threshold_million': 850,
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        tracked_row = unwrapped_json(create_response)
        self.assertEqual(tracked_row['symbol'], 'TPB')
        self.assertEqual(tracked_row['source_group_id'], group.pk)
        self.assertEqual(tracked_row['whale_alert_threshold_million'], 850.0)

        patch_response = self.client.patch(
            f"/core/v1/stock-management/tracked-symbols/{tracked_row['id']}/",
            {'whale_alert_threshold_million': 920},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        patched = unwrapped_json(patch_response)
        self.assertEqual(patched['whale_alert_threshold_million'], 920.0)

        bulk_response = self.client.post(
            '/core/v1/stock-management/tracked-symbols/bulk-threshold/',
            {
                'tracked_symbol_ids': [tracked_row['id']],
                'whale_alert_threshold_million': None,
            },
            format='json',
        )
        self.assertEqual(bulk_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(bulk_response)['updated_count'], 1)
        bulk = unwrapped_json(bulk_response)
        self.assertIsNone(bulk['rows'][0]['whale_alert_threshold_million'])

        delete_response = self.client.delete(f"/core/v1/stock-management/tracked-symbols/{tracked_row['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TrackedSymbol.objects.filter(pk=tracked_row['id']).exists())

    def test_core_v1_tracked_symbol_create_accepts_daily_price_only_symbol(self):
        DailyPrice.objects.create(
            symbol='VGC',
            date=timezone.localdate(),
            open=43.5,
            high=44.1,
            low=43.2,
            close=43.9,
            volume=9000,
            source='core',
        )

        response = self.client.post(
            '/core/v1/stock-management/tracked-symbols/',
            {
                'symbol': 'VGC',
                'whale_alert_threshold_million': 700,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
        self.assertEqual(payload['symbol'], 'VGC')
        self.assertEqual(payload['company_name'], 'VGC')
        self.assertEqual(payload['current_price'], 43.9)

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
            '/core/v1/stock-management/price-alerts/',
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
        alert_row = unwrapped_json(create_response)
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

        list_response = self.client.get('/core/v1/stock-management/price-alerts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        alert_rows = unwrapped_json(list_response)
        self.assertEqual(len(alert_rows), 1)
        self.assertEqual(alert_rows[0]['symbol'], 'FPT')

        patch_response = self.client.patch(
            f"/core/v1/stock-management/price-alerts/{alert_row['id']}/",
            {'is_active': False},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertFalse(unwrapped_json(patch_response)['is_active'])
        registry.refresh_from_db()
        demand_edge.refresh_from_db()
        self.assertFalse(demand_edge.is_active)
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.RECOVERY)

        trigger_response = self.client.post(
            f"/core/v1/stock-management/price-alerts/{alert_row['id']}/mark-triggered/",
            {},
            format='json',
        )
        self.assertEqual(trigger_response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(unwrapped_json(trigger_response)['last_triggered_at'])

        delete_response = self.client.delete(f"/core/v1/stock-management/price-alerts/{alert_row['id']}/")
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PriceAlert.objects.filter(pk=alert_row['id']).exists())

    def test_core_v1_price_alert_routes_are_native(self):
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
            '/core/v1/stock-management/price-alerts/',
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
        alert_row = unwrapped_json(create_response)
        self.assertEqual(alert_row['symbol'], 'FPT')

        list_response = self.client.get('/core/v1/stock-management/price-alerts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(list_response)[0]['id'], alert_row['id'])

        patch_response = self.client.patch(
            f"/core/v1/stock-management/price-alerts/{alert_row['id']}/",
            {'is_active': False},
            format='json',
        )
        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertFalse(unwrapped_json(patch_response)['is_active'])

        trigger_response = self.client.post(
            f"/core/v1/stock-management/price-alerts/{alert_row['id']}/mark-triggered/",
            {},
            format='json',
        )
        self.assertEqual(trigger_response.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(unwrapped_json(trigger_response)['last_triggered_at'])

        delete_response = self.client.delete(f"/core/v1/stock-management/price-alerts/{alert_row['id']}/")
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

        response = self.client.post('/core/v1/stock-management/sync/', {'days': 5}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
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

    @patch('market_data.vnbroker_adapter.fetch_price_board_snapshot', side_effect=AssertionError('provider path must not run in request path'))
    @patch('market_data.stock_mgmt_native_views.create_global_planner_run')
    def test_core_v1_sync_route_user_scope_through_global_planner(self, create_global_planner_run_mock, fetch_price_board_snapshot_mock):
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

        response = self.client.post('/core/v1/stock-management/sync/', {'days': 5}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['synced'], ['TPB'])
        self.assertEqual(payload['scope'], 'global_ssot')
        self.assertEqual(payload['source'], 'global_planner')
        self.assertTrue(payload['queued'])
        self.assertEqual(payload['run_id'], 'planner-run-1')
        create_global_planner_run_mock.assert_called_once()
        fetch_price_board_snapshot_mock.assert_not_called()
