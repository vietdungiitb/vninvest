"""P0-3: the test-connection endpoint must not be usable as an SSRF proxy.

`tests.test_ai_endpoint_safety` proves the guard classifies addresses correctly.
That is not the same as the endpoint calling it, so these tests drive the real
URL and assert on two things a classifier test cannot see:

  1. the request is refused (400), and
  2. no outbound socket was ever opened.

The second assertion is the one that matters. A guard that runs *after* the
request, or on the wrong branch, would still pass a status-code test.
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

from advisory.tests.envelope import unwrapped
from user_workspace.tests.tenant_test_helpers import grant_tenant

TEST_URL = '/core/v1/workspace/ai-command-center/test-connection/'

# Endpoints that must never be contacted. All are literal IPs, so the test does
# not depend on DNS.
BLOCKED_ENDPOINTS = [
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'http://10.0.0.5:8080/v1',
    'http://192.168.1.1/v1',
    'http://[::ffff:127.0.0.1]:11434/v1',
    'file:///etc/passwd',
]


class SSRFProbeBlockedTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='ssrf-probe-user', password='x', email='ssrf@example.com'
        )
        # Endpoint test-connection -> `broker_manage` (`settings:write`),
        # chi `admin`/`owner` co token nay trong SYSTEM_ROLE_PERMISSIONS.
        grant_tenant(self.user, role='admin', tenant_code='ssrf-probe-tenant')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _post(self, endpoint):
        return self.client.post(
            TEST_URL,
            {
                'ai_provider': 'local',
                'ai_model': 'llama3',
                'custom_endpoint': endpoint,
            },
            format='json',
        )

    def test_blocked_endpoints_are_refused(self):
        for endpoint in BLOCKED_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                resp = self._post(endpoint)
                self.assertEqual(
                    resp.status_code,
                    status.HTTP_400_BAD_REQUEST,
                    f'{endpoint} phải bị từ chối, nhận {resp.status_code}: {resp.data}',
                )

    def test_no_outbound_request_is_attempted(self):
        """The decisive assertion: httpx must never be constructed here.

        Patching `httpx.Client` means a single attribute access on the mock fails
        the test, so a guard placed after the request cannot pass.
        """
        with mock.patch('httpx.Client') as client_cls:
            resp = self._post('http://169.254.169.254/latest/meta-data/')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        client_cls.assert_not_called()

    def test_refusal_does_not_echo_endpoint(self):
        # R0.6 AC5 (rework co chu dich, nhu C-AC3/C-AC4 o R0.2): tu choi phai
        # hanh dong duoc (hint bien env phia may chu) NHUNG khong echo
        # endpoint/host/ip user nhap vao message loi.
        endpoint = 'http://169.254.169.254/latest/meta-data/'
        resp = self._post(endpoint)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        detail = str(resp.data)
        self.assertNotIn(endpoint, detail)
        self.assertNotIn('169.254.169.254', detail)
        self.assertIn('SOC_AI_ALLOWED_ENDPOINT_HOSTS', detail)

    def test_loopback_allowed_for_local_provider(self):
        """Guard must not break the feature: local Ollama on 127.0.0.1 works."""
        fake_response = mock.Mock()
        fake_response.raise_for_status.return_value = None
        fake_response.json.return_value = {'data': [{'name': 'llama3'}]}
        fake_response.elapsed.total_seconds.return_value = 0.01

        with mock.patch('httpx.Client') as client_cls:
            client_cls.return_value.__enter__.return_value.get.return_value = fake_response
            resp = self._post('http://127.0.0.1:11434/v1')

        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertIn('models_available', unwrapped(resp))
