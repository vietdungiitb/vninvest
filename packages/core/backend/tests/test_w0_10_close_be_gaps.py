"""W0.10 — gap-2: route DETAIL service account phải được ĐĂNG KÝ (không chỉ có view).

Vì sao: FE `pages/tenant-admin/TenantAdminServiceAccountsPage.tsx:103` (DELETE) và
`:112` (PATCH) gọi `/partner/service-accounts/{id}/` ⇒ **404 thật**. View
`ServiceAccountDetailView` **đã tồn tại** (`identity_access/views_tenant.py:190`)
nhưng route **chưa được đăng ký** trong `partner_urls.py` ⇒ chỉ thiếu 2 dòng route.

RED chen 2026-10-22 (agent `w0-10-close-be-gaps`).
Kế hoạch: docs/IMPLEMENTATION_PLAN_W0_10_CLOSE_BE_GAPS_20261022.md
"""
from django.test import TestCase
from django.urls import resolve


class ServiceAccountDetailRouteTests(TestCase):
    """gap-2 — route detail service account phải resolve (không 404)."""

    def test_detail_route_resolves_to_the_detail_view(self):
        match = resolve("/core/v1/partner/service-accounts/sa-abc123/")
        self.assertEqual(match.func.view_class.__name__, "ServiceAccountDetailView")
        self.assertEqual(match.kwargs["service_account_id"], "sa-abc123")

    def test_detail_route_is_not_answered_by_the_list_view(self):
        match = resolve("/core/v1/partner/service-accounts/sa-abc123/")
        self.assertNotEqual(match.func.view_class.__name__, "ServiceAccountListView")
