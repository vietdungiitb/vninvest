"""R0.6 (plan Rev.2): test-connection + orchestrator khong echo endpoint + throttle.

AC5: local + endpoint private (mac dinh) -> 400, message KHONG chua endpoint.
AC7: scope ai_test_connection 20/hour: 21 POST -> lan 21 tra 429.
AC8: message loi khong chua "Traceback" / "httpx." (khong str(e) raw).
Orchestrator: custom_endpoint private -> ValueError truoc khi mo socket,
  message tinh, khong echo endpoint.

TDD fail-before: 4 test nay RED tren code HEAD (detail con echo endpoint,
throttle scope cu ai_endpoint_probe 10/phut, orchestrator chua guard).
"""
import os
import sys
from unittest import mock

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django  # noqa: E402

django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.test import TestCase  # noqa: E402
from rest_framework import status  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from user_workspace.tests.tenant_test_helpers import grant_tenant  # noqa: E402

TEST_URL = '/core/v1/workspace/ai-command-center/test-connection/'
PRIVATE_ENDPOINT = 'http://10.0.0.5:8080/v1'


class NoEchoTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='r06-noecho-user', password='x', email='r06@example.com'
        )
        grant_tenant(self.user, role='admin', tenant_code='r06-noecho-tenant')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _post_local(self, endpoint):
        return self.client.post(
            TEST_URL,
            {
                'ai_provider': 'local',
                'ai_model': 'llama3',
                'custom_endpoint': endpoint,
            },
            format='json',
        )

    def test_ac5_blocked_endpoint_error_does_not_echo(self):
        """AC5: 400 + detail khong chua endpoint/host/ip, van co hint van hanh."""
        resp = self._post_local(PRIVATE_ENDPOINT)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        detail = str(resp.data)
        self.assertNotIn(PRIVATE_ENDPOINT, detail)
        self.assertNotIn('10.0.0.5', detail)
        self.assertIn('SOC_AI_ALLOWED_ENDPOINT_HOSTS', detail)

    def test_ac8_generic_exception_does_not_leak(self):
        """AC8: loi ha tang bat ngo -> message tinh, khong Traceback/httpx./endpoint."""
        with mock.patch('httpx.Client') as client_cls:
            inst = client_cls.return_value.__enter__.return_value
            inst.get.side_effect = RuntimeError('httpx.ConnectError: boom')
            resp = self._post_local('http://127.0.0.1:11434/v1')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        detail = str(resp.data)
        self.assertNotIn('Traceback', detail)
        self.assertNotIn('httpx.', detail)
        self.assertNotIn('127.0.0.1', detail)


class ThrottleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='r06-throttle-user', password='x', email='r06t@example.com'
        )
        grant_tenant(self.user, role='admin', tenant_code='r06-throttle-tenant')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

def test_ac7_21st_probe_returns_429(self):
        """AC7: 20 probe đầu đi qua throttle, lần 21 -> 429.

        R2.5 đổi mã của 20 lần đầu từ 200 → 400: `openclaw` nay **fail-closed**
        (`openclaw_not_configured`) thay vì trả 200 giả. Test throttle vẫn giữ
        nguyên ý nghĩa: **không** phải outbound, và lần 21 vẫn phải 429.
        """
        codes = []
        for _ in range(21):
            resp = self.client.post(
                TEST_URL,
                {'ai_provider': 'openclaw', 'ai_model': 'default'},
                format='json',
            )
            codes.append(resp.status_code)
        self.assertEqual(
            codes[-1], status.HTTP_429_TOO_MANY_REQUESTS, f'codes={codes}'
        )
        # 20 lần đầu: KHÔNG phải 429 (tức throttle cho qua) và không phải 200 giả.
        self.assertTrue(all(c != 429 for c in codes[:20]), f'codes={codes}')
        self.assertTrue(all(c == 400 for c in codes[:20]), f'codes={codes}')


class OrchestratorGuardTests(TestCase):
    def test_private_custom_endpoint_rejected_before_socket(self):
        """Orchestrator: custom_endpoint private -> ValueError tinh, khong echo."""
        from advisory.orchestrator import _resolve_chat_endpoint

        with self.assertRaises(ValueError) as ctx:
            _resolve_chat_endpoint('local', 'http://10.9.9.9:11434/v1')
        self.assertNotIn('10.9.9.9', str(ctx.exception))

    def test_public_custom_endpoint_passes(self):
        from advisory.orchestrator import _resolve_chat_endpoint

        # Hermetic: khong phu thuoc DNS that — public IP 93.184.216.34.
        fake_info = [(2, 1, 6, '', ('93.184.216.34', 11434))]
        with mock.patch('socket.getaddrinfo', return_value=fake_info):
            endpoint = _resolve_chat_endpoint('local', 'https://llm.example.com:11434/v1')
        self.assertTrue(endpoint.endswith('/chat/completions'))
