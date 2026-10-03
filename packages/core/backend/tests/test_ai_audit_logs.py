"""
Tests for AIAuditLog: model, serializer (sanitize), API read endpoint,
and audit log creation via PUT / test-connection views.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

import json

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from advisory.models import AIAuditLog, UserAICredential
from advisory.serializers import sanitize_sensitive_fields, AIAuditLogSerializer
from identity_access.security import encrypt_user_api_key
from identity_access.models import UserProfile
from identity_access.tests.envelope import unwrapped


class SanitizeHelpersTests(TestCase):
    def test_masks_api_key_value(self):
        dirty = {'api_key': 'sk-proj-1234567890abcdef1234'}
        clean = sanitize_sensitive_fields(dirty)
        self.assertNotEqual(clean['api_key'], dirty['api_key'])
        self.assertIn('••••••••', clean['api_key'])
        self.assertNotIn('1234567890abcdef1234', clean['api_key'])

    def test_masks_gemini_api_key(self):
        dirty = {'api_key': 'AIzaSyD-test-key-1234567890abc'}
        clean = sanitize_sensitive_fields(dirty)
        self.assertIn('••••••••', clean['api_key'])

    def test_masks_github_token(self):
        dirty = {'token': 'ghp_1234567890abcdef1234567890abcdef1234'}
        clean = sanitize_sensitive_fields(dirty)
        self.assertIn('••••••••', clean['token'])

    def test_masks_anthropic_key(self):
        dirty = {'api_key': 'sk-ant-1234567890abcdef1234567890'}
        clean = sanitize_sensitive_fields(dirty)
        self.assertIn('••••••••', clean['api_key'])

    def test_preserves_non_sensitive_fields(self):
        dirty = {'ai_provider': 'openai', 'ai_model': 'gpt-4o'}
        clean = sanitize_sensitive_fields(dirty)
        self.assertEqual(clean['ai_provider'], 'openai')
        self.assertEqual(clean['ai_model'], 'gpt-4o')

    def test_sanitizes_nested_dict(self):
        dirty = {'config': {'api_key': 'sk-proj-nested-key-1234567890'}}
        clean = sanitize_sensitive_fields(dirty)
        self.assertIn('••••••••', clean['config']['api_key'])

    def test_short_value_masked_fully(self):
        dirty = {'secret': 'abc'}
        clean = sanitize_sensitive_fields(dirty)
        self.assertEqual(clean['secret'], '••••••••')


class AIAuditLogSerializerTests(TestCase):
    def setUp(self):
        self.log = AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor='testuser',
            reason='Test update',
            before_json={'ai_provider': 'openai', 'api_key': 'sk-proj-plaintext-in-snapshot'},
            after_json={'ai_provider': 'gemini', 'api_key': 'sk-proj-new-key'},
            diff_summary='provider: openai → gemini',
        )

    def test_serializer_masks_api_key_in_before_json(self):
        serializer = AIAuditLogSerializer(self.log)
        data = serializer.data
        self.assertIn('••••••••', data['before_json']['api_key'])
        self.assertNotIn('sk-proj-plaintext-in-snapshot', data['before_json']['api_key'])

    def test_serializer_masks_api_key_in_after_json(self):
        serializer = AIAuditLogSerializer(self.log)
        data = serializer.data
        self.assertIn('••••••••', data['after_json']['api_key'])
        self.assertNotIn('sk-proj-new-key', data['after_json']['api_key'])


class AIAuditLogModelTests(TestCase):
    def test_create_audit_log(self):
        log = AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor='admin',
            reason='Changed provider',
            before_json={'ai_provider': 'openai'},
            after_json={'ai_provider': 'gemini'},
            diff_summary='provider changed',
        )
        self.assertEqual(log.action, 'update_settings')
        self.assertEqual(log.actor, 'admin')
        self.assertIsNotNone(log.created_at)

    def test_str_representation(self):
        log = AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS,
            actor='testuser',
        )
        self.assertIn('test_connection_success', str(log))
        self.assertIn('testuser', str(log))

    def test_default_ordering(self):
        AIAuditLog.objects.create(action=AIAuditLog.ActionChoices.UPDATE_SETTINGS, actor='a')
        AIAuditLog.objects.create(action=AIAuditLog.ActionChoices.UPDATE_SETTINGS, actor='b')
        logs = AIAuditLog.objects.all()
        self.assertEqual(logs[0].actor, 'b')
        self.assertEqual(logs[1].actor, 'a')


class AuditLogAPIGetTests(TestCase):
    """Read endpoint for a NON-STAFF user.

    The endpoint scopes by ``actor=request.user.username`` for anyone who is not
    staff/superuser, so every fixture in this class is created with
    ``actor=self.user.username``. The previous version seeded ``user0..user4``
    and asserted ``total == 5`` for a plain user — that is the cross-tenant
    leak, and the test was asserting the vulnerability rather than the fix.
    Isolation itself is asserted in ``test_non_staff_cannot_read_other_actor``.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='audit-reader',
            email='audit@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

        for i in range(5):
            AIAuditLog.objects.create(
                action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
                actor=self.user.username,
                reason=f'Update {i}',
                before_json={'ai_provider': 'openai'},
                after_json={'ai_provider': 'gemini' if i % 2 == 0 else 'claude'},
                diff_summary=f'Update {i}',
            )

    def test_list_audit_logs(self):
        response = self.client.get('/core/v1/workspace/ai-command-center/audit-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertIn('results', data)
        self.assertIn('total', data)
        self.assertEqual(data['total'], 5)
        self.assertEqual(len(data['results']), 5)

    def test_filter_by_action(self):
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.TEST_CONNECTION_SUCCESS,
            actor=self.user.username,
        )
        response = self.client.get(
            '/core/v1/workspace/ai-command-center/audit-logs/',
            {'action': 'test_connection_success'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(response)['total'], 1)

    def test_filter_by_actor(self):
        response = self.client.get(
            '/core/v1/workspace/ai-command-center/audit-logs/',
            {'actor': self.user.username},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(response)['total'], 5)

    def test_non_staff_cannot_read_other_actor(self):
        """Security assertion: another actor's log must not be readable."""
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor='somebody-else',
            reason='secret change',
        )
        response = self.client.get('/core/v1/workspace/ai-command-center/audit-logs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(response)['total'], 5)
        actors = {row['actor'] for row in unwrapped(response)['results']}
        self.assertNotIn('somebody-else', actors)

    def test_non_staff_cannot_filter_by_other_actor(self):
        AIAuditLog.objects.create(
            action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
            actor='somebody-else',
        )
        response = self.client.get(
            '/core/v1/workspace/ai-command-center/audit-logs/',
            {'actor': 'somebody-else'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(response)['total'], 0)

    def test_pagination_limit(self):
        response = self.client.get(
            '/core/v1/workspace/ai-command-center/audit-logs/',
            {'limit': 2},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(unwrapped(response)['results']), 2)
        self.assertEqual(unwrapped(response)['limit'], 2)

    def test_pagination_offset(self):
        response = self.client.get(
            '/core/v1/workspace/ai-command-center/audit-logs/',
            {'limit': 2, 'offset': 2},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(unwrapped(response)['results']), 2)
        self.assertEqual(unwrapped(response)['offset'], 2)


class AuditLogCreationViaPUTTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='put-audit',
            email='put-audit@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_put_creates_audit_log(self):
        response = self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_provider': 'gemini',
            'ai_model': 'gemini-1.5-pro',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        logs = AIAuditLog.objects.filter(action='update_settings')
        self.assertEqual(logs.count(), 1)
        self.assertEqual(logs[0].actor, 'put-audit')

    def test_put_audit_log_has_diff_summary(self):
        self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_provider': 'gemini',
            'ai_model': 'gemini-1.5-pro',
        }, format='json')
        log = AIAuditLog.objects.filter(action='update_settings').first()
        self.assertTrue(log.diff_summary)
        self.assertIn('ai_provider', log.diff_summary)

    def test_put_audit_log_sanitizes_api_key(self):
        self.client.put('/core/v1/workspace/ai-command-center/', {
            'ai_api_key': 'sk-proj-test-key-for-sanitize-check',
        }, format='json')
        log = AIAuditLog.objects.filter(action='update_settings').first()
        self.assertIsNotNone(log)
        self.assertNotIn('sk-proj-test-key-for-sanitize-check', str(log.before_json))
        self.assertNotIn('sk-proj-test-key-for-sanitize-check', str(log.after_json))


class AuditLogCreationViaTestConnectionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='test-audit',
            email='test-audit@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_openclaw_creates_success_audit_log(self):
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openclaw', 'ai_model': 'gpt-4o-mini'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        logs = AIAuditLog.objects.filter(action='test_connection_success')
        self.assertGreaterEqual(logs.count(), 1)

    def test_missing_key_creates_failure_audit_log(self):
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': 'openai', 'ai_model': 'gpt-4o-mini'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        logs = AIAuditLog.objects.filter(action='test_connection_failed')
        self.assertGreaterEqual(logs.count(), 1)

    def test_missing_provider_no_audit_log(self):
        """Validation errors before the audit point should not create logs."""
        response = self.client.post(
            '/core/v1/workspace/ai-command-center/test-connection/',
            {'ai_provider': '', 'ai_model': 'gpt-4o'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        logs = AIAuditLog.objects.all()
        self.assertEqual(logs.count(), 0)


class UserConfigEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='uc-reader',
            email='uc@example.com',
            password='testpass123',
        )
        self.client.force_authenticate(user=self.user)

    def test_get_userconfig_returns_event_gate(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.preferences = {'advisory_whale_signal_enabled': False}
        profile.save()

        response = self.client.get('/core/v1/workspace/userconfig/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = unwrapped(response)
        self.assertIn('advisory_whale_signal_enabled', data)
        self.assertFalse(data['advisory_whale_signal_enabled'])

    def test_get_userconfig_defaults_true(self):
        response = self.client.get('/core/v1/workspace/userconfig/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(unwrapped(response)['advisory_whale_signal_enabled'])
