import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import SystemAISettings, AdvisoryRecord
from advisory.tests.envelope import unwrapped
from advisory.models import AdvisoryComponent, AdvisorySession
from identity_access.models import CoreTenant, UserProfile
from identity_access.security import encrypt_user_api_key
from commercial.models import QuotaRecord
from calendar import monthrange
from django.utils import timezone

class AdvisorySsotContextMergeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user-ssot-test',
            email='ssot-test@example.com',
            password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='ssot-tenant-1',
            display_name='SSOT Tenant',
            plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)

        # Create active SystemAISettings
        self.system_settings = SystemAISettings.objects.create(
            name='default',
            is_active=True,
            ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
            max_tokens=1000,
            temperature=0.3,
            prompt_template='He thong tu van chung khoan',
        )

        # Create UserProfile with language='en' and BYOK key
        self.profile = UserProfile.objects.create(
            user=self.user,
            tenant=self.tenant,
            display_name='User A',
            language=UserProfile.LanguageChoices.EN,
            preferences={
                'api_key': encrypt_user_api_key('my-byok-plaintext-key')
            }
        )

    def _current_period(self):
        today = timezone.localdate()
        return (
            today.replace(day=1),
            today.replace(day=monthrange(today.year, today.month)[1]),
        )

    def _create_quota_record(self, *, used: int, limit: int):
        period_start, period_end = self._current_period()
        return QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=period_start,
            period_end=period_end,
            api_calls_used=used,
            api_calls_limit=limit,
            symbols_used=0,
            symbols_limit=-1,
            users_used=0,
            users_limit=-1,
            storage_mb_used=0,
            storage_mb_limit=-1,
        )

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_advisory_refresh_merges_context_correctly(self):
        self._create_quota_record(used=0, limit=5)

        with patch('advisory.orchestrator.AdvisoryOrchestrator.run') as mock_run:
            # Set a mock return value so AdvisoryOrchestrator.run works correctly
            mock_run.return_value = {
                'advisory_text': 'Mock analysis',
                'ai_model': 'gpt-4o-mini',
                'tokens_used': 100,
            }

            response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(mock_run.called)
            
            # Extract the effective_context passed to the orchestrator
            effective_context = mock_run.call_args[0][0]
            
            # Assertions matching the test protocol exactly
            self.assertEqual(effective_context['ai_model'], 'gpt-4o-mini')
            self.assertEqual(effective_context['language'], 'en')
            self.assertEqual(effective_context['api_key'], 'my-byok-plaintext-key')

            # Verify that context_snapshot['effective_ai_context'] is stored
            record = AdvisoryRecord.objects.get(
                advisory_id=unwrapped(response)['advisory_id'])
            self.assertIn('effective_ai_context', record.context_snapshot)
            self.assertEqual(record.context_snapshot['effective_ai_context']['api_key'], '[redacted]')

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_advisory_refresh_falls_back_to_system_api_key(self):
        # Clear BYOK key from user profile preferences to trigger system fallback
        self.profile.preferences = {}
        self.profile.save()

        # Save system-wide key in metadata
        self.system_settings.metadata = {
            'encrypted_api_key': encrypt_user_api_key('system-level-fallback-key'),
            'ai_api_key_configured': True,
            'ai_provider': 'openai',
        }
        self.system_settings.save()

        self._create_quota_record(used=0, limit=5)

        with patch('advisory.orchestrator.AdvisoryOrchestrator.run') as mock_run:
            mock_run.return_value = {
                'advisory_text': 'Mock analysis with fallback key',
                'ai_model': 'gpt-4o-mini',
                'tokens_used': 100,
            }

            response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
            self.assertTrue(mock_run.called)
            
            effective_context = mock_run.call_args[0][0]
            
            # Assertions for fallback key matching system-level-fallback-key
            self.assertEqual(effective_context['ai_model'], 'gpt-4o-mini')
            self.assertEqual(effective_context['api_key'], 'system-level-fallback-key')

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_advisory_refresh_materializes_session_and_components(self):
        self._create_quota_record(used=0, limit=5)

        with patch('advisory.orchestrator.AdvisoryOrchestrator.run') as mock_run:
            # R0.2: orchestrator nay luôn trả `signal` + `confidence_score`.
            mock_run.return_value = {
                'advisory_text': 'Multi-turn advisory summary',
                'ai_model': 'gpt-4o-mini',
                'tokens_used': 120,
                'signal': 'BUY',
                'signal_raw': 'MUA',
                'confidence_score': 0.78,
                'summary': 'Multi-turn advisory summary',
                'rationale': 'Dòng tiền tích cực.',
                'recommendation': 'MUA LÚC',
                'risk_level': 'medium',
            }

            response = self.client.post('/core/v1/advisory/refresh/FPT/', {}, format='json')

            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        record = AdvisoryRecord.objects.get(
                advisory_id=unwrapped(response)['advisory_id'])
        session = AdvisorySession.objects.get(user=self.user, symbol='FPT', session_date=record.session_date)
        self.assertEqual(session.status, AdvisorySession.StatusChoices.COMPLETED)
        self.assertEqual(session.tokens_used, 120)
        self.assertEqual(session.context_snapshot['advisory_record_id'], str(record.advisory_id))
        self.assertEqual(session.context_snapshot['effective_ai_context']['api_key'], '[redacted]')

        components = AdvisoryComponent.objects.filter(session=session).order_by('order')
        # R0.2: contract mới có `recommendation` nên materialize thêm component
        # RECOMMENDATION (RAW_CONTEXT, SUMMARY, RECOMMENDATION).
        self.assertEqual(components.count(), 3)
        self.assertEqual(components[0].component_type, AdvisoryComponent.ComponentType.RAW_CONTEXT)
        self.assertIn('[redacted]', components[0].content)
        self.assertEqual(components[1].component_type, AdvisoryComponent.ComponentType.SUMMARY)
        self.assertIn('Multi-turn advisory summary', components[1].content)
        self.assertEqual(components[2].component_type, AdvisoryComponent.ComponentType.RECOMMENDATION)
        self.assertIn('MUA LÚC', components[2].content)

        # R0.3: structured_output phải đủ key và signal phải dùng được.
        self.assertEqual(record.status, AdvisoryRecord.StatusChoices.GENERATED)
        self.assertEqual(record.structured_output['signal'], 'BUY')
        self.assertEqual(record.structured_output['confidence_score'], 0.78)
        self.assertEqual(record.structured_output['schema_version'], 2)

    @override_settings(CELERY_TASK_ALWAYS_EAGER=True)
    def test_unparseable_signal_marks_failed_instead_of_fake_direction(self):
        """R0.2 fail-closed: không đọc được signal thì KHÔNG ghi 'generated'."""
        self._create_quota_record(used=0, limit=5)

        with patch('advisory.orchestrator.AdvisoryOrchestrator.run') as mock_run:
            mock_run.return_value = {
                'advisory_text': 'Mô hình trả về một đoạn văn không có khuyến nghị rõ ràng.',
                'ai_model': 'gpt-4o-mini',
                'tokens_used': 50,
                'signal': 'UNKNOWN',
                'signal_raw': 'không rõ',
                'recommendation': '',
                'summary': 'Không kết luận được.',
            }

            response = self.client.post('/core/v1/advisory/refresh/VIC/', {}, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        record = AdvisoryRecord.objects.get(
                advisory_id=unwrapped(response)['advisory_id'])
        self.assertEqual(record.status, AdvisoryRecord.StatusChoices.FAILED)
        self.assertEqual(
            record.structured_output['error']['error_code'],
            'advisory_signal_unparseable',
        )
        self.assertFalse(
            AdvisorySession.objects.filter(symbol='VIC', user=self.user).exists()
        )

