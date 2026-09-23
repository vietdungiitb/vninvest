"""B2.2 tests: SystemBrokerCredential + get_system_broker_secrets.

Chạy: python manage.py test identity_access.tests.test_system_broker_credential
"""
from django.contrib.auth.models import User
from django.test import TestCase

from identity_access.models import SystemBrokerCredential, get_system_broker_secrets


class SystemBrokerCredentialTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='sysbk', password='x', is_staff=True)

    def _make(self, provider='dnse', purposes=None):
        cred = SystemBrokerCredential(
            provider=provider,
            allowed_purposes=purposes if purposes is not None else ['backfill'],
            updated_by='sysbk',
        )
        cred.set_secrets({'client_id': 'SYSID1', 'client_secret': 'SYSSEC1'})
        cred.save()
        return cred

    def test_roundtrip_and_mask(self):
        cred = self._make()
        self.assertNotIn(b'SYSSEC1', bytes(cred.secrets_cipher))
        self.assertEqual(cred.get_secrets()['client_id'], 'SYSID1')
        preview = cred.masked_preview()
        self.assertTrue(preview['client_id'].endswith('****'))
        self.assertNotIn('SYSSEC1', str(preview))

    def test_unique_per_provider(self):
        from django.db import IntegrityError, transaction
        self._make('dnse')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self._make('dnse')

    def test_helper_purpose_gate(self):
        self._make('dnse', ['backfill'])
        ok = get_system_broker_secrets('dnse', 'backfill')
        self.assertEqual(ok['client_id'], 'SYSID1')
        self.assertIsNone(get_system_broker_secrets('dnse', 'snapshot'))
        self.assertIsNone(get_system_broker_secrets('ssi', 'snapshot'))
        self.assertIsNone(get_system_broker_secrets('', 'backfill'))

    def test_helper_empty_secrets_none(self):
        cred = SystemBrokerCredential(provider='ssi', allowed_purposes=['snapshot'])
        cred.secrets_cipher = b''
        cred.save()
        self.assertIsNone(get_system_broker_secrets('ssi', 'snapshot'))
