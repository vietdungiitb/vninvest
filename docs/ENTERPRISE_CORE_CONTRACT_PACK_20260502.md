# ENTERPRISE CORE CONTRACT PACK

**Date:** 2026-05-02  
**Status:** Current-code truth plus contract-first companion artifact for `core`  
**Purpose:** Chốt bộ contract tối thiểu để `core` có thể phục vụ `web`, `opencore`, `vip-app`, `mobile` theo kiểu production platform mà chưa cần triển khai sớm hay tách schema CSDL.

---

## 0. Current-code freeze posture

Tại thời điểm hiện tại, không phải mọi resource trong contract pack này đều đã live dưới `core` public contract. Bảng dưới đây là truth table để đội code và auditors không đọc nhầm giữa contract freeze và runtime availability.

| Resource | Current-code trạng thái | Ghi chú |
|---|---|---|
| `tenant` | Live wrapper route | `GET /api/core/v1/partner/tenant/` da live; `GET /core/v1/partner/tenant` van la target-state owner path |
| `service_account` | Live self-service | partner self-service list/create đã chạy thật |
| `pat_credential` | Live self-service | list/issue/rotate/revoke đã chạy thật |
| `usage_meter` | Partial | mới có projection list qua `/core/v1/partner/usage/meters/`, chưa có catalog resource độc lập |
| `quota_snapshot` | Live self-service projection | `/core/v1/partner/usage/quotas/` đã chạy thật |
| `subscription_summary` | Live self-service projection | `/core/v1/partner/billing/subscription/` đã chạy thật |
| `invoice_summary` | Live self-service list | `/core/v1/partner/billing/invoices/` đã chạy thật |
| `symbol_snapshot` | Target-state | chưa có route `core` contract family ổn định |
| `session_facts` | Target-state | current repo có whale/session logic, nhưng chưa freeze thành `core` public contract resource |
| `unified_alert` | Target-state | current repo có alert surfaces, nhưng chưa freeze thành `core` public contract resource |

Ghi chu: ma tran implemented-vs-target resource chi tiet nam trong `docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md`; bang nay chi giu truth table runtime availability va target-state wording de khong tron semantic freeze.

---

## 1. Vai trò của contract pack

`core` chỉ nên được coi là “sẵn sàng để build” khi có một contract pack đủ rõ để:

- khóa semantics của resources,
- khóa auth và scope semantics,
- khóa quota/billing semantics,
- khóa additive vs breaking change policy,
- giúp mọi package tiêu thụ cùng một ngôn ngữ nghiệp vụ.

Tài liệu này không thay thế architecture blueprint. Nó là lớp đứng giữa blueprint và implementation.

---

## 2. Phạm vi resource phải được chốt trước

Giai đoạn đầu, `core` chỉ cần khóa 10 resource bên dưới. Không nên mở rộng vô hạn số resource ngay từ đầu.

| Resource | Object key | Loại contract | Consumer chính | Ghi chú |
|---|---|---|---|---|
| Tenant | `tenant` | control-plane | `vip-app`, `opencore`, operator | resource gốc của B2B/VIP |
| Service Account | `service_account` | control-plane | `vip-app`, operator | machine principal |
| PAT Credential | `pat_credential` | control-plane | `vip-app`, operator | token metadata, không chứa secret |
| Usage Meter | `usage_meter` | commercial-plane | `vip-app`, `opencore` | đơn vị billing/quota |
| Quota Snapshot | `quota_snapshot` | commercial-plane | `vip-app`, `opencore` | remaining, reset, overage |
| Subscription Summary | `subscription_summary` | commercial-plane | `vip-app`, `opencore` | entitlements + billing policy |
| Invoice Summary | `invoice_summary` | commercial-plane | `vip-app`, `opencore` | invoice list/detail nhẹ |
| Symbol Snapshot | `symbol_snapshot` | data-plane | `web`, `mobile`, `vip-app`, AI | serving snapshot chuẩn |
| Session Facts | `session_facts` | data-plane | `web`, `vip-app`, AI | facts-first selected session |
| Unified Alert | `unified_alert` | data-plane | `web`, `mobile`, `vip-app` | alert feed chuẩn hóa |

---

## 3. Quy ước contract cứng

### 3.1 Naming conventions

- Path resources dùng `kebab-case`: `service-accounts`, `session-facts`.
- JSON fields dùng `snake_case` để phù hợp thực tế backend Django/DRF hiện tại.
- External object ids nên có prefix ổn định, ví dụ `ten_`, `sat_`, `pat_`, `meter_`, `inv_`, `sym_`, `sf_`, `ual_`.
- Enum values dùng `snake_case`, không dùng text mô tả tự do cho các field nghiệp vụ quan trọng.

### 3.2 Response shape conventions

Single resource response nên theo dạng:

```json
{
  "object": "tenant",
  "id": "ten_01jv7x...",
  "display_name": "VNInvest VIP Alpha",
  "status": "active",
  "created_at": "2026-05-02T08:30:00Z",
  "updated_at": "2026-05-02T08:30:00Z"
}
```

List response nên theo dạng:

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

### 3.3 Standard headers

| Header | Hướng | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `Authorization: Bearer <token>` | request | Có với partner APIs | tenant PAT |
| `X-Core-Api-Version` | request | Khuyến nghị mạnh với `vip-app` | pin semantics theo release date |
| `Idempotency-Key` | request | Bắt buộc với mutating POST | retry-safe writes |
| `X-Core-Request-Id` | response | Bắt buộc | truy vết request |
| `X-Core-RateLimit-Limit` | response | Khi có rate limit | giới hạn rate |
| `X-Core-RateLimit-Remaining` | response | Khi có rate limit | phần còn lại |
| `X-Core-RateLimit-Reset` | response | Khi có rate limit | thời điểm reset |
| `X-Core-Quota-Meter` | response | Khi route có meter | meter applied |
| `X-Core-Quota-Remaining` | response | Khi route có quota | quota còn lại |

### 3.4 Include and expand policy

- Mặc định response phải gọn và ổn định.
- Chỉ các field đã whitelist mới được dùng qua `include` hoặc `expand`.
- `expand` chỉ dùng cho nested object references có chi phí thấp và rõ semantics.
- Không cho phép client tự do yêu cầu arbitrary joins qua query string.

### 3.5 Pagination policy

- Feed thay đổi liên tục dùng cursor pagination.
- Query parameters ưu tiên: `limit`, `starting_after`, `ending_before`.
- `limit` mặc định 25, tối đa 100 cho partner APIs.
- Ordering mặc định phải được chốt ở contract, ví dụ `created_at desc` hoặc `occurred_at desc`.

### 3.6 Idempotency policy

Các endpoint sau bắt buộc dùng `Idempotency-Key`:

- issue PAT,
- rotate PAT,
- revoke PAT nếu có effect billing/quota đi kèm,
- create service account,
- grant credits,
- manual invoice adjustment,
- tenant policy writes.

### 3.7 Error model

Error response chuẩn:

```json
{
  "error": {
    "code": "quota_exceeded",
    "message": "Quota meter ai_advisory_request exceeded.",
    "param": null,
    "retryable": false,
    "request_id": "req_01jv7y...",
    "docs_url": "/docs/errors/quota_exceeded"
  }
}
```

---

## 4. Field dictionary tối thiểu cho từng resource

### 4.1 `tenant`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `tenant` |
| `id` | string | Không | `CoreTenant` | external id ổn định |
| `tenant_code` | string | Không | `CoreTenant` | human-friendly slug/code |
| `display_name` | string | Không | `CoreTenant` | tên hiển thị |
| `status` | enum | Không | `CoreTenant` | `active`, `suspended`, `disabled`, `pending_setup` |
| `plan_code` | string | Có | entitlement layer | mã plan hiệu lực |
| `billing_account_id` | string | Có | `CoreBillingAccount` | external id billing |
| `default_environment` | enum | Có | `CoreTenant` | `prod`, `staging`, `dev` |
| `created_at` | datetime | Không | `CoreTenant` | UTC |
| `updated_at` | datetime | Không | `CoreTenant` | UTC |
| `metadata` | object | Có | `CoreTenant` | non-sensitive tags |

### 4.2 `service_account`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `service_account` |
| `id` | string | Không | `CoreServiceAccount` | external id |
| `tenant_id` | string | Không | `CoreServiceAccount` | owner tenant |
| `name` | string | Không | `CoreServiceAccount` | tên máy/service |
| `environment` | enum | Không | `CoreServiceAccount` | `prod`, `staging`, `dev` |
| `status` | enum | Không | `CoreServiceAccount` | `active`, `disabled`, `pending_approval` |
| `policy_ids` | array[string] | Không | access policy layer | scope bundle đã gán |
| `created_by_user_id` | string | Có | audit layer | human creator |
| `last_rotated_at` | datetime | Có | PAT layer | lần rotate gần nhất |
| `created_at` | datetime | Không | `CoreServiceAccount` | UTC |
| `updated_at` | datetime | Không | `CoreServiceAccount` | UTC |

### 4.3 `pat_credential`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `pat_credential` |
| `id` | string | Không | `CorePATCredential` | external id |
| `tenant_id` | string | Không | `CorePATCredential` | owner tenant |
| `service_account_id` | string | Không | `CorePATCredential` | owner service account |
| `token_prefix` | string | Không | `CorePATCredential` | hiển thị an toàn |
| `scope_codes` | array[string] | Không | access policy layer | effective scopes |
| `status` | enum | Không | `CorePATCredential` | `active`, `rotating`, `revoked`, `expired` |
| `expires_at` | datetime | Có | `CorePATCredential` | token expiry |
| `last_used_at` | datetime | Có | usage log | lần dùng gần nhất |
| `last_ip` | string | Có | usage log | IP gần nhất |
| `issued_by_user_id` | string | Có | audit layer | human issuer |
| `revoked_at` | datetime | Có | `CorePATCredential` | revoke time |
| `created_at` | datetime | Không | `CorePATCredential` | UTC |

### 4.4 `usage_meter`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `usage_meter` |
| `id` | string | Không | `CoreUsageMeter` | external id |
| `meter_code` | string | Không | `CoreUsageMeter` | ví dụ `ai_advisory_request` |
| `display_name` | string | Không | `CoreUsageMeter` | tên hiển thị |
| `unit` | enum | Không | `CoreUsageMeter` | `request`, `batch`, `event`, `minute`, `file_unit` |
| `aggregation_window` | enum | Không | `CoreUsageMeter` | `hourly`, `daily`, `monthly` |
| `rounding_mode` | enum | Không | `CoreUsageMeter` | `ceil`, `floor`, `exact` |
| `billable` | boolean | Không | `CoreUsageMeter` | có đưa vào invoice không |
| `quota_enforced` | boolean | Không | `CoreUsageMeter` | có quota gate không |
| `status` | enum | Không | `CoreUsageMeter` | `active`, `deprecated`, `disabled` |

### 4.5 `quota_snapshot`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `quota_snapshot` |
| `tenant_id` | string | Không | quota ledger | owner tenant |
| `meter_code` | string | Không | quota ledger | meter applied |
| `period_start` | datetime | Không | quota ledger | window start |
| `period_end` | datetime | Không | quota ledger | window end |
| `entitled_amount` | number | Không | quota ledger | quota gốc |
| `consumed_amount` | number | Không | quota ledger | đã dùng |
| `remaining_amount` | number | Không | contract projection | còn lại |
| `overage_amount` | number | Không | quota ledger | phần vượt |
| `hard_stop` | boolean | Không | tenant policy | có block không |
| `reset_at` | datetime | Có | quota ledger | thời điểm reset |

### 4.6 `subscription_summary`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `subscription_summary` |
| `tenant_id` | string | Không | billing layer | owner tenant |
| `plan_code` | string | Không | billing layer | plan hiện hành |
| `status` | enum | Không | billing layer | `trialing`, `active`, `past_due`, `suspended`, `canceled` |
| `billing_cycle` | enum | Không | billing layer | `monthly`, `quarterly`, `annual` |
| `currency` | string | Không | billing layer | ví dụ `VND`, `USD` |
| `entitlements` | array[object] | Không | entitlement projection | feature access |
| `credit_balance` | number | Không | billing layer | credits còn lại |
| `overage_policy` | enum | Không | billing layer | `allow`, `block`, `invoice_later` |
| `current_period_start` | datetime | Không | billing layer | period start |
| `current_period_end` | datetime | Không | billing layer | period end |

### 4.7 `invoice_summary`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `invoice_summary` |
| `id` | string | Không | invoice store | external id |
| `tenant_id` | string | Không | invoice store | owner tenant |
| `invoice_number` | string | Không | invoice store | human-readable number |
| `currency` | string | Không | invoice store | invoice currency |
| `subtotal_amount` | number | Không | invoice store | subtotal |
| `credit_applied_amount` | number | Không | invoice store | credits |
| `overage_amount` | number | Không | invoice store | overage |
| `total_due_amount` | number | Không | invoice store | total |
| `status` | enum | Không | invoice store | `draft`, `issued`, `paid`, `void`, `past_due` |
| `issued_at` | datetime | Có | invoice store | issue time |
| `due_at` | datetime | Có | invoice store | due time |

### 4.8 `symbol_snapshot`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `symbol_snapshot` |
| `symbol` | string | Không | market serving | mã chứng khoán |
| `exchange` | string | Có | market reference | sàn |
| `company_name` | string | Có | market reference | tên công ty |
| `trade_date` | date | Không | market serving | ngày phiên |
| `as_of` | datetime | Không | market serving | freshness timestamp |
| `last_price` | number | Có | market serving | giá gần nhất |
| `change_pct` | number | Có | market serving | phần trăm thay đổi |
| `matched_value_vnd` | number | Có | market serving | thanh khoản |
| `open_price` | number | Có | market serving | mở cửa |
| `high_price` | number | Có | market serving | cao nhất |
| `low_price` | number | Có | market serving | thấp nhất |
| `reference_price` | number | Có | market serving | tham chiếu |
| `week_52_high` | number | Có | market serving | 52W high |
| `week_52_low` | number | Có | market serving | 52W low |
| `stale` | boolean | Không | contract projection | freshness flag |

### 4.9 `session_facts`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `session_facts` |
| `symbol` | string | Không | facts layer | mã chứng khoán |
| `trade_date` | date | Không | facts layer | ngày phiên |
| `selected_session` | string | Không | facts layer | session đang chọn |
| `buy_value_vnd` | number | Có | facts layer | tổng mua |
| `sell_value_vnd` | number | Có | facts layer | tổng bán |
| `net_value_vnd` | number | Có | facts layer | net flow |
| `cvd_normalized` | number | Có | facts layer | cvd chuẩn hóa |
| `buy_strength` | number | Có | facts layer | strength |
| `institutional_strength` | number | Có | facts layer | institutional strength |
| `whale_count` | integer | Có | facts layer | số whale |
| `dark_flow_score` | number | Có | facts layer | order-flow / dark-flow score |
| `facts_revision` | integer | Không | facts layer | versioning nội bộ |
| `as_of` | datetime | Không | facts layer | freshness timestamp |

### 4.10 `unified_alert`

| Field | Type | Nullable | Source-of-truth | Notes |
|---|---|---|---|---|
| `object` | string | Không | contract | luôn là `unified_alert` |
| `id` | string | Không | alert projection | external id |
| `symbol` | string | Có | alert projection | symbol nếu có |
| `alert_type` | enum | Không | alert projection | `whale`, `dark_flow`, `advisory`, `screener` |
| `severity` | enum | Không | alert projection | `info`, `warning`, `critical` |
| `title` | string | Không | alert projection | summary title |
| `summary` | string | Có | alert projection | mô tả ngắn |
| `source_kind` | enum | Không | alert projection | source pipeline |
| `occurred_at` | datetime | Không | alert projection | event time |
| `related_object_id` | string | Có | alert projection | linked event/resource |
| `session_ref` | string | Có | alert projection | session link |

---

## 5. Endpoint matrix tối thiểu

| Resource | GET | LIST | CREATE | ROTATE | REVOKE | SEARCH | EXPORT |
|---|---|---|---|---|---|---|---|
| Tenant | Yes | No | No | No | No | No | No |
| Service Account | Yes | Yes | Yes | No | Disable only | No | No |
| PAT Credential | No | Yes | Issue | Yes | Yes | No | No |
| Usage Meter | No | Yes | No | No | No | Optional | No |
| Quota Snapshot | No | Yes | No | No | No | No | Export later |
| Subscription Summary | Yes | No | No | No | No | No | No |
| Invoice Summary | Yes | Yes | Adjust later | No | Void later | Optional | Yes later |
| Symbol Snapshot | Yes | Optional batch | No | No | No | Filter | Export later |
| Session Facts | Yes | Optional batch | No | No | No | Filter | Export later |
| Unified Alert | Yes | Yes | No | No | No | Yes | Export later |

---

## 6. Auth, scope, quota và meter matrix

Bảng dưới đây là target-state contract matrix. Trong current runtime, toàn bộ partner self-service endpoints hiện đang dùng human session/JWT thay vì tenant PAT machine auth.

| Endpoint family | Auth mode | Scope tối thiểu | Meter | Quota gate |
|---|---|---|---|---|
| `/core/v1/partner/tenant` | tenant PAT | `tenant:read` | none | no |
| `/core/v1/partner/service-accounts*` | tenant PAT | `tenant:service_accounts:read/write` | none | no |
| `/core/v1/partner/pats*` | tenant PAT | `tenant:tokens:read/write` | none | no |
| `/core/v1/partner/usage/*` | tenant PAT | `billing:read` | none | no |
| `/core/v1/partner/billing/*` | tenant PAT | `billing:read` | none | no |
| `/core/v1/market/tickers` | tenant PAT or user session | `market:read` | `market_snapshot_read` | yes |
| `/core/v1/market/symbols/{symbol}/snapshot` | tenant PAT or user session | `market:read` | `market_snapshot_read` | yes |
| `/core/v1/market/symbols/{symbol}/session-facts` | tenant PAT or user session | `signals:read` | `session_facts_read` | yes |
| `/core/v1/signals/whale/events` | tenant PAT or user session | `signals:read` | `signal_feed_delivery` | yes |
| `/core/v1/signals/unified-alerts` | tenant PAT or user session | `signals:read` | `signal_feed_delivery` | yes |
| `/core/v1/ai/advisory-context/{symbol}` | tenant PAT or user session | `ai:invoke` | `ai_advisory_request` | yes |

---

## 7. Breaking vs additive change policy

### 7.1 Additive changes

Các thay đổi sau được xem là additive:

- thêm endpoint mới,
- thêm field response optional,
- thêm query parameter optional,
- thêm response header optional,
- thêm enum value mới nếu consumer đã được yêu cầu tolerant-read.

### 7.2 Breaking changes

Các thay đổi sau phải được xem là breaking:

- xóa hoặc rename endpoint,
- xóa hoặc rename field,
- đổi type field,
- thêm required parameter,
- đổi auth requirement hoặc scope requirement,
- đổi quota/meter matching mà không đổi contract version,
- đổi default ordering của list/feed endpoints,
- đổi error code semantics.

### 7.3 Versioning policy đề xuất

- Path major version giữ ổn định ở `/core/v1/...`.
- Tích hợp nhạy cảm như `vip-app` nên pin thêm `X-Core-Api-Version: 2026-05-02`.
- Additive changes có thể đi vào cùng major path.
- Breaking changes chỉ được rollout qua version date/header mới hoặc major path mới khi thật cần thiết.
- Version đã public cho `vip-app` nên được support tối thiểu 24 tháng kể từ ngày phát hành successor có breaking changes.

---

## 8. Checklist contract freeze

Một resource hoặc endpoint family chỉ được coi là “contract frozen” khi trả lời được đầy đủ:

1. Resource name là gì và object key là gì?
2. Resource đó read từ source-of-truth nào?
3. Endpoint nào public, endpoint nào internal-only?
4. Auth mode nào áp dụng?
5. Scope nào là tối thiểu?
6. Meter nào bị charge?
7. Quota check ở lớp nào?
8. Ordering/pagination semantics là gì?
9. Error codes chính là gì?
10. Điều gì bị xem là breaking change?

Nếu chưa đủ 10 câu trả lời trên thì resource đó chưa được phép kéo schema split hay implementation public route.

---

## 9. Kết luận

Với `core`, contract pack là điểm bắt đầu thực tế hơn schema design chi tiết. Nếu contract pack chưa rõ, mọi thảo luận về migration, schema split hay microservice split đều dễ sai thứ tự.

Tài liệu này nên được dùng như lớp duyệt bắt buộc trước khi:

- tạo bảng mới cho partner layer,
- public các route `/core/v1/partner/*`,
- dựng usage metering pipeline,
- hoặc để `vip-app` bắt đầu tích hợp production.