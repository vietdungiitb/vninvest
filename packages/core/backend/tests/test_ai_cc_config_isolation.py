"""
Slice C — AI CC multi-tenant config isolation (IC-SSOT-20260924).

Covers:
- C-AC1 UserA temperature ≠ UserB
- C-AC2 UserA max_tokens ≠ UserB
- C-AC3 UserA prompt_config ≠ UserB
- C-AC4 PUT does not mutate SystemAISettings
- C-AC5 FE response shape unchanged (same keys)
- Lazy default: NULL user fields fall back to system
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

from advisory.models import SystemAISettings, UserAICredential
from advisory.tests.envelope import unwrapped

CC_URL = '/core/v1/workspace/ai-command-center/'


class AICommandCenterIsolationTests(TestCase):
    """2-user matrix for per-user advisory config (C.1 checklist)."""

    def setUp(self):
        self.client_a = APIClient()
        self.client_b = APIClient()
        self.user_a = User.objects.create_user(
            username='cc-iso-a', email='a@example.com', password='testpass123',
        )
        self.user_b = User.objects.create_user(
            username='cc-iso-b', email='b@example.com', password='testpass123',
        )
        self.client_a.force_authenticate(user=self.user_a)
        self.client_b.force_authenticate(user=self.user_b)

        self.system = SystemAISettings.objects.create(
            name='Iso Test System',
            is_active=True,
            ai_model='gpt-4o-mini',
            max_tokens=5000,
            temperature=0.3,
            prompt_template='system {symbol}',
            metadata={
                'advisory_refresh_interval_hours': 24,
                'advisory_max_auto_refreshes_per_day': 12,
                'ai_prompt_config': {'whale': {'enabled': True, 'lookback': 180}},
            },
        )

    def test_c_ac1_user_a_temperature_isolated_from_user_b(self):
        """C-AC1: UserA temperature ≠ UserB after each PUT."""
        r_a = self.client_a.put(CC_URL, {'temperature': 0.9}, format='json')
        self.assertEqual(r_a.status_code, status.HTTP_200_OK)
        self.assertAlmostEqual(unwrapped(r_a)['temperature'], 0.9, places=5)

        r_b = self.client_b.put(CC_URL, {'temperature': 0.1}, format='json')
        self.assertEqual(r_b.status_code, status.HTTP_200_OK)
        self.assertAlmostEqual(unwrapped(r_b)['temperature'], 0.1, places=5)

        g_a = self.client_a.get(CC_URL)
        g_b = self.client_b.get(CC_URL)
        self.assertAlmostEqual(unwrapped(g_a)['temperature'], 0.9, places=5)
        self.assertAlmostEqual(unwrapped(g_b)['temperature'], 0.1, places=5)

        cred_a = UserAICredential.objects.get(user=self.user_a)
        cred_b = UserAICredential.objects.get(user=self.user_b)
        self.assertAlmostEqual(cred_a.temperature, 0.9, places=5)
        self.assertAlmostEqual(cred_b.temperature, 0.1, places=5)

    def test_c_ac2_user_a_max_tokens_isolated_from_user_b(self):
        """C-AC2: UserA max_tokens_per_day ≠ UserB."""
        r_a = self.client_a.put(CC_URL, {'advisory_max_tokens_per_day': 1111}, format='json')
        self.assertEqual(r_a.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(r_a)['advisory_max_tokens_per_day'], 1111)

        r_b = self.client_b.put(CC_URL, {'advisory_max_tokens_per_day': 9999}, format='json')
        self.assertEqual(r_b.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(r_b)['advisory_max_tokens_per_day'], 9999)

        g_a = self.client_a.get(CC_URL)
        g_b = self.client_b.get(CC_URL)
        self.assertEqual(unwrapped(g_a)['advisory_max_tokens_per_day'], 1111)
        self.assertEqual(unwrapped(g_b)['advisory_max_tokens_per_day'], 9999)

        cred_a = UserAICredential.objects.get(user=self.user_a)
        cred_b = UserAICredential.objects.get(user=self.user_b)
        self.assertEqual(cred_a.max_tokens_per_day, 1111)
        self.assertEqual(cred_b.max_tokens_per_day, 9999)

    def test_c_ac3_user_a_prompt_config_isolated_from_user_b(self):
        """C-AC3: UserA ai_prompt_config ≠ UserB."""
        prompt_a = {'whale': {'enabled': True, 'lookback': 30}}
        prompt_b = {'whale': {'enabled': False, 'lookback': 7}}

        r_a = self.client_a.put(CC_URL, {'ai_prompt_config': prompt_a}, format='json')
        self.assertEqual(r_a.status_code, status.HTTP_200_OK)
        r_b = self.client_b.put(CC_URL, {'ai_prompt_config': prompt_b}, format='json')
        self.assertEqual(r_b.status_code, status.HTTP_200_OK)

        g_a = self.client_a.get(CC_URL)
        g_b = self.client_b.get(CC_URL)
        self.assertEqual(unwrapped(g_a)['ai_prompt_config']['whale']['lookback'], 30)
        self.assertEqual(unwrapped(g_b)['ai_prompt_config']['whale']['lookback'], 7)

        cred_a = UserAICredential.objects.get(user=self.user_a)
        cred_b = UserAICredential.objects.get(user=self.user_b)
        self.assertEqual(cred_a.prompt_config['whale']['lookback'], 30)
        self.assertEqual(cred_b.prompt_config['whale']['lookback'], 7)

    def test_c_ac4_put_does_not_mutate_system_ai_settings(self):
        """C-AC4: PUT never writes SystemAISettings temperature/max_tokens/metadata/ai_model."""
        before_temp = self.system.temperature
        before_tokens = self.system.max_tokens
        before_model = self.system.ai_model
        before_meta = dict(self.system.metadata)

        r = self.client_a.put(CC_URL, {
            'temperature': 0.77,
            'advisory_max_tokens_per_day': 123,
            'advisory_refresh_interval_hours': 6,
            'advisory_max_auto_refreshes_per_day': 3,
            'ai_prompt_config': {'news': {'enabled': False}},
            'ai_model': 'gpt-4o',
        }, format='json')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

        self.system.refresh_from_db()
        self.assertEqual(self.system.temperature, before_temp)
        self.assertEqual(self.system.max_tokens, before_tokens)
        self.assertEqual(self.system.ai_model, before_model)
        self.assertEqual(self.system.metadata, before_meta)

        # Response still reflects user values (not system)
        self.assertAlmostEqual(unwrapped(r)['temperature'], 0.77, places=5)
        self.assertEqual(unwrapped(r)['advisory_max_tokens_per_day'], 123)
        self.assertEqual(unwrapped(r)['advisory_refresh_interval_hours'], 6)
        self.assertEqual(unwrapped(r)['ai_prompt_config'], {'news': {'enabled': False}})

    def test_c_ac5_response_shape_keys_stable(self):
        """C-AC5: GET returns same FE contract keys."""
        required = {
            'ai_provider', 'ai_model', 'ai_api_key', 'ai_api_key_configured',
            'custom_endpoint', 'effective_ai_source', 'effective_ai_provider',
            'effective_ai_model', 'ai_ready', 'ai_config_message',
            'ai_prompt_config', 'advisory_refresh_interval_hours',
            'advisory_max_auto_refreshes_per_day', 'advisory_max_tokens_per_day',
            'temperature', 'fallback_quota_remaining', 'fallback_quota_max',
            'fallback_quota_reset',
        }
        g = self.client_a.get(CC_URL)
        self.assertEqual(g.status_code, status.HTTP_200_OK)
        missing = required - set(unwrapped(g).keys())
        self.assertEqual(missing, set(), f'missing keys: {missing}')

    def test_lazy_default_null_fields_fall_back_to_system(self):
        """C.1.5: user row with NULL policy fields → system defaults, no mass backfill."""
        UserAICredential.objects.create(user=self.user_a, ai_provider='openai')
        g = self.client_a.get(CC_URL)
        self.assertEqual(g.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(g)['advisory_max_tokens_per_day'], self.system.max_tokens)
        self.assertAlmostEqual(unwrapped(g)['temperature'], self.system.temperature, places=5)
        self.assertEqual(unwrapped(g)['advisory_refresh_interval_hours'], 24)
        self.assertEqual(unwrapped(g)['advisory_max_auto_refreshes_per_day'], 12)

        cred = UserAICredential.objects.get(user=self.user_a)
        self.assertIsNone(cred.temperature)
        self.assertIsNone(cred.max_tokens_per_day)
        self.assertIsNone(cred.refresh_interval_hours)
        self.assertIsNone(cred.max_auto_refreshes_per_day)
        self.assertEqual(cred.prompt_config, {})

    def test_put_does_not_leak_user_b_values_to_user_a(self):
        """User B PUT policy; User A GET still system (or own) — no cross-read."""
        self.client_b.put(CC_URL, {
            'temperature': 0.05,
            'advisory_max_tokens_per_day': 42,
        }, format='json')

        g_a = self.client_a.get(CC_URL)
        self.assertAlmostEqual(unwrapped(g_a)['temperature'], self.system.temperature, places=5)
        self.assertEqual(unwrapped(g_a)['advisory_max_tokens_per_day'], self.system.max_tokens)

    def test_audit_after_snapshot_reflects_user_rows(self):
        """C.1.6: AIAuditLog after_json uses user policy values."""
        self.client_a.put(CC_URL, {
            'temperature': 0.55,
            'advisory_max_tokens_per_day': 777,
        }, format='json')

        from advisory.models import AIAuditLog
        log = AIAuditLog.objects.filter(
            action='update_settings', actor='cc-iso-a',
        ).order_by('-pk').first()
        self.assertIsNotNone(log)
        self.assertAlmostEqual(log.after_json['temperature'], 0.55, places=5)
        self.assertEqual(log.after_json['advisory_max_tokens_per_day'], 777)
        self.assertIn('temperature', log.diff_summary)

    def test_advisory_config_validation_rejects_invalid_values(self):
        cases = [
            {'advisory_refresh_interval_hours': 'invalid'},
            {'advisory_refresh_interval_hours': 0},
            {'advisory_max_auto_refreshes_per_day': 25},
            {'advisory_max_tokens_per_day': 0},
            {'advisory_max_tokens_per_day': 100001},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                response = self.client_a.put(CC_URL, payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
