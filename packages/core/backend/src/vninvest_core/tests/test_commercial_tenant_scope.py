"""Tenant scope + phân quyền của 4 endpoint billing/usage trong app `commercial`.

**Vấn đề 1 — OW-02 (500 cho member).** OW-02 ghi rằng các view billing tra
tenant bằng `CoreTenant.objects.get(owner_user=request.user)`. Mẫu đó chỉ đúng
với **owner**. Một user là **member** (không sở hữu tenant nào) thì `.get()`
ném `CoreTenant.DoesNotExist` — không phải 403, mà là 500. Đã sửa sang
`resolve_tenant(request)` (`identity_access/utils/resolve_tenant.py:229`), vốn
đọc `request.tenant` mà `TenantResolutionMiddleware` đã resolve sẵn.

**Vấn đề 2 — viewer thấy hoá đơn của thành viên khác.** `resolve_tenant` chỉ
bảo đảm **ranh giới tenant** (user chỉ tới được tenant mình quan hệ), **không**
bảo đảm **ranh giới vai trò**. Thêm nữa `Invoice` chỉ có `tenant` FK, không có
user FK (`commercial/models.py`) — "hoá đơn riêng của thành viên" không tồn tại
trong schema, nên quy tắc của Owner chỉ có thể diễn đạt bằng cách **từ chối
viewer endpoint**, không lọc được theo dòng.

⇒ `commercial/permissions.py:RequiresTenantPermission` dùng lại SSOT
`require_tenant_permission` + `SYSTEM_ROLE_PERMISSIONS` (`resolve_tenant.py:27-56`),
trong đó `billing:read` đã được cấp cho `owner`/`admin` và **không** cho
`editor`/`viewer`. Không tự viết bảng role lần nữa — bảng đó đã có sẵn và còn
tôn trọng `custom_role`.

**Điều KHÔNG test ở đây và vì sao.** `TenantResolutionMiddleware` chạy trước
view (`settings.py:120`) và trả **403 JSON** sẵn khi không resolve được tenant
(`middleware.py:109-116`). Nên `test_member_denied_other_tenant` khoá hành vi
`403` ở **middleware**, không phải ở view — nó bảo vệ ranh giới, không chứng
minh `resolve_tenant` trong view chạy đúng.

**Phạm vi.** Chỉ 4 call site trong ticket `OW-02` (`commercial/views.py` x3,
`commercial/views_analytics.py` x1). `identity_access/commercial_partner_views.py`
còn 5 chỗ cùng mẫu (`:79 :108 :139 :186 :282`) — Owner đã quyết định **để lại**,
vì sửa chúng sẽ đổi response của 5 endpoint partner đang chạy từ 200-rỗng sang
403. Không được coi test file này là bằng chứng cho partner namespace.
"""
import inspect
from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from commercial import views, views_analytics
from commercial.models import Invoice, QuotaRecord, Subscription
from commercial.permissions import RequiresTenantPermission
from identity_access.models import CoreTenant, TenantMember

SUB_URL = '/core/v1/billing/subscription'
QUOTA_URL = '/core/v1/billing/quota'
INVOICE_URL = '/core/v1/billing/invoices'
# Route thật nằm ở `identity_access/partner_urls.py:128-129`, tới wrapper
# `identity_access/commercial_partner_views.py:33` — không phải `commercial/urls.py`.
COST_TREND_URL = '/core/v1/partner/billing/cost-trend/'

#: Cùng tenant, khác `required_tenant_permissions`:
#: - `billing:read` -> owner + admin      (resolve_tenant.py:27-56)
#: - `usage:read`   -> owner + admin + editor + viewer
BILLING_URLS = (SUB_URL, INVOICE_URL)
QUOTA_TOKEN_URLS = (QUOTA_URL,)


def client_for(user, tenant):
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return client


def unwrapped(response) -> dict:
    """Mở envelope `{data, meta}` nếu có; giữ nguyên nếu không (quy tắc của FE)."""
    body = response.json()
    if isinstance(body, dict) and 'data' in body and 'meta' in body:
        return body['data']
    return body


class CommercialTenantScopeTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner_a = User.objects.create_user(username='ow02_owner_a', password='x')
        cls.owner_b = User.objects.create_user(username='ow02_owner_b', password='x')
        # 4 member của tenant_a, KHÔNG ai sở hữu tenant nào nên
        # `owner_user=<member>` trả None cho tất cả — đó là cái làm OW-02 vỡ.
        # Mỗi role một user để test bảng `SYSTEM_ROLE_PERMISSIONS`.
        cls.viewer = User.objects.create_user(username='ow02_viewer', password='x')
        cls.editor = User.objects.create_user(username='ow02_editor', password='x')
        cls.admin = User.objects.create_user(username='ow02_admin', password='x')
        cls.member = cls.viewer

        cls.tenant_a = CoreTenant.objects.create(
            owner_user=cls.owner_a, tenant_code='ow02-a',
            display_name='OW-02 A', plan='starter')
        cls.tenant_b = CoreTenant.objects.create(
            owner_user=cls.owner_b, tenant_code='ow02-b',
            display_name='OW-02 B', plan='enterprise')
        for user, role in (
            (cls.viewer, TenantMember.RoleChoices.VIEWER),
            (cls.editor, TenantMember.RoleChoices.EDITOR),
            (cls.admin, TenantMember.RoleChoices.ADMIN),
        ):
            TenantMember.objects.create(user=user, tenant=cls.tenant_a, role=role)

        cls.sub_a = Subscription.objects.create(
            tenant=cls.tenant_a, plan='starter',
            current_period_start=date(2026, 10, 1), current_period_end=date(2026, 10, 31))
        cls.sub_b = Subscription.objects.create(
            tenant=cls.tenant_b, plan='enterprise',
            current_period_start=date(2026, 10, 1), current_period_end=date(2026, 10, 31))

        # tenant_a có 2 kỳ, tenant_b có 1 — đủ để phân biệt "bị lọc" với
        # "trùng số trùng khớp".
        QuotaRecord.objects.create(
            tenant=cls.tenant_a, period_start=date(2026, 9, 1), period_end=date(2026, 9, 30),
            api_calls_used=1, api_calls_limit=100)
        QuotaRecord.objects.create(
            tenant=cls.tenant_a, period_start=date(2026, 10, 1), period_end=date(2026, 10, 31),
            api_calls_used=2, api_calls_limit=200)
        QuotaRecord.objects.create(
            tenant=cls.tenant_b, period_start=date(2026, 10, 1), period_end=date(2026, 10, 31),
            api_calls_used=9, api_calls_limit=900)

        cls.inv_a = Invoice.objects.create(
            tenant=cls.tenant_a, invoice_number='OW02-INV-A', amount_due='100000.00',
            period_start=date(2026, 10, 1), period_end=date(2026, 10, 31))
        Invoice.objects.create(
            tenant=cls.tenant_b, invoice_number='OW02-INV-B', amount_due='999000.00',
            period_start=date(2026, 10, 1), period_end=date(2026, 10, 31))

    def setUp(self):
        # Member đọc được quota (token `usage:read`) nhưng KHÔNG đọc được
        # subscription/invoices (token `billing:read`).
        self.member_client = client_for(self.member, self.tenant_a)
        self.admin_client = client_for(self.admin, self.tenant_a)

    def test_owner_reads_own_subscription_without_header(self):
        """Owner: không cần header, fallback theo `owner_tenant_for_user`."""
        owner_client = APIClient()
        owner_client.force_authenticate(user=self.owner_a)
        body = unwrapped(owner_client.get(SUB_URL))
        self.assertEqual(body['plan'], self.sub_a.plan)

    def test_admin_reads_own_tenant_subscription(self):
        """REGRESSION OW-02 — `admin` (không sở hữu tenant) phải đọc được.

        Mã cũ tra `CoreTenant.objects.get(owner_user=request.user)`: admin không
        sở hữu tenant nào ⇒ `DoesNotExist` ⇒ 500. Mã mới đọc tenant mà
        middleware đã resolve ⇒ 200.
        """
        resp = self.admin_client.get(SUB_URL)
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(unwrapped(resp)['plan'], self.sub_a.plan)

    def test_member_denied_other_tenant(self):
        """Ranh giới: header trỏ tenant không liên quan ⇒ 403 (do middleware)."""
        self.member_client.defaults['HTTP_X_TENANT_ID'] = self.tenant_b.public_id
        resp = self.member_client.get(SUB_URL)
        self.assertEqual(resp.status_code, 403)

    def test_quota_list_only_own_tenant_periods(self):
        rows = unwrapped(self.member_client.get(QUOTA_URL))['results']
        self.assertEqual(len(rows), 2, rows)
        used = {r['api_calls_used'] for r in rows}
        self.assertEqual(used, {1, 2})
        self.assertNotIn(9, used, 'tenant_b đã lọt vào kết quả của tenant_a')

    def test_invoice_list_only_own_tenant_invoices(self):
        """Admin thấy đúng hoá đơn của tenant mình, không thấy của tenant khác."""
        rows = unwrapped(self.admin_client.get(INVOICE_URL))['results']
        numbers = {r['invoice_number'] for r in rows}
        self.assertEqual(numbers, {'OW02-INV-A'})

    def test_missing_subscription_is_404_not_500(self):
        """Tenant chưa có subscription ⇒ 404, không phải 500."""
        owner_b_client = APIClient()
        owner_b_client.force_authenticate(user=self.owner_b)
        self.sub_b.delete()
        resp = owner_b_client.get(SUB_URL)
        self.assertEqual(resp.status_code, 404, resp.content)


class CommercialBillingReadRoleGateTests(TestCase):
    """Quy tắc Owner: viewer/editor KHÔNG đọc được hoá đơn của tenant.

    Đây là test chính cho `commercial/permissions.py`. Không có class này thì
    việc gỡ `required_tenant_permissions` khỏi view sẽ đi qua thầm lặng: response
    quay về 200 và không ai thấy.

    Bảng kỳ vọng lấy từ `SYSTEM_ROLE_PERMISSIONS` (`resolve_tenant.py:27-56`),
    không phải từ suy luận:

        role     billing:read   usage:read
        owner    *              *
        admin    co             co
        editor   KHONG          co
        viewer   KHONG          co
    """

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username='ow02_gate_owner', password='x')
        cls.admin = User.objects.create_user(username='ow02_gate_admin', password='x')
        cls.editor = User.objects.create_user(username='ow02_gate_editor', password='x')
        cls.viewer = User.objects.create_user(username='ow02_gate_viewer', password='x')

        cls.tenant = CoreTenant.objects.create(
            owner_user=cls.owner, tenant_code='ow02-gate',
            display_name='OW-02 Gate', plan='enterprise')
        for user, role in (
            (cls.admin, TenantMember.RoleChoices.ADMIN),
            (cls.editor, TenantMember.RoleChoices.EDITOR),
            (cls.viewer, TenantMember.RoleChoices.VIEWER),
        ):
            TenantMember.objects.create(user=user, tenant=cls.tenant, role=role)

        Subscription.objects.create(
            tenant=cls.tenant, plan='enterprise',
            current_period_start=date(2026, 10, 1), current_period_end=date(2026, 10, 31))
        QuotaRecord.objects.create(
            tenant=cls.tenant, period_start=date(2026, 10, 1), period_end=date(2026, 10, 31),
            api_calls_used=7, api_calls_limit=700)
        Invoice.objects.create(
            tenant=cls.tenant, invoice_number='OW02-GATE-INV', amount_due='4200000.00',
            period_start=date(2026, 10, 1), period_end=date(2026, 10, 31))

    def _client(self, user):
        return client_for(user, self.tenant)

    def test_viewer_cannot_read_billing(self):
        """`billing:read` không có trong token của viewer ⇒ 403."""
        client = self._client(self.viewer)
        for url in BILLING_URLS:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 403)

    def test_editor_cannot_read_billing(self):
        """Editor cũng không có `billing:read` ⇒ 403."""
        client = self._client(self.editor)
        for url in BILLING_URLS:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 403)

    def test_admin_can_read_billing(self):
        client = self._client(self.admin)
        for url in BILLING_URLS:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 200)

    def test_owner_can_read_billing(self):
        """Owner không có TenantMember row — phải đi qua nhánh `'*'`."""
        client = self._client(self.owner)
        for url in BILLING_URLS:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 200)

    def test_viewer_can_read_quota(self):
        """`usage:read` CÓ trong token viewer ⇒ quota vẫn đọc được.

        Khẳng định chính sách, không phải kiểm tra ngẫu nhiên: nếu Owner muốn
        quota cũng khoá theo billing thì đổi token ở `QuotaListView` và đổi test
        này thành 403 — hai chỗ phải đổi cùng nhau, không đổi một chỗ.
        """
        client = self._client(self.viewer)
        for url in QUOTA_TOKEN_URLS:
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 200)

    def test_denied_response_does_not_leak_invoice_amounts(self):
        """Body của 403 không được chứa số tiền/số hoá đơn của tenant.

        Chặn trường hợp gate trả 403 nhưng vẫn serialize dữ liệu trước khi chặn
        (ví dụ filter chạy trước permission, hoặc serializer chạy trong `list()`).
        """
        client = self._client(self.viewer)
        for url in BILLING_URLS:
            with self.subTest(url=url):
                body = client.get(url).content.decode('utf-8')
                self.assertNotIn('OW02-GATE-INV', body)
                self.assertNotIn('4200000', body)
                self.assertNotIn('4200000.00', body)

    def test_cost_trend_viewer_denied(self):
        """Endpoint thứ 4 (analytics) cũng phải chặn viewer.

        Ghi chú hình dạng: wrapper `commercial_partner_views.py:50` **đã** gọi
        `_require_tenant_permission(request, 'billing:read')` nên 403 phát ra ở
        đó, trước khi inner view kịp chạy. Gate của ta trên inner view là lớp
        thứ hai — nó giữ được mình khi ai đó đổi wrapper, sửa schema, hoặc mount
        inner view trực tiếp.
        """
        resp = self._client(self.viewer).get(COST_TREND_URL)
        self.assertEqual(resp.status_code, 403, resp.content)


class CommercialPermissionDeclarationRegressionTests(TestCase):
    """Chặn việc gỡ khai báo gate mà không đổi test hành vi.

    `test_viewer_can_read_quota` cố ý là 200, nên nó **không** phát hiện việc
    mất gate. Với các view token `usage:read` cần một test cấu trúc để canh.
    """

    EXPECTED = {
        'SubscriptionDetailView': 'billing:read',
        'QuotaListView': 'usage:read',
        'InvoiceListView': 'billing:read',
    }

    def test_views_declare_required_tenant_permissions(self):
        for name, perm in self.EXPECTED.items():
            with self.subTest(view=name):
                view = getattr(views, name)
                self.assertEqual(
                    tuple(getattr(view, 'required_tenant_permissions', ())), (perm,))
                self.assertIn(
                    RequiresTenantPermission, view.permission_classes,
                    f'{name} không còn gắn RequiresTenantPermission')

    def test_cost_trend_view_declares_required_tenant_permissions(self):
        view = views_analytics.PartnerCostTrendView
        self.assertEqual(
            tuple(getattr(view, 'required_tenant_permissions', ())), ('billing:read',))
        self.assertIn(RequiresTenantPermission, view.permission_classes)


class CommercialNoOwnerLookupRegressionTests(TestCase):
    """Chặn tái phát OW-02: 3 view không được tự tra tenant theo owner.

    Test cấu trúc, không test hành vi — nhưng đúng thứ OW-02 là một mẫu *văn
    bản* lặp lại ở 4 chỗ, và mẫu đó không có gì khiến test hành vi bắt được khi
    nó quay lại. Ở đây ta khoá chính mẫu đó.

    Cố tình **không** kiểm `identity_access/commercial_partner_views.py`: file
    đó Owner đã quyết định để lại, nên khẳng định "không còn mẫu owner_user" trên
    toàn repo sẽ đỏ vì một file nằm ngoài phạm vi. Kiểm đúng phạm vi đã sửa.
    """

    @staticmethod
    def _source(module) -> str:
        return inspect.getsource(module)

    def test_commercial_views_have_no_owner_user_lookup(self):
        for module in (views, views_analytics):
            source = self._source(module)
            with self.subTest(module=module.__name__):
                self.assertNotIn('owner_user=request.user', source)
                self.assertNotIn('owner_user=self.request.user', source)

    def test_commercial_views_use_resolve_tenant(self):
        for module in (views, views_analytics):
            with self.subTest(module=module.__name__):
                self.assertIn('resolve_tenant', self._source(module))