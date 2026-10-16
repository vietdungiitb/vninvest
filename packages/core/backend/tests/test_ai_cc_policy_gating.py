"""R0.9 (plan Rev.2): tach lop A/B + enforce ability + bo ai_config_message.

AC1: user thuong GET CC KHONG co `system_prompt_template`, co
     `system_policy.managed_by_platform = True`.
AC2: staff GET CC co `system_prompt_template`.
AC3: GET policy/ user thuong -> 403. AC4: PUT policy/ user thuong -> 403
     (staff 200 ca hai — control duong).
AC5: route list chua `ai-command-center` cho user thuong (helpers).
AC6: ability `ai.policy.manage` chi o staff.
AC7: `ai_config_message` khong con trong response (grep PAV = 0).
AC9: 8 test `test_ai_cc_config_isolation` xanh (chay rieng tren VPS).

TDD fail-before: AC1 FAIL (template lo), AC3/AC4 FAIL (route chua co -> 404),
AC5/AC6 FAIL (route/ability chua co), AC7 FAIL (2 hit).
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

from advisory.tests.envelope import unwrapped  # noqa: E402
from identity_access.views.helpers import _build_abilities, _build_navigation  # noqa: E402
from user_workspace.tests.tenant_test_helpers import grant_tenant  # noqa: E402

CC_URL = '/core/v1/workspace/ai-command-center/'
POLICY_URL = '/core/v1/workspace/ai-command-center/policy/'


class PolicyGatingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='r09-user', password='x')
        self.staff = User.objects.create_user(
            username='r09-staff', password='x', is_staff=True
        )
        grant_tenant(self.user, role='editor', tenant_code='r09-tenant')
        grant_tenant(self.staff, role='admin', tenant_code='r09-tenant')

    def _get_cc(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return unwrapped(client.get(CC_URL))

    def test_ac1_non_staff_get_has_no_system_template(self):
        data = self._get_cc(self.user)
        self.assertNotIn('system_prompt_template', data)
        self.assertTrue(data.get('system_policy', {}).get('managed_by_platform'))

    def test_ac2_staff_get_has_system_template(self):
        data = self._get_cc(self.staff)
        self.assertIn('system_prompt_template', data)

    def test_ac3_non_staff_policy_get_forbidden(self):
        client = APIClient()
        client.force_authenticate(self.user)
        resp = client.get(POLICY_URL)
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_ac4_non_staff_policy_put_forbidden(self):
        client = APIClient()
        client.force_authenticate(self.user)
        resp = client.put(
            POLICY_URL, {'system_prompt_template': 'x'}, format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_policy_get_put_allowed(self):
        client = APIClient()
        client.force_authenticate(self.staff)
        resp = client.get(POLICY_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        resp = client.put(
            POLICY_URL,
            {'system_prompt_template': 'r09 staff template {symbol}'},
            format='json',
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('system_prompt_template', unwrapped(resp))

    def test_ac5_navigation_contains_cc_for_regular_user(self):
        from identity_access.models import CoreTenant

        tenant = CoreTenant.objects.filter(tenant_code='r09-tenant').first()
        nav = _build_navigation(self.user, tenant)
        self.assertIn('ai-command-center', nav['visible_routes'])

    def test_ac6_policy_manage_ability_staff_only(self):
        from identity_access.models import CoreTenant

        tenant = CoreTenant.objects.filter(tenant_code='r09-tenant').first()
        staff_abilities = _build_abilities(self.staff, tenant)
        self.assertIn(
            {'action': 'manage', 'subject': 'ai.policy.manage'}, staff_abilities
        )
        user_abilities = _build_abilities(self.user, tenant)
        self.assertNotIn(
            {'action': 'manage', 'subject': 'ai.policy.manage'}, user_abilities
        )

    def test_ac7_no_ai_config_message_in_responses(self):
        for user in (self.user, self.staff):
            data = self._get_cc(user)
            self.assertNotIn('ai_config_message', data)

    def test_ac7_grep_no_ai_config_message_in_pav(self):
        path = os.path.join(
            _src_dir, 'user_workspace', 'portfolio_analytics_views.py'
        )
        with open(path, encoding='utf-8') as fh:
            source = fh.read()
        self.assertNotIn('ai_config_message', source)
