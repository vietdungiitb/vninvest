# ENTERPRISE CORE ACCESS CAPABILITY PAYLOAD CONTRACT

**Date:** 2026-05-02  
**Status:** Draft contract for session-to-frontend capability bootstrap  
**Purpose:** Chốt payload backend mà frontend sẽ dùng để dựng `AbilityContext`, `ProtectedRoute`, `Can` và navigation gating, thay cho việc phụ thuộc lâu dài vào bridge rộng kiểu `manage all`.

---

## 1. Vai trò của tài liệu này

Tài liệu này là lớp nối giữa:

- [ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502](./ENTERPRISE_CORE_ADMIN_RBAC_CAPABILITY_MATRIX_20260502.md)
- [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](./ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
- [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](./ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)

RBAC matrix định nghĩa `ai được làm gì`. Artifact này định nghĩa `backend sẽ gửi frontend payload nào để frontend thực thi điều đó một cách nhất quán`.

---

## 2. Current-code anchors phải bám theo

Frontend hiện tại đã có các anchor đủ mạnh để tiêu thụ capability snapshot:

- `frontend/src/context/AbilityContext.js`
- `frontend/src/context/PortfolioContext.jsx`
- `frontend/src/components/Can.jsx`
- `frontend/src/components/ProtectedRoute.jsx`
- `frontend/src/components/TopNav.jsx`
- `frontend/src/App.jsx`

Backend hiện tại đã có các anchor liên quan auth/commercial/runtime có thể tái dùng để build capability bootstrap:

- `backend/config/urls.py`
- `backend/portfolio/urls.py`
- `backend/portfolio/opencore_api.py`
- `backend/portfolio/views_ai_runtime_stats.py`
- `backend/portfolio/ai_runtime_config.py`
- `backend/portfolio/views_admin_runtime.py`

---

## 3. Mục tiêu contract

Payload capability bootstrap phải chốt được 6 việc:

1. frontend biết session hiện tại là central operator, tenant admin hay local VIP admin bridge,
2. frontend có đủ `abilities` để compile CASL rules,
3. navigation được gate bằng backend-authoritative data,
4. action-level disables có thể render trước khi bấm API,
5. current bridge `manage all` vẫn dùng tạm được nhưng không là semantics mục tiêu,
6. cùng một payload shape dùng được cho cả Central Operator Admin và Tenant Admin Console.

---

## 4. Contract surface đề xuất

## 4.1 Primary route

`GET /core/v1/access/capabilities`

### Auth mode

- human authenticated session,
- tenant PAT không dùng route này,
- VIP local backend có thể tự map local roles sang cùng payload shape nếu cần shared web shell.

### Response object key

`capability_snapshot`

### Cache semantics

- `Cache-Control: private, no-store`
- response phải phản ánh session hiện tại, không dùng shared public cache.

---

## 5. Response envelope

```json
{
  "object": "capability_snapshot",
  "snapshot_version": "2026-05-02",
  "generated_at": "2026-05-02T11:10:00Z",
  "actor": {},
  "surfaces": {},
  "roles": [],
  "scopes": [],
  "abilities": [],
  "navigation": {},
  "constraints": {},
  "feature_flags": {},
  "bridges": {}
}
```

---

## 6. Field dictionary

## 6.1 Top-level fields

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `capability_snapshot` |
| `snapshot_version` | string | No | semantic date/version của payload |
| `generated_at` | datetime | No | UTC timestamp |
| `actor` | object | No | user/session identity |
| `surfaces` | object | No | admin surfaces available |
| `roles` | array[string] | No | role codes current session |
| `scopes` | array[string] | No | raw backend scopes/capabilities |
| `abilities` | array[object] | No | action/subject pairs cho CASL |
| `navigation` | object | No | menu and default route hints |
| `constraints` | object | No | action constraints và UI safety rules |
| `feature_flags` | object | No | rollout switches |
| `bridges` | object | No | transitional mapping state |

## 6.2 `actor`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `user_id` | string | No | current human user id |
| `session_type` | enum | No | `operator_human`, `tenant_human`, `vip_local_human` |
| `primary_tenant_id` | string | Yes | tenant context when present |
| `display_name` | string | Yes | UI convenience field |
| `email` | string | Yes | UI convenience field |

## 6.3 `surfaces`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `central_operator.enabled` | boolean | No | route group visibility |
| `central_operator.default_route` | string | Yes | e.g. `/admin/core/overview` |
| `tenant_admin.enabled` | boolean | No | tenant console visibility |
| `tenant_admin.default_route` | string | Yes | e.g. `/admin/tenant/home` |
| `tenant_admin.tenant_id` | string | Yes | current tenant context |
| `vip_internal_admin.enabled` | boolean | No | shared shell build variant support |
| `vip_internal_admin.default_route` | string | Yes | local admin landing route |

## 6.4 `abilities[]`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `action` | string | No | CASL action |
| `subject` | string | No | CASL subject |
| `conditions` | object | Yes | optional future scoped conditions |
| `source_scope` | string | Yes | backend capability that generated ability |

## 6.5 `navigation`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `menus` | array[object] | No | renderable menu groups |
| `default_route` | string | Yes | app landing route theo session |
| `hidden_routes` | array[string] | No | route families explicitly not shown |

### `menus[]`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `key` | string | No | menu key |
| `label` | string | No | UI label key hoặc resolved label |
| `route` | string | No | route target |
| `enabled` | boolean | No | render flag |
| `required_ability` | object | Yes | action/subject pair |

## 6.6 `constraints`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `write_actions_require_reason` | boolean | No | operator writes need reason |
| `browser_pat_usage_forbidden` | boolean | No | security invariant |
| `show_disabled_actions` | boolean | No | render disabled buttons hay ẩn hẳn |
| `token_secret_one_time_reveal` | boolean | No | PAT UX rule |

## 6.7 `bridges`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `legacy_manage_all_active` | boolean | No | bridge mode đang còn bật hay không |
| `bridge_source` | string | Yes | e.g. `casl_manage_all` |
| `bridge_deprecation_state` | enum | No | `active`, `restricted`, `disabled` |

---

## 7. Example payloads

## 7.1 Central operator

```json
{
  "object": "capability_snapshot",
  "snapshot_version": "2026-05-02",
  "generated_at": "2026-05-02T11:10:00Z",
  "actor": {
    "user_id": "usr_01jv9op",
    "session_type": "operator_human",
    "primary_tenant_id": null,
    "display_name": "Platform Owner"
  },
  "surfaces": {
    "central_operator": {
      "enabled": true,
      "default_route": "/admin/core/overview"
    },
    "tenant_admin": {
      "enabled": false,
      "default_route": null,
      "tenant_id": null
    },
    "vip_internal_admin": {
      "enabled": false,
      "default_route": null
    }
  },
  "roles": ["central_platform_owner"],
  "scopes": [
    "operator:overview:read",
    "operator:tenants:read",
    "operator:tokens:write",
    "operator:runtime:write"
  ],
  "abilities": [
    { "action": "read", "subject": "CoreAdminOverview", "source_scope": "operator:overview:read" },
    { "action": "read", "subject": "CoreTenantRegistry", "source_scope": "operator:tenants:read" },
    { "action": "issue", "subject": "CorePATAdmin", "source_scope": "operator:tokens:write" },
    { "action": "run", "subject": "CoreJobOps", "source_scope": "operator:runtime:write" }
  ],
  "navigation": {
    "default_route": "/admin/core/overview",
    "menus": [
      { "key": "core_overview", "label": "Platform Overview", "route": "/admin/core/overview", "enabled": true },
      { "key": "core_tenants", "label": "Tenant Registry", "route": "/admin/core/tenants", "enabled": true }
    ],
    "hidden_routes": []
  },
  "constraints": {
    "write_actions_require_reason": true,
    "browser_pat_usage_forbidden": true,
    "show_disabled_actions": true,
    "token_secret_one_time_reveal": true
  },
  "feature_flags": {
    "core_admin_enabled": true,
    "tenant_console_enabled": false
  },
  "bridges": {
    "legacy_manage_all_active": false,
    "bridge_source": null,
    "bridge_deprecation_state": "disabled"
  }
}
```

## 7.2 Tenant admin

```json
{
  "object": "capability_snapshot",
  "snapshot_version": "2026-05-02",
  "generated_at": "2026-05-02T11:10:00Z",
  "actor": {
    "user_id": "usr_01jv9qa",
    "session_type": "tenant_human",
    "primary_tenant_id": "ten_01jv7x...",
    "display_name": "Tenant Admin"
  },
  "surfaces": {
    "central_operator": { "enabled": false, "default_route": null },
    "tenant_admin": {
      "enabled": true,
      "default_route": "/admin/tenant/home",
      "tenant_id": "ten_01jv7x..."
    },
    "vip_internal_admin": { "enabled": false, "default_route": null }
  },
  "roles": ["tenant_admin"],
  "scopes": [
    "tenant:read",
    "tenant:service_accounts:read",
    "tenant:tokens:write",
    "billing:read"
  ],
  "abilities": [
    { "action": "read", "subject": "TenantAdminHome", "source_scope": "tenant:read" },
    { "action": "read", "subject": "TenantServiceAccountAdmin", "source_scope": "tenant:service_accounts:read" },
    { "action": "issue", "subject": "TenantPATAdmin", "source_scope": "tenant:tokens:write" },
    { "action": "read", "subject": "TenantBillingView", "source_scope": "billing:read" }
  ],
  "navigation": {
    "default_route": "/admin/tenant/home",
    "menus": [
      { "key": "tenant_home", "label": "Tenant Home", "route": "/admin/tenant/home", "enabled": true },
      { "key": "tenant_pats", "label": "PAT Credentials", "route": "/admin/tenant/pats", "enabled": true }
    ],
    "hidden_routes": ["/admin/core/*"]
  },
  "constraints": {
    "write_actions_require_reason": false,
    "browser_pat_usage_forbidden": true,
    "show_disabled_actions": true,
    "token_secret_one_time_reveal": true
  },
  "feature_flags": {
    "core_admin_enabled": false,
    "tenant_console_enabled": true
  },
  "bridges": {
    "legacy_manage_all_active": false,
    "bridge_source": null,
    "bridge_deprecation_state": "disabled"
  }
}
```

## 7.3 Transitional bridge case

Trong giai đoạn chưa bỏ hẳn `manage all`, backend có thể gửi:

```json
{
  "bridges": {
    "legacy_manage_all_active": true,
    "bridge_source": "casl_manage_all",
    "bridge_deprecation_state": "active"
  }
}
```

Điều này chỉ hợp lệ như trạng thái chuyển tiếp. Frontend không được thiết kế screen mới chỉ dựa trên flag bridge này.

---

## 8. Mapping rules backend -> abilities

| Backend scope | Ability emitted |
|---|---|
| `operator:overview:read` | `read CoreAdminOverview` |
| `operator:tenants:read` | `read CoreTenantRegistry` |
| `operator:tenants:write` | `update CoreTenantRegistry`, `suspend CoreTenantRegistry` |
| `operator:service_accounts:read` | `read CoreServiceAccountAdmin` |
| `operator:service_accounts:write` | `create CoreServiceAccountAdmin`, `update CoreServiceAccountAdmin` |
| `operator:tokens:read` | `read CorePATAdmin` |
| `operator:tokens:write` | `issue CorePATAdmin`, `rotate CorePATAdmin`, `revoke CorePATAdmin` |
| `operator:commercial:read` | `read CoreTenantCommercial` |
| `operator:runtime:read` | `read CoreRuntimeHealth`, `read CoreJobOps`, `read CoreAIRuntimeAdmin` |
| `operator:runtime:write` | `run CoreJobOps`, `update CoreAIRuntimeAdmin` |
| `operator:audit:read` | `read CoreAuditTrace` |
| `operator:audit:export` | `export CoreAuditTrace` |
| `tenant:read` | `read TenantAdminHome` |
| `tenant:service_accounts:read/write` | `read/create/update TenantServiceAccountAdmin` |
| `tenant:tokens:read/write` | `read/issue/rotate/revoke TenantPATAdmin` |
| `billing:read` | `read TenantBillingView`, `read TenantUsageView` |

---

## 9. Frontend consumption rules

1. `PortfolioContext` hoặc auth bootstrap context nên giữ raw `capability_snapshot`.
2. `AbilityContext` chỉ compile CASL rules từ `abilities`, không tự suy role-to-ability ở frontend.
3. `ProtectedRoute` nên dùng `surfaces`, `navigation.default_route` và `abilities` thay vì raw role strings.
4. `Can` tiếp tục là primitive render gating chuẩn cho buttons, tabs, row actions.
5. `TopNav` không nên gate `/admin-ops` bằng `manage all` khi payload granular đã sẵn.

---

## 10. Hard rules

1. Browser session không nhận machine PAT secret qua capability payload.
2. Payload này là backend-authoritative; frontend không tự mở route chỉ vì local state nói user là admin.
3. Tenant admin session không bao giờ được nhận `central_operator.enabled=true`.
4. `legacy_manage_all_active=true` chỉ là bridge tạm và phải có kế hoạch loại bỏ.
5. Capability payload phải đủ để UI ẩn hoặc disable action trước khi gọi API, nhưng backend vẫn phải enforce permissions độc lập.

---

## 11. Kết luận

Khi chưa có artifact này, RBAC matrix mới chỉ là lý thuyết. Khi có artifact này, team đã chốt được `backend sẽ gửi gì` và `frontend sẽ dùng gì` để chuyển dần sang mô hình quyền granular mà không phá vỡ primitives hiện có.