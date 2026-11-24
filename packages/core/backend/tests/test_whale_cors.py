"""REV.2.1 AC11 — CORS allow-list must be proven with dynamic allow disabled."""
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

ORIGIN = 'https://charts.edusuccess.vn'


@override_settings(
    CORS_API_DYNAMIC_ALLOW=False,
    CORS_ALLOWED_ORIGINS=[ORIGIN],
    CORS_ALLOW_HEADERS=['content-type', 'authorization', 'x-csrftoken'],
)
class WhaleCorsAllowListTests(SimpleTestCase):
    def test_preflight_succeeds_only_with_explicit_allow_list(self):
        response = APIClient().options(
            '/core/v1/realtime/whale-feed/VIC/',
            HTTP_ORIGIN=ORIGIN,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get('Access-Control-Allow-Origin'), ORIGIN)

    def test_other_origin_is_not_reflected(self):
        response = APIClient().options(
            '/core/v1/realtime/whale-feed/VIC/',
            HTTP_ORIGIN='https://evil.example',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='GET',
        )
        self.assertNotEqual(response.get('Access-Control-Allow-Origin'), 'https://evil.example')
