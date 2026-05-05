# ENTERPRISE CORE OPERATOR ADMIN API CONTRACT BACKLOG

**Date:** 2026-05-02  
**Status:** Current-code truth plus backlog contract draft before freeze  
**Purpose:** Bổ sung phần contract còn thiếu cho `Central Operator Admin`, vì partner contract draft hiện mới phủ tenant-facing partner APIs chứ chưa phủ đầy đủ operator admin surfaces của VNInvest nội bộ.

---

## 0. Current-code reality check

Trong runtime hiện tại, family operator đang ở trạng thái sau:

- `Implemented now`:
  - `GET /api/core/v1/operator/overview/`, `GET /api/core/v1/operator/health/`, `GET /api/core/v1/operator/tenants/`, `GET /api/core/v1/operator/tenants/{tenant_id}/`, `GET /api/core/v1/operator/tenants/{tenant_id}/service-accounts/`, `GET /api/core/v1/operator/tenants/{tenant_id}/pats/`, `GET /api/core/v1/operator/jobs/`, `GET /api/core/v1/operator/audit/requests/`, `GET /api/core/v1/operator/audit/requests/{request_id}/` và `GET /api/core/v1/operator/ai-runtime/` đã tồn tại như current-code wrapper routes,
  - `frontend/src/pages/AICommandCenter.jsx` la current human-facing AI Command Center surface cho AI runtime governance; UI naming va route naming da khop trong current-code truth.
  - legacy operator runtime surfaces và APIs vẫn còn tồn tại dưới `/api/admin-ops/*`, nhưng P0 operator read projections đã có lớp wrapper mới.
- `Partial`:
  - operator sessions đã có explicit abilities `AdminOps` và `AdminCrawlControl`, nhưng chưa có central operator CASL vocabulary kiểu `CoreAdminOverview`, `CoreTenantRegistry`, `CoreJobOps` phát ra từ live auth bootstrap;
  - route family chuẩn `/core/v1/operator/*` chưa phải owner path cuối cùng, hiện vẫn là `api` wrapper route trên legacy backend.
- `Target-state`:
  - hầu hết route families trong tài liệu này, bao gồm operator commercial/security projections còn lại.

Ghi chu: read-model priority ladder chung do storage strategy 6.5 chot la `operator_overview` -> `tenant_summary` -> `quota_snapshot` -> `session_facts` -> `unified_alert`. Freeze order ben duoi chi ap cho operator endpoints, khong thay the ladder nay.

**Companion artifact:**

- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502](./ENTERPRISE_CORE_OPERATOR_ADMIN_API_DETAILED_CONTRACTS_20260502.md)

---

## 1. Vai trò của tài liệu này

Tài liệu này là lớp bổ sung cho:

- [ENTERPRISE_CORE_CONTRACT_PACK_20260502](./ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
- [ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502](./ENTERPRISE_CORE_ADMIN_UI_ARCHITECTURE_20260502.md)
- [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](./ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)

Nó chưa phải final frozen contract pack. Mục tiêu là:

1. liệt kê operator endpoints còn thiếu,
2. gom chúng thành nhóm P0/P1,
3. chốt semantics đủ để frontend/backend có cùng backlog implementation.

---

## 2. Phạm vi

Tài liệu này chỉ dành cho **Central Operator Admin** của VNInvest nội bộ.

Nó không thay thế:

- partner APIs cho tenant/vip-app,
- tenant admin console APIs,
- VIP local backend APIs.

---

## 3. Nguyên tắc cứng cho operator admin APIs

1. Base path: `/core/v1/operator/...`
2. Auth mode: human operator session hoặc internal service-to-service path được ủy quyền, không dùng tenant PAT.
3. Meter: mặc định `none`.
4. Audit: mọi write action phải có request id và ideal case là audit reason.
5. Pagination: list endpoints vẫn dùng cursor hoặc ordering chuẩn, không page-number tùy tiện.
6. Partner tenants không được thấy operator routes.

---

## 4. Common headers và error expectations

### 4.1 Standard headers

| Header | Request/Response | Bắt buộc | Notes |
|---|---|---|---|
| `X-Core-Request-Id` | response | Bắt buộc | trace id |
| `Idempotency-Key` | request | Bắt buộc với mutating POST | retry-safe writes |
| `X-Core-Operator-Reason` | request | Khuyến nghị mạnh với writes | audit reason |

### 4.2 Error codes tối thiểu

| Code | HTTP | Ý nghĩa |
|---|---|---|
| `operator_permission_denied` | 403 | thiếu capability operator |
| `operator_reason_required` | 400 | write action cần lý do |
| `tenant_not_found` | 404 | tenant không tồn tại |
| `invalid_runtime_action` | 400 | action không hợp lệ |
| `unsafe_runtime_action_blocked` | 409 | block bởi policy safety |

---

## 5. P0 read-first operator APIs

Trừ các route `overview`, `health`, `tenants`, `tenants/{tenant_id}`, `tenants/{tenant_id}/service-accounts`, `tenants/{tenant_id}/pats`, `jobs`, `audit/requests` và `ai-runtime` đã có live wrapper route trong legacy runtime dưới `/api/core/v1/operator/*`, các P0 read APIs còn lại bên dưới vẫn là target-state backlog contracts.

## 5.1 `GET /core/v1/operator/overview`

**Consumer:** Central Operator Admin overview  
**Capability:** `operator:overview:read`

**Response shape draft**

```json
{
  "object": "operator_overview",
  "generated_at": "2026-05-02T10:00:00Z",
  "health_status": "degraded",
  "running_jobs": 8,
  "failed_jobs": 2,
  "tenants_nearing_quota": 4,
  "active_incidents": 3,
  "stale_materializers": [
    { "key": "session_facts_materializer", "lag_seconds": 420 }
  ]
}
```

## 5.2 `GET /core/v1/operator/tenants`

**Capability:** `operator:tenants:read`  
**Query params:** `limit`, `starting_after`, `status`, `plan_code`, `suspension_state`, `search`

**List item draft**

```json
{
  "object": "tenant_summary",
  "id": "ten_01jv7x...",
  "tenant_code": "vip-alpha",
  "display_name": "VIP Alpha",
  "status": "active",
  "plan_code": "vip_pro",
  "suspension_state": "none",
  "current_usage_risk": "warning",
  "invoice_state": "current",
  "updated_at": "2026-05-02T09:40:00Z"
}
```

## 5.3 `GET /core/v1/operator/tenants/{tenant_id}`

**Capability:** `operator:tenants:read`

**Purpose:** detail summary cho tenant detail page.

## 5.4 `GET /core/v1/operator/tenants/{tenant_id}/service-accounts`

**Capability:** `operator:service_accounts:read`

**Purpose:** operator view của machine principals; shape gần với partner service-account list nhưng có thêm audit metadata và risk hints.

## 5.5 `GET /core/v1/operator/tenants/{tenant_id}/pats`

**Capability:** `operator:tokens:read`

**Purpose:** operator view của PATs với last_used, anomaly flags, issuer, revoke status.

## 5.6 `GET /core/v1/operator/tenants/{tenant_id}/usage`

**Capability:** `operator:commercial:read`

**Purpose:** usage rollups cho operator; có thể rộng hơn partner view ở anomaly/trend metadata.

## 5.7 `GET /core/v1/operator/tenants/{tenant_id}/quotas`

**Capability:** `operator:commercial:read`

**Purpose:** remaining quota + overage posture + hard stop state.

## 5.8 `GET /core/v1/operator/tenants/{tenant_id}/billing/subscription`

**Capability:** `operator:commercial:read`

## 5.9 `GET /core/v1/operator/tenants/{tenant_id}/billing/invoices`

**Capability:** `operator:commercial:read`

## 5.10 `GET /core/v1/operator/health`

**Capability:** `operator:runtime:read`

**Purpose:** aggregated runtime health snapshot. Đây là endpoint đã được blueprint nhắc đến và nên là P0.

## 5.11 `GET /core/v1/operator/jobs`

**Capability:** `operator:runtime:read`  
**Query params:** `status`, `job_family`, `since`, `tenant_id`, `limit`, `starting_after`

**List item draft**

```json
{
  "object": "service_run",
  "id": "run_01jv91...",
  "job_key": "session_facts_materializer",
  "job_family": "materializer",
  "status": "failed",
  "started_at": "2026-05-02T09:10:00Z",
  "finished_at": "2026-05-02T09:12:00Z",
  "duration_ms": 121000,
  "tenant_id": null,
  "error_code": "upstream_timeout"
}
```

## 5.12 `GET /core/v1/operator/audit/requests`

**Capability:** `operator:audit:read`  
**Query params:** `request_id`, `tenant_id`, `token_id`, `actor_user_id`, `route_family`, `status`, `limit`

## 5.13 `GET /core/v1/operator/audit/requests/{request_id}`

**Capability:** `operator:audit:read`

**Response draft**

```json
{
  "object": "request_trace",
  "request_id": "req_01jv80...",
  "occurred_at": "2026-05-02T09:45:00Z",
  "tenant_id": "ten_01jv7x...",
  "service_account_id": "sat_01jv81...",
  "token_id": "pat_01jv82...",
  "actor_user_id": "usr_01jv83...",
  "route_family": "partner_tokens",
  "http_status": 200,
  "latency_ms": 182,
  "meter_code": null,
  "units_charged": 0,
  "source_ip": "203.0.113.10"
}
```

## 5.14 `GET /core/v1/operator/ai-runtime`

**Capability:** `operator:runtime:read`

**Purpose:** provider/model readiness, rollout status, policy snapshots.

---

## 6. P1 operator write APIs

Những endpoint dưới đây không nên mặc định implement cùng lúc với P0 read APIs. Chúng là P1 vì risk cao hơn và cần stronger audit semantics.

| Endpoint | Capability | Ý nghĩa |
|---|---|---|
| `POST /core/v1/operator/tenants/{tenant_id}/suspend` | `operator:tenants:write` | suspend tenant |
| `POST /core/v1/operator/tenants/{tenant_id}/unsuspend` | `operator:tenants:write` | unsuspend tenant |
| `POST /core/v1/operator/tenants/{tenant_id}/service-accounts` | `operator:service_accounts:write` | tạo service account ở góc operator |
| `PATCH /core/v1/operator/service-accounts/{service_account_id}` | `operator:service_accounts:write` | update metadata/policies |
| `POST /core/v1/operator/service-accounts/{service_account_id}/disable` | `operator:service_accounts:write` | disable principal |
| `POST /core/v1/operator/tenants/{tenant_id}/pats/issue` | `operator:tokens:write` | issue PAT từ operator console |
| `POST /core/v1/operator/pats/{token_id}/rotate` | `operator:tokens:write` | rotate PAT |
| `POST /core/v1/operator/pats/{token_id}/revoke` | `operator:tokens:write` | revoke PAT |
| `POST /core/v1/operator/jobs/{job_key}/run` | `operator:runtime:write` | manual run job |
| `POST /core/v1/operator/materializers/{materializer_key}/backfill` | `operator:runtime:write` | trigger backfill |
| `PATCH /core/v1/operator/ai-runtime/policies/{policy_id}` | `operator:runtime:write` | update AI runtime governance |

### Quy tắc write-specific

1. Bắt buộc `Idempotency-Key` cho mutating POST.
2. Khuyến nghị mạnh `X-Core-Operator-Reason`.
3. Ghi audit actor, request id, previous state, next state.
4. Các runtime actions nguy hiểm cần policy guard để tránh bấm nhầm.

---

## 7. Relationship với partner APIs

Operator APIs và partner APIs có thể dùng chung resource semantics, nhưng **không** nên dùng cùng route families:

1. partner APIs là tenant-scoped self-service,
2. operator APIs là central internal control surface,
3. operator responses có thể giàu audit/risk metadata hơn partner responses,
4. operator writes có thể cần reason/audit workflow mạnh hơn.

---

## 8. Freeze order khuyến nghị

Để giảm rủi ro, nên freeze theo thứ tự:

1. `GET /core/v1/operator/overview`
2. `GET /core/v1/operator/tenants`
3. `GET /core/v1/operator/tenants/{tenant_id}`
4. `GET /core/v1/operator/health`
5. `GET /core/v1/operator/jobs`
6. `GET /core/v1/operator/audit/requests`
7. read endpoints cho service accounts/PATs/usage/billing
8. write endpoints cho tenant/service account/PAT
9. runtime write actions

Lý do:

- read-only observability screens nên đi trước,
- tenant registry/detail nên ổn trước khi mở writes,
- risky runtime actions nên freeze cuối.

---

## 9. Kết luận

Backlog contract này lấp đúng khoảng trống giữa `Core Admin UI` và partner contract pack hiện có:

- frontend có danh sách operator screens rõ để bám,
- backend có route families rõ để lên backlog,
- quyền operator được tách khỏi tenant PAT semantics,
- và việc freeze operator APIs có thể đi theo từng pha thay vì vẽ quá lớn ngay từ đầu.