"""AI CC R0.4 (readiness struct) + R0.5 (provider membership) fail-before.

R0.4: CC GET them `ai_readiness` {ready, reason_code, checked_at, ttl_seconds}
  (D-04: validate tinh, probe that o R2.7). `ai_ready` bool giu nguyen.
R0.5: PUT tu choi provider la (copilot/xyz/...) 400 — hien tai gan thang
  khong kiem (chi match model SAU khi luu). D-03 (tat claude/go openclaw
  khoi UI) can Owner, KHONG lam o day.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test tests.test_ai_cc_r04_r05 --noinput
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import SystemAISettings, UserAICredential
from advisory.tests.envelope import unwrapped
from user_workspace.tests.tenant_test_helpers import grant_tenant

CC_URL = '/core/v1/workspace/ai-command-center/'


class ReadinessStructTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='r04-user', email='r04@example.com', password='testpass123',
        )
        grant_tenant(self.user, role='editor', tenant_code='r04-tenant')
        self.client.force_authenticate(user=self.user)
        SystemAISettings.objects.create(
            name='R04 System', is_active=True, ai_model='gpt-4o-mini',
            max_tokens=5000, temperature=0.3,
            prompt_template='system {symbol}',
        )

    def test_get_has_readiness_struct_matching_ready(self):
        g = self.client.get(CC_URL)
        self.assertEqual(g.status_code, status.HTTP_200_OK)
        body = unwrapped(g)
        self.assertIn('ai_ready', body)
        readiness = body.get('ai_readiness')
        self.assertIsInstance(readiness, dict)
        self.assertEqual(readiness['ready'], body['ai_ready'])
        self.assertIn(readiness['reason_code'], {
            'ok_configured', 'missing_api_key', 'system_default_no_key_needed',
        })
        self.assertIn('checked_at', readiness)
        self.assertEqual(readiness['ttl_seconds'], 300)

    def test_missing_key_reason_when_byok_without_key(self):
        self.client.put(
            CC_URL, {'ai_provider': 'openai', 'ai_model': 'gpt-4o-mini'},
            format='json')
        g = self.client.get(CC_URL)
        body = unwrapped(g)
        self.assertFalse(body['ai_ready'])
        self.assertFalse(body['ai_readiness']['ready'])
        self.assertEqual(
            body['ai_readiness']['reason_code'], 'missing_api_key')


class ProviderMembershipTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='r05-user', email='r05@example.com', password='testpass123',
        )
        grant_tenant(self.user, role='editor', tenant_code='r05-tenant')
        self.client.force_authenticate(user=self.user)
        SystemAISettings.objects.create(
            name='R05 System', is_active=True, ai_model='gpt-4o-mini',
            max_tokens=5000, temperature=0.3,
            prompt_template='system {symbol}',
        )

    def test_put_unknown_provider_400(self):
        # R2.4 (2026-10-17) bat lai `copilot` voi client 2-buoc that ⇒ no khong
        # con la "provider la" nua. R2.5 them `openclaw` client fail-closed.
        for provider in ('xyz-broker', ''):
            with self.subTest(provider=provider):
                r = self.client.put(
                    CC_URL, {'ai_provider': provider}, format='json')
                self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_put_known_providers_accepted(self):
        for provider in ('openai', 'gemini', 'local', 'openclaw', 'claude', 'copilot'):
            with self.subTest(provider=provider):
                r = self.client.put(
                    CC_URL, {'ai_provider': provider}, format='json')
                self.assertEqual(r.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    UserAICredential.objects.get(
                        user=self.user).ai_provider, provider)
