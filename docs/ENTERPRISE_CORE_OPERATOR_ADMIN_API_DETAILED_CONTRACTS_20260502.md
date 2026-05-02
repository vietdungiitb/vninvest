# ENTERPRISE CORE OPERATOR ADMIN API DETAILED CONTRACTS

**Date:** 2026-05-02  
**Status:** Detailed read-first contract draft for operator P0 endpoints  
**Purpose:** Hạ `operator admin API backlog` từ mức route families xuống mức request/response semantics, field dictionary và degrade rules đủ chi tiết để frontend/backend cùng freeze từng endpoint P0.

---

## 1. Vai trò của tài liệu này

Tài liệu này đứng giữa:

- [ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502](./ENTERPRISE_CORE_OPERATOR_ADMIN_API_CONTRACT_BACKLOG_20260502.md)
- [ENTERPRISE_CORE_CONTRACT_PACK_20260502](./ENTERPRISE_CORE_CONTRACT_PACK_20260502.md)
- [ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502](./ENTERPRISE_CORE_ADMIN_SCREEN_SPEC_20260502.md)

Backlog doc trả lời câu hỏi `cần có route nào`. Tài liệu này trả lời câu hỏi `mỗi route đó thực sự trả cái gì, lọc thế nào, và degrade ra sao`.

---

## 2. Phạm vi

Tài liệu này chỉ chi tiết hóa **P0 read-first operator endpoints**:

1. `GET /core/v1/operator/overview`
2. `GET /core/v1/operator/tenants`
3. `GET /core/v1/operator/tenants/{tenant_id}`
4. `GET /core/v1/operator/tenants/{tenant_id}/service-accounts`
5. `GET /core/v1/operator/tenants/{tenant_id}/pats`
6. `GET /core/v1/operator/tenants/{tenant_id}/usage`
7. `GET /core/v1/operator/tenants/{tenant_id}/quotas`
8. `GET /core/v1/operator/tenants/{tenant_id}/billing/subscription`
9. `GET /core/v1/operator/tenants/{tenant_id}/billing/invoices`
10. `GET /core/v1/operator/health`
11. `GET /core/v1/operator/jobs`
12. `GET /core/v1/operator/audit/requests`
13. `GET /core/v1/operator/audit/requests/{request_id}`
14. `GET /core/v1/operator/ai-runtime`

P1 write routes vẫn ở backlog doc, chưa freeze chi tiết trong artifact này.

---

## 3. Common conventions cho toàn bộ operator reads

### 3.1 Base path và auth

- Base path: `/core/v1/operator/...`
- Auth mode: human operator session hoặc internal trusted operator path.
- Tenant PAT **không** hợp lệ ở operator routes.

### 3.2 Standard headers

| Header | Direction | Required | Notes |
|---|---|---|---|
| `X-Core-Request-Id` | response | Yes | trace id |
| `X-Core-Api-Version` | request | Recommended | pin semantics khi frontend/operator client cần |
| `Cache-Control` | response | Recommended | `private, no-store` cho audit/runtime sensitive routes |

### 3.3 List response envelope

```json
{
  "object": "list",
  "url": "/core/v1/operator/tenants",
  "data": [],
  "has_more": false,
  "next_cursor": null,
  "prev_cursor": null
}
```

### 3.4 Pagination conventions

- Mặc định dùng `limit`, `starting_after`, `ending_before`.
- Default `limit`: `25`.
- Maximum `limit`: `100`.
- List routes phải chốt ordering mặc định trong contract; không để implicit DB ordering.

### 3.5 Expand policy

Operator routes vẫn phải giữ response gọn ở mặc định. Chỉ cho phép `include` hoặc `expand` với whitelist rõ ràng; không cho arbitrary nested joins.

### 3.6 Error baseline

Ngoài error model chung từ backlog doc, các read routes có thể trả thêm:

| Code | HTTP | Ý nghĩa |
|---|---|---|
| `invalid_filter` | 400 | query param không hợp lệ |
| `invalid_cursor` | 400 | cursor sai format hoặc expired |
| `operator_resource_not_ready` | 409 | read model chưa sẵn sàng để phục vụ |
| `operator_data_stale` | 200 | không phải error body; được biểu đạt qua field/header stale semantics |

---

## 4. Detailed endpoint contracts

## 4.1 `GET /core/v1/operator/overview`

**Consumer:** Platform Overview  
**Capability:** `operator:overview:read`  
**Ordering:** không áp dụng  
**Query params:** none trong `v1`

### Response object

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `operator_overview` |
| `generated_at` | datetime | No | snapshot time UTC |
| `health_status` | enum | No | `healthy`, `warning`, `degraded`, `critical` |
| `running_jobs` | integer | No | số run đang active |
| `failed_jobs` | integer | No | failed jobs trong cửa sổ gần nhất |
| `active_incidents` | integer | No | số incident active |
| `tenants_nearing_quota` | integer | No | tenant ở ngưỡng warning |
| `stale_materializers` | array[object] | No | read-model lag quan trọng |
| `high_priority_incidents` | array[object] | No | tối đa 5 incident cards cho UI overview |

### Nested `stale_materializers[]`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `key` | string | No | materializer identifier |
| `lag_seconds` | integer | No | độ trễ |
| `last_success_at` | datetime | Yes | lần chạy thành công gần nhất |
| `severity` | enum | No | `warning`, `degraded`, `critical` |

### Degrade semantics

- Nếu một widget input không sẵn, route vẫn trả `200` với `health_status` phản ánh rủi ro và object con trống.
- Không fallback sang expensive per-widget upstream fetches trong `v1`.

---

## 4.2 `GET /core/v1/operator/tenants`

**Consumer:** Tenant Registry  
**Capability:** `operator:tenants:read`  
**Ordering:** `updated_at desc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | No | default 25, max 100 |
| `starting_after` | string | No | cursor |
| `ending_before` | string | No | reverse pagination |
| `status` | string or array[string] | No | `active`, `pending_setup`, `suspended`, `disabled` |
| `plan_code` | string or array[string] | No | exact match plan codes |
| `suspension_state` | enum | No | `none`, `manual`, `quota`, `billing`, `policy` |
| `search` | string | No | match `tenant_code`, `display_name` |
| `current_usage_risk` | enum | No | `normal`, `warning`, `critical` |
| `invoice_state` | enum | No | `current`, `past_due`, `overdue`, `credit_hold` |

### List item `tenant_summary`

Base fields bám resource `tenant` trong contract pack, cộng thêm operator-only projections.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `tenant_summary` |
| `id` | string | No | external tenant id |
| `tenant_code` | string | No | human-friendly code |
| `display_name` | string | No | tenant display name |
| `status` | enum | No | tenant lifecycle status |
| `plan_code` | string | Yes | commercial plan |
| `suspension_state` | enum | No | state phục vụ operator actions |
| `current_usage_risk` | enum | No | `normal`, `warning`, `critical` |
| `invoice_state` | enum | No | collection posture |
| `active_service_account_count` | integer | No | quick security posture |
| `active_pat_count` | integer | No | quick machine access posture |
| `updated_at` | datetime | No | list ordering anchor |

### Special rules

- `search` không phải full text global; chỉ dành cho quick registry filtering.
- List item phải đủ để render table và row status badges, không cần expand detail panels.

---

## 4.3 `GET /core/v1/operator/tenants/{tenant_id}`

**Consumer:** Tenant Detail Summary  
**Capability:** `operator:tenants:read`

### Response object

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `operator_tenant_detail` |
| `tenant` | object | No | base tenant summary + immutable ids |
| `commercial_summary` | object | No | plan, billing posture, quota posture |
| `security_summary` | object | No | service accounts, PAT health, anomaly hints |
| `recent_operator_actions` | array[object] | No | tối đa 10 action audit items |
| `generated_at` | datetime | No | snapshot time |

### `commercial_summary`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `plan_code` | string | Yes | active plan |
| `invoice_state` | enum | No | `current`, `past_due`, `overdue`, `credit_hold` |
| `credit_balance` | number | Yes | nếu commercial layer đã có |
| `quota_risk` | enum | No | `normal`, `warning`, `critical` |

### `security_summary`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `service_account_count` | integer | No | tổng số machine principals |
| `active_pat_count` | integer | No | active tokens |
| `rotations_due_count` | integer | No | credential hygiene |
| `anomaly_state` | enum | No | `normal`, `warning`, `critical` |
| `latest_pat_last_used_at` | datetime | Yes | quick last activity |

---

## 4.4 `GET /core/v1/operator/tenants/{tenant_id}/service-accounts`

**Consumer:** Service Accounts  
**Capability:** `operator:service_accounts:read`  
**Ordering:** `created_at desc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | No | default 25, max 100 |
| `starting_after` | string | No | cursor |
| `status` | enum | No | `active`, `disabled`, `pending_approval` |
| `environment` | enum | No | `prod`, `staging`, `dev` |
| `policy_id` | string | No | filter by assigned bundle |
| `rotation_risk` | enum | No | `normal`, `warning`, `critical` |

### List item

Base resource là `service_account` trong contract pack, cộng các field operator projections sau:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `pat_count` | integer | No | tổng PAT thuộc service account |
| `active_pat_count` | integer | No | tokens active |
| `latest_pat_last_used_at` | datetime | Yes | hoạt động gần nhất |
| `rotation_risk` | enum | No | hygiene badge |
| `last_operator_action_at` | datetime | Yes | action audit gần nhất |

### Special rules

- Không trả token secret ở route này.
- `rotation_risk` là serving projection, không phải source-of-truth field của service account.

---

## 4.5 `GET /core/v1/operator/tenants/{tenant_id}/pats`

**Consumer:** PAT Credentials  
**Capability:** `operator:tokens:read`  
**Ordering:** `created_at desc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | No | default 25, max 100 |
| `starting_after` | string | No | cursor |
| `service_account_id` | string | No | filter by owner |
| `status` | enum | No | `active`, `rotating`, `revoked`, `expired` |
| `expires_within_days` | integer | No | 0-365 |
| `anomaly_state` | enum | No | `normal`, `warning`, `critical` |

### List item

Base resource là `pat_credential` trong contract pack, cộng các field operator projections sau:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `issuer_actor_type` | enum | Yes | `tenant_user`, `operator_user`, `system` |
| `issuer_actor_id` | string | Yes | human/system actor id |
| `anomaly_state` | enum | No | serving risk state |
| `grace_period_active` | boolean | No | rotate grace window |
| `last_used_ip_country` | string | Yes | geo hint nhẹ |
| `last_audit_request_id` | string | Yes | drilldown anchor |

### Hard rule

- Token secret không bao giờ xuất hiện ở route list/read này.

---

## 4.6 `GET /core/v1/operator/tenants/{tenant_id}/usage`

**Consumer:** Tenant Usage and Quota  
**Capability:** `operator:commercial:read`  
**Ordering:** `meter_code asc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `period_start` | date | No | ISO date |
| `period_end` | date | No | ISO date |
| `meter_code` | string | No | single meter filter |
| `include` | string | No | allow `trend`, `overage` |

### Response object

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `operator_usage_snapshot` |
| `tenant_id` | string | No | owner tenant |
| `period_start` | date | No | requested or default window |
| `period_end` | date | No | requested or default window |
| `data` | array[object] | No | meter rows |

### `data[]` meter row

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | `usage_meter_row` |
| `meter_code` | string | No | meter identifier |
| `display_name` | string | No | operator label |
| `unit` | enum | No | request, batch, event, minute, file_unit |
| `consumed_amount` | number | No | usage trong window |
| `remaining_amount` | number | Yes | nếu quota-backed |
| `overage_amount` | number | No | phần vượt quota |
| `risk_state` | enum | No | `normal`, `warning`, `critical` |
| `trend_delta_pct` | number | Yes | chỉ khi include trend |

---

## 4.7 `GET /core/v1/operator/tenants/{tenant_id}/quotas`

**Consumer:** Tenant Usage and Quota  
**Capability:** `operator:commercial:read`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `period_start` | date | No | ISO date |
| `period_end` | date | No | ISO date |

### Response shape

List item bám resource `quota_snapshot` trong contract pack, cộng thêm operator-only fields:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `hard_stop_reason` | enum | Yes | `quota`, `billing`, `policy` |
| `warning_threshold_pct` | number | Yes | policy hint cho UI |
| `projected_exhaustion_at` | datetime | Yes | forecast nhẹ nếu có |

---

## 4.8 `GET /core/v1/operator/tenants/{tenant_id}/billing/subscription`

**Consumer:** Tenant Billing  
**Capability:** `operator:commercial:read`

### Response shape

Base resource bám `subscription_summary` trong contract pack, cộng operator extensions:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `invoice_state` | enum | No | collection posture |
| `credit_balance` | number | Yes | commercial summary |
| `next_invoice_date` | date | Yes | next billing event |
| `operator_notes_count` | integer | No | không trả full notes ở v1 |

---

## 4.9 `GET /core/v1/operator/tenants/{tenant_id}/billing/invoices`

**Consumer:** Tenant Billing  
**Capability:** `operator:commercial:read`  
**Ordering:** `issue_date desc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | No | default 25, max 100 |
| `starting_after` | string | No | cursor |
| `status` | enum | No | invoice status |
| `issue_date_from` | date | No | lower bound |
| `issue_date_to` | date | No | upper bound |

### List item

Base resource bám `invoice_summary` trong contract pack, cộng operator extensions:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `collection_state` | enum | No | operator-oriented state |
| `days_past_due` | integer | Yes | nếu overdue |
| `has_manual_adjustment` | boolean | No | commercial risk hint |

---

## 4.10 `GET /core/v1/operator/health`

**Consumer:** Runtime Health  
**Capability:** `operator:runtime:read`

### Response object

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `operator_health_snapshot` |
| `generated_at` | datetime | No | snapshot time |
| `overall_status` | enum | No | `healthy`, `warning`, `degraded`, `critical` |
| `subsystems` | array[object] | No | health cards |
| `dependencies` | array[object] | No | db, redis, workers, websocket |

### `subsystems[]`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `key` | string | No | subsystem key |
| `status` | enum | No | health status |
| `freshness_seconds` | integer | Yes | nếu có freshness notion |
| `message` | string | Yes | concise status text |

---

## 4.11 `GET /core/v1/operator/jobs`

**Consumer:** Jobs and Materializers  
**Capability:** `operator:runtime:read`  
**Ordering:** `started_at desc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | No | default 25, max 100 |
| `starting_after` | string | No | cursor |
| `status` | enum or array[enum] | No | `queued`, `running`, `failed`, `completed`, `cancelled` |
| `job_family` | string | No | `materializer`, `quota`, `billing`, `ai_runtime`, `signal` |
| `since` | datetime | No | lower bound |
| `tenant_id` | string | No | nullable filter for tenant-bound runs |

### List item `service_run`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `service_run` |
| `id` | string | No | run id |
| `job_key` | string | No | logical job name |
| `job_family` | string | No | bucket group |
| `status` | enum | No | run status |
| `started_at` | datetime | Yes | can be null for queued |
| `finished_at` | datetime | Yes | null if active |
| `duration_ms` | integer | Yes | derived field |
| `tenant_id` | string | Yes | nullable for global jobs |
| `error_code` | string | Yes | safe condensed code |
| `request_id` | string | Yes | trace anchor |

---

## 4.12 `GET /core/v1/operator/audit/requests`

**Consumer:** Audit Trace  
**Capability:** `operator:audit:read`  
**Ordering:** `occurred_at desc`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| `limit` | integer | No | default 25, max 100 |
| `starting_after` | string | No | cursor |
| `request_id` | string | No | exact match shortcut |
| `tenant_id` | string | No | tenant filter |
| `token_id` | string | No | PAT filter |
| `actor_user_id` | string | No | human actor filter |
| `route_family` | string | No | route bucket |
| `status` | integer or array[integer] | No | HTTP status filter |

### List item `request_trace_summary`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `request_id` | string | No | primary lookup key |
| `occurred_at` | datetime | No | ordering anchor |
| `tenant_id` | string | Yes | nullable for global/operator-only |
| `token_id` | string | Yes | if machine-authenticated |
| `actor_user_id` | string | Yes | if human-authenticated |
| `route_family` | string | No | normalized bucket |
| `http_status` | integer | No | response code |
| `latency_ms` | integer | Yes | performance hint |
| `meter_code` | string | Yes | billing/quota trace |

---

## 4.13 `GET /core/v1/operator/audit/requests/{request_id}`

**Consumer:** Audit Trace Detail  
**Capability:** `operator:audit:read`

### Response object `request_trace`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `request_trace` |
| `request_id` | string | No | primary id |
| `occurred_at` | datetime | No | timestamp |
| `tenant_id` | string | Yes | tenant owner |
| `service_account_id` | string | Yes | machine principal |
| `token_id` | string | Yes | credential id |
| `actor_user_id` | string | Yes | human actor |
| `route_family` | string | No | normalized route family |
| `http_status` | integer | No | response code |
| `latency_ms` | integer | Yes | performance hint |
| `meter_code` | string | Yes | billing meter |
| `units_charged` | number | Yes | billed units |
| `source_ip` | string | Yes | request source |
| `capability_snapshot_id` | string | Yes | auth resolution anchor |
| `rate_limit_decision` | object | Yes | optional rate-limit detail |

### Security note

- Request payload bodies nhạy cảm không được echo nguyên trạng ở route này.
- Chỉ expose sanitized audit metadata đủ cho operator diagnosis.

---

## 4.14 `GET /core/v1/operator/ai-runtime`

**Consumer:** AI Runtime Governance  
**Capability:** `operator:runtime:read`

### Response object

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `object` | string | No | luôn là `operator_ai_runtime_snapshot` |
| `generated_at` | datetime | No | snapshot time |
| `provider_rows` | array[object] | No | provider/model readiness |
| `effective_policy_bundle` | object | No | current governance posture |
| `rollout_state` | object | No | rollout flags and warnings |

### `provider_rows[]`

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `provider` | string | No | provider code |
| `model` | string | No | model code |
| `ready` | boolean | No | current readiness |
| `source` | string | Yes | source of effective config |
| `warning_code` | string | Yes | concise warning id |

---

## 5. Freeze recommendation theo endpoint

| Endpoint | Freeze target | Lý do |
|---|---|---|
| overview | Conditionally Frozen | response khá nhỏ, phụ thuộc mainly runtime projections |
| tenants list | Conditionally Frozen | resource semantics đã khá rõ |
| tenant detail | Reviewing | commercial/security summary còn cần chốt field set |
| service-accounts list | Conditionally Frozen | base resource đã rõ, operator extensions nhỏ |
| pats list | Reviewing | anomaly/grace semantics còn cần chốt |
| usage | Reviewing | trend/overage semantics còn mở |
| quotas | Reviewing | hard stop / forecast semantics còn mở |
| billing subscription | Reviewing | credit/commercial projections còn mở |
| billing invoices | Conditionally Frozen | invoice summary dễ freeze sớm hơn |
| health | Conditionally Frozen | health cards có thể freeze theo serving fields tối thiểu |
| jobs | Conditionally Frozen | run list semantics khá trực tiếp |
| audit requests list | Reviewing | route family normalization cần chốt |
| audit request detail | Reviewing | sanitization boundary cần chốt |
| ai-runtime | Reviewing | policy bundle semantics còn evolve |

---

## 6. Kết luận

Artifact này biến operator backlog từ `có route` sang `có contract để freeze theo endpoint`.

Khi team bắt đầu code, đây phải là nguồn tham chiếu chính cho:

- query params và list ordering,
- shape response của từng screen operator,
- phần nào là base resource semantics,
- phần nào chỉ là operator projection fields,
- và endpoint nào đủ gần `Frozen` để triển khai trước.