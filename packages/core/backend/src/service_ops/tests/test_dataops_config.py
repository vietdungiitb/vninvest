"""C4 + C6 — MarketDataRuntimeConfig validation hardening & schema tests (CFG-06/CFG-09)."""

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from service_ops.domain_configs import MarketDataRuntimeConfig, QueueTierRuntimeConfig
from service_ops.tests.envelope import unwrapped_json

User = get_user_model()


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


class DataOpsConfigSchemaApiTestCase(TestCase):
    """C6 — GET schema returns field metadata incl decay_days (CFG-09)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='soc-dataops-config-schema-admin',
            email='soc-dataops-config-schema-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_schema_returns_fields_with_bounds_and_defaults(self):
        response = self.client.get('/api/soc/dataops/runtime-config/schema/')

        self.assertEqual(response.status_code, 200)
        fields = unwrapped_json(response)['fields']
        keys = [field['key'] for field in fields]
        self.assertIn('decay_days', keys)
        self.assertIn('parity_snapshot_retention_days', keys)
        self.assertIn('hot_user_demand.poll_interval_seconds', keys)
        self.assertIn('cold_full_market.max_dispatch_per_cycle', keys)
        self.assertIn('recovery_backlog.max_batch_size', keys)
        deductions = [field for field in fields if field['key'] == 'decay_days'][0]
        self.assertEqual(deductions['type'], 'int')
        self.assertEqual(deductions['max'], 365)
        self.assertEqual(deductions['default'], 7)
        poll = [field for field in fields if field['key'] == 'hot_user_demand.poll_interval_seconds'][0]
        self.assertEqual(poll['min'], 10)
        self.assertEqual(poll['max'], 3600)
        self.assertEqual(poll['default'], 30)

    def test_schema_available_on_canonical_scraping_namespace(self):
        response = self.client.get('/core/v1/operator/scraping/dataops/runtime-config/schema/')

        self.assertEqual(response.status_code, 200)
        keys = [field['key'] for field in unwrapped_json(response)['fields']]
        self.assertIn('decay_days', keys)
