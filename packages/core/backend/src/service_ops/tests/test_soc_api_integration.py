"""Integration coverage for current SOC workflows and error envelopes."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ConfigChangeAudit, ServiceConfig, ServiceDefinition
from service_ops.registry import (
    SOC_DOMAIN_PRIMARY_SERVICE_KEYS,
    ensure_service_registry,
    get_registered_service,
)
from service_ops.tests.envelope import unwrapped_json

User = get_user_model()


class SOCIntegrationBaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-integration-admin',
            email='soc-integration-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class ConfigApplyEndToEndTestCase(SOCIntegrationBaseTestCase):
    def test_apply_vnbroker_config_workflow_updates_config_history_and_audit(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])

        current_response = self.client.get('/api/soc/vnbroker/config/')
        apply_response = self.client.post(
            '/api/soc/vnbroker/config/apply/',
            {
                'config_payload': {
                    'preferred_provider': 'kbs',
                    'fallback_providers': ['dnse'],
                    'timeout': {
                        'connect': 7.5,
                        'read': 45.0,
                        'write': 10.0,
                        'pool': 6.0,
                    },
                    'max_retries': 4,
                    'retry_delay_seconds': 0.75,
                    'enabled': True,
                    'circuit_breaker_threshold': 4,
                    'circuit_breaker_window_seconds': 60,
                    'circuit_breaker_cooldown_seconds': 300,
                    'requests_per_minute': 90,
                    'burst_limit': 12,
                },
            },
            format='json',
        )
        config_response = self.client.get(f'/api/soc/services/{service.service_key}/config/')
        history_response = self.client.get(f'/api/soc/services/{service.service_key}/history/')
        audit_response = self.client.get(f'/api/soc/services/{service.service_key}/audit/')

        self.assertEqual(current_response.status_code, status.HTTP_200_OK)
        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(config_response.status_code, status.HTTP_200_OK)
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertEqual(audit_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped_json(config_response)['config_payload']['preferred_provider'], 'kbs')
        self.assertEqual(unwrapped_json(config_response)['config_payload']['timeout']['connect'], 7.5)
        self.assertGreaterEqual(unwrapped_json(history_response)['count'], 1)
        self.assertGreaterEqual(unwrapped_json(audit_response)['count'], 1)

    def test_apply_vnbroker_config_keeps_single_current_version(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])

        self.client.post(
            '/api/soc/vnbroker/config/apply/',
            {
                'config_payload': {
                    'preferred_provider': 'vci',
                    'fallback_providers': ['kbs'],
                    'timeout': {
                        'connect': 6.0,
                        'read': 30.0,
                        'write': 10.0,
                        'pool': 5.0,
                    },
                    'max_retries': 3,
                    'retry_delay_seconds': 0.5,
                    'enabled': True,
                    'circuit_breaker_threshold': 5,
                    'circuit_breaker_window_seconds': 60,
                    'circuit_breaker_cooldown_seconds': 300,
                    'requests_per_minute': 60,
                    'burst_limit': 10,
                },
            },
            format='json',
        )
        self.client.post(
            '/api/soc/vnbroker/config/apply/',
            {
                'config_payload': {
                    'preferred_provider': 'kbs',
                    'fallback_providers': ['dnse'],
                    'timeout': {
                        'connect': 8.0,
                        'read': 50.0,
                        'write': 10.0,
                        'pool': 7.0,
                    },
                    'max_retries': 5,
                    'retry_delay_seconds': 0.8,
                    'enabled': True,
                    'circuit_breaker_threshold': 4,
                    'circuit_breaker_window_seconds': 60,
                    'circuit_breaker_cooldown_seconds': 300,
                    'requests_per_minute': 100,
                    'burst_limit': 15,
                },
            },
            format='json',
        )

        current_configs = ServiceConfig.objects.filter(service=service, is_current=True)

        self.assertEqual(current_configs.count(), 1)
        self.assertEqual(current_configs.first().config_payload['preferred_provider'], 'kbs')


class MultiDomainWorkflowTestCase(SOCIntegrationBaseTestCase):
    def test_native_write_domains_apply_through_alias_routes(self):
        vnbroker_response = self.client.post(
            '/api/soc/vnbroker/config/apply/',
            {
                'config_payload': {
                    'preferred_provider': 'vci',
                    'fallback_providers': ['kbs'],
                    'timeout': {
                        'connect': 5.0,
                        'read': 30.0,
                        'write': 10.0,
                        'pool': 5.0,
                    },
                    'max_retries': 3,
                    'retry_delay_seconds': 0.5,
                    'enabled': True,
                    'circuit_breaker_threshold': 5,
                    'circuit_breaker_window_seconds': 60,
                    'circuit_breaker_cooldown_seconds': 300,
                    'requests_per_minute': 60,
                    'burst_limit': 10,
                },
            },
            format='json',
        )
        prefetch_response = self.client.post(
            '/api/soc/prefetch/config/apply/',
            {
                'config_payload': {
                    'active_profile': 'market_open',
                    'pre_open_interval_seconds': 120,
                    'market_open_interval_seconds': 45,
                    'lunch_break_interval_seconds': 300,
                    'pre_close_interval_seconds': 60,
                    'post_close_interval_seconds': 900,
                    'offhours_interval_seconds': 3600,
                    'batch_size': 20,
                    'max_concurrent_workers': 2,
                    'universe_group_ids': ['vn30'],
                    'cache_ttl_seconds': 30,
                    'enabled': True,
                    'skip_non_trading_days': True,
                },
            },
            format='json',
        )

        self.assertEqual(vnbroker_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(prefetch_response.status_code, status.HTTP_201_CREATED)

    def test_bridge_write_domain_remains_forbidden(self):
        response = self.client.post(
            '/api/soc/signals/config/apply/',
            {'config_payload': {'whale_threshold_vnd': 600000000}},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(unwrapped_json(response)['code'], 'OWNERSHIP_WRITE_DENIED')

    def test_services_list_and_detail_routes_use_primary_service_keys(self):
        list_response = self.client.get('/api/soc/services/?page=1')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(unwrapped_json(list_response)['count'], 1)

        for domain in ['vnbroker', 'prefetch', 'signals']:
            service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS[domain]
            response = self.client.get(f'/api/soc/services/{service_key}/')

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(unwrapped_json(response)['service_key'], service_key)


class PaginationIntegrationTestCase(SOCIntegrationBaseTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.service = ServiceDefinition.objects.create(
            service_key='integration_test_service',
            name='Integration Test Service',
            domain='platform',
            description='Synthetic service for pagination tests',
            owner_team='core',
            tags=['test'],
        )
        for index in range(25):
            ServiceConfig.objects.create(
                service=cls.service,
                config_payload={'iteration': index},
                applied_by='soc-integration-admin',
                change_reason=f'config {index}',
            )
            ConfigChangeAudit.objects.create(
                service=cls.service,
                action='apply',
                actor='soc-integration-admin',
                before_snapshot={'iteration': index - 1} if index > 0 else None,
                after_snapshot={'iteration': index},
                change_summary=f'config {index}',
            )

    def test_service_list_pagination(self):
        response = self.client.get('/api/soc/services/?page=1')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped_json(response)
        self.assertIn('count', data)
        self.assertIn('results', data)
        self.assertLessEqual(len(data['results']), data['count'])

    def test_history_and_audit_routes_are_paginated(self):
        history_response = self.client.get('/api/soc/services/integration_test_service/history/?page=1')
        audit_response = self.client.get('/api/soc/services/integration_test_service/audit/?page=1')

        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertEqual(audit_response.status_code, status.HTTP_200_OK)
        self.assertIn('count', unwrapped_json(history_response))
        self.assertIn('results', unwrapped_json(history_response))
        self.assertIn('count', unwrapped_json(audit_response))
        self.assertIn('results', unwrapped_json(audit_response))


class ErrorHandlingIntegrationTestCase(SOCIntegrationBaseTestCase):
    def test_nonexistent_service_returns_404_with_standard_envelope(self):
        response = self.client.get('/api/soc/services/nonexistent-service/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        data = unwrapped_json(response)
        self.assertIn('detail', data)
        self.assertIn('code', data)
        self.assertIn('timestamp', data)
        self.assertIn('request_id', data)

    def test_invalid_json_returns_400(self):
        response = self.client.post(
            '/api/soc/vnbroker/config/apply/',
            data='{"config_payload":',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('detail', unwrapped_json(response))

    def test_validation_error_uses_standard_error_envelope(self):
        response = self.client.post(
            '/api/soc/vnbroker/test-connection/',
            {'provider': 'ssi'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(unwrapped_json(response)['code'], 'VNBROKER_PROVIDER_UNSUPPORTED')
        self.assertIn('field_errors', unwrapped_json(response))