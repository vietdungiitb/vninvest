"""SAFE-04 — `portfolio_analytics_views.py`: 15 endpoint ghi thiếu khai báo quyền.

Bug gốc (đo bằng lệnh, không suy từ đọc code):
    grep -c "def (post|put|patch|delete)" portfolio_analytics_views.py  ->  15
    grep -c "required_workspace_permission" portfolio_analytics_views.py -> 0
    grep -c "WorkspacePermission"         portfolio_analytics_views.py -> 0
    => 15 endpoint ghi, KHÔNG endpoint nào có kiểm tra quyền. Chỉ cần đăng
       nhập là ghi được (portfolio/screener/user-config/AI command center).

Vì sao gate cũ không bắt được: `test_capability_matrix.py` khai báo danh sách
view **viết tay** (`views_dnse.dnse_place_order_api`, `views_broker.*`) — không
quét file. `portfolio_analytics_views.py` không nằm trong danh sách đó nên
lọt. File này quét **theo AST** để không tái diễn lỗi đó.

Mapping permission: xem `WORKSPACE_PERMISSIONS` (`permissions.py:30`).

Quy ước: method an toàn (GET/HEAD/OPTIONS) KHÔNG cần khai báo — xem
`WorkspacePermission.SAFE_METHODS`. Chỉ method ghi mới bắt buộc.
"""
from __future__ import annotations

import ast
import pathlib

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from identity_access.models import CoreTenant  # noqa: F401 - used in docstring refs
from user_workspace import portfolio_analytics_views as pav
from user_workspace.permissions import WORKSPACE_PERMISSIONS, WorkspacePermission, _declared_permissions
from user_workspace.tests.tenant_test_helpers import grant_tenant

_PA_VIEWS = pathlib.Path(__file__).resolve().parents[1] / 'portfolio_analytics_views.py'

#: Method theo AST = method ghi. Khớp `WorkspacePermission.SAFE_METHODS`
#: (`permissions.py:118`) là phần bù của nó.
_WRITE_METHODS = ('post', 'put', 'patch', 'delete')

#: Endpoint ghi -> khoá workspace phải khai báo.
#:
#: Chọn theo nghiệp vụ, KHÔNG theo tên class:
#: - `portfolio_*`   : ghi danh mục / giao dịch        -> portfolio_write
#: - `order_*`       : sinh rủi ro tài chính trực tiếp -> order_write
#: - `broker_manage` : cấu hình / credential broker    -> broker_manage
EXPECTED: dict[str, str] = {
    # Đồng bộ portfolio từ broker (ghi dữ liệu tài chính).
    'PortfolioSyncView.post': 'portfolio_write',
    # AI advisory: refresh tạo lượt gọi provider (có chi phí + ghi log).
    'PortfolioAIAdvisoryRefreshView.post': 'portfolio_write',
    # AI Command Center: sửa prompt config của toàn tenant.
    'PortfolioAICommandCenterView.put': 'portfolio_write',
    'PortfolioAICommandCenterPromptConfigRollbackView.post': 'portfolio_write',
    # Test connection: gọi provider thật (tiêu token, lộ endpoint).
    'PortfolioAICommandCenterTestView.post': 'broker_manage',
    # User config legacy: ghi cấu hình người dùng trong tenant.
    'PortfolioUserConfigLegacyView.patch': 'portfolio_write',
    # Screener rule: cấu hình + chạy bộ lọc tự động.
    'PortfolioScreenerRuleDetailView.put': 'portfolio_write',
    'PortfolioScreenerRuleDetailView.delete': 'portfolio_write',
    'PortfolioScreenerRuleRunView.post': 'portfolio_write',
    # Screener schedule: lịch chạy tự động (ghi thêm khi lên lịch).
    'ScreenerScheduleListCreateView.post': 'portfolio_write',
    'ScreenerScheduleDetailView.put': 'portfolio_write',
    'ScreenerScheduleDetailView.delete': 'portfolio_write',
    'ScreenerScheduleRunNowView.post': 'portfolio_write',
    # Screener history: xoá lịch sử = phá dữ liệu, khó phục hồi.
    'ScreenerHistoryListView.delete': 'portfolio_write',
    'ScreenerHistoryDetailView.delete': 'portfolio_write',
}


def _write_endpoints(ast_path: pathlib.Path) -> dict[str, ast.AST]:
    """Trả {ten endpoint ghi: node def} bằng AST, không đoán từ tên."""
    tree = ast.parse(ast_path.read_text(encoding='utf-8'), filename=str(ast_path))
    found: dict[str, ast.AST] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        for item in node.body:
            if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if item.name in _WRITE_METHODS:
                found[f'{node.name}.{item.name}'] = item
    return found


class Safe04PortfolioAnalyticsCapabilityTests(SimpleTestCase):
    """Mọi endpoint ghi trong `portfolio_analytics_views.py` phải khai báo quyền."""

    def test_write_endpoint_count_is_unchanged(self):  # noqa: N802 - chuẩn của test cũ
        """Số endpoint ghi phải khớp bảng `EXPECTED`.

        Có test này vì `EXPECTED` là danh sách viết tay. Thêm endpoint ghi mà
        quên cập nhật ⇒ test này đỏ, thay vì lọt xuống dưới im lặng.
        """
        found = _write_endpoints(_PA_VIEWS)
        self.assertEqual(
            len(found),
            len(EXPECTED),
            f'{len(found)} endpoint ghi trong file nhưng EXPECTED liệt kê {len(EXPECTED)}. '
            f'Endpoint chưa khai báo: {sorted(set(found) - set(EXPECTED))}',
        )

    def test_expected_keys_all_exist(self):
        """Mọi mục `EXPECTED` phải trỏ tới endpoint thật (đổi tên class ⇒ đỏ)."""
        found = _write_endpoints(_PA_VIEWS)
        for key in sorted(set(EXPECTED) - set(found)):
            with self.subTest(endpoint=key):
                self.fail(f'{key} khai trong EXPECTED nhưng không có trong file')

    def test_every_write_endpoint_declares_workspace_permission(self):
        """AC1 — mỗi view có method ghi phải khai báo quyền.

        Khai báo phải nằm trên **class** (`required_workspace_permission = '...'`)
        chứ không phải decorator trên method. Đo bằng lệch, không phải đọc code:
            _declared_permissions(PortfolioSyncView)  -> []
            getattr(PortfolioSyncView.post, 'required_workspace_permission') -> ['portfolio_write']
        ⇒ decorator trên method được ghi đúng cú pháp nhưng
        `WorkspacePermission.has_permission` không bao giờ đọc tới ⇒ **hở quyền**.
        Đây là bẫy thứ 2 trong file này (bẫy thứ 1 là gate cũ quét tay).
        """
        for cls_name, view in _view_classes_with_write_methods().items():
            expected_key = EXPECTED[cls_name] if cls_name in EXPECTED else None
            if expected_key is None:
                continue
            with self.subTest(view=cls_name):
                declared = _declared_permissions(view)
                self.assertTrue(
                    declared,
                    f'{cls_name} chua khai bao quyen tren CLASS. '
                    f'Khai bao tren method khong co tac dung - '
                    f'_declared_permissions(view) moi la noi doc.',
                )
                self.assertEqual(declared, [expected_key])

    def test_views_wire_up_workspace_permission_class(self):
        """`WorkspacePermission` phải nằm trong `permission_classes` của view.

        Thiếu khai báo decorator thì `_declared_permissions` trả rỗng ⇒
        `has_permission` tự deny (fail-closed) ⇒ **hỏng chức năng**, không phải
        hở. Nhưng nếu khai báo mà quên `permission_classes`, DRF không gọi
        `has_permission` của class ⇒ **hở hẳn**. Hai lỗi ngược chiều, phải
        khóa cả hai.
        """
        tree = ast.parse(_PA_VIEWS.read_text(encoding='utf-8'), filename=str(_PA_VIEWS))
        guarded_classes = set(EXPECTED)
        for node in ast.walk(tree):
            if not isinstance(node, ast.ClassDef) or node.name not in guarded_classes:
                continue
            with self.subTest(view=node.name):
                sources = [
                    ast.unparse(s)
                    for s in ast.walk(node)
                    if isinstance(s, (ast.Assign, ast.AnnAssign))
                ]
                self.assertTrue(
                    any('permission_classes' in s for s in sources),
                    f'{node.name} khai bao quyền nhung thieu permission_classes',
                )
                self.assertTrue(
                    any('WorkspacePermission' in s for s in sources),
                    f'{node.name} thieu WorkspacePermission trong permission_classes',
                )

    def test_no_write_key_maps_to_a_read_permission(self):
        """P0 regression — khoá `*_write` / `*_manage` không được trỏ quyền đọc."""
        for key, permission in WORKSPACE_PERMISSIONS.items():
            if not (key.endswith('_write') or key.endswith('_manage')):
                continue
            with self.subTest(key=key):
                self.assertFalse(
                    permission.endswith((':read', ':list')),
                    f'{key} -> {permission!r} là quyền ĐỌC, không bảo vệ được endpoint ghi',
                )

def _view_classes_with_write_methods() -> dict[str, type]:
    """{tên class: class} cho các view có ít nhất 1 method ghi."""
    found: dict[str, type] = {}
    for key in EXPECTED:
        cls_name = key.rsplit('.', 1)[0]
        view = getattr(pav, cls_name, None)
        if view is None:
            raise AssertionError(f'{cls_name} khong tim thay trong module (EXPECTED lech code)')
        found.setdefault(cls_name, view)
    return found


class Safe04PortfolioAnalyticsRuntimeTests(TestCase):
    """Chứng minh LỖ HỔNG THẬT ĐÃ ĐÓNG bằng request thật, không chỉ đọc source.

    Lớp test AST ở trên chỉ kiểm tra source. Nó **không** chứng minh DRF thực sự
    gọi `has_permission` khi chạy request. Lớp này gọi `WorkspacePermission`
    với request dựng thật, để khóa đúng trường hợp "source trông đúng mà
    runtime vẫn lọt".
    """

    def setUp(self):
        self.user = User.objects.create_user(username='safe04-viewer', password='x')
        self.owner = User.objects.create_user(username='safe04-owner', password='x')
        self.tenant = grant_tenant(
            self.user, role='viewer', tenant_code='safe04-tenant',
        )
        # Owner nằm ở `tenant.owner_user`, không phải `TenantMember`:
        # `get_tenant_role` so sánh `tenant.owner_user == request.user` trước
        # khi đọc `TenantMember.role` (`resolve_tenant.py`). Dùng cùng `tenant`
        # để test chỉ khác nhau ở vai trò, không khác ở tenant.
        self.tenant.owner_user = self.owner
        self.tenant.save(update_fields=['owner_user'])

    def test_viewer_is_denied_on_every_write_view(self):
        """`viewer` (chỉ `dashboard:read`) phải bị chặn ở MỌI endpoint ghi."""
        for cls_name, view in _view_classes_with_write_methods().items():
            guard = WorkspacePermission()
            write_methods = [
                m for m in ('post', 'put', 'patch', 'delete') if hasattr(view, m)
            ]
            for method in write_methods:
                with self.subTest(view=cls_name, method=method):
                    declared = _declared_permissions(view)
                    self.assertTrue(
                        declared,
                        f'{cls_name} chua khai bao quyen',
                    )
                    request = self._request_for(method, user=self.user)
                    self.assertFalse(
                        guard.has_permission(request, view),
                        f'{cls_name}.{method} VAN CHO viewer qua — lo hoong chua dong',
                    )

    def test_owner_is_allowed_on_every_write_view(self):
        """`owner` (`SYSTEM_ROLE_PERMISSIONS['owner'] == ['*']`) phải qua được.

        Không có test này thì "deny tất cả" cũng xanh — đó là fail-closed quá
        tay, mất chức năng. Phải chứng minh chỉ chặn đúng người.
        """
        for cls_name, view in _view_classes_with_write_methods().items():
            write_methods = [
                m for m in ('post', 'put', 'patch', 'delete') if hasattr(view, m)
            ]
            for method in write_methods:
                with self.subTest(view=cls_name, method=method):
                    request = self._request_for(method, user=self.owner)
                    self.assertTrue(
                        WorkspacePermission().has_permission(request, view),
                        f'{cls_name}.{method} chan ca owner — fail-closed qua tay',
                    )

    def test_unauthenticated_is_denied(self):
        """Chưa đăng nhập phải bị chặn, kể cả endpoint ghi."""
        for cls_name, view in _view_classes_with_write_methods().items():
            write_methods = [
                m for m in ('post', 'put', 'patch', 'delete') if hasattr(view, m)
            ]
            for method in write_methods:
                with self.subTest(view=cls_name, method=method):
                    request = self._request_for(method, user=None)
                    self.assertFalse(
                        WorkspacePermission().has_permission(request, view),
                    )

    def test_read_methods_are_not_gated(self):
        """GET phải đi qua — `viewer` mất đọc danh mục của chính mình là hồi quy.

        `WorkspacePermission.SAFE_METHODS` cho phép mọi method an toàn. Không có
        test này thì ai đó "siết bảo mật" bằng cách gỡ `SAFE_METHODS` sẽ không
        ai phát hiện.
        """
        for cls_name, view in _view_classes_with_write_methods().items():
            if not hasattr(view, 'get'):
                continue
            with self.subTest(view=cls_name):
                request = self._request_for('get', user=self.user)
                self.assertTrue(
                    WorkspacePermission().has_permission(request, view),
                    f'{cls_name}.get bi chan — viewer mat quyen doc danh muc cua chinh minh',
                )

    def _request_for(self, method: str, user):
        """Dựng request giả có `.user` + `.tenant` cho `has_permission`.

        `has_workspace_permission` gọi `get_tenant_permissions(request)`, đọc
        `request.tenant` / `request.tenant_member`. Ta gắn sẵn 2 thuộc tính đó
        thay vì đi qua middleware — test này kiểm tra lớp permission, không
        kiểm tra middleware.
        """
        request = _ProbeRequest(method.upper())

        if user is None:
            from django.contrib.auth.models import AnonymousUser

            request.user = AnonymousUser()
        else:
            request.user = user
            request.tenant = self.tenant
            request.tenant_member = None
        return request


class _ProbeRequest:
    """Request tối thiểu cho `WorkspacePermission.has_permission`.

    Cố ý KHÔNG đặt `_tenant_permissions` lẫn `_tenant_member_checked`: `has_workspace_permission`
    phải tự đi qua `get_tenant_permissions` → `get_tenant_role` để kiểm chứng
    đúng đường resolve thật. Nếu cache sẵn thì test chỉ chứng minh "đọc dict",
    không chứng minh "owner được resolve".
    """

    def __init__(self, method: str):
        self.method = method
        self.user = None
        self.tenant = None
        self.tenant_member = None