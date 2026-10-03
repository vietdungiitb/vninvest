"""BL-15: JSON formatter output parses with required keys + request_id."""
import json
import logging

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase
from unittest import mock

from vninvest_core.json_logging import JsonFormatter, request_id_var


def _record(msg='hello', level=logging.WARNING):
    record = logging.LogRecord('test.logger', level, __file__, 10, msg, None, None)
    return record


class JsonFormatterTests(SimpleTestCase):
    def test_output_is_json_with_required_keys(self):
        out = JsonFormatter().format(_record())
        payload = json.loads(out)
        for key in ('ts', 'level', 'logger', 'msg', 'module'):
            self.assertIn(key, payload)
        self.assertEqual(payload['level'], 'WARNING')
        self.assertEqual(payload['msg'], 'hello')

    def test_request_id_attached_when_set(self):
        token = request_id_var.set('req-123')
        try:
            payload = json.loads(JsonFormatter().format(_record()))
        finally:
            request_id_var.reset(token)
        self.assertEqual(payload.get('request_id'), 'req-123')

    def test_no_request_id_key_when_unset(self):
        request_id_var.set('')
        payload = json.loads(JsonFormatter().format(_record()))
        self.assertNotIn('request_id', payload)

    def test_exception_included(self):
        try:
            raise ValueError('boom')
        except ValueError:
            import sys
            record = logging.LogRecord('t', logging.ERROR, __file__, 1, 'fail', None, sys.exc_info())
        payload = json.loads(JsonFormatter().format(record))
        self.assertIn('ValueError', payload.get('exc', ''))


class MiddlewareRequestIdPropagationTests(SimpleTestCase):
    def test_middleware_sets_contextvar(self):
        from ops_audit.middleware import RequestTraceMiddleware

        def get_response(request):
            return HttpResponse('ok')

        mw = RequestTraceMiddleware(get_response)
        req = RequestFactory().get('/core/v1/health', HTTP_X_REQUEST_ID='bl15-test')
        with mock.patch('ops_audit.middleware.AuditEvent.objects.create'):
            resp = mw(req)
        self.assertEqual(resp['X-Request-ID'], 'bl15-test')
        self.assertEqual(request_id_var.get(), 'bl15-test')
