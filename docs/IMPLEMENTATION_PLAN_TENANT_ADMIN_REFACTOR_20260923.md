# IMPLEMENTATION PLAN — Refactor Tenant Admin thành Admin Console (staff-only) (2026-09-23)

> Mục tiêu: biến 8 trang `AdminCore*` orphan + endpoint operator rời rạc thành
> **Admin Console thống nhất** ở mục Quản trị (`/admin/*`, staff-only),
> đúng chuẩn SaaS (WorkOS/Clerk: admin plane tách khỏi self-service, RBAC,
> audit mọi write). Bổ sung 5 slice còn thiếu: Tenants hoàn thiện, Billing tổng,
> Usage tổng, Nhật ký tổng, Staff-switch (A3).
> Đội code làm theo slice, không cần hỏi lại.

**TRẠNG THÁI: ĐÃ THỰC THI R0–R7 (Ledger Entry 182, evidence `docs/evidence/tenant-admin-refactor/gates.md`).**
Gates: tsc 0, build 47.18s PASS, lint 0 errors, vitest R-slices 26/26,
vitest full 420/421 (1 fail pre-existing ngoài scope), jest soc 96/96,
BE mới 22/22, check 0, i18n:scan 0.
- Lệch đã xử lý: `/tenant-admin` bọc `TenantRoute` (không `StaffRoute`) để khỏi khoá
  owner tự quản; modal Xem hộ sửa prefix qua adapter `staffSwitch`;
  test switch-header dùng `client.login` (force_authenticate bypass middleware).

**Trạng thái HEAD 6d127cd6 (Entry 176, đã verify — tsc 0, vitest 19/19,
build 35.54s PASS, lint 0 errors, i18n:scan exit 0):**
- Users đã ở đúng chỗ: SOC còn 8 tabs (xoá `users` khỏi `SOC_TABS`/case/descriptions),
  `/admin/users` đủ 4 tầng (route `main.tsx:126`, registry `admin-users`,
  catalog `routeCatalog` group admin, menu `sidebaritems.ts:56` staffOnly) —
  wrapper `AdminUsersPage.tsx:1-12` render `SocUsersPanel`.
- Polish P1 xong + đã verify: `.socDataTable` (`soc.components.css:1037-1082`),
  badges Plan/Active/Staff (`SocUsersPanel.tsx:216-221`), lock reason vào modal
  (`:244-260`), pagination `page_of` (`:232-241`), export CSV (`:194-195`),
  Keys secret amber + copy (`TenantKeysPage.tsx:186-194`), Usage `unlimited`
  (`TenantUsageSummaryPage.tsx:62`) + empty riêng (`:114,136`).
  `soc.tabs.users*` đã xoá sạch (grep 0 hit).
- Chưa làm (phần còn lại của plan này): **StaffRoute** (grep `StaffRoute|RequireStaff`
  0 hit — route vẫn chỉ `ProtectedRoute`), 8 trang `AdminCore*` vẫn orphan,
  dead links `/admin/core/*` còn nguyên, `can*=true` hardcode còn nguyên,
  3 fleet endpoints + staff-switch chưa có.
- Lệch so với phụ lục A2 cũ (viết "tab SOC Users"): thực tế chốt **`/admin/users`**,
  đúng directive "không thêm tab SOC" — A2 coi như DONE tại vị trí mới.

**Hiện trạng verify (không suy luận):**
- 8/8 `AdminCore*` functional read-only, có registry (`pageRegistry.js:242-257`)
  nhưng **không route/catalog/menu** → orphan; dead links `/admin/core/*` khắp nơi.
- BE operator đủ cho tenants/SA/PATs/overview/health/jobs/audit-requests
  (`contracts/operator/*`, guard `IsAdminUser`); **thiếu**: billing aggregate,
  usage aggregate, audit cross-tenant đúng, staff-switch.
- A2 Users đã đúng chỗ (`/admin/users` + menu + catalog); B+A `/tenant/*` giữ nguyên.
- `OperatorTenantListView` **không paginate**; `/core/v1/audit-log` bóp staff có
  tenant về 1 tenant (`ops_audit/views.py:18-20`); `can*=true` hardcode 2 trang.

---

## 1. IA đích + quyết định chốt (D-R1–D-R9)

**Route map** (dưới AppShell+`StaffRoute`, registry+catalog+menu đủ 3 tầng):

| Path | Page | Menu |
|---|---|---|
| `/admin/users` | ✅ DONE 6d127cd6 (A2 + polish P1) | có sẵn |
| `/admin/tenants` | `AdminCoreTenantsPage` (R0 wire) | mới: Tenant |
| `/admin/tenants/:tenantId/service-accounts` | có sẵn (R0 wire) | deep-link |
| `/admin/tenants/:tenantId/pats` | có sẵn (R0 wire) | deep-link |
| `/admin/tenants/:tenantId/usage` | có sẵn (R0 wire) | deep-link |
| `/admin/tenants/:tenantId/billing` | có sẵn (R0 wire) | deep-link |
| `/admin/overview`, `/admin/jobs`, `/admin/audit-trace` | 3 trang có sẵn (R0 wire) | deep-link (không menu) |
| `/admin/billing` | mới (R2) | mới: Billing tổng |
| `/admin/usage` | mới (R3) | mới: Usage tổng |
| `/admin/audit` | mới (R4) | mới: Nhật ký |

- D-R1: **Không thêm tab SOC** — mọi quản trị tập trung ở `/admin/*`.
- D-R2: catalog `group:"admin"`, `requiredCapabilities:["admin.operator.read"]`,
  `status:"core"`; **SKIP `navigationCatalog`** (dead code, zero consumer — C4).
- D-R3: `OperatorTenantListView` chuyển `StandardPageNumberPagination`, **giữ**
  `summary_cards`; FE + BE cùng slice R1 (đổi shape 1 lần).
- D-R4: endpoint fleet mới đặt dưới **`/api/soc/*`** (kế thừa `SOCBaseView` =
  `IsAdminUser` + `SOCOperatorReadThrottle`, envelope chuẩn) — không đặt `/operator/*`.
- D-R5: audit viewer dùng endpoint mới, **giữ nguyên** `/core/v1/audit-log` (compat).
- D-R6: staff-switch = token ký Django (`TimestampSigner`, TTL 30 phút), header
  `X-Staff-Switch`; middleware validate → tenant target + role ép `viewer` +
  `request.staff_switch=True`; issuance ghi `AuditEvent`; target phải ACTIVE,
  cấm switch về chính tenant mình (400); reason ≥5 ký tự.
- D-R7: xoá affordance giả — `canCreate/canUpdate/canIssue/canRotate/canRevoke`
  hardcode `true` → ẩn nút write, tooltip "Read-only ở phase này".
- D-R8: i18n `layout.nav.adminTenants/adminBilling/adminUsage/adminAudit` +
  `routes.*` + `adminConsole.*` (S0 grep key cũ trước, mirror vi/en, scan 0).
- D-R9: A2 giữ nguyên ở `/admin/users` (đúng chỗ, không dời vào SOC tab).
- D-R10 (đồng nhất visual, từ polish 6d127cd6 đã verify): mọi trang mới/tái wire
  R0–R4 **tái dùng** `.socDataTable/.socDataTableWrap` + `Badge` tones
  (`ok/off/info`) + pagination `page_of` + `ShellEmptyState` copy riêng +
  secret-once amber — cấm table trần/button trần (lỗi U1/G2 đã đóng, không tái phạm).

**Audit độc lập commit 6d127cd6 (người audit: session này, 2026-09-23):**
đọc diff full 17 files + grep (`soc.tabs.users` 0 hit, `StaffRoute` 0 hit) +
chạy lại gates: `tsc` 0, vitest 4 files/19 tests PASS
(soc-users 4 + menu-contract 8 + tenant-keys/usage 7), `vite build` 35.54s PASS,
`eslint` 0 errors, `i18n:scan` exit 0 (không dirty file).
BE không chạy lại (commit không đụng BE — `SocUsers` 8/8 theo evidence team).
Kết luận: P0+P1 **khớp claims**, plan này đã cập nhật theo đúng HEAD.

## 2. Ma trận phân quyền (chốt — reviewer đối chiếu từng slice)

| Surface | Staff/Superuser | Owner/Admin/Editor/Viewer (có tenant) | Không tenant | Machine PAT |
|---|---|---|---|---|
| Menu Quản trị + `/admin/*` (R0 StaffRoute) | ✅ full | ❌ redirect `/dashboard` + notice | ❌ như member | ❌ 403 (strip staff) |
| `/api/soc/*` + `/operator/*` (BE) | ✅ (`IsAdminUser`) | ❌ 403 | ❌ 403 | ❌ 403 |
| Staff-switch (R6) | ✅ (ghi audit) | ❌ 403 | ❌ | ❌ |
| `/tenant/*`, `/tenant-admin/*`, `/partner/*` | như owner tenant mình | theo role/ability hiện hành (không đổi) | 403 middleware | theo scope+role hiện hành |
| Fleet billing/usage/audit (R3-R5) | ✅ staff-only | ❌ (kể cả `billing:read` — đó là tenant-scope) | ❌ | ❌ |

## 3. Slices (R0–R7)

### R0 — StaffRoute + wire orphans + fix links (nền, không migration)
- `StaffRoute` mới (`main.tsx`, cạnh `ProtectedRoute :61-82`): `isStaff||isSuperuser`
  từ `userIdentity`, thiếu → `<Navigate to="/dashboard">` + toast notice.
  Bọc mọi route `/admin/*` + `/operations-center*` + `/tenant-admin`
  (hiện tại grep `StaffRoute` 0 hit — **chưa có**, vẫn chỉ `ProtectedRoute`).
- Routes mới: 6 trang `AdminCore*` có sẵn (Tenants, SA, PATs, Usage, Billing per-tenant,
  Overview, Jobs, AuditTrace) + `/admin/users` **đã xong ở 6d127cd6 (bỏ qua)**.
  Registry id giữ nguyên `admin-core-*`; catalog `group:"admin"`; sidebar thêm **1 mục
  duy nhất: Tenant** (`/admin/tenants`) — Billing/Usage/Audit có menu riêng ở R3-R5,
  còn lại deep-link.
- Sửa **mọi** dead link `/admin/core/*` trong 8 file + `SocRuntimeKpiPanel.tsx:142`
  sang paths §1 (liệt kê từng file khi làm, grep `admin/core` phải 0 hit).
- Page gate: mỗi AdminCore page thêm `isStaff` early-return 403-UX (mẫu `noPermission`
  tenant-admin; `SocUsersPanel` đã có pattern table/badge/modal để tái dùng class CSS).
- Tests (5): StaffRoute chặn non-staff; menu Tenant khi staff / ẩn khi non-staff
  (mẫu menu-contract đã có cho `/admin/users` ở 6d127cd6);
  catalog cover paths mới; dead-link grep 0; orphan page render với mock adapter.
- DoD: gõ tay 6 URL đều mở khi staff, redirect khi non-staff; evidence `r0/`.

### R1 — Tenants hoàn thiện (BE phân trang + drill-down)
- BE `operator_tenant_views.py`: `OperatorTenantListView` + `StandardPageNumberPagination`
  (giữ `summary_cards`, envelope `{count,next,previous,results}`); N+1 check
  (prefetch SA/PAT counts).
- FE `AdminCoreTenantsPage`: đọc shape mới; detail panel giữ; nút "Xem hộ" (mở modal
  reason → gọi R6 API) mỗi row.
- Tests (4): paginate keys; filter search/status; N+1 assert; FE render + link drill
  resolve (không dead).
- DoD: 1000 tenant seed page 1 <200ms (ghi số vào evidence `r1/`).

### R2 — (giữ số) BE billing fleet — gộp vào R3? KHÔNG. R2 = Billing tổng
- `service_ops/views/billing.py` (mới, `SOCBaseView`):
  `GET /api/soc/billing/overview/` → `{mrr, arr, plan_mix[{plan,count,mrr}],
  trials_expiring_7d, invoices_failed_30d, revenue_6m[{month,total}]}` từ
  `Subscription/Invoice/CoreTenant` (read-only aggregate, không join N+1).
  `GET /api/soc/billing/invoices/` (Standard paginate): filter
  `status/plan/search(tenant_code,email)/from/to`.
- FE `AdminBillingFleetPage` (`/admin/billing`): cards MRR/ARR/trial/failed + chart 6m
  + bảng invoices + link drill per-tenant billing.
- Adapter `soc.js`: `getSocBillingOverview/getSocBillingInvoices` (pattern `createSocClient`).
- Tests (5): MRR khớp seed; filter; paginate; non-staff 403 cả 2; FE render cards.
- DoD: số MRR đối chiếu tay 3 tenant mẫu (evidence `r2/`).

### R3 — Usage tổng
- `service_ops/views/usage.py` (mới): `GET /api/soc/usage/overview/` →
  `{calls_today, calls_30d, error_rate_30d, top_tenants[{tenant_code,display_name,calls,errors}],
  quotas_near_limit[{tenant_code,meter,used_pct}]}` từ `ApiCallRollup` + `QuotaRecord`.
  Aggregate DB-side (`Sum/Count`), không kéo rows về Python.
- FE `AdminUsageFleetPage` (`/admin/usage`): cards + top-tenant table + quotas cảnh báo.
- Tests (5): tổng khớp seed; top sort đúng; quota threshold; 403; FE render.
- DoD: evidence `r3/`.

### R4 — Nhật ký tổng
- `service_ops/views/audit.py` (mới): `GET /api/soc/audit-events/` (Standard paginate):
  filter `tenant_id/actor/action/resource_type/resource_id/from/to/search`,
  order `-occurred_at`. Đọc `AuditEvent` trực tiếp — **true cross-tenant**
  (không bóp theo `core_tenant` như endpoint cũ).
- FE `AdminAuditPage` (`/admin/audit`): filter 6 trường + table + detail JSON.
- Tests (4): filter combo; staff có owned-tenant vẫn thấy multi-tenant (regression flaw cũ);
  403; FE render.
- DoD: evidence `r4/`.

### R5 — Staff-switch A3
- BE `service_ops/views/staff.py` (mới): `POST /api/soc/staff/switch/`
  `{tenant_id, reason≥5}` → 400 (lý do ngắn/chính tenant mình/tenant không ACTIVE),
  404 tenant không tồn tại; ký token `{staff_id, tenant_id, exp}` TTL 30m;
  ghi `AuditEvent(action='access', resource_type='staff_switch', metadata={reason})`;
  trả `{token, tenant:{...}, expires_at}`.
  Middleware: header `X-Staff-Switch` → verify chữ ký + staff còn hiệu lực →
  `request.tenant=target, tenant_role='viewer', staff_switch=True`; token hỏng/hết hạn → 403.
  Mọi write qua switch vẫn qua permission layer (role viewer → chỉ đọc).
- FE: nút "Xem hộ" (Tenants/Users rows) → modal reason → banner "Đang xem hộ TENANT X —
  Thoát" (sessionStorage key riêng, không đè `tenant_id`); nút Thoát xoá.
- Tests (6): switch OK + audit ghi; reason ngắn 400; chính mình 400; tenant lạ 404;
  token giả/hết hạn 403; write qua switch bị chặn (viewer).
- DoD: evidence `r5/` + demo clip/screenshot banner.

### R6 — Gates hardening + dọn affordance giả
- D-R7 toàn bộ AdminCore SA/PATs; page-level `isStaff` gate (R0 mẫu) cho mọi trang
  còn thiếu; `useTenantSelfQuery`-scope không lẫn (`tenant-self` vs admin).
- Tests (3): nút write ẩn/tooltip; non-staff URL → redirect (integration với R0).
- DoD: grep `= true` hardcode quyền = 0 hit trong `pages/admin/`.

### R7 — Đóng
Full gates (tsc/build/lint/vitest/jest/BE/`manage.py check`/`i18n:scan`) + evidence
`docs/evidence/tenant-admin-refactor/` + ledger + AGENTS progress.

## 4. Tiêu chí phản biện (reviewer tick trước merge, mỗi slice)

T1. Route+registry+catalog+menu đủ 4 tầng? (grep path ra 4 nơi)
T2. Dead link `/admin/core/*` = 0? T3. Non-staff mở URL → redirect (test)?
T4. BE mới có `IsAdminUser` qua `SOCBaseView` (không override)? T5. Paginate mọi list
   (không trả full-table)? T6. Số aggregate đối chiếu tay ≥3 mẫu?
T7. Mọi write/audit/switch ghi `AuditEvent` (reason vào metadata)?
T8. Secret/token không lọt log/response GET? T9. i18n vi=en 1-1 + scan 0?
T10. Không thêm tab SOC, không đụng `/tenant/*`, không đổi abilities?

## 5. Ngoài phạm vi (ghi rõ để khỏi scope-creep)

- Re-home `/tenant-admin` khỏi menu Quản trị (defer Phase 4 UX).
- Sửa endpoint cũ `/core/v1/audit-log`, `admin_ops` 410 (giữ nguyên).
- Write action SA/PATs operator (giữ read-only + tooltip).
- `navigationCatalog` (dead — không chạm).
- Machine PAT vào SOC (giữ chặn).

## 6. Thứ tự + evidence

R0 → R1 → R2 → R3 → R4 → R5 → R6 → R7 (R2-R4 song song được khi xong R0).
Evidence mỗi slice: test log + build log + screenshot role staff/non-staff.
