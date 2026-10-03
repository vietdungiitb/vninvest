"""C5 — DataOps runtime config optimistic lock (CONFIG_CONFLICT) + rollback audit (CFG-07)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ConfigChangeAudit, ServiceConfig
from service_ops.registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service

from service_ops.tests.envelope import unwrapped_json

User = get_user_model()

VALID_PAYLOAD = {
    'decay_days': 7,
    'parity_snapshot_retention_days': 30,
    'hot_user_demand': {'poll_interval_seconds': 30, 'max_batch_size': 50, 'max_dispatch_per_cycle': 50},
    'warm_liquid_market': {'poll_interval_seconds': 120, 'max_batch_size': 50, 'max_dispatch_per_cycle': 50},
    'cold_full_market': {'poll_interval_seconds': 900, 'max_batch_size': 200, 'max_dispatch_per_cycle': 200},
    'recovery_backlog': {'poll_interval_seconds': 600, 'max_batch_size': 50, 'max_dispatch_per_cycle': 50},
}


class DataOpsConfigConflictApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-dataops-config-lock-admin',
            email='soc-dataops-config-lock-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])
        cls.matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        ServiceConfig.objects.filter(service=self.matrix_service).delete()

    def _seed_current_config(self, decay_days=7):
        payload = dict(VALID_PAYLOAD)
        payload['decay_days'] = decay_days
        return ServiceConfig.objects.create(
            service=self.matrix_service,
            config_payload=payload,
            applied_by='seed-user',
            change_reason='seed',
        )

    def test_stale_expected_updated_at_returns_409_conflict(self):
        seeded = self._seed_current_config()
        stale_expected = '2000-01-01T00:00:00+00:00'

        response = self.client.post(
            '/api/soc/dataops/runtime-config/',
            {
                'config_payload': {'decay_days': 9},
                'expected_updated_at': stale_expected,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        payload = unwrapped_json(response)
        self.assertEqual(payload['code'], 'CONFIG_CONFLICT')
        self.assertIn('Cấu hình đã được cập nhật', payload['detail'])
        self.assertEqual(payload['field_errors']['updated_at'], seeded.applied_at.isoformat())
        self.assertEqual(ServiceConfig.objects.filter(service=self.matrix_service).count(), 1)
        self.assertEqual(ConfigChangeAudit.objects.count(), 0)

    def test_matching_expected_updated_at_applies_and_audits(self):
        seeded = self._seed_current_config()
        expected = seeded.applied_at.isoformat()

        response = self.client.post(
            '/api/soc/dataops/runtime-config/',
            {
                'config_payload': {'decay_days': 9},
                'expected_updated_at': expected,
                'change_reason': 'tang theo mua bao cao',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = unwrapped_json(response)
        self.assertEqual(payload['config']['decay_days'], 9)
        latest = ServiceConfig.objects.filter(service=self.matrix_service, is_current=True).first()
        self.assertEqual(latest.config_payload['decay_days'], 9)
        audit = ConfigChangeAudit.objects.filter(service=self.matrix_service).first()
        self.assertEqual(audit.action, 'apply')
        self.assertEqual(audit.before_snapshot['decay_days'], 7)
        self.assertEqual(audit.after_snapshot['decay_days'], 9)
        self.assertEqual(audit.change_summary, 'tang theo mua bao cao')

    def test_rollback_audit_action_is_recorded(self):
        seeded = self._seed_current_config()
        expected = seeded.applied_at.isoformat()

        response = self.client.post(
            '/api/soc/dataops/runtime-config/',
            {
                'config_payload': {'decay_days': 7},
                'expected_updated_at': expected,
                'change_reason': 'rollback ve config cu',
                'audit_action': 'rollback',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        audit = ConfigChangeAudit.objects.filter(service=self.matrix_service).first()
        self.assertEqual(audit.action, 'rollback')