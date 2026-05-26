from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import DailyPrice
from market_serving.models import SessionFacts, SessionFactsBucket, SymbolSnapshot
from signal_intelligence.models import UnifiedAlert, WhaleAlertCanonical


User = get_user_model()


class PortfolioWhaleAnalyticsNativeApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='whale-native-user',
            email='whale-native@test.local',
            password='pass123',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_core_v1_workspace_whale_analytics_route_returns_snapshot_contract(self):
        trade_date = timezone.localdate()
        previous_date = trade_date - timedelta(days=1)
        market_open = timezone.make_aware(
            timezone.datetime.combine(trade_date, timezone.datetime.min.time().replace(hour=9)),
            timezone.get_current_timezone(),
        )

        DailyPrice.objects.create(
            symbol='TPB',
            date=previous_date,
            open=17.9,
            high=18.1,
            low=17.7,
            close=18.0,
            volume=90000,
            source='core',
        )
        DailyPrice.objects.create(
            symbol='TPB',
            date=trade_date,
            open=18.1,
            high=18.7,
            low=17.95,
            close=18.45,
            volume=125000,
            source='core',
        )
        SymbolSnapshot.objects.create(
            symbol='TPB',
            session_date=trade_date,
            price=Decimal('18.45'),
            price_change=Decimal('0.45'),
            price_change_pct=Decimal('2.5000'),
            volume=125000,
            reference_price=Decimal('18.00'),
            high=Decimal('18.70'),
            low=Decimal('17.95'),
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )

        facts = SessionFacts.objects.create(
            symbol='TPB',
            session_date=trade_date,
            cvd_normalized=64.0,
            buy_strength=61.5,
            institutional_strength=74.2,
            whale_net_flow=350000000,
            dark_flow_score=58.0,
            total_buy_volume=950000000,
            total_sell_volume=600000000,
            source=SessionFacts.SourceChoices.CACHE,
            stale=False,
        )
        SessionFactsBucket.objects.create(
            session_facts=facts,
            symbol='TPB',
            session_date=trade_date,
            window='15m',
            bucket_minutes=15,
            bucket_ts=market_open + timedelta(minutes=15),
            cumulative_cvd=150000000,
            buy_strength=58.0,
            institutional_strength=68.0,
            buy_volume=450000000,
            sell_volume=300000000,
        )
        SessionFactsBucket.objects.create(
            session_facts=facts,
            symbol='TPB',
            session_date=trade_date,
            window='15m',
            bucket_minutes=15,
            bucket_ts=market_open + timedelta(minutes=30),
            cumulative_cvd=350000000,
            buy_strength=61.5,
            institutional_strength=74.2,
            buy_volume=950000000,
            sell_volume=600000000,
        )

        alert = UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            symbol='TPB',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            confidence=0.93,
            title='Whale buy TPB',
            body='',
            value=Decimal('1850000000'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=trade_date,
            triggered_at=market_open + timedelta(minutes=30),
            source_ref='native-whale-test',
            metadata={'event_score': 88, 'threshold': 1000000000, 'session_percentile': 96.5},
            evidence={},
        )
        WhaleAlertCanonical.objects.create(
            alert=alert,
            symbol='TPB',
            session_date=trade_date,
            side=WhaleAlertCanonical.SideChoices.BUY,
            price=Decimal('18.42'),
            volume=100000,
            matched_value=1850000000,
            is_dark_flow=False,
            order_id='whale-native-order-1',
            executed_at=market_open + timedelta(minutes=31),
        )

        response = self.client.get('/core/v1/workspace/whale-analytics/TPB/?timeframe=session&compact=0')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'TPB')
        self.assertEqual(payload['timeframe'], 'session')
        self.assertEqual(payload['trade_date'], trade_date.isoformat())
        self.assertEqual(payload['quality_flags']['contract_version'], 'core-whale-compat-v1')
        self.assertTrue(payload['quality_flags']['has_flow_data'])
        self.assertEqual(payload['materialization']['read_path'], 'facts_first')
        self.assertEqual(len(payload['bubble_series']), 1)
        self.assertEqual(payload['bubble_series'][0]['matched_value'], 1850000000.0)
        self.assertGreaterEqual(len(payload['flow_series']['cvd']), 1)
        self.assertEqual(payload['flow_series']['institutional_strength'][-1]['value'], 74.2)
        self.assertFalse(payload['meta']['degraded_mode'])