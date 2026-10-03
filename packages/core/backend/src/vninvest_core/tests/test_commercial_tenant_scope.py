"""Tenant scope của 3 endpoint billing trong app `commercial` — OW-02.

**Vì sao file này tồn tại.** OW-02 ghi rằng các view billing tra tenant bằng
`CoreTenant.objects.get(owner_user=request.user)`. Mẫu đó chỉ đúng với **owner**.
Một user là **member** (không sở hữu tenant nào) thì `.get()` ném
`CoreTenant.DoesNotExist` — không phải 403, mà là 500. Đã sửa sang
`resolve_tenant(request)` (`identity_access/utils/resolve_tenant.py:229`), vốn
đọc `request.tenant` mà `TenantResolutionMiddleware` đã resolve sẵn.

**Điều KHÔNG test ở đây và vì sao.** `TenantResolutionMiddleware` chạy trước
view (`settings.py:120`) và trả **403 JSON** sẵn khi không resolve được tenant
(`middleware.py:109-116`). Nên `test_member_denied_other_tenant` khoá hành vi
`403` ở **middleware**, không phải ở view — nó bảo vệ ranh giới, không chứng
minh `resolve_tenant` trong view chạy đúng. Bằng chứng cho `resolve_tenant` bản
thân nó nằm ở test của `identity_access`; ở đây ta chỉ cần chứng minh 3 view
này **không còn** tự tra tenant theo owner.

**Phạm vi.** Chỉ 4 call site trong ticket `OW-02` (`commercial/views.py` x3,
`commercial/views_analytics.py` x1). `identity_access/commercial_partner_views.py`
còn 5 chỗ cùng mẫu (`:79 :108 :139 :186 :282`) — Owner đã quyết định **để lại**,
vì sửa chúng sẽ đổi response của 5 endpoint partner đang chạy từ 200-rỗng sang
403. Không được coi test file này là bằng chứng cho partner namespace.
"""
from datetime import date
import inspect

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from commercial import views, views_analytics
from commercial.models import Invoice, QuotaRecord, Subscription
from identity_access.models import CoreTenant, TenantMember

SUB_URL = '/core/v1/billing/subscription'
QUOTA_URL = '/core/v1/billing/quota'
INVOICE_URL = '/core/v1/billing/invoices'


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
        # member của tenant_a. KHÔNG sở hữu tenant nào ⇒ `owner_user=self.member`
        # trả về tenant nào, chính là cái làm OW-02 vỡ.
        cls.member = User.objects.create_user(username='ow02_member', password='x')

        cls.tenant_a = CoreTenant.objects.create(
            owner_user=cls.owner_a, tenant_code='ow02-a',
            display_name='OW-02 A', plan='starter')
        cls.tenant_b = CoreTenant.objects.create(
            owner_user=cls.owner_b, tenant_code='ow02-b',
            display_name='OW-02 B', plan='enterprise')
        TenantMember.objects.create(
            user=cls.member, tenant=cls.tenant_a, role=TenantMember.RoleChoices.VIEWER)

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
        self.member_client = APIClient()
        self.member_client.force_authenticate(user=self.member)
        self.member_client.defaults['HTTP_X_TENANT_ID'] = self.tenant_a.public_id

    def test_owner_reads_own_subscription_without_header(self):
        """Owner: không cần header, fallback theo `owner_tenant_for_user`."""
        owner_client = APIClient()
        owner_client.force_authenticate(user=self.owner_a)
        body = unwrapped(owner_client.get(SUB_URL))
        self.assertEqual(body['plan'], self.sub_a.plan)

    def test_member_reads_own_tenant_subscription(self):
        """REGRESSION OW-02 — member (không sở hữu tenant) phải đọc được.

        Mã cũ tra `CoreTenant.objects.get(owner_user=request.user)`: member không
        sở hữu tenant nào ⇒ `DoesNotExist` ⇒ 500. Mã mới đọc tenant mà
        middleware đã resolve ⇒ 200.
        """
        resp = self.member_client.get(SUB_URL)
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
        rows = unwrapped(self.member_client.get(INVOICE_URL))['results']
        numbers = {r['invoice_number'] for r in rows}
        self.assertEqual(numbers, {'OW02-INV-A'})

    def test_missing_subscription_is_404_not_500(self):
        """Tenant chưa có subscription ⇒ 404, không phải 500."""
        owner_b_client = APIClient()
        owner_b_client.force_authenticate(user=self.owner_b)
        self.sub_b.delete()
        resp = owner_b_client.get(SUB_URL)
        self.assertEqual(resp.status_code, 404, resp.content)


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