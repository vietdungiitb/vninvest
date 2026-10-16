"""AI CC R0.1-R0.2 fail-before (D-01: SSOT staff + self-service user, Owner 2026-10-16).

R0.1: `effective_context['ai_model']` uu tien `UserAICredential.ai_model`,
  fallback SystemAISettings (hien tai luon system — `advisory/views.py:476`).
R0.2: CC GET default phai la canonical v2 `{version:2, sources}` (hien tai
  dict phang + key chet `lookback_unit` — `portfolio_analytics_views.py:963`);
  PUT tu choi shape phang 400 (hien tai nhan moi dict).

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test tests.test_ai_cc_r0_foundation --noinput
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.advisory_helpers import (
    _get_default_prompt_config,
    is_canonical_prompt_config,
)
from advisory.models import SystemAISettings, UserAICredential
from advisory.tests.envelope import unwrapped
from commercial.models import QuotaRecord
from identity_access.models import CoreTenant, UserProfile
from identity_access.security import encrypt_user_api_key
from user_workspace.tests.tenant_test_helpers import grant_tenant
from calendar import monthrange

CC_URL = '/core/v1/workspace/ai-command-center/'


def _v2(lookback=30):
    return {
        'version': 2,
        'sources': {
            'whale': {'enabled': True, 'lookback': lookback},
            'news': {'enabled': False, 'lookback': 14},
        },
    }


class CanonicalShapeTests(TestCase):
    def test_canonical_v2_passes(self):
        self.assertTrue(is_canonical_prompt_config(_v2()))
        self.assertTrue(is_canonical_prompt_config(_get_default_prompt_config()))

    def test_flat_rejected(self):
        self.assertFalse(is_canonical_prompt_config(
            {'whale': {'enabled': True, 'lookback': 30}}))
        self.assertFalse(is_canonical_prompt_config({}))
        self.assertFalse(is_canonical_prompt_config(None))
        self.assertFalse(is_canonical_prompt_config(
            {'version': 2, 'sources': {'nope': {}}}))
        self.assertFalse(is_canonical_prompt_config(
            {'version': 1, 'sources': {}}))


class R02ShapeApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='r02-user', email='r02@example.com', password='testpass123',
        )
        grant_tenant(self.user, role='editor', tenant_code='r02-tenant')
        self.client.force_authenticate(user=self.user)
        self.system = SystemAISettings.objects.create(
            name='R02 System', is_active=True, ai_model='gpt-4o-mini',
            max_tokens=5000, temperature=0.3,
            prompt_template='system {symbol}', metadata={},
        )

    def test_get_default_is_canonical_v2(self):
        g = self.client.get(CC_URL)
        self.assertEqual(g.status_code, status.HTTP_200_OK)
        pc = unwrapped(g)['ai_prompt_config']
        self.assertTrue(is_canonical_prompt_config(pc))
        self.assertNotIn('lookback_unit', str(pc))

    def test_put_flat_rejected_400(self):
        r = self.client.put(
            CC_URL, {'ai_prompt_config': {'whale': {'enabled': True}}},
            format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_put_v2_accepted(self):
        r = self.client.put(
            CC_URL, {'ai_prompt_config': _v2()}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(is_canonical_prompt_config(
            unwrapped(r)['ai_prompt_config']))


class R01UserModelTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='r01-user', email='r01@example.com', password='testpass123',
        )
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user, tenant_code='r01-tenant',
            display_name='R01', plan=CoreTenant.PlanChoices.PRO,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
        self.client.force_authenticate(user=self.user)
        self.system = SystemAISettings.objects.create(
            name='R01 System', is_active=True, ai_model='gpt-4o-mini',
            max_tokens=1000, temperature=0.3,
            prompt_template='sys {symbol}',
        )
        UserProfile.objects.create(
            user=self.user, tenant=self.tenant, display_name='R01',
            language=UserProfile.LanguageChoices.EN,
            preferences={'api_key': encrypt_user_api_key('r01-key')},
        )
        today = timezone.localdate()
        QuotaRecord.objects.create(
            tenant=self.tenant,
            period_start=today.replace(day=1),
            period_end=today.replace(
                day=monthrange(today.year, today.month)[1]),
            api_calls_used=0, api_calls_limit=5,
            symbols_used=0, symbols_limit=-1,
            users_used=0, users_limit=-1,
            storage_mb_used=0, storage_mb_limit=-1,
        )

    def _refresh_ctx(self):
        with patch('advisory.orchestrator.AdvisoryOrchestrator.run') as mock_run:
            mock_run.return_value = {
                'advisory_text': 'x', 'ai_model': 'm', 'tokens_used': 1,
            }
            with patch('advisory.views.generate_advisory_task.delay'):
                resp = self.client.post(
                    '/core/v1/advisory/refresh/FPT/', {}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
            return mock_run.call_args[0][0]

    def test_user_model_wins_over_system(self):
        UserAICredential.objects.create(
            user=self.user, ai_provider='gemini', ai_model='gemini-2.0-flash',
            encrypted_api_key=encrypt_user_api_key('r01-user-key'),
        )
        ctx = self._refresh_ctx()
        self.assertEqual(ctx['ai_model'], 'gemini-2.0-flash')

    def test_blank_user_model_falls_back_to_system(self):
        ctx = self._refresh_ctx()
        self.assertEqual(ctx['ai_model'], 'gpt-4o-mini')
