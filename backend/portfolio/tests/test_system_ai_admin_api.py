from django.contrib.auth.models import User
from django.core.cache import cache
from unittest.mock import patch
from django.utils import timezone

from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import AICommandCenterConfig, SystemAISettings, SystemAISettingsAuditLog


class SystemAIAdminApiTests(APITestCase):
    URL = '/api/admin-ops/system-ai-settings/'
    TEST_URL = '/api/admin-ops/system-ai-settings/test-connection/'
    AUDIT_URL = '/api/admin-ops/system-ai-settings/audit-logs/'
    OPERATOR_URL = '/api/core/v1/operator/ai-runtime/'

    def setUp(self):
        cache.delete('admin_ops:holistic_governance_delta_thresholds')
        cache.delete('admin_ops:prefetch_runtime_settings')
        cache.delete('admin_ops:prefetch_time_policy')
        self.admin_user = User.objects.create_superuser(
            username='system-ai-admin',
            email='system-ai-admin@example.com',
            password='Admin@123456',
        )
        self.normal_user = User.objects.create_user(
            username='system-ai-user',
            email='system-ai-user@example.com',
            password='User@123456',
        )

    def test_requires_admin_permission(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get(self.URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_returns_default_settings_for_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertIn('settings', response.data)
        self.assertIn('ai_provider', response.data['settings'])
        self.assertIn('prefetch_time_policy', response.data['settings'])
        self.assertIn('prefetch_time_policy_rulebook', response.data['settings'])
        self.assertIn('2026-04-30', response.data['settings']['prefetch_time_policy']['market']['holiday_dates'])

    def test_put_updates_system_ai_settings(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'ai_api_key': 'sk-system-admin-key',
                'allow_env_fallback': True,
                'is_active': True,
                'notes': 'updated from admin api test',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertEqual(response.data['settings']['ai_provider'], 'openai')
        self.assertEqual(response.data['settings']['ai_model'], 'gpt-4o')
        self.assertTrue(response.data['settings']['ai_api_key_configured'])

        cfg = SystemAISettings.get_active()
        self.assertIsNotNone(cfg)
        self.assertEqual(cfg.ai_provider, 'openai')
        self.assertEqual(cfg.ai_model, 'gpt-4o')
        self.assertTrue(cfg.ai_api_key)
        self.assertNotEqual(cfg.ai_api_key, 'sk-system-admin-key')
        self.assertTrue(SystemAISettingsAuditLog.objects.filter(action='update_settings').exists())

    def test_put_updates_governance_delta_thresholds(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'governance_delta_thresholds': {
                    'warning': 1.5,
                    'critical': 3.5,
                    'cooldown': 1.0,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        thresholds = response.data['settings']['governance_delta_thresholds']
        self.assertEqual(thresholds['warning'], 1.5)
        self.assertEqual(thresholds['critical'], 3.5)
        self.assertEqual(thresholds['cooldown'], 1.0)

        get_response = self.client.get(self.URL)
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data['settings']['governance_delta_thresholds']['warning'], 1.5)
        self.assertEqual(get_response.data['settings']['governance_delta_thresholds']['critical'], 3.5)
        self.assertEqual(get_response.data['settings']['governance_delta_thresholds']['cooldown'], 1.0)

    def test_put_rejects_invalid_governance_delta_thresholds(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'governance_delta_thresholds': {
                    'warning': 3,
                    'critical': 2,
                    'cooldown': 1,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok'))
        self.assertIn('critical', str(response.data.get('message', '')).lower())

    def test_put_updates_prefetch_runtime_settings(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'prefetch_runtime_settings': {
                    'batch_size': 25,
                    'symbol_limit': 55,
                    'max_retries': 4,
                    'retry_base_seconds': 15,
                    'retry_max_seconds': 120,
                    'rate_limit_cooldown_seconds': 30,
                    'circuit_window_seconds': 600,
                    'circuit_breaker_timeout_threshold': 4,
                    'circuit_breaker_cooldown_seconds': 1800,
                    'include_group_symbols': True,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        runtime_settings = response.data['settings']['prefetch_runtime_settings']
        self.assertEqual(runtime_settings['batch_size'], 25)
        self.assertEqual(runtime_settings['symbol_limit'], 55)
        self.assertEqual(runtime_settings['max_retries'], 4)
        self.assertEqual(runtime_settings['retry_base_seconds'], 15)
        self.assertEqual(runtime_settings['retry_max_seconds'], 120)
        self.assertEqual(runtime_settings['rate_limit_cooldown_seconds'], 30)
        self.assertEqual(runtime_settings['circuit_window_seconds'], 600)
        self.assertEqual(runtime_settings['circuit_breaker_timeout_threshold'], 4)
        self.assertEqual(runtime_settings['circuit_breaker_cooldown_seconds'], 1800)
        self.assertTrue(runtime_settings['include_group_symbols'])

    def test_put_rejects_invalid_prefetch_runtime_settings(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'prefetch_runtime_settings': {
                    'batch_size': 'not-an-int',
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok'))
        self.assertIn('batch_size', str(response.data.get('message', '')).lower())

    def test_put_updates_prefetch_time_policy(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'prefetch_time_policy': {
                    'timezone': 'Asia/Ho_Chi_Minh',
                    'market': {
                        'open_time': '08:45',
                        'close_time': '15:00',
                        'pre_open_minutes': 20,
                        'post_close_minutes': 45,
                        'holiday_dates': ['2026-04-30', '2026-05-01'],
                        'lunch_break': {
                            'enabled': True,
                            'start': '11:30',
                            'end': '13:00',
                        },
                    },
                    'profiles': {
                        'market_open': {
                            'query_enabled': True,
                            'interval_seconds': 40,
                            'batch_size': 16,
                            'symbol_limit': 45,
                            'max_retries': 3,
                        },
                    },
                    'rate_limit_guard': {
                        'jitter_percent': 12,
                        'cooldown_multiplier_on_429': 2.5,
                        'max_interval_seconds': 1200,
                    },
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        policy = response.data['settings']['prefetch_time_policy']
        self.assertEqual(policy['market']['open_time'], '08:45')
        self.assertEqual(policy['market']['pre_open_minutes'], 20)
        self.assertEqual(policy['market']['post_close_minutes'], 45)
        self.assertEqual(policy['market']['holiday_dates'], ['2026-04-30', '2026-05-01'])
        self.assertEqual(policy['profiles']['market_open']['interval_seconds'], 40)
        self.assertEqual(policy['profiles']['market_open']['batch_size'], 16)
        self.assertEqual(policy['rate_limit_guard']['jitter_percent'], 12.0)
        self.assertEqual(policy['rate_limit_guard']['cooldown_multiplier_on_429'], 2.5)
        self.assertEqual(policy['rate_limit_guard']['max_interval_seconds'], 1200)

    def test_put_rejects_invalid_prefetch_time_policy(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.put(
            self.URL,
            {
                'prefetch_time_policy': {
                    'market': {
                        'holiday_dates': ['2026-02-30'],
                    },
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok'))
        self.assertIn('holiday_dates', str(response.data.get('message', '')).lower())

    @patch('portfolio.ai_service.test_ai_connection')
    def test_admin_can_test_system_ai_connection(self, mock_test_ai_connection):
        mock_test_ai_connection.return_value = {
            'ok': True,
            'provider': 'openai',
            'model': 'gpt-4o',
            'message': 'Kết nối thành công.',
            'prompt_tokens': 10,
            'completion_tokens': 20,
        }
        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'allow_env_fallback': False,
            },
        )
        cfg = SystemAISettings.get_active()
        cfg.set_ai_api_key('sk-system-admin-key')
        cfg.save(update_fields=['ai_api_key', 'updated_at'])

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(self.TEST_URL, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertEqual(response.data.get('provider'), 'openai')
        self.assertTrue(SystemAISettingsAuditLog.objects.filter(action='test_connection_success').exists())

    def test_admin_test_connection_returns_400_when_runtime_not_ready(self):
        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'allow_env_fallback': False,
                'ai_api_key': '',
            },
        )
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(self.TEST_URL, {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok'))
        self.assertTrue(response.data.get('reason'))
        self.assertTrue(SystemAISettingsAuditLog.objects.filter(action='test_connection_failed').exists())

    def test_admin_can_get_system_ai_audit_logs(self):
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=self.admin_user,
            action='update_settings',
            reason='seed_audit',
            before_json={'ai_provider': 'openclaw'},
            after_json={'ai_provider': 'openai'},
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.AUDIT_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertGreaterEqual(response.data.get('count', 0), 1)
        self.assertIn('results', response.data)

    def test_admin_can_get_operator_ai_runtime_snapshot(self):
        command_center_cfg = AICommandCenterConfig.objects.create(
            user=self.admin_user,
            ai_provider='openai',
            ai_model='gpt-4o',
            ai_prompt_config={},
        )
        command_center_cfg.set_ai_api_key('sk-command-center-key')
        command_center_cfg.save(update_fields=['ai_api_key'])

        system_cfg, _ = SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )
        system_cfg.set_ai_api_key('sk-system-key')
        system_cfg.save(update_fields=['ai_api_key', 'updated_at'])

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.OPERATOR_URL)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('object'), 'operator_ai_runtime_snapshot')
        self.assertIn('generated_at', response.data)
        self.assertIn('provider_rows', response.data)
        self.assertIn('effective_policy_bundle', response.data)
        self.assertIn('rollout_state', response.data)

        rows_by_source = {row['source']: row for row in response.data['provider_rows']}
        self.assertIn('command_center', rows_by_source)
        self.assertIn('system', rows_by_source)
        self.assertTrue(rows_by_source['command_center']['ready'])
        self.assertTrue(rows_by_source['system']['ready'])
        self.assertIsNone(rows_by_source['command_center']['warning_code'])
        self.assertIsNone(rows_by_source['system']['warning_code'])

        policy_bundle = response.data['effective_policy_bundle']
        self.assertIn('governance_delta_thresholds', policy_bundle)
        self.assertIn('prefetch_runtime_settings', policy_bundle)
        self.assertIn('prefetch_time_policy', policy_bundle)
        self.assertTrue(policy_bundle['effective_ready'])
        self.assertEqual(policy_bundle['effective_source'], 'command_center')

        rollout_state = response.data['rollout_state']
        self.assertTrue(rollout_state['ready'])
        self.assertEqual(rollout_state['source'], 'command_center')
        self.assertEqual(rollout_state['provider'], 'openai')
        self.assertEqual(rollout_state['model'], 'gpt-4o')

    def test_operator_ai_runtime_requires_admin_permission(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get(self.OPERATOR_URL)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_filter_audit_logs_by_action(self):
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=self.admin_user,
            action='update_settings',
            reason='audit-update',
        )
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=self.admin_user,
            action='test_connection_success',
            reason='audit-test',
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'{self.AUDIT_URL}?action=test_connection_success')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertEqual(response.data.get('count'), 1)
        self.assertEqual(response.data['results'][0]['action'], 'test_connection_success')

    def test_admin_can_paginate_audit_logs(self):
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)
        for idx in range(3):
            SystemAISettingsAuditLog.objects.create(
                settings=settings_obj,
                actor=self.admin_user,
                action='update_settings',
                reason=f'row-{idx}',
            )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'{self.AUDIT_URL}?limit=2&offset=1')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertEqual(response.data.get('limit'), 2)
        self.assertEqual(response.data.get('offset'), 1)
        self.assertEqual(response.data.get('count'), 2)
        self.assertGreaterEqual(response.data.get('total', 0), 3)

    def test_admin_audit_logs_reject_invalid_datetime_filter(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(f'{self.AUDIT_URL}?start_at=not-a-datetime')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('start_at', response.data.get('message', ''))

    def test_admin_can_filter_audit_logs_by_date_window(self):
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)
        log = SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=self.admin_user,
            action='update_settings',
            reason='within-window',
        )

        start_at = (log.created_at - timezone.timedelta(minutes=1)).isoformat()
        end_at = (log.created_at + timezone.timedelta(minutes=1)).isoformat()

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.AUDIT_URL, {'start_at': start_at, 'end_at': end_at})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertGreaterEqual(response.data.get('count', 0), 1)

    def test_admin_can_order_audit_logs_ascending(self):
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)
        first = SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=self.admin_user,
            action='update_settings',
            reason='first',
        )
        second = SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=self.admin_user,
            action='update_settings',
            reason='second',
        )

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.AUDIT_URL, {'order': 'asc'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertEqual(response.data.get('order'), 'asc')
        self.assertGreaterEqual(response.data.get('count', 0), 2)
        returned_ids = [row['id'] for row in response.data.get('results', [])]
        self.assertIn(first.id, returned_ids)
        self.assertIn(second.id, returned_ids)
        self.assertLess(returned_ids.index(first.id), returned_ids.index(second.id))

    def test_admin_audit_logs_reject_invalid_order(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.AUDIT_URL, {'order': 'latest'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('order', response.data.get('message', ''))
