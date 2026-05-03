from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import AdvisoryTokenLog, AICommandCenterConfig, SystemAISettings, TrackedSymbol, UserConfig, WhaleAdvisory


class ApiRouteWhaleAdvisoryRefreshTests(APITestCase):
    def setUp(self):
        from . import test_api_routes as legacy_routes

        legacy_routes.ApiRouteSmokeTests.setUp(self)
        command_center_cfg, _ = AICommandCenterConfig.objects.update_or_create(
            user=self.user,
            defaults={
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'ai_prompt_config': {},
            },
        )
        command_center_cfg.set_ai_api_key('sk-refresh-route-smoke')
        command_center_cfg.save(update_fields=['ai_api_key'])
        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )

    def authenticate(self):
        from . import test_api_routes as legacy_routes

        return legacy_routes.ApiRouteSmokeTests.authenticate(self)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=True)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_queues_task_for_pro(self, mock_apply_async, _mock_worker_available, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        mock_task = MagicMock()
        mock_task.id = 'task-123'
        mock_apply_async.return_value = mock_task

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])
        self.assertEqual(response.data.get('runtime_ai_source'), 'command_center')
        kwargs = mock_apply_async.call_args.kwargs['kwargs']
        self.assertEqual(kwargs['symbol'], 'FPT')
        self.assertTrue(kwargs['force_refresh'])
        self.assertEqual(kwargs['user_id'], self.user.id)
        self.assertEqual(kwargs['source'], WhaleAdvisory.SourceChoices.USER_REFRESH)

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=True)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_returns_business_403_for_community_plan(self, mock_apply_async, _mock_worker_available, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'free', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        self.authenticate()

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['reason'], 'plan_upgrade_required')
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertIn('nâng cấp', response.data['message'])
        mock_apply_async.assert_not_called()

    def test_whale_advisory_auto_refresh_info_returns_status_and_budget(self):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': 'pro',
                'email_verified': True,
                'advisory_refresh_interval_hours': 12,
                'advisory_max_auto_refreshes_per_day': 3,
                'advisory_max_tokens_per_day': 5000,
            },
        )
        self.authenticate()
        TrackedSymbol.objects.create(user=self.user, symbol='FPT')
        advisory = WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
            next_refresh_at=timezone.now() + timedelta(hours=6),
            refresh_count=2,
            is_auto_generated=True,
            source=WhaleAdvisory.SourceChoices.PERIODIC_JOB,
        )
        AdvisoryTokenLog.objects.create(
            user=self.user,
            advisory=advisory,
            tokens_used=320,
            source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
            symbol='FPT',
        )

        response = self.client.get('/api/portfolio/ai-advisory/FPT/auto-refresh-info/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertEqual(response.data['status'], 'scheduled')
        self.assertEqual(response.data['advisory_id'], advisory.id)
        self.assertEqual(response.data['refresh_count'], 2)
        self.assertTrue(response.data['is_auto_generated'])
        self.assertEqual(response.data['source'], WhaleAdvisory.SourceChoices.PERIODIC_JOB)
        self.assertEqual(response.data['tokens_used_today'], 320)
        self.assertEqual(response.data['tokens_remaining_today'], 4680)
        self.assertEqual(response.data['advisory_max_auto_refreshes_per_day'], 3)
        self.assertEqual(response.data['auto_refreshes_used_today'], 1)
        self.assertEqual(response.data['auto_refreshes_remaining_today'], 2)

    def test_whale_advisory_auto_refresh_info_returns_no_advisory_for_tracked_symbol(self):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        TrackedSymbol.objects.create(user=self.user, symbol='SSI')

        response = self.client.get('/api/portfolio/ai-advisory/SSI/auto-refresh-info/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['ok'])
        self.assertEqual(response.data['status'], 'no_advisory')
        self.assertIsNone(response.data['advisory_id'])

    @patch('portfolio.views._get_ai_runtime_config_status', return_value={'ready': False, 'message': 'AI runtime chưa sẵn sàng.', 'reason': 'missing_ai_config'})
    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_whale_advisory_refresh_endpoint_returns_409_when_ai_model_missing(self, _mock_ai_runtime_status):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={
                'plan': 'pro',
                'email_verified': True,
                'ai_provider': 'openai',
                'ai_model': '',
                'ai_api_key': '',
            },
        )
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @patch('portfolio.views._get_ai_runtime_config_status', return_value={'ready': False, 'message': 'AI runtime chưa sẵn sàng.', 'reason': 'missing_ai_config'})
    @patch.dict(
        'os.environ',
        {
            'OPENAI_API_KEY': '',
            'OPENCLAW_API_KEY': '',
            'ANTHROPIC_API_KEY': '',
            'GEMINI_API_KEY': '',
            'COPILOT_API_KEY': '',
        },
        clear=False,
    )
    def test_whale_advisory_refresh_endpoint_returns_409_when_ai_api_key_missing(self, _mock_ai_runtime_status):
        cfg, _ = UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': 'gpt-4o'},
        )
        cfg.ai_api_key = ''
        cfg.save(update_fields=['ai_api_key'])
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['reason'], 'ai_not_configured')
        self.assertTrue(response.data.get('config_issue'))

    @patch.dict('os.environ', {'OPENCLAW_API_KEY': 'system-openclaw-key'}, clear=False)
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=True)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_uses_system_fallback_when_user_ai_missing(self, mock_apply_async, _mock_worker_available, _mock_cache_get):
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'plan': 'pro', 'email_verified': True, 'ai_provider': 'openai', 'ai_model': ''},
        )
        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        mock_task = MagicMock()
        mock_task.id = 'task-system-fallback-1'
        mock_apply_async.return_value = mock_task

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=True)
    @patch('portfolio.tasks.generate_whale_advisory_task.run')
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_runs_sync_when_no_existing(
        self,
        mock_apply_async,
        mock_task_run,
        _mock_worker_available,
        _mock_cache_get,
    ):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        mock_task_run.return_value = {
            'status': 'ok',
            'advisory_id': 456,
            'symbol': 'SSI',
            'ai_source': 'user',
            'ai_provider': 'openai',
            'ai_model': 'gpt-4o',
        }

        response = self.client.post('/api/portfolio/ai-advisory/SSI/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['queued'])
        self.assertTrue(response.data['fallback_sync'])
        self.assertEqual(response.data['symbol'], 'SSI')
        self.assertEqual(response.data.get('runtime_ai_source'), 'user')
        self.assertEqual(response.data.get('runtime_ai_provider'), 'openai')
        self.assertEqual(response.data.get('runtime_ai_model'), 'gpt-4o')
        mock_apply_async.assert_not_called()
        mock_task_run.assert_called_once()

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=True)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_queues_when_existing(self, mock_apply_async, _mock_worker_available, _mock_cache_get):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )
        mock_task = MagicMock()
        mock_task.id = 'task-existing-1'
        mock_apply_async.return_value = mock_task

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertEqual(response.data.get('runtime_ai_source'), 'command_center')

    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=False)
    @patch('portfolio.tasks.generate_whale_advisory_task.run')
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_runs_sync_fallback_when_worker_unavailable(
        self,
        mock_apply_async,
        mock_task_run,
        _mock_worker_available,
        _mock_cache_get,
    ):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        mock_task_run.return_value = {
            'status': 'ok',
            'advisory_id': 123,
            'symbol': 'SSI',
        }

        response = self.client.post('/api/portfolio/ai-advisory/SSI/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['queued'])
        self.assertTrue(response.data['fallback_sync'])
        self.assertEqual(response.data['symbol'], 'SSI')
        mock_apply_async.assert_not_called()
        mock_task_run.assert_called_once()

    @override_settings(WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER=False)
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=False)
    @patch('portfolio.tasks.generate_whale_advisory_task.run')
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_returns_503_when_no_worker_and_sync_fallback_disabled(
        self,
        mock_apply_async,
        mock_task_run,
        _mock_worker_available,
        _mock_cache_get,
    ):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()

        response = self.client.post('/api/portfolio/ai-advisory/SSI/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'SSI')
        mock_apply_async.assert_not_called()
        mock_task_run.assert_not_called()

    @patch('portfolio.views._cache_get', return_value='2026-04-04T10:00:00+07:00')
    def test_whale_advisory_refresh_endpoint_returns_429_when_manual_cooldown_active(self, _mock_cache_get):
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        response = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertFalse(response.data['queued'])
        self.assertEqual(response.data['symbol'], 'FPT')
        self.assertIn('retry_after_seconds', response.data)

    @override_settings(
        OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True,
        OPEN_CORE_QUOTA_CAPS_BY_TIER={
            'pro_individual': {
                'api_calls_per_day': 3000,
                'ai_regenerate_per_day': 1,
                'whale_symbols_max': 25,
                'exports_per_day': 20,
            },
        },
    )
    @patch('portfolio.views._cache_get', return_value=None)
    @patch('portfolio.views._is_celery_worker_available', return_value=True)
    @patch('portfolio.tasks.generate_whale_advisory_task.apply_async')
    def test_whale_advisory_refresh_endpoint_returns_429_when_ai_regenerate_quota_exceeded(self, mock_apply_async, _mock_worker_available, _mock_cache_get):
        cache.clear()
        UserConfig.objects.update_or_create(user=self.user, defaults={'plan': 'pro', 'email_verified': True})
        self.authenticate()
        WhaleAdvisory.objects.create(
            user=self.user,
            symbol='FPT',
            matched_value=8_500_000_000,
            side='BUY',
            threshold=5_000_000_000,
            ai_summary='Tom tat refresh',
            ai_detail='Chi tiet refresh',
            ai_model='gpt-4o',
        )

        mock_task = MagicMock()
        mock_task.id = 'task-123'
        mock_apply_async.return_value = mock_task

        first = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')
        second = self.client.post('/api/portfolio/ai-advisory/FPT/refresh/', {}, format='json')

        self.assertEqual(first.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(second.data['code'], 'quota_exceeded')
        self.assertEqual(second.data['quota_key'], 'ai_regenerate_per_day')
        self.assertEqual(second.data['limit'], 1)
        self.assertEqual(second.data['remaining'], 0)