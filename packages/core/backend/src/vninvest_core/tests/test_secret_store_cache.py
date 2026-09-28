"""Regression tests for the legacy key cache in SecretStore.

The cache is keyed by the SECRET_KEY the derived key came from. Caching on the
version alone looked correct - SECRET_KEY does not change in a normal process -
but it made ciphertext unreadable for any later store in the same process once
settings did change, which is what broke the reencrypt command's own tests when
another test file had used ``override_settings(SECRET_KEY=...)`` first.
"""

from django.test import TestCase, override_settings

from vninvest_core.utils.encryption import LEGACY_VERSION, SecretStore, store


class LegacyKeyCacheTest(TestCase):
    def test_ciphertext_survives_a_secret_key_change_in_process(self):
        """Write with one SECRET_KEY, read with another: must fail, not silently pass."""
        with override_settings(SECRET_KEY="key-alpha"):
            cipher = SecretStore().encrypt("payload", version=LEGACY_VERSION)
        with override_settings(SECRET_KEY="key-beta"):
            with self.assertRaises(Exception):
                SecretStore().decrypt(cipher)

    def test_same_secret_key_reuses_the_cached_fernet(self):
        with override_settings(SECRET_KEY="key-stable"):
            first = SecretStore()
            a = first.get_key(LEGACY_VERSION)
            b = first.get_key(LEGACY_VERSION)
        self.assertIs(a, b, "cache should still work when SECRET_KEY is unchanged")

    def test_cache_is_invalidated_when_secret_key_changes(self):
        """The bug: one store instance must not keep serving a stale derived key."""
        shared = SecretStore()
        with override_settings(SECRET_KEY="key-one"):
            k1 = shared.get_key(LEGACY_VERSION)
        with override_settings(SECRET_KEY="key-two"):
            k2 = shared.get_key(LEGACY_VERSION)
        self.assertIsNot(k1, k2, "a changed SECRET_KEY must produce a different key")

    def test_cache_does_not_cross_contaminate_across_secret_keys(self):
        """A row written under key-one must not read under key-two on the SAME store."""
        shared = SecretStore()
        with override_settings(SECRET_KEY="key-one"):
            cipher = shared.encrypt("alpha-payload", version=LEGACY_VERSION)
        with override_settings(SECRET_KEY="key-two"):
            with self.assertRaises(Exception):
                shared.decrypt(cipher)

    def test_module_singleton_survives_a_settings_change(self):
        """The singleton outlives any single test, so it is the dangerous one."""
        with override_settings(SECRET_KEY="singleton-one"):
            cipher = store.encrypt("payload", version=LEGACY_VERSION)
            self.assertEqual("payload", store.decrypt(cipher)[0])
        with override_settings(SECRET_KEY="singleton-two"):
            with self.assertRaises(Exception):
                store.decrypt(cipher)
        # ...and the singleton works again once the original key is restored.
        with override_settings(SECRET_KEY="singleton-one"):
            self.assertEqual("payload", store.decrypt(cipher)[0])
