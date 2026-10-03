"""
Native identity_access API route tests.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys
from unittest.mock import patch

_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from django.urls import resolve
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant
from identity_access.tests.envelope import is_envelope, unwrapped
from identity_access.views_tenant import (
    PATListView,
    ServiceAccountListView,
    partner_issue_pat,
    partner_revoke_pat,
    partner_rotate_pat,
)
from identity_access.views_auth import capabilities_view, login_view, profile_view, user_config_view


def _payload(response):
    """Mở payload 2xx của `identity_access` — chấp nhận **cả hai** hình dạng.

    ## Vì sao không dùng `unwrapped()` ở đây

    App này có **hai** hình dạng 2xx cùng lúc. Đo thật trên
    `/core/v1/auth/*` (2026-10-02):

    * `/auth/login/`, `/auth/token/refresh/` → `{status, timestamp, request_id, data}`
    * `/auth/me/`, `/access/capabilities/`, `/identity/profile/` → `{data, meta}`

    `unwrapped()` chỉ mở hình dạng `{data, meta}` — đúng quy tắc FE, có **cả**
    `data` và `meta` mới coi là envelope. Hình dạng thứ nhất do
    `success_response` (`identity_access/views/helpers.py:333`) sinh ra,
    **không** phải envelope B5, nên `unwrapped(login_response)` trả về body
    ngoài và `['token']` nổ `KeyError` ngay hôm nay. Đã chạy thật, không suy đoán.

    Vì vậy hàm này mở `data` khi có, còn không thì trả nguyên body: test không
    phụ thuộc hợp đồng nào.
    """
    body = getattr(response, 'data', response)
    if isinstance(body, dict) and isinstance(body.get('data'), dict):
        return body['data']
    return body


class IdentityAccessApiRouteTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(username='identity-owner', password='Test@123456', email='identity@example.com')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='identity-tenant-1',
            display_name='Identity Tenant',
            plan='pro',
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Identity Bot',
            scopes=['read:market', 'read:signals'],
        )
        self.credential, self.raw_pat = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='Identity PAT',
            audit_reason='tenant_admin_issue_pat',
        )

    def _login_and_authenticate(self):
        login_response = self.client.post(
            '/core/v1/auth/login/',
            {'username': self.user.username, 'password': 'Test@123456'},
            format='json',
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        login_data = _payload(login_response)
        self.assertIn('token', login_data)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_data['token']}")
        return login_response

    def test_login_me_capabilities_and_userconfig_routes_are_native(self):
        resolver_login = resolve('/core/v1/auth/login/')
        self.assertIs(resolver_login.func, login_view)

        login_response = self._login_and_authenticate()
        login_data = _payload(login_response)
        self.assertEqual(login_data['user']['username'], self.user.username)
        self.assertEqual(login_data['tenant']['tenant_code'], self.tenant.tenant_code)

        resolver_me = resolve('/core/v1/auth/me/')
        self.assertIs(resolver_me.func, profile_view)

        me_response = self.client.get('/core/v1/auth/me/')
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(me_response)['username'], self.user.username)
        self.assertIn('abilities', unwrapped(me_response))
        self.assertIn('entitlements', unwrapped(me_response))

        resolver_capabilities = resolve('/core/v1/access/capabilities/')
        self.assertIs(resolver_capabilities.func, capabilities_view)

        capabilities_response = self.client.get('/core/v1/access/capabilities/')
        self.assertEqual(capabilities_response.status_code, status.HTTP_200_OK)
        self.assertEqual(unwrapped(capabilities_response)['principal']['identity']['username'], self.user.username)
        self.assertEqual(unwrapped(capabilities_response)['build']['target'], 'saas')
        self.assertIn('abilities', unwrapped(capabilities_response))

        resolver_profile = resolve('/core/v1/identity/profile/')
        from identity_access.views_tenant import UserProfileView
        self.assertIs(resolver_profile.func.view_class, UserProfileView)

        userconfig_response = self.client.get('/core/v1/identity/profile/')
        self.assertEqual(userconfig_response.status_code, status.HTTP_200_OK)
        self.assertIn('whale_alert_threshold', unwrapped(userconfig_response))

    def test_partner_service_accounts_route_is_native(self):
        resolver_service_accounts = resolve('/core/v1/partner/service-accounts/')
        self.assertIs(resolver_service_accounts.func.view_class, ServiceAccountListView)

        login_response = self._login_and_authenticate()
        self.assertTrue(_payload(login_response)['access'])

        list_response = self.client.get('/core/v1/partner/service-accounts/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', list_response.data)
        self.assertEqual(list_response.data['results'][0]['name'], self.service_account.name)

    def test_partner_pat_routes_are_native_and_list_never_leaks_secret(self):
        resolver_pat_list = resolve('/core/v1/partner/pats/')
        self.assertIs(resolver_pat_list.func.view_class, PATListView)

        resolver_pat_issue = resolve('/core/v1/partner/pats/issue/')
        self.assertIs(resolver_pat_issue.func, partner_issue_pat)

        resolver_pat_rotate = resolve(f'/core/v1/partner/pats/{self.credential.public_id}/rotate/')
        self.assertIs(resolver_pat_rotate.func, partner_rotate_pat)

        resolver_pat_revoke = resolve(f'/core/v1/partner/pats/{self.credential.public_id}/revoke/')
        self.assertIs(resolver_pat_revoke.func, partner_revoke_pat)

        self._login_and_authenticate()

        list_response = self.client.get('/core/v1/partner/pats/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', list_response.data)

        target_item = next(
            item for item in list_response.data['results']
            if item['pat_id'] == self.credential.public_id
        )
        self.assertEqual(target_item['service_account_id'], self.service_account.public_id)
        self.assertEqual(target_item['tenant_id'], self.tenant.public_id)
        self.assertEqual(target_item['token_prefix'], self.credential.token_prefix)
        self.assertNotIn('secret', target_item)
        self.assertNotIn('token', target_item)

    def test_login_session_pat_has_expiry_and_refresh_rotates_secret(self):
        login_response = self.client.post(
            '/core/v1/auth/login/',
            {'username': self.user.username, 'password': 'Test@123456'},
            format='json',
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        login_data = _payload(login_response)
        original_token = login_data['token']

        credential = CorePATCredential.resolve_from_raw_secret(original_token)
        self.assertIsNotNone(credential)
        self.assertTrue(credential.is_human_session)
        self.assertIsNotNone(credential.expires_at)

        refresh_response = self.client.post(
            '/core/v1/auth/token/refresh/',
            {'refresh': original_token},
            format='json',
        )

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        refresh_data = _payload(refresh_response)
        self.assertNotEqual(refresh_data['token'], original_token)

        credential.refresh_from_db()
        self.assertEqual(credential.status, CorePATCredential.StatusChoices.REVOKED)

        old_token_client = APIClient()
        old_token_client.credentials(HTTP_AUTHORIZATION=f'Bearer {original_token}')
        old_profile_response = old_token_client.get('/core/v1/auth/me/')
        self.assertEqual(old_profile_response.status_code, status.HTTP_401_UNAUTHORIZED)


class LoginSuccessContractShapeTests(TestCase):
    """Chốt chặn: test này không được phụ thuộc hợp đồng envelope của login.

    Hai test dưới là **negative proof** cho việc bỏ `response.data['data']`:

    1. `test_assertions_survive_a_flat_success_contract` — ép `success_response`
       trả payload **phẳng** (không `data`, không `meta`). Bản cũ đọc thẳng
       `login_response.data['data']` nổ `KeyError`; bản sửa đọc qua `_payload`
       nên vẫn xanh. Đây chính là "app chưa bọc thì lại phải sửa" — chứng minh
       bằng code chạy được, không phải bằng lập luận.
    2. `test_login_success_shape_is_success_response_not_b5_envelope` — khoá lại
       sự thật đo được: body login **không** phải envelope B5 (thiếu `meta`), nên
       `unwrapped()` vốn **không** dùng được cho endpoint này. Không có test này
       thì lần sửa "cho đồng nhất" sau này sẽ làm hỏng cả file.

    Kế thừa `TestCase` chứ **không** kế thừa `IdentityAccessApiRouteTests`: nếu
    kế thừa, 4 test của lớp cha sẽ chạy lại lần nữa dưới tên lớp con.
    Fixture thì mượn lại qua `self` — không copy để hai chỗ không lệch nhau.
    """

    def setUp(self):
        IdentityAccessApiRouteTests.setUp(self)

    def _login(self):
        return IdentityAccessApiRouteTests._login_and_authenticate(self)

    def test_assertions_survive_a_flat_success_contract(self):
        def _flat_success_response(data, status_code=None, request=None, **kwargs):
            return Response(data, status=status_code or status.HTTP_200_OK)

        with patch('identity_access.views.login.success_response', _flat_success_response):
            login_response = self._login()

        self.assertNotIn('data', login_response.data)
        self.assertTrue(_payload(login_response)['access'])

    def test_login_success_shape_is_success_response_not_b5_envelope(self):
        login_response = self._login()

        self.assertFalse(
            is_envelope(login_response.data),
            f'body login doi hinh dang: {sorted(login_response.data)}')
        self.assertIn('request_id', login_response.data)
        self.assertEqual(
            unwrapped(login_response), login_response.data,
            'unwrapped() phai tra ve nguyen body khi khong co `meta`')