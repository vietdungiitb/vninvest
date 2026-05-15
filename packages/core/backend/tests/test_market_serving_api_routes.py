"""
Native market_serving API route tests.

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

from market_serving.models import SessionFacts, SessionFactsBucket, SymbolSnapshot
from market_serving.views import SessionFactsCvdView, SessionFactsDetailView, SessionFactsListView, SymbolSnapshotDetailView, SymbolSnapshotListView


class MarketServingApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='market-serving-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

    def test_symbol_snapshot_list_and_detail_routes_are_native(self):
        snapshot = SymbolSnapshot.objects.create(
            symbol='VCB',
            session_date=datetime.date(2026, 5, 8),
            price=Decimal('88500.00'),
            price_change=Decimal('500.00'),
            price_change_pct=Decimal('0.5679'),
            volume=1_500_000,
            market_status='open',
            source='live',
        )

        resolver = resolve('/api/market/symbol-snapshot/')
        self.assertIs(resolver.func.cls, SymbolSnapshotListView)

        list_response = self.client.get('/api/market/symbol-snapshot/?symbol=VCB')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'][0]['symbol'], 'VCB')

        resolver_detail = resolve('/api/market/symbol-snapshot/VCB/')
        self.assertIs(resolver_detail.func.cls, SymbolSnapshotDetailView)

        detail_response = self.client.get('/api/market/symbol-snapshot/VCB/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['symbol'], 'VCB')
        self.assertEqual(detail_response.data['_source'], 'db-read')

    def test_session_facts_list_and_detail_routes_are_native(self):
        facts = SessionFacts.objects.create(
            symbol='FPT',
            session_date=datetime.date(2026, 5, 8),
            cvd_normalized=0.42,
            buy_strength=0.68,
            institutional_strength=0.55,
            whale_net_flow=5_000_000_000,
            dark_flow_score=0.12,
            total_buy_volume=800_000,
            total_sell_volume=700_000,
            source='computed',
        )
        SessionFactsBucket.objects.create(
            session_facts=facts,
            symbol='FPT',
            session_date=datetime.date(2026, 5, 8),
            window='15m',
            bucket_minutes=15,
            bucket_ts=datetime.datetime.fromisoformat('2026-05-08T09:00:00+07:00'),
            cumulative_cvd=5_000_000_000.0,
            buy_strength=66.5,
            institutional_strength=59.2,
            buy_volume=800_000,
            sell_volume=700_000,
        )

        resolver = resolve('/api/market/session-facts/')
        self.assertIs(resolver.func.cls, SessionFactsListView)

        list_response = self.client.get('/api/market/session-facts/?symbol=FPT')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'][0]['symbol'], 'FPT')

        resolver_detail = resolve('/api/market/session-facts/FPT/')
        self.assertIs(resolver_detail.func.cls, SessionFactsDetailView)

        resolver_cvd = resolve('/api/market/session-facts/FPT/cvd/')
        self.assertIs(resolver_cvd.func.cls, SessionFactsCvdView)

        detail_response = self.client.get('/api/market/session-facts/FPT/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['symbol'], 'FPT')
        self.assertEqual(detail_response.data['_source'], 'db-read')

        cvd_response = self.client.get('/api/market/session-facts/FPT/cvd/?window=15m')
        self.assertEqual(cvd_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cvd_response.data['symbol'], 'FPT')
        self.assertEqual(cvd_response.data['cvd_series'][0]['buy_strength'], 66.5)
        self.assertEqual(cvd_response.data['cvd_series'][0]['institutional_strength'], 59.2)
        self.assertEqual(cvd_response.data['_source'], 'db-read')