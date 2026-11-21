"""S3 (Phase A — fast data service): audit write rời critical path.

Fail-before: `flush_audit_events` / `audit_executor` chưa tồn tại trên code cũ.
Lưu ý: worker thread ghi trên connection riêng nên KHÔNG nằm trong transaction
của TestCase — mỗi test dùng resource_id duy nhất + dọn dẹp để không rò rỉ
sang test khác (kể cả khi chạy lại với --keepdb).
"""
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.test import RequestFactory, TestCase

from ops_audit.models import AuditEvent

User = get_user_model()


def _ok(request):
    return JsonResponse({}, status=200)


def _path(tag):
    return f'/core/v1/s3-probe/{tag}/{uuid.uuid4().hex}/'


class AsyncAuditWriteTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(username='s3user', email='s3@t.test', password='x')
        self.paths = []

    def tearDown(self):
        if self.paths:
            AuditEvent.objects.filter(resource_id__in=self.paths).delete()

    def _req(self, path):
        self.paths.append(path)
        request = self.factory.get(path)
        request.user = self.user
        request.META['REMOTE_ADDR'] = '203.0.113.9'
        return request

    def test_flush_helper_exists_and_drains(self):
        from ops_audit.middleware import RequestTraceMiddleware, flush_audit_events

        path = _path('drain')
        RequestTraceMiddleware(get_response=_ok)(self._req(path))
        flush_audit_events(timeout=10)
        self.assertTrue(AuditEvent.objects.filter(resource_id=path).exists())

    def test_executor_is_bounded(self):
        from ops_audit.middleware import audit_executor

        self.assertLessEqual(audit_executor._max_workers, 4)

    def test_submit_failure_falls_back_to_sync_write(self):
        from ops_audit import middleware as mw

        path = _path('fallback')
        with patch.object(mw.audit_executor, 'submit', side_effect=RuntimeError('shutting down')):
            mw.RequestTraceMiddleware(get_response=_ok)(self._req(path))
        self.assertTrue(AuditEvent.objects.filter(resource_id=path).exists())

    def test_worker_exception_does_not_raise_to_caller(self):
        from ops_audit import middleware as mw

        path = _path('worker-err')
        with patch.object(AuditEvent.objects, 'create', side_effect=ValueError('db down')):
            response = mw.RequestTraceMiddleware(get_response=_ok)(self._req(path))
        self.assertEqual(response.status_code, 200)
        mw.flush_audit_events(timeout=10)
        self.assertFalse(AuditEvent.objects.filter(resource_id=path).exists())
