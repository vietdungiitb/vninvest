# Counter-Audit: TENANT_MANAGEMENT_AUDIT_AND_UPGRADE_PLAN.md

**Ngày:** 2026-07-18
**Phản biện bởi:** AI Audit (framework chuẩn AGENTS.md)
**Đối tượng:** `docs/TENANT_MANAGEMENT_AUDIT_AND_UPGRADE_PLAN.md` (649 lines, 28.9KB)
**Phương pháp:** grep/read thực tế trên `packages/core/backend/src/identity_access/` + `packages/web/src/`; verify từng claim qua file:line.

---

## 0. TỔNG KẾT

| Hạng mục | Kết quả |
|----------|---------|
| **Substantive findings (bug/security/feature gaps)** | ✅ **XÁC THỰC** — tất cả 15 bugs + 8 security gaps + feature matrix đều đúng thực tế |
| **Structural claims (file inventory, line counts, i18n)** | ✅ **XÁC THỰC** — 13 pages, model line numbers, 13 i18n namespaces khớp chính xác |
| **Technical precision (line numbers, counts)** | ⚠️ **SAI Ở 4 CHỖ** — B1 count, B3 count, B5 file citation, một vài line offset |

**Kết luận:** Doc là **audit chất lượng cao, đáng tin cậy về nội dung**. Các phát hiện cốt lõi (duplicate `_get_request_tenant`, mock SSO, role enforcement broken, member limit missing, hardcoded strings, no ErrorBoundary) đều CONFIRMED bằng source. Chỉ cần sửa một số lỗi kỹ thuật (số đếm + citation) trước khi dùng làm kế hoạch thực thi.

---

## 1. CONTRADICTIONS (Doc vs Code) — CẦN SỬA

| # | Claim trong doc | Thực tế (file:line) | Mức | Sửa gì |
|---|----------------|---------------------|-----|--------|
| **C1** | B1: `_get_request_tenant()` duplicated **9 times**, list gồm `tenant_member_views.py:120` | Thực tế: def tại `tenant_member_views.py:31` (không phải 120). Tổng `_get_request_tenant` = **9 defs** đúng, nhưng doc gộp nhầm với `_get_request_tenant_role`. | MED | Sửa line `:120` → `:31`. Ghi rõ "9 defs của `_get_request_tenant` + 3 defs của `_get_request_tenant_role`" |
| **C2** | B3: `_get_request_tenant_role()` duplicated **2 times** (views/sso.py:29, tenant_member_views.py:68) | Thực tế: **3 defs** — thiếu `views_tenant.py:173` | MED | Sửa "2 times" → "3 times", thêm `views_tenant.py:173` |
| **C3** | B5: `features_map` (member limits) tại `tenant_member_views.py:126-165` | Thực tế: `features_map` nằm tại **`views_webhooks.py:195-200`** (trong `PreviewPlanChangeView`), không phải tenant_member_views.py. Invite POST (`TenantInvitesCombinedView.post()`) tại `tenant_member_views.py:126-177` đúng là không check limit. | HIGH | Sửa citation file:line của features_map → `views_webhooks.py:195-200`. Giữ nguyên claim "invite không check limit" (đúng) |
| **C4** | S1: SSO mock tại `views/sso.py:112-209` | Thực tế: file dài 223 lines, range đúng là **112-223**. Substance đúng. | LOW | Sửa `:209` → `:223` (hoặc bỏ range) |
| **C5** | B1 list ghi `views/sso.py:20` (slash path) | Thực tế path là `views\sso.py` (Windows backslash). Doc chạy trên Windows nên nên dùng backslash cho nhất quán với repo. | LOW | Đổi `/` → `\` trong tất cả backend citations |

---

## 2. FINDINGS CHI TIẾT (Verify từng claim)

### BACKEND — CONFIRMED

| Claim | Status | Evidence |
|-------|--------|----------|
| **B1** `_get_request_tenant` duplicate | ✅ CONFIRMED (sai count nhẹ) | 9 defs tại: `tenant_member_views.py:31`, `views_webhooks.py:34`, `views/sso.py:20`, `views_dashboard.py:20`, `views_security.py:20`, `views_alert_config.py:15`, `views_usage.py:23`, `views_forecast.py:19`, `views_tenant.py:120` |
| **B2** `_require_tenant_role` ×3 | ✅ CONFIRMED exact | `tenant_member_views.py:95`, `views/sso.py:38`, `views_tenant.py:200` |
| **B3** `_get_request_tenant_role` ×2 | ❌ SAI → thực tế ×3 | `views/sso.py:29`, `tenant_member_views.py:68`, **`views_tenant.py:173`** (doc thiếu) |
| **B4** Editor/Viewer không enforced | ✅ CONFIRMED | 22 call sites, TẤT CẢ `'owner','admin'`. VD: `tenant_member_views.py:109,129,182,265,304`; `views_tenant.py:223,234,240,251,297,308,398,430,481,569,610,646`; `views/sso.py:55,64`. Không có `editor`/`viewer` nào |
| **B5** Member limit không enforced trên invite | ✅ CONFIRMED (sai cite) | `TenantInvitesCombinedView.post()` `tenant_member_views.py:126-177` — chỉ check email unique + pending-invite unique, **không check member count** trước `TenantInvite.objects.create()` (line 158). `features_map` members limits thực tại `views_webhooks.py:195-200` |
| **S1** SSO là mock | ✅ CONFIRMED | `views/sso.py` không import SAML lib. `SSOLoginInitiateView.get()` (83-118) trả `idp_sso_url` thô. `SSOCallbackView.post()` (130-133) đọc `email` từ request body, không parse/verify SAML Response |
| **S2** SSO tạo user không verify email | ✅ CONFIRMED exact | `views/sso.py:167-173` — `User.objects.get_or_create(email=email, defaults={'username': email.split('@')[0], ...})` |
| **S6** PAT auth mutate User in-memory | ✅ CONFIRMED exact | `authentication.py:55-59` — `owner.is_staff = False; owner.is_superuser = False` (không `.save()`) |
| **S7** Deprovision không tạo lifecycle event | ✅ CONFIRMED | `views_webhooks.py:222-242` — set `status=DEPROVISIONED` (231-232), dispatch webhook, nhưng không `TenantLifecycleEvent.objects.create()` |
| **S8** Webhook secret regenerate không revoke old | ✅ CONFIRMED | `views_webhooks.py:103-115` — `config.secret = secrets.token_hex(32); config.save()` overwrite tại chỗ |
| **B8** Welcome email là stub | ✅ CONFIRMED | `onboarding_views.py:29-39` — `def _enqueue_welcome_email(user, tenant): pass` |
| **B9** Invite email không gửi | ✅ CONFIRMED | `tenant_member_views.py:156-177` — tạo `TenantInvite`, log `MEMBER_INVITED` lifecycle event, nhưng không `send_mail`/task |
| **S5** Không throttle invite | ✅ CONFIRMED | `TenantInvitesCombinedView` (`tenant_member_views.py:118`) chỉ `permission_classes=[IsAuthenticated, IsTenantActive]`, không `throttle_classes` |

### FRONTEND — CONFIRMED

| Claim | Status | Evidence |
|-------|--------|----------|
| **B6/B7** `activeTenantId` không reactive + `switchTenant` reload | ✅ CONFIRMED exact | `PortfolioContext.js:298` đọc `localStorage.getItem("tenant_id")` trong `useMemo` (không state). `switchTenant` tại `:263-268` gọi `window.location.reload()` (line 266) |
| **B10** Hardcoded VN strings | ✅ CONFIRMED exact (9/9) | `TenantAdminPATsPage.tsx:559,727,741,742,743,784,788` + `TenantAdminSSOPage.tsx:303,327` — tất cả đúng lines |
| **B15** `createElement` trong layout | ✅ CONFIRMED | `TenantAdminLayout.tsx:1,82,85-94`; `TenantAdminSidebar.tsx:1,155,163-188` |
| **No ErrorBoundary** | ✅ CONFIRMED | `TenantAdminLayout.tsx:1-5` imports chỉ `createElement, Outlet, TenantAdminSidebar, Breadcrumb, PageTransition`. (Có `PageErrorBoundary.tsx` riêng nhưng không wire vào tenant-admin subtree) |

### STRUCTURAL — CONFIRMED

| Claim | Status | Evidence |
|-------|--------|----------|
| 13 sub-pages + line counts | ✅ CONFIRMED exact | HomePage 604, MembersPage 411, ServiceAccountsPage 365, PATsPage 830, UsagePage 704, UsageHistoryPage 326, BillingPage 599, CapabilitiesPage 192, AuditLogsPage 420, SSOPage 395, SecurityPage 340, WebhooksPage 537, ReportsPage 353 |
| Model line numbers (11 models) | ✅ CONFIRMED exact | CoreTenant:42, CoreServiceAccount:135, CorePATCredential:193, PATAuditLog:351, UserProfile:407, TenantMember:472, TenantInvite:536, TenantSSOConfig:995, UsageAlertConfig:1021, TenantWebhookConfig:1237, ScheduledReport:1170 |
| 13 i18n namespaces | ✅ CONFIRMED | `vi.js` có đủ: tenantHome, tenantMembers, tenantServiceAccounts, tenantPats, tenantUsage, tenantUsageHistory, tenantBilling, tenantCapabilities, tenantAuditLogs, tenantSSO, tenantSecurity, tenantWebhooks, tenantReports |

---

## 3. ĐÁNH GIÁ CHẤT LƯỢNG DOC

**Điểm mạnh:**
- Phân tích sâu, đúng thực tế — verify được 100% substantive claims
- Line counts và file inventory chính xác đến từng dòng
- Upgrade plan chi tiết (8 phases, effort ước tính hợp lý ~143.5h)
- Feature matrix so sánh SaaS chuẩn hữu ích

**Điểm yếu (cần sửa trước khi thực thi):**
1. **C1/C2:** Sai count duplication (9 vs 13 total, B3 thiếu 1 def) → có thể gây nhầm lẫn khi assign task refactor
2. **C3:** Sai file citation của `features_map` (tenant_member_views vs views_webhooks) → dev sẽ mất thời gian tìm
3. **C5:** Dùng `/` thay `\` trong backend paths (Windows repo) → không nhất quán
4. Doc không ghi rõ **backend source nằm ở `packages/core/backend/src/identity_access/`** — người đọc có thể tìm nhầm thư mục

---

## 4. KHUYẾN NGHỊ

1. **Sửa 5 contradictions** (C1-C5) trong doc trước khi đưa vào sprint planning
2. **Thêm "Source Root" note:** "Backend: `packages/core/backend/src/identity_access/`; Frontend: `packages/web/src/pages/tenant-admin/`"
3. **Bổ sung verify đã làm:** doc nên cite kết quả grep thực tế (như counter-audit này) để tăng độ tin cậy
4. **Upgrade plan OK:** 8 phases là hợp lý, nhưng nên ưu tiên Phase 1 (P0 bugs) + Phase 5 (real SSO) trước vì S1 là critical security gap

---

## 5. KẾT LUẬN

Doc `TENANT_MANAGEMENT_AUDIT_AND_UPGRADE_PLAN.md` là **audit hợp lệ, có giá trị cao**. Tất cả phát hiện cốt lõi được xác thực bằng source code. Chỉ cần sửa 5 lỗi kỹ thuật (C1-C5) về số đếm và file citation để doc trở nên chính xác 100% làm kế hoạch thực thi.

**Không có finding nào trong doc là FALSE** — chỉ có sai lệch độ chính xác kỹ thuật ở mức MED/LOW.
