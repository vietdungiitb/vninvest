"""R1.10 (plan Rev.2): quota labels dung nghia.

AC1: Response co fallback_quota_remaining/_max/_used_today/_reset/_source (GET+PUT).
TDD fail-before: thieu _used_today/_source tren code cu.
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
from advisory.tests.envelope import unwrapped  # noqa: E402
from user_workspace.tests.tenant_test_helpers import grant_tenant  # noqa: E402

CC_URL = '/core/v1/workspace/ai-command-center/'
WANT = [
    'fallback_quota_remaining',
    'fallback_quota_max',
    'fallback_quota_used_today',
    'fallback_quota_reset',
    'fallback_quota_source',
]


class QuotaFieldsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='r110-u', password='x')
        grant_tenant(self.user, role='editor', tenant_code='r110-tenant')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_ac1_get_has_quota_fields(self):
        data = unwrapped(self.client.get(CC_URL))
        for key in WANT:
            self.assertIn(key, data, f'GET thieu {key}')
        self.assertIn(data['fallback_quota_source'], ('personal_key', 'system'))

    def test_ac1_put_has_quota_fields(self):
        resp = self.client.put(CC_URL, {'advisory_max_tokens_per_day': 1000}, format='json')
        self.assertEqual(resp.status_code, 200)
        data = unwrapped(resp)
        for key in WANT:
            self.assertIn(key, data, f'PUT thieu {key}')
