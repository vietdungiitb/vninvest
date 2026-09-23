"""B1.2 tests: broker config API (providers/schema/CRUD/test-connection/jobs) + alias cũ.

Chạy: python manage.py test user_workspace.test_broker_config_api
"""
import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from user_workspace.models import DNSECredential, UserBrokerConfig

BASE = '/core/v1/broker'
SECRET_ID = 'CID-TEST-001'
SECRET_SEC = 'CSEC-TEST-002'


class BrokerProvidersApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bprov', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_providers_lists_dnse_supported_ssi_tcbs_pending(self):
        resp = self.client.get(f'{BASE}/providers/')
        self.assertEqual(resp.status_code, 200)
        by_id = {p['id']: p for p in resp.json()['providers']}
        self.assertEqual(set(by_id), {'dnse', 'ssi', 'tcbs'})
        self.assertEqual(by_id['ssi']['status'], 'not_supported_yet')
        self.assertEqual(by_id['tcbs']['status'], 'not_supported_yet')
        self.assertEqual(by_id['dnse']['status'], 'never_connected')

    def test_schema_dnse_shape(self):
        resp = self.client.get(f'{BASE}/config-schema/dnse/')
        self.assertEqual(resp.status_code, 200)
        fields = {f['key']: f for f in resp.json()['fields']}
        self.assertTrue(fields['client_id']['required'] and fields['client_id']['secret'])
        self.assertTrue(fields['client_secret']['required'] and fields['client_secret']['secret'])

    def test_schema_ssi_not_supported_yet(self):
        resp = self.client.get(f'{BASE}/config-schema/ssi/')
        self.assertEqual(resp.status_code, 400)

    def test_unknown_provider_404(self):
        resp = self.client.get(f'{BASE}/config-schema/xyz/')
        self.assertEqual(resp.status_code, 404)


class BrokerConfigCrudTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bcrud', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_post_missing_field_400_per_field(self):
        resp = self.client.post(
            f'{BASE}/dnse/config/', {'client_id': '  '}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('client_secret', str(resp.content))

    def test_post_valid_masks_secret_and_fernet_db(self):
        resp = self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')
        self.assertEqual(resp.status_code, 200)
        body = json.dumps(resp.json())
        self.assertNotIn(SECRET_ID, body)
        self.assertNotIn(SECRET_SEC, body)
        self.assertIn('****', body)
        cfg = UserBrokerConfig.objects.get(user=self.user, provider='dnse')
        self.assertNotIn(SECRET_ID, cfg.secrets_cipher)
        self.assertEqual(cfg.get_secrets()['client_id'], SECRET_ID)
        # mirror sang store cũ để tasks sync còn chạy (transitional)
        legacy = DNSECredential.objects.get(user=self.user)
        self.assertTrue(legacy.has_credentials())

    def test_get_and_delete(self):
        self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')
        resp = self.client.get(f'{BASE}/dnse/config/')
        self.assertTrue(resp.json()['is_configured'])
        self.assertEqual(resp.json()['status'], 'never_connected')
        resp = self.client.delete(f'{BASE}/dnse/config/')
        self.assertEqual(resp.status_code, 200)
        resp = self.client.get(f'{BASE}/dnse/config/')
        self.assertFalse(resp.json()['is_configured'])

    def test_legacy_route_compat_shape(self):
        """Path cũ broker/dnse/config/ nay do view mới phục vụ (store UserBrokerConfig)."""
        resp = self.client.post(
            '/core/v1/broker/dnse/config/',
            {'client_id': 'LEGID', 'client_secret': 'LEGSEC'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['ok'])
        self.assertIn('****', json.dumps(resp.json()))
        resp = self.client.get('/core/v1/broker/dnse/config/')
        self.assertTrue(resp.json()['is_configured'])
        self.assertIn('****', resp.json()['preview']['client_id'])
        self.assertTrue(UserBrokerConfig.objects.filter(
            user=self.user, provider='dnse').exists())


class BrokerTestConnectionTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()  # sqlite tái dùng id sau rollback → key rate-limit trùng giữa tests
        self.user = User.objects.create_user(username='btest', password='x')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_requires_config_first(self):
        resp = self.client.post(f'{BASE}/dnse/test-connection/', {}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_enqueue_returns_job_immediately(self):
        self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')

        class FakeJob:
            id = 'job-123'

        with patch(
                'user_workspace.views_broker.test_broker_connection_task') as mock_task:
            mock_task.delay.return_value = FakeJob()
            resp = self.client.post(f'{BASE}/dnse/test-connection/', {}, format='json')
        self.assertEqual(resp.status_code, 202)
        self.assertEqual(resp.json()['job_id'], 'job-123')

    def test_rate_limit_sixth_rejected(self):
        self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': SECRET_ID, 'client_secret': SECRET_SEC}, format='json')

        class FakeJob:
            id = 'job-x'

        with patch(
                'user_workspace.views_broker.test_broker_connection_task') as mock_task:
            mock_task.delay.return_value = FakeJob()
            codes = [
                self.client.post(f'{BASE}/dnse/test-connection/', {}, format='json').status_code
                for _ in range(6)
            ]
        self.assertEqual(codes[:5], [202] * 5)
        self.assertEqual(codes[5], 429)

    def test_job_poll_unknown_pending(self):
        resp = self.client.get(f'{BASE}/jobs/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['state'], 'pending')


class BrokerConnectionTaskTests(TestCase):
    def test_task_marks_error_without_leaking_secret(self):
        user = User.objects.create_user(username='btask', password='x')
        from user_workspace.models import set_user_broker_secrets
        cfg = set_user_broker_secrets(
            user, 'dnse', {'client_id': 'BADID', 'client_secret': 'BADSEC'})
        from user_workspace.tasks import test_broker_connection_task
        with patch(
                'user_workspace.vnbroker_dnse_compat.build_dnse_client',
                side_effect=RuntimeError('upstream down')):
            result = test_broker_connection_task.run(cfg.id)
        self.assertFalse(result['ok'])
        cfg.refresh_from_db()
        self.assertEqual(cfg.status, 'error')
        self.assertNotIn('BADSEC', cfg.last_error)

    def test_task_unsupported_provider(self):
        user = User.objects.create_user(username='btask2', password='x')
        from user_workspace.models import set_user_broker_secrets
        cfg = set_user_broker_secrets(user, 'ssi', {'api_key': 'k'})
        from user_workspace.tasks import test_broker_connection_task
        result = test_broker_connection_task.run(cfg.id)
        self.assertEqual(result, {'ok': False, 'error': 'not_supported_yet'})
