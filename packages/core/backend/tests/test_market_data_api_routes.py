"""
Native market_data API route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import datetime
import os
import sys
from decimal import Decimal

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import resolve
from rest_framework import status
from rest_framework.test import APIClient

from unittest.mock import MagicMock, patch

from market_data.models import DailyPrice, StockProfile
from market_data.views import (
    DailyPriceListView,
    IntradayPricesView,
    IntradayTapeView,
    StockProfileDetailView,
    StockProfileListView,
)


class MarketDataApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='market-data-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_stock_profile_routes_are_native(self):
        profile = StockProfile.objects.create(
            symbol='VCB',
            company_name='Vietcombank',
            exchange='HOSE',
            industry='Banking',
            status='active',
        )

        resolver_list = resolve('/api/market-data/symbols/')
        self.assertIs(resolver_list.func.view_class, StockProfileListView)

        list_response = self.client.get('/api/market-data/symbols/?exchange=HOSE')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'][0]['symbol'], 'VCB')
        self.assertEqual(list_response.data['page'], 1)

        resolver_detail = resolve('/api/market-data/symbols/VCB/')
        self.assertIs(resolver_detail.func.view_class, StockProfileDetailView)

        detail_response = self.client.get('/api/market-data/symbols/VCB/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['symbol'], 'VCB')
        self.assertEqual(detail_response.data['exchange'], 'HOSE')

    def test_daily_price_route_is_native(self):
        DailyPrice.objects.create(
            symbol='VCB',
            date=datetime.date(2026, 5, 8),
            open=Decimal('88500.00'),
            high=Decimal('90000.00'),
            low=Decimal('88000.00'),
            close=Decimal('89500.00'),
            volume=1_500_000,
            value=134250000000,
            change_pct=Decimal('1.2380'),
            source='vnbroker',
            is_adjusted=False,
        )

        resolver = resolve('/api/market-data/daily-prices/VCB/')
        self.assertIs(resolver.func.view_class, DailyPriceListView)

        response = self.client.get('/api/market-data/daily-prices/VCB/?date_from=2026-05-01')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['symbol'], 'VCB')
        self.assertEqual(response.data['results'][0]['symbol'], 'VCB')
        self.assertEqual(response.data['results'][0]['date'], '2026-05-08')


class IntradayApiRouteTests(TestCase):
    """Route + auth + bridge behavior tests for intraday-prices and intraday-tape."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='intraday-tester',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    # --- Route resolution ---
    def test_intraday_prices_route_resolves(self):
        resolver = resolve('/api/market-data/intraday-prices/VCB/')
        self.assertIs(resolver.func.view_class, IntradayPricesView)

    def test_intraday_tape_route_resolves(self):
        resolver = resolve('/api/market-data/intraday-tape/VCB/')
        self.assertIs(resolver.func.view_class, IntradayTapeView)

    # --- Auth required ---
    def test_intraday_prices_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_intraday_tape_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- Bridge active: forwards to correct legacy path ---
    @patch('market_data.views.legacy_bridge_response')
    def test_intraday_prices_bridges_to_legacy_chart(self, mock_bridge):
        from rest_framework.response import Response as DRFResponse
        bridge_data = {'symbol': 'VCB', 'points': [], 'timeframe': '1H'}
        mock_resp = DRFResponse(bridge_data, status=200)
        mock_bridge.return_value = mock_resp
        resp = self.client.get('/api/market-data/intraday-prices/VCB/?timeframe=1H&days=30')
        self.assertEqual(resp.status_code, 200)
        call_path = mock_bridge.call_args[0][1]
        self.assertEqual(call_path, '/api/stock-management/stocks/VCB/chart/')

    @patch('market_data.views.legacy_bridge_response')
    def test_intraday_tape_bridges_to_legacy_intraday(self, mock_bridge):
        from rest_framework.response import Response as DRFResponse
        bridge_data = {'symbol': 'VCB', 'trades': [], 'total': 0}
        mock_resp = DRFResponse(bridge_data, status=200)
        mock_bridge.return_value = mock_resp
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        call_path = mock_bridge.call_args[0][1]
        self.assertEqual(call_path, '/api/realtime/intraday/VCB/')

    # --- Bridge disabled / None: graceful degradation ---
    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_intraday_prices_graceful_degradation(self, _):
        resp = self.client.get('/api/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['points'], [])
        self.assertEqual(data['source'], 'bridge_unavailable')

    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_intraday_tape_graceful_degradation(self, _):
        resp = self.client.get('/api/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['trades'], [])
        self.assertEqual(data['source'], 'bridge_unavailable')

    # --- Symbol normalization ---
    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_symbol_is_uppercased_prices(self, _):
        resp = self.client.get('/api/market-data/intraday-prices/vcb/')
        self.assertEqual(resp.json()['symbol'], 'VCB')

    @patch('market_data.views.legacy_bridge_response', return_value=None)
    def test_symbol_is_uppercased_tape(self, _):
        resp = self.client.get('/api/market-data/intraday-tape/vcb/')
        self.assertEqual(resp.json()['symbol'], 'VCB')