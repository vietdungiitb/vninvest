# ENTERPRISE CORE ADMIN UI ARCHITECTURE

**Date:** 2026-05-02  
**Status:** Current-code-aligned UI architecture decision  
**Purpose:** Chốt rõ `Core Admin UI` sẽ được thiết kế như thế nào, nằm ở package nào, phân ranh ra sao với `core` backend và với `VIP Internal Admin`.

**Companion artifacts:**

- [ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502](./ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md)
- [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](./ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)
- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](./ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)
- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502](./ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md)
- [ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](./ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)
- [ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502](./ENTERPRISE_CORE_ADMIN_IMPLEMENTATION_TASKBOARD_20260502.md)

---

## 1. Quyết định kiến trúc

`Core Admin UI` **không** nằm trong `core` package. Nó nằm trong `web` package như một admin shell React tiêu thụ APIs của `core`.

Phân tách đúng là:

1. `packages/core/`
   Sở hữu backend runtime, operator APIs, partner APIs, auth semantics, quota, billing, health, jobs, audit.
2. `packages/web/`
   Sở hữu toàn bộ presentation/UI cho human operators và human tenant admins.
3. `packages/vip-app/`
   Sở hữu local backend, self-host packaging, local user management, branding, AI keys, chat logs và orchestrator cho bản VIP.

Nói ngắn gọn: `core` là control-plane và data-plane backend, còn `Core Admin UI` là human-facing control console chạy trong `web`.

---

## 2. Vì sao không đặt Core Admin UI trong `core`

Nếu đặt React admin UI vào `core`, boundary sẽ bị sai ở 4 điểm:

1. `core` sẽ vừa là backend platform vừa là frontend shell, làm nhòe package ownership.
2. `web` sẽ mất vai trò frontend dùng chung cho SaaS, operator surfaces và VIP build variants.
3. Sau này tách repo sẽ khó, vì UI admin lại dính vào repo backend thay vì repo frontend.
4. Boundary rule `web` chỉ giao tiếp với `core` qua APIs sẽ mất ý nghĩa.

Do đó, `core` chỉ nên export:

- operator APIs,
- partner control APIs,
- partner commercial APIs,
- capabilities/auth metadata,
- audit and observability data.

---

## 3. Ba loại admin surfaces phải tách rõ

## 3.1 Central Operator Admin

Đây là admin UI dành cho đội nội bộ VNInvest.

**Mục tiêu:**

- quan sát health và jobs của toàn platform,
- quản lý tenant, service account, PAT lifecycle,
- theo dõi quota/billing,
- kiểm tra audit traces,
- điều phối runtime settings và materialization status.

**Frontend placement:** `packages/web/`  
**Backend owner:** `packages/core/`  
**Auth mode:** human operator session  
**Build target:** SaaS/operator build

## 3.2 Tenant Admin Console

Đây là admin UI dành cho human admins của tenant/partner dùng bản SaaS-hosted hoặc partner console do VNInvest cung cấp.

**Mục tiêu:**

- xem tenant profile và plan,
- quản lý service accounts,
- issue/rotate/revoke PATs,
- xem quotas, usage meters, subscription, invoices,
- xem AI/runtime capabilities được cấp.

**Frontend placement:** `packages/web/`  
**Backend owner:** `packages/core/`  
**Auth mode:** human tenant admin session  
**Build target:** SaaS/partner-admin build

## 3.3 VIP Internal Admin

Đây là admin UI dành cho khách hàng self-host của `vip-app`.

**Mục tiêu:**

- quản lý local sub-users,
- branding/white-label,
- local AI keys,
- prompt studio,
- usage analytics trong local tenant context.

**Frontend placement:** vẫn là `packages/web/` dưới dạng build variant  
**Backend owner:** chủ yếu `packages/vip-app/local-backend/`, một phần đọc từ `packages/core/` qua partner APIs  
**Auth mode:** local VIP session  
**Build target:** `BUILD_TARGET=vip`

---

## 4. Package placement quyết định

| Surface | Frontend package | Backend/API owner | Ghi chú |
|---|---|---|---|
| Central Operator Admin | `packages/web/` | `packages/core/` operator APIs | Không nằm trong `core` |
| Tenant Admin Console | `packages/web/` | `packages/core/` partner APIs | Không dùng PAT trong browser cho machine access |
| VIP Internal Admin | `packages/web/` build variant | `packages/vip-app/local-backend/` + `packages/core/` partner APIs | UI chung source, backend tách |

### Quy tắc cứng

1. Không đặt React pages/product admin shell trong `packages/core/`.
2. `packages/core/` chỉ nên chứa API edge, services, jobs, contracts và admin fallback kỹ thuật nếu thật sự cần.
3. Mọi UI pages dành cho human operators hoặc human admins đều ở `packages/web/`.

---

## 5. Current-state placement và target-state placement

## 5.1 Current state trước khi move sang `packages/`

Theo chiến lược `boundary-first, no-move-first`, admin UI nên được tổ chức trong frontend hiện tại trước:

```text
frontend/src/pages/admin/core/
frontend/src/pages/admin/tenant/
frontend/src/components/admin/core/
frontend/src/components/admin/tenant/
frontend/src/api/coreAdminClient.js
frontend/src/api/tenantAdminClient.js
frontend/src/config/buildTarget.js
```

### Cách nghĩ đúng ở phase hiện tại

- chưa cần move vật lý sang `packages/web/` ngay,
- nhưng phải code như thể admin UI đã là phần của `web` shell,
- mọi calls đi qua API contracts thay vì import backend logic.

## 5.2 Target state sau khi move sang `packages/`

Khi phase move vật lý đến nơi, admin UI sẽ nằm ở:

```text
packages/web/src/pages/admin/core/
packages/web/src/pages/admin/tenant/
packages/web/src/features/core-admin/
packages/web/src/features/tenant-admin/
shared/api-contracts/core-admin/
shared/api-contracts/partner-admin/
```

`packages/core/` chỉ giữ:

```text
packages/core/backend/... operator APIs
packages/core/backend/... partner APIs
packages/core/backend/... entitlement and quota services
packages/core/backend/... audit and jobs services
```

---

## 6. Information architecture của Core Admin UI

## 6.1 Central Operator Admin modules

1. **Platform Overview**
   Health, queues, jobs, materialization lag, quota incidents.
2. **Tenant Registry**
   Danh sách tenant, plan, status, suspension state, billing owner.
3. **Service Accounts**
   Machine principals theo tenant, environment, policies.
4. **PAT Credentials**
   Issue, rotate, revoke, expiry, last used, suspected risk flags.
5. **Entitlements and Plans**
   Capability matrix, package access, premium signals, AI access.
6. **Usage and Quota**
   Meter usage, remaining quota, overage warnings, reset windows.
7. **Billing and Invoices**
   Subscription summary, credits, invoice history, outstanding states.
8. **Runtime Health and Jobs**
   Prefetch, materializers, alert jobs, service run lineage.
9. **Audit and Trace**
   Request ids, actor lineage, PAT usage audit, anomaly trail.
10. **AI Runtime Governance**
    Effective providers, prompt policy, rollout status, kill switches.

## 6.2 Tenant Admin modules

1. **Tenant Home**
   Tenant identity, plan, status, current environment.
2. **Machine Access**
   Service accounts và PAT management.
3. **Usage**
   Meter breakdown, quota remaining, throttling incidents.
4. **Billing**
   Subscription, invoices, credits.
5. **Capabilities**
   Feature access, AI/runtime readiness.

## 6.3 Điều gì không thuộc Core Admin UI

Những thứ sau không nên nằm trong Central Core Admin UI chính:

- local sub-user management của self-hosted VIP tenants,
- branding/white-label editor,
- tenant-local AI key storage,
- tenant-local chat logs,
- orchestrator-local prompt studio.

Các surface đó là của `VIP Internal Admin`, không phải của `core` operator console.

---

## 7. Route layout đề xuất

## 7.1 Central Operator Admin routes

```text
/admin/core
/admin/core/overview
/admin/core/tenants
/admin/core/tenants/:tenantId
/admin/core/tenants/:tenantId/service-accounts
/admin/core/tenants/:tenantId/pats
/admin/core/tenants/:tenantId/usage
/admin/core/tenants/:tenantId/billing
/admin/core/runtime/health
/admin/core/runtime/jobs
/admin/core/audit/requests
/admin/core/ai-runtime
```

## 7.2 Tenant Admin routes

```text
/admin/tenant
/admin/tenant/home
/admin/tenant/service-accounts
/admin/tenant/pats
/admin/tenant/usage
/admin/tenant/billing
/admin/tenant/capabilities
```

## 7.3 VIP Internal Admin routes

```text
/vip-admin/organization
/vip-admin/sub-users
/vip-admin/core-connections
/vip-admin/ai-prompts
/vip-admin/usage-analytics
```

---

## 8. UI-to-API mapping

| UI module | Primary APIs | API owner |
|---|---|---|
| Platform Overview | `GET /core/v1/operator/health`, `GET /core/v1/operator/jobs` | `core` |
| Tenant Home | `GET /core/v1/partner/tenant` | `core` |
| Service Accounts | `GET /core/v1/partner/service-accounts`, `POST /core/v1/partner/service-accounts` | `core` |
| PAT Credentials | `GET /core/v1/partner/pats`, `POST /core/v1/partner/pats/issue`, `POST /core/v1/partner/pats/{token_id}/rotate`, `POST /core/v1/partner/pats/{token_id}/revoke` | `core` |
| Usage | `GET /core/v1/partner/usage/meters`, `GET /core/v1/partner/usage/quotas` | `core` |
| Billing | `GET /core/v1/partner/billing/subscription`, `GET /core/v1/partner/billing/invoices` | `core` |
| Capabilities | `GET /core/v1/access/capabilities`, `GET /core/v1/ai/runtime-config` | `core` |
| VIP Core Connections | partner APIs above, called server-side by local backend | `vip-app` + `core` |

### Ghi chú quan trọng

1. Browser admin UI có thể hiển thị secret token một lần sau khi issue thành công, nhưng browser không được dùng PAT đó để gọi `core` như machine credential bình thường.
2. PAT cho integration luôn là server-side credential của `vip-app` hoặc automation service.
3. Human operator/tenant admin login nên đi qua session/capability model riêng, không dùng PAT thay cho human session.

---

## 9. Auth, gating và ownership rules

## 9.1 Auth separation

Phải tách rõ 3 lớp auth:

1. **Human operator session**
   Dùng cho Central Operator Admin trong `web`.
2. **Human tenant admin session**
   Dùng cho Tenant Admin Console trong `web`.
3. **Machine PAT credential**
   Dùng cho `vip-app` local backend hoặc automation services.

Không dùng machine PAT thay cho human web session.

## 9.2 Navigation gating

Navigation của admin UI nên bám theo:

- `GET /core/v1/session/me`
- `GET /core/v1/access/capabilities`
- tenant status,
- operator role,
- build target.

## 9.3 Ownership rule

1. `web` owns pages, layout, tables, forms, filters, navigation.
2. `core` owns validation, lifecycle semantics, quota accounting, audit logging, entitlement logic.
3. `vip-app/local-backend` owns local RBAC, local branding, local secret storage, local usage views.

---

## 10. Rollout path thực dụng

## Phase U0 - documentation freeze

- Chốt package placement.
- Chốt distinction giữa Central Operator Admin, Tenant Admin Console và VIP Internal Admin.
- Chốt screen groups và API families.

## Phase U1 - current repo implementation shape

- Tạo admin pages ngay trong `frontend/src/`.
- Tạo clients cho operator/partner APIs.
- Gắn route gating bằng `buildTarget.js` và capability checks.

## Phase U2 - contract alignment

- Đồng bộ admin UI với partner contract pack.
- Bổ sung operator-admin endpoint backlog còn thiếu.
- Chốt audit/request id conventions hiển thị trên UI.

## Phase U3 - package move

- Khi repo đã sẵn sàng, move `frontend/` sang `packages/web/`.
- Giữ nguyên structure logic của admin UI, không thay đổi ownership.

---

## 11. Kết luận

Thiết kế đúng là:

- `core` sở hữu APIs và semantics,
- `web` sở hữu Core Admin UI và Tenant Admin UI,
- `vip-app` sở hữu local admin backend cho self-host use cases,
- tất cả human-facing admin pages đều không nằm trong `core` package.

Đây là cách vừa đúng boundary, vừa dễ phát triển trong monorepo hiện tại, vừa dễ tách repo sau này mà không phải sửa lại tư duy kiến trúc từ đầu.