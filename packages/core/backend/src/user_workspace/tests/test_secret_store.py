"""Tests for the versioned SecretStore (SEC-02).

Covers the six tests the SEC-02 spec requires, plus the two behaviours the
original implementation got wrong:

* rotating a key must not strand existing ciphertext (AC2 / R5)
* a missing key must raise, never yield an empty plaintext (R4 / AC1)

Env vars are patched per test via ``patch.dict`` so a test cannot leak a key
(or a deleted key) into the next one.
"""

import json
import os
import unittest.mock as mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings

from vninvest_core.utils.encryption import (
    DEFAULT_CURRENT_VERSION,
    LEGACY_VERSION,
    SecretKeyMissingError,
    SecretStore,
    decrypt_string,
    encrypt_string,
    store,
)

KEY_A = "broker-key-aaaaaaaaaaaaaaaaaaaaaaaaaa"
KEY_B = "broker-key-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"


class SecretStoreTest(TestCase):
    """encrypt/decrypt behaviour, with every case from the SEC-02 spec table."""

    # ── 1. roundtrip at the legacy version ─────────────────────────────
    def test_encrypt_decrypt_roundtrip_v1(self):
        store_ = SecretStore()
        encrypted = store_.encrypt("test-secret-data", version=LEGACY_VERSION)
        decrypted, version = SecretStore().decrypt(encrypted)
        self.assertEqual("test-secret-data", decrypted)
        self.assertEqual(LEGACY_VERSION, version)

    # ── 2. fail-closed on a missing key version (AC1) ──────────────────
    def test_decrypt_missing_version_raises(self):
        """A ciphertext whose key is gone must raise, not return "" (R4/AC1)."""
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = SecretStore().encrypt("payload", version=DEFAULT_CURRENT_VERSION)
        # Key gone: neither the live var nor a retained one resolves version 2.
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                SecretStore().decrypt(ciphertext)

    def test_decrypt_string_raises_instead_of_returning_empty(self):
        """decrypt_string used to swallow the error and return "" (fail-open)."""
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = encrypt_string("payload", version=DEFAULT_CURRENT_VERSION)
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                decrypt_string(ciphertext)

    def test_secret_key_missing_error_is_not_a_bare_value_error(self):
        """Callers must be able to catch the specific fault (AC1 names the class)."""
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = SecretStore().encrypt("payload", version=DEFAULT_CURRENT_VERSION)
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                SecretStore().decrypt(ciphertext)
        self.assertTrue(issubclass(SecretKeyMissingError, Exception))

    # ── 3. several versions live at once (R5) ──────────────────────────
    def test_multi_version_coexist(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            plaintext = "multi-version-test"
            enc_v1 = SecretStore().encrypt(plaintext, version=LEGACY_VERSION)
            enc_v2 = SecretStore().encrypt(plaintext, version=DEFAULT_CURRENT_VERSION)
            dec_v1, ver1 = SecretStore().decrypt(enc_v1)
            dec_v2, ver2 = SecretStore().decrypt(enc_v2)
        self.assertEqual((plaintext, LEGACY_VERSION), (dec_v1, ver1))
        self.assertEqual((plaintext, DEFAULT_CURRENT_VERSION), (dec_v2, ver2))

    # ── 4. broker key independent of Django SECRET_KEY ────────────────
    @override_settings(SECRET_KEY="a-completely-different-django-secret-key")
    def test_secret_not_derived_from_django_secret(self):
        """Rotating SECRET_KEY must not disturb broker (v2) ciphertext.

        Uses ``override_settings`` because Django reads ``settings.SECRET_KEY``.
        The previous version of this test assigned ``os.environ["SECRET_KEY"]``,
        which Django never reads - it passed without proving anything.
        """
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = SecretStore().encrypt("broker-payload", version=DEFAULT_CURRENT_VERSION)

        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            with override_settings(SECRET_KEY="rotated-django-key"):
                decrypted, version = SecretStore().decrypt(ciphertext)
        self.assertEqual("broker-payload", decrypted)
        self.assertEqual(DEFAULT_CURRENT_VERSION, version)

    @override_settings(SECRET_KEY="rotated-django-key")
    def test_legacy_ciphertext_does_break_when_secret_key_rotates(self):
        """The coupling SEC-02 removes is real; assert it so nobody "fixes" it away.

        This is the 90% risk named in the spec. v1 ciphertext is derived from
        SECRET_KEY, so rotating SECRET_KEY without re-encrypting makes it
        unreadable. v2 is unaffected, which is the entire reason for v2.
        """
        with override_settings(SECRET_KEY="original-django-key"):
            legacy = SecretStore().encrypt("legacy-payload", version=LEGACY_VERSION)
        with override_settings(SECRET_KEY="rotated-django-key"):
            with self.assertRaises(SecretKeyMissingError):
                SecretStore().decrypt(legacy)

    # ── 5. version marker is readable from the ciphertext (AC) ─────────
    def test_ciphertext_has_version_marker(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = SecretStore().encrypt("payload", version=DEFAULT_CURRENT_VERSION)
        payload = json.loads(ciphertext)
        self.assertIn("v", payload)
        self.assertIn("c", payload)
        self.assertEqual(DEFAULT_CURRENT_VERSION, payload["v"])
        self.assertEqual(
            DEFAULT_CURRENT_VERSION, SecretStore().version_of(ciphertext)
        )

    def test_bare_fernet_token_is_treated_as_legacy(self):
        """Rows written before SEC-02 have no envelope and must still decrypt."""
        with override_settings(SECRET_KEY="some-django-key"):
            legacy_key = store.get_key(LEGACY_VERSION)
            token = legacy_key.encrypt(b"pre-envelope-value").decode("utf-8")
            value, version = SecretStore().decrypt(token)
        self.assertEqual("pre-envelope-value", value)
        self.assertEqual(LEGACY_VERSION, version)

    # ── 6. no plaintext leaks through repr (AC4) ───────────────────────
    def test_no_plaintext_in_repr(self):
        """Neither the ciphertext nor any store repr may contain the plaintext."""
        secret = "PLAINTEXT-CANARY-9f3a2b"
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = SecretStore().encrypt(secret, version=DEFAULT_CURRENT_VERSION)
            store_ = SecretStore()
        self.assertNotIn(secret, ciphertext)
        self.assertNotIn(secret, repr(ciphertext))
        self.assertNotIn(secret, repr(store_))
        self.assertNotIn(KEY_A, repr(store_))
        # The key material must not be reachable from a public surface either.
        self.assertNotIn(KEY_A, str(vars(store_)))

    def test_error_message_does_not_leak_ciphertext_or_plaintext(self):
        secret = "PLAINTEXT-CANARY-77c1"
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=False):
            ciphertext = SecretStore().encrypt(secret, version=DEFAULT_CURRENT_VERSION)
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SecretKeyMissingError) as ctx:
                SecretStore().decrypt(ciphertext)
        message = str(ctx.exception)
        self.assertNotIn(secret, message)
        self.assertNotIn(json.loads(ciphertext)["c"], message)


class KeyRotationTest(TestCase):
    """AC2 / R5: rotating a key must not destroy existing ciphertext.

    Rotation means bumping ``BROKER_SECRET_VERSION``, putting the new key in
    ``BROKER_SECRET_KEY`` and retaining the previous version's key in
    ``BROKER_SECRET_KEY_V<old>``. Replacing the key material in place at the same
    version number is deliberately NOT supported: the live key always wins for the
    current version, so an in-place swap would silently orphan existing rows.
    """

    def test_rotation_keeps_old_ciphertext_readable(self):
        with mock.patch.dict(
            os.environ,
            {"BROKER_SECRET_KEY": KEY_A, "BROKER_SECRET_VERSION": "2"},
            clear=True,
        ):
            old_row = SecretStore().encrypt("row-written-before-rotation")
            self.assertEqual(2, SecretStore().version_of(old_row))

        rotated = {
            "BROKER_SECRET_KEY": KEY_B,
            "BROKER_SECRET_VERSION": "3",
            "BROKER_SECRET_KEY_V2": KEY_A,
        }
        with mock.patch.dict(os.environ, rotated, clear=True):
            # AC2: the row written under the old key still reads.
            self.assertEqual("row-written-before-rotation", SecretStore().decrypt(old_row)[0])
            # New writes go out under the new key at the new version.
            new_row = SecretStore().encrypt("row-written-after-rotation")
            self.assertEqual(3, SecretStore().version_of(new_row))
            self.assertEqual("row-written-after-rotation", SecretStore().decrypt(new_row)[0])

    def test_in_place_key_swap_at_the_same_version_orphans_rows(self):
        """Why rotation must bump the version: same version means the live key wins."""
        with mock.patch.dict(
            os.environ,
            {"BROKER_SECRET_KEY": KEY_A, "BROKER_SECRET_VERSION": "2"},
            clear=True,
        ):
            old_row = SecretStore().encrypt("orphan-me")
        # Swapped in place, old key "retained" under the same version number.
        swapped = {
            "BROKER_SECRET_KEY": KEY_B,
            "BROKER_SECRET_VERSION": "2",
            "BROKER_SECRET_KEY_V2": KEY_A,
        }
        with mock.patch.dict(os.environ, swapped, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                SecretStore().decrypt(old_row)

    def test_dropping_retained_key_after_migration_is_safe(self):
        """PB3: re-encrypt first, then drop the retained key."""
        with mock.patch.dict(
            os.environ,
            {"BROKER_SECRET_KEY": KEY_A, "BROKER_SECRET_VERSION": "2"},
            clear=True,
        ):
            old_row = SecretStore().encrypt("migrate-me")

        rotated = {
            "BROKER_SECRET_KEY": KEY_B,
            "BROKER_SECRET_VERSION": "3",
            "BROKER_SECRET_KEY_V2": KEY_A,
        }
        with mock.patch.dict(os.environ, rotated, clear=True):
            migrated = SecretStore().reencrypt(old_row)
            self.assertEqual(3, SecretStore().version_of(migrated))

        # Retained key dropped: the migrated row is unaffected, the old one is loud.
        after = {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}
        with mock.patch.dict(os.environ, after, clear=True):
            self.assertEqual("migrate-me", SecretStore().decrypt(migrated)[0])
        with mock.patch.dict(os.environ, after, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                SecretStore().decrypt(old_row)

    def test_rolling_forward_to_a_new_version_number(self):
        """Version numbers are env-driven, so v3 needs no code change."""
        env = {
            "BROKER_SECRET_KEY": KEY_B,
            "BROKER_SECRET_VERSION": "3",
            f"BROKER_SECRET_KEY_V{DEFAULT_CURRENT_VERSION}": KEY_A,
        }
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(3, SecretStore.current_version())
            row = SecretStore().encrypt("on-v3")
            self.assertEqual(3, SecretStore().version_of(row))
            self.assertEqual("on-v3", SecretStore().decrypt(row)[0])

    def test_invalid_broker_secret_version_is_rejected(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_VERSION": "not-a-number"}, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                SecretStore.current_version()

    def test_write_version_falls_back_to_legacy_without_broker_key(self):
        """Unconfigured environments keep working; the version is recorded."""
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(LEGACY_VERSION, SecretStore.write_version())
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=True):
            self.assertEqual(DEFAULT_CURRENT_VERSION, SecretStore.write_version())


class UserBrokerConfigSecretVersionTest(TestCase):
    """R3: the model must record which key version protected each row."""

    def _config(self, **kwargs):
        user = User.objects.create_user(username="brokeruser", password="x")
        from user_workspace.models import UserBrokerConfig

        return UserBrokerConfig.objects.create(
            user=user, provider="dnse", label="default", **kwargs
        )

    def test_secret_version_defaults_to_legacy(self):
        self.assertEqual(1, self._config().secret_version)

    def test_set_secrets_records_legacy_version_without_broker_key(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            config = self._config()
            config.set_secrets({"api_key": "abc"})
        self.assertEqual(LEGACY_VERSION, config.secret_version)
        self.assertEqual({"api_key": "abc"}, config.get_secrets())

    def test_set_secrets_records_broker_version_when_configured(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=True):
            config = self._config()
            config.set_secrets({"api_key": "abc"})
            self.assertEqual(DEFAULT_CURRENT_VERSION, config.secret_version)
            self.assertEqual({"api_key": "abc"}, config.get_secrets())

    def test_get_secrets_raises_when_key_is_gone(self):
        """The old code returned {} here, which reads as 'no broker configured'."""
        # Write under the broker key, then take the key away: the row still holds
        # a non-empty ciphertext, so a silent {} would be indistinguishable from
        # "this user never configured a broker".
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A}, clear=True):
            config = self._config()
            config.set_secrets({"api_key": "abc"})
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(SecretKeyMissingError):
                config.get_secrets()

    def test_clearing_secrets_clears_the_ciphertext(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            config = self._config()
            config.set_secrets({"api_key": "abc"})
            config.set_secrets({})
        self.assertEqual("", config.secrets_cipher)
        self.assertEqual({}, config.get_secrets())

    def test_dnsECredential_helpers_still_roundtrip(self):
        """DNSECredential shares encrypt_string; it must not regress."""
        from user_workspace.models import DNSECredential

        user = User.objects.create_user(username="dnseuser", password="x")
        with mock.patch.dict(os.environ, {}, clear=True):
            cred = DNSECredential.objects.create(user=user)
            cred.set_client_id("my-client-id")
            cred.set_client_secret("my-client-secret")
            self.assertEqual("my-client-id", cred.get_client_id())
            self.assertEqual("my-client-secret", cred.get_client_secret())
            self.assertTrue(cred.has_credentials())


class BrokerSecretKeyCheckTest(TestCase):
    """PB1: the misconfiguration must be visible without breaking boot."""

    def _run_check(self, env):
        from vninvest_core import checks

        with mock.patch.dict(os.environ, env, clear=True):
            # The check short-circuits under `manage.py test` (Django forces
            # DEBUG=False there, so the guard cannot tell a test run from a real
            # boot). Bypass the guard explicitly, otherwise this test asserts
            # nothing.
            with mock.patch.object(checks, "_running_tests", return_value=False):
                with override_settings(DEBUG=False):
                    return checks.check_broker_secret_key_rotation(None)

    def test_warns_when_broker_key_missing(self):
        issues = self._run_check({})
        self.assertEqual(1, len(issues))
        self.assertIn("BROKER_SECRET_KEY", issues[0].msg)

    def test_warns_when_no_key_retained_for_rotation(self):
        issues = self._run_check({"BROKER_SECRET_KEY": KEY_A})
        self.assertEqual(1, len(issues))
        self.assertIn("BROKER_SECRET_KEY_V", issues[0].hint)

    def test_silent_when_key_present_and_old_key_retained(self):
        env = {"BROKER_SECRET_KEY": KEY_B, f"BROKER_SECRET_KEY_V{DEFAULT_CURRENT_VERSION}": KEY_A}
        # Retaining a slot for the CURRENT version protects nothing, because the
        # live key is what that version resolves to. Bump the current version so
        # the retained slot is genuinely for an older key.
        env["BROKER_SECRET_VERSION"] = "3"
        self.assertEqual([], self._run_check(env))

    def test_warns_when_retained_slot_is_only_the_current_version(self):
        """A retained slot matching the live version is a false reassurance."""
        issues = self._run_check(
            {"BROKER_SECRET_KEY": KEY_B, f"BROKER_SECRET_KEY_V{DEFAULT_CURRENT_VERSION}": KEY_A}
        )
        self.assertEqual(1, len(issues))
        self.assertIn("BROKER_SECRET_KEY_V", issues[0].hint)

    def test_check_is_a_warning_not_an_error(self):
        """An Error would make `manage.py check` non-zero, contradicting AC4."""
        from vninvest_core import checks
        from vninvest_core.checks import BROKER_SECRET_KEY_MISSING_ID

        with mock.patch.dict(os.environ, {}, clear=True):
            with mock.patch.object(checks, "_running_tests", return_value=False):
                with override_settings(DEBUG=False):
                    issues = checks.check_broker_secret_key_rotation(None)
        self.assertTrue(issues)
        self.assertTrue(all(i.id == BROKER_SECRET_KEY_MISSING_ID for i in issues))
        self.assertTrue(all(type(i).__name__ == "Warning" for i in issues))
