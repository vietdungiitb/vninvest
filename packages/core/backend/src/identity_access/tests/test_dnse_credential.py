"""
Unit tests cho UserDNSECredential model và DNSECredentialView (D02).

Test cases:
  T-B1: set_credentials → Fernet encrypted, get_api_key/secret round-trip.
  T-B2: POST tạo credential, response KHÔNG chứa api_key/secret.
  T-B3: is_system_provider chỉ admin set được (non-admin bị 403).
  T-B4: DELETE xoá credential.
  T-B5: get_system_provider_credentials → (key, secret) hoặc None.
"""
import os
from unittest.mock import patch

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from identity_access.models import (
    UserDNSECredential,
    get_system_provider_credentials,
)

# Tạo key hợp lệ cho test
TEST_FERNET_KEY = Fernet.generate_key().decode()


@override_settings(DNSE_CREDENTIAL_FERNET_KEY=TEST_FERNET_KEY)
class UserDNSECredentialModelTests(TestCase):
    """T-B1: Fernet encrypt/decrypt round-trip."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser_cred', password='pass')

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_set_and_get_credentials_round_trip(self):
        cred = UserDNSECredential(user=self.user)
        cred.set_credentials('my-api-key-123', 'my-api-secret-456')
        cred.save()

        # Reload from DB
        cred_db = UserDNSECredential.objects.get(user=self.user)
        self.assertEqual(cred_db.get_api_key(), 'my-api-key-123')
        self.assertEqual(cred_db.get_api_secret(), 'my-api-secret-456')

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_stored_bytes_are_not_plaintext(self):
        cred = UserDNSECredential(user=self.user)
        cred.set_credentials('secret_key', 'secret_val')
        cred.save()

        raw = bytes(cred.api_key_encrypted)
        self.assertNotIn(b'secret_key', raw)

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_get_system_provider_credentials_none_when_no_system(self):
        result = get_system_provider_credentials()
        self.assertIsNone(result)

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_get_system_provider_credentials_returns_tuple(self):
        admin = User.objects.create_user(username='admin_sp', password='pass', is_staff=True)
        cred = UserDNSECredential(user=admin, is_system_provider=True)
        cred.set_credentials('sys_key', 'sys_secret')
        cred.save()

        result = get_system_provider_credentials()
        self.assertIsNotNone(result)
        api_key, api_secret = result
        self.assertEqual(api_key, 'sys_key')
        self.assertEqual(api_secret, 'sys_secret')


class DNSECredentialViewTests(TestCase):
    """T-B2 / T-B3 / T-B4: CRUD API."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='dnse_user', password='pass')
        self.admin = User.objects.create_user(username='dnse_admin', password='pass', is_staff=True)

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_post_creates_credential_without_leaking_secrets(self):
        """T-B2: POST tạo credential, response KHÔNG có api_key/api_secret."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/core/v1/dnse-credential/', {
            'api_key': 'k123', 'api_secret': 's456',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertNotIn('api_key', data)
        self.assertNotIn('api_secret', data)
        self.assertEqual(data['user_id'], self.user.id)
        self.assertFalse(data['is_system_provider'])

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_non_admin_cannot_set_system_provider(self):
        """T-B3: non-admin nhận 403 khi is_system_provider=true."""
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/core/v1/dnse-credential/', {
            'api_key': 'k', 'api_secret': 's', 'is_system_provider': True,
        }, format='json')
        self.assertEqual(resp.status_code, 403)

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_admin_can_set_system_provider(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post('/api/core/v1/dnse-credential/', {
            'api_key': 'sys_k', 'api_secret': 'sys_s', 'is_system_provider': True,
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.json()['is_system_provider'])

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_get_returns_metadata_only(self):
        self.client.force_authenticate(user=self.user)
        # Tạo trước
        self.client.post('/api/core/v1/dnse-credential/', {
            'api_key': 'k', 'api_secret': 's',
        }, format='json')
        resp = self.client.get('/api/core/v1/dnse-credential/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertNotIn('api_key', data)
        self.assertNotIn('api_secret', data)
        self.assertIn('is_verified', data)

    @patch.dict(os.environ, {'DNSE_CREDENTIAL_FERNET_KEY': TEST_FERNET_KEY})
    def test_delete_removes_credential(self):
        """T-B4: DELETE xoá credential."""
        self.client.force_authenticate(user=self.user)
        self.client.post('/api/core/v1/dnse-credential/', {
            'api_key': 'k', 'api_secret': 's',
        }, format='json')
        resp = self.client.delete('/api/core/v1/dnse-credential/')
        self.assertEqual(resp.status_code, 204)

        # Sau khi xoá → 404
        resp2 = self.client.get('/api/core/v1/dnse-credential/')
        self.assertEqual(resp2.status_code, 404)

    def test_post_missing_fields_returns_400(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post('/api/core/v1/dnse-credential/', {
            'api_key': '', 'api_secret': '',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_returns_401(self):
        resp = self.client.get('/api/core/v1/dnse-credential/')
        self.assertIn(resp.status_code, (401, 403))
