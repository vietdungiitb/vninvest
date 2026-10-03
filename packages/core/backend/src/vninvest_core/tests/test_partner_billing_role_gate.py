"""Blast radius của role gate — 5 endpoint partner mà FE thực sự gọi.

**Vì sao file này tồn tại.** Gate `billing:read` chỉ gắn trên 4 call site của app
`commercial`. Nhưng khi truy ngược từ **frontend** thì ra thêm 5 endpoint ở
`identity_access`, và **cả 5 đều là những cái FE gọi thật**:

    packages/web/src/pages/tenant-admin/TenantAdminBillingPage.tsx:130,138,139
      -> /partner/billing/subscription/
      -> /partner/billing/invoices/

Nếu chỉ nhìn diff của app `commercial` thì kết luận dễ sai thành "chỉ 4 endpoint
bị đổi". Test này khoá lại quan hệ đó bằng **HTTP thật** chứ không bằng giả định
về tên route.

**Kết luận quan trọng — 5 endpoint này KHÔNG cần sửa quyền.** Cả 5 đã gọi
`_require_tenant_permission(request, 'billing:read')` **trước** khi tra tenant:

| view | `_require_tenant_permission` | `_get_tenant` |
|---|---|---|
| `PartnerCostTrendView` | `:50` | (delegate) |
| `PartnerUsageMetersView` | `:73` | `:79` |
| `PartnerUsageQuotasView` | `:102` | `:108` |
| `PartnerBillingSubscriptionView` | `:135` | `:139` |
| `PartnerBillingInvoicesView` | `:182` | `:186` |
| `PartnerUsageHistoryView` | `:275` | `:282` |

⇒ viewer/editor **đã** bị 403 ở đây từ trước PR này. Gate mới **không** làm thay
đổi trạng thái quyền của 5 endpoint đó; nó chỉ **làm rõ** điều đã đúng.

**Cái còn hở (test này không che):** cả 5 bọc trong `except Exception`
(`:160 :192` …) nuốt lỗi thành `200 + rỗng`. `billing:read` nằm **ngoài** `try`
nên fail-closed đúng; nhưng `CoreTenant.DoesNotExist` **nằm trong** `try` — user
đúng quyền mà không sở hữu tenant vẫn nhận `200 + rỗng` thay vì 403. Đó là OW-02
phần 1 ở partner namespace, **cần claim riêng** (đã ghi trong OPEN_WORK).
"""

from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from identity_access.models import CoreTenant, TenantMember

SUBSCRIPTION_URL = '/core/v1/partner/billing/subscription/'
INVOICES_URL = '/core/v1/partner/billing/invoices/'
COST_TREND_URL = '/core/v1/partner/billing/cost-trend/'
USAGE_METERS_URL = '/core/v1/partner/usage/meters/'
USAGE_QUOTAS_URL = '/core/v1/partner/usage/quotas/'
USAGE_HISTORY_URL = '/core/v1/partner/usage/history/'

#: Cả 6 route mà FE hoặc operator có thể gọi trong nhóm partner billing/usage.
PARTNER_BILLING_URLS = (
    SUBSCRIPTION_URL,
    INVOICES_URL,
    COST_TREND_URL,
    USAGE_METERS_URL,
    USAGE_QUOTAS_URL,
    USAGE_HISTORY_URL,
)


def client_for(user, tenant):
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_TENANT_ID'] = tenant.public_id
    return client


class PartnerBillingReadRoleGateTests(TestCase):
    """Viewer/editor phải bị 403 trên **cả** 6 route, không chỉ 4 route của app.

    Đây là bằng chứng cho tuyên bố trong docstring: 5 endpoint partner đã có
    `billing:read` sẵn nên không phát sinh thay đổi quyền.
    """

    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user(username='partner_gate_owner', password='x')
        cls.admin = User.objects.create_user(username='partner_gate_admin', password='x')
        cls.editor = User.objects.create_user(username='partner_gate_editor', password='x')
        cls.viewer = User.objects.create_user(username='partner_gate_viewer', password='x')

        cls.tenant = CoreTenant.objects.create(
            owner_user=cls.owner, tenant_code='partner-gate',
            display_name='Partner Gate', plan='enterprise')
        for user, role in (
            (cls.admin, TenantMember.RoleChoices.ADMIN),
            (cls.editor, TenantMember.RoleChoices.EDITOR),
            (cls.viewer, TenantMember.RoleChoices.VIEWER),
        ):
            TenantMember.objects.create(user=user, tenant=cls.tenant, role=role)

        from commercial.models import Invoice, Subscription

        Subscription.objects.create(
            tenant=cls.tenant, plan='enterprise',
            current_period_start=date(2026, 10, 1), current_period_end=date(2026, 10, 31))
        Invoice.objects.create(
            tenant=cls.tenant, invoice_number='PARTNER-GATE-INV', amount_due='7300000.00',
            period_start=date(2026, 10, 1), period_end=date(2026, 10, 31))

    def test_viewer_denied_on_all_partner_billing_routes(self):
        client = client_for(self.viewer, self.tenant)
        for url in PARTNER_BILLING_URLS:
            with self.subTest(url=url):
                resp = client.get(url)
                self.assertEqual(resp.status_code, 403, f'{url} -> {resp.status_code}')

    def test_editor_denied_on_all_partner_billing_routes(self):
        client = client_for(self.editor, self.tenant)
        for url in PARTNER_BILLING_URLS:
            with self.subTest(url=url):
                resp = client.get(url)
                self.assertEqual(resp.status_code, 403, f'{url} -> {resp.status_code}')

    def test_admin_allowed_on_the_two_fe_consumed_routes(self):
        """Hai route mà `TenantAdminBillingPage.tsx:138-139` gọi thật."""
        client = client_for(self.admin, self.tenant)
        for url in (SUBSCRIPTION_URL, INVOICES_URL):
            with self.subTest(url=url):
                self.assertEqual(client.get(url).status_code, 200)

    def test_viewer_denied_body_has_no_invoice_data(self):
        """403 của partner namespace không được kèm số tiền/số hoá đơn."""
        client = client_for(self.viewer, self.tenant)
        for url in PARTNER_BILLING_URLS:
            with self.subTest(url=url):
                body = client.get(url).content.decode('utf-8')
                self.assertNotIn('PARTNER-GATE-INV', body)
                self.assertNotIn('7300000', body)


class PartnerNonOwnerAdminFailOpenTests(TestCase):
    """Khoá lại cái lỗ hổng còn mở: admin đúng quyền vẫn nhận 200-rỗng.

    Đây **không phải** test hồi quy của gate mới — nó là **bằng chứng** rằng
    OW-02 phần 1 vẫn chưa xong ở partner namespace. `billing:read` nằm ngoài
    `try` nên quyền fail-closed, nhưng `CoreTenant.objects.get(owner_user=...)`
    nằm **trong** `try` và `DoesNotExist` bị nuốt thành `200 + rỗng`.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(username='partner_fo_admin', password='x')
        cls.tenant = CoreTenant.objects.create(
            owner_user=User.objects.create_user(username='partner_fo_owner', password='x'),
            tenant_code='partner-fo', display_name='Partner FO', plan='enterprise')
        TenantMember.objects.create(
            user=cls.admin, tenant=cls.tenant, role=TenantMember.RoleChoices.ADMIN)

    def test_admin_with_header_gets_data_not_empty_envelope(self):
        """Admin có `billing:read` + header tenant ⇒ phải thấy dữ liệu thật.

        Nếu test này đang đỏ với body rỗng ⇒ `_get_tenant(user)` đang ném
        `DoesNotExist` và bị `except Exception` nuốt. Đó chính là OW-02 phần 1.
        """
        client = client_for(self.admin, self.tenant)
        resp = client.get(SUBSCRIPTION_URL)
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.content.decode('utf-8')
        self.assertNotIn("'status': 'none'", body)
        self.assertNotIn('"status":"none"', body.replace(' ', ''))