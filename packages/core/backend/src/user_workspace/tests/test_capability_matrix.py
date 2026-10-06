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
from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember
from user_workspace import views_broker, views_dnse
from user_workspace.models import Portfolio, SubAccount, Transaction
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
        """AC1: 8 endpoint ghi tài chính phải khai báo, không endpoint nào bỏ trống."""
        guarded = [
            ('place_order', views_dnse.dnse_place_order_api, 'order_write'),
            ('send_otp', views_dnse.dnse_send_email_otp_api, 'order_write'),
            ('create_token', views_dnse.dnse_create_trading_token_api, 'order_write'),
            ('sync_accounts', views_dnse.dnse_sync_accounts_api, 'portfolio_write'),
            ('sync_balances', views_dnse.dnse_sync_balances_api, 'portfolio_write'),
            ('reconcile', views_dnse.dnse_reconcile_transactions_api, 'portfolio_write'),
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

    def test_no_write_key_maps_to_a_read_permission(self):
        """P0 regression: key `*_write` / `*_manage` KHÔNG được trỏ tới quyền đọc.

        `portfolio_write` từng trỏ `dashboard:read` — cùng chuỗi với
        `portfolio_read` — nên `viewer` (chỉ có `dashboard:read`) đi qua
        được cả 8 endpoint ghi tài chính. Đây là leo thang đặc quyền, nên
        phải chặn bằng test chứ không chỉ bằng đọc code.
        """
        from identity_access.utils.resolve_tenant import SYSTEM_ROLE_PERMISSIONS

        for key, permission in WORKSPACE_PERMISSIONS.items():
            if not (key.endswith('_write') or key.endswith('_manage')):
                continue
            with self.subTest(key=key):
                self.assertFalse(
                    permission.endswith((':read', ':list')),
                    f'{key} -> {permission!r} la quyen DOC, khong the bao ve endpoint ghi',
                )

    def test_viewer_permissions_do_not_cover_any_write_key(self):
        """`viewer` phải bị chặn ở MỌI key ghi, không riêng endpoint đặt lệnh."""
        from identity_access.utils.resolve_tenant import SYSTEM_ROLE_PERMISSIONS

        viewer = set(SYSTEM_ROLE_PERMISSIONS['viewer'])
        for key, permission in WORKSPACE_PERMISSIONS.items():
            if not (key.endswith('_write') or key.endswith('_manage')):
                continue
            with self.subTest(key=key):
                self.assertNotIn(
                    permission, viewer,
                    f'viewer co {permission!r} nen {key} khong con chan viewer',
                )

    def test_editor_keeps_portfolio_and_order_write(self):
        """Đổi mapping không được khóa cứng nhầm `editor` ra khỏi ghi danh sách.

        Chỉ kiểm tra 2 key mà `editor` PHẢI có. `broker_manage` cố ý là
        admin/owner-only (`settings:write` không nằm trong `editor`) — đó là
        thiết kế có sẵn, không phải hệ quả của thay đổi này.
        """
        from identity_access.utils.resolve_tenant import SYSTEM_ROLE_PERMISSIONS

        editor = set(SYSTEM_ROLE_PERMISSIONS['editor'])
        for key in ('portfolio_write', 'order_write'):
            with self.subTest(key=key):
                self.assertIn(WORKSPACE_PERMISSIONS[key], editor)

    def test_admin_keeps_every_write_key(self):
        from identity_access.utils.resolve_tenant import SYSTEM_ROLE_PERMISSIONS

        admin = set(SYSTEM_ROLE_PERMISSIONS['admin'])
        for key, permission in WORKSPACE_PERMISSIONS.items():
            if not (key.endswith('_write') or key.endswith('_manage')):
                continue
            with self.subTest(key=key):
                self.assertIn(permission, admin)


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
    """AC3: khong endpoint ghi tai chinh nao con dung `IsAuthenticated` tran.

    Viet lai de quet CLASS-BASED VIEW. Ban dau chi loc `ast.FunctionDef` co
    decorator `@api_view`, nhung cac endpoint ghi tai chinh trong `views.py` la
    class-based (`permission_classes` la class attribute). Them `views.py` vao
    danh sach quet se ra 0 ham khop => offenders luon rong => test xanh im lang
    trong khi 10 write method van ho. Do do nay quet `ast.ClassDef`, doc
    `permission_classes` tu class attribute, va co test phu bao dam bo loc khong
    bao gio kiem 0 doi tuong.
    """

    WRITE_METHODS = {'post', 'put', 'patch', 'delete'}

    # Chi gui bang tien/vi tri - phai co kiem quyen.
    FINANCIAL_CLASSES = {
        'PortfolioListCreateView',
        'PortfolioDetailView',
        'TransactionListCreateView',
        'TransactionDetailView',
        'SubAccountListCreateAPIView',
        'SubAccountDetailAPIView',
        'SubAccountTransactionsAPIView',
    }

    SCANNED_FILES = (
        'user_workspace/views.py',
        'user_workspace/views_dnse.py',
        'user_workspace/views_broker.py',
        'user_workspace/portfolio_analytics_views.py',
    )

    def _class_permission_names(self, node):
        """Ten permission khai bao trong `permission_classes = [...]` cua class."""
        names = []
        for stmt in node.body:
            if not isinstance(stmt, ast.Assign):
                continue
            for target in stmt.targets:
                if isinstance(target, ast.Name) and target.id == 'permission_classes':
                    for elt in getattr(stmt.value, 'elts', []):
                        if isinstance(elt, ast.Name):
                            names.append(elt.id)
                        elif isinstance(elt, ast.Attribute):
                            names.append(elt.attr)
        return names

    def _declared_permission_keys(self, node):
        """Ten khai bao qua `@required_workspace_permission('portfolio_write')`."""
        keys = []
        for dec in node.decorator_list:
            if not isinstance(dec, ast.Call):
                continue
            fn = dec.func
            name = fn.id if isinstance(fn, ast.Name) else getattr(fn, 'attr', None)
            if name != 'required_workspace_permission':
                continue
            for arg in dec.args:
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    keys.append(arg.value)
        return keys

    def _write_classes(self, rel):
        path = _BACKEND_SRC / rel
        tree = ast.parse(path.read_text(encoding='utf-8'))
        found = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef):
                continue
            bases = [ast.unparse(b) for b in node.bases]
            if not any('View' in b for b in bases):
                continue
            methods = {
                m.name for m in node.body
                if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef))
                and m.name in self.WRITE_METHODS
            }
            if methods:
                found.append((node, sorted(methods)))
        return found

    def test_financial_write_classes_are_scanned(self):
        """BAO DAM bo loc khong kiem 0 doi tuong (hazard: gate xanh im lang)."""
        seen = {}
        for rel in self.SCANNED_FILES:
            for node, methods in self._write_classes(rel):
                seen.setdefault(rel, set()).add(node.name)

        views_classes = seen.get('user_workspace/views.py', set())
        missing = self.FINANCIAL_CLASSES - views_classes
        self.assertEqual(
            missing, set(),
            f'bo loc khong quet toi cac class ghi tai chinh: {sorted(missing)} '
            f'(thay doi ten class => gate co the dang quet 0 doi tuong)',
        )

    def test_no_financial_write_uses_bare_isauthenticated(self):
        offenders = []
        for rel in self.SCANNED_FILES:
            for node, methods in self._write_classes(rel):
                if node.name not in self.FINANCIAL_CLASSES:
                    continue
                names = self._class_permission_names(node)
                if names == ['IsAuthenticated'] or 'WorkspacePermission' not in names:
                    offenders.append(
                        f'{rel}:{node.lineno} {node.name} {methods} -> {names}'
                    )
        self.assertEqual(
            offenders, [],
            'endpoint ghi tai chinh phai co WorkspacePermission:\n' + '\n'.join(offenders),
        )

    def test_financial_write_classes_declare_required_permission(self):
        """`WorkspacePermission` deny-by-default: thieu decorator thi kiem tra
        `required_workspace_permission` rong => `has_permission` tra False cho
        MOI role, ke ca owner. Gate phai bat ca hai ve."""
        offenders = []
        for rel in self.SCANNED_FILES:
            for node, methods in self._write_classes(rel):
                if node.name not in self.FINANCIAL_CLASSES:
                    continue
                if 'portfolio_write' not in self._declared_permission_keys(node):
                    offenders.append(
                        f'{rel}:{node.lineno} {node.name} {methods}'
                    )
        self.assertEqual(
            offenders, [],
            'endpoint ghi tai chinh phai khai '
            "@required_workspace_permission('portfolio_write'):\n" + '\n'.join(offenders),
        )

    def test_permission_order_keeps_tenant_scope_first(self):
        """`WorkspacePermission` goi `get_tenant_permissions(request)`, can
        `request.tenant` san. `TenantScopePermission` phai chay truoc; bo no di
        thi `views.py` luu `tenant=None`."""
        offenders = []
        expected_tail = ['TenantScopePermission', 'WorkspacePermission']
        for rel in self.SCANNED_FILES:
            for node, methods in self._write_classes(rel):
                if node.name not in self.FINANCIAL_CLASSES:
                    continue
                names = self._class_permission_names(node)
                if names[-2:] != expected_tail:
                    offenders.append(f'{rel}:{node.lineno} {node.name} -> {names}')
        self.assertEqual(offenders, [], '\n'.join(offenders))


class PortfolioWriteCapabilityTests(TestCase):
    """AC1 runtime: `viewer` khong tao/sua/xoa duoc Portfolio hay Transaction.

    Gate AST o `NoBarePermissionOnFinancialWritesTests` chi khai bao la dung; lop
    nay chung minh HANG QUA HTTP — 403 va database khong doi mot dong nao. Khong co
    test runtime thi mot khai bao sai (sai ten decorator, sai thu tu permission)
    van xanh.
    """

    def _member_in_tenant(self, username, role):
        """Owner va member la hai user KHAC nhau.

        `get_tenant_permissions` uu tien `owner` va tra `['*']`. Neu dung chinh
        user lam owner roi them `TenantMember` role='viewer', permission tra
        `['*']` va test viewer FAIL nham (nhan 403 dung, nhung editor cung bi
        cho qua) — day la loi fixture, khong phai loi enforcement.
        """
        user = User.objects.create_user(username=username, password='x')
        owner = User.objects.create_user(username=f'{username}-owner', password='x')
        tenant = CoreTenant.objects.create(
            tenant_code=f't-{username}', display_name=username,
            owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE,
        )
        if role == 'owner':
            # User thật sự là owner: trỏ `owner_user` vào chính user đó.
            tenant.owner_user = user
            tenant.save(update_fields=['owner_user'])
        else:
            # Tao `TenantMember` truc tiep voi role cuoi cung. Dung
            # `.update()` sau se khong xoa cache quyen neu co, va test editor
            # nhan 403 that du editor co `sa:write`.
            TenantMember.objects.create(tenant=tenant, user=user, role=role)
        return user, tenant

    def _client(self, user, tenant):
        client = APIClient()
        client.force_login(user)
        client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
        return client

    def _seed_portfolio(self, owner_of_row, tenant):
        return Portfolio.objects.create(name='seed', tenant=tenant, user=owner_of_row)

    def test_viewer_cannot_create_portfolio(self):
        user, tenant = self._member_in_tenant('perm-vp-create', 'viewer')
        client = self._client(user, tenant)
        before = Portfolio.objects.filter(tenant=tenant).count()
        resp = client.post(
            '/core/v1/workspace/portfolios/',
            {'name': 'viewer-made-this', 'opening_balance': '1000',
             'opening_balance_source': 'user_input'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403, f'nhan {resp.status_code}: {resp.content[:300]}')
        self.assertEqual(Portfolio.objects.filter(tenant=tenant).count(), before)
        self.assertFalse(Portfolio.objects.filter(name='viewer-made-this').exists())

    def test_viewer_cannot_create_transaction(self):
        user, tenant = self._member_in_tenant('perm-vp-tx', 'viewer')
        owner = tenant.owner_user
        portfolio = self._seed_portfolio(owner, tenant)
        client = self._client(user, tenant)
        before = Transaction.objects.filter(portfolio=portfolio).count()
        resp = client.post(
            f'/core/v1/workspace/portfolios/{portfolio.pk}/transactions/',
            {
                'symbol': 'VNM', 'transaction_type': 'BUY', 'date': '2026-01-05',
                'price': '15000', 'quantity': 100, 'fee': '0', 'tax': '0',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 403, f'nhan {resp.status_code}: {resp.content[:300]}')
        self.assertEqual(Transaction.objects.filter(portfolio=portfolio).count(), before)

    def test_viewer_cannot_patch_portfolio_opening_balance(self):
        user, tenant = self._member_in_tenant('perm-vp-patch', 'viewer')
        owner = tenant.owner_user
        portfolio = self._seed_portfolio(owner, tenant)
        client = self._client(user, tenant)
        resp = client.patch(
            f'/core/v1/workspace/portfolios/{portfolio.pk}/',
            {'opening_balance': '999999', 'opening_balance_source': 'user_input'},
            format='json',
        )
        self.assertEqual(resp.status_code, 403, f'nhan {resp.status_code}: {resp.content[:300]}')
        portfolio.refresh_from_db()
        self.assertIsNone(portfolio.opening_balance)

    def test_viewer_cannot_delete_subaccount(self):
        user, tenant = self._member_in_tenant('perm-vp-sub', 'viewer')
        owner = tenant.owner_user
        portfolio = self._seed_portfolio(owner, tenant)
        sub = SubAccount.objects.create(
            user=owner, portfolio=portfolio, tenant=tenant, broker='dnse',
            account_number='ACC-1', name='sub', type='1',
        )
        client = self._client(user, tenant)
        resp = client.delete(f'/core/v1/portfolio/subaccounts/{sub.pk}/')
        self.assertEqual(resp.status_code, 403, f'nhan {resp.status_code}: {resp.content[:300]}')
        self.assertTrue(SubAccount.objects.filter(pk=sub.pk).exists())

    def test_editor_may_create_transaction(self):
        """Chac chan khong phai khoa het: `editor` co `sa:write` phai tao duoc.

        Portfolio phai thuoc chinh `user` dang goi: `_get_portfolio_or_404` loc
        theo `user=request.user`, nen danh muc cua user khac tra 404 du quyen
        hop le. Do la hanh vi so huu hien hanh, khong phai thuoc ve P0-1.
        """
        user, tenant = self._member_in_tenant('perm-vp-editor', 'editor')
        portfolio = self._seed_portfolio(user, tenant)
        client = self._client(user, tenant)
        resp = client.post(
            f'/core/v1/workspace/portfolios/{portfolio.pk}/transactions/',
            {
                'symbol': 'VNM', 'transaction_type': 'BUY', 'date': '2026-01-05',
                'price': '15000', 'quantity': 100, 'fee': '0', 'tax': '0',
            },
            format='json',
        )
        self.assertIn(resp.status_code, (200, 201), f'nhan {resp.status_code}: {resp.content[:300]}')
        self.assertTrue(Transaction.objects.filter(portfolio=portfolio).exists())


class OpeningBalanceWritePathTests(TestCase):
    """AC2: `opening_balance` co duong ghi qua API, khong con `nav: null` vinh vien."""

    def _owner_client(self, username):
        user = User.objects.create_user(username=username, password='x')
        tenant = CoreTenant.objects.create(
            tenant_code=f't-{username}', display_name=username,
            owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
        )
        client = APIClient()
        client.force_login(user)
        client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
        return user, tenant, client

    def test_opening_balance_is_persisted_and_yields_numeric_nav(self):
        user, tenant, client = self._owner_client('ob-write')
        created = client.post(
            '/core/v1/workspace/portfolios/',
            {'name': 'with-balance', 'opening_balance': '1000000000',
             'opening_balance_source': 'migration_0022'},
            format='json',
        )
        self.assertIn(created.status_code, (200, 201), created.content[:300])
        portfolio = Portfolio.objects.get(name='with-balance', tenant=tenant)
        self.assertEqual(str(portfolio.opening_balance), '1000000000.00')

        summary = client.get(f'/core/v1/workspace/portfolios/{portfolio.pk}/summary/')
        self.assertEqual(summary.status_code, 200, summary.content[:300])
        body = summary.json()
        payload = body.get('data', body)
        self.assertIsNotNone(
            payload.get('nav'),
            f'nav van null: {body}. opening_balance da duoc ghi nhung nav chua tinh.',
        )

    def test_negative_opening_balance_is_rejected(self):
        _user, _tenant, client = self._owner_client('ob-negative')
        resp = client.post(
            '/core/v1/workspace/portfolios/',
            {'name': 'negative', 'opening_balance': '-1',
             'opening_balance_source': 'user_input'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400, f'nhan {resp.status_code}: {resp.content[:300]}')
        self.assertFalse(Portfolio.objects.filter(name='negative').exists())

    def test_opening_balance_without_source_is_rejected(self):
        """Con so khong ro nguon goc khong con truy vet duoc sau nay."""
        _user, _tenant, client = self._owner_client('ob-nosource')
        resp = client.post(
            '/core/v1/workspace/portfolios/',
            {'name': 'no-source', 'opening_balance': '5000'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400, f'nhan {resp.status_code}: {resp.content[:300]}')
        self.assertFalse(Portfolio.objects.filter(name='no-source').exists())


class SafeMethodNotWriteLockedTests(TestCase):
    """B4 — `WorkspacePermission` phai CHI khoa method ghi.

    Ban dau ap `portfolio_write` cho ca class nen `get()` cua list/detail view
    cung bi khoa: `viewer` co `dashboard:read` nhung khong co `sa:write`, va
    `WORKSPACE_PERMISSIONS['portfolio_read']` thanh khoa chet. Do la hoi quy
    kha nang doc — nguoi dung mat quyen doc danh muc cua chinh minh.
    """

    def _member(self, username, role):
        user = User.objects.create_user(username=username, password='x')
        owner = User.objects.create_user(username=f'{username}-owner', password='x')
        tenant = CoreTenant.objects.create(
            tenant_code=f't-{username}', display_name=username,
            owner_user=owner, status=CoreTenant.StatusChoices.ACTIVE,
        )
        TenantMember.objects.create(tenant=tenant, user=user, role=role)
        return user, tenant

    def _client(self, user, tenant):
        client = APIClient()
        client.force_login(user)
        client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
        return client

    def test_viewer_can_still_read_portfolios(self):
        user, tenant = self._member('sm-viewer', 'viewer')
        Portfolio.objects.create(
            name='p', tenant=tenant, user=user,
            opening_balance=Decimal('1000'), opening_balance_source='fixture',
        )
        client = self._client(user, tenant)
        resp = client.get('/core/v1/workspace/portfolios/')
        self.assertEqual(
            resp.status_code, 200,
            f'viewer mat quyen DOC danh muc: {resp.status_code} {resp.content[:250]}',
        )

    def test_viewer_can_still_read_transactions(self):
        user, tenant = self._member('sm-viewer-tx', 'viewer')
        portfolio = Portfolio.objects.create(
            name='p', tenant=tenant, user=user,
            opening_balance=Decimal('1000'), opening_balance_source='fixture',
        )
        Transaction.objects.create(
            portfolio=portfolio, tenant=tenant, symbol='VNM',
            transaction_type='BUY', date=date(2026, 1, 5),
            price=Decimal('10000'), quantity=100,
        )
        client = self._client(user, tenant)
        resp = client.get(f'/core/v1/workspace/portfolios/{portfolio.pk}/transactions/')
        self.assertEqual(
            resp.status_code, 200,
            f'viewer mat quyen DOC giao dich: {resp.status_code} {resp.content[:250]}',
        )

    def test_viewer_is_still_blocked_from_writing(self):
        """B4 khong duoc sua thanh "mo cho tat ca"."""
        user, tenant = self._member('sm-viewer-w', 'viewer')
        client = self._client(user, tenant)
        resp = client.post(
            '/core/v1/workspace/portfolios/', {'name': 'x'}, format='json',
        )
        self.assertEqual(resp.status_code, 403, resp.content[:250])


class OpeningBalanceValidationScopeTests(TestCase):
    """M2/M3 — validator dung pham vi va khop `max_length` cua cot DB."""

    def _owner(self, username):
        user = User.objects.create_user(username=username, password='x')
        tenant = CoreTenant.objects.create(
            tenant_code=f't-{username}', display_name=username,
            owner_user=user, status=CoreTenant.StatusChoices.ACTIVE,
        )
        client = APIClient()
        client.force_login(user)
        client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
        return user, tenant, client

    def test_source_longer_than_db_column_is_400_not_500(self):
        """M2: serializer `max_length=64` vs cot DB `varchar(32)` cho HTTP 500."""
        _u, _t, client = self._owner('ob-long')
        resp = client.post(
            '/core/v1/workspace/portfolios/',
            {'name': 'x', 'opening_balance': '1000',
             'opening_balance_source': 'a' * 33},
            format='json',
        )
        self.assertEqual(
            resp.status_code, 400,
            f'nguon qua dai phai la 400, nhan {resp.status_code}: {resp.content[:250]}',
        )

    def test_unrelated_patch_is_not_blocked_by_missing_source(self):
        """M3: danh muc so du co, nguon rong — PATCH doi TEN van phai chay."""
        user, tenant, client = self._owner('ob-rename')
        portfolio = Portfolio.objects.create(
            name='old', tenant=tenant, user=user,
            opening_balance=Decimal('1000000'), opening_balance_source='',
        )
        resp = client.patch(
            f'/core/v1/workspace/portfolios/{portfolio.pk}/',
            {'name': 'new'}, format='json',
        )
        self.assertEqual(
            resp.status_code, 200,
            f'PATCH doi ten bi chan oi: {resp.status_code} {resp.content[:250]}',
        )
        portfolio.refresh_from_db()
        self.assertEqual(portfolio.name, 'new')

    def test_setting_balance_without_source_is_rejected(self):
        _u, _t, client = self._owner('ob-nosrc2')
        resp = client.post(
            '/core/v1/workspace/portfolios/',
            {'name': 'x', 'opening_balance': '1000'}, format='json',
        )
        self.assertEqual(resp.status_code, 400, resp.content[:250])
