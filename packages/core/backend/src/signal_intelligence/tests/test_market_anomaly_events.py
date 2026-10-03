from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from identity_access.models import UserProfile
from market_serving.models import SymbolSnapshot
from signal_intelligence.materializers import materialize_market_anomaly_alerts, materialize_stale_quote_alerts
from signal_intelligence.models import MarketAnomalyEvent, UnifiedAlert
from user_workspace.models import Watchlist, WatchlistItem


class MarketAnomalyEventTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='market-anomaly-user', password='password123')
        UserProfile.objects.create(user=self.user, whale_alert_threshold=100)
        watchlist = Watchlist.objects.create(user=self.user, name='Anomaly', is_default=True)
        WatchlistItem.objects.create(watchlist=watchlist, symbol='VCI')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_price_shock_family_emits_from_materializer(self):
        now = timezone.now()
        SymbolSnapshot.objects.create(
            symbol='VCI',
            session_date=now.date(),
            price=Decimal('42000.00'),
            price_change=Decimal('3500.00'),
            price_change_pct=Decimal('8.9'),
            volume=1000,
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )

        materialize_market_anomaly_alerts.run(symbol='VCI')

        response = self.client.get('/core/v1/signals/alert-center/feed', {'alert_family': 'price_shock'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['results']), 1)
        self.assertEqual(response.json()['results'][0]['alert_family'], 'price_shock')
        alert = UnifiedAlert.objects.get(source_ref=f'market_anomaly:VCI:{now.date().isoformat()}')
        fact = MarketAnomalyEvent.objects.get(source_ref=f'market_anomaly:VCI:{now.date().isoformat()}')
        self.assertEqual(fact.event_type, MarketAnomalyEvent.EventTypeChoices.PRICE_SHOCK)
        self.assertEqual(fact.unified_alert_id, alert.id)

    def test_stale_quote_family_emits_from_materializer(self):
        now = timezone.now()
        snapshot = SymbolSnapshot.objects.create(
            symbol='VCI',
            session_date=now.date(),
            price=Decimal('41000.00'),
            price_change=Decimal('0.00'),
            price_change_pct=Decimal('0.0'),
            volume=1000,
            market_status=SymbolSnapshot.MarketStatusChoices.OPEN,
            source=SymbolSnapshot.SourceChoices.CORE,
            stale=False,
        )
        SymbolSnapshot.objects.filter(pk=snapshot.pk).update(stale=True)

        materialize_stale_quote_alerts.run(symbol='VCI')

        response = self.client.get('/core/v1/signals/alert-center/feed', {'alert_family': 'stale_quote'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()['results']), 1)
        self.assertEqual(response.json()['results'][0]['alert_family'], 'stale_quote')
        alert = UnifiedAlert.objects.get(source_ref=f'stale_quote:VCI:{now.date().isoformat()}')
        fact = MarketAnomalyEvent.objects.get(source_ref=f'stale_quote:VCI:{now.date().isoformat()}')
        self.assertEqual(fact.event_type, MarketAnomalyEvent.EventTypeChoices.STALE_QUOTE)
        self.assertEqual(fact.unified_alert_id, alert.id)
