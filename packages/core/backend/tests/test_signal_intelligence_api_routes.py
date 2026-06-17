"""
Native signal_intelligence API route tests.

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
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from signal_intelligence.views import OrderFlowEventListView, AlertCenterFeedView, WhaleFeedAggregateView
from identity_access.models import CoreTenant, UserProfile
from user_workspace.models import Watchlist, WatchlistItem


class SignalIntelligenceApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='signal-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='signal-tenant',
            display_name='Signal Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        UserProfile.objects.create(
            user=self.user,
            tenant=self.tenant,
            display_name='Signal Owner',
            language=UserProfile.LanguageChoices.VI,
        )
        # Track VCB, FPT, HPG so default tests can query them
        self.watchlist = Watchlist.objects.create(user=self.user, tenant=self.tenant, name='Default WL', is_default=True)
        WatchlistItem.objects.create(watchlist=self.watchlist, symbol='FPT')
        WatchlistItem.objects.create(watchlist=self.watchlist, symbol='HPG')
        WatchlistItem.objects.create(watchlist=self.watchlist, symbol='VCB')

    def test_unified_alert_route_is_native_and_cursor_paginated(self):
        UnifiedAlert.objects.create(
            alert_type='whale',
            symbol='FPT',
            severity='high',
            title='Mua lớn',
            body='Đã phát hiện dòng tiền mua lớn',
            value=5_000_000_000,
            direction='buy',
            session_date=datetime.date(2026, 5, 8),
            triggered_at=timezone.now(),
            source_ref='signal-test-1',
        )

        resolver = resolve('/core/v1/signals/alert-center/feed')
        self.assertIs(resolver.func.cls, AlertCenterFeedView)

        response = self.client.get('/core/v1/signals/alert-center/feed?symbol=FPT')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['results'][0]['symbol'], 'FPT')

    def test_whale_feed_route_is_native_and_returns_list(self):
        alert = UnifiedAlert.objects.create(
            alert_type='whale',
            symbol='HPG',
            severity='medium',
            title='Dòng tiền lớn',
            body='Đã phát hiện tín hiệu whale',
            value=7_000_000_000,
            direction='buy',
            session_date=datetime.date(2026, 5, 8),
            triggered_at=timezone.now(),
            source_ref='signal-test-2',
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='HPG',
            session_date=datetime.date(2026, 5, 8),
            side='buy',
            price=25000,
            volume=280000,
            matched_value=7000000000,
            is_dark_flow=False,
            order_id='order-test-2',
            executed_at=timezone.now(),
        )

        resolver = resolve('/core/v1/whale-feed')
        self.assertIs(resolver.func.cls, WhaleFeedAggregateView)

        response = self.client.get('/core/v1/whale-feed?symbol=HPG')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)
        self.assertEqual(response.data['symbol'], 'HPG')

    def test_order_flow_route_is_native_and_returns_list(self):
        alert = UnifiedAlert.objects.create(
            alert_type='signal',
            symbol='VCB',
            severity='low',
            title='Order flow',
            body='Event order flow',
            value=1_000_000_000,
            direction='sell',
            session_date=datetime.date(2026, 5, 8),
            triggered_at=timezone.now(),
            source_ref='signal-test-3',
        )
        OrderFlowEvent.objects.create(
            symbol='VCB',
            session_date=datetime.date(2026, 5, 8),
            signal_type='whale_sell',
            side='sell',
            strength=0.72,
            whale_intensity=0.61,
            cvd_at_signal=-0.34,
            price_at_signal=Decimal('88500.00'),
            volume_at_signal=1_250_000,
            source_ref='signal-test-3',
            unified_alert=alert,
            metadata={'kind': 'test'},
            triggered_at=timezone.now(),
        )

        resolver = resolve('/core/v1/signals/order-flow/VCB/')
        self.assertIs(resolver.func.cls, OrderFlowEventListView)

        response = self.client.get('/core/v1/signals/order-flow/VCB/?signal_type=whale_sell')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['results'][0]['symbol'], 'VCB')

    def test_alert_center_feed_tenant_isolation(self):
        # 1. Create TenantB and UserB (self.user and self.tenant already set up in setUp)
        user_b = User.objects.create_user(username='user-b', password='testpass123')
        tenant_b = CoreTenant.objects.create(
            owner_user=user_b,
            tenant_code='tenant-b-code',
            display_name='Tenant B',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )

        # 2. Create UserProfile for UserB (self.user's UserProfile already created in setUp)
        UserProfile.objects.create(
            user=user_b,
            tenant=tenant_b,
            display_name='User B',
            language=UserProfile.LanguageChoices.VI,
        )

        # 3. Create symbols scopes: UserA tracks FPT, UserB tracks HPG
        # Clear default tracked symbols to prevent bleed
        WatchlistItem.objects.filter(watchlist=self.watchlist).delete()
        WatchlistItem.objects.create(watchlist=self.watchlist, symbol='FPT')

        watchlist_b = Watchlist.objects.create(user=user_b, tenant=tenant_b, name='WL B', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist_b, symbol='HPG')

        # 4. Create global alerts Alert1 (FPT) and Alert2 (HPG)
        alert_fpt = UnifiedAlert.objects.create(
            alert_type='signal',
            symbol='FPT',
            severity='high',
            title='FPT Signal',
            body='Signal body FPT',
            value=2_000_000_000,
            direction='buy',
            session_date=datetime.date(2026, 5, 8),
            triggered_at=timezone.now(),
            source_ref='signal-fpt-1',
        )
        alert_hpg = UnifiedAlert.objects.create(
            alert_type='signal',
            symbol='HPG',
            severity='high',
            title='HPG Signal',
            body='Signal body HPG',
            value=3_000_000_000,
            direction='buy',
            session_date=datetime.date(2026, 5, 8),
            triggered_at=timezone.now(),
            source_ref='signal-hpg-1',
        )

        # 5. Authenticate UserA and query the feed
        self.client.force_authenticate(user=self.user)
        response_a = self.client.get('/core/v1/signals/alert-center/feed')
        self.assertEqual(response_a.status_code, status.HTTP_200_OK)
        # Verify that UserA ONLY sees FPT and NOT HPG
        results_a = response_a.data.get('results', [])
        symbols_a = [alert['symbol'] for alert in results_a]
        self.assertIn('FPT', symbols_a)
        self.assertNotIn('HPG', symbols_a)

        # 6. Authenticate UserB and query the feed
        self.client.force_authenticate(user=user_b)
        response_b = self.client.get('/core/v1/signals/alert-center/feed')
        self.assertEqual(response_b.status_code, status.HTTP_200_OK)
        # Verify that UserB ONLY sees HPG and NOT FPT
        results_b = response_b.data.get('results', [])
        symbols_b = [alert['symbol'] for alert in results_b]
        self.assertIn('HPG', symbols_b)
        self.assertNotIn('FPT', symbols_b)