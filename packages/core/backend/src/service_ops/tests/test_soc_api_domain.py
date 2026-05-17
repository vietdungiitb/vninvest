"""Focused SOC domain API contract tests for the current native routes."""

from decimal import Decimal
import json

from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import GlobalSymbolCoverage, GlobalSymbolDemandSource, GlobalSymbolRegistry
from signal_intelligence.models import UnifiedAlert
from service_ops.models import (
    ConfigChangeAudit,
    ScrapeMatrix,
    ServiceConfig,
    ServiceDefinition,
    ServiceHealth,
    ServiceRunLog,
)
from service_ops.registry import (
    CANONICAL_SOC_SERVICES,
    SOC_DOMAIN_PRIMARY_SERVICE_KEYS,
    ensure_service_registry,
    get_registered_service,
)

User = get_user_model()


def _load_openapi_schema(response):
    try:
        return json.loads(response.content)
    except json.JSONDecodeError:
        import yaml

        return yaml.safe_load(response.content)


class SOCAdminApiTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.user = User.objects.create_user(
            username='soc-domain-admin',
            email='soc-domain-admin@test.local',
            password='pass123',
        )
        cls.user.is_staff = True
        cls.user.is_superuser = True
        cls.user.save(update_fields=['is_staff', 'is_superuser'])

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)


class RegistryBootstrapTestCase(TestCase):
    def test_ensure_service_registry_recreates_canonical_rows(self):
        ServiceDefinition.objects.all().delete()

        created = ensure_service_registry()

        self.assertTrue(created)
        self.assertEqual(ServiceDefinition.objects.count(), len(CANONICAL_SOC_SERVICES))
        self.assertEqual(ServiceConfig.objects.filter(is_current=True).count(), 4)
        self.assertEqual(
            get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']).service_key,
            'matrix_cycle_coordinator',
        )


class VnbrokerDomainApiTestCase(SOCAdminApiTestCase):
    def test_get_vnbroker_config_returns_seeded_payload(self):
        response = self.client.get('/api/soc/vnbroker/config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('config_payload', data)
        self.assertTrue(data['is_current'])
        self.assertEqual(data['service_key'], SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
        self.assertIn('timeout', data['config_payload'])
        self.assertEqual(data['config_payload']['preferred_provider'], 'vci')

    def test_post_vnbroker_config_creates_current_config_and_audit(self):
        response = self.client.post(
            '/api/soc/vnbroker/config/',
            {
                'config_payload': {
                    'preferred_provider': 'kbs',
                    'fallback_providers': ['dnse'],
                    'timeout': {
                        'connect': 7.0,
                        'read': 45.0,
                        'write': 10.0,
                        'pool': 6.0,
                    },
                    'max_retries': 4,
                    'retry_delay_seconds': 0.75,
                    'enabled': True,
                    'circuit_breaker_threshold': 3,
                    'circuit_breaker_window_seconds': 60,
                    'circuit_breaker_cooldown_seconds': 300,
                    'requests_per_minute': 120,
                    'burst_limit': 12,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['config_payload']['preferred_provider'], 'kbs')
        self.assertEqual(data['config_payload']['timeout']['connect'], 7.0)
        self.assertTrue(
            ConfigChangeAudit.objects.filter(
                service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'],
                action='apply',
            ).exists()
        )

    def test_vnbroker_apply_audit_captures_before_and_after_snapshots(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
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
            applied_by='seed',
            change_reason='seed config',
        )

        response = self.client.post(
            '/api/soc/vnbroker/config/apply/',
            {
                'config_payload': {
                    'preferred_provider': 'kbs',
                    'fallback_providers': ['dnse'],
                    'timeout': {
                        'connect': 9.0,
                        'read': 40.0,
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
                'change_reason': 'rotate provider order',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        audit = ConfigChangeAudit.objects.filter(
            service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'],
            action='apply',
        ).latest('timestamp')
        self.assertEqual(audit.before_snapshot['preferred_provider'], 'vci')
        self.assertEqual(audit.after_snapshot['preferred_provider'], 'kbs')
        self.assertEqual(audit.after_snapshot['timeout']['connect'], 9.0)
        self.assertEqual(audit.change_summary, 'rotate provider order')

    def test_vnbroker_preview_returns_validation_envelope(self):
        response = self.client.post(
            '/api/soc/vnbroker/config/preview/',
            {
                'config_payload': {
                    'timeout': {'connect': 0},
                    'preferred_provider': 'invalid-provider',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data['valid'])
        self.assertGreaterEqual(len(data['errors']), 1)

    def test_vnbroker_apply_alias_and_ownership_endpoint_match_contract(self):
        apply_response = self.client.post(
            '/api/soc/vnbroker/config/apply/',
            {
                'config_payload': {
                    'preferred_provider': 'vci',
                    'fallback_providers': ['kbs'],
                    'timeout': {
                        'connect': 9.0,
                        'read': 35.0,
                        'write': 10.0,
                        'pool': 5.0,
                    },
                    'max_retries': 3,
                    'retry_delay_seconds': 0.5,
                    'enabled': True,
                    'circuit_breaker_threshold': 4,
                    'circuit_breaker_window_seconds': 60,
                    'circuit_breaker_cooldown_seconds': 300,
                    'requests_per_minute': 100,
                    'burst_limit': 10,
                },
            },
            format='json',
        )
        ownership_response = self.client.get('/api/soc/vnbroker/ownership/')

        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ownership_response.status_code, status.HTTP_200_OK)
        self.assertEqual(ownership_response.json()['domain'], 'vnbroker')
        self.assertTrue(ownership_response.json()['can_apply'])

    def test_vnbroker_health_endpoint_returns_unknown_snapshot_when_missing(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
        ServiceHealth.objects.filter(service=service).delete()

        response = self.client.get('/api/soc/vnbroker/health/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['service_key'], SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
        self.assertEqual(payload['status'], 'unknown')
        self.assertEqual(payload['detail']['message'], 'Health record not found')

    def test_vnbroker_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        config_path = schema['paths']['/api/soc/vnbroker/config/']
        preview_path = schema['paths']['/api/soc/vnbroker/config/preview/']
        health_path = schema['paths']['/api/soc/vnbroker/health/']
        test_connection_path = schema['paths']['/api/soc/vnbroker/test-connection/']

        self.assertEqual(config_path['get']['summary'], 'Lấy runtime config VNBroker')
        self.assertEqual(config_path['post']['summary'], 'Apply runtime config VNBroker')
        self.assertIn('requestBody', config_path['post'])
        self.assertEqual(preview_path['post']['summary'], 'Preview runtime config VNBroker')
        self.assertIn('requestBody', preview_path['post'])
        self.assertEqual(health_path['get']['summary'], 'Lấy health snapshot VNBroker')
        self.assertEqual(test_connection_path['post']['summary'], 'Kiểm tra kết nối provider VNBroker')
        self.assertIn('requestBody', test_connection_path['post'])
        self.assertEqual(config_path['get']['security'], [{'CorePATBearer': []}])


class PrefetchDomainApiTestCase(SOCAdminApiTestCase):
    def test_prefetch_default_config_response_has_stable_metadata(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'])
        ServiceConfig.objects.filter(service=service).delete()

        response = self.client.get('/api/soc/prefetch/config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['service_key'], SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'])
        self.assertEqual(payload['config_schema_version'], '1.0')
        self.assertEqual(payload['applied_by'], 'system')
        self.assertTrue(payload['is_current'])
        self.assertIn('active_profile', payload['config_payload'])

    def test_apply_prefetch_config_updates_schedule_and_universe(self):
        apply_response = self.client.post(
            '/api/soc/prefetch/config/',
            {
                'config_payload': {
                    'active_profile': 'pre_open',
                    'pre_open_interval_seconds': 120,
                    'market_open_interval_seconds': 45,
                    'lunch_break_interval_seconds': 300,
                    'pre_close_interval_seconds': 60,
                    'post_close_interval_seconds': 900,
                    'offhours_interval_seconds': 3600,
                    'batch_size': 40,
                    'max_concurrent_workers': 4,
                    'universe_group_ids': ['vn30', 'banking'],
                    'cache_ttl_seconds': 30,
                    'enabled': True,
                    'skip_non_trading_days': True,
                },
            },
            format='json',
        )

        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)

        groups_response = self.client.get('/api/soc/prefetch/universe-groups/')
        schedule_response = self.client.get('/api/soc/prefetch/task-schedule/')

        self.assertEqual(groups_response.status_code, status.HTTP_200_OK)
        self.assertEqual(schedule_response.status_code, status.HTTP_200_OK)
        self.assertEqual(groups_response.json().get('universe_mode'), 'registry_first')
        self.assertEqual(groups_response.json().get('hint_group_ids'), ['vn30', 'banking'])
        selected_group_ids = [
            group['id']
            for group in groups_response.json()['groups']
            if group.get('selected')
        ]
        self.assertIn('vn30', selected_group_ids)
        self.assertIn('banking', selected_group_ids)
        self.assertEqual(schedule_response.json()['active_profile'], 'pre_open')
        self.assertEqual(len(schedule_response.json()['schedule']), 6)
        market_open_task = next(
            item
            for item in schedule_response.json()['schedule']
            if item['task'] == 'prefetch_market_open'
        )
        self.assertEqual(market_open_task['interval_seconds'], 45)

    def test_profiles_cache_and_purge_endpoints_return_contract(self):
        profiles_response = self.client.get('/api/soc/prefetch/config/profiles/')
        cache_response = self.client.get('/api/soc/prefetch/cache-status/')
        purge_response = self.client.post(
            '/api/soc/prefetch/purge-cache/',
            {'group_id': 'vn30'},
            format='json',
        )

        self.assertEqual(profiles_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cache_response.status_code, status.HTTP_200_OK)
        self.assertEqual(purge_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(profiles_response.json()['profiles']), 6)
        self.assertEqual(purge_response.json()['group_id'], 'vn30')
        self.assertEqual(purge_response.json()['status'], 'success')

    def test_prefetch_apply_alias_and_ownership_endpoint_match_contract(self):
        apply_response = self.client.post(
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
        ownership_response = self.client.get('/api/soc/prefetch/ownership/')

        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ownership_response.status_code, status.HTTP_200_OK)
        self.assertEqual(ownership_response.json()['domain'], 'prefetch')
        self.assertTrue(ownership_response.json()['can_apply'])

    def test_prefetch_warm_now_queues_run_log(self):
        response = self.client.post('/api/soc/prefetch/warm-now/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.json()['status'], 'queued')
        self.assertTrue(
            ServiceRunLog.objects.filter(
                service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['prefetch'],
                status='queued',
                input_summary__trigger='warm_now',
            ).exists()
        )

    def test_prefetch_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        config_path = schema['paths']['/api/soc/prefetch/config/']
        profiles_path = schema['paths']['/api/soc/prefetch/config/profiles/']
        cache_status_path = schema['paths']['/api/soc/prefetch/cache-status/']
        purge_cache_path = schema['paths']['/api/soc/prefetch/purge-cache/']
        warm_now_path = schema['paths']['/api/soc/prefetch/warm-now/']
        groups_path = schema['paths']['/api/soc/prefetch/universe-groups/']
        schedule_path = schema['paths']['/api/soc/prefetch/task-schedule/']
        ownership_path = schema['paths']['/api/soc/prefetch/ownership/']

        self.assertEqual(config_path['get']['summary'], 'Lấy runtime config Prefetch')
        self.assertEqual(config_path['post']['summary'], 'Apply runtime config Prefetch')
        self.assertIn('requestBody', config_path['post'])
        self.assertEqual(profiles_path['get']['summary'], 'Lấy profile thời gian Prefetch')
        self.assertEqual(cache_status_path['get']['summary'], 'Lấy cache status Prefetch')
        self.assertEqual(purge_cache_path['post']['summary'], 'Purge cache Prefetch')
        self.assertIn('requestBody', purge_cache_path['post'])
        self.assertEqual(warm_now_path['post']['summary'], 'Queue warm-now Prefetch')
        self.assertEqual(groups_path['get']['summary'], 'Lấy universe groups Prefetch')
        self.assertEqual(schedule_path['get']['summary'], 'Lấy task schedule Prefetch')
        self.assertEqual(ownership_path['get']['summary'], 'Lấy ownership Prefetch')
        self.assertEqual(config_path['get']['security'], [{'CorePATBearer': []}])


class ScreenerDomainApiTestCase(SOCAdminApiTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        now = timezone.now()
        UnifiedAlert.objects.create(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            symbol='VCI',
            severity=UnifiedAlert.SeverityChoices.HIGH,
            title='Price change signal',
            body='VCI crossed price change threshold',
            value=Decimal('5.20'),
            direction=UnifiedAlert.DirectionChoices.BUY,
            session_date=now.date(),
            triggered_at=now,
            source_ref='soc-domain-signal-alert',
            metadata={'rule_name': 'price_change_pct'},
        )

    def test_screener_default_config_response_has_stable_metadata(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
        ServiceConfig.objects.filter(service=service).delete()

        response = self.client.get('/api/soc/screener/config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['service_key'], SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
        self.assertEqual(payload['config_schema_version'], '1.0')
        self.assertEqual(payload['applied_by'], 'system')
        self.assertTrue(payload['is_current'])
        self.assertIn('rules', payload['config_payload'])

    def test_rules_endpoint_uses_current_screener_config(self):
        apply_response = self.client.post(
            '/api/soc/screener/config/',
            {
                'config_payload': {
                    'rules': [
                        {
                            'id': 'rule-price-change',
                            'name': 'Biến động giá mạnh',
                            'type': 'price_change_pct',
                            'threshold': 5,
                            'enabled': True,
                        }
                    ],
                    'scan_interval_seconds': 60,
                    'max_symbols_per_scan': 1500,
                    'alert_cooldown_seconds': 300,
                    'max_alerts_per_symbol_per_hour': 3,
                    'result_retention_hours': 24,
                    'publish_to_redis': True,
                    'redis_channel_prefix': 'screener:results:',
                },
            },
            format='json',
        )

        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        rules_response = self.client.get('/api/soc/screener/rules/')

        self.assertEqual(rules_response.status_code, status.HTTP_200_OK)
        rules = rules_response.json()['rules']
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0]['id'], 'rule-price-change')
        self.assertEqual(rules[0]['threshold'], 5)

    def test_results_and_history_use_runtime_signal_alerts(self):
        results_response = self.client.get('/api/soc/screener/results/')
        history_response = self.client.get('/api/soc/screener/alert-history/')

        self.assertEqual(results_response.status_code, status.HTTP_200_OK)
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertEqual(results_response.json()['alerts_triggered'], 1)
        self.assertEqual(results_response.json()['symbols_matched'][0]['symbol'], 'VCI')
        self.assertEqual(history_response.json()['count'], 1)
        self.assertEqual(history_response.json()['results'][0]['symbol'], 'VCI')

    def test_manual_scan_creates_dispatch_run_log(self):
        response = self.client.post(
            '/api/soc/screener/manual-scan/',
            {'symbols': ['VCI', 'SSI']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.json()['status'], 'queued')
        self.assertTrue(
            ServiceRunLog.objects.filter(
                service__service_key='screener_scan_dispatcher',
                status='queued',
            ).exists()
        )

    def test_screener_ownership_endpoint_returns_native_write_status(self):
        response = self.client.get('/api/soc/screener/ownership/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['domain'], 'screener')
        self.assertTrue(response.json()['can_apply'])

    def test_rules_run_alias_queues_manual_scan(self):
        response = self.client.post(
            '/api/soc/screener/rules/run/',
            {'symbols': ['VCI']},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.json()['status'], 'queued')

    def test_screener_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        config_path = schema['paths']['/api/soc/screener/config/']
        rules_path = schema['paths']['/api/soc/screener/rules/']
        results_path = schema['paths']['/api/soc/screener/results/']
        history_path = schema['paths']['/api/soc/screener/alert-history/']
        manual_scan_path = schema['paths']['/api/soc/screener/manual-scan/']
        rules_run_path = schema['paths']['/api/soc/screener/rules/run/']
        ownership_path = schema['paths']['/api/soc/screener/ownership/']

        self.assertEqual(config_path['get']['summary'], 'Lấy runtime config Screener')
        self.assertEqual(config_path['post']['summary'], 'Apply runtime config Screener')
        self.assertIn('requestBody', config_path['post'])
        self.assertEqual(rules_path['get']['summary'], 'Lấy rules Screener')
        self.assertEqual(rules_path['post']['summary'], 'Tạo rule Screener')
        self.assertIn('requestBody', rules_path['post'])
        self.assertEqual(results_path['get']['summary'], 'Lấy kết quả scan Screener')
        self.assertEqual(history_path['get']['summary'], 'Lấy alert history Screener')
        self.assertEqual(manual_scan_path['post']['summary'], 'Queue manual scan Screener')
        self.assertIn('requestBody', manual_scan_path['post'])
        self.assertEqual(rules_run_path['post']['summary'], 'Queue rules run Screener')
        self.assertIn('requestBody', rules_run_path['post'])
        self.assertEqual(ownership_path['get']['summary'], 'Lấy ownership Screener')
        self.assertEqual(config_path['get']['security'], [{'CorePATBearer': []}])


class MatrixDomainApiTestCase(SOCAdminApiTestCase):
    def test_start_monitor_and_abort_matrix_cycle(self):
        start_response = self.client.post(
            '/api/soc/matrix/cycles/start/',
            {
                'providers': ['vci', 'kbs'],
                'symbol_group_ids': ['vn30', 'vn100'],
            },
            format='json',
        )

        self.assertEqual(start_response.status_code, status.HTTP_201_CREATED)
        cycle_id = start_response.json()['cycle_id']
        self.assertFalse(start_response.json()['reused_existing_cycle'])
        self.assertTrue(ScrapeMatrix.objects.filter(cycle_id=cycle_id).exists())

        monitor_response = self.client.get('/api/soc/matrix/monitor/')
        cells_response = self.client.get(f'/api/soc/matrix/cycles/{cycle_id}/cells/')
        abort_response = self.client.post(f'/api/soc/matrix/cycles/{cycle_id}/abort/', {}, format='json')

        self.assertEqual(monitor_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cells_response.status_code, status.HTTP_200_OK)
        self.assertEqual(abort_response.status_code, status.HTTP_200_OK)
        self.assertEqual(monitor_response.json()['cycle_id'], cycle_id)
        self.assertEqual(len(monitor_response.json()['cells']), 4)
        self.assertEqual(cells_response.json()['count'], 4)
        self.assertEqual(abort_response.json()['status'], 'aborted')

    def test_matrix_providers_reflect_active_cycle(self):
        self.client.post(
            '/api/soc/matrix/cycles/start/',
            {
                'providers': ['vci'],
                'symbol_group_ids': ['vn30'],
            },
            format='json',
        )

        response = self.client.get('/api/soc/matrix/providers/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        providers = {item['provider']: item for item in response.json()['providers']}
        self.assertTrue(providers['vci']['in_active_cycle'])
        self.assertFalse(providers['kbs']['in_active_cycle'])

    def test_matrix_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        cycles_path = schema['paths']['/api/soc/matrix/cycles/']
        start_path = schema['paths']['/api/soc/matrix/cycles/start/']
        cells_path = schema['paths']['/api/soc/matrix/cycles/{cycle_id}/cells/']
        abort_path = schema['paths']['/api/soc/matrix/cycles/{cycle_id}/abort/']
        providers_path = schema['paths']['/api/soc/matrix/providers/']
        monitor_path = schema['paths']['/api/soc/matrix/monitor/']

        self.assertEqual(cycles_path['get']['summary'], 'Liệt kê matrix cycles')
        cycle_parameters = {parameter['name'] for parameter in cycles_path['get']['parameters']}
        self.assertIn('page', cycle_parameters)
        self.assertIn('page_size', cycle_parameters)
        self.assertEqual(start_path['post']['summary'], 'Khởi động matrix cycle')
        self.assertIn('requestBody', start_path['post'])
        self.assertEqual(cells_path['get']['summary'], 'Liệt kê matrix cells')
        self.assertEqual(abort_path['post']['summary'], 'Abort matrix cycle')
        self.assertEqual(providers_path['get']['summary'], 'Lấy matrix providers')
        self.assertEqual(monitor_path['get']['summary'], 'Lấy matrix monitor')
        monitor_parameters = {parameter['name'] for parameter in monitor_path['get']['parameters']}
        self.assertIn('cycle_id', monitor_parameters)
        self.assertEqual(start_path['post']['security'], [{'CorePATBearer': []}])


class OverviewDomainApiTestCase(SOCAdminApiTestCase):
    def test_overview_summary_endpoint_returns_grouped_health_snapshot(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
        ServiceHealth.objects.update_or_create(
            service=service,
            defaults={
                'status': 'healthy',
                'last_success_at': timezone.now(),
                'consecutive_failures': 0,
                'avg_response_ms': 21.5,
                'detail': {'source': 'test'},
            },
        )

        response = self.client.get('/api/soc/overview/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('generated_at', payload)
        self.assertGreater(payload['summary']['total'], 0)
        services_by_key = {item['service_key']: item for item in payload['services']}
        self.assertIn(service.service_key, services_by_key)
        self.assertEqual(services_by_key[service.service_key]['status'], 'healthy')

    def test_service_health_check_endpoint_queues_manual_probe_run_log(self):
        service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker']

        response = self.client.post(f'/api/soc/services/{service_key}/health-check/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        payload = response.json()
        self.assertEqual(payload['service_key'], service_key)
        self.assertEqual(payload['status'], 'queued')
        self.assertTrue(
            ServiceRunLog.objects.filter(
                service__service_key=service_key,
                status='queued',
                input_summary__trigger='manual_health_check',
            ).exists()
        )

    def test_overview_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        overview_path = schema['paths']['/api/soc/overview/']
        services_path = schema['paths']['/api/soc/services/']
        health_check_path = schema['paths']['/api/soc/services/{service_key}/health-check/']

        self.assertEqual(overview_path['get']['summary'], 'Lấy tổng quan sức khỏe SOC')
        self.assertEqual(services_path['get']['summary'], 'Liệt kê danh mục service SOC')
        self.assertEqual(health_check_path['post']['summary'], 'Queue health check thủ công cho service SOC')
        service_parameters = {parameter['name'] for parameter in services_path['get']['parameters']}
        self.assertIn('page', service_parameters)
        self.assertIn('page_size', service_parameters)
        self.assertEqual(health_check_path['post']['security'], [{'CorePATBearer': []}])


class DataOpsDomainApiTestCase(SOCAdminApiTestCase):
    def test_operator_canonical_dataops_routes_appear_in_openapi_schema(self):
        response = self.client.get('/core/v1/schema/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schema = _load_openapi_schema(response)

        runtime_config_path = schema['paths']['/core/v1/operator/scraping/dataops/runtime-config/']
        observability_path = schema['paths']['/core/v1/operator/scraping/dataops/observability/']
        planner_preview_path = schema['paths']['/core/v1/operator/scraping/dataops/planner/preview/']
        registry_summary_path = schema['paths']['/core/v1/operator/scraping/dataops/registry/summary/']
        registry_detail_path = schema['paths']['/core/v1/operator/scraping/dataops/registry/{symbol}/']
        registry_reconcile_path = schema['paths']['/core/v1/operator/scraping/dataops/registry/reconcile-preview/']
        security_schemes = schema['components']['securitySchemes']

        self.assertEqual(runtime_config_path['get']['summary'], 'Lấy runtime config DataOps market-data')
        self.assertEqual(runtime_config_path['post']['summary'], 'Apply runtime config DataOps market-data')
        self.assertIn('requestBody', runtime_config_path['post'])
        self.assertEqual(runtime_config_path['get']['security'], [{'CorePATBearer': []}])
        self.assertEqual(observability_path['get']['summary'], 'Lấy observability summary DataOps market-data')
        self.assertEqual(observability_path['get']['security'], [{'CorePATBearer': []}])
        self.assertEqual(planner_preview_path['post']['summary'], 'Preview planner DataOps market-data')
        self.assertIn('requestBody', planner_preview_path['post'])
        self.assertEqual(registry_summary_path['get']['summary'], 'Lấy summary global symbol matrix foundation')
        self.assertEqual(registry_summary_path['get']['security'], [{'CorePATBearer': []}])
        self.assertEqual(registry_detail_path['get']['summary'], 'Lấy detail một symbol trong global symbol matrix')
        self.assertEqual(registry_reconcile_path['post']['summary'], 'Preview drift reconcile cho global symbol matrix')
        self.assertIn('requestBody', registry_reconcile_path['post'])
        self.assertIn('CorePATBearer', security_schemes)
        self.assertEqual(security_schemes['CorePATBearer']['type'], 'http')
        self.assertEqual(security_schemes['CorePATBearer']['scheme'], 'bearer')
        self.assertEqual(security_schemes['CorePATBearer']['bearerFormat'], 'PAT')

    def test_registry_summary_endpoint_returns_foundation_aggregates(self):
        decaying_registry = GlobalSymbolRegistry.objects.create(
            symbol='AAA',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.RECOVERY,
            freshness_state_summary='missing',
            coverage_state_summary='gap',
            demand_source_count=0,
            decay_after_at=timezone.now() + timezone.timedelta(days=3),
        )
        hot_registry = GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='fresh',
            coverage_state_summary='ok',
            demand_source_count=2,
            priority_score=2.5,
        )
        GlobalSymbolDemandSource.objects.bulk_create([
            GlobalSymbolDemandSource(
                registry=hot_registry,
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
                source_ref='watchlist:11',
                is_active=True,
                weight=1.0,
            ),
            GlobalSymbolDemandSource(
                registry=hot_registry,
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref='system_default:vn100',
                is_active=True,
                weight=0.5,
            ),
            GlobalSymbolDemandSource(
                registry=decaying_registry,
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP,
                source_ref='admin_group:test',
                is_active=False,
                weight=0.75,
            ),
        ])

        response = self.client.get('/api/soc/dataops/registry/summary/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['totals']['total_symbols'], 2)
        self.assertEqual(payload['totals']['active_symbols'], 2)
        self.assertEqual(payload['totals']['decaying_symbols'], 1)
        priority_tiers = {item['priority_tier']: item['count'] for item in payload['priority_tiers']}
        self.assertEqual(priority_tiers['hot'], 1)
        self.assertEqual(priority_tiers['recovery'], 1)
        demand_sources = {item['source_type']: item for item in payload['demand_sources']}
        self.assertEqual(demand_sources['watchlist']['active_edges'], 1)
        self.assertEqual(demand_sources['system_default']['active_edges'], 1)
        self.assertEqual(demand_sources['admin_group']['inactive_edges'], 1)

    def test_operator_canonical_registry_summary_endpoint_matches_soc_alias(self):
        GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='fresh',
            coverage_state_summary='ok',
            demand_source_count=1,
            priority_score=1.0,
        )

        soc_response = self.client.get('/api/soc/dataops/registry/summary/')
        canonical_response = self.client.get('/core/v1/operator/scraping/dataops/registry/summary/')

        self.assertEqual(canonical_response.status_code, status.HTTP_200_OK)
        self.assertEqual(canonical_response.json(), soc_response.json())

    def test_registry_detail_endpoint_returns_demand_sources_coverage_and_queue_tier(self):
        trade_date = timezone.localdate()
        verified_at = timezone.now()
        registry = GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='missing',
            coverage_state_summary='gap',
            demand_source_count=1,
            priority_score=1.0,
            latest_trade_date=trade_date,
            last_hydrated_at=verified_at,
        )
        GlobalSymbolDemandSource.objects.create(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref='watchlist:7',
            is_active=True,
            weight=1.0,
            metadata={'watchlist_id': 7},
        )
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
                latest_complete_trade_date=trade_date,
                last_verified_at=verified_at,
                next_recommended_action='coverage_ok',
            ),
            GlobalSymbolCoverage(
                registry=registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
                last_verified_at=verified_at,
                next_recommended_action='materialize_session_facts',
            ),
        ])

        response = self.client.get('/api/soc/dataops/registry/FPT/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['symbol'], 'FPT')
        self.assertEqual(payload['queue_tier'], 'hot_user_demand')
        self.assertFalse(payload['needs_reconcile'])
        self.assertEqual(len(payload['demand_sources']), 1)
        self.assertEqual(payload['demand_sources'][0]['source_ref'], 'watchlist:7')
        coverage_by_dataset = {item['dataset']: item for item in payload['coverage']}
        self.assertEqual(coverage_by_dataset['daily_prices']['freshness_state'], 'fresh')
        self.assertEqual(coverage_by_dataset['session_facts']['next_recommended_action'], 'materialize_session_facts')

    def test_registry_reconcile_preview_flags_drift_without_mutating_registry(self):
        registry = GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
            freshness_state_summary='unknown',
            coverage_state_summary='unknown',
            demand_source_count=0,
            priority_score=0.0,
        )
        GlobalSymbolDemandSource.objects.create(
            registry=registry,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref='watchlist:88',
            is_active=True,
            weight=1.0,
        )
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
            last_verified_at=timezone.now(),
            next_recommended_action='hydrate_daily_prices',
        )

        response = self.client.post(
            '/api/soc/dataops/registry/reconcile-preview/',
            {
                'symbols': ['HPG'],
                'limit': 10,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['summary']['evaluated_symbols'], 1)
        self.assertEqual(payload['summary']['out_of_sync'], 1)
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')
        self.assertFalse(payload['items'][0]['in_sync'])
        self.assertIn('current_priority_tier', payload['items'][0]['drift_fields'])
        self.assertIn('demand_source_count', payload['items'][0]['drift_fields'])
        registry.refresh_from_db()
        self.assertEqual(registry.current_priority_tier, GlobalSymbolRegistry.PriorityTierChoices.COLD)

    def test_runtime_config_get_endpoint_returns_current_config_and_ownership_payload(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'decay_days': 11,
                'hot_user_demand': {
                    'poll_interval_seconds': 20,
                    'max_batch_size': 60,
                },
            },
            applied_by='test',
        )

        response = self.client.get('/api/soc/dataops/runtime-config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['config']['decay_days'], 11)
        self.assertEqual(payload['config']['hot_user_demand']['poll_interval_seconds'], 20)
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')
        self.assertTrue(payload['ownership']['can_apply'])
        self.assertIn('updated_at', payload)

    def test_operator_canonical_runtime_config_endpoint_matches_soc_alias(self):
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'decay_days': 13,
                'hot_user_demand': {
                    'poll_interval_seconds': 25,
                    'max_batch_size': 55,
                },
            },
            applied_by='test',
        )

        soc_response = self.client.get('/api/soc/dataops/runtime-config/')
        canonical_response = self.client.get('/core/v1/operator/scraping/dataops/runtime-config/')

        self.assertEqual(canonical_response.status_code, status.HTTP_200_OK)
        self.assertEqual(canonical_response.json(), soc_response.json())

    def test_queue_tiers_endpoint_returns_default_cadence_and_symbol_distribution(self):
        GlobalSymbolRegistry.objects.bulk_create([
            GlobalSymbolRegistry(
                symbol='AAA',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
                freshness_state_summary='stale',
                coverage_state_summary='missing',
            ),
            GlobalSymbolRegistry(
                symbol='FPT',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
                freshness_state_summary='fresh',
                coverage_state_summary='ok',
            ),
            GlobalSymbolRegistry(
                symbol='HPG',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM,
                freshness_state_summary='warm',
                coverage_state_summary='partial',
            ),
            GlobalSymbolRegistry(
                symbol='VNM',
                is_active=True,
                current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
                freshness_state_summary='fresh',
                coverage_state_summary='ok',
            ),
        ])

        response = self.client.get('/api/soc/dataops/queue-tiers/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tiers = {item['tier']: item for item in response.json()['tiers']}
        self.assertEqual(tiers['hot_user_demand']['symbol_count'], 1)
        self.assertEqual(tiers['hot_user_demand']['poll_interval_seconds'], 30)
        self.assertEqual(tiers['hot_user_demand']['examples'], ['FPT'])
        self.assertEqual(tiers['warm_liquid_market']['symbol_count'], 1)
        self.assertEqual(tiers['cold_full_market']['symbol_count'], 1)
        self.assertEqual(tiers['cold_full_market']['examples'], ['VNM'])
        self.assertEqual(tiers['recovery_backlog']['symbol_count'], 1)
        self.assertEqual(tiers['recovery_backlog']['examples'], ['AAA'])
        self.assertIn('updated_at', response.json())

    def test_coverage_endpoint_returns_dataset_state_counts_and_top_gaps(self):
        registry_gap = GlobalSymbolRegistry.objects.create(
            symbol='AAA',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
            freshness_state_summary='stale',
            coverage_state_summary='missing',
        )
        registry_ok = GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='fresh',
            coverage_state_summary='ok',
        )
        verified_at = timezone.now()
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=registry_gap,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
                last_verified_at=verified_at,
                next_recommended_action='backfill_history',
            ),
            GlobalSymbolCoverage(
                registry=registry_gap,
                dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.STALE,
                last_verified_at=verified_at,
                next_recommended_action='warm_intraday',
            ),
            GlobalSymbolCoverage(
                registry=registry_ok,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
                last_verified_at=verified_at,
            ),
        ])

        response = self.client.get('/api/soc/dataops/coverage/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        datasets = {item['dataset']: item for item in payload['datasets']}
        self.assertEqual(datasets['daily_prices']['missing'], 1)
        self.assertEqual(datasets['daily_prices']['fresh'], 1)
        self.assertEqual(datasets['intraday_ticks']['stale'], 1)
        self.assertEqual(payload['top_gaps'][0]['symbol'], 'AAA')
        self.assertEqual(payload['top_gaps'][0]['dataset'], 'daily_prices')
        self.assertEqual(payload['top_gaps'][0]['next_recommended_action'], 'backfill_history')
        self.assertIn('updated_at', payload)

    def test_observability_endpoint_returns_backlog_fail_rate_and_starvation(self):
        now_value = timezone.now()
        hot_registry = GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='stale',
            coverage_state_summary='missing',
        )
        cold_registry = GlobalSymbolRegistry.objects.create(
            symbol='VNM',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.COLD,
            freshness_state_summary='stale',
            coverage_state_summary='missing',
        )
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=hot_registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
                next_recommended_action='hydrate_daily_prices',
                last_verified_at=now_value,
            ),
            GlobalSymbolCoverage(
                registry=cold_registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.STALE,
                next_recommended_action='warm_intraday',
                last_verified_at=now_value,
            ),
        ])

        matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceRunLog.objects.create(
            service=matrix_service,
            status='failed',
            started_at=now_value - timezone.timedelta(minutes=15),
            input_summary={
                'trigger': 'market_data.queue_tier_scheduler',
                'queue_tier': 'hot_user_demand',
            },
            output_summary={},
        )
        ServiceRunLog.objects.create(
            service=matrix_service,
            status='success',
            started_at=now_value - timezone.timedelta(hours=2),
            input_summary={
                'trigger': 'market_data.queue_tier_scheduler',
                'queue_tier': 'hot_user_demand',
            },
            output_summary={},
        )

        response = self.client.get('/api/soc/dataops/observability/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('backlog', payload)
        self.assertIn('fail_rates', payload)
        self.assertIn('parity_gates', payload)
        self.assertIn('starvation', payload)
        self.assertIn('updated_at', payload)
        self.assertGreaterEqual(len(payload['backlog']['by_dataset']), 1)
        self.assertGreaterEqual(len(payload['backlog']['by_tier']), 1)
        self.assertIn('window_1h', payload['fail_rates'])
        self.assertIn('window_24h', payload['fail_rates'])
        self.assertIn('window_24h', payload['parity_gates'])
        self.assertIn('window_72h', payload['parity_gates'])
        self.assertIn('strict_fresh_parity', payload['parity_gates']['window_24h'])
        self.assertIn('fresh_or_warm_parity', payload['parity_gates']['window_24h'])
        self.assertIn('trend', payload['parity_gates']['window_24h'])
        self.assertIn('strict_fresh_delta_pct_points', payload['parity_gates']['window_24h']['trend'])
        self.assertIn('fresh_or_warm_delta_pct_points', payload['parity_gates']['window_24h']['trend'])
        self.assertGreaterEqual(payload['fail_rates']['window_1h']['failed_runs'], 1)
        starvation_map = {item['tier']: item for item in payload['starvation']}
        self.assertIn('hot_user_demand', starvation_map)
        self.assertIn('is_starved', starvation_map['hot_user_demand'])

    def test_operator_canonical_observability_endpoint_matches_soc_alias(self):
        response_alias = self.client.get('/api/soc/dataops/observability/')
        response_canonical = self.client.get('/core/v1/operator/scraping/dataops/observability/')

        self.assertEqual(response_canonical.status_code, status.HTTP_200_OK)
        alias_payload = response_alias.json()
        canonical_payload = response_canonical.json()

        self.assertEqual(canonical_payload['backlog'], alias_payload['backlog'])
        self.assertEqual(canonical_payload['fail_rates'], alias_payload['fail_rates'])
        self.assertEqual(canonical_payload['parity_gates'], alias_payload['parity_gates'])
        self.assertEqual(len(canonical_payload['starvation']), len(alias_payload['starvation']))
        alias_by_tier = {item['tier']: item for item in alias_payload['starvation']}
        canonical_by_tier = {item['tier']: item for item in canonical_payload['starvation']}
        self.assertEqual(set(canonical_by_tier.keys()), set(alias_by_tier.keys()))
        for tier_name, canonical_item in canonical_by_tier.items():
            alias_item = alias_by_tier[tier_name]
            self.assertEqual(canonical_item['is_starved'], alias_item['is_starved'])
            self.assertEqual(canonical_item['poll_interval_seconds'], alias_item['poll_interval_seconds'])
            self.assertEqual(canonical_item['threshold_seconds'], alias_item['threshold_seconds'])

    def test_run_logs_endpoint_returns_paginated_market_data_parent_runs(self):
        matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        history_service = get_registered_service('vnbroker_history')

        queued_log = ServiceRunLog.objects.create(
            service=matrix_service,
            status='queued',
            input_summary={
                'mode': 'missing_only',
                'reason': 'operator_manual_run',
                'execution_mode': 'async',
                'plan_summary': {
                    'planned_items': 2,
                    'skipped_items': 1,
                },
            },
            output_summary={},
        )
        success_log = ServiceRunLog.objects.create(
            service=matrix_service,
            status='success',
            input_summary={
                'mode': 'missing_only',
                'reason': 'scheduler_hot_tier',
                'execution_mode': 'async',
                'plan_summary': {
                    'planned_items': 3,
                    'skipped_items': 0,
                },
            },
            output_summary={
                'summary': {
                    'planned_items': 3,
                    'skipped_items': 0,
                    'inserted': 2,
                    'updated': 1,
                    'skipped_existing': 0,
                    'failed': 0,
                },
            },
        )
        ignored_log = ServiceRunLog.objects.create(
            service=history_service,
            status='success',
            input_summary={'mode': 'missing_only'},
            output_summary={'summary': {'planned_items': 99}},
        )

        response = self.client.get('/api/soc/dataops/run-logs/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['count'], 2)
        results_by_run_id = {item['run_id']: item for item in payload['results']}
        self.assertEqual(results_by_run_id[f'md-run-{queued_log.id}']['summary']['planned_items'], 2)
        self.assertEqual(results_by_run_id[f'md-run-{queued_log.id}']['summary']['skipped_items'], 1)
        self.assertEqual(results_by_run_id[f'md-run-{success_log.id}']['summary']['inserted'], 2)
        self.assertEqual(results_by_run_id[f'md-run-{success_log.id}']['summary']['updated'], 1)
        self.assertEqual(results_by_run_id[f'md-run-{success_log.id}']['reason'], 'scheduler_hot_tier')
        self.assertNotIn(f'md-run-{ignored_log.id}', results_by_run_id)

    def test_planner_preview_endpoint_returns_missing_only_plan_and_skips(self):
        registry = GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='stale',
            coverage_state_summary='missing',
        )
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
                next_recommended_action='hydrate_daily_prices',
            ),
            GlobalSymbolCoverage(
                registry=registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
                next_recommended_action='coverage_ok',
            ),
        ])

        response = self.client.post(
            '/api/soc/dataops/planner/preview/',
            {
                'symbols': ['FPT'],
                'datasets': ['daily_prices', 'price_board_snapshot'],
                'mode': 'missing_only',
                'force_refresh': False,
                'reason': 'manual_preview',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual(payload['summary']['planned_items'], 1)
        self.assertEqual(payload['summary']['skipped_items'], 1)
        self.assertEqual(payload['items'][0]['symbol'], 'FPT')
        self.assertEqual(payload['items'][0]['dataset'], 'daily_prices')
        self.assertEqual(payload['skipped'][0]['dataset'], 'price_board_snapshot')
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')

    def test_operator_canonical_planner_preview_matches_soc_alias(self):
        registry = GlobalSymbolRegistry.objects.create(
            symbol='FPT',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='stale',
            coverage_state_summary='missing',
        )
        GlobalSymbolCoverage.objects.bulk_create([
            GlobalSymbolCoverage(
                registry=registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
                next_recommended_action='hydrate_daily_prices',
            ),
            GlobalSymbolCoverage(
                registry=registry,
                dataset=GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
                freshness_state=GlobalSymbolCoverage.FreshnessChoices.FRESH,
                next_recommended_action='coverage_ok',
            ),
        ])

        request_payload = {
            'symbols': ['FPT'],
            'datasets': ['daily_prices', 'price_board_snapshot'],
            'mode': 'missing_only',
            'force_refresh': False,
            'reason': 'manual_preview',
        }

        soc_response = self.client.post(
            '/api/soc/dataops/planner/preview/',
            request_payload,
            format='json',
        )
        canonical_response = self.client.post(
            '/core/v1/operator/scraping/dataops/planner/preview/',
            request_payload,
            format='json',
        )

        self.assertEqual(canonical_response.status_code, status.HTTP_200_OK)
        self.assertEqual(canonical_response.json(), soc_response.json())

    @patch('data_ingest.tasks.run_global_market_data_planner.apply_async', return_value=Mock(id='soc-dataops-planner-task'))
    def test_planner_run_endpoint_creates_audited_manual_on_demand_run(self, planner_task_mock):
        registry = GlobalSymbolRegistry.objects.create(
            symbol='HPG',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.WARM,
            freshness_state_summary='stale',
            coverage_state_summary='missing',
        )
        GlobalSymbolCoverage.objects.create(
            registry=registry,
            dataset=GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
            freshness_state=GlobalSymbolCoverage.FreshnessChoices.MISSING,
            next_recommended_action='hydrate_daily_prices',
        )

        response = self.client.post(
            '/api/soc/dataops/planner/run/',
            {
                'symbols': ['HPG'],
                'datasets': ['daily_prices'],
                'mode': 'missing_only',
                'force_refresh': False,
                'execution_mode': 'async',
                'reason': 'operator_manual_run',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertTrue(payload['queued'])
        self.assertEqual(payload['status'], 'queued')
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')
        run_log = ServiceRunLog.objects.get(pk=payload['service_run_log_id'])
        self.assertEqual(run_log.input_summary['trigger'], 'soc.dataops.planner.run')
        self.assertEqual(run_log.input_summary['planner_queue'], 'manual_on_demand')
        self.assertEqual(run_log.input_summary['write_surface'], 'soc_dataops')
        self.assertEqual(run_log.input_summary['requested_by'], self.user.username)
        planner_task_mock.assert_called_once_with(
            kwargs={'service_run_log_id': run_log.id},
            queue='manual_on_demand',
        )

    @patch('service_ops.views.dataops.current_app.control.revoke')
    def test_planner_run_abort_endpoint_revokes_queued_task_and_marks_run_skipped(self, revoke_mock):
        matrix_service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        run_log = ServiceRunLog.objects.create(
            service=matrix_service,
            status='queued',
            celery_task_id='celery-task-queued-123',
            input_summary={
                'mode': 'missing_only',
                'reason': 'operator_manual_run',
                'execution_mode': 'async',
                'trigger': 'soc.dataops.planner.run',
            },
            output_summary={},
        )

        response = self.client.post(
            f'/api/soc/dataops/planner/run/md-run-{run_log.id}/abort/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload['cancelled'])
        self.assertEqual(payload['status'], 'skipped')
        self.assertEqual(payload['run_id'], f'md-run-{run_log.id}')
        revoke_mock.assert_called_once_with('celery-task-queued-123')

        run_log.refresh_from_db()
        self.assertEqual(run_log.status, 'skipped')
        self.assertIsNotNone(run_log.finished_at)
        self.assertTrue(dict(run_log.output_summary or {}).get('cancelled_by_operator'))

    def test_queue_tiers_endpoint_uses_current_matrix_runtime_config_overrides(self):
        GlobalSymbolRegistry.objects.create(
            symbol='VCI',
            is_active=True,
            current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT,
            freshness_state_summary='fresh',
            coverage_state_summary='ok',
        )
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'])
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload={
                'hot_user_demand': {
                    'poll_interval_seconds': 15,
                    'max_batch_size': 25,
                },
                'recovery_backlog': {
                    'poll_interval_seconds': 300,
                    'max_batch_size': 20,
                },
            },
            applied_by='test',
        )

        response = self.client.get('/api/soc/dataops/queue-tiers/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tiers = {item['tier']: item for item in response.json()['tiers']}
        self.assertEqual(tiers['hot_user_demand']['poll_interval_seconds'], 15)
        self.assertEqual(tiers['hot_user_demand']['max_batch_size'], 25)
        self.assertEqual(tiers['recovery_backlog']['poll_interval_seconds'], 300)
        self.assertEqual(tiers['recovery_backlog']['max_batch_size'], 20)

    def test_runtime_config_endpoint_applies_market_data_config_with_ownership_payload(self):
        response = self.client.post(
            '/api/soc/dataops/runtime-config/',
            {
                'config_payload': {
                    'decay_days': 9,
                    'hot_user_demand': {
                        'poll_interval_seconds': 20,
                        'max_batch_size': 40,
                    },
                    'warm_liquid_market': {
                        'poll_interval_seconds': 180,
                        'max_batch_size': 110,
                    },
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertEqual(payload['config']['decay_days'], 9)
        self.assertEqual(payload['config']['hot_user_demand']['poll_interval_seconds'], 20)
        self.assertEqual(payload['config']['warm_liquid_market']['max_batch_size'], 110)
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')
        self.assertTrue(payload['ownership']['can_apply'])
        self.assertTrue(
            ServiceConfig.objects.filter(
                service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
                is_current=True,
                config_payload__decay_days=9,
            ).exists()
        )
        self.assertTrue(
            ConfigChangeAudit.objects.filter(
                service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
                action='apply',
            ).exists()
        )

    def test_operator_canonical_runtime_config_endpoint_applies_market_data_config(self):
        response = self.client.post(
            '/core/v1/operator/scraping/dataops/runtime-config/',
            {
                'config_payload': {
                    'decay_days': 8,
                    'hot_user_demand': {
                        'poll_interval_seconds': 18,
                        'max_batch_size': 38,
                    },
                    'warm_liquid_market': {
                        'poll_interval_seconds': 150,
                        'max_batch_size': 105,
                    },
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        payload = response.json()
        self.assertEqual(payload['config']['decay_days'], 8)
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')
        self.assertTrue(
            ServiceConfig.objects.filter(
                service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
                is_current=True,
                config_payload__decay_days=8,
            ).exists()
        )

    def test_runtime_config_preview_validates_without_saving(self):
        response = self.client.post(
            '/api/soc/dataops/runtime-config/preview/',
            {
                'config_payload': {
                    'decay_days': 14,
                    'hot_user_demand': {'poll_interval_seconds': 10, 'max_batch_size': 30},
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertTrue(payload['is_valid'])
        self.assertEqual(payload['projected_config']['decay_days'], 14)
        self.assertEqual(payload['projected_config']['hot_user_demand']['poll_interval_seconds'], 10)
        self.assertEqual(payload['validation_errors'], [])
        self.assertEqual(payload['ownership']['domain'], 'dataops_market_data')
        # Preview must NOT save to DB
        self.assertFalse(
            ServiceConfig.objects.filter(
                service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
                config_payload__decay_days=14,
            ).exists()
        )

    def test_runtime_config_audit_returns_paginated_change_history(self):
        # First apply a config change so there's an audit record
        self.client.post(
            '/api/soc/dataops/runtime-config/',
            {'config_payload': {'decay_days': 7}},
            format='json',
        )

        response = self.client.get('/api/soc/dataops/runtime-config/audit/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertIn('count', payload)
        self.assertIn('results', payload)
        self.assertGreaterEqual(payload['count'], 1)
        self.assertIn('service_key', payload['results'][0])
        self.assertIn('actor', payload['results'][0])

