"""
AI Management Center SSOT Upgrade tests.

Covers:
- UserAICredential model (consume_fallback_quota, fallback_quota_remaining)
- PortfolioAICommandCenterView GET/PUT (BYOK SSOT, legacy fallback)
- PortfolioAICommandCenterTestView active probe (openclaw, local, validation)
- AdvisoryRefreshView fallback flow (personal key failed, quota exhausted)
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from unittest.mock import patch

import httpx

from advisory.models import UserAICredential, SystemAISettings
from identity_access.security import encrypt_user_api_key
from identity_access.models import UserProfile
from identity_access.tests.envelope import unwrapped


class UserAICredentialModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='cred-owner',
            email='cred@example.com',
            password='testpass123',
        )

    def test_create_with_defaults(self):
        cred = UserAICredential.objects.create(user=self.user)
        self.assertEqual(cred.ai_provider, 'openai')
        self.assertEqual(cred.encrypted_api_key, '')
        self.assertEqual(cred.custom_endpoint, '')
        self.assertTrue(cred.is_active)
        self.assertEqual(cred.fallback_quota_used_today, 0)
        self.assertEqual(cred.fallback_quota_date, None)
        self.assertEqual(cred.fallback_quota_remaining, 5)

    def test_provider_openclaw(self):
        cred = UserAICredential.objects.create(user=self.user, ai_provider='openclaw')
        self.assertEqual(cred.ai_provider, 'openclaw')

    def test_provider_local_with_custom_endpoint(self):
        cred = UserAICredential.objects.create(
            user=self.user,
            ai_provider='local',
            ai_model='llama3.2',
            custom_endpoint='http://10.0.0.1:11434/v1',
        )
        self.assertEqual(cred.ai_provider, 'local')
        self.assertEqual(cred.custom_endpoint, 'http://10.0.0.1:11434/v1')

    def test_encrypted_api_key_storage(self):
        plain_key = 'sk-test-key-12345'
        cred = UserAICredential.objects.create(
            user=self.user,
            encrypted_api_key=encrypt_user_api_key(plain_key),
        )
        cred.refresh_from_db()
        from identity_access.security import decrypt_user_api_key
        self.assertEqual(decrypt_user_api_key(cred.encrypted_api_key), plain_key)

    @override_settings(AI_FALLBACK_DAILY_QUOTA=3)
    def test_fallback_quota_remaining_initially(self):
        cred = UserAICredential.objects.create(user=self.user)
        self.assertEqual(cred.fallback_quota_remaining, 3)

    @override_settings(AI_FALLBACK_DAILY_QUOTA=2)
    def test_consume_fallback_quota_returns_true_when_available(self):
        cred = UserAICredential.objects.create(user=self.user)
        result = cred.consume_fallback_quota()
        self.assertTrue(result)
        cred.refresh_from_db()
        self.assertEqual(cred.fallback_quota_used_today, 1)
        self.assertEqual(cred.fallback_quota_date, timezone.localdate())

    @override_settings(AI_FALLBACK_DAILY_QUOTA=1)
    def test_consume_fallback_quota_exhausted_returns_false(self):
        cred = UserAICredential.objects.create(user=self.user)
        self.assertTrue(cred.consume_fallback_quota())
        cred.refresh_from_db()
        result = cred.consume_fallback_quota()
        self.assertFalse(result)

    def test_consume_fallback_quota_resets_next_day(self):
        cred = UserAICredential.objects.create(user=self.user)
        yesterday = timezone.localdate() - timedelta(days=1)
        cred.fallback_quota_used_today = 5
        cred.fallback_quota_date = yesterday
        cred.save()
        result = cred.consume_fallback_quota()
        self.assertTrue(result)
        cred.refresh_from_db()
        self.assertEqual(cred.fallback_quota_used_today, 1)
        self.assertEqual(cred.fallback_quota_date, timezone.localdate())

    def test_str_representation(self):
        cred = UserAICredential.objects.create(
            user=self.user,
            ai_provider='gemini',
            ai_model='gemini-1.5-pro',
        )
        self.assertEqual(str(cred), 'cred-owner (gemini/gemini-1.5-pro)')


class PortfolioAICommandCenterViewGetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='cc-view-owner',
            email='cc@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_returns_default_config_when_no_credential_exists(self):
        response = self.client.get('/core/v1/workspace/ai-command-center/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertEqual(data['ai_provider'], 'openclaw')
        self.assertEqual(data['ai_api_key_configured'], False)
        self.assertEqual(data['custom_endpoint'], '')
        self.assertEqual(data['fallback_quota_remaining'], 0)
        self.assertGreater(data['fallback_quota_max'], 0)

    def test_get_returns_user_credential_when_exists(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='gemini',
            ai_model='gemini-1.5-pro',
            encrypted_api_key=encrypt_user_api_key('sk-test'),
        )
        response = self.client.get('/core/v1/workspace/ai-command-center/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertEqual(data['ai_provider'], 'gemini')
        self.assertEqual(data['ai_api_key_configured'], True)
        self.assertEqual(data['ai_api_key'], '')  # never return raw key
        # F4: mask shows last4 only — never full key
        self.assertEqual(data.get('ai_api_key_masked'), '••••••••test')
        self.assertNotIn('sk-test', str(data.get('ai_api_key_masked', '')))

    def test_get_exposes_system_prompt_template(self):
        """F5 — SystemAISettings.prompt_template readable on GET."""
        response = self.client.get('/core/v1/workspace/ai-command-center/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('system_prompt_template', unwrapped(response))
        self.assertIsInstance(unwrapped(response)['system_prompt_template'], str)

    def test_get_local_provider_no_key_needed(self):
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='local',
            ai_model='llama3.2',
            custom_endpoint='http://localhost:11434/v1',
        )
        response = self.client.get('/core/v1/workspace/ai-command-center/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertEqual(data['ai_provider'], 'local')
        self.assertEqual(data['custom_endpoint'], 'http://localhost:11434/v1')
        self.assertTrue(data['ai_ready'])

    def test_get_legacy_fallback_when_no_credential(self):
        UserProfile.objects.create(
            user=self.user,
            preferences={'ai_provider': 'claude', 'api_key': encrypt_user_api_key('legacy-sk')},
        )
        response = self.client.get('/core/v1/workspace/ai-command-center/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertEqual(data['ai_provider'], 'claude')
        self.assertTrue(data['ai_api_key_configured'])


class PortfolioAICommandCenterViewPutTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='cc-put-owner',
            email='cc-put@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_put_saves_provider_and_model(self):
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_provider': 'gemini',
            'ai_model': 'gemini-2.0-flash',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cred = UserAICredential.objects.get(user=self.user)
        self.assertEqual(cred.ai_provider, 'gemini')
        self.assertEqual(cred.ai_model, 'gemini-2.0-flash')

    def test_put_saves_api_key_encrypted(self):
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_api_key': 'sk-new-test-key',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cred = UserAICredential.objects.get(user=self.user)
        self.assertTrue(cred.encrypted_api_key)
        from identity_access.security import decrypt_user_api_key
        self.assertEqual(decrypt_user_api_key(cred.encrypted_api_key), 'sk-new-test-key')

    def test_put_preserves_api_key_for_local_provider(self):
        cred = UserAICredential.objects.create(
            user=self.user,
            ai_provider='local',
            encrypted_api_key=encrypt_user_api_key('should-be-preserved'),
        )
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_api_key': '',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cred.refresh_from_db()
        # local provider intentionally preserves existing key
        from identity_access.security import decrypt_user_api_key
        self.assertEqual(decrypt_user_api_key(cred.encrypted_api_key), 'should-be-preserved')

    def test_put_saves_custom_endpoint(self):
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'custom_endpoint': 'http://10.0.0.1:8080/v1',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cred = UserAICredential.objects.get(user=self.user)
        self.assertEqual(cred.custom_endpoint, 'http://10.0.0.1:8080/v1')

    def test_put_clear_api_key_for_openai_provider(self):
        """F4 — Xóa key: empty ai_api_key clears BYOK provider key."""
        cred = UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            encrypted_api_key=encrypt_user_api_key('sk-should-clear'),
        )
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_api_key': '',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cred.refresh_from_db()
        self.assertEqual(cred.encrypted_api_key, '')
        self.assertFalse(unwrapped(response).get('ai_api_key_configured'))
        self.assertEqual(unwrapped(response).get('ai_api_key_masked'), '')

    def test_put_response_includes_fallback_quota(self):
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_provider': 'openai',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertIn('fallback_quota_remaining', data)
        self.assertIn('fallback_quota_max', data)


class PortfolioAICommandCenterTestViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test-view-owner',
            email='test-view@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_openclaw_returns_success(self):
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openclaw', 'ai_model': 'gpt-4o-mini'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', unwrapped(response))
        self.assertIn('latency_ms', unwrapped(response))

    def test_missing_provider_returns_validation_error(self):
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': '', 'ai_model': 'gpt-4o'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_model_returns_validation_error(self):
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openai', 'ai_model': ''},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('httpx.Client.get')
    def test_local_with_valid_endpoint(self, mock_get):
        mock_response = mock_get.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'data': [{'id': 'llama3.2'}, {'id': 'mistral'}]
        }
        mock_response.elapsed.total_seconds.return_value = 0.15

        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'local', 'ai_model': 'llama3.2',
             'custom_endpoint': 'http://localhost:11434/v1'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('models_available', unwrapped(response))
        self.assertIn('llama3.2', unwrapped(response)['models_available'])

    @patch('httpx.Client.post')
    def test_openai_with_valid_key(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 200

        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openai', 'ai_model': 'gpt-4o-mini',
             'ai_api_key': 'sk-test-valid'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('latency_ms', unwrapped(response))
        self.assertGreaterEqual(unwrapped(response)['latency_ms'], 0)

    @patch('httpx.Client.post')
    def test_probe_returns_401_for_invalid_key(self, mock_post):
        mock_response = mock_post.return_value
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            '401 Unauthorized', request=None, response=mock_response,
        )

        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openai', 'ai_model': 'gpt-4o-mini',
             'ai_api_key': 'sk-invalid'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('401', response.data['detail'])

    def test_probe_fails_without_key_for_remote_provider(self):
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openai', 'ai_model': 'gpt-4o-mini'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Thiếu API Key', response.data['detail'])


class AdvisoryRefreshViewFallbackTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='advisory-fallback',
            email='fallback@example.com',
            password='testpass123',
        )
        from identity_access.models import CoreTenant
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='fallback-tenant',
            display_name='Fallback Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)

    def _ensure_system_settings(self):
        cfg, _ = SystemAISettings.objects.get_or_create(
            is_active=True,
            defaults={
                'name': 'Test Config',
                'ai_model': 'gpt-4o-mini',
                'max_tokens': 5000,
                'temperature': 0.3,
                'prompt_template': 'Test template for {symbol}',
                'metadata': {
                    'encrypted_api_key': encrypt_user_api_key('sk-system-fallback'),
                },
            },
        )
        return cfg

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_fallback_flags_in_response_when_personal_key_fails(self, mock_delay):
        self._ensure_system_settings()
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            encrypted_api_key='',  # no key configured -> personal_key_failed
        )
        from calendar import monthrange
        today = timezone.localdate()
        from commercial.models import QuotaRecord
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
            api_calls_used=0,
            api_calls_limit=10,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(unwrapped(response).get('personal_key_failed'))
        self.assertTrue(unwrapped(response).get('using_system_fallback'))
        self.assertIn('fallback_quota_remaining', unwrapped(response))

    @override_settings(AI_FALLBACK_DAILY_QUOTA=1)
    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_fallback_quota_exhausted_blocks_request(self, mock_delay):
        self._ensure_system_settings()
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            encrypted_api_key='',
            fallback_quota_used_today=1,
            fallback_quota_date=timezone.localdate(),
        )
        from calendar import monthrange
        today = timezone.localdate()
        from commercial.models import QuotaRecord
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
            api_calls_used=0,
            api_calls_limit=10,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Custom exception handler wraps ValidationError in standard envelope
        self.assertIn('fallback_quota_remaining', response.data.get('field_errors', {}))

    @patch('advisory.tasks.generate_advisory_task.delay')
    def test_no_fallback_flags_when_personal_key_works(self, mock_delay):
        self._ensure_system_settings()
        UserAICredential.objects.create(
            user=self.user,
            ai_provider='openai',
            ai_model='gpt-4o-mini',
            encrypted_api_key=encrypt_user_api_key('sk-personal-good'),
        )
        from calendar import monthrange
        today = timezone.localdate()
        from commercial.models import QuotaRecord
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(day=monthrange(today.year, today.month)[1]),
            api_calls_used=0,
            api_calls_limit=10,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )
        response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('personal_key_failed', unwrapped(response))
