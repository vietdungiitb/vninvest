"""Regression tests for the production misconfiguration guards.

The independent audit found three claims shipped with no coverage at all, and the
most severe fix on the list (the client-IP SSOT) shipped with a default that turned
a spoofing hole into a platform-wide denial of service. Every test here exists to
make one of those impossible to reintroduce silently.

The Turnstile and TESTING cases evaluate the REAL settings module in a subprocess
with a production-shaped environment. `override_settings` cannot see them: under
`manage.py test` both the old and new `TESTING` expression evaluate to True, so a
test that imports settings can never distinguish a fix from its absence.
"""

import os
import subprocess
import sys
import textwrap
import unittest
from unittest.mock import patch

from django.core.checks import Error
from django.test import SimpleTestCase, override_settings

from vninvest_core import checks as vn_checks
from vninvest_core.client_ip import (
    DEFAULT_TRUSTED_PROXY_NETWORKS,
    UNKNOWN_IP,
    get_client_ip,
)

# This file lives at <src>/vninvest_core/tests/test_production_guards.py, so three
# dirname() calls land on <src> -- the directory that must be importable for
# `vninvest_core.settings` to resolve in the subprocess.
SRC_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.insert(0, SRC_ROOT)


def _settings_eval(snippet, extra_env=None, pre_setup=""):
    """Evaluate `snippet` against the real settings module in a subprocess.

    DEBUG is forced off, which is the only state where these defects are visible:
    the Turnstile double-assignment and the empty trusted-proxy list are both
    no-ops while DEBUG is True, which is why they survived a test suite.

    `pre_setup` runs BEFORE ``django.setup()`` and is required for anything that
    settings computes at import time from ``sys.argv`` -- notably ``TESTING``.
    Assigning ``sys.argv`` afterwards is too late: the module is already loaded.
    """
    env = dict(os.environ)
    env.update(
        {
            "PYTHONPATH": SRC_ROOT,
            "DJANGO_SETTINGS_MODULE": "vninvest_core.settings",
            "DJANGO_DEBUG": "0",
            "DJANGO_SECRET_KEY": "unit-test-only-not-a-real-secret-0123456789",
            "DJANGO_ALLOWED_HOSTS": "localhost",
            "CORE_PAT_PEPPER": "unit-test-pepper-0123456789abcdefghijklmnop",
            "FRONTEND_URL": "http://localhost:8080",
            "TURNSTILE_SECRET_KEY": "0x-unit-test-secret",
            "CORS_ALLOWED_ORIGINS": "http://localhost:8080",
            "CSRF_TRUSTED_ORIGINS": "http://localhost:8080",
        }
    )
    # DJANGO_TESTING is an explicit override of the argv logic, and any non-empty
    # value wins -- including "0". It must be ABSENT here or these tests would
    # never exercise the argv branch they exist to cover.
    for key in ("TRUSTED_PROXY_IPS", "STRICT_TURNSTILE_ENFORCEMENT", "DJANGO_TESTING"):
        env.pop(key, None)
    env.update(extra_env or {})

    program = (
        textwrap.dedent(pre_setup).rstrip("\n") + "\n"
        if pre_setup
        else ""
    ) + textwrap.dedent(
        """
        import django
        django.setup()
        from django.conf import settings
        """
    ).rstrip("\n") + "\n" + textwrap.dedent(snippet)

    return subprocess.run(
        [sys.executable, "-c", program],
        capture_output=True,
        text=True,
        env=env,
        timeout=180,
    )


class TurnstileEnforcementTests(unittest.TestCase):
    """T1: the single most severe claim shipped with zero coverage.

    Re-adding the historical second assignment at the end of settings.py
    (default 'false', overriding the fail-closed default) left 446 tests green.
    """

    def test_strict_turnstile_is_true_in_production_without_the_env_var(self):
        result = _settings_eval(
            """
            from django.conf import settings
            print('VALUE', settings.STRICT_TURNSTILE_ENFORCEMENT)
            """
        )
        self.assertEqual(result.returncode, 0, result.stderr[-3000:])
        self.assertIn(
            "VALUE True",
            result.stdout,
            "STRICT_TURNSTILE_ENFORCEMENT must default to True in production; a "
            "later duplicate assignment with default 'false' silently disabled the "
            "signup bot check and no test noticed",
        )

    def test_no_later_assignment_overrides_it(self):
        """Structural guard: the name must be assigned exactly once."""
        path = os.path.join(SRC_ROOT, "vninvest_core", "settings.py")
        with open(path, "r", encoding="utf-8") as handle:
            body = handle.read()
        assignments = [
            line
            for line in body.splitlines()
            if line.strip().startswith("STRICT_TURNSTILE_ENFORCEMENT")
            and "=" in line
            and not line.strip().startswith("#")
        ]
        self.assertEqual(
            len(assignments),
            1,
            "STRICT_TURNSTILE_ENFORCEMENT must be assigned exactly once; a second "
            f"assignment silently wins and re-opens the defect. Found: {assignments}",
        )


class TestingFlagTests(unittest.TestCase):
    """T2: `TESTING` used to be a substring match over all of sys.argv."""

    def test_testing_is_false_for_a_production_argv_containing_test(self):
        result = _settings_eval(
            """
            from django.conf import settings
            print('VALUE', settings.TESTING)
            """,
            pre_setup=(
                "import sys\n"
                "sys.argv = ['gunicorn', 'core.wsgi:application', '-c',"
                " 'gunicorn_conf/testing.log']\n"
            ),
        )
        self.assertEqual(result.returncode, 0, result.stderr[-3000:])
        self.assertIn(
            "VALUE False",
            result.stdout,
            "an argv token merely CONTAINING 'test' must not flip TESTING on; that "
            "swapped CACHES to per-process LocMemCache and emptied the throttle "
            "classes, disabling every rate limit in the deployment",
        )

    def test_testing_is_true_for_the_actual_test_command(self):
        result = _settings_eval(
            """
            from django.conf import settings
            print('VALUE', settings.TESTING)
            """,
            pre_setup=(
                "import sys\nsys.argv = ['manage.py', 'test', 'identity_access']\n"
            ),
        )
        self.assertEqual(result.returncode, 0, result.stderr[-3000:])
        self.assertIn("VALUE True", result.stdout)


class TrustedProxyDefaultsTests(unittest.TestCase):
    """N1: the spoofing fix's default collapsed every client into one bucket."""

    def test_unset_env_var_falls_back_to_the_private_range_default(self):
        result = _settings_eval(
            """
            from django.conf import settings
            print('COUNT', len(settings.TRUSTED_PROXY_IPS))
            print('NONEMPTY', bool(settings.TRUSTED_PROXY_IPS))
            """
        )
        self.assertEqual(result.returncode, 0, result.stderr[-3000:])
        self.assertIn("NONEMPTY True", result.stdout)
        self.assertIn(f"COUNT {len(DEFAULT_TRUSTED_PROXY_NETWORKS)}", result.stdout)

    def test_explicit_empty_env_var_is_honoured_literally(self):
        result = _settings_eval(
            """
            from django.conf import settings
            print('COUNT', len(settings.TRUSTED_PROXY_IPS))
            """,
            extra_env={"TRUSTED_PROXY_IPS": ""},
        )
        self.assertEqual(result.returncode, 0, result.stderr[-3000:])
        self.assertIn("COUNT 0", result.stdout)

    def test_default_networks_cover_the_docker_bridge_range(self):
        joined = " ".join(DEFAULT_TRUSTED_PROXY_NETWORKS)
        self.assertIn("172.16.0.0/12", joined, "the compose default bridge lives here")
        self.assertIn("127.0.0.0/8", joined)


class TestRunnerShortCircuitTests(SimpleTestCase):
    """Separate class because it must exercise the UNPATCHED guard.

    Django forces ``DEBUG=False`` under ``manage.py test``, so without an explicit
    short-circuit these production guards would make the suite unrunnable -- and a
    check that blocks the tests is a check people disable wholesale.
    """

    def test_guards_detect_the_test_runner(self):
        import sys

        self.assertIn(
            "test",
            sys.argv,
            "these checks short-circuit on the word 'test' in argv; if Django ever "
            "invokes the runner without it, they would block the entire suite",
        )
        self.assertTrue(vn_checks._running_tests())

    def test_guards_are_silent_under_the_test_runner(self):
        with override_settings(DEBUG=False, TRUSTED_PROXY_IPS=[], TURNSTILE_SECRET_KEY=""):
            self.assertEqual(vn_checks.check_trusted_proxy_ips(None), [])
            self.assertEqual(vn_checks.check_turnstile_secret(None), [])


class SystemCheckTests(SimpleTestCase):
    """The checks' own logic.

    Every check short-circuits under `manage.py test` (Django forces DEBUG=False
    there, so the check could not otherwise tell a test run from a real boot). The
    guard is stubbed off here so the guard's OWN behaviour is what gets asserted;
    `test_guards_are_silent_under_the_test_runner` covers the short-circuit.
    """

    def setUp(self):
        patcher = patch.object(vn_checks, "_running_tests", return_value=False)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_empty_trusted_proxy_list_is_an_error_in_production(self):
        with override_settings(DEBUG=False, TRUSTED_PROXY_IPS=[]):
            issues = vn_checks.check_trusted_proxy_ips(None)
        self.assertEqual(len(issues), 1)
        self.assertIsInstance(issues[0], Error)
        self.assertEqual(issues[0].id, vn_checks.TRUSTED_PROXY_EMPTY_ID)

    def test_populated_trusted_proxy_list_is_clean(self):
        with override_settings(DEBUG=False, TRUSTED_PROXY_IPS=["10.0.0.0/8"]):
            self.assertEqual(vn_checks.check_trusted_proxy_ips(None), [])

    def test_no_op_under_debug(self):
        with override_settings(DEBUG=True, TRUSTED_PROXY_IPS=[]):
            self.assertEqual(vn_checks.check_trusted_proxy_ips(None), [])

    def test_missing_turnstile_secret_is_reported(self):
        with override_settings(DEBUG=False, TURNSTILE_SECRET_KEY=""):
            issues = vn_checks.check_turnstile_secret(None)
            self.assertEqual(len(issues), 1)
            self.assertEqual(issues[0].id, vn_checks.TURNSTILE_SECRET_MISSING_ID)
            # A Warning, not an Error: env_validation already raises at import time,
            # and an Error here would block `manage.py test`, where Django forces
            # DEBUG=False and the check could never tell a test run from a boot.
            self.assertNotIsInstance(issues[0], Error)

    def test_onboarding_prefix_must_be_exempt(self):
        issues = vn_checks.check_onboarding_path_exempt(None)
        self.assertEqual(issues, [], f"unexpected: {issues}")

    def test_prune_task_is_actually_scheduled(self):
        with override_settings(DEBUG=False):
            issues = vn_checks.check_email_verification_pruning_scheduled(None)
        self.assertEqual(
            issues,
            [],
            "prune_email_verification_tokens is still off the beat schedule, so the "
            "table grows without bound while its unit tests pass",
        )


class ClientIpPreferRealIpTests(SimpleTestCase):
    """`X-Real-IP` is preferred: nginx overwrites it, X-Forwarded-For is appendable."""

    def test_real_ip_wins_over_forwarded_for_a_trusted_peer(self):
        with override_settings(TRUSTED_PROXY_IPS=["172.16.0.0/12"]):
            request = type(
                "R",
                (),
                {
                    "META": {
                        "REMOTE_ADDR": "172.20.0.3",
                        "HTTP_X_REAL_IP": "198.51.100.9",
                        "HTTP_X_FORWARDED_FOR": "1.1.1.1, 203.0.113.7",
                    }
                },
            )()
            self.assertEqual(get_client_ip(request), "198.51.100.9")

    def test_falls_back_to_forwarded_when_real_ip_absent(self):
        with override_settings(TRUSTED_PROXY_IPS=["172.16.0.0/12"]):
            request = type(
                "R",
                (),
                {
                    "META": {
                        "REMOTE_ADDR": "172.20.0.3",
                        "HTTP_X_FORWARDED_FOR": "1.1.1.1, 203.0.113.7",
                    }
                },
            )()
            self.assertEqual(get_client_ip(request), "203.0.113.7")

    def test_untrusted_peer_with_forged_real_ip_is_ignored(self):
        with override_settings(TRUSTED_PROXY_IPS=["10.0.0.0/8"]):
            request = type(
                "R",
                (),
                {
                    "META": {
                        "REMOTE_ADDR": "203.0.113.9",
                        "HTTP_X_REAL_IP": "10.0.0.5",
                        "HTTP_X_FORWARDED_FOR": "10.0.0.5",
                    }
                },
            )()
            self.assertEqual(get_client_ip(request), "203.0.113.9")

    def test_docker_bridge_peer_is_trusted_by_default(self):
        """The exact topology that produced N1 must resolve two clients apart."""
        with override_settings(TRUSTED_PROXY_IPS=list(DEFAULT_TRUSTED_PROXY_NETWORKS)):
            first = type(
                "R", (), {"META": {"REMOTE_ADDR": "172.20.0.3", "HTTP_X_FORWARDED_FOR": "1.1.1.1"}}
            )()
            second = type(
                "R", (), {"META": {"REMOTE_ADDR": "172.20.0.3", "HTTP_X_FORWARDED_FOR": "8.8.8.8"}}
            )()
            self.assertEqual(get_client_ip(first), "1.1.1.1")
            self.assertEqual(get_client_ip(second), "8.8.8.8")
            self.assertNotEqual(get_client_ip(first), get_client_ip(second))

    def test_unidentifiable_request_does_not_raise(self):
        with override_settings(TRUSTED_PROXY_IPS=[]):
            request = type("R", (), {"META": {}})()
            self.assertEqual(get_client_ip(request), UNKNOWN_IP)
