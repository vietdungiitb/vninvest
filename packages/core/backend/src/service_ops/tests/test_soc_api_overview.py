"""Focused overview contract tests for the spec-aligned SOC overview endpoints."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ConfigChangeAudit, ServiceConfig, ServiceDefinition, ServiceHealth, ServiceRunLog
from service_ops.registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, ensure_service_registry, get_registered_service

User = get_user_model()


class OverviewApiBaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-overview-admin',
            email='soc-overview-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])
        cls.vnbroker_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class OverviewContractTestCase(OverviewApiBaseTestCase):
    def test_overview_summary_returns_health_breakdown(self):
        response = self.client.get('/api/soc/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('generated_at', payload)
        self.assertIn('summary', payload)
        self.assertIn('by_domain', payload)
        self.assertIn('services', payload)
        self.assertGreaterEqual(payload['summary']['total'], 1)
        self.assertIn(self.vnbroker_service.domain, payload['by_domain'])

    def test_services_list_returns_paginated_services(self):
        response = self.client.get('/api/soc/services/?page_size=100')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('count', payload)
        self.assertIn('results', payload)
        self.assertTrue(any(item['service_key'] == self.vnbroker_service.service_key for item in payload['results']))

    def test_service_detail_includes_current_config_health_and_ownership(self):
        ServiceHealth.objects.update_or_create(
            service=self.vnbroker_service,
            defaults={'status': 'degraded', 'consecutive_failures': 1, 'detail': {'reason': 'latency spike'}},
        )

        response = self.client.get(f'/api/soc/services/{self.vnbroker_service.service_key}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['service_key'], self.vnbroker_service.service_key)
        self.assertIsNotNone(payload['current_config'])
        self.assertEqual(payload['health']['status'], 'degraded')
        self.assertEqual(payload['ownership']['domain'], self.vnbroker_service.domain)

    def test_current_config_endpoint_returns_current_config(self):
        response = self.client.get(f'/api/soc/services/{self.vnbroker_service.service_key}/config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['service_key'], self.vnbroker_service.service_key)
        self.assertIn('config_payload', payload)

    def test_service_health_endpoint_returns_unknown_when_missing(self):
        service = ServiceDefinition.objects.create(
            service_key='overview_health_unknown',
            name='Overview Health Unknown',
            domain='platform',
        )

        response = self.client.get(f'/api/soc/services/{service.service_key}/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['status'], 'unknown')
        self.assertEqual(payload['service_key'], service.service_key)

    def test_service_audit_and_history_endpoints_are_paginated(self):
        ServiceConfig.objects.create(
            service=self.vnbroker_service,
            config_payload={'timeout': {'connect': 8.0}},
            applied_by=self.user.username,
            change_reason='history seed',
        )
        ConfigChangeAudit.objects.create(
            service=self.vnbroker_service,
            action='apply',
            actor=self.user.username,
            before_snapshot={'timeout': {'connect': 5.0}},
            after_snapshot={'timeout': {'connect': 8.0}},
            change_summary='overview audit seed',
            request_id='req-overview-audit',
        )

        audit_response = self.client.get(f'/api/soc/services/{self.vnbroker_service.service_key}/audit/')
        history_response = self.client.get(f'/api/soc/services/{self.vnbroker_service.service_key}/history/')

        self.assertEqual(audit_response.status_code, status.HTTP_200_OK)
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', audit_response.json())
        self.assertIn('results', history_response.json())
        self.assertGreaterEqual(audit_response.json()['count'], 1)
        self.assertGreaterEqual(history_response.json()['count'], 1)

    def test_global_run_logs_and_change_audit_endpoints_are_paginated(self):
        ServiceRunLog.objects.create(
            service=self.vnbroker_service,
            status='queued',
            input_summary={'trigger': 'test'},
            output_summary={},
        )
        ConfigChangeAudit.objects.create(
            service=self.vnbroker_service,
            action='apply',
            actor=self.user.username,
            before_snapshot={'enabled': False},
            after_snapshot={'enabled': True},
            change_summary='global audit seed',
            request_id='req-global-audit',
        )

        run_logs_response = self.client.get('/api/soc/run-logs/?service_key=vnbroker_runtime_config')
        change_audit_response = self.client.get('/api/soc/change-audit/?service_key=vnbroker_runtime_config')

        self.assertEqual(run_logs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(change_audit_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', run_logs_response.json())
        self.assertIn('results', change_audit_response.json())

    def test_service_health_check_trigger_creates_queued_run_log(self):
        response = self.client.post(f'/api/soc/services/{self.vnbroker_service.service_key}/health-check/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        payload = response.json()
        self.assertEqual(payload['service_key'], self.vnbroker_service.service_key)
        self.assertEqual(payload['status'], 'queued')
        self.assertTrue(
            ServiceRunLog.objects.filter(
                service=self.vnbroker_service,
                status='queued',
                input_summary__trigger='manual_health_check',
            ).exists()
        )

    def test_health_status_endpoint_is_not_shadowed_by_service_routes(self):
        response = self.client.get('/api/soc/overview/health-status/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('total_services', payload)
        self.assertIn('health_status_counts', payload)

    def test_service_not_found_returns_standard_error_envelope(self):
        response = self.client.get('/api/soc/services/nonexistent-service/config/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        payload = response.json()
        self.assertEqual(payload['code'], 'SERVICE_NOT_FOUND')
        self.assertIn('detail', payload)
        self.assertIn('timestamp', payload)
        self.assertIn('request_id', payload)


class OverviewAuthContractTestCase(TestCase):
    def test_unauthenticated_requests_use_standard_error_envelope(self):
        client = APIClient()

        response = client.get('/api/soc/overview/')

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        payload = response.json()
        self.assertIn('detail', payload)
        self.assertIn('code', payload)
        self.assertIn('timestamp', payload)
        self.assertIn('request_id', payload)

    def test_non_admin_requests_are_forbidden_with_standard_error_envelope(self):
        user = User.objects.create_user(
            username='soc-overview-reader',
            email='soc-overview-reader@test.local',
            password='pass123',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/api/soc/overview/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        payload = response.json()
        self.assertIn('detail', payload)
        self.assertIn('code', payload)
        self.assertIn('timestamp', payload)
        self.assertIn('request_id', payload)
