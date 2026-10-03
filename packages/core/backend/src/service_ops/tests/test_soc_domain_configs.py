from django.test import SimpleTestCase

from service_ops.domain_configs import (
    MarketDataRuntimeConfig,
    PrefetchTimePolicyConfig,
    QueueTierRuntimeConfig,
    ScreenerDomainConfig,
    SignalServicesDomainConfig,
    VnbrokerDomainConfig,
    VnbrokerTimeoutConfig,
)


class DomainConfigValidationTestCase(SimpleTestCase):
    def test_default_domain_configs_validate_cleanly(self):
        self.assertEqual(VnbrokerTimeoutConfig().validate(), [])
        self.assertEqual(VnbrokerDomainConfig().validate(), [])
        self.assertEqual(MarketDataRuntimeConfig().validate(), [])
        self.assertEqual(PrefetchTimePolicyConfig().validate(), [])
        self.assertEqual(SignalServicesDomainConfig().validate(), [])
        self.assertEqual(ScreenerDomainConfig().validate(), [])

    def test_market_data_runtime_config_from_dict_accepts_partial_queue_overrides(self):
        config = MarketDataRuntimeConfig.from_dict({
            'decay_days': 9,
            'parity_snapshot_retention_days': 14,
            'hot_user_demand': {
                'poll_interval_seconds': 15,
                'max_batch_size': 25,
                'max_dispatch_per_cycle': 10,
            },
        })

        self.assertEqual(config.decay_days, 9)
        self.assertEqual(config.parity_snapshot_retention_days, 14)
        self.assertEqual(config.hot_user_demand.poll_interval_seconds, 15)
        self.assertEqual(config.hot_user_demand.max_batch_size, 25)
        self.assertEqual(config.hot_user_demand.max_dispatch_per_cycle, 10)
        self.assertEqual(config.warm_liquid_market.poll_interval_seconds, 120)
        self.assertEqual(config.warm_liquid_market.max_batch_size, 50)
        self.assertEqual(config.warm_liquid_market.max_dispatch_per_cycle, 50)

    def test_market_data_runtime_config_validation_rejects_invalid_queue_settings(self):
        config = MarketDataRuntimeConfig(
            decay_days=0,
            parity_snapshot_retention_days=0,
            hot_user_demand=QueueTierRuntimeConfig(
                poll_interval_seconds=5,
                max_batch_size=0,
                max_dispatch_per_cycle=0,
            ),
        )

        errors = config.validate()

        self.assertTrue(any('decay_days' in error for error in errors))
        self.assertTrue(any('parity_snapshot_retention_days' in error for error in errors))
        self.assertTrue(any('hot_user_demand.poll_interval_seconds' in error for error in errors))
        self.assertTrue(any('hot_user_demand.max_batch_size' in error for error in errors))
        self.assertTrue(any('hot_user_demand.max_dispatch_per_cycle' in error for error in errors))

    def test_vnbroker_from_dict_builds_nested_timeout_schema_and_accepts_legacy_aliases(self):
        config = VnbrokerDomainConfig.from_dict({
            'primary_provider': 'VCI',
            'fallback_providers': ['KBS', 'dnse', 'KBS'],
            'connect_timeout': 7.5,
            'read_timeout': 45.0,
            'pool_connections': 6,
            'retry_backoff_factor': 0.75,
            'enabled': False,
            'unexpected': 'ignored',
        })

        self.assertIsInstance(config.timeout, VnbrokerTimeoutConfig)
        self.assertEqual(config.timeout.connect, 7.5)
        self.assertEqual(config.timeout.read, 45.0)
        self.assertEqual(config.timeout.pool, 6)
        self.assertEqual(config.preferred_provider, 'vci')
        self.assertEqual(config.fallback_providers, ['kbs', 'dnse'])
        self.assertEqual(config.retry_delay_seconds, 0.75)
        self.assertFalse(config.enabled)
        self.assertFalse(hasattr(config, 'unexpected'))

    def test_vnbroker_timeout_validation_rejects_out_of_range_values(self):
        errors = VnbrokerTimeoutConfig(connect=0.5, read=301.0, write=0.0, pool=0.5).validate()

        self.assertTrue(any('timeout.connect' in error for error in errors))
        self.assertTrue(any('timeout.read' in error for error in errors))
        self.assertTrue(any('timeout.write' in error for error in errors))
        self.assertTrue(any('timeout.pool' in error for error in errors))

    def test_prefetch_validation_rejects_invalid_profile_and_intervals(self):
        config = PrefetchTimePolicyConfig(
            active_profile='overnight',
            market_open_interval_seconds=5,
            cache_ttl_seconds=4,
        )

        errors = config.validate()

        self.assertTrue(any('active_profile' in error for error in errors))
        self.assertTrue(any('market_open_interval_seconds' in error for error in errors))
        self.assertTrue(any('cache_ttl_seconds' in error for error in errors))

    def test_signals_validation_rejects_bad_thresholds(self):
        config = SignalServicesDomainConfig(
            whale_threshold_vnd=999_999,
            whale_top_pct=1.5,
            dark_pool_block_ratio_min=1.0,
            detection_task_interval_seconds=5,
        )

        errors = config.validate()

        self.assertTrue(any('whale_threshold_vnd' in error for error in errors))
        self.assertTrue(any('whale_top_pct' in error for error in errors))
        self.assertTrue(any('dark_pool_block_ratio_min' in error for error in errors))
        self.assertTrue(any('detection_task_interval_seconds' in error for error in errors))

    def test_screener_validation_requires_valid_rules_and_prefix(self):
        config = ScreenerDomainConfig(
            rules=[{'type': 'unknown-rule'}],
            scan_interval_seconds=5,
            redis_channel_prefix='screener-results',
        )

        errors = config.validate()

        self.assertTrue(any("Rule[0].type" in error for error in errors))
        self.assertTrue(any("Rule[0] phải có 'threshold' hoặc 'value'" in error for error in errors))
        self.assertTrue(any('scan_interval_seconds' in error for error in errors))
        self.assertTrue(any('redis_channel_prefix' in error for error in errors))