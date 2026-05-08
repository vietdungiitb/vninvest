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
from signal_intelligence.views import OrderFlowEventListView, UnifiedAlertListView, WhaleFeedAggregateView


class SignalIntelligenceApiRouteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='signal-owner', password='testpass123')
        self.client.force_authenticate(user=self.user)

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

        resolver = resolve('/api/signals/unified-alert/')
        self.assertIs(resolver.func.cls, UnifiedAlertListView)

        response = self.client.get('/api/signals/unified-alert/?symbol=FPT')

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

        resolver = resolve('/api/signals/whale-feed/')
        self.assertIs(resolver.func.cls, WhaleFeedAggregateView)

        response = self.client.get('/api/signals/whale-feed/?symbol=HPG')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(response.data[0]['symbol'], 'HPG')

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

        resolver = resolve('/api/signals/order-flow/VCB/')
        self.assertIs(resolver.func.cls, OrderFlowEventListView)

        response = self.client.get('/api/signals/order-flow/VCB/?signal_type=whale_sell')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(response.data[0]['symbol'], 'VCB')