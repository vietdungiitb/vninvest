"""
Slice F7 — AI CC prompt config version history + rollback (F-AC7).

Covers:
- F-AC7a PUT with changed ai_prompt_config appends history (source=save)
- F-AC7b PUT same config does not append
- F-AC7c GET returns ai_prompt_config_history with full config (rollback GET old)
- F-AC7d POST rollback restores version config + appends source=rollback
- F-AC7e history capped at PROMPT_CONFIG_HISTORY_LIMIT (20)
- F-AC7f invalid version → 400; history isolated per user
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from advisory.advisory_helpers import PROMPT_CONFIG_HISTORY_LIMIT
from advisory.models import SystemAISettings, UserAICredential
from advisory.tests.envelope import unwrapped
from user_workspace.tests.tenant_test_helpers import grant_tenant

CC_URL = '/core/v1/workspace/ai-command-center/'
ROLLBACK_URL = '/core/v1/workspace/ai-command-center/prompt-config/rollback/'


def v2sector(lookback):
    """Fixture v2 R0.2 cho source sector."""
    return {'version': 2, 'sources': {'sector': {'enabled': True, 'lookback': lookback}}}


class PromptConfigHistoryTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='f7-user', email='f7@example.com', password='testpass123',
        )
        grant_tenant(self.user, role='editor', tenant_code='f7-history-tenant')
        self.client.force_authenticate(user=self.user)
        self.system = SystemAISettings.objects.create(
            name='F7 System',
            is_active=True,
            ai_model='gpt-4o-mini',
            max_tokens=5000,
            temperature=0.3,
            prompt_template='system {symbol}',
            metadata={},
        )

    def _put_config(self, config):
        return self.client.put(CC_URL, {'ai_prompt_config': config}, format='json')

    def test_f_ac7a_save_appends_history(self):
        """Changed prompt_config → one history entry source=save with full config."""
        cfg1 = {'version': 2, 'sources': {'whale': {'enabled': True, 'lookback': 30}}}
        r = self._put_config(cfg1)
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        history = unwrapped(r).get('ai_prompt_config_history')
        self.assertIsInstance(history, list)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['version'], 1)
        self.assertEqual(history[0]['source'], 'save')
        self.assertEqual(history[0]['config'], cfg1)

        cfg2 = {'version': 2, 'sources': {'whale': {'enabled': False, 'lookback': 7}}}
        r2 = self._put_config(cfg2)
        self.assertEqual(len(unwrapped(r2)['ai_prompt_config_history']), 2)
        self.assertEqual(unwrapped(r2)['ai_prompt_config_history'][1]['version'], 2)
        self.assertEqual(unwrapped(r2)['ai_prompt_config_history'][1]['config'], cfg2)

    def test_f_ac7b_same_config_no_duplicate_append(self):
        """Identical prompt_config → history length unchanged."""
        cfg = {'version': 2, 'sources': {'news': {'enabled': True, 'lookback': 14}}}
        self._put_config(cfg)
        r = self._put_config(dict(cfg))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(len(unwrapped(r)['ai_prompt_config_history']), 1)

    def test_f_ac7c_get_returns_history_for_rollback(self):
        """GET old: history includes full config so FE can inspect before rollback."""
        cfg1 = {'version': 2, 'sources': {'market': {'enabled': True, 'lookback': 7}}}
        self._put_config(cfg1)
        g = self.client.get(CC_URL)
        self.assertEqual(g.status_code, status.HTTP_200_OK)
        history = unwrapped(g).get('ai_prompt_config_history')
        self.assertIsInstance(history, list)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['config'], cfg1)
        self.assertIn('saved_at', history[0])

    def test_f_ac7d_rollback_restores_version(self):
        """POST rollback version 1 after v2 overwrites → prompt_config = v1 config."""
        cfg1 = {'version': 2, 'sources': {'whale': {'enabled': True, 'lookback': 90}}}
        cfg2 = {'version': 2, 'sources': {'whale': {'enabled': True, 'lookback': 10}}}
        self._put_config(cfg1)
        self._put_config(cfg2)

        r = self.client.post(ROLLBACK_URL, {'version': 1}, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(r)['rolled_back_to'], 1)
        self.assertEqual(unwrapped(r)['ai_prompt_config']['sources'], cfg1['sources'])

        cred = UserAICredential.objects.get(user=self.user)
        self.assertEqual(cred.prompt_config, cfg1)
        self.assertEqual(cred.prompt_config_history[-1]['source'], 'rollback')
        self.assertEqual(cred.prompt_config_history[-1]['config'], cfg1)

        g = self.client.get(CC_URL)
        self.assertEqual(unwrapped(g)['ai_prompt_config']['sources'], cfg1['sources'])

    def test_f_ac7e_history_capped_at_limit(self):
        """Appends past PROMPT_CONFIG_HISTORY_LIMIT drop oldest (F7 cap 20)."""
        for i in range(PROMPT_CONFIG_HISTORY_LIMIT + 5):
            r = self._put_config(v2sector(i + 1))
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        history = unwrapped(r)['ai_prompt_config_history']
        self.assertEqual(len(history), PROMPT_CONFIG_HISTORY_LIMIT)
        # newest last
        self.assertEqual(history[-1]['version'], PROMPT_CONFIG_HISTORY_LIMIT + 5)
        self.assertEqual(history[-1]['config'], v2sector(PROMPT_CONFIG_HISTORY_LIMIT + 5))

    def test_rollback_invalid_version_400(self):
        self._put_config({'version': 2, 'sources': {'whale': {'enabled': True, 'lookback': 30}}})
        r = self.client.post(ROLLBACK_URL, {'version': 999}, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        r2 = self.client.post(ROLLBACK_URL, {'version': 'abc'}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_history_isolated_per_user(self):
        """User A history ≠ User B (multi-tenant isolation C-AC3 extension)."""
        user_b = User.objects.create_user(username='f7-b', email='b@example.com', password='testpass123')
        client_b = APIClient()
        # User B o tenant rieng: test dang kiem tra moi user co history rieng.
        grant_tenant(user_b, role='editor', tenant_code='f7-history-tenant-b')
        client_b.force_authenticate(user=user_b)

        self._put_config({'version': 2, 'sources': {'whale': {'enabled': True, 'lookback': 30}}})
        client_b.put(CC_URL, {'ai_prompt_config': {'version': 2, 'sources': {'whale': {'enabled': False, 'lookback': 7}}}}, format='json')

        g_a = self.client.get(CC_URL)
        g_b = client_b.get(CC_URL)
        self.assertEqual(len(unwrapped(g_a)['ai_prompt_config_history']), 1)
        self.assertEqual(len(unwrapped(g_b)['ai_prompt_config_history']), 1)
        self.assertEqual(unwrapped(g_a)['ai_prompt_config_history'][0]['config']['whale']['lookback'], 30)
        self.assertEqual(unwrapped(g_b)['ai_prompt_config_history'][0]['config']['whale']['lookback'], 7)

        cred_a = UserAICredential.objects.get(user=self.user)
        cred_b = UserAICredential.objects.get(user=user_b)
        self.assertEqual(len(cred_a.prompt_config_history), 1)
        self.assertEqual(len(cred_b.prompt_config_history), 1)
