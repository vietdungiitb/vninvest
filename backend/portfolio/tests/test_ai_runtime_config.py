from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from portfolio.ai_runtime_config import resolve_ai_runtime_config
from portfolio.models import SystemAISettings, UserConfig


class AIRuntimeConfigTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='runtime-user',
            email='runtime-user@example.com',
            password='User@123456',
        )

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'env-openai-key', 'OPENCLAW_API_KEY': 'env-openclaw-key'}, clear=False)
    def test_resolver_prefers_user_config_over_system(self):
        user_cfg, _ = UserConfig.objects.get_or_create(user=self.user)
        user_cfg.ai_provider = 'openai'
        user_cfg.ai_model = 'gpt-4o'
        user_cfg.set_ai_api_key('user-openai-key')
        user_cfg.save(update_fields=['ai_provider', 'ai_model', 'ai_api_key', 'updated_at'])

        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )

        resolved = resolve_ai_runtime_config(user=self.user)

        self.assertTrue(resolved.get('ready'))
        self.assertEqual(resolved.get('source'), 'user')
        self.assertEqual(resolved.get('provider'), 'openai')
        self.assertEqual(resolved.get('model'), 'gpt-4o')
        self.assertEqual(resolved.get('api_key'), 'user-openai-key')

    @patch.dict('os.environ', {'OPENCLAW_API_KEY': 'env-openclaw-key'}, clear=False)
    def test_resolver_falls_back_to_system_when_user_missing_model_and_key(self):
        user_cfg, _ = UserConfig.objects.get_or_create(user=self.user)
        user_cfg.ai_provider = 'openai'
        user_cfg.ai_model = ''
        user_cfg.ai_api_key = ''
        user_cfg.save(update_fields=['ai_provider', 'ai_model', 'ai_api_key', 'updated_at'])

        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )

        resolved = resolve_ai_runtime_config(user=self.user)

        self.assertTrue(resolved.get('ready'))
        self.assertEqual(resolved.get('source'), 'system')
        self.assertEqual(resolved.get('provider'), 'openclaw')
        self.assertEqual(resolved.get('model'), 'default')
        self.assertEqual(resolved.get('api_key'), 'env-openclaw-key')
