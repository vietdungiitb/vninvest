"""
D06 – Integration tests cho UserDNSECredential encryption/decryption round-trip.

T-F1: set_credentials + get_api_key/get_api_secret round-trip.
T-F2: Encrypted bytes khác plaintext (không lưu raw).
T-F3: get_system_provider_credentials() trả về (key, secret) khi tồn tại system provider.
T-F4: get_system_provider_credentials() trả về None khi không có.
"""
import os
from django.test import TestCase


class DNSECredentialEncryptionTest(TestCase):

    def setUp(self):
        os.environ.setdefault(
            'DNSE_CREDENTIAL_FERNET_KEY',
            'QFqvwJDGxrXhGm7K8PKXjLZXWBzz1Jlh5GRxeYz9gns='
        )
        from django.contrib.auth import get_user_model
        self.User = get_user_model()

    def test_credential_round_trip(self):
        """T-F1: set + get round-trip."""
        from identity_access.models import UserDNSECredential
        user = self.User.objects.create_user('cred_f1', 'f1@test.com', 'pass')
        cred = UserDNSECredential(user=user)
        cred.set_credentials('MY_API_KEY', 'MY_API_SECRET')
        cred.save()

        fetched = UserDNSECredential.objects.get(user=user)
        self.assertEqual(fetched.get_api_key(), 'MY_API_KEY')
        self.assertEqual(fetched.get_api_secret(), 'MY_API_SECRET')

    def test_encrypted_bytes_differ_from_plaintext(self):
        """T-F2: bytes lưu không phải plaintext."""
        from identity_access.models import UserDNSECredential
        user = self.User.objects.create_user('cred_f2', 'f2@test.com', 'pass')
        cred = UserDNSECredential(user=user)
        cred.set_credentials('PLAIN_KEY', 'PLAIN_SECRET')
        cred.save()

        fetched = UserDNSECredential.objects.get(user=user)
        self.assertNotEqual(bytes(fetched.api_key_encrypted), b'PLAIN_KEY')
        self.assertNotEqual(bytes(fetched.api_secret_encrypted), b'PLAIN_SECRET')

    def test_get_system_provider_credentials_found(self):
        """T-F3: get_system_provider_credentials() trả về tuple khi tồn tại."""
        from user_workspace.models import DNSECredential
        from identity_access.models import get_system_provider_credentials
        admin = self.User.objects.create_superuser('sysadmin_f3', 'f3@test.com', 'pass')
        cred = DNSECredential(user=admin, is_active=True)
        cred.set_client_id('SYS_KEY')
        cred.set_client_secret('SYS_SECRET')
        cred.save()

        result = get_system_provider_credentials()
        self.assertIsNotNone(result)
        self.assertEqual(result[0], 'SYS_KEY')
        self.assertEqual(result[1], 'SYS_SECRET')

    def test_get_system_provider_credentials_not_found(self):
        """T-F4: get_system_provider_credentials() trả về None khi không có."""
        from identity_access.models import get_system_provider_credentials
        result = get_system_provider_credentials()
        self.assertIsNone(result)
