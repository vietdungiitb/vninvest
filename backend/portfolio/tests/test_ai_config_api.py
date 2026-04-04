from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from portfolio.models import UserConfig


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
        self.assertIn('openai', response.data['providers'])

    def test_ai_config_get_and_put(self):
        get_resp = self.client.get('/api/ai-config/')
        self.assertEqual(get_resp.status_code, status.HTTP_200_OK)
        self.assertIn('ai_provider', get_resp.data)

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

        cfg = UserConfig.objects.get(user=self.user)
        self.assertEqual(cfg.ai_provider, 'claude')
        self.assertEqual(cfg.ai_model, 'claude-3-5-sonnet-20240620')
        self.assertTrue(cfg.ai_api_key_configured)

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
