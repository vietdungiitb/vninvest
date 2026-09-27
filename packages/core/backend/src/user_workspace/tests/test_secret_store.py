"""Test SecretStore encryption/decryption with versioning."""

import os
import json
import pytest
from django.test import TestCase, override_settings
from vninvest_core.utils.encryption import SecretStore, encrypt_string, decrypt_string


class SecretStoreTest(TestCase):
    """Test SecretStore encryption/decryption with versioning."""

    def setUp(self):
        os.environ["BROKER_SECRET_KEY"] = "test-broker-secret-key-32-bytes-long!!"
        self.store = SecretStore()

    def test_encrypt_decrypt_roundtrip_v1(self):
        """Test encrypt/decrypt roundtrip with v1 (legacy)."""
        plaintext = "test-secret-data"
        encrypted = SecretStore().encrypt(plaintext, version=1)
        decrypted, version = SecretStore().decrypt(encrypted)
        self.assertEqual(plaintext, decrypted)
        self.assertEqual(version, 1)

    def test_encrypt_decrypt_roundtrip_v2(self):
        """Test encrypt/decrypt roundtrip with v2 (broker)."""
        plaintext = "super-secret-broker-data"
        encrypted = SecretStore().encrypt(plaintext, version=2)
        decrypted, version = SecretStore().decrypt(encrypted)
        self.assertEqual(plaintext, decrypted)
        self.assertEqual(version, 2)

    def test_decrypt_missing_version_raises(self):
        """Decrypt with missing key version should raise, not return empty string."""
        store = SecretStore()
        ciphertext = store.encrypt("test", version=2)
        import os
        del os.environ["BROKER_SECRET_KEY"]
        with self.assertRaises(ValueError):
            store.decrypt(ciphertext)

    def test_multi_version_coexist(self):
        """Multiple versions can coexist and decrypt correctly."""
        store = SecretStore()
        plaintext = "multi-version-test"
        enc_v1 = store.encrypt(plaintext, version=1)
        enc_v2 = store.encrypt(plaintext, version=2)
        dec_v1, ver1 = SecretStore().decrypt(enc_v1)
        dec_v2, ver2 = SecretStore().decrypt(enc_v2)
        self.assertEqual(plaintext, dec_v1)
        self.assertEqual(ver1, 1)
        self.assertEqual(plaintext, dec_v2)
        self.assertEqual(ver2, 2)

    def test_secret_not_derived_from_django_secret(self):
        """Changing SECRET_KEY should not affect broker encryption (v2)."""
        import os
        os.environ["SECRET_KEY"] = "different-secret-key"
        store = SecretStore()
        ciphertext = store.encrypt("test", version=2)
        decrypted, _ = store.decrypt(ciphertext)
        self.assertEqual(decrypted, "test")

    def test_ciphertext_has_version_marker(self):
        """Ciphertext should contain version marker for decryption."""
        store = SecretStore()
        ciphertext = store.encrypt("test", version=2)
        payload = json.loads(ciphertext)
        self.assertIn("v", payload)
        self.assertIn("c", payload)
        self.assertEqual(payload["v"], 2)

    def test_reencrypt(self):
        """Re-encrypt from v1 to v2 works."""
        store = SecretStore()
        v1_cipher = store.encrypt("test", version=1)
        v2_cipher = store.reencrypt(v1_cipher, target_version=2)
        decrypted, version = store.decrypt(v2_cipher)
        self.assertEqual(version, 2)
        self.assertEqual(store.decrypt(v2_cipher)[0], "test")


class LegacyEncryptDecryptTest(TestCase):
    """Test legacy encrypt_string/decrypt_string functions (v1)."""

    def test_encrypt_decrypt_roundtrip(self):
        plaintext = "legacy-test"
        encrypted = encrypt_string(plaintext)
        decrypted = decrypt_string(encrypted)
        self.assertEqual(plaintext, decrypted)

    def test_empty_string(self):
        self.assertEqual(encrypt_string(""), "")
        self.assertEqual(decrypt_string(""), "")