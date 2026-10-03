# ENTERPRISE CORE RESOURCE FREEZE CHECKLIST

**Date:** 2026-05-02  
**Status:** Current-code truth plus review artifact before implementation  
**Purpose:** Chốt checklist freeze cho các resource lõi đầu tiên của `core` để đội triển khai không nhảy vào code khi object semantics, auth semantics, meter semantics và storage semantics còn mơ hồ.

---

## 0. Current-code freeze snapshot

| Resource | Current runtime trạng thái | Ghi chú handoff |
|---|---|---|
| `tenant` | Partial | model `CoreTenant` đã có, nhưng public partner route `GET /core/v1/partner/tenant` chưa live |
| `service_account` | Live self-service | list/create đang chạy dưới partner self-service APIs |
| `pat_credential` | Live self-service | list/issue/rotate/revoke đang chạy dưới partner self-service APIs |
| `usage_meter` | Partial | hiện mới là projection list từ static meter definitions + quota service |
| `symbol_snapshot` | Target-state | chưa freeze thành `core` public route family |
| `session_facts` | Target-state | chưa freeze thành `core` public route family |

Ghi chu: thu tu migration/backfill/rollback identity/commercial deltas nam trong `docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md`; checklist nay chi freeze posture.

Ghi chu: ma tran implemented-vs-target resource chi tiet nam trong `docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md`; checklist nay chi freeze posture va khong thay the canonical matrix.

Trừ khi một mục bên dưới ghi rõ khác đi, các bảng freeze trong tài liệu này phải được đọc như `target-state freeze posture`, không mặc định là current live contract.

---

## 1. Cách dùng tài liệu này

Tài liệu này không thay thế contract pack. Nó là lớp review cuối cùng trước implementation cho từng resource ưu tiên cao nhất.

Một resource chỉ nên chuyển sang implementation khi:

1. contract pack đã có object shape và change policy,
2. schema strategy đã chốt storage class và ownership,
3. checklist resource bên dưới đã đóng hết các câu hỏi còn mở,
4. consumer chính đã review payload và semantics.

---

## 2. Freeze scale

| Mức | Ý nghĩa |
|---|---|
| `Draft` | Mới ở mức ý tưởng, chưa đủ để code |
| `Reviewing` | Đã có contract shape, còn quyết định mở |
| `Conditionally Frozen` | Đủ để code slice hẹp nếu không đổi scope |
| `Frozen` | Có thể implement, test và public theo phase gate |

Ở thời điểm hiện tại, các resource dưới đây nên được coi là `Reviewing` hoặc `Conditionally Frozen`, chưa mặc định là `Frozen` hoàn toàn.

---

## 3. Checklist chung áp dụng cho mọi resource

Trước khi freeze bất kỳ resource nào, phải trả lời đủ 12 câu sau:

1. Object key là gì?
2. External id format là gì?
3. Ai là owner service?
4. Source-of-truth là mutable state, canonical event hay read model?
5. Consumer nào được đọc resource này?
6. Auth mode nào được phép dùng?
7. Scope tối thiểu là gì?
8. Meter nào áp dụng, nếu có?
9. Pagination, ordering và filtering semantics là gì?
10. Những field nào có thể additive, field nào là breaking hotspot?
11. Retention và audit expectations là gì?
12. Nếu read model lệch hoặc stale thì degrade semantics là gì?

Nếu thiếu một câu trả lời, resource chưa nên bước sang implementation công khai.

---

## 4. Resource checklist

## 4.1 `tenant`

**Freeze target:** `Conditionally Frozen`  
**Owner service:** `identity_access_service`  
**Storage class:** mutable control-plane state

### Các quyết định hiện tại

| Hạng mục | Quyết định hiện tại | Trạng thái |
|---|---|---|
| Object key | `tenant` | Proposed |
| Primary consumers | `vip-app`, `opencore`, operator | Stable |
| Auth mode | tenant PAT hoặc operator session tùy route | Stable |
| Scope | `tenant:read` | Stable |
| Public route | `GET /api/core/v1/partner/tenant/` la current live wrapper route; `GET /core/v1/partner/tenant` van la target-state owner path | Partial |
| Source-of-truth | `CoreTenant` + entitlement/billing overlay | Stable |
| Mutable fields | `display_name`, `status`, `default_environment`, metadata | Stable |
| Breaking hotspots | `status` semantics, `plan_code`, billing owner semantics | Open |

### Các câu hỏi phải chốt trước khi freeze hoàn toàn

- `tenant_code` có immutable sau khi tạo hay không?
- `status=suspended` có block toàn bộ data-plane hay chỉ block write/control-plane?
- Tenant có 1 hay nhiều billing accounts theo thời gian?
- Tenant metadata có cho phép partner tự ghi tự do hay phải whitelist keys?

### Điều kiện để thành `Frozen`

- chốt enum `status`,
- chốt billing owner semantics,
- chốt response fields cho `vip-app` và `opencore`,
- chốt actor/audit behavior khi tenant bị suspend.

---

## 4.2 `service_account`

**Freeze target:** `Conditionally Frozen`  
**Owner service:** `identity_access_service`  
**Storage class:** mutable control-plane state

### Các quyết định hiện tại

| Hạng mục | Quyết định hiện tại | Trạng thái |
|---|---|---|
| Object key | `service_account` | Stable |
| Primary consumers | `vip-app`, operator | Stable |
| Auth mode | human session/JWT cho self-management trong current runtime; tenant PAT hoặc operator session là target-state | Partial |
| Scope | `tenant:service_accounts:read/write` | Stable |
| Public routes | list/create service accounts | Stable |
| Source-of-truth | `CoreServiceAccount` | Stable |
| Key dimensions | `tenant_id`, `environment`, `policy_ids`, `status` | Stable |
| Breaking hotspots | policy bundle semantics, environment rules, disable behavior | Open |

### Các câu hỏi phải chốt trước khi freeze hoàn toàn

- Có cho phép nhiều service accounts cùng tên trong cùng tenant không?
- `environment` có phải enum cứng `prod/staging/dev` hay được mở rộng?
- Disable service account có tự revoke mọi PAT đang active không?
- Service account có quota riêng hay chỉ thừa hưởng quota của tenant?

### Điều kiện để thành `Frozen`

- chốt uniqueness rules,
- chốt lifecycle state machine,
- chốt relationship giữa service account và PAT rotation,
- chốt delegated actor audit fields.

---

## 4.3 `pat_credential`

**Freeze target:** `Reviewing`  
**Owner service:** `identity_access_service`  
**Storage class:** mutable control-plane state + audit trail

### Các quyết định hiện tại

| Hạng mục | Quyết định hiện tại | Trạng thái |
|---|---|---|
| Object key | `pat_credential` | Stable |
| Secret policy | chỉ hiển thị một lần, chỉ lưu hash + prefix | Stable |
| Primary consumers | `vip-app`, operator | Stable |
| Auth mode | human session/JWT cho self-service trong current runtime; tenant PAT hoặc operator session là target-state | Partial |
| Scopes | fine-grained, gắn theo policy bundle và explicit scope set | Stable |
| Routes | list, issue, rotate, revoke | Stable |
| Idempotency | bắt buộc cho issue/rotate/revoke | Stable |
| Breaking hotspots | rotate semantics, expiry policy, grace period policy | Open |

### Các câu hỏi phải chốt trước khi freeze hoàn toàn

- Token secret version có tách bảng riêng hay gộp vào credential revision model?
- Rotate có luôn tạo credential mới hay cho phép in-place versioning?
- Grace period tối đa là bao nhiêu?
- `expired` và `revoked` khác nhau thế nào ở auth layer và audit layer?
- Có cần approval workflow cho token issue của tenant cấp cao hay không?

### Điều kiện để thành `Frozen`

- chốt rotate model không downtime,
- chốt revoke propagation semantics,
- chốt expiry defaults và exception policy,
- chốt event/audit model cho `issued`, `rotated`, `revoked`, `expired`.

---

## 4.4 `usage_meter`

**Freeze target:** `Conditionally Frozen`  
**Owner service:** `quota_billing_service`  
**Storage class:** mutable commercial catalog

### Các quyết định hiện tại

| Hạng mục | Quyết định hiện tại | Trạng thái |
|---|---|---|
| Object key | `usage_meter` | Stable |
| Primary consumers | `vip-app`, `opencore`, operator | Stable |
| Meter categories | market reads, session facts reads, signal delivery, AI advisory, bulk export, realtime minute | Stable |
| Source-of-truth | projection từ static meter definitions + `quota_service` hôm nay; `CoreUsageMeter` là target-state catalog | Partial |
| Aggregation | hourly rollup + billing period aggregates | Stable |
| Billing relation | plan entitlements + overage policy + credits | Stable |
| Breaking hotspots | unit semantics, rounding rules, meter matching rules | Open |

### Các câu hỏi phải chốt trước khi freeze hoàn toàn

- `market_snapshot_read` tính theo request hay batch-weighted unit?
- AI advisory meter charge ở advisory-context hay ở final orchestration call?
- Meter matching là route-family-based hay policy-based with override?
- Có meter nào informational-only, không billable nhưng vẫn quota-enforced?

### Điều kiện để thành `Frozen`

- chốt meter catalog version 1,
- chốt từng unit semantics,
- chốt mapping route family -> meter,
- chốt billing visibility fields cho `vip-app`.

---

## 4.5 `symbol_snapshot`

**Freeze target:** `Conditionally Frozen`  
**Owner service:** `market_snapshot_service`  
**Storage class:** materialized read model

### Các quyết định hiện tại

| Hạng mục | Quyết định hiện tại | Trạng thái |
|---|---|---|
| Object key | `symbol_snapshot` | Stable |
| Primary consumers | `web`, `mobile`, `vip-app`, AI | Stable |
| Public routes | batch tickers + per-symbol snapshot | Stable |
| Source-of-truth | `CoreSymbolSnapshot` read model | Stable |
| Upstream dependence | không fallback trực tiếp ra upstream trong public contract path | Stable |
| Freshness fields | `trade_date`, `as_of`, `stale` | Stable |
| Breaking hotspots | price unit semantics, stale semantics, optional profile fields | Open |

### Các câu hỏi phải chốt trước khi freeze hoàn toàn

- `last_price` dùng canonical đơn vị nào và có cần field currency/unit explicit không?
- `stale=true` thì response vẫn 200 hay có degraded status header riêng?
- Batch tickers và per-symbol snapshot có cùng object shape 100% hay batch trả subset?
- Có cần `include=profile` hoặc `expand=profile` không?

### Điều kiện để thành `Frozen`

- chốt unit/currency semantics,
- chốt stale/degrade semantics,
- chốt minimal fields vs optional expandable fields,
- chốt batch vs single resource consistency rules.

---

## 4.6 `session_facts`

**Freeze target:** `Reviewing`  
**Owner service:** `signal_intelligence_service`  
**Storage class:** materialized derived facts read model

### Các quyết định hiện tại

| Hạng mục | Quyết định hiện tại | Trạng thái |
|---|---|---|
| Object key | `session_facts` | Stable |
| Primary consumers | `web`, `vip-app`, AI | Stable |
| Source-of-truth | facts projection, không đọc raw `IntradayTick` trực tiếp ở contract | Stable |
| Key dimensions | `symbol`, `trade_date`, `selected_session` | Stable |
| Public route | per-symbol session facts | Stable |
| Meter | `session_facts_read` | Stable |
| Breaking hotspots | selected session semantics, revision semantics, strength metrics formulas | Open |

### Các câu hỏi phải chốt trước khi freeze hoàn toàn

- `selected_session=auto` resolve theo rule nào và có trả lại resolved value không?
- `facts_revision` là internal troubleshooting field hay public contract field lâu dài?
- `buy_strength` và `institutional_strength` scale chuẩn là gì?
- Có cần expose bucket-level facts trong resource này hay chỉ expose aggregate selected-session facts?
- Nếu facts chưa materialize xong thì response semantics là gì: `404`, `202`, hay stale result?

### Điều kiện để thành `Frozen`

- chốt selected session truth model,
- chốt metric formulas ở mức contract wording,
- chốt stale/not-ready semantics,
- chốt boundary giữa aggregate facts và detailed bucket facts.

---

## 5. Thứ tự freeze khuyến nghị

Để giảm rủi ro, nên freeze theo thứ tự sau:

1. `tenant`
2. `service_account`
3. `pat_credential`
4. `usage_meter`
5. `symbol_snapshot`
6. `session_facts`

Lý do:

- Control-plane phải rõ trước để `vip-app` biết cách kết nối.
- Billing/quota semantics phải rõ trước khi public data-plane cho B2B.
- Data-plane facts như `session_facts` nên freeze sau cùng vì phụ thuộc nhiều semantic nội bộ nhất.

---

## 6. Kết luận

Nếu đội triển khai bỏ qua freeze checklist này, khả năng cao sẽ gặp 3 kiểu drift:

1. drift giữa `vip-app` và `core` về auth/token semantics,
2. drift giữa billing/quota và route behavior,
3. drift giữa selected-session semantics của UI/AI và facts storage.

Tài liệu này là điểm dừng bắt buộc trước implementation thật sự cho 6 resource đầu tiên của `core`.