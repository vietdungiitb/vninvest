"""
Tests for environment variable validation (C4 fix).

Validates that required environment variables are checked at startup.
"""
import os
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase, override_settings

from vninvest_core.env_validation import (
    get_required_env,
    get_optional_env,
    validate_production_settings,
    validate_turnstile_enforcement,
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


class TurnstileEnforcementValidationTests(TestCase):
    """OW-04: `STRICT_TURNSTILE_ENFORCEMENT` ngoài allowlist phải fail ở production.

    Biểu thức ở `settings.py:246-255` là

        ((raw or '').strip().lower() or str(not DEBUG)) in ('true', '1', 'yes')

    nên **bất kỳ** giá trị nào không nằm trong allowlist rơi ra False — tức deploy
    production mang `on`, `TRUE_`, `yes please` hay giá trị bị YAML bóp méo sẽ
    tắt kiểm tra Turnstile ở form đăng ký công khai, trong khi mọi bảng điều
    khiển vẫn báo tính năng "đang bật". Cùng hình dạng lỗi với bug gán trùng
    `STRICT_TURNSTILE_ENFORCEMENT` từng tồn tại (settings.py:237-245), đi vào
    bằng cửa khác.

    Vì sao để `false`/`0`/`no` qua: `settings.py:236` ghi rõ ý định *"enforced
    unless explicitly disabled"* — phải có đường tắt có chủ đích.
    """

    def test_allowlist_values_accepted(self):
        for raw in ('true', 'false', '1', '0', 'yes', 'no'):
            with self.subTest(raw=raw):
                validate_turnstile_enforcement(raw)

    def test_case_and_whitespace_tolerated(self):
        """`settings.py:253` strip+lower TRƯỚC khi so — test cùng cách đó."""
        for raw in ('  TRUE  ', 'Yes', '\tno\n'):
            with self.subTest(raw=raw):
                validate_turnstile_enforcement(raw)

    def test_empty_or_absent_defaults_not_an_error(self):
        """`docker-compose ${VAR:-}` tạo chuỗi rỗng ⇒ phải qua, không phải lỗi.

        Chuỗi rỗng nghĩa là "chưa đặt" ⇒ rơi về `str(not DEBUG)` = fail-closed ở
        production. Nếu siết thành lỗi, mọi deploy dùng mặc định sẽ không boot.
        """
        for raw in (None, '', '   '):
            with self.subTest(raw=raw):
                validate_turnstile_enforcement(raw)

    def test_unknown_values_rejected(self):
        for raw in ('on', 'TRUE_', 'yes please', '2', 'enabled', 'maybe', 'null'):
            with self.subTest(raw=raw):
                with self.assertRaises(ImproperlyConfigured) as ctx:
                    validate_turnstile_enforcement(raw)
                self.assertIn('STRICT_TURNSTILE_ENFORCEMENT', str(ctx.exception))

    def test_production_settings_rejects_bad_value(self):
        """Lồi ghép: giá trị rác phải làm `validate_production_settings` ném."""
        required = {
            'DJANGO_SECRET_KEY': 'test-key',
            'FRONTEND_URL': 'https://example.com',
            'CORE_PAT_PEPPER': 'test-pepper',
            'DJANGO_ALLOWED_HOSTS': 'example.com',
            'TURNSTILE_SECRET_KEY': 'test-turnstile',
            'STRICT_TURNSTILE_ENFORCEMENT': 'on',
        }
        with mock.patch.dict(os.environ, required, clear=False):
            with self.assertRaisesRegex(ImproperlyConfigured, 'STRICT_TURNSTILE_ENFORCEMENT'):
                validate_production_settings(debug=False)

    def test_production_settings_accepts_explicit_disable(self):
        """Tắt có chủ đích vẫn phải boot được."""
        required = {
            'DJANGO_SECRET_KEY': 'test-key',
            'FRONTEND_URL': 'https://example.com',
            'CORE_PAT_PEPPER': 'test-pepper',
            'DJANGO_ALLOWED_HOSTS': 'example.com',
            'TURNSTILE_SECRET_KEY': 'test-turnstile',
            'STRICT_TURNSTILE_ENFORCEMENT': 'false',
        }
        with mock.patch.dict(os.environ, required, clear=False):
            validate_production_settings(debug=False)

    def test_dev_tolerates_bad_value(self):
        """Máy dev không phải fail-closed — giống `prod_cookie_security_settings`.

        Lý do không siết ở debug: `validate_production_settings` cũng bỏ qua mọi
        biến bắt buộc khi `debug=True` (`env_validation.py:108-110`). Siết chỉ
        một biến trong khi bỏ qua 5 biến kia là không nhất quán, và làm hỏng
        vòng lặp dev-local.
        """
        with mock.patch.dict(os.environ, {'STRICT_TURNSTILE_ENFORCEMENT': 'on'}, clear=False):
            validate_production_settings(debug=True)


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
