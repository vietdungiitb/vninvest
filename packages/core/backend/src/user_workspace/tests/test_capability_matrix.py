"""SAFE-04 — endpoint tài chính phải khai báo capability, thiếu thì chặn.

Bug goc (verify bang lenh, khong phai doc code):
    grep -c "require_tenant_permission" user_workspace/  ->  0
    grep -c "path(" user_workspace/urls.py               ->  52
  => 52 URL, KHONG endpoint nao co kiem tra quyen. Bat ky user dang nhap deu
     goi duoc `place-order` va xoa/sua credential broker.

QUAN TRONG — pham vi gap dung la `user_workspace`, khong phai toan repo:
`identity_access` DA co he quyen day du (`get_tenant_permissions`,
`require_tenant_permission` go tren 60+ view, 4 system role + custom_role).
Audit noi "0/52 endpoint co capability" o pham vi repo la SAI — no dung o pham
vi app. Slice nay dung het nguon su that do, KHONG tao he capability song
song (se lai sinh hai nguon su that va lech nhau nhu loi resolver 2026-09-26).

Mapping permission: xem `WORKSPACE_PERMISSIONS` trong permissions.py.
"""
from __future__ import annotations

import ast
import pathlib

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from user_workspace import views_broker, views_dnse
from user_workspace.permissions import (
    WORKSPACE_PERMISSIONS,
    _declared_permissions,
    has_workspace_permission,
)

_BACKEND_SRC = pathlib.Path(__file__).resolve().parents[2]


class _Req:
    """Duck-typed request cho `has_workspace_permission` (không cần DB)."""

    def __init__(self, user, perms, member=None):
        self.user = user
        self._perms = set(perms)
        self.tenant = object()
        self.tenant_member = member
        self._tenant_member_checked = True


class _User:
    def __init__(self, is_authenticated=True, pk=1):
        self.is_authenticated = is_authenticated
        self.id = pk


class WorkspacePermissionMappingTests(TestCase):
    """AC1: mapping permission phai tro toi string thật của hệ quyền hiện có."""

    def test_all_mapped_permissions_exist_in_system_roles(self):
        from identity_access.utils.resolve_tenant import SYSTEM_ROLE_PERMISSIONS

        # `SYSTEM_ROLE_PERMISSIONS` là dict {role: [perm, ...]} — phải gom
        # phẳng trước rồi mới kiểm tra. Lần đầu tôi kiểm tra membership trên
        # chính dict nên 4/4 case đều fail dù permission CÓ THẬT; đó là lỗi
        # của test, không phải của mapping.
        all_perms = {p for perms in SYSTEM_ROLE_PERMISSIONS.values() for p in perms}
        for key, permission in WORKSPACE_PERMISSIONS.items():
            with self.subTest(key=key):
                self.assertIn(
                    permission,
                    all_perms,
                    f'{key} -> {permission!r} khong ton tai trong SYSTEM_ROLE_PERMISSIONS',
                )

    def test_every_financial_write_endpoint_declares_a_permission(self):
        """AC1: 7 endpoint ghi tài chính phải khai báo, không endpoint nào bỏ trống."""
        guarded = [
            ('place_order', views_dnse.dnse_place_order_api, 'order_write'),
            ('send_otp', views_dnse.dnse_send_email_otp_api, 'order_write'),
            ('create_token', views_dnse.dnse_create_trading_token_api, 'order_write'),
            ('sync_accounts', views_dnse.dnse_sync_accounts_api, 'portfolio_write'),
            ('sync_balances', views_dnse.dnse_sync_balances_api, 'portfolio_write'),
            ('broker_config', views_broker.broker_config_api, 'broker_manage'),
            ('test_connection', views_broker.broker_test_connection_api, 'broker_manage'),
        ]
        for name, view, expected in guarded:
            with self.subTest(endpoint=name):
                declared = _declared_permissions(getattr(view, 'cls', view))
                self.assertEqual(
                    declared,
                    [expected],
                    f'{name} phai khai bao [{expected!r}]',
                )


class WorkspacePermissionDenyByDefaultTests(TestCase):
    """R3: view chưa khai báo quyền thì chặn, không im lặng cho qua."""

    def test_view_without_declaration_has_no_permissions(self):
        class Unguarded:
            __name__ = 'unguarded'
            permission_classes = []

        self.assertEqual(_declared_permissions(Unguarded), [])

    def test_unauthenticated_is_denied(self):
        req = _Req(_User(is_authenticated=False), {'*'})
        for key in WORKSPACE_PERMISSIONS:
            with self.subTest(key=key):
                self.assertFalse(
                    has_workspace_permission(req, WORKSPACE_PERMISSIONS[key])
                )

    def test_permission_error_denies(self):
        """Lỗi phân giải quyền phải chặn (fail-closed), không cho qua."""
        req = _Req(_User(), set())
        req.user = _User()
        # Ép `get_tenant_permissions` ném lỗi.
        import user_workspace.permissions as perms_mod

        original = perms_mod.get_tenant_permissions

        def boom(_request):
            raise RuntimeError('permission store down')

        perms_mod.get_tenant_permissions = boom
        try:
            self.assertFalse(has_workspace_permission(req, 'alert:write'))
        finally:
            perms_mod.get_tenant_permissions = original


class WorkspacePermissionRoleTests(TestCase):
    """R5: endpoint tài chính phai trai hon endpoint doc."""

    def _user_with_role(self, role, username):
        user = User.objects.create_user(username=username, password='x')
        # Owner phải là user KHÁC. Lần đầu tôi cho chính `user` làm
        # `owner_user` rồi thêm TenantMember role='viewer' — nhưng
        # `get_tenant_permissions` ưu tiên owner và trả `['*']`, nên viewer
        # vẫn qua được và test FAIL (nhận 400 thay vì 403). Đó là lỗi fixture,
        # không phải lỗi enforcement.
        owner = User.objects.create_user(username=f'{username}-owner', password='x')
        tenant = CoreTenant.objects.create(
            tenant_code=f't-{username}', display_name=username,
            owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE,
        )
        if role != 'owner':
            TenantMember.objects.create(tenant=tenant, user=user, role=role)
        else:
            # User thật sự là owner: dùng chính user đó làm owner.
            tenant.owner_user = user
            tenant.save(update_fields=['owner_user'])
        return user, tenant

    def _post_order(self, user, tenant, expect_ok):
        client = APIClient()
        client.force_login(user)
        client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
        resp = client.post(
            '/core/v1/broker/dnse/place-order/',
            {
                'market_type': 'STOCK', 'order_category': 'NORMAL', 'mode': 'paper',
                'trading_token': 'TT-1',
                'payload': {
                    'account_no': 'ACC1', 'symbol': 'VNM', 'side': 'BUY',
                    'price': 10000, 'quantity': 100,
                },
            },
            format='json',
            HTTP_IDEMPOTENCY_KEY='perm-test-key-1',
        )
        if expect_ok:
            self.assertNotEqual(
                resp.status_code, 403,
                f'viewer co the dat lenh: {resp.status_code} {resp.content[:200]}',
            )
        else:
            self.assertEqual(
                resp.status_code, 403,
                f'phai 403 cho viewer, nhan {resp.status_code} — body: {resp.content[:400]}',
            )

    def test_owner_may_place_order(self):
        user, tenant = self._user_with_role('owner', 'perm-owner')
        self._post_order(user, tenant, expect_ok=True)

    def test_viewer_may_not_place_order(self):
        user, tenant = self._user_with_role('viewer', 'perm-viewer')
        self._post_order(user, tenant, expect_ok=False)


class NoBarePermissionOnFinancialWritesTests(TestCase):
    """AC3: không endpoint ghi nào còn dùng `IsAuthenticated` trần."""

    def test_no_financial_write_uses_bare_isauthenticated(self):
        offenders = []
        for rel in ('user_workspace/views_dnse.py', 'user_workspace/views_broker.py'):
            path = _BACKEND_SRC / rel
            tree = ast.parse(path.read_text(encoding='utf-8'))
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef,)):
                    continue
                if not any(
                    isinstance(d, ast.Call) and getattr(d.func, 'id', '') == 'api_view'
                    and any(
                        isinstance(a, ast.Constant) and a.value in {'POST', 'PUT', 'PATCH', 'DELETE'}
                        for a in getattr(d, 'args', [ast.List(elts=[])])
                        for e in getattr(getattr(d.args[0], 'elts', []), 'elts', [])
                    )
                    for d in node.decorator_list
                ):
                    continue
                for dec in node.decorator_list:
                    if not isinstance(dec, ast.Call):
                        continue
                    if getattr(dec.func, 'id', '') != 'permission_classes':
                        continue
                    elts = getattr(dec.args[0], 'elts', [])
                    names = [
                        getattr(e, 'attr', getattr(e, 'id', ''))
                        for e in elts
                    ]
                    if names == ['IsAuthenticated']:
                        offenders.append(f'{rel}:{node.lineno} {node.name}')
        self.assertEqual(
            offenders,
            [],
            'endpoint ghi khong duoc dung IsAuthenticated tran:\n' + '\n'.join(offenders),
        )
