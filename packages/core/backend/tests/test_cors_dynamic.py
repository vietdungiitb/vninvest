"""
Tests for dynamic CORS configuration on API endpoints (/core/v1/ and /api/).
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import TestCase, override_settings


class CoreDynamicCorsTests(TestCase):
    @override_settings(CORS_API_DYNAMIC_ALLOW=True)
    def test_cors_allowed_for_core_v1_health_get(self):
        # Sending a GET request to /core/v1/health with an Origin header
        response = self.client.get(
            '/core/v1/health',
            HTTP_ORIGIN='https://custom-thirdparty-client.com'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get('Access-Control-Allow-Origin'),
            'https://custom-thirdparty-client.com'
        )

    @override_settings(CORS_API_DYNAMIC_ALLOW=True)
    def test_cors_allowed_for_core_v1_health_options(self):
        # Sending an OPTIONS preflight request to /core/v1/health with Access-Control headers
        response = self.client.options(
            '/core/v1/health',
            HTTP_ORIGIN='https://custom-thirdparty-client.com',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type'
        )
        # Preflight requests normally return 200 or 204
        self.assertIn(response.status_code, (200, 204))
        self.assertEqual(
            response.get('Access-Control-Allow-Origin'),
            'https://custom-thirdparty-client.com'
        )

    @override_settings(CORS_API_DYNAMIC_ALLOW=True)
    def test_cors_allowed_for_api_health_get(self):
        response = self.client.get(
            '/api/health/',
            HTTP_ORIGIN='https://another-client.io'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.get('Access-Control-Allow-Origin'),
            'https://another-client.io'
        )

    @override_settings(CORS_API_DYNAMIC_ALLOW=True)
    def test_cors_not_allowed_for_non_api_endpoints(self):
        # /admin/ is not an API path starting with /core/v1/ or /api/
        response = self.client.get(
            '/admin/',
            HTTP_ORIGIN='https://malicious-domain.com'
        )
        # Should not have the CORS header because it is not an API route and not in whitelist settings
        self.assertIsNone(response.get('Access-Control-Allow-Origin'))

    @override_settings(CORS_API_DYNAMIC_ALLOW=False)
    def test_cors_disabled_when_dynamic_allow_is_false(self):
        response = self.client.get(
            '/core/v1/health',
            HTTP_ORIGIN='https://custom-thirdparty-client.com'
        )
        self.assertEqual(response.status_code, 200)
        # When dynamic allow toggle is False, it should not automatically allow the origin
        self.assertIsNone(response.get('Access-Control-Allow-Origin'))
