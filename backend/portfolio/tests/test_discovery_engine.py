from django.test import TestCase
from django.contrib.auth import get_user_model
from portfolio.models import WhaleAdvisory, TrackedSymbol
from portfolio.services import WhaleSignalEngine

User = get_user_model()

class DiscoveryEngineTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="discovery-test", password="password123")
        self.symbol = "FPT"

    def test_calculate_whale_intensity(self):
        # Case 1: Low value, no dark flow
        intensity = WhaleSignalEngine.calculate_whale_intensity(
            value_vnd=100_000_000, 
            threshold_vnd=500_000_000, 
            dark_flow_strength=0
        )
        # Ratio = 0.2. Component 1 = 0.2 * 25 = 5. Component 2 = 0. Total = 5.
        self.assertEqual(intensity, 5)

        # Case 2: High value, high dark flow
        intensity = WhaleSignalEngine.calculate_whale_intensity(
            value_vnd=2_000_000_000, 
            threshold_vnd=1_000_000_000, 
            dark_flow_strength=100
        )
        # Ratio = 2.0. Component 1 = 50. Component 2 = 50. Total = 100.
        self.assertEqual(intensity, 100)

        # Case 3: Medium everything
        intensity = WhaleSignalEngine.calculate_whale_intensity(
            value_vnd=500_000_000, 
            threshold_vnd=500_000_000, 
            dark_flow_strength=50
        )
        # Ratio = 1.0. Component 1 = 25. Component 2 = 25. Total = 50.
        self.assertEqual(intensity, 50)

    def test_is_symbol_discovery_candidate(self):
        # Initially not tracked -> Candidate
        self.assertTrue(WhaleSignalEngine.is_symbol_discovery_candidate(self.user, self.symbol))

        # Start tracking -> No longer candidate
        TrackedSymbol.objects.create(user=self.user, symbol=self.symbol)
        self.assertFalse(WhaleSignalEngine.is_symbol_discovery_candidate(self.user, self.symbol))

    def test_resolve_discovery_bucket(self):
        # 85+ -> Anomaly
        self.assertEqual(WhaleSignalEngine.resolve_discovery_bucket(90), 'anomaly')
        
        # 60+ and is_new -> Potential
        self.assertEqual(WhaleSignalEngine.resolve_discovery_bucket(70, is_new=True), 'potential')
        
        # Others -> Standard
        self.assertEqual(WhaleSignalEngine.resolve_discovery_bucket(50, is_new=True), 'standard')
        self.assertEqual(WhaleSignalEngine.resolve_discovery_bucket(70, is_new=False), 'standard')
