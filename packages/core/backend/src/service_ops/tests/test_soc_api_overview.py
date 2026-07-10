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


class OverviewAdminActionTestCase(OverviewApiBaseTestCase):
    """Tests for admin write actions: toggle active, config apply, config reset."""

    def test_toggle_service_active_state(self):
        """Test PATCH /services/{key}/ toggles is_active and affects list view."""
        # Initial state should be active
        self.assertTrue(self.vnbroker_service.is_active)

        # Toggle to inactive
        response = self.client.patch(
            f'/api/soc/services/{self.vnbroker_service.service_key}/',
            {'is_active': False},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertFalse(payload['is_active'])

        # Verify in database
        self.vnbroker_service.refresh_from_db()
        self.assertFalse(self.vnbroker_service.is_active)

        # Toggle back to active
        response = self.client.patch(
            f'/api/soc/services/{self.vnbroker_service.service_key}/',
            {'is_active': True},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload['is_active'])

        # Verify in database
        self.vnbroker_service.refresh_from_db()
        self.assertTrue(self.vnbroker_service.is_active)

        # Verify list view includes inactive services (no is_active filter)
        response = self.client.get('/api/soc/services/?page_size=100')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        service_keys = [item['service_key'] for item in payload['results']]
        self.assertIn(self.vnbroker_service.service_key, service_keys)

    def test_toggle_service_active_invalid_payload(self):
        """Test PATCH with missing or invalid is_active returns 400."""
        # Missing is_active
        response = self.client.patch(
            f'/api/soc/services/{self.vnbroker_service.service_key}/',
            {},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertEqual(payload['code'], 'INVALID_PAYLOAD')

        # Invalid type for is_active
        response = self.client.patch(
            f'/api/soc/services/{self.vnbroker_service.service_key}/',
            {'is_active': 'not_a_boolean'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertEqual(payload['code'], 'INVALID_PAYLOAD')

    def test_reset_service_config_to_baseline(self):
        """Test POST /services/{key}/config/reset/ restores default config."""
        # First, apply a custom config
        custom_config = {
            'timeout': {'connect': 15.0, 'read': 45.0},
            'max_retries': 5,
            'retry_delay_seconds': 3.0,
        }
        response = self.client.post(
            f'/api/soc/services/{self.vnbroker_service.service_key}/config/',
            {'config_payload': custom_config, 'change_reason': 'Test custom config'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        custom_payload = response.json()['config_payload']
        self.assertEqual(custom_payload['timeout']['connect'], 15.0)

        # Now reset to baseline
        response = self.client.post(
            f'/api/soc/services/{self.vnbroker_service.service_key}/config/reset/',
            {'change_reason': 'Khôi phục cấu hình mặc định hệ thống'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertEqual(payload['change_reason'], 'Khôi phục cấu hình mặc định hệ thống')

        # Verify config matches default
        from service_ops.domain_configs import VnbrokerDomainConfig
        default_config = VnbrokerDomainConfig().to_dict()
        self.assertEqual(payload['config_payload']['timeout']['connect'], default_config['timeout']['connect'])
        self.assertEqual(payload['config_payload']['max_retries'], default_config['max_retries'])

        # Verify audit trail has reset action
        from service_ops.models import ConfigChangeAudit
        reset_audit = ConfigChangeAudit.objects.filter(
            service=self.vnbroker_service,
            action='reset'
        ).first()
        self.assertIsNotNone(reset_audit)
        self.assertEqual(reset_audit.change_summary, 'Khôi phục cấu hình mặc định hệ thống')

    def test_post_invalid_config_payload_returns_400(self):
        """Test POST with invalid config payload returns 400 with validation errors."""
        # Invalid timeout values
        invalid_config = {
            'timeout': {'connect': 100.0, 'read': 500.0},  # Out of range
            'max_retries': 15,  # Out of range
        }
        response = self.client.post(
            f'/api/soc/services/{self.vnbroker_service.service_key}/config/',
            {'config_payload': invalid_config, 'change_reason': 'Invalid config test'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payload = response.json()
        self.assertEqual(payload['code'], 'CONFIG_VALIDATION_FAILED')
        self.assertIn('field_errors', payload)
        self.assertIn('payload', payload['field_errors'])
        errors = payload['field_errors']['payload']
        self.assertTrue(any('timeout.connect' in err for err in errors))
        self.assertTrue(any('max_retries' in err for err in errors))

    def test_unauthorized_post_returns_403(self):
        """Test non-staff user cannot POST to config endpoints."""
        user = User.objects.create_user(
            username='soc-regular-user',
            email='soc-regular@test.local',
            password='pass123',
        )
        client = APIClient()
        client.force_authenticate(user=user)

        # Try to apply config
        response = client.post(
            f'/api/soc/services/{self.vnbroker_service.service_key}/config/',
            {'config_payload': {'timeout': {'connect': 10.0}}, 'change_reason': 'test'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try to reset config
        response = client.post(
            f'/api/soc/services/{self.vnbroker_service.service_key}/config/reset/',
            {'change_reason': 'test'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Try to toggle active
        response = client.patch(
            f'/api/soc/services/{self.vnbroker_service.service_key}/',
            {'is_active': False},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_config_apply_creates_audit_trail(self):
        """Test that config apply creates proper audit trail with before/after snapshots."""
        # Get initial config
        initial_response = self.client.get(f'/api/soc/services/{self.vnbroker_service.service_key}/config/')
        initial_payload = initial_response.json()['config_payload']

        # Apply new config
        new_config = {
            'timeout': {'connect': 12.0, 'read': 35.0},
            'max_retries': 4,
            'retry_delay_seconds': 2.5,
        }
        response = self.client.post(
            f'/api/soc/services/{self.vnbroker_service.service_key}/config/',
            {'config_payload': new_config, 'change_reason': 'Test audit trail'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify audit trail
        from service_ops.models import ConfigChangeAudit
        audit = ConfigChangeAudit.objects.filter(
            service=self.vnbroker_service,
            action='apply'
        ).latest('timestamp')
        self.assertEqual(audit.actor, self.user.username)
        self.assertEqual(audit.change_summary, 'Test audit trail')
        self.assertEqual(audit.before_snapshot, initial_payload)
        self.assertEqual(audit.after_snapshot['timeout']['connect'], 12.0)
        self.assertEqual(audit.after_snapshot['max_retries'], 4)

    def test_overview_summary_includes_inactive_services(self):
        """Test that overview summary returns all services including inactive ones."""
        # Create an inactive service
        inactive_service = ServiceDefinition.objects.create(
            service_key='test_inactive_service',
            name='Test Inactive Service',
            domain='platform',
            is_active=False,
        )

        response = self.client.get('/api/soc/overview/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()

        # Should include the inactive service
        service_keys = [s['service_key'] for s in payload['services']]
        self.assertIn('test_inactive_service', service_keys)
        self.assertIn(self.vnbroker_service.service_key, service_keys)

        # Find the inactive service in results
        inactive_svc = next(s for s in payload['services'] if s['service_key'] == 'test_inactive_service')
        self.assertFalse(inactive_svc['is_active'])

        # Total count should include inactive
        self.assertGreaterEqual(payload['summary']['total'], 2)
