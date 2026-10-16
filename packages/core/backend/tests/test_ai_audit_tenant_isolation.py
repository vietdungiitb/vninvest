"""R0.7 (plan Rev.2): AIAuditLog user/tenant isolation + POST /ai/usage/ -> 405.

AC1: user A GET audit-logs KHONG thay log user B (2 user).
AC2: staff tenant A KHONG thay log tenant B (2 tenant, X-Tenant-ID + SSOT).
AC3: moi AIAuditLog.objects.create trong PAV deu truyen user= va tenant=
     (source-scan; rework test cu neu khang dinh hanh vi cu).
AC4: ?actor=admin KHONG tra log cua administrator (exact, khong icontains).
AC5: POST /core/v1/ai/usage/ -> 405 voi moi user (truoc fix: 201).

TDD fail-before: AC1/AC2 ERROR (model chua co FK user/tenant),
AC4 FAIL (icontains match), AC5 FAIL (201).
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
from rest_framework import status  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from advisory.models import AIAuditLog  # noqa: E402
from advisory.tests.envelope import unwrapped  # noqa: E402
from user_workspace.tests.tenant_test_helpers import grant_tenant  # noqa: E402

AUDIT_URL = '/core/v1/workspace/ai-command-center/audit-logs/'
USAGE_URL = '/core/v1/ai/usage/'


def _make_log(actor, user, tenant):
    return AIAuditLog.objects.create(
        action=AIAuditLog.ActionChoices.UPDATE_SETTINGS,
        actor=actor,
        user=user,
        tenant=tenant,
        reason='r07 isolation',
    )


class AuditTenantIsolationTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username='r07-a', password='x')
        self.user_b = User.objects.create_user(username='r07-b', password='x')
        self.staff = User.objects.create_user(
            username='r07-staff', password='x', is_staff=True
        )
        self.tenant_a = grant_tenant(self.user_a, role='editor', tenant_code='r07-ta')
        self.tenant_b = grant_tenant(self.user_b, role='editor', tenant_code='r07-tb')
        grant_tenant(self.staff, role='admin', tenant_code='r07-ta')
        _make_log('r07-a', self.user_a, self.tenant_a)
        _make_log('r07-b', self.user_b, self.tenant_b)

    def _get(self, user, **extra):
        client = APIClient()
        client.force_authenticate(user)
        return client.get(AUDIT_URL, **extra)

    def test_ac1_user_a_cannot_see_user_b_log(self):
        resp = self._get(self.user_a)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        actors = {row['actor'] for row in unwrapped(resp)['results']}
        self.assertIn('r07-a', actors)
        self.assertNotIn('r07-b', actors)

    def test_ac2_staff_tenant_a_cannot_see_tenant_b(self):
        resp = self._get(
            self.staff, HTTP_X_TENANT_ID=str(self.tenant_a.public_id)
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        actors = {row['actor'] for row in unwrapped(resp)['results']}
        self.assertIn('r07-a', actors)
        self.assertNotIn('r07-b', actors)

    def test_ac2_staff_with_other_tenant_hint_sees_nothing(self):
        resp = self._get(
            self.staff, HTTP_X_TENANT_ID=str(self.tenant_b.public_id)
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(resp)['total'], 0)

    def test_ac4_actor_filter_is_exact(self):
        _make_log('administrator', self.staff, self.tenant_a)
        resp = self._get(self.staff, data={'actor': 'admin'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(resp)['total'], 0)
        resp = self._get(self.staff, data={'actor': 'administrator'})
        self.assertEqual(unwrapped(resp)['total'], 1)

    def test_ac3_every_create_sets_user_and_tenant(self):
        """AC3: quet source PAV — moi create phai truyen user= va tenant=."""
        import re

        path = os.path.join(
            _src_dir, 'user_workspace', 'portfolio_analytics_views.py'
        )
        with open(path, encoding='utf-8') as fh:
            source = fh.read()
        blocks = re.split(r'AIAuditLog\.objects\.create\(', source)[1:]
        self.assertTrue(blocks, 'khong tim thay create nao')
        for i, block in enumerate(blocks):
            snippet = block[:1200]
            self.assertIn('user=', snippet, f'create #{i} thieu user=')
            self.assertIn('tenant=', snippet, f'create #{i} thieu tenant=')


class UsagePostRemovedTests(TestCase):
    def test_ac5_post_usage_returns_405(self):
        user = User.objects.create_user(username='r07-poster', password='x')
        client = APIClient()
        client.force_authenticate(user)
        resp = client.post(
            USAGE_URL,
            {'action': 'advisory', 'model': 'x', 'tokens_in': 999},
            format='json',
        )
        self.assertEqual(
            resp.status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
            f'POST usage phai 405, nhan {resp.status_code}: {resp.data}',
        )
