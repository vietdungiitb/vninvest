"""C3 — DataOps runtime config audit trail contract tests (CFG-04/CFG-05 read)."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ConfigChangeAudit
from service_ops.registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service

from service_ops.tests.envelope import unwrapped_json

User = get_user_model()


class DataOpsConfigAuditApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-dataops-config-admin',
            email='soc-dataops-config-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])
        cls.matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_audit(self, **overrides):
        payload = {
            'service': self.matrix_service,
            'action': 'apply',
            'actor': 'alice',
            'before_snapshot': {'decay_days': 7},
            'after_snapshot': {'decay_days': 9},
            'change_summary': 'tang hot tier',
            'request_id': 'req-001',
        }
        payload.update(overrides)
        return ConfigChangeAudit.objects.create(**payload)

    def test_audit_exposes_action_before_after_and_request_id(self):
        self._create_audit()

        response = self.client.get('/api/soc/dataops/runtime-config/audit/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = unwrapped_json(response)
        self.assertEqual(payload['count'], 1)
        entry = payload['results'][0]
        self.assertEqual(entry['action'], 'apply')
        self.assertEqual(entry['actor'], 'alice')
        self.assertEqual(entry['change_summary'], 'tang hot tier')
        self.assertEqual(entry['before_snapshot'], {'decay_days': 7})
        self.assertEqual(entry['after_snapshot'], {'decay_days': 9})
        self.assertEqual(entry['request_id'], 'req-001')
        self.assertEqual(entry['service_key'], SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])

    def test_audit_is_ordered_newest_first_and_paginated(self):
        self._create_audit(change_summary='first')
        self._create_audit(change_summary='second')
        self._create_audit(change_summary='third')

        response = self.client.get('/api/soc/dataops/runtime-config/audit/')

        payload = unwrapped_json(response)
        self.assertEqual(payload['count'], 3)
        summaries = [entry['change_summary'] for entry in payload['results']]
        self.assertEqual(summaries[0], 'third')
        self.assertEqual(summaries[-1], 'first')

    def test_audit_scopes_to_matrix_service_key(self):
        other_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
        self._create_audit(change_summary='matrix-change')
        self._create_audit(service=other_service, change_summary='vnbroker-change')

        response = self.client.get('/api/soc/dataops/runtime-config/audit/')

        payload = unwrapped_json(response)
        summaries = [entry['change_summary'] for entry in payload['results']]
        self.assertEqual(summaries, ['matrix-change'])
