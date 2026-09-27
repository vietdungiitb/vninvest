"""Regression: `legacy_proxy` phai tra 502/503, khong bao gio lo 500.

Bug goc: `legacy_proxy.py` bat `(httpx.ConnectError, httpx.TimeoutException)`.
`httpx.UnsupportedProtocol` — thu xay `LEGACY_BACKEND_URL` rong, `settings.py:176`
default `''` nen `target_url` thanh `/api/...` thieu scheme — la con cua
`httpx.TransportError` nhung **khong** phai `ConnectError` hay `TimeoutException`,
nen exception lot ra Django ⇒ **HTTP 500** thay vi 502.

`/api/*` la catch-all cuoi cung urlpatterns nen mot config sai co the lam do
500 cho moi request khong match native route.

Dotted path: `vninvest_core.tests.test_legacy_proxy_transport_error`
"""

from unittest import mock

from django.test import RequestFactory, SimpleTestCase, override_settings

from vninvest_core import legacy_proxy


class LegacyProxyTransportErrorTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _request(self, path='/api/portfolio/portfolios/'):
        return self.factory.get(path)

    def _call(self, request):
        return legacy_proxy.legacy_proxy_view(request, request.path.split('/api/', 1)[-1])

    # --- 1. UnsupportedProtocol: loi goc, 500 truoc khi sua --------------
    # Luon dung backend URL HOP LE cho cac test lop transport, neu khong guard
    # 503 o duoi se chay truoc va che mat nhanh 502 can kiem chung.

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal:8080')
    def test_unsupported_protocol_returns_502_not_500(self):
        """URL sai scheme -> UnsupportedProtocol -> phai 502, khong lo 500."""
        request = self._request()
        boom = legacy_proxy.httpx.UnsupportedProtocol("missing scheme")

        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = boom
            response = self._call(request)

        self.assertEqual(response.status_code, 502, 'UnsupportedProtocol phai ra 502, khong duoc lo 500')
        self.assertEqual(response['Deprecation'], 'true')

    # --- 2. Cac exception con khac cua TransportError -------------------

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal:8080')
    def test_protocol_error_returns_502(self):
        request = self._request()
        boom = legacy_proxy.httpx.RemoteProtocolError('bad frame')

        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = boom
            response = self._call(request)

        self.assertEqual(response.status_code, 502)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal:8080')
    def test_connect_error_still_returns_502(self):
        """Khong duoc lam hong nhanh da co dat ConnectError."""
        request = self._request()
        boom = legacy_proxy.httpx.ConnectError('refused')

        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = boom
            response = self._call(request)

        self.assertEqual(response.status_code, 502)

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal:8080')
    def test_timeout_still_returns_502(self):
        request = self._request()
        boom = legacy_proxy.httpx.ReadTimeout('slow')

        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = boom
            response = self._call(request)

        self.assertEqual(response.status_code, 502)

    # --- 3. Config thieu: 503 ro hon 502 --------------------------------

    @override_settings(LEGACY_BACKEND_URL='')
    def test_empty_backend_url_returns_503_not_configured(self):
        """Config sai != upstream chet. 503 + code ro hon 502 'khong loi'."""
        request = self._request()

        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            response = self._call(request)

        self.assertEqual(response.status_code, 503)
        client_cls.assert_not_called()
        self.assertEqual(response['Deprecation'], 'true')

    @override_settings(LEGACY_BACKEND_URL='   ')
    def test_whitespace_backend_url_returns_503(self):
        request = self._request()
        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            response = self._call(request)
        self.assertEqual(response.status_code, 503)
        client_cls.assert_not_called()

    # --- 4. Khong ro URL / secret qua response --------------------------

    @override_settings(LEGACY_BACKEND_URL='http://legacy.internal:8080')
    def test_error_response_does_not_echo_upstream_host(self):
        request = self._request()
        boom = legacy_proxy.httpx.ConnectError('refused legacy.internal:8080')

        with mock.patch.object(legacy_proxy.httpx, 'Client') as client_cls:
            client_cls.return_value.__enter__.return_value.request.side_effect = boom
            response = self._call(request)

        body = response.content.decode()
        self.assertNotIn('legacy.internal', body)
        self.assertNotIn('8080', body)

    @override_settings(LEGACY_BACKEND_URL='')
    def test_not_configured_response_has_no_exception_text(self):
        request = self._request()
        with mock.patch.object(legacy_proxy.httpx, 'Client'):
            response = self._call(request)
        self.assertNotIn('UnsupportedProtocol', response.content.decode())
