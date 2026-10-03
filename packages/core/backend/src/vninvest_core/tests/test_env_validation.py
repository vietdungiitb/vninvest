"""
Tests for environment variable validation (C4 fix).

Validates that required environment variables are checked at startup.
"""
import os
from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings

from vninvest_core.env_validation import (
    get_required_env,
    get_optional_env,
    validate_production_settings,
    get_frontend_url,
)


class GetRequiredEnvTests(TestCase):
    """Tests for get_required_env function."""

    def test_get_required_env_returns_value(self):
        """Existing env var should be returned."""
        os.environ['TEST_VAR'] = 'test_value'
        try:
            result = get_required_env('TEST_VAR')
            self.assertEqual(result, 'test_value')
        finally:
            del os.environ['TEST_VAR']

    def test_get_required_env_strips_whitespace(self):
        """Whitespace should be stripped."""
        os.environ['TEST_VAR'] = '  test_value  '
        try:
            result = get_required_env('TEST_VAR')
            self.assertEqual(result, 'test_value')
        finally:
            del os.environ['TEST_VAR']

    def test_get_required_env_raises_if_missing(self):
        """Should raise ImproperlyConfigured if var missing."""
        with self.assertRaises(ImproperlyConfigured):
            get_required_env('NONEXISTENT_VAR_12345')

    def test_get_required_env_raises_if_empty(self):
        """Should raise ImproperlyConfigured if var empty."""
        os.environ['TEST_VAR'] = ''
        try:
            with self.assertRaises(ImproperlyConfigured):
                get_required_env('TEST_VAR')
        finally:
            del os.environ['TEST_VAR']

    def test_get_required_env_includes_description(self):
        """Error message should include description."""
        with self.assertRaisesRegex(ImproperlyConfigured, 'test description'):
            get_required_env('NONEXISTENT_VAR_12345', description='test description')


class GetOptionalEnvTests(TestCase):
    """Tests for get_optional_env function."""

    def test_get_optional_env_returns_value(self):
        """Existing env var should be returned."""
        os.environ['TEST_VAR'] = 'test_value'
        try:
            result = get_optional_env('TEST_VAR')
            self.assertEqual(result, 'test_value')
        finally:
            del os.environ['TEST_VAR']

    def test_get_optional_env_returns_default(self):
        """Default should be returned if var missing."""
        result = get_optional_env('NONEXISTENT_VAR_12345', default='default_value')
        self.assertEqual(result, 'default_value')

    def test_get_optional_env_strips_whitespace(self):
        """Whitespace should be stripped."""
        os.environ['TEST_VAR'] = '  test_value  '
        try:
            result = get_optional_env('TEST_VAR')
            self.assertEqual(result, 'test_value')
        finally:
            del os.environ['TEST_VAR']


class ValidateProductionSettingsTests(TestCase):
    """Tests for validate_production_settings function."""

    def test_validate_production_settings_skips_in_dev(self):
        """Should skip validation when debug=true."""
        # Should not raise even if required vars missing
        validate_production_settings(debug=True)

    def test_validate_production_settings_requires_frontend_url(self):
        """FRONTEND_URL should be required in production."""
        # Save original value
        original_value = os.environ.pop('FRONTEND_URL', None)
        
        try:
            # Ensure other required vars are set (else they fail first)
            os.environ['DJANGO_SECRET_KEY'] = 'test-key'
            os.environ['CORE_PAT_PEPPER'] = 'test-pepper'
            os.environ['DJANGO_ALLOWED_HOSTS'] = 'localhost'
            
            with self.assertRaisesRegex(ImproperlyConfigured, 'FRONTEND_URL'):
                validate_production_settings(debug=False)
        finally:
            # Restore
            if original_value is not None:
                os.environ['FRONTEND_URL'] = original_value


class GetFrontendUrlTests(TestCase):
    """Tests for get_frontend_url function."""

    def test_get_frontend_url_dev_returns_localhost(self):
        """Dev mode should return localhost:3000 by default."""
        # Remove FRONTEND_URL if set
        original = os.environ.pop('FRONTEND_URL', None)
        try:
            result = get_frontend_url(debug=True)
            self.assertEqual(result, 'http://localhost:3000')
        finally:
            if original:
                os.environ['FRONTEND_URL'] = original

    def test_get_frontend_url_dev_uses_env_if_set(self):
        """Dev mode should use FRONTEND_URL if set."""
        os.environ['FRONTEND_URL'] = 'http://custom.local'
        try:
            result = get_frontend_url(debug=True)
            self.assertEqual(result, 'http://custom.local')
        finally:
            del os.environ['FRONTEND_URL']

    def test_get_frontend_url_prod_requires_env(self):
        """Production mode should require FRONTEND_URL."""
        # Remove FRONTEND_URL if set
        original = os.environ.pop('FRONTEND_URL', None)
        try:
            with self.assertRaises(ImproperlyConfigured):
                get_frontend_url(debug=False)
        finally:
            if original:
                os.environ['FRONTEND_URL'] = original

    def test_get_frontend_url_strips_trailing_slash(self):
        """Trailing slash should be removed."""
        os.environ['FRONTEND_URL'] = 'http://example.com/'
        try:
            result = get_frontend_url(debug=True)
            self.assertEqual(result, 'http://example.com')
        finally:
            del os.environ['FRONTEND_URL']
