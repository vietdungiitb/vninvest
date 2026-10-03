"""BL-02: password strength + prod cookie/transport security enforcement."""
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.test import SimpleTestCase

from vninvest_core.env_validation import (
    get_optional_env,
    get_required_env,
    prod_cookie_security_settings,
    validate_production_settings,
)


class PasswordStrengthTests(SimpleTestCase):
    def test_rejects_numeric(self):
        with self.assertRaises(ValidationError):
            validate_password('1234567890')

    def test_rejects_common(self):
        with self.assertRaises(ValidationError):
            validate_password('password')

    def test_rejects_short(self):
        with self.assertRaises(ValidationError):
            validate_password('Abcdef1')

    def test_accepts_strong(self):
        # Same shape as existing suite passwords (must keep passing).
        validate_password('Password123!')


class ProdCookieSecurityTests(SimpleTestCase):
    def test_secure_defaults_when_env_empty(self):
        s = prod_cookie_security_settings({})
        self.assertTrue(s['SESSION_COOKIE_SECURE'])
        self.assertTrue(s['CSRF_COOKIE_SECURE'])
        self.assertTrue(s['SECURE_SSL_REDIRECT'])
        self.assertEqual(s['SESSION_COOKIE_AGE'], 28800)
        self.assertTrue(s['SESSION_COOKIE_HTTPONLY'])
        self.assertEqual(s['SESSION_COOKIE_SAMESITE'], 'Lax')
        self.assertEqual(s['SECURE_HSTS_SECONDS'], 31536000)

    def test_explicit_insecure_rejected(self):
        for flag in ('DJANGO_SESSION_COOKIE_SECURE', 'DJANGO_CSRF_COOKIE_SECURE', 'DJANGO_SECURE_SSL_REDIRECT'):
            with self.assertRaises(ImproperlyConfigured, msg=flag):
                prod_cookie_security_settings({flag: 'false'})

    def test_bad_numeric_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            prod_cookie_security_settings({'DJANGO_SESSION_COOKIE_AGE': 'abc'})

    def test_bad_samesite_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            prod_cookie_security_settings({'DJANGO_SESSION_COOKIE_SAMESITE': 'Sometimes'})

    def test_custom_age_respected(self):
        s = prod_cookie_security_settings({'DJANGO_SESSION_COOKIE_AGE': '3600'})
        self.assertEqual(s['SESSION_COOKIE_AGE'], 3600)


class EnvValidationHelpersTests(SimpleTestCase):
    def test_required_env_missing_raises(self):
        with self.assertRaises(ImproperlyConfigured):
            get_required_env('BL16_DEFINITELY_MISSING_VAR')

    def test_required_env_present(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {'BL16_PRESENT_VAR': '  v  '}):
            self.assertEqual(get_required_env('BL16_PRESENT_VAR'), 'v')

    def test_optional_env_default(self):
        self.assertEqual(get_optional_env('BL16_DEFINITELY_MISSING_VAR', 'dflt'), 'dflt')

    def test_validate_production_skips_in_debug(self):
        validate_production_settings(True)  # must not raise
