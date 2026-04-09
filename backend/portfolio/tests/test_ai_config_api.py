from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import SystemAISettings, UserConfig


class AIConfigApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='ai-config-user',
            email='ai-config@example.com',
            password='Test@123456',
        )
        UserConfig.objects.update_or_create(
            user=self.user,
            defaults={'email_verified': True},
        )
        self.client.force_authenticate(user=self.user)

    def test_ai_options_returns_providers_and_defaults(self):
        response = self.client.get('/api/ai-options/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('providers', response.data)
        self.assertIn('defaults', response.data)
        self.assertIn('model_catalog', response.data)
        self.assertEqual(response.data.get('scope'), 'text_advisory')
        self.assertIn('openai', response.data['providers'])
        self.assertIn('copilot', response.data['providers'])
        self.assertEqual(response.data['defaults']['copilot'], 'openai/gpt-4.1-mini')
        self.assertEqual(response.data['defaults']['claude'], 'claude-3-5-sonnet-20240620')
        self.assertEqual(response.data['defaults']['gemini'], 'gemini-1.5-pro')
        self.assertIn('openai/gpt-4.1', response.data['providers']['copilot'])
        self.assertNotIn('claude-4.6-opus', response.data['providers']['claude'])
        self.assertNotIn('gemini-3.1-flash-lite', response.data['providers']['gemini'])
        claude_catalog = response.data['model_catalog']['claude']
        self.assertTrue(any(item['id'] == 'claude-4.6-opus' and not item['validated_for_runtime'] for item in claude_catalog))

    def test_ai_config_get_and_put(self):
        get_resp = self.client.get('/api/ai-config/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertIn('ai_provider', get_resp.data)
        self.assertEqual(get_resp.data['ai_model'], '')
        self.assertFalse(get_resp.data['ai_ready'])

        put_resp = self.client.put(
            '/api/ai-config/',
            {
                'ai_provider': 'claude',
                'ai_model': 'claude-3-5-sonnet-20240620',
                'ai_api_key': 'test-anthropic-key',
            },
            format='json',
        )
        self.assertEqual(put_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(put_resp.data.get('ok'))
        self.assertTrue(put_resp.data.get('ai_ready'))

        cfg = UserConfig.objects.get(user=self.user)
        self.assertEqual(cfg.ai_provider, 'claude')
        self.assertEqual(cfg.ai_model, 'claude-3-5-sonnet-20240620')
        self.assertTrue(cfg.ai_api_key_configured)

    def test_ai_config_put_rejects_missing_model(self):
        response = self.client.put(
            '/api/ai-config/',
            {
                'ai_provider': 'openai',
                'ai_model': '',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('AI model', response.data.get('message', ''))

    def test_ai_config_put_rejects_model_not_supported_for_advisory(self):
        response = self.client.put(
            '/api/ai-config/',
            {
                'ai_provider': 'claude',
                'ai_model': 'claude-4.6-sonnet',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('advisory', response.data.get('message', '').lower())

    @patch.dict('os.environ', {'COPILOT_API_KEY': 'ghp_env_test_token'}, clear=False)
    def test_ai_config_get_uses_env_key_for_configured_flag(self):
        cfg = UserConfig.objects.get(user=self.user)
        cfg.ai_provider = 'copilot'
        cfg.ai_model = 'openai/gpt-4.1-mini'
        cfg.ai_api_key = ''
        cfg.save(update_fields=['ai_provider', 'ai_model', 'ai_api_key'])

        response = self.client.get('/api/ai-config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['ai_provider'], 'copilot')
        self.assertEqual(response.data['ai_model'], 'openai/gpt-4.1-mini')
        self.assertTrue(response.data['ai_api_key_configured'])

    def test_update_user_config_with_provider_and_model(self):
        response = self.client.put(
            '/api/portfolio/userconfig/',
            {
                'whale_alert_threshold': 500,
                'theme': 'dark',
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'ai_api_key': 'sk-test-key',
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        cfg = UserConfig.objects.get(user=self.user)
        self.assertEqual(cfg.ai_provider, 'openai')
        self.assertEqual(cfg.ai_model, 'gpt-4o')
        self.assertTrue(cfg.ai_api_key)
        self.assertNotEqual(cfg.ai_api_key, 'sk-test-key')

    @patch('portfolio.ai_service.test_ai_connection')
    def test_ai_test_connection_endpoint(self, mock_test_ai_connection):
        mock_test_ai_connection.return_value = {
            'ok': True,
            'provider': 'openai',
            'model': 'gpt-4o',
            'message': 'Kết nối thành công.',
            'prompt_tokens': 12,
            'completion_tokens': 24,
        }

        response = self.client.post(
            '/api/ai-config/test-connection/',
            {
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'ai_api_key': 'sk-test',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ok'))
        self.assertEqual(response.data.get('provider'), 'openai')

    def test_ai_test_connection_rejects_missing_model(self):
        response = self.client.post(
            '/api/ai-config/test-connection/',
            {
                'ai_provider': 'openai',
                'ai_model': '',
                'ai_api_key': 'sk-test',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('AI model', response.data.get('message', ''))

    def test_ai_test_connection_rejects_missing_api_key(self):
        response = self.client.post(
            '/api/ai-config/test-connection/',
            {
                'ai_provider': 'openai',
                'ai_model': 'gpt-4o',
                'ai_api_key': '',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('API key', response.data.get('message', ''))

    def test_ai_test_connection_rejects_model_not_supported_for_advisory(self):
        response = self.client.post(
            '/api/ai-config/test-connection/',
            {
                'ai_provider': 'gemini',
                'ai_model': 'nano-banana-2',
                'ai_api_key': 'test-gemini-key',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data.get('ok', False))
        self.assertIn('advisory', response.data.get('message', '').lower())

    @patch.dict('os.environ', {'OPENCLAW_API_KEY': 'system-openclaw-key'}, clear=False)
    def test_ai_config_get_uses_system_fallback_when_user_missing_config(self):
        cfg = UserConfig.objects.get(user=self.user)
        cfg.ai_provider = 'openai'
        cfg.ai_model = ''
        cfg.ai_api_key = ''
        cfg.save(update_fields=['ai_provider', 'ai_model', 'ai_api_key'])

        SystemAISettings.objects.update_or_create(
            name='default',
            defaults={
                'is_active': True,
                'ai_provider': 'openclaw',
                'ai_model': '',
                'allow_env_fallback': True,
            },
        )

        response = self.client.get('/api/ai-config/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data.get('ai_ready'))
        self.assertEqual(response.data.get('effective_ai_source'), 'system')
        self.assertEqual(response.data.get('effective_ai_provider'), 'openclaw')
        self.assertEqual(response.data.get('effective_ai_model'), 'default')
