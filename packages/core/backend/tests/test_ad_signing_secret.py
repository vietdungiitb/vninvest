"""
Tests for CORE_AD_SIGNING_SECRET production validation (W0-6).
"""
import os
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase

from vninvest_core.env_validation import validate_production_settings


class CoreAdSigningSecretProdTests(TestCase):
    def test_prod_without_secret_raises(self):
        env = {k: v for k, v in os.environ.items() if k != 'CORE_AD_SIGNING_SECRET'}
        with mock.patch.dict(os.environ, env, clear=True):
            os.environ['DJANGO_DEBUG'] = 'False'
            with self.assertRaises(ImproperlyConfigured):
                validate_production_settings(debug=False)

    def test_prod_with_secret_ok(self):
        with mock.patch.dict(os.environ, {'CORE_AD_SIGNING_SECRET': 'real-secret'}, clear=False):
            validate_production_settings(debug=False)

    def test_dev_skips_validation(self):
        env = {k: v for k, v in os.environ.items() if k != 'CORE_AD_SIGNING_SECRET'}
        with mock.patch.dict(os.environ, env, clear=True):
            # dev mode must not raise even without secret
            validate_production_settings(debug=True)
