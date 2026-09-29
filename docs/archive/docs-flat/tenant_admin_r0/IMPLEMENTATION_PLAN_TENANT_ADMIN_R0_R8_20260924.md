# IMPLEMENTATION PLAN — Admin Console R0–R8 (bản tổng hợp thi công, 2026-09-24)

> **TRẠNG THÁI: ĐÃ THỰC THI H0 + R0–R8 (Ledger Entry 185).**
> Gates cuối: tsc 0, build PASS, lint 0 errors, vitest R 36/36,
> BE 35/35 (tenants 5, billing 4, usage 4, audit 5, staff 8, analytics 7, invite 2),
> check 0, i18n:scan 0, jest soc 96/96.
> Lệch đã xử lý: `?format=csv` → `?download=csv` (DRF nuốt `format` → 404);
> modal switch dùng adapter `staffSwitch`; test switch-header dùng `client.login`.

> Một tài liệu duy nhất để đội code thi công không hỏi lại.
> - **H0**: hotfix bắt buộc (chưa làm) — đi kèm commit R0–R7.
> - **R0–R7**: đã thực thi xong (as-built, Entry 182) — ghi lại contract thực tế + evidence để đối chiếu.
> - **R8**: Analytics mới (tăng trưởng, cohort, export CSV, cảnh báo).
> Quy ước chung: staff-only (`SOCBaseView`/`IsAdminUser` + `StaffRoute` + gate trang);
> `tsc` sau sub-step, `build` cuối slice; VI full dấu; evidence
> `docs/evidence/tenant-admin-refactor/`.

## H0 — HOTFIX (làm TRƯỚC khi commit R0–R7)

### H0.1 Staff-switch leo thang (CRITICAL)
- Yêu cầu: phiên xem hộ **không** gọi được bất kỳ endpoint staff-only nào.
- Sửa `identity_access/middleware.py::_resolve_staff_switch`: sau khi gán tenant/role,
  strip `user.is_staff=False; user.is_superuser=False` trên request (request-scoped,
  mirror `apply_pat_user_privileges`, `resolve_tenant.py:79-89`).
- Test: switched-session `GET /api/soc/users/` → 403; `GET partner usage` → 200
  (viewer read giữ nguyên); superuser + switch-header → behavior cũ (bypass, ghi chú).
- Evidence: test log. Rebuttal: T1 (403 kèm header switch).

### H0.2 Route crawl-control (CRITICAL)
- Bọc `StaffRoute` cho `admin-crawl-control` (`main.tsx:113`, mẫu các route `/admin/*`);
  test redirect non-staff (mẫu `staff-route.component.test.tsx`).

### H0.3 Invite role=owner (CRITICAL)
- Serializer invite: reject `role='owner'` → 400 (`serializers.py:326` choices);
  test member invite owner → 400; owner-transfer là flow riêng (ngoài scope đợt này).

### H0.4 Dead links (LOW)
- `AdminCoreOverviewPage.tsx:154`, `AdminCoreAuditTracePage.tsx:297`:
  `/admin/runtime/jobs` → `/admin/jobs`; evidence: grep `admin/runtime/jobs` 0 hit.

## R0–R7 — AS-BUILT (đã xong, đối chiếu khi review)

### R0 — Guards + wire (DONE, Entry 182)
`StaffRoute`+`TenantRoute` (`components/StaffRoute.tsx`); 9 routes `/admin/*`
(`main.tsx:127-139`); 8 catalog group admin; menu Tenant (`sidebaritems.ts`);
i18n `adminTenants/adminOverview/adminJobs/adminAuditTrace`;
8 trang fix links (grep `admin/core` 0) + gate `isStaffGate`
(Tenants fetch-skip; 7 trang còn lại render-gate); runtime-kpi link → `/admin/usage`.
Tests: staff-route 4, menu-contract, tenants-page 4. Gates R0: tsc 0, vitest 14/14, build PASS.

### R1 — Tenants phân trang + Xem hộ (DONE)
BE `OperatorTenantListView` + `StandardPageNumberPagination`, giữ `summary_cards`,
thêm `count/next/previous` (`operator_tenant_views.py:181-207`); FE pager + modal reason
(`AdminCoreTenantsPage.tsx`, POST qua adapter `staffSwitch` → `/operator/soc/staff/switch/`).
Tests BE 5 (envelope, page2, filter, N+1 ≤8); FE 4.

### R2 — Billing fleet (DONE)
`GET /api/soc/billing/overview/` → `{mrr, arr, currency, plan_mix[], trials_active,
invoices_failed_30d, revenue_6m[]}` (MRR = Σ `PLAN_PRICES_VND` subscription ACTIVE);
`GET /api/soc/billing/invoices/` (Standard paginate, filter status/plan/search, 400 status sai)
(`service_ops/views/billing.py`, mount `urls.py:75-76`).
FE `/admin/billing` (`AdminBillingFleetPage.tsx`) + adapter `getSocBillingOverview/Invoices`
(`soc.js`) + menu/catalog/registry + i18n `adminBillingFleet.*`.
Tests BE 3 (MRR 600k seed, filter, paginate); FE 2.

### R3 — Usage fleet (DONE)
`GET /api/soc/usage/overview/` → `{calls_today, calls_30d, error_rate_30d,
top_tenants[10], quotas_near_limit[]}` aggregate DB-side (`views/usage.py`).
FE `/admin/usage` + adapter + menu/catalog/i18n `adminUsageFleet.*`.
Tests BE 3; FE 2.

### R4 — Audit cross-tenant (DONE)
`GET /api/soc/audit-events/` (Standard paginate; filter tenant_id/actor/action/resource/
from/to/search; action sai → 400) — đọc `AuditEvent` trực tiếp, true cross-tenant
(`views/audit.py`). FE `/admin/audit` + adapter + menu/catalog/i18n `adminAudit.*`.
Tests BE 4 (incl. staff-có-tenant regression); FE 2.

### R5 — Staff-switch (DONE + H0.1 bổ sung)
`POST /api/soc/staff/switch/` `{tenant_id, reason≥5}` → 400/404 các case + token ký
`TimestampSigner` TTL 30m + `AuditEvent` (`views/staff.py`); middleware `X-Staff-Switch`
→ tenant + role `viewer` + `staff_switch=True`, từ chối machine-PAT; transport gửi header;
banner + thoát (`StaffSwitchBanner.tsx`, mount `FullLayout.tsx:87`).
Tests BE 7; FE banner 2 + modal (R1).

### R6 — Hardening (DONE)
`can*=true` → false + tooltip read-only (SA/PATs pages, grep 0); test SA 2/2.

### R7 — Gates (DONE, Entry 182)
tsc 0, build 47.18s, lint 0 errors, vitest R 26/26 (full 420/421 — 1 pre-existing ngoài
scope), jest soc 96/96, BE 22/22, check 0, i18n:scan 0. Evidence `gates.md`.

## R8 — ANALYTICS (mới, 4 sub-slices, staff-only, read-only, không migration)

### R8.1 Tăng trưởng
- `GET /api/soc/analytics/growth/?days=30|90` (`service_ops/views/analytics.py` mới,
  `SOCBaseView`, mount `urls.py`): từ `auth.User.date_joined`,
  `CoreTenant.created_at/status`, `Subscription.created_at` →
  `{signups:[{date,count}], trials:[...], paid_new:[...], churned:[...]}` (aggregate
  DB-side theo ngày, đủ ngày trống = 0).
- FE: section biểu đồ trong trang `/admin/analytics` mới (reuse recharts BarChart mẫu
  UsageHistory; ngày trục X, 4 series).
- Adapter `soc.js`: `getSocAnalyticsGrowth(days)`. Registry `admin-analytics`,
  route `/admin/analytics` (StaffRoute), catalog group admin, menu `adminAnalytics`
  (icon `TrendingUp`? đã dùng cho Billing — dùng `LineChart` whitelist),
  i18n `adminAnalytics.*` (vi/en).
- Tests BE 3 (số khớp seed incl. ngày trống; days clamp 1..90; 403).
  Tests FE 2 (render chart với mock; non-staff noPermission + skip fetch).
- DoD: số đối chiếu tay 5 ngày mẫu. Evidence `r8.1/`.

### R8.2 Cohort plan
- `GET /api/soc/analytics/cohorts/` → `{trial_active, trial_expired,
  ever_paid, conversion_rate, plan_mix_hiện_tại[], upgrades_30d, downgrades_30d}`
  (up/down từ `AuditEvent` set-plan `metadata.from/to`; conversion = tenants có
  invoice paid / tenants từng trial = `status TRIAL` hiện tại + đã từng có subscription).
  Định nghĩa chốt trong response `notes` để FE hiển thị (tránh hiểu nhầm).
- FE: section cohort (cards + bảng migration) cùng trang analytics.
- Tests BE 3 (conversion công thức; upgrade đếm từ audit; 403). FE 1 (cards render).
- DoD: công thức conversion review đúng định nghĩa. Evidence `r8.2/`.

### R8.3 Export CSV
- Thêm `?download=csv` vào `billing/invoices` +
  `audit-events` (BE stream CSV,
  mẫu `partner_api_export`, header `Content-Disposition attachment`); usage overview
  thêm endpoint `GET /api/soc/usage/export/?days=` (top tenants + quotas CSV).
- FE: nút Export mỗi trang Billing/Usage/Audit (mẫu nút CSV SocUsersPanel).
- Tests BE 3 (header csv + dòng đầu đúng cột; filter áp dụng vào export).
  Tests FE 1 (click export gọi đúng URL có download=csv).
- DoD: mở file CSV đúng UTF-8 + cột. Evidence `r8.3/`.

### R8.4 Cảnh báo
- `GET /api/soc/analytics/alerts/` → `{trials_expiring_3d[], quotas_critical[]
  (used≥90), invoices_past_due[], suspended_spike_7d}` — computed read-only từ models
  hiện có, không scheduler (scheduler là follow-up ngoài scope).
- FE: section cảnh báo đầu trang analytics (list + link drill).
- Tests BE 2 (trial sắp hết lọt vào list; tenant bình thường không lọt). FE 1.
- DoD: seed 1 case mỗi loại đều hiện. Evidence `r8.4/`.

## NGHIỆM THU TỔNG (R0–R8) + PHẢN BIỆN

- [ ] H0 4 mục có test hồi quy; T1 switched-session gọi SOC → 403.
- [ ] R0–R7 giữ nguyên xanh (gates R7 chạy lại sau H0).
- [ ] R8: số growth/cohort đối chiếu tay; CSV mở đúng; alert seed hiện đủ.
- [ ] Rebuttal T1–T10 (refactor plan) + T-new: export không lộ secret (PAT secret
  không bao giờ vào CSV); analytics aggregate DB-side (không kéo full-table);
  menu/catalog/route đủ 3 tầng cho `/admin/analytics`.
- [ ] Evidence mỗi slice + ledger entry khi đóng.
