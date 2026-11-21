"""S3 (Phase A): audit write rời critical path nhưng không mất mát âm thầm.

Fail-before: `flush_audit_events` / `audit_executor` chưa tồn tại trên code cũ
→ ImportError đỏ trước khi sửa middleware.
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.test import RequestFactory, TestCase

from ops_audit.models import AuditEvent

User = get_user_model()


def _ok(request):
    return JsonResponse({}, status=200)


def _req(factory, user, path='/core/v1/stock-management/stocks/VIC/overview/'):
    request = factory.get(path)
    request.user = user
    request.META['REMOTE_ADDR'] = '203.0.113.9'
    return request


class AsyncAuditWriteTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username='s3user', email='s3@t.test', password='x')

    def test_flush_helper_exists_and_drains_pending_write(self):
        from ops_audit.middleware import RequestTraceMiddleware, flush_audit_events

        RequestTraceMiddleware(get_response=_ok)(_req(self.factory, self.user))
        flush_audit_events(timeout=10)
        self.assertTrue(
            AuditEvent.objects.filter(resource_id='/core/v1/stock-management/stocks/VIC/overview/').exists()
        )

    def test_executor_is_bounded(self):
        from ops_audit.middleware import audit_executor

        self.assertLessEqual(audit_executor._max_workers, 4)

    def test_submit_failure_falls_back_to_sync_write(self):
        from ops_audit import middleware as mw

        with patch.object(mw.audit_executor, 'submit', side_effect=RuntimeError('shutting down')):
            mw.RequestTraceMiddleware(get_response=_ok)(_req(self.factory, self.user))
        self.assertTrue(
            AuditEvent.objects.filter(resource_id='/core/v1/stock-management/stocks/VIC/overview/').exists()
        )

    def test_worker_exception_does_not_raise_to_caller(self):
        from ops_audit import middleware as mw

        with patch.object(AuditEvent.objects, 'create', side_effect=ValueError('db down')):
            response = mw.RequestTraceMiddleware(get_response=_ok)(_req(self.factory, self.user))
        self.assertEqual(response.status_code, 200)
        mw.flush_audit_events(timeout=10)
        self.assertFalse(
            AuditEvent.objects.filter(resource_id='/core/v1/stock-management/stocks/VIC/overview/').exists()
        )
