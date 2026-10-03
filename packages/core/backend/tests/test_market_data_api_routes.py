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

from market_data.tests.envelope import unwrapped, unwrapped_json
from market_data.models import DailyPrice, StockProfile, IntradayBar, IntradayTick
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

        resolver_list = resolve('/core/v1/market-data/symbols/')
        self.assertIs(resolver_list.func.view_class, StockProfileListView)

        list_response = self.client.get('/core/v1/market-data/symbols/?exchange=HOSE')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(list_response)['results'][0]['symbol'], 'VCB')
        self.assertIn('next', unwrapped(list_response))

        resolver_detail = resolve('/core/v1/market-data/symbols/VCB/')
        self.assertIs(resolver_detail.func.view_class, StockProfileDetailView)

        detail_response = self.client.get('/core/v1/market-data/symbols/VCB/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(detail_response)['symbol'], 'VCB')
        self.assertEqual(unwrapped(detail_response)['exchange'], 'HOSE')

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

        resolver = resolve('/core/v1/market-data/daily-prices/VCB/')
        self.assertIs(resolver.func.view_class, DailyPriceListView)

        response = self.client.get('/core/v1/market-data/daily-prices/VCB/?date_from=2026-05-01')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(response)['symbol'], 'VCB')
        self.assertEqual(unwrapped(response)['results'][0]['symbol'], 'VCB')
        self.assertEqual(unwrapped(response)['results'][0]['date'], '2026-05-08')


class IntradayApiRouteTests(TestCase):
    """Route + auth + native behavior tests for intraday-prices and intraday-tape."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='intraday-tester',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    # --- Route resolution ---
    def test_intraday_prices_route_resolves(self):
        resolver = resolve('/core/v1/market-data/intraday-prices/VCB/')
        self.assertIs(resolver.func.view_class, IntradayPricesView)

    def test_intraday_tape_route_resolves(self):
        resolver = resolve('/core/v1/market-data/intraday-tape/VCB/')
        self.assertIs(resolver.func.view_class, IntradayTapeView)

    # --- Auth required ---
    def test_intraday_prices_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/core/v1/market-data/intraday-prices/VCB/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_intraday_tape_requires_auth(self):
        self.client.force_authenticate(user=None)
        resp = self.client.get('/core/v1/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- Native behavior: returns correct data ---
    def test_intraday_prices_returns_native_data(self):
        from django.utils import timezone
        IntradayBar.objects.create(
            symbol='VCB',
            datetime=timezone.now(),
            timeframe='1H',
            open=Decimal('100.0'),
            high=Decimal('105.0'),
            low=Decimal('99.0'),
            close=Decimal('102.0'),
            volume=500,
            source='vnbroker',
        )
        resp = self.client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=1H&days=30')
        self.assertEqual(resp.status_code, 200)
        data = unwrapped_json(resp)
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['source'], 'intraday_bar_db')
        self.assertEqual(len(data['points']), 1)
        self.assertEqual(data['points'][0]['open'], 100.0)

    def test_intraday_tape_returns_native_data(self):
        from django.utils import timezone
        IntradayTick.objects.create(
            symbol='VCB',
            timestamp=timezone.now(),
            price=Decimal('102.0'),
            volume=100,
            side='BUY',
            source='vnbroker',
        )
        resp = self.client.get('/core/v1/market-data/intraday-tape/VCB/')
        self.assertEqual(resp.status_code, 200)
        data = unwrapped_json(resp)
        self.assertEqual(data['symbol'], 'VCB')
        self.assertEqual(data['source'], 'intraday_tick_db')
        self.assertEqual(len(data['trades']), 1)
        self.assertEqual(data['trades'][0]['price'], 102.0)

    # --- Symbol normalization ---
    def test_symbol_is_uppercased_prices(self):
        resp = self.client.get('/core/v1/market-data/intraday-prices/vcb/')
        self.assertEqual(unwrapped_json(resp)['symbol'], 'VCB')

    def test_symbol_is_uppercased_tape(self):
        resp = self.client.get('/core/v1/market-data/intraday-tape/vcb/')
        self.assertEqual(unwrapped_json(resp)['symbol'], 'VCB')