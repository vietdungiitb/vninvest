"""R1.9 (plan Rev.2): optimistic lock cho PUT AI CC.

AC1: 2 client doc cung updated_at=T; A PUT -> 200; B PUT expected_updated_at=T -> 409.
AC2: B PUT expected_updated_at=<moi> -> 200.
AC3: Khong gui expected_updated_at -> hanh vi cu (200, tuong thich nguoc).

TDD fail-before: AC1 khong 409 (ghi de am tham) tren code cu.
"""
import os
import sys

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
os.environ.setdefault('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')

import django  # noqa: E402

django.setup()

from django.contrib.auth.models import User  # noqa: E402
from django.test import TestCase  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402
from user_workspace.tests.tenant_test_helpers import grant_tenant  # noqa: E402

CC_URL = '/core/v1/workspace/ai-command-center/'


class ConcurrencyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='r19-u', password='x')
        grant_tenant(self.user, role='editor', tenant_code='r19-tenant')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _get_T(self):
        resp = self.client.get(CC_URL)
        self.assertEqual(resp.status_code, 200)
        T = resp.data.get('config_updated_at')
        self.assertTrue(T, 'GET thieu config_updated_at')
        return T

    def test_ac1_stale_write_gets_409(self):
        T = self._get_T()
        r1 = self.client.put(CC_URL, {'advisory_max_tokens_per_day': 1000}, format='json')
        self.assertEqual(r1.status_code, 200)
        r2 = self.client.put(
            CC_URL,
            {'advisory_max_tokens_per_day': 2000, 'expected_updated_at': T},
            format='json',
        )
        self.assertEqual(r2.status_code, 409)
        self.assertEqual(r2.data.get('code'), 'ai_config_conflict')
        self.assertTrue(r2.data.get('current_updated_at'))
        # ghi le khong duoc apply
        T2 = self._get_T()
        self.assertNotEqual(T2, T)

    def test_ac2_fresh_expected_writes_200(self):
        T = self._get_T()
        r1 = self.client.put(
            CC_URL, {'advisory_max_tokens_per_day': 1000, 'expected_updated_at': T}, format='json'
        )
        self.assertEqual(r1.status_code, 200)
        T2 = r1.data.get('config_updated_at')
        self.assertTrue(T2, 'PUT thieu config_updated_at moi')
        r2 = self.client.put(
            CC_URL, {'advisory_max_tokens_per_day': 2000, 'expected_updated_at': T2}, format='json'
        )
        self.assertEqual(r2.status_code, 200)

    def test_ac3_no_expected_keeps_old_behavior(self):
        r = self.client.put(CC_URL, {'advisory_max_tokens_per_day': 3000}, format='json')
        self.assertEqual(r.status_code, 200)
