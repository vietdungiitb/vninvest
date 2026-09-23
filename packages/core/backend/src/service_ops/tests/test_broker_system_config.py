"""B2.1 tests: BrokerSystemConfig domain validation + mapping purpose.

Chạy: python manage.py test service_ops.tests.test_broker_system_config
"""
from django.test import SimpleTestCase

from service_ops.domain_configs.broker import (
    BROKER_CONFIG_SERVICE_KEY,
    BrokerProviderEntry,
    BrokerSystemConfig,
    get_default_broker_system_config,
)


class BrokerSystemConfigTests(SimpleTestCase):
    def test_defaults_valid_and_purpose_mapping(self):
        cfg = get_default_broker_system_config()
        self.assertEqual(cfg.validate(), [])
        self.assertEqual(cfg.provider_for_purpose('backfill'), 'dnse')
        self.assertEqual(cfg.provider_for_purpose('snapshot'), 'ssi')
        self.assertEqual(cfg.provider_for_purpose('signal'), 'dnse')
        self.assertEqual(BROKER_CONFIG_SERVICE_KEY, 'broker_config')

    def test_purpose_without_provider_fails(self):
        cfg = get_default_broker_system_config()
        for entry in cfg.entries.values():
            entry.purpose_allowlist = []
        errors = cfg.validate()
        self.assertTrue(any("'backfill'" in e for e in errors))

    def test_duplicate_routing_order_fails(self):
        cfg = get_default_broker_system_config()
        cfg.entries['ssi'].routing_order = 0
        errors = cfg.validate()
        self.assertTrue(any('routing_order' in e for e in errors))

    def test_timeout_bounds(self):
        cfg = get_default_broker_system_config()
        cfg.entries['dnse'].timeout = None
        self.assertEqual(cfg.validate(), [])
        from service_ops.domain_configs.broker import BrokerTimeoutConfig
        cfg.entries['dnse'].timeout = BrokerTimeoutConfig(connect=0.1, read=500)
        errors = cfg.validate()
        self.assertEqual(len(errors), 2)

    def test_unknown_provider_rejected(self):
        cfg = BrokerSystemConfig(entries={'foo': BrokerProviderEntry()})
        errors = cfg.validate()
        self.assertTrue(any('foo' in e for e in errors))

    def test_rate_limit_bounds(self):
        cfg = get_default_broker_system_config()
        cfg.entries['tcbs'].requests_per_minute = 0
        cfg.entries['tcbs'].burst_limit = 0
        cfg.entries['tcbs'].max_retries = 99
        errors = cfg.validate()
        self.assertEqual(len(errors), 3)

    def test_quiet_hours_format(self):
        cfg = get_default_broker_system_config()
        cfg.quiet_hours_start = '25:00'
        self.assertTrue(any('quiet_hours_start' in e for e in cfg.validate()))

    def test_roundtrip_from_to_dict(self):
        cfg = get_default_broker_system_config()
        cfg.kill_switch_write = True
        restored = BrokerSystemConfig.from_dict(cfg.to_dict())
        self.assertEqual(restored.to_dict(), cfg.to_dict())
        self.assertEqual(restored.validate(), [])
        # payload thiếu → defaults, không crash
        minimal = BrokerSystemConfig.from_dict({})
        self.assertEqual(minimal.validate(), [])
