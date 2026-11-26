"""R1 tests — broker config/credentials contract (chạy: manage.py test service_ops.tests.test_broker_config_r1).

Fail-before: chạy trên code trước R1 ⇒ 7 test đỏ (schema/cross-check/reserved/verify/wiring).
"""
import os
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from data_ingest.tasks import _resolve_system_backfill_provider
from identity_access.models import SystemBrokerCredential
from service_ops.domain_configs.broker import get_default_broker_system_config
from service_ops.tests.envelope import unwrapped_json

BASE = '/api/soc/broker'
VALID_SECRETS = {'client_id': 'cid', 'client_secret': 'secret'}


class BrokerConfigR1Tests(TestCase):
    def setUp(self):
        key_patch = patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': Fernet.generate_key().decode()})
        key_patch.start()
        self.addCleanup(key_patch.stop)
        self.staff = User.objects.create_user(username='r1staff', password='x')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def _cred(self, purposes=('backfill',), verified=True, secrets=None):
        cred = SystemBrokerCredential.objects.create(provider='dnse')
        cred.set_secrets(secrets or VALID_SECRETS)
        cred.allowed_purposes = list(purposes)
        cred.is_verified = verified
        cred.last_verified_at = timezone.now() if verified else None
        cred.save()
        return cred

    def test_empty_secrets_rejected_with_error_code(self):
        resp = self.client.post(f'{BASE}/credentials/',
                                {'provider': 'dnse', 'secrets': {}, 'allowed_purposes': ['backfill']},
                                format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('error_code'), 'secrets_required')

    def test_wrong_schema_rejected(self):
        resp = self.client.post(f'{BASE}/credentials/',
                                {'provider': 'dnse', 'secrets': {'api_key': 'x', 'api_secret': 'y'},
                                 'allowed_purposes': ['backfill']}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json().get('error_code'), 'invalid_secrets_schema')
        self.assertIn('client_id', resp.json().get('missing_keys', []))

    def test_purpose_change_keeps_verification(self):
        cred = self._cred()
        resp = self.client.post(f'{BASE}/credentials/',
                                {'provider': 'dnse', 'secrets': VALID_SECRETS,
                                 'allowed_purposes': ['snapshot']}, format='json')
        self.assertEqual(resp.status_code, 200)
        cred.refresh_from_db()
        self.assertTrue(cred.is_verified)
        self.assertIsNotNone(cred.last_verified_at)
        self.assertEqual(cred.allowed_purposes, ['snapshot'])

    def test_secret_rotation_resets_verification(self):
        cred = self._cred()
        rotated = {'client_id': 'new-id', 'client_secret': 'new-secret'}
        resp = self.client.post(f'{BASE}/credentials/',
                                {'provider': 'dnse', 'secrets': rotated,
                                 'allowed_purposes': ['backfill']}, format='json')
        self.assertEqual(resp.status_code, 200)
        cred.refresh_from_db()
        self.assertFalse(cred.is_verified)
        self.assertIsNone(cred.last_verified_at)

    def test_raw_invalid_purpose_rejected(self):
        cfg = get_default_broker_system_config().to_dict()
        cfg['entries']['dnse']['purpose_allowlist'] = ['bogus']
        resp = self.client.post(f'{BASE}/config/apply/',
                                {'config_payload': cfg, 'change_reason': 'raw purpose'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(any('bogus' in msg for msg in resp.json().get('validation_errors', [])))

    def test_reserved_keys_preserved_on_apply(self):
        cfg = get_default_broker_system_config().to_dict()
        cfg['tenant_kill_switches'] = {'tenant-1': True}
        cfg['provider_kill_switches'] = {'dnse': True}
        resp = self.client.post(f'{BASE}/config/apply/',
                                {'config_payload': cfg, 'change_reason': 'reserved keys'}, format='json')
        self.assertEqual(resp.status_code, 200)
        body = unwrapped_json(resp)
        self.assertTrue(body['config']['tenant_kill_switches']['tenant-1'])
        current = self.client.get(f'{BASE}/config/')
        self.assertTrue(unwrapped_json(current)['config']['provider_kill_switches']['dnse'])

    def test_credential_purpose_mismatch_blocks_apply_but_missing_is_warning(self):
        self._cred(purposes=('snapshot',))
        cfg = get_default_broker_system_config().to_dict()
        resp = self.client.post(f'{BASE}/config/apply/',
                                {'config_payload': cfg, 'change_reason': 'mismatch'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(any('không cho phép purpose backfill' in msg
                            for msg in resp.json().get('validation_errors', [])))
        SystemBrokerCredential.objects.all().delete()
        resp = self.client.post(f'{BASE}/config/preview/', {'config_payload': cfg}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(any('chưa có credential' in msg
                            for msg in unwrapped_json(resp).get('warnings', [])))

    def test_backfill_provider_falls_back_to_dnse(self):
        with patch('service_ops.broker_runtime.provider_for_purpose', return_value='ssi'):
            self.assertEqual(_resolve_system_backfill_provider(), 'dnse')
        with patch('service_ops.broker_runtime.provider_for_purpose', return_value=None):
            self.assertEqual(_resolve_system_backfill_provider(), 'dnse')
