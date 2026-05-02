# ENTERPRISE CORE ADMIN RBAC AND CAPABILITY MATRIX

**Date:** 2026-05-02  
**Status:** Current-code-aligned authorization matrix for admin surfaces  
**Purpose:** Chuyển quyết định kiến trúc của `Core Admin UI` thành ma trận quyền cụ thể đủ để frontend và backend cùng triển khai mà không tự diễn giải khác nhau.

**Companion artifact:**

- [ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502](./ENTERPRISE_CORE_ACCESS_CAPABILITY_PAYLOAD_CONTRACT_20260502.md)

---

## 1. Vai trò của tài liệu này

Tài liệu này đứng giữa:

- [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
- [ENTERPRISE_CORE_CONTRACT_PACK_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)

Nó chốt 4 thứ:

1. human roles nào được dùng admin surfaces,
2. CASL abilities nào frontend nên hiểu,
3. backend capabilities/scopes nào phải map về mỗi role,
4. ranh giới giữa human admin sessions và machine PAT credentials.

---

## 2. Current-code anchors cần tôn trọng

Frontend hiện tại đã có nền authorization khá rõ:

- `frontend/src/context/AbilityContext.js`
- `frontend/src/context/PortfolioContext.jsx`
- `frontend/src/components/Can.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/TopNav.jsx`

Điểm quan trọng nhất ở trạng thái hiện tại là `/admin-ops` vẫn đang được gate kiểu rộng bằng `ability.can('manage', 'all')`. Với `Core Admin UI`, cách đó chỉ được coi là cầu nối tạm thời, không phải mô hình quyền mục tiêu.

---

## 3. Ba lớp auth phải tách rõ

## 3.1 Human operator session

Dùng cho đội nội bộ VNInvest trong Central Operator Admin.

## 3.2 Human tenant admin session

Dùng cho tenant owners/admins trong Tenant Admin Console.

## 3.3 Machine PAT credential

Dùng cho `vip-app` local backend hoặc automation services. Lớp này **không** được dùng như browser credential cho human admin UI.

---

## 4. Role catalog

## 4.1 Central roles

| Role code | Ý nghĩa | Surface chính |
|---|---|---|
| `central_platform_owner` | quyền cao nhất cho vận hành platform | toàn bộ Central Operator Admin |
| `central_ops_admin` | vận hành runtime, jobs, health, tenants | overview, runtime, tenant registry |
| `central_billing_admin` | billing, quota, invoices, entitlements | billing, usage, tenant commercial views |
| `central_support_auditor` | read-only support và trace | tenant detail, audit trace, runtime read |
| `central_ai_runtime_admin` | AI runtime governance | AI runtime governance |

## 4.2 Tenant roles

| Role code | Ý nghĩa | Surface chính |
|---|---|---|
| `tenant_owner` | chủ tenant, quyền business cao nhất | toàn bộ Tenant Admin Console |
| `tenant_admin` | quản trị machine access và capabilities | home, service accounts, PATs, capabilities |
| `tenant_billing_admin` | billing và usage | usage, billing |
| `tenant_security_admin` | service account và PAT governance | machine access |
| `tenant_readonly_auditor` | xem read-only để kiểm tra | home, usage, billing read-only |

## 4.3 Ngoài phạm vi tài liệu này

`VIP Internal Admin` có local RBAC riêng của `packages/vip-app/local-backend/`. Không trộn local roles của self-hosted VIP vào ma trận này.

---

## 5. CASL subjects và actions mục tiêu

## 5.1 Subjects cho Central Operator Admin

| Subject | Ý nghĩa |
|---|---|
| `CoreAdminOverview` | overview dashboard và platform summary |
| `CoreTenantRegistry` | danh sách tenant và tenant summary |
| `CoreTenantCommercial` | billing, quota, invoices, entitlements của tenant |
| `CoreServiceAccountAdmin` | machine principals |
| `CorePATAdmin` | PAT lifecycle |
| `CoreRuntimeHealth` | health panels |
| `CoreJobOps` | jobs, materializers, reruns |
| `CoreAuditTrace` | request trace, PAT usage audit, anomaly views |
| `CoreAIRuntimeAdmin` | AI runtime governance |

## 5.2 Subjects cho Tenant Admin Console

| Subject | Ý nghĩa |
|---|---|
| `TenantAdminHome` | tenant home và status |
| `TenantServiceAccountAdmin` | tenant service accounts |
| `TenantPATAdmin` | tenant PAT lifecycle |
| `TenantUsageView` | usage/quota views |
| `TenantBillingView` | billing/invoices |
| `TenantCapabilityView` | capability/readiness views |

## 5.3 Actions mục tiêu

| Action | Ý nghĩa |
|---|---|
| `read` | xem dữ liệu |
| `create` | tạo object mới |
| `update` | chỉnh metadata hoặc policy |
| `suspend` | suspend/disable object |
| `issue` | issue token |
| `rotate` | rotate token |
| `revoke` | revoke token |
| `run` | manual run/retry jobs |
| `export` | export dữ liệu/audit |
| `manage` | only transitional fallback, không nên dùng là final public semantics |

---

## 6. Role-to-module matrix

## 6.1 Central roles

| Module | platform_owner | ops_admin | billing_admin | support_auditor | ai_runtime_admin |
|---|---|---|---|---|---|
| Platform Overview | RW | R | R | R | R |
| Tenant Registry | RW | R | R | R | - |
| Tenant Commercial | RW | R | RW | R | - |
| Service Accounts | RW | RW | R | R | - |
| PAT Credentials | RW | RW | - | R | - |
| Runtime Health | RW | RW | - | R | R |
| Jobs and Materializers | RW | RW | - | R | - |
| Audit Trace | RW | R | R | R | - |
| AI Runtime Governance | RW | R | - | R | RW |

`R` = read-only, `RW` = read + allowed mutations, `-` = không nên thấy navigation mặc định.

## 6.2 Tenant roles

| Module | tenant_owner | tenant_admin | billing_admin | security_admin | readonly_auditor |
|---|---|---|---|---|---|
| Tenant Home | RW | R | R | R | R |
| Service Accounts | RW | RW | - | RW | R |
| PAT Credentials | RW | RW | - | RW | R |
| Usage | RW | R | RW | R | R |
| Billing | RW | R | RW | - | R |
| Capabilities | RW | R | R | R | R |

---

## 7. Route-to-ability matrix

| Route | Ability check tối thiểu | Notes |
|---|---|---|
| `/admin/core/overview` | `read CoreAdminOverview` | platform summary |
| `/admin/core/tenants` | `read CoreTenantRegistry` | tenant list |
| `/admin/core/tenants/:tenantId` | `read CoreTenantRegistry` | detail summary |
| `/admin/core/tenants/:tenantId/service-accounts` | `read CoreServiceAccountAdmin` | create/update gated separately |
| `/admin/core/tenants/:tenantId/pats` | `read CorePATAdmin` | issue/rotate/revoke gated separately |
| `/admin/core/tenants/:tenantId/usage` | `read CoreTenantCommercial` | usage/quota |
| `/admin/core/tenants/:tenantId/billing` | `read CoreTenantCommercial` | billing/invoices |
| `/admin/core/runtime/health` | `read CoreRuntimeHealth` | read-only for most roles |
| `/admin/core/runtime/jobs` | `read CoreJobOps` | `run CoreJobOps` cho manual actions |
| `/admin/core/audit/requests` | `read CoreAuditTrace` | export gated separately |
| `/admin/core/ai-runtime` | `read CoreAIRuntimeAdmin` | update policy needs `update CoreAIRuntimeAdmin` |
| `/admin/tenant/home` | `read TenantAdminHome` | self tenant only |
| `/admin/tenant/service-accounts` | `read TenantServiceAccountAdmin` | create/update gated separately |
| `/admin/tenant/pats` | `read TenantPATAdmin` | issue/rotate/revoke gated separately |
| `/admin/tenant/usage` | `read TenantUsageView` | self tenant only |
| `/admin/tenant/billing` | `read TenantBillingView` | self tenant only |
| `/admin/tenant/capabilities` | `read TenantCapabilityView` | self tenant only |

---

## 8. Backend capability claims đề xuất

Frontend nên nhận claims/abilities đủ hẹp để render navigation và action states. Một capability snapshot đề xuất:

```json
{
  "admin_surfaces": {
    "central_operator": true,
    "tenant_admin": false,
    "vip_internal_admin": false
  },
  "abilities": [
    { "action": "read", "subject": "CoreAdminOverview" },
    { "action": "read", "subject": "CoreTenantRegistry" },
    { "action": "read", "subject": "CoreServiceAccountAdmin" },
    { "action": "issue", "subject": "CorePATAdmin" },
    { "action": "rotate", "subject": "CorePATAdmin" }
  ]
}
```

### Gợi ý mapping backend

| Capability / scope | Frontend ability |
|---|---|
| `operator:overview:read` | `read CoreAdminOverview` |
| `operator:tenants:read` | `read CoreTenantRegistry` |
| `operator:tenants:write` | `update CoreTenantRegistry` / `suspend CoreTenantRegistry` |
| `operator:service_accounts:read` | `read CoreServiceAccountAdmin` |
| `operator:service_accounts:write` | `create/update CoreServiceAccountAdmin` |
| `operator:tokens:read` | `read CorePATAdmin` |
| `operator:tokens:write` | `issue/rotate/revoke CorePATAdmin` |
| `operator:commercial:read` | `read CoreTenantCommercial` |
| `operator:commercial:write` | `update CoreTenantCommercial` |
| `operator:runtime:read` | `read CoreRuntimeHealth`, `read CoreJobOps` |
| `operator:runtime:write` | `run CoreJobOps`, `update CoreAIRuntimeAdmin` |
| `operator:audit:read` | `read CoreAuditTrace` |
| `operator:audit:export` | `export CoreAuditTrace` |

---

## 9. Current-state migration rule

## 9.1 Trạng thái hiện tại

Current frontend đang có pattern rộng kiểu:

- `manage all` cho admin routing,
- `Can` và `ProtectedRoute` đã sẵn,
- ability state đã nằm trong context.

## 9.2 Trạng thái mục tiêu

`Core Admin UI` không nên phụ thuộc lâu dài vào `manage all`. Cần chuyển dần sang:

1. granular subjects,
2. explicit actions,
3. navigation gating và action gating tách riêng,
4. capability snapshot từ backend.

## 9.3 Cầu nối thực dụng

Trong phase đầu, có thể dùng rule bridging:

- nếu `manage all` thì map tạm sang full central operator access,
- nhưng các docs, routes mới và API contracts phải viết theo granular ability model,
- không thêm screen mới nào chỉ gate bằng `manage all` mà không định nghĩa subject/action mục tiêu.

---

## 10. Hard rules

1. Human browser sessions không dùng PAT để gọi machine APIs theo nghĩa raw credential forwarding.
2. Tenant admins không được thấy Central Operator Admin modules.
3. Support/auditor roles mặc định read-only.
4. Billing roles không được issue/revoke PAT trừ khi được gán thêm security abilities.
5. Runtime write actions phải yêu cầu explicit role/capability, không piggyback theo read access.
6. `VIP Internal Admin` local RBAC không tự map thành `core` tenant admin roles trừ khi có bridge contract riêng.

---

## 11. Kết luận

Ma trận này giúp chốt một điểm rất quan trọng:

- `Core Admin UI` là admin shell trong `web`,
- nhưng quyền của nó phải được ràng buộc bằng capability model rõ,
- bám trên `CASL` hiện có,
- và tuyệt đối không được trộn lẫn human sessions với machine PAT semantics.

Đây là lớp tài liệu cần có trước khi team bắt đầu implement navigation, route guards, table actions và backend operator scopes.