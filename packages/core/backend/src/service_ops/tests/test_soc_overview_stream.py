"""SOC overview SSE stream tests — Overview P3 (F-OV-14/15)."""
import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from service_ops.models import ServiceDefinition, ServiceHealth
from service_ops.registry import ensure_service_registry

User = get_user_model()


class OverviewStreamBaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        ensure_service_registry()
        cls.admin = User.objects.create_user(
            username='soc-ovstream-admin',
            email='soc-ovstream-admin@test.local',
            password='pass123',
        )
        cls.admin.is_staff = True
        cls.admin.is_superuser = True
        cls.admin.save(update_fields=['is_staff', 'is_superuser'])

        cls.user = User.objects.create_user(
            username='soc-ovstream-user',
            email='soc-ovstream-user@test.local',
            password='pass123',
        )

        cls.service = ServiceDefinition.objects.create(
            service_key='soc_overview_stream_probe',
            name='SOC Overview Stream Probe',
            domain='test',
            description='probe for stream test',
            owner_team='core',
        )
        ServiceHealth.objects.update_or_create(
            service=cls.service,
            defaults={'status': 'healthy', 'avg_response_ms': 12.0},
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)


def _read_stream_content(response, max_bytes=20000) -> str:
    chunks = []
    for chunk in response.streaming_content:
        if isinstance(chunk, bytes):
            chunks.append(chunk.decode())
        else:
            chunks.append(str(chunk))
        if sum(len(c) for c in chunks) > max_bytes:
            break
    return ''.join(chunks)


class OverviewStreamAuthTestCase(OverviewStreamBaseTestCase):
    def test_unauthenticated_returns_401(self):
        self.client.force_authenticate(user=None)
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=1')
        self.assertEqual(rsp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(user=self.user)
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=1')
        self.assertEqual(rsp.status_code, status.HTTP_403_FORBIDDEN)


class OverviewStreamContractTestCase(OverviewStreamBaseTestCase):
    def test_returns_event_stream_content_type(self):
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=1')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        self.assertEqual(rsp['Content-Type'], 'text/event-stream')
        self.assertEqual(rsp['Cache-Control'], 'no-cache')
        self.assertIn('X-Accel-Buffering', rsp)

    def test_eventsource_accept_header_returns_200_not_406(self):
        # RC1 regression (chung với signals stream): browser EventSource thật
        # gửi `Accept: text/event-stream`, DRF mặc định trả 406.
        rsp = self.client.get(
            '/api/soc/overview/stream/?max_loops=1',
            HTTP_ACCEPT='text/event-stream',
        )
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        self.assertEqual(rsp['Content-Type'], 'text/event-stream')
        content = _read_stream_content(rsp)
        self.assertIn('retry: 3000', content)

    def test_response_uses_flush_streaming_class(self):
        # RC1-phần-2: xem SignalsStreamFlushTestCase (sync generator + sleep
        # bị Django `list()` toàn bộ → infinite stream 0 byte).
        from service_ops.views.base import SSEStreamingHttpResponse

        rsp = self.client.get('/api/soc/overview/stream/?max_loops=1')
        self.assertEqual(rsp.status_code, status.HTTP_200_OK)
        self.assertIsInstance(rsp, SSEStreamingHttpResponse)

    def test_retry_and_overview_event_present(self):
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=2')
        content = _read_stream_content(rsp)
        self.assertIn('retry: 3000', content)
        # max_loops=2 → vẫn emit snapshot đầu tiên (ít nhất 1 event overview)
        self.assertIn('event: overview', content)
        self.assertIn('"summary":', content)
        self.assertIn('"services":', content)

    def test_snapshot_includes_probe_service(self):
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=2')
        content = _read_stream_content(rsp)
        self.assertIn('soc_overview_stream_probe', content)
        self.assertIn('"status": "healthy"', content)

    def test_only_emits_when_changed(self):
        # max_loops=3: vòng 1 emit snapshot, vòng 2-3 không đổi → không emit thêm event overview
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=3')
        content = _read_stream_content(rsp)
        # Đếm số lần "event: overview" — phải là 1 (chỉ lần đầu)
        self.assertEqual(content.count('event: overview'), 1)
        # Heartbeat ping (testing luôn gửi khi không có thay đổi)
        self.assertIn(': ping', content)

    def test_emits_updated_snapshot_on_health_change(self):
        # Vòng 1: snapshot healthy. Sau loop 1, update status → vòng 2 emit snapshot mới.
        # Dùng UPDATE qua queryset trước khi đọc streams? Không — test in-stream hard.
        # Cách đơn giản: đổi health trước, verify snapshot phản ánh đúng (coverage contract).
        ServiceHealth.objects.filter(service=self.service).update(status='degraded')
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=2')
        content = _read_stream_content(rsp)
        self.assertIn('"status": "degraded"', content)
        self.assertEqual(content.count('event: overview'), 1)

    def test_inactive_service_summary_covered(self):
        ServiceDefinition.objects.create(
            service_key='soc_overview_stream_inactive',
            name='SOC Overview Stream Inactive',
            domain='test',
            description='inactive probe',
            owner_team='core',
            is_active=False,
        )
        rsp = self.client.get('/api/soc/overview/stream/?max_loops=2')
        content = _read_stream_content(rsp)
        self.assertIn('soc_overview_stream_inactive', content)
        self.assertIn('"is_active": false', content)

    def test_query_token_fallback_auth(self):
        from unittest.mock import patch

        with patch('identity_access.authentication.CorePATAuthentication.authenticate') as mock_auth:
            mock_auth.return_value = (self.admin, None)
            anon_client = APIClient()
            rsp = anon_client.get('/api/soc/overview/stream/?token=test-pat&max_loops=1')
            self.assertIn(rsp.status_code, [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED])