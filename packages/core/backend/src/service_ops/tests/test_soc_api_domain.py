"""Focused SOC domain API contract tests for the current native routes."""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from market_data.models import GlobalSymbolCoverage, GlobalSymbolRegistry
from signal_intelligence.models import UnifiedAlert
from service_ops.models import (
    ConfigChangeAudit,
    ScrapeMatrix,
    ServiceConfig,
    ServiceDefinition,
    ServiceRunLog,
)
from service_ops.registry import (
    CANONICAL_SOC_SERVICES,
    SOC_DOMAIN_PRIMARY_SERVICE_KEYS,
    ensure_service_registry,
    get_registered_service,
)

User = get_user_model()


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


class PrefetchDomainApiTestCase(SOCAdminApiTestCase):
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
        self.assertEqual(
            [group['id'] for group in groups_response.json()['groups']],
            ['vn30', 'banking'],
        )
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


class DataOpsDomainApiTestCase(SOCAdminApiTestCase):
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


