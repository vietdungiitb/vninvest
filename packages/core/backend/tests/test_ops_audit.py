"""
SAAS-13: ops_audit middleware and model tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.test import TestCase, RequestFactory

from ops_audit.middleware import RequestTraceMiddleware
from ops_audit.models import AuditEvent


class RequestTraceMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_injects_x_request_id_from_header(self):
        request = self.factory.get('/test', HTTP_X_REQUEST_ID='fixed-id-123')
        captured = {}

        def get_response(req):
            from django.http import HttpResponse
            captured['meta_id'] = req.META.get('X_REQUEST_ID')
            return HttpResponse('ok')

        middleware = RequestTraceMiddleware(get_response)
        response = middleware(request)
        self.assertEqual(captured['meta_id'], 'fixed-id-123')
        self.assertEqual(response['X-Request-ID'], 'fixed-id-123')

    def test_generates_uuid_when_no_header(self):
        request = self.factory.get('/test')

        def get_response(req):
            from django.http import HttpResponse
            return HttpResponse('ok')

        middleware = RequestTraceMiddleware(get_response)
        response = middleware(request)
        rid = response['X-Request-ID']
        self.assertEqual(len(rid), 36)
        self.assertRegex(rid, r'^[0-9a-f-]{36}$')

    def test_response_always_has_x_request_id_header(self):
        """X-Request-ID must always appear in response regardless of request."""
        for path in ['/core/v1/health', '/core/v1/tenant', '/core/v1/audit-log']:
            request = self.factory.get(path)

            def get_response(req):
                from django.http import HttpResponse
                return HttpResponse('ok')

            middleware = RequestTraceMiddleware(get_response)
            response = middleware(request)
            self.assertIn('X-Request-ID', response, f'Missing X-Request-ID for path {path}')

    def test_records_access_audit_event_for_regular_requests(self):
        start_count = AuditEvent.objects.count()
        request = self.factory.get('/core/v1/health')

        def get_response(req):
            from django.http import HttpResponse
            return HttpResponse('ok')

        middleware = RequestTraceMiddleware(get_response)
        response = middleware(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditEvent.objects.count(), start_count + 1)
        event = AuditEvent.objects.order_by('-occurred_at').first()
        self.assertIsNotNone(event)
        self.assertEqual(event.action, 'access')
        self.assertEqual(event.resource_type, 'HttpRequest')
        self.assertEqual(event.resource_id, '/core/v1/health')
        self.assertEqual(event.metadata.get('method'), 'GET')

    def test_skips_audit_log_self_requests(self):
        start_count = AuditEvent.objects.count()
        request = self.factory.get('/core/v1/audit-log')

        def get_response(req):
            from django.http import HttpResponse
            return HttpResponse('ok')

        middleware = RequestTraceMiddleware(get_response)
        response = middleware(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditEvent.objects.count(), start_count)


class AuditEventModelTests(TestCase):
    def test_create_audit_event(self):
        event = AuditEvent.objects.create(
            actor_label='ci-bot',
            tenant_id='ten-abc-123',
            action='create',
            resource_type='CoreServiceAccount',
            resource_id='sa-xyz',
            request_id='req-001',
        )
        self.assertIsNotNone(event.event_id)
        self.assertEqual(event.action, 'create')
        self.assertEqual(str(event), '[create] CoreServiceAccount/sa-xyz by ci-bot')
