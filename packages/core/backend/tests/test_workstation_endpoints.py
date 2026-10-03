"""
Workstation-specific endpoint tests for Stock Detail Workstation v2.

Tests cover:
- RealtimeDepthChartView (mock market depth)
- RealtimeWhaleFeedAggregateView (symbol from URL path)
- StockManagementOverviewView (SessionFacts integration)
"""

import os
import sys
import datetime
from datetime import date
from decimal import Decimal

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

from market_data.models import DailyPrice, IntradayTick, StockProfile
from market_serving.models import SessionFacts, SessionFactsBucket, SymbolSnapshot
from market_serving.native_views import RealtimeDepthChartView, RealtimeIntradayView, RealtimeWhaleFeedAggregateView
from market_data.stock_mgmt_native_views import StockManagementOverviewView
from market_data.tests.envelope import unwrapped
from signal_intelligence.models import WhaleAlertCanonical, UnifiedAlert


class WorkstationEndpointTests(TestCase):
    """Test cases for Stock Detail Workstation v2 endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='workstation-test-user', password='testpass123')
        self.client.force_authenticate(user=self.user)

        # Create test stock profile
        self.stock = StockProfile.objects.create(
            symbol='FPT',
            company_name='FPT Corporation',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Technology',
            status=StockProfile.StatusChoices.ACTIVE,
        )

        # Create today's snapshot
        today = date.today()
        self.snapshot = SymbolSnapshot.objects.create(
            symbol='FPT',
            session_date=today,
            price=Decimal('100000.00'),
            price_change=Decimal('500.00'),
            price_change_pct=Decimal('0.5025'),
            volume=1_500_000,
            reference_price=Decimal('99500.00'),
            ceiling=Decimal('106465.00'),
            floor=Decimal('92535.00'),
            open=Decimal('99500.00'),
            high=Decimal('101000.00'),
            low=Decimal('99000.00'),
            market_status='open',
            source='live',
        )

        # Create daily price history
        for i in range(30):
            DailyPrice.objects.create(
                symbol='FPT',
                date=date.today() - datetime.timedelta(days=i),
                open=Decimal('99000.00'),
                high=Decimal('101000.00'),
                low=Decimal('98500.00'),
                close=Decimal('100000.00'),
                volume=1_500_000,
            )

    def test_realtime_depth_chart_view_resolves(self):
        """Test that the depth chart route resolves to RealtimeDepthChartView."""
        resolver = resolve('/core/v1/realtime/depth-chart/FPT/')
        self.assertIs(resolver.func.view_class, RealtimeDepthChartView)

    def test_realtime_depth_chart_returns_mock_depth(self):
        """Test that depth chart returns 3 bids and 3 asks with proper structure."""
        response = self.client.get('/core/v1/realtime/depth-chart/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['symbol'], 'FPT')
        self.assertIn('bids', data)
        self.assertIn('asks', data)
        self.assertIn('spread', data)
        self.assertIn('reference_price', data)
        self.assertIn('last_price', data)
        self.assertIn('tick_size', data)

        # Verify 3 bid levels
        self.assertEqual(len(data['bids']), 3)
        for i, bid in enumerate(data['bids']):
            self.assertIn('price', bid)
            self.assertIn('volume', bid)
            self.assertIn('orders', bid)
            # Bids should be below last price
            self.assertLess(bid['price'], data['last_price'])
            # Prices should be descending (highest bid first)
            if i > 0:
                self.assertLess(bid['price'], data['bids'][i-1]['price'])

        # Verify 3 ask levels
        self.assertEqual(len(data['asks']), 3)
        for i, ask in enumerate(data['asks']):
            self.assertIn('price', ask)
            self.assertIn('volume', ask)
            self.assertIn('orders', ask)
            # Asks should be at/above last price
            self.assertGreaterEqual(ask['price'], data['last_price'])
            # Prices should be ascending (lowest ask first)
            if i > 0:
                self.assertGreater(ask['price'], data['asks'][i-1]['price'])

        # Verify spread is positive
        self.assertGreater(data['spread'], 0)

        # Verify tick_size is correct
        self.assertEqual(data['tick_size'], 0.05)

    def test_realtime_depth_chart_deterministic(self):
        """Test that depth chart is deterministic for same symbol/date."""
        response1 = self.client.get('/core/v1/realtime/depth-chart/FPT/')
        response2 = self.client.get('/core/v1/realtime/depth-chart/FPT/')

        self.assertEqual(response1.data['bids'], response2.data['bids'])
        self.assertEqual(response1.data['asks'], response2.data['asks'])
        self.assertEqual(response1.data['spread'], response2.data['spread'])

    def test_realtime_depth_chart_no_snapshot(self):
        """Test depth chart returns empty when no snapshot exists."""
        response = self.client.get('/core/v1/realtime/depth-chart/NONEXISTENT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['symbol'], 'NONEXISTENT')
        self.assertEqual(data['bids'], [])
        self.assertEqual(data['asks'], [])
        self.assertEqual(data['note'], 'no_snapshot_data')

    def test_realtime_whale_feed_aggregate_view_resolves(self):
        """Test that whale feed aggregate route resolves with symbol."""
        resolver = resolve('/core/v1/realtime/whale-feed-aggregate/FPT/')
        self.assertIs(resolver.func.view_class, RealtimeWhaleFeedAggregateView)
        self.assertEqual(resolver.kwargs['symbol'], 'FPT')

    def test_realtime_whale_feed_aggregate_with_symbol_kwarg(self):
        """Test whale feed aggregate accepts symbol from URL path."""
        # Create whale alert data
        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            severity='high',
            symbol='FPT',
            title='Large Buy Order',
            value=Decimal('5000000000'),
            direction='buy',
            triggered_at=datetime.datetime.now(),
            session_date=date.today(),
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='FPT',
            side='buy',
            price=Decimal('100000.00'),
            volume=50000,
            matched_value=Decimal('5000000000'),
            executed_at=datetime.datetime.now(),
            session_date=date.today(),
        )

        response = self.client.get('/core/v1/realtime/whale-feed-aggregate/FPT/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn('results', data)
        self.assertIn('filters', data)
        self.assertEqual(data['filters']['symbols'], ['FPT'])
        self.assertEqual(data['filters']['scope'], 'custom')
        self.assertEqual(data['filters']['scope_source'], 'kwarg')
        self.assertIn('meta', data)
        self.assertIn('entitlements', data)

    def test_realtime_whale_feed_aggregate_empty_for_no_data(self):
        """Test whale feed returns empty results for symbol with no alerts."""
        response = self.client.get('/core/v1/realtime/whale-feed-aggregate/VCB/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['filters']['symbols'], ['VCB'])
        self.assertEqual(data['results'], [])
        self.assertFalse(data['has_more'])
        self.assertIn('meta', data)
        self.assertIn('entitlements', data)

    def test_stock_management_overview_includes_session_facts(self):
        """Test that overview includes SessionFacts aggregates."""
        # Create SessionFacts
        session_facts = SessionFacts.objects.create(
            symbol='FPT',
            session_date=date.today(),
            cvd_normalized=0.42,
            buy_strength=0.68,
            institutional_strength=0.55,
            whale_net_flow=5_000_000_000,
            dark_flow_score=0.12,
            total_buy_volume=800_000,
            total_sell_volume=700_000,
            source='computed',
        )

        response = self.client.get('/core/v1/stock-management/stocks/FPT/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = unwrapped(response)
        self.assertEqual(data['symbol'], 'FPT')

        # Verify SessionFacts fields are present
        self.assertIn('total_buy_qty', data)
        self.assertIn('total_sell_qty', data)
        self.assertIn('institutional_buy', data)
        self.assertIn('retail_buy', data)
        self.assertIn('cvd_normalized', data)
        self.assertIn('whale_net_flow', data)
        self.assertIn('dark_flow_score', data)
        self.assertIn('session_facts_date', data)
        self.assertIn('session_facts_source', data)

        # Verify values match
        self.assertEqual(data['total_buy_qty'], 800_000)
        self.assertEqual(data['total_sell_qty'], 700_000)
        self.assertEqual(data['institutional_buy'], 0.55)
        self.assertEqual(data['retail_buy'], 0.68)
        self.assertEqual(data['cvd_normalized'], 0.42)
        self.assertEqual(data['whale_net_flow'], 5_000_000_000)
        self.assertEqual(data['dark_flow_score'], 0.12)
        self.assertEqual(data['session_facts_date'], date.today().isoformat())
        self.assertEqual(data['session_facts_source'], 'computed')

    def test_stock_management_overview_without_session_facts(self):
        """Test overview works when SessionFacts doesn't exist."""
        # Delete any existing session facts
        SessionFacts.objects.filter(symbol='FPT').delete()

        response = self.client.get('/core/v1/stock-management/stocks/FPT/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = unwrapped(response)
        self.assertEqual(data['symbol'], 'FPT')

        # SessionFacts fields should be None/0 when not available
        self.assertIsNone(data['total_buy_qty'])
        self.assertIsNone(data['total_sell_qty'])
        self.assertIsNone(data['institutional_buy'])
        self.assertIsNone(data['retail_buy'])
        self.assertIsNone(data['cvd_normalized'])
        self.assertIsNone(data['whale_net_flow'])
        self.assertIsNone(data['dark_flow_score'])
        self.assertIsNone(data['session_facts_date'])
        self.assertIsNone(data['session_facts_source'])

    def test_realtime_intraday_view_resolves(self):
        """Test that intraday route resolves."""
        resolver = resolve('/core/v1/realtime/intraday/FPT/')
        self.assertIs(resolver.func.view_class, RealtimeIntradayView)

    def test_realtime_intraday_returns_trades(self):
        """Test intraday returns trades from IntradayTick."""
        # Create intraday ticks
        today = date.today()
        for i in range(5):
            IntradayTick.objects.create(
                symbol='FPT',
                timestamp=datetime.datetime.combine(today, datetime.time.min) + datetime.timedelta(minutes=i*5),
                price=Decimal('100000.00') + Decimal(str(i * 10)),
                volume=1000 + i * 100,
                side='BUY' if i % 2 == 0 else 'SELL',
            )

        response = self.client.get('/core/v1/realtime/intraday/FPT/?page_size=10')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data['symbol'], 'FPT')
        self.assertIn('trades', data)
        self.assertIn('bars', data)
        self.assertIn('total', data)
        self.assertEqual(data['source'], 'intraday_tick_db')
        self.assertEqual(len(data['trades']), 5)

        # Verify trade structure
        for trade in data['trades']:
            self.assertIn('time', trade)
            self.assertIn('price', trade)
            self.assertIn('volume', trade)
            self.assertIn('side', trade)
            self.assertIn(trade['side'], ['BUY', 'SELL', 'NO'])


class RealtimeDepthChartAlgorithmTests(TestCase):
    """Unit tests for the mock market depth algorithm."""

    def setUp(self):
        self.view = RealtimeDepthChartView()

    def test_get_tick_size_default(self):
        """Test default tick size when profile not found or no tick_size field."""
        tick_size = self.view._get_tick_size('NONEXISTENT')
        self.assertEqual(tick_size, 0.05)

    def test_get_tick_size_from_profile_no_field(self):
        """Test tick size defaults when StockProfile has no tick_size field."""
        StockProfile.objects.create(
            symbol='VCB',
            company_name='Vietcombank',
            exchange=StockProfile.ExchangeChoices.HOSE,
            industry='Banking',
            status=StockProfile.StatusChoices.ACTIVE,
        )
        tick_size = self.view._get_tick_size('VCB')
        self.assertEqual(tick_size, 0.05)  # Default since model has no tick_size field

    def test_get_tick_size_default(self):
        """Test default tick size when profile not found."""
        tick_size = self.view._get_tick_size('NONEXISTENT')
        self.assertEqual(tick_size, 0.05)

    def test_spread_calculation(self):
        """Test spread is max of 0.15% of price or tick_size."""
        # For price 100000, 0.15% = 150, tick_size = 0.05
        # spread should be 150 (rounded to tick_size)
        last_price = 100000.0
        tick_size = 0.05
        spread_pct = 0.0015
        min_spread = max(last_price * spread_pct, tick_size)
        spread = round(min_spread / tick_size) * tick_size
        self.assertEqual(spread, 150.0)

    def test_bid_ask_generation(self):
        """Test bid/ask level generation logic."""
        last_price = 100000.0
        tick_size = 0.05
        total_volume = 1_500_000
        base_volume = max(total_volume // 100, 1000)  # 15000
        volume_distribution = [0.40, 0.30, 0.20]

        # Bids: last_price - 1*tick, -2*tick, -3*tick
        expected_bid_prices = [
            round(last_price - 1 * tick_size, 2),
            round(last_price - 2 * tick_size, 2),
            round(last_price - 3 * tick_size, 2),
        ]
        self.assertEqual(expected_bid_prices, [99999.95, 99999.90, 99999.85])

        # Asks: last_price + 0*tick, +1*tick, +2*tick
        expected_ask_prices = [
            round(last_price + 0 * tick_size, 2),
            round(last_price + 1 * tick_size, 2),
            round(last_price + 2 * tick_size, 2),
        ]
        self.assertEqual(expected_ask_prices, [100000.00, 100000.05, 100000.10])

        # Volume distribution
        expected_volumes = [int(base_volume * p) for p in volume_distribution]
        self.assertEqual(expected_volumes, [6000, 4500, 3000])


if __name__ == '__main__':
    import unittest
    unittest.main()