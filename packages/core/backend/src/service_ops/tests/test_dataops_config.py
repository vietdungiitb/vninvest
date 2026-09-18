"""C4 — MarketDataRuntimeConfig validation hardening tests (CFG-06)."""

from django.test import SimpleTestCase

from service_ops.domain_configs import MarketDataRuntimeConfig, QueueTierRuntimeConfig


class MarketDataConfigBoundsTestCase(SimpleTestCase):
    def test_poll_interval_above_one_hour_is_rejected(self):
        config = MarketDataRuntimeConfig(
            hot_user_demand=QueueTierRuntimeConfig(
                poll_interval_seconds=5000,
                max_batch_size=50,
                max_dispatch_per_cycle=50,
            ),
        )

        errors = config.validate()

        self.assertTrue(any('hot_user_demand.poll_interval_seconds' in error and '<= 3600' in error for error in errors))

    def test_max_batch_size_above_500_is_rejected(self):
        config = MarketDataRuntimeConfig(
            cold_full_market=QueueTierRuntimeConfig(
                poll_interval_seconds=900,
                max_batch_size=600,
                max_dispatch_per_cycle=600,
            ),
        )

        errors = config.validate()

        self.assertTrue(any('cold_full_market.max_batch_size' in error and '<= 500' in error for error in errors))

    def test_max_dispatch_above_1000_is_rejected(self):
        config = MarketDataRuntimeConfig(
            warm_liquid_market=QueueTierRuntimeConfig(
                poll_interval_seconds=120,
                max_batch_size=400,
                max_dispatch_per_cycle=1200,
            ),
        )

        errors = config.validate()

        self.assertTrue(any('warm_liquid_market.max_dispatch_per_cycle' in error and '<= 1000' in error for error in errors))

    def test_dispatch_greater_than_double_batch_is_rejected(self):
        config = MarketDataRuntimeConfig(
            hot_user_demand=QueueTierRuntimeConfig(
                poll_interval_seconds=30,
                max_batch_size=50,
                max_dispatch_per_cycle=150,
            ),
        )

        errors = config.validate()

        self.assertTrue(any('hot_user_demand.max_dispatch_per_cycle' in error and 'không nên vượt quá' in error for error in errors))
