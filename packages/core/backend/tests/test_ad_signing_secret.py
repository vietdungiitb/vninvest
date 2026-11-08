"""
Tests for CORE_AD_SIGNING_SECRET production validation (W0-6).
"""
import os
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase

from vninvest_core.env_validation import validate_production_settings

_REQUIRED = {
    'DJANGO_SECRET_KEY': 'test-secret',
    'FRONTEND_URL': 'https://example.com',
    'CORE_PAT_PEPPER': 'pepper',
    'DJANGO_ALLOWED_HOSTS': 'example.com',
    'TURNSTILE_SECRET_KEY': 'turnstile',
}


class CoreAdSigningSecretProdTests(TestCase):
    def test_prod_without_secret_raises(self):
        env = dict(_REQUIRED)
        with mock.patch.dict(os.environ, env, clear=True):
            with self.assertRaises(ImproperlyConfigured):
                validate_production_settings(debug=False)

    def test_prod_with_secret_ok(self):
        env = dict(_REQUIRED)
        env['CORE_AD_SIGNING_SECRET'] = 'real-secret'
        with mock.patch.dict(os.environ, env, clear=True):
            validate_production_settings(debug=False)

    def test_prod_with_dev_default_raises(self):
        env = dict(_REQUIRED)
        env['CORE_AD_SIGNING_SECRET'] = 'dev-ad-signing-secret-replace-in-production'
        with mock.patch.dict(os.environ, env, clear=True):
            with self.assertRaises(ImproperlyConfigured):
                validate_production_settings(debug=False)

    def test_dev_skips_validation(self):
        env = {k: v for k, v in os.environ.items() if k != 'CORE_AD_SIGNING_SECRET'}
        with mock.patch.dict(os.environ, env, clear=True):
            validate_production_settings(debug=True)
