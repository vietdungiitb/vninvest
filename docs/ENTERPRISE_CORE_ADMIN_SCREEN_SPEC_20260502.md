# ENTERPRISE CORE ADMIN SCREEN SPEC

**Date:** 2026-05-02  
**Status:** Screen-level implementation spec for admin surfaces  
**Purpose:** Chi tiết hóa `Core Admin UI` xuống mức screen contract để team frontend có thể dựng flow, states, widgets và action model mà không phải suy đoán từ architecture doc.

**Companion artifact:**

- [ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502](./ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md)

---

## 1. Vai trò của tài liệu này

Tài liệu này đứng sau:

- [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
- [ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md)
- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)

Nó tập trung vào 3 câu hỏi thực dụng:

1. Mỗi screen hiển thị cái gì?
2. Gọi API nào?
3. Có các trạng thái loading/empty/error/stale/action nào?

---

## 2. Current-code alignment

Frontend hiện tại đã có các primitive phù hợp để dựng admin surfaces mà không cần đổi framework:

- routing trong `frontend/src/App.jsx`,
- guard qua `frontend/src/components/ProtectedRoute.jsx`,
- element gating qua `frontend/src/components/Can.jsx`,
- ability state trong `frontend/src/context/PortfolioContext.jsx` và `frontend/src/context/AbilityContext.js`.

Do đó screen spec này giả định admin UI sẽ bám theo các primitive trên, không tạo hệ permission song song phía frontend.

---

## 3. Layout shell chung

Mọi admin screens nên dùng cùng một shell:

1. **Page header**
   Title, subtitle, breadcrumb, status badges.
2. **Context bar**
   Environment, tenant scope, build target, request freshness.
3. **Primary action row**
   Nút tạo mới, refresh, export, retry hoặc manual actions.
4. **Body region**
   Cards, tables, detail panels hoặc split-view.
5. **Feedback region**
   Inline success, error, warning, stale banners.

### Trạng thái chuẩn

Mọi screen đều phải có:

- skeleton/loading state,
- empty state,
- partial data / stale state,
- fatal error state,
- mutation success/error state.

---

## 4. Central Operator Admin screen specs

## 4.1 Platform Overview

**Route:** `/admin/core/overview`  
**Ability:** `read CoreAdminOverview`

### Mục tiêu

- cho operator thấy tình trạng tổng thể platform,
- phát hiện nhanh queue lag, materialization lag, quota incidents, runtime degradation.

### Primary widgets

1. Health summary cards
2. Queue and worker status strip
3. Materialization lag table
4. Recent quota/billing incidents panel
5. Recent alerts/anomalies panel

### Primary APIs

- `GET /core/v1/operator/overview`
- `GET /core/v1/operator/health`
- `GET /core/v1/operator/jobs?status=running,failed`

### Actions

- refresh screen,
- drill into jobs,
- drill into affected tenant,
- export incident list if allowed.

### States

- warning banner when health is degraded,
- stale badge if snapshot older than threshold,
- partial render if one widget fails but others succeed.

---

## 4.2 Tenant Registry

**Route:** `/admin/core/tenants`  
**Ability:** `read CoreTenantRegistry`

### Mục tiêu

- tìm tenant,
- xem plan/status/usage posture,
- mở sang detail screens.

### Primary widgets

1. Search and filters: status, plan, environment, suspension state
2. Tenant table
3. Quick stats: total active, suspended, nearing quota, past due

### Primary APIs

- `GET /core/v1/operator/tenants`

### Row actions

- open detail,
- open service accounts,
- open PATs,
- open usage,
- open billing,
- suspend/unsuspend if allowed.

### States

- empty filtered result state,
- bulk loading state,
- inline row action pending state.

---

## 4.3 Tenant Detail Summary

**Route:** `/admin/core/tenants/:tenantId`  
**Ability:** `read CoreTenantRegistry`

### Mục tiêu

- thấy bức tranh tổng hợp về một tenant trước khi đi vào sub-screens.

### Primary widgets

1. Identity card
2. Plan and entitlement summary
3. Environment summary
4. Security posture summary
5. Commercial posture summary
6. Recent operator actions timeline

### Primary APIs

- `GET /core/v1/operator/tenants/{tenant_id}`

### Actions

- navigate sang service accounts/PATs/usage/billing,
- suspend/unsuspend tenant if allowed,
- copy tenant diagnostics summary.

---

## 4.4 Service Accounts

**Route:** `/admin/core/tenants/:tenantId/service-accounts`  
**Ability:** `read CoreServiceAccountAdmin`

### Mục tiêu

- quản trị machine principals theo tenant.

### Primary widgets

1. Service account list table
2. Filters: environment, status, policy bundle
3. Create/edit drawer
4. Detail side panel with recent token posture

### Primary APIs

- `GET /core/v1/operator/tenants/{tenant_id}/service-accounts`
- `POST /core/v1/operator/tenants/{tenant_id}/service-accounts`
- `PATCH /core/v1/operator/service-accounts/{service_account_id}`
- `POST /core/v1/operator/service-accounts/{service_account_id}/disable`

### Actions

- create,
- rename/update metadata,
- disable/enable,
- jump to PAT list.

### States

- validation errors inline in drawer,
- empty state for tenant with no service accounts,
- warning badge if service account has stale rotation posture.

---

## 4.5 PAT Credentials

**Route:** `/admin/core/tenants/:tenantId/pats`  
**Ability:** `read CorePATAdmin`

### Mục tiêu

- thấy token lifecycle và phản ứng nhanh khi credential có nguy cơ.

### Primary widgets

1. PAT list table
2. Filters: service account, status, expiry window, anomaly state
3. Issue token modal
4. Rotate token modal
5. Revoke confirmation modal
6. One-time secret reveal panel

### Primary APIs

- `GET /core/v1/operator/tenants/{tenant_id}/pats`
- `POST /core/v1/operator/tenants/{tenant_id}/pats/issue`
- `POST /core/v1/operator/pats/{token_id}/rotate`
- `POST /core/v1/operator/pats/{token_id}/revoke`

### Actions

- issue,
- rotate,
- revoke,
- copy token secret one time,
- open request audit filtered by token.

### States

- explicit warning state for one-time secret visibility,
- disabled action buttons when user lacks `issue/rotate/revoke`,
- anomaly flag state.

---

## 4.6 Tenant Usage and Quota

**Route:** `/admin/core/tenants/:tenantId/usage`  
**Ability:** `read CoreTenantCommercial`

### Mục tiêu

- xem consumption theo meter,
- phát hiện meter spikes,
- hỗ trợ support/commercial operations.

### Primary widgets

1. Quota summary cards
2. Meter table
3. Hourly trend chart
4. Overage and hard-stop panel

### Primary APIs

- `GET /core/v1/operator/tenants/{tenant_id}/usage`
- `GET /core/v1/operator/tenants/{tenant_id}/quotas`

### Actions

- filter by period,
- export usage report,
- drill into meter detail.

---

## 4.7 Tenant Billing

**Route:** `/admin/core/tenants/:tenantId/billing`  
**Ability:** `read CoreTenantCommercial`

### Mục tiêu

- theo dõi subscription, invoices, credits, overage state.

### Primary widgets

1. Subscription summary card
2. Credit balance panel
3. Invoice table
4. Past due alert panel

### Primary APIs

- `GET /core/v1/operator/tenants/{tenant_id}/billing/subscription`
- `GET /core/v1/operator/tenants/{tenant_id}/billing/invoices`

### Actions

- open invoice detail,
- export invoice list,
- add operator note or commercial adjustment if allowed later.

---

## 4.8 Runtime Health

**Route:** `/admin/core/runtime/health`  
**Ability:** `read CoreRuntimeHealth`

### Mục tiêu

- nhìn aggregated runtime health across subsystems.

### Primary widgets

1. subsystem cards
2. dependency health table
3. freshness and latency panels
4. degraded service drilldown

### Primary APIs

- `GET /core/v1/operator/health`

### Actions

- refresh,
- deep link to jobs,
- export health snapshot.

---

## 4.9 Jobs and Materializers

**Route:** `/admin/core/runtime/jobs`  
**Ability:** `read CoreJobOps`

### Mục tiêu

- theo dõi runs,
- retry/manual trigger có kiểm soát,
- quan sát backlog của materializers.

### Primary widgets

1. Running jobs table
2. Failed jobs table
3. Job detail drawer
4. Manual run panel

### Primary APIs

- `GET /core/v1/operator/jobs`
- `POST /core/v1/operator/jobs/{job_key}/run`
- `POST /core/v1/operator/materializers/{materializer_key}/backfill`

### Actions

- retry,
- run now,
- open lineage detail,
- copy request/job ids.

### States

- required confirm dialog + reason for write actions,
- long-running action pending banner.

---

## 4.10 Audit Trace

**Route:** `/admin/core/audit/requests`  
**Ability:** `read CoreAuditTrace`

### Mục tiêu

- truy vết request id, actor lineage, PAT usage, anomaly signals.

### Primary widgets

1. Request search bar
2. Filters: tenant, token, actor, route family, response status
3. Trace table
4. Detail panel with audit chain

### Primary APIs

- `GET /core/v1/operator/audit/requests`
- `GET /core/v1/operator/audit/requests/{request_id}`

### Actions

- filter,
- export,
- open tenant or token context.

---

## 4.11 AI Runtime Governance

**Route:** `/admin/core/ai-runtime`  
**Ability:** `read CoreAIRuntimeAdmin`

### Mục tiêu

- xem effective AI runtime posture,
- chỉnh governance flags hoặc prompt policy khi được phép.

### Primary widgets

1. provider/model readiness table
2. capability flags panel
3. rollout status panel
4. policy editor or policy summary panel

### Primary APIs

- `GET /core/v1/operator/ai-runtime`
- `PATCH /core/v1/operator/ai-runtime/policies/{policy_id}`

---

## 5. Tenant Admin Console screen specs

## 5.1 Tenant Home

**Route:** `/admin/tenant/home`  
**Ability:** `read TenantAdminHome`

### Widgets

1. tenant identity card
2. plan and status summary
3. machine access posture summary
4. usage snapshot summary

### APIs

- `GET /core/v1/partner/tenant`
- `GET /core/v1/access/capabilities`

---

## 5.2 Tenant Service Accounts

**Route:** `/admin/tenant/service-accounts`  
**Ability:** `read TenantServiceAccountAdmin`

### APIs

- `GET /core/v1/partner/service-accounts`
- `POST /core/v1/partner/service-accounts`

### Key actions

- create,
- edit metadata,
- disable if policy allows.

---

## 5.3 Tenant PATs

**Route:** `/admin/tenant/pats`  
**Ability:** `read TenantPATAdmin`

### APIs

- `GET /core/v1/partner/pats`
- `POST /core/v1/partner/pats/issue`
- `POST /core/v1/partner/pats/{token_id}/rotate`
- `POST /core/v1/partner/pats/{token_id}/revoke`

### Key states

- secret one-time reveal,
- expiry warning,
- anomaly warning,
- no browser PAT replay.

---

## 5.4 Tenant Usage

**Route:** `/admin/tenant/usage`  
**Ability:** `read TenantUsageView`

### APIs

- `GET /core/v1/partner/usage/meters`
- `GET /core/v1/partner/usage/quotas`

---

## 5.5 Tenant Billing

**Route:** `/admin/tenant/billing`  
**Ability:** `read TenantBillingView`

### APIs

- `GET /core/v1/partner/billing/subscription`
- `GET /core/v1/partner/billing/invoices`

---

## 5.6 Tenant Capabilities

**Route:** `/admin/tenant/capabilities`  
**Ability:** `read TenantCapabilityView`

### APIs

- `GET /core/v1/access/capabilities`
- `GET /core/v1/ai/runtime-config`

---

## 6. Common UX rules

1. Tables phải có search, filters, empty states, skeleton states.
2. Risky actions như revoke, suspend, run manual, backfill phải có confirm dialog và audit reason nếu backend yêu cầu.
3. Token secrets chỉ hiển thị một lần trong dedicated reveal state.
4. Request id, freshness timestamps và stale banners phải hiện ở các screen có data operational quan trọng.
5. Không render action buttons khi user không có ability phù hợp; không chỉ rely vào backend 403.

---

## 7. Current implementation shape trong repo hiện tại

Trước khi move sang `packages/web/`, screen groups nên được dựng như sau:

```text
frontend/src/pages/admin/core/CoreOverview.jsx
frontend/src/pages/admin/core/CoreTenants.jsx
frontend/src/pages/admin/core/CoreTenantDetail.jsx
frontend/src/pages/admin/core/CoreServiceAccounts.jsx
frontend/src/pages/admin/core/CorePATs.jsx
frontend/src/pages/admin/core/CoreUsage.jsx
frontend/src/pages/admin/core/CoreBilling.jsx
frontend/src/pages/admin/core/CoreRuntimeHealth.jsx
frontend/src/pages/admin/core/CoreJobs.jsx
frontend/src/pages/admin/core/CoreAuditTrace.jsx
frontend/src/pages/admin/core/CoreAIRuntime.jsx

frontend/src/pages/admin/tenant/TenantAdminHome.jsx
frontend/src/pages/admin/tenant/TenantServiceAccounts.jsx
frontend/src/pages/admin/tenant/TenantPATs.jsx
frontend/src/pages/admin/tenant/TenantUsage.jsx
frontend/src/pages/admin/tenant/TenantBilling.jsx
frontend/src/pages/admin/tenant/TenantCapabilities.jsx
```

---

## 8. Kết luận

Screen spec này biến admin architecture thành hình dạng implementation rõ ràng:

- screen nào cần tồn tại,
- route nào tương ứng,
- widget nào cần có,
- API nào phải sẵn sàng,
- ability nào gate từng page.

Đây là tài liệu đủ gần implementation để bắt đầu phân rã task frontend/backend, nhưng vẫn chưa ép code quá sớm.