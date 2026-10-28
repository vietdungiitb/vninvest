"""Tests for the reencrypt_broker_secrets management command.

The command is the operator-facing half of SEC-02, so the tests concentrate on the
properties that make it safe to run against production data: it writes nothing by
default, it refuses rather than writing undecryptable ciphertext, and it does not
paper over rows it cannot migrate.
"""

import io
import json
import os
import unittest.mock as mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from user_workspace.models import UserBrokerConfig

KEY_A = "reenc-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
KEY_B = "reenc-key-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"


def _row(provider="dnse", label="default", username=None):
    user = User.objects.create_user(username=username or f"u{User.objects.count()}", password="x")
    return UserBrokerConfig.objects.create(user=user, provider=provider, label=label)


class ReencryptCommandTest(TestCase):
    def setUp(self):
        self.config = _row()

    def _write_v1(self, config, payload=None):
        """Write a legacy (v1) row, as pre-SEC-02 data would be.

        Uses a fresh SecretStore rather than the module-level singleton: the
        singleton's legacy cache is shared process-wide, and a test that seeds data
        through it makes its own fixtures depend on whichever SECRET_KEY happened to
        be active when the cache was first filled.
        """
        from vninvest_core.utils.encryption import LEGACY_VERSION, SecretStore

        config.secrets_cipher = SecretStore().encrypt(
            json.dumps(payload or {"api_key": "v1-value"}), version=LEGACY_VERSION
        )
        config.secret_version = LEGACY_VERSION
        config.save(update_fields=["secrets_cipher", "secret_version"])
        return config

    def _write_v2(self, config, payload=None):
        config.set_secrets(payload or {"api_key": "v2-value"})
        config.save(update_fields=["secrets_cipher", "secret_version"])
        return config

    def _run(self, *args, env=None, **kwargs):
        """Run the command, optionally with a fully controlled environment.

        With ``env=None`` the ambient environment is inherited, so a test can wrap
        the call in its own ``patch.dict``. Passing an env dict replaces the
        environment outright - clearing it by default here would silently undo the
        caller's setup, which is exactly the mistake the first draft made.
        """
        buf = io.StringIO()
        if env is None:
            call_command("reencrypt_broker_secrets", *args, stdout=buf, **kwargs)
        else:
            with mock.patch.dict(os.environ, env, clear=True):
                call_command("reencrypt_broker_secrets", *args, stdout=buf, **kwargs)
        return buf.getvalue()

    # ── default is a dry run ────────────────────────────────────────────
    def test_dry_run_by_default_writes_nothing(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config)
            call_command("reencrypt_broker_secrets")
        self.config.refresh_from_db()
        self.assertEqual(1, self.config.secret_version, "dry run must not change secret_version")

    def test_dry_run_output_says_so(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config)
            out = self._run()
        self.assertIn("DRY RUN", out)
        self.assertIn("would migrate 1", out)
        self.assertIn("--apply", out)

    def test_apply_migrates_and_keeps_plaintext_readable(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config, {"api_key": "must-survive"})
            call_command("reencrypt_broker_secrets", "--apply")
            self.config.refresh_from_db()
            self.assertEqual(3, self.config.secret_version)
            with mock.patch.dict(
                os.environ,
                {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"},
                clear=True,
            ):
                self.assertEqual({"api_key": "must-survive"}, self.config.get_secrets())

    def test_migrated_row_no_longer_depends_on_django_secret_key(self):
        """The whole point: after migration, rotating SECRET_KEY is safe."""
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config, {"api_key": "independent"})
            call_command("reencrypt_broker_secrets", "--apply")
        with override_settings(SECRET_KEY="a-completely-rotated-django-key"):
            with mock.patch.dict(
                os.environ,
                {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"},
                clear=True,
            ):
                self.config.refresh_from_db()
                self.assertEqual({"api_key": "independent"}, self.config.get_secrets())

    # ── idempotence ─────────────────────────────────────────────────────
    def test_second_apply_is_a_no_op(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config)
            call_command("reencrypt_broker_secrets", "--apply")
            out = self._run("--apply")
        self.assertIn("migrated 0", out)
        self.assertIn("already on v3", out)

    def test_row_already_on_target_is_counted_not_rewritten(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v2(self.config)
            before = self.config.secrets_cipher
            call_command("reencrypt_broker_secrets", "--apply")
            self.config.refresh_from_db()
            self.assertEqual(before, self.config.secrets_cipher, "must not rewrite a current row")

    # ── fail closed ─────────────────────────────────────────────────────
    def test_refuses_when_target_key_missing(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(CommandError) as ctx:
                call_command("reencrypt_broker_secrets", "--apply", "--target-version", "7")
        self.assertIn("Refusing to run", str(ctx.exception))

    def test_refuses_before_writing_anything(self):
        self._write_v1(self.config)
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(CommandError):
                call_command("reencrypt_broker_secrets", "--apply", "--target-version", "7")
        self.config.refresh_from_db()
        self.assertEqual(1, self.config.secret_version, "nothing may be written when refusing")

    def test_blocked_row_aborts_instead_of_being_skipped(self):
        """A row whose key vanished must abort the run, not be silently ignored.

        The target key (v3) IS configured, so the command gets past its up-front
        check; the v2 row then turns out to be unreadable because
        ``BROKER_SECRET_KEY_V2`` was not retained. Skipping it would leave a hole
        while reporting success.
        """
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_A, "BROKER_SECRET_VERSION": "2"}, clear=True):
            self._write_v1(self.config, {"api_key": "legacy-ok"})
            stranded = _row(provider="ssi")
            self._write_v2(stranded, {"api_key": "will-be-stranded"})

        # v3 live, but v2 was never retained, so the v2 row cannot be decrypted.
        with mock.patch.dict(
            os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True
        ):
            with self.assertRaises(CommandError) as ctx:
                call_command("reencrypt_broker_secrets", "--apply")
        message = str(ctx.exception)
        self.assertIn("could not be migrated", message)
        self.assertIn("Nothing was committed", message)
        # The readable v1 row must not have been committed either: the run aborts.
        self.config.refresh_from_db()
        self.assertEqual(1, self.config.secret_version, "aborted run must commit nothing")

    def test_dns_credential_exposure_is_reported(self):
        from user_workspace.models import DNSECredential

        user = User.objects.create_user(username="dnse-report", password="x")
        env = {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}
        with mock.patch.dict(os.environ, env, clear=True):
            cred = DNSECredential.objects.create(user=user)
            cred.set_client_id("some-client-id")
            cred.save()
        out = self._run(env=env)
        self.assertIn("DNSECredential", out)
        self.assertIn("not touched by this command", out)

    # ── blast-radius reporting ──────────────────────────────────────────
    def test_histogram_reports_each_version(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config)
            second = _row(provider="ssi")
            self._write_v1(second)
            third = _row(provider="tcbs")
            self._write_v2(third)
            out = self._run()
        self.assertIn("v1: 2", out)
        self.assertIn("v3: 1", out)

    def test_limit_processes_a_canary_batch(self):
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            self._write_v1(self.config)
            second = _row(provider="ssi")
            self._write_v1(second)
            call_command("reencrypt_broker_secrets", "--apply", "--limit", "1")
            self.config.refresh_from_db()
            second.refresh_from_db()
            versions = sorted([self.config.secret_version, second.secret_version])
        self.assertEqual([1, 3], versions, "limit must migrate exactly N rows")

    def test_empty_table_is_not_an_error(self):
        UserBrokerConfig.objects.all().delete()
        with mock.patch.dict(os.environ, {"BROKER_SECRET_KEY": KEY_B, "BROKER_SECRET_VERSION": "3"}, clear=True):
            out = self._run()
        self.assertIn("0 blocked", out)
