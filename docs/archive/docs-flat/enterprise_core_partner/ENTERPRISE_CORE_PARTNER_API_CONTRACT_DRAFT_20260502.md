# ENTERPRISE CORE PARTNER API CONTRACT DRAFT

**Date:** 2026-05-02  
**Status:** Current-code truth plus draft contract for `vip-app` and future partner integrations  
**Purpose:** Cụ thể hóa bộ partner/global APIs cần cho `vip-app` ở mức contract đủ để review và freeze trước implementation.

---

## 0. Current-code reality check

Current runtime đã có một phần partner self-service APIs, nhưng chưa đạt target-state machine-auth contract đầy đủ:

- `Implemented now`:
  - `GET/POST /api/core/v1/partner/service-accounts/`,
  - `GET /api/core/v1/partner/tenant/` la current live wrapper route cho tenant summary,
  - `GET /api/core/v1/partner/pats/`, `POST /issue`, `POST /rotate`, `POST /revoke`,
  - `GET /api/core/v1/partner/usage/meters/`, `GET /api/core/v1/partner/usage/quotas/`,
  - `GET /api/core/v1/partner/billing/subscription/`, `GET /api/core/v1/partner/billing/invoices/`.
- `Partial`:
  - tenant context đã được canonicalize qua `CoreTenant`, nhưng current auth mode vẫn là authenticated human session cộng `IsProPlan`, chưa phải tenant PAT verification path,
  - response envelopes `object=list`, `X-Core-Request-Id`, `Idempotency-Key` cho write actions đã có ở self-service control-plane.
- `Target-state`:
  - machine-auth bằng `Authorization: Bearer <tenant_pat>`,
  - toàn bộ data-plane APIs ở Mục 5 (`/market/*`, `/signals/*`, `/ai/*`).

Ghi chu: partner read-model priority ladder do storage strategy 6.5 chot la `tenant_summary` -> `quota_snapshot` -> `session_facts` -> `unified_alert`; `tenant_summary` va `quota_snapshot` di truoc vi da co live wrapper/projection, con `session_facts` va `unified_alert` van la target-state.

---

## 1. Phạm vi

Tài liệu này tập trung vào 3 nhóm endpoint mà `vip-app` cần nhất:

1. **Control-plane APIs**
   tenant, service account, PAT lifecycle.
2. **Commercial-plane APIs**
   usage, quota, subscription, invoices.
3. **Data-plane APIs**
   market snapshots, session facts, alert feeds, AI advisory context.

Đây là draft contract. Nó chưa có nghĩa backend phải triển khai ngay tất cả route bên dưới.

---

## 2. Conventions áp dụng cho toàn bộ partner APIs

### 2.1 Base path

- Base path: `/core/v1`
- Partner routes bắt đầu với `/core/v1/partner/...`
- Data routes dùng chung dưới `/core/v1/market/...`, `/core/v1/signals/...`, `/core/v1/ai/...`

### 2.2 Auth

Current live implementation:

- authenticated Django user session/JWT,
- permission gate `IsAuthenticated` + `IsProPlan`,
- tenant context resolve từ current user qua `CoreTenant.ensure_for_user(...)` seam.

Target-state contract:

- `Authorization: Bearer <tenant_pat>`
- token phải thuộc một `CoreServiceAccount`
- token phải map được về `tenant_id`

### 2.3 Standard headers

| Header | Request/Response | Bắt buộc | Ghi chú |
|---|---|---|---|
| `X-Core-Api-Version` | request | Khuyến nghị mạnh | ví dụ `2026-05-02` |
| `Idempotency-Key` | request | Bắt buộc với mutating POST | UUID v4 hoặc random string |
| `X-Core-Request-Id` | response | Bắt buộc | trace id |
| `X-Core-Quota-Meter` | response | Khi route billable | meter matched |
| `X-Core-Quota-Remaining` | response | Khi route có quota | remaining amount |

### 2.4 Standard list response

```json
{
  "object": "list",
  "url": "/core/v1/partner/pats",
  "data": [],
  "has_more": false,
  "next_cursor": null,
  "prev_cursor": null
}
```

### 2.5 Standard error response

```json
{
  "error": {
    "code": "invalid_scope",
    "message": "The token does not include scope tenant:tokens:write.",
    "param": null,
    "retryable": false,
    "request_id": "req_01jv80...",
    "docs_url": "/docs/errors/invalid_scope"
  }
}
```

---

## 3. Control-plane contracts

### 3.1 `GET /core/v1/partner/tenant`

**Status:** current live wrapper route `GET /api/core/v1/partner/tenant/`; target-state owner path vẫn là `/core/v1/partner/tenant`.

**Scope:** `tenant:read`  
**Meter:** none

**Response draft**

```json
{
  "object": "tenant",
  "id": "ten_01jv7x...",
  "tenant_code": "vip-alpha",
  "display_name": "VNInvest VIP Alpha",
  "status": "active",
  "plan_code": "vip_pro",
  "billing_account_id": "bill_01jv7z...",
  "default_environment": "prod",
  "created_at": "2026-05-02T08:30:00Z",
  "updated_at": "2026-05-02T08:30:00Z"
}
```

Current runtime hien tai tra `billing_account_id: null` vi chua co billing-account model rieng.

### 3.2 `GET /core/v1/partner/service-accounts`

**Scope:** `tenant:service_accounts:read`  
**Query params:** `limit`, `starting_after`, `ending_before`, `status`, `environment`  
**Meter:** none

**List item shape**

```json
{
  "object": "service_account",
  "id": "sat_01jv81...",
  "tenant_id": "ten_01jv7x...",
  "name": "vip-alpha-prod-orchestrator",
  "environment": "prod",
  "status": "active",
  "policy_ids": ["pol_market_read", "pol_ai_invoke"],
  "last_rotated_at": "2026-05-01T10:00:00Z",
  "created_at": "2026-05-01T09:00:00Z",
  "updated_at": "2026-05-01T10:00:00Z"
}
```

### 3.3 `POST /core/v1/partner/service-accounts`

**Scope:** `tenant:service_accounts:write`  
**Headers:** `Idempotency-Key` required  
**Meter:** none

**Request draft**

```json
{
  "name": "vip-alpha-staging-analytics",
  "environment": "staging",
  "policy_ids": ["pol_market_read", "pol_signals_read"],
  "metadata": {
    "owner_team": "analytics"
  }
}
```

### 3.4 `GET /core/v1/partner/pats`

**Scope:** `tenant:tokens:read`  
**Query params:** `limit`, `starting_after`, `ending_before`, `service_account_id`, `status`  
**Meter:** none

**List item shape**

```json
{
  "object": "pat_credential",
  "id": "pat_01jv82...",
  "tenant_id": "ten_01jv7x...",
  "service_account_id": "sat_01jv81...",
  "token_prefix": "vni_pat_live_9f3c",
  "scope_codes": ["market:read", "signals:read"],
  "status": "active",
  "expires_at": "2026-07-31T00:00:00Z",
  "last_used_at": "2026-05-02T09:40:00Z",
  "last_ip": "203.0.113.10",
  "created_at": "2026-05-01T10:00:00Z"
}
```

### 3.5 `POST /core/v1/partner/pats/issue`

**Scope:** `tenant:tokens:write`  
**Headers:** `Idempotency-Key` required  
**Meter:** none

**Request draft**

```json
{
  "service_account_id": "sat_01jv81...",
  "scope_codes": ["market:read", "signals:read", "ai:invoke"],
  "expires_at": "2026-08-01T00:00:00Z",
  "display_name": "prod-main-token"
}
```

**Response draft**

```json
{
  "object": "pat_credential",
  "id": "pat_01jv82...",
  "tenant_id": "ten_01jv7x...",
  "service_account_id": "sat_01jv81...",
  "token_prefix": "vni_pat_live_9f3c",
  "secret": "vni_pat_live_9f3c_XXXXXXXXXXXXXXXX",
  "scope_codes": ["market:read", "signals:read", "ai:invoke"],
  "status": "active",
  "expires_at": "2026-08-01T00:00:00Z",
  "created_at": "2026-05-02T09:45:00Z"
}
```

`secret` chỉ xuất hiện đúng một lần khi issue thành công.

### 3.6 `POST /core/v1/partner/pats/{token_id}/rotate`

**Scope:** `tenant:tokens:write`  
**Headers:** `Idempotency-Key` required  
**Meter:** none

**Request draft**

```json
{
  "grace_period_seconds": 3600,
  "expires_at": "2026-10-01T00:00:00Z"
}
```

**Response draft**

```json
{
  "object": "pat_rotation",
  "old_token_id": "pat_01jv82...",
  "new_token": {
    "object": "pat_credential",
    "id": "pat_01jv83...",
    "token_prefix": "vni_pat_live_a12d",
    "secret": "vni_pat_live_a12d_XXXXXXXXXXXXXXXX",
    "status": "active",
    "expires_at": "2026-10-01T00:00:00Z"
  },
  "old_token_grace_until": "2026-05-02T10:45:00Z"
}
```

### 3.7 `POST /core/v1/partner/pats/{token_id}/revoke`

**Scope:** `tenant:tokens:write`  
**Headers:** `Idempotency-Key` required  
**Meter:** none

**Request draft**

```json
{
  "reason": "credential_leak_suspected"
}
```

---

## 4. Commercial-plane contracts

### 4.1 `GET /core/v1/partner/usage/meters`

**Scope:** `billing:read`  
**Query params:** `period_start`, `period_end`, `meter_code`, `limit`, `starting_after`  
**Meter:** none

**List item shape**

```json
{
  "object": "usage_meter",
  "meter_code": "ai_advisory_request",
  "unit": "request",
  "period_start": "2026-05-01T00:00:00Z",
  "period_end": "2026-05-31T23:59:59Z",
  "consumed_amount": 1840,
  "billable_amount": 1840,
  "aggregation_window": "monthly"
}
```

### 4.2 `GET /core/v1/partner/usage/quotas`

**Scope:** `billing:read`  
**Query params:** `meter_code`  
**Meter:** none

**List item shape**

```json
{
  "object": "quota_snapshot",
  "tenant_id": "ten_01jv7x...",
  "meter_code": "ai_advisory_request",
  "period_start": "2026-05-01T00:00:00Z",
  "period_end": "2026-05-31T23:59:59Z",
  "entitled_amount": 5000,
  "consumed_amount": 1840,
  "remaining_amount": 3160,
  "overage_amount": 0,
  "hard_stop": false,
  "reset_at": "2026-06-01T00:00:00Z"
}
```

### 4.3 `GET /core/v1/partner/billing/subscription`

**Scope:** `billing:read`  
**Meter:** none

**Response draft**

```json
{
  "object": "subscription_summary",
  "tenant_id": "ten_01jv7x...",
  "plan_code": "vip_pro",
  "status": "active",
  "billing_cycle": "monthly",
  "currency": "VND",
  "entitlements": [
    {"feature_code": "market_api", "enabled": true},
    {"feature_code": "signals_api", "enabled": true},
    {"feature_code": "ai_advisory", "enabled": true}
  ],
  "credit_balance": 2500,
  "overage_policy": "invoice_later",
  "current_period_start": "2026-05-01T00:00:00Z",
  "current_period_end": "2026-05-31T23:59:59Z"
}
```

### 4.4 `GET /core/v1/partner/billing/invoices`

**Scope:** `billing:read`  
**Query params:** `status`, `limit`, `starting_after`  
**Meter:** none

**List item shape**

```json
{
  "object": "invoice_summary",
  "id": "inv_01jv84...",
  "tenant_id": "ten_01jv7x...",
  "invoice_number": "VNINV-2026-0501",
  "currency": "VND",
  "subtotal_amount": 15000000,
  "credit_applied_amount": 0,
  "overage_amount": 1250000,
  "total_due_amount": 16250000,
  "status": "issued",
  "issued_at": "2026-05-01T08:00:00Z",
  "due_at": "2026-05-15T00:00:00Z"
}
```

---

## 5. Data-plane contracts cho `vip-app`

Toàn bộ data-plane contracts ở Mục 5 hiện vẫn là target-state. Current runtime chưa expose các route `/core/v1/market/*`, `/core/v1/signals/*` hay `/core/v1/ai/*` theo partner contract family này.

### 5.1 `GET /core/v1/market/tickers`

**Scope:** `market:read`  
**Meter:** `market_snapshot_read`

**Query params đề xuất**

- `symbols=HPG,SSI,VCI`
- `exchange=HOSE`
- `limit=100`

**List item shape**

```json
{
  "object": "symbol_snapshot",
  "symbol": "HPG",
  "trade_date": "2026-05-02",
  "as_of": "2026-05-02T09:50:00Z",
  "last_price": 28.6,
  "change_pct": 1.42,
  "matched_value_vnd": 422300000000,
  "stale": false
}
```

### 5.2 `GET /core/v1/market/symbols/{symbol}/snapshot`

**Scope:** `market:read`  
**Meter:** `market_snapshot_read`

**Response draft**

```json
{
  "object": "symbol_snapshot",
  "symbol": "HPG",
  "exchange": "HOSE",
  "company_name": "CTCP Tập đoàn Hòa Phát",
  "trade_date": "2026-05-02",
  "as_of": "2026-05-02T09:50:00Z",
  "last_price": 28.6,
  "change_pct": 1.42,
  "matched_value_vnd": 422300000000,
  "open_price": 28.1,
  "high_price": 28.8,
  "low_price": 28.0,
  "reference_price": 28.2,
  "week_52_high": 32.4,
  "week_52_low": 23.7,
  "stale": false
}
```

### 5.3 `GET /core/v1/market/symbols/{symbol}/session-facts`

**Scope:** `signals:read`  
**Meter:** `session_facts_read`

**Query params đề xuất**

- `trade_date=2026-05-02`
- `selected_session=auto|morning|afternoon|full_day`

**Response draft**

```json
{
  "object": "session_facts",
  "symbol": "HPG",
  "trade_date": "2026-05-02",
  "selected_session": "full_day",
  "buy_value_vnd": 210300000000,
  "sell_value_vnd": 188900000000,
  "net_value_vnd": 21400000000,
  "cvd_normalized": 0.37,
  "buy_strength": 0.61,
  "institutional_strength": 0.58,
  "whale_count": 7,
  "dark_flow_score": 0.22,
  "facts_revision": 4,
  "as_of": "2026-05-02T09:50:00Z"
}
```

### 5.4 `GET /core/v1/signals/whale/events`

**Scope:** `signals:read`  
**Meter:** `signal_feed_delivery`

**Query params đề xuất**

- `symbol=HPG`
- `trade_date=2026-05-02`
- `severity=critical`
- `limit=50`
- `starting_after=<cursor>`

### 5.5 `GET /core/v1/signals/unified-alerts`

**Scope:** `signals:read`  
**Meter:** `signal_feed_delivery`

**List item shape**

```json
{
  "object": "unified_alert",
  "id": "ual_01jv85...",
  "symbol": "HPG",
  "alert_type": "whale",
  "severity": "warning",
  "title": "Xuất hiện cụm lệnh lớn bất thường",
  "summary": "Cụm giao dịch mua lớn xuất hiện trong phiên chiều.",
  "source_kind": "whale_detection",
  "occurred_at": "2026-05-02T09:47:00Z",
  "related_object_id": "whe_01jv85...",
  "session_ref": "2026-05-02/full_day"
}
```

### 5.6 `GET /core/v1/ai/advisory-context/{symbol}`

**Scope:** `ai:invoke`  
**Meter:** `ai_advisory_request`

**Response draft**

```json
{
  "object": "advisory_context",
  "symbol": "HPG",
  "snapshot": {
    "symbol": "HPG",
    "last_price": 28.6,
    "change_pct": 1.42,
    "matched_value_vnd": 422300000000
  },
  "session_facts": {
    "selected_session": "full_day",
    "cvd_normalized": 0.37,
    "buy_strength": 0.61,
    "institutional_strength": 0.58,
    "whale_count": 7
  },
  "signals": {
    "latest_alert_count": 3,
    "latest_alert_types": ["whale", "advisory"]
  },
  "as_of": "2026-05-02T09:50:00Z"
}
```

---

## 6. Error codes tối thiểu cần reserve

| Code | HTTP status | Retryable | Ý nghĩa |
|---|---|---|---|
| `invalid_api_version` | 400 | No | version header không hợp lệ |
| `invalid_request` | 400 | No | payload/query sai |
| `authentication_failed` | 401 | No | token không hợp lệ |
| `token_expired` | 401 | No | token hết hạn |
| `invalid_scope` | 403 | No | thiếu scope |
| `tenant_suspended` | 403 | No | tenant bị treo |
| `feature_not_entitled` | 403 | No | không có entitlement |
| `resource_not_found` | 404 | No | không tìm thấy object |
| `conflict` | 409 | Maybe | xung đột state |
| `rate_limited` | 429 | Yes | vượt rate limit |
| `quota_exceeded` | 429 hoặc 403 theo policy | No | vượt quota/budget gate |
| `upstream_degraded` | 503 | Yes | degraded dependency |
| `internal_error` | 500 | Maybe | server error |

---

## 7. Freeze criteria cho draft này

Bộ partner API contracts này chỉ nên được coi là đủ tốt để chuyển sang implementation khi:

1. `vip-app` xác nhận control-plane contracts đủ cho local control plane.
2. `opencore` xác nhận billing/usage fields đủ cho commercial views.
3. `web` và AI consumers xác nhận data-plane fields không thiếu semantic quan trọng.
4. Meter mapping cho từng route family đã được chốt.
5. Error model đã được chấp nhận ở mức client SDK hoặc integration layer.

---

## 8. Kết luận

Tài liệu này đóng vai trò bridge giữa architecture blueprint và implementation. Nó cho phép đội ngũ khóa semantics của `vip-app` integration mà chưa cần lập tức code backend, migrate schema hay public route ra ngoài.