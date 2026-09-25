"""BL-03: proxy forwards only whitelisted headers, verifies TLS, scopes response headers."""
from unittest import mock

import httpx
from django.test import RequestFactory, SimpleTestCase, override_settings

from vninvest_core import legacy_proxy
from vninvest_core.legacy_proxy import legacy_proxy_view


def _fake_ok(captured):
    def _request(method, url, headers=None, content=None, follow_redirects=False):
        captured['method'] = method
        captured['url'] = url
        captured['headers'] = dict(headers or {})
        captured['follow_redirects'] = follow_redirects
        resp = mock.Mock()
        resp.status_code = 200
        resp.content = b'{"ok": true}'
        resp.headers = {'content-type': 'application/json', 'set-cookie': 'legacy=1', 'x-legacy-secret': 's3cr3t'}
        return resp
    return _request


@override_settings(LEGACY_BACKEND_URL='https://legacy.internal')
class LegacyProxyScopeTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_only_whitelisted_headers_forwarded(self):
        captured = {}
        req = self.factory.get(
            '/api/some/path', HTTP_AUTHORIZATION='Bearer tok', HTTP_X_ADMIN_TOKEN='nope',
            HTTP_X_FORWARDED_FOR='1.2.3.4', HTTP_X_REQUEST_ID='req-1',
        )
        with mock.patch.object(httpx, 'Client') as client_cls:
            client = client_cls.return_value.__enter__.return_value
            client.request.side_effect = _fake_ok(captured)
            legacy_proxy_view(req, 'some/path')
        fwd = {k.lower(): v for k, v in captured['headers'].items()}
        self.assertEqual(fwd.get('authorization'), 'Bearer tok')
        self.assertEqual(fwd.get('x-request-id'), 'req-1')
        self.assertNotIn('x-admin-token', fwd)
        self.assertNotIn('x-forwarded-for', fwd)
        self.assertNotIn('content-length', fwd)
        self.assertTrue(captured['url'].startswith('https://legacy.internal/api/some/path'))
        self.assertFalse(captured['follow_redirects'])

    def test_tls_verify_enabled(self):
        captured = {}
        req = self.factory.get('/api/x')
        with mock.patch.object(httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = _fake_ok(captured)
            legacy_proxy_view(req, 'x')
            _, kwargs = client_cls.call_args
        self.assertTrue(kwargs.get('verify'))

    def test_response_headers_scoped(self):
        captured = {}
        req = self.factory.get('/api/x')
        with mock.patch.object(httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = _fake_ok(captured)
            resp = legacy_proxy_view(req, 'x')
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn('Set-Cookie', resp)
        self.assertFalse(any(k.lower() == 'x-legacy-secret' for k in resp.headers))
        # BL-14: deprecation advertised.
        self.assertEqual(resp['Deprecation'], 'true')
        self.assertIn('Sunset', resp)

    def test_unreachable_backend_502(self):
        req = self.factory.get('/api/x')
        with mock.patch.object(httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = httpx.ConnectError('down')
            resp = legacy_proxy_view(req, 'x')
        self.assertEqual(resp.status_code, 502)
        self.assertEqual(resp['Deprecation'], 'true')

    def test_forward_allowlist_contents(self):
        self.assertIn('authorization', legacy_proxy.FORWARD_HEADERS)
        self.assertNotIn('x-admin-token', legacy_proxy.FORWARD_HEADERS)
