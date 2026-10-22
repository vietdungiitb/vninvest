"""W0.10 — ĐÓNG 3 LỖI 404 THẬT (gap-1 / gap-2 / gap-3).

Ba nhóm path FE đang gọi nhưng BE **không có route** ⇒ 404 thật. Chúng được khoá
trong allowlist có-ý của gate `route-contract` (PR #281). Slice này đóng chúng:

- **gap-2** `/partner/service-accounts/{id}/` — `ServiceAccountDetailView` **đã tồn tại**
  (`identity_access/views_tenant.py:190`) nhưng **route chưa được đăng ký** ⇒ chỉ thiếu
  2 dòng route. FE PATCH/DELETE 1 service account (`TenantAdminServiceAccountsPage.tsx:103,112`).
- **gap-1** `/partner/billing/invoices/{id}/pdf/` — BE không có route PDF và **không có thư viện
  PDF nào** trong image (đã probe VPS) ⇒ trả **hoá đơn HTML** (trình duyệt in ra PDF).
- **gap-3** `/ai/agents/{...}` — app `ai_agents` **rỗng** (model đã bị xoá ở migration 0003)
  ⇒ 4 method adapter trỏ vào app không tồn tại ⇒ code chết, xoá.

RED chen 2026-10-22 (agent `w0-10-close-be-gaps`).
Kế hoạch: docs/IMPLEMENTATION_PLAN_W0_10_CLOSE_BE_GAPS_20261022.md
"""
import re
from pathlib import Path

from django.conf import settings
from django.test import TestCase
from django.urls import resolve

REPO_ROOT = Path(__file__).resolve().parents[4]
BACKEND_SRC = REPO_ROOT / "packages" / "core" / "backend" / "src"
WEB_SRC = REPO_ROOT / "packages" / "web" / "src"


class ServiceAccountDetailRouteTests(TestCase):
    """gap-2 — route detail service account phải được ĐĂNG KÝ (không chỉ có view)."""

    def test_detail_route_resolves_to_the_detail_view(self):
        match = resolve("/core/v1/partner/service-accounts/sa-abc123/")
        self.assertEqual(match.func.view_class.__name__, "ServiceAccountDetailView")
        self.assertEqual(match.kwargs["service_account_id"], "sa-abc123")

    def test_detail_route_accepts_patch_and_delete_methods(self):
        match = resolve("/core/v1/partner/service-accounts/sa-abc123/")
        allowed = {m for m in match.func.cls.http_method_names} if hasattr(match.func, "cls") else set()
        self.assertIn("patch", {m.lower() for m in allowed})
        self.assertIn("delete", {m.lower() for m in allowed})


class InvoicePrintFallbackTests(TestCase):
    """gap-1 — FE khong duoc goi URL BE khong ton tai; phai in truc tiep tu du lieu co san."""

    def test_billing_page_does_not_call_missing_pdf_endpoint(self):
        source = (WEB_SRC / "pages" / "tenant-admin" / "TenantAdminBillingPage.tsx").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("/pdf/", source)

    def test_billing_page_has_print_fallback(self):
        source = (WEB_SRC / "pages" / "tenant-admin" / "TenantAdminBillingPage.tsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("buildInvoicePrintHtml", source)
        self.assertIn(".print()", source)


class AllowlistKeepsOnlyRealGapTests(TestCase):
    """gap-3 KHONG phai code chet: FE UI (AISliceE) van goi /ai/agents/ => 404 that.

    Vay allowlist cua gate phai GIU dung 1 muc (gap-3) — xoa muc nao la xoa
    loi 404 that dang duoc cover bang cach im lang.
    """

    def test_allowlist_only_keeps_ai_agents_gap(self):
        source = (
            WEB_SRC / "adapters" / "core" / "__tests__" / "route-contract.test.js"
        ).read_text(encoding="utf-8")
        self.assertIn("ai/agents", source)
        self.assertNotIn("partner/billing/invoices", source)
        self.assertNotIn("partner/service-accounts", source)
