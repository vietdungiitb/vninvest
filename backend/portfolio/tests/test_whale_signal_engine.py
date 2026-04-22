"""
Tests for WhaleSignalEngine Service.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from decimal import Decimal

from portfolio.models import UserConfig, TrackedSymbol
from portfolio.services import WhaleSignalEngine

class WhaleSignalEngineTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tester', password='password123')
        self.user_cfg = UserConfig.objects.create(
            user=self.user,
            whale_alert_threshold=500, # 500M VND
        )
        self.symbol = 'VNM'
        self.default_vnd = 500 * 1_000_000

    def test_resolve_threshold_default(self):
        """Should resolve to user default if no symbol override exists."""
        threshold, source = WhaleSignalEngine.resolve_threshold_vnd(self.user, self.symbol)
        self.assertEqual(threshold, self.default_vnd)
        self.assertEqual(source, 'user_default')

    def test_resolve_threshold_override(self):
        """Should resolve to symbol override if it exists."""
        TrackedSymbol.objects.create(
            user=self.user,
            symbol=self.symbol,
            whale_alert_threshold_million=Decimal('1200.5')
        )
        threshold, source = WhaleSignalEngine.resolve_threshold_vnd(self.user, self.symbol)
        self.assertEqual(threshold, 1200.5 * 1_000_000)
        self.assertEqual(source, 'symbol_override')

    def test_classify_side(self):
        """Should correctly classify basic side strings."""
        self.assertEqual(WhaleSignalEngine.classify_side('BUY'), 'buy')
        self.assertEqual(WhaleSignalEngine.classify_side('SD'), 'sell')
        self.assertEqual(WhaleSignalEngine.classify_side('Neutral'), 'neutral')
        self.assertEqual(WhaleSignalEngine.classify_side(None), 'neutral')

    def test_classify_size(self):
        """Should correctly classify size classes based on VND value."""
        # Shark >= 5B
        self.assertEqual(WhaleSignalEngine.classify_size(6_000_000_000), 'shark')
        # Whale >= 1B
        self.assertEqual(WhaleSignalEngine.classify_size(1_500_000_000), 'whale')
        # Small < 1B
        self.assertEqual(WhaleSignalEngine.classify_size(500_000_000), 'small')

    def test_get_user_threshold_map(self):
        """Should return a map of symbols to their specific thresholds."""
        TrackedSymbol.objects.create(
            user=self.user,
            symbol='SSI',
            whale_alert_threshold_million=Decimal('1000')
        )
        # Symbols: VNM (default 500M), SSI (override 1000M)
        threshold_map = WhaleSignalEngine.get_user_threshold_map(self.user, ['VNM', 'SSI', 'FPT'])
        
        self.assertEqual(threshold_map['VNM'], 500_000_000)
        self.assertEqual(threshold_map['SSI'], 1_000_000_000)
        self.assertEqual(threshold_map['FPT'], 500_000_000) # Fallback to user default

    def test_annotate_queryset_with_threshold(self):
        """Should annotate QuerySet with correct Case-based threshold_vnd."""
        from portfolio.models import IntradayTick
        from datetime import date, time
        
        # Create some ticks
        IntradayTick.objects.create(symbol='VNM', price=100, volume=1000, trade_date=date.today(), trade_time=time(9,0))
        IntradayTick.objects.create(symbol='SSI', price=100, volume=1000, trade_date=date.today(), trade_time=time(9,1))
        
        # Override for SSI
        TrackedSymbol.objects.create(
            user=self.user,
            symbol='SSI',
            whale_alert_threshold_million=Decimal('1500')
        )
        
        qs = IntradayTick.objects.filter(symbol__in=['VNM', 'SSI'])
        annotated_qs = WhaleSignalEngine.annotate_queryset_with_threshold(qs, self.user, ['VNM', 'SSI'])
        
        vnm_tick = annotated_qs.get(symbol='VNM')
        ssi_tick = annotated_qs.get(symbol='SSI')
        
        self.assertEqual(vnm_tick.threshold_vnd, 500_000_000) # User Default
        self.assertEqual(ssi_tick.threshold_vnd, 1_500_000_000) # Override
