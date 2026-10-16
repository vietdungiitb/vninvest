"""conn-hardening: validation hinh dang secret + job ownership + user isolation.

TDD fail-before cho slice `broker-connect-hardening` (Owner: chuan chi bao mat,
chua co API that de noi live). Tat ca mock — khong credential that, khong mang.

Chay TREN VPS STAGING theo runbook §12 (cam local):
  python manage.py test user_workspace.tests.test_broker_connect_hardening --noinput

Quy tac mock job (BAY OOM): `SimpleNamespace`, KHONG MagicMock trong response.
"""
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant
from user_workspace.broker.base import check_secret_shape
from user_workspace.models import UserBrokerConfig, set_user_broker_secrets
from user_workspace.tests.envelope import unwrapped_json

BASE = '/core/v1/broker'


def _tenant_client(username):
    user = User.objects.create_user(username=username, password='x')
    tenant = CoreTenant.objects.create(
        tenant_code=f't-{username}', display_name=username,
        owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
    )
    client = APIClient()
    client.force_login(user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return user, tenant, client


class SecretShapeTests(TestCase):
    """check_secret_shape: chi max + charset, KHONG min (chua thay creds that)."""

    def test_valid_short_fixtures_pass(self):
        for key, value in (
            ('client_id', 'CID-TEST-001'), ('client_secret', 'CSEC-TEST-002'),
            ('api_key', 'AK1'), ('api_secret', 'AS1'), ('custody_code', '105C123'),
        ):
            self.assertIsNone(check_secret_shape(key, value), key)

    def test_too_long_rejected_per_key(self):
        self.assertEqual(check_secret_shape('api_key', 'K' * 257), 'too_long')
        self.assertEqual(check_secret_shape('client_id', 'C' * 129), 'too_long')
        self.assertIsNone(check_secret_shape('private_key', 'P' * 8192))

    def test_control_characters_rejected(self):
        self.assertEqual(check_secret_shape('api_key', 'AB\x00CD'), 'invalid_characters')
        self.assertEqual(check_secret_shape('api_key', 'AB\x1fCD'), 'invalid_characters')

    def test_pem_newlines_allowed(self):
        pem = '-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----\n'
        self.assertIsNone(check_secret_shape('private_key', pem))

    def test_empty_and_unknown_key_skipped(self):
        self.assertIsNone(check_secret_shape('api_key', ''))
        self.assertIsNone(check_secret_shape('api_key', '   '))
        self.assertIsNone(check_secret_shape('future_field', 'x' * 99999))

    def test_lane_validators_reject_shape(self):
        from user_workspace.broker import dnse, ssi, tcbs
        self.assertEqual(
            dnse.validate_secrets(
                {'client_id': 'CID-OK', 'client_secret': 'S' * 513}),
            {'client_secret': 'too_long'})
        self.assertEqual(
            ssi.validate_secrets({'api_key': 'A\x07B', 'api_secret': 'SECRET-OK'}),
            {'api_key': 'invalid_characters'})
        self.assertEqual(
            tcbs.validate_secrets({'api_key': 'TK-OK', 'custody_code': 'C' * 65}),
            {'custody_code': 'too_long'})
        # custody sai format van chi hint (G4), khong chan
        self.assertEqual(
            tcbs.validate_secrets({'api_key': 'TK-OK', 'custody_code': '!!!'}),
            {})


class ConfigShapeApiTests(TestCase):
    def setUp(self):
        self.user, self.tenant, self.client = _tenant_client('connshape')

    def test_post_too_long_400_no_persist(self):
        resp = self.client.post(
            f'{BASE}/dnse/config/',
            {'client_id': 'CID-OK', 'client_secret': 'S' * 513}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(UserBrokerConfig.objects.filter(
            user=self.user, provider='dnse').exists())

    def test_post_extra_otp_field_not_persisted(self):
        resp = self.client.post(
            f'{BASE}/ssi/config/',
            {'api_key': 'AK-OTP-001', 'api_secret': 'AS-OTP-002',
             'otp': '123456'}, format='json')
        self.assertEqual(resp.status_code, 200)
        stored = UserBrokerConfig.objects.get(
            user=self.user, provider='ssi').get_secrets()
        self.assertNotIn('otp', stored)
        self.assertEqual(
            set(stored), {'api_key', 'api_secret', 'client_id', 'private_key'})


class JobOwnershipTests(TestCase):
    def setUp(self):
        self.user_a, self.tenant_a, self.client_a = _tenant_client('connjoba')
        self.user_b, self.tenant_b, self.client_b = _tenant_client('connjobb')
        set_user_broker_secrets(
            self.user_a, 'dnse',
            {'client_id': 'CID-JOB-A', 'client_secret': 'CSEC-JOB-A'})

    def _enqueue(self):
        with patch(
            'user_workspace.views_broker.test_broker_connection_task'
        ) as task:
            task.delay.return_value = SimpleNamespace(id='job-owner-1')
            resp = self.client_a.post(f'{BASE}/dnse/test-connection/')
        self.assertEqual(resp.status_code, 202)
        return unwrapped_json(resp)['job_id']

    def test_owner_polls_own_job(self):
        job_id = self._enqueue()
        resp = self.client_a.get(f'{BASE}/jobs/{job_id}/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)['state'], 'pending')

    def test_other_user_poll_404_no_leak(self):
        job_id = self._enqueue()
        resp = self.client_b.get(f'{BASE}/jobs/{job_id}/')
        self.assertEqual(resp.status_code, 404)
        self.assertNotIn('job-owner-1', resp.content.decode())

    def test_unknown_job_without_map_passthrough(self):
        resp = self.client_a.get(f'{BASE}/jobs/no-such-job-xyz/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(unwrapped_json(resp)['state'], 'pending')


class UserIsolationTests(TestCase):
    def setUp(self):
        self.user_a, self.tenant_a, self.client_a = _tenant_client('connisoa')
        self.user_b, self.tenant_b, self.client_b = _tenant_client('connisob')
        set_user_broker_secrets(
            self.user_a, 'dnse',
            {'client_id': 'CID-ISO-A', 'client_secret': 'CSEC-ISO-A'})

    def test_user_b_sees_no_config_of_user_a(self):
        resp = self.client_b.get(f'{BASE}/dnse/config/')
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(unwrapped_json(resp)['is_configured'])

    def test_user_b_write_does_not_touch_user_a(self):
        resp = self.client_b.post(
            f'{BASE}/ssi/config/',
            {'api_key': 'AK-ISO-B', 'api_secret': 'AS-ISO-B'}, format='json')
        self.assertEqual(resp.status_code, 200)
        cfg_a = UserBrokerConfig.objects.get(user=self.user_a, provider='dnse')
        self.assertEqual(cfg_a.get_secrets()['client_id'], 'CID-ISO-A')
        self.assertFalse(UserBrokerConfig.objects.filter(
            user=self.user_a, provider='ssi').exists())
