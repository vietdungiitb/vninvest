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

**Cái đã sửa:** 5 view bọc trong `except Exception` nuốt lỗi thành `200 + rỗng`.
`billing:read` nằm **ngoài** `try` nên quyền fail-closed đúng; nhưng trước đây
`CoreTenant.objects.get(owner_user=...)` **nằm trong** `try` nên user đúng quyền
mà không sở hữu tenant nhận `200 + rỗng` thay vì 403 (OW-02 phần 1). Nay cả 5
dùng `resolve_tenant(request)` tra **trước** try/except, nên `PermissionDenied`
lan ra thành 403. Hai test cuối khoá lại đúng hành vi đó.
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


class PartnerNonOwnerAdminTenantResolutionTests(TestCase):
    """Admin đúng quyền PHẢI resolve được tenant (không phải 200-rỗng).

    Trước khi sửa, `_get_tenant(request.user)` lookup theo `owner_user` nên admin
    (không phải owner) nhận `CoreTenant.DoesNotExist`, bị `except Exception`
    nuốt thành `200 + status:none`. Đây là fail-open OW-02 phần 1.

    Sau khi sửa, cả 5 endpoint dùng `resolve_tenant(request)` tra **trước**
    try/except nên `PermissionDenied` lan ra ⇒ 403 thay vì fake-success.
    """

    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(username='partner_fo_admin', password='x')
        cls.tenant = CoreTenant.objects.create(
            owner_user=User.objects.create_user(username='partner_fo_owner', password='x'),
            tenant_code='partner-fo', display_name='Partner FO', plan='enterprise')
        TenantMember.objects.create(
            user=cls.admin, tenant=cls.tenant, role=TenantMember.RoleChoices.ADMIN)

    def test_admin_with_header_resolves_tenant_not_fake_empty(self):
        """Admin + header tenant ⇒ body phải mang `plan` thật của tenant.

        Không có Subscription row thì `status: none` là **hợp lệ** (nhánh
        sub-is-None), nên khẳng định bằng `plan: enterprise` — dấu hiệu duy
        nhất cho thấy đã tra đúng tenant thay vì nhánh lỗi.
        """
        client = client_for(self.admin, self.tenant)
        resp = client.get(SUBSCRIPTION_URL)
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.content.decode('utf-8')
        self.assertIn('enterprise', body,
                      f'tenant resolve that (plan=enterprise) — body={body}')

    def test_stranger_admin_without_tenant_relationship_gets_403_not_200(self):
        """Admin của tenant KHÁC gọi header của tenant này ⇒ 403, không 200."""
        stranger = User.objects.create_user(username='partner_fo_stranger', password='x')
        other_tenant = CoreTenant.objects.create(
            owner_user=User.objects.create_user(username='partner_fo_other_owner', password='x'),
            tenant_code='partner-fo-other', display_name='Other', plan='pro')
        TenantMember.objects.create(
            user=stranger, tenant=other_tenant, role=TenantMember.RoleChoices.ADMIN)
        client = client_for(stranger, other_tenant)
        resp = client.get(SUBSCRIPTION_URL, HTTP_X_TENANT_ID=self.tenant.public_id)
        self.assertEqual(resp.status_code, 403, resp.content)