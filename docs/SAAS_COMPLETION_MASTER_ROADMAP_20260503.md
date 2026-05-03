# MASTER ROADMAP — VNInvest SaaS Completion

**Ngày:** 2026-05-03  
**Trạng thái:** Canonical go-forward program plan cho SAAS-12 đến SAAS-16  
**Mục tiêu:** Một tài liệu duy nhất chứa toàn bộ lộ trình đưa VNInvest từ trạng thái "monolith có package wrapper" thành "SaaS thực sự" với kiến trúc packages-first, domain-isolated, contract-driven.

---

## 1. Nguyên tắc của lộ trình này

1. **Contract trước, code sau** — không viết client code khi contract chưa lock.
2. **Domain isolation trước, logic migration sau** — không move business logic khi boundary chưa rõ.
3. **Facts-first data path** — không raw-scan legacy tables khi read models đã materialized.
4. **One active slice** — chỉ một slice trong trạng thái `[/]` tại một thời điểm.
5. **Evidence bắt buộc** — mỗi slice phải có evidence packet trước khi đánh dấu completed.

---

## 2. Tổng quan các slice còn lại

```
SAAS-00 ✅  Governance freeze
SAAS-01 ✅  Access plane finalization
SAAS-02 ✅  Partner machine-auth cutover
SAAS-03 ✅  Tenant lifecycle and commercial parity
SAAS-04 ✅  Data-plane facts parity and freshness
SAAS-05 ✅  Shadow run and pilot
SAAS-06 ✅  Legacy decommission (first pass)
SAAS-07 ✅  Production manifest hardening
SAAS-08 ✅  Core package adoption (runtime smoke)
SAAS-09 ✅  Web package consolidation
SAAS-09B ✅ Dashboard shell host
SAAS-10 ✅  VIP app completion
SAAS-11 ✅  Mobile package completion
                    ↓
SAAS-12 [ ]  Shared contract lock + mobile API migration    ← TIẾP THEO
SAAS-13 [ ]  packages/core domain extraction (Django thực)
SAAS-14 [ ]  Data-plane serving models materialization
SAAS-15 [ ]  Legacy decommission final gate + cleanup
SAAS-16 [~]  packages/opencore community distribution (bootstrap in progress)
```

---

## 3. Chi tiết từng slice

### SAAS-12 — Shared Contract Lock & Mobile API Migration

**Mục tiêu:** Lock tất cả data-plane contracts vào `shared/api-contracts/`; migrate mobile services sang versioned contract paths.

**Ưu tiên:** P0 — SAAS-13 không thể bắt đầu khi contracts chưa lock.

**Thời gian ước tính:** 1-2 ngày

**Output:**
- `shared/api-contracts/symbol-snapshot.contract.json`
- `shared/api-contracts/session-facts.contract.json`
- `shared/api-contracts/unified-alert.contract.json`
- `shared/api-contracts/whale-feed-aggregate.contract.json`
- `shared/api-contracts/tenant-lifecycle.contract.json`
- `shared/api-contracts/partner-pat.contract.json`
- `packages/mobile/src/services/` — tất cả services migrate sang `/core/v1` paths
- Contract validator script: `shared/scripts/validate-contracts.mjs`

**Exit criteria:**
1. Tất cả 6 contract files tồn tại và hợp lệ JSON.
2. Mobile services không còn hardcode legacy paths.
3. Contract validator script chạy pass.
4. Mobile TypeScript typecheck vẫn green.

**Tài liệu chi tiết:** `docs/SAAS12_SHARED_CONTRACT_LOCK_EXECUTION_PLAN_20260503.md`

---

### SAAS-13 — packages/core Domain Extraction

**Mục tiêu:** Chuyển `packages/core` từ ThreadingHTTPServer stub thành Django/DRF app thực với domain models tách biệt, bounded contexts rõ ràng, và traceability middleware.

**Ưu tiên:** P0 — là backbone của toàn bộ SaaS architecture.

**Phụ thuộc:** SAAS-12 contracts phải locked.

**Thời gian ước tính:** 3-5 ngày

**Domain boundaries:**
```
packages/core/backend/
├── identity_access/      ← CoreTenant, CoreServiceAccount, CorePATCredential
├── market_serving/       ← SymbolSnapshot, SessionFacts read models
├── signal_intelligence/  ← UnifiedAlert, WhaleAlert canonical models
├── commercial/           ← Subscription, Quota, Invoice
└── ops_audit/            ← AuditEvent, RequestTrace
```

**Output chính:**
- `packages/core/backend/src/vninvest_core/` — Django settings, urls, wsgi
- `packages/core/backend/src/identity_access/` — models, views, serializers, tests
- `packages/core/backend/src/market_serving/` — models, views, serializers, tests
- `packages/core/backend/src/signal_intelligence/` — models, views, serializers
- `packages/core/backend/src/commercial/` — models, views, serializers
- `packages/core/backend/src/ops_audit/` — middleware (X-Request-ID), models
- `packages/core/backend/requirements.txt` — Django, DRF, psycopg2, celery, redis

**Exit criteria:**
1. `packages/core` chạy Django dev server độc lập.
2. `/core/v1/health`, `/core/v1/capability-bootstrap`, `/core/v1/symbol-snapshot` trả đúng contract.
3. `CoreTenant`, `CoreServiceAccount`, `CorePATCredential` migration thành công trong packages/core.
4. `X-Request-ID` propagation kiểm tra được.
5. Unit tests cho từng domain app pass.

**Tài liệu chi tiết:** `docs/SAAS13_PACKAGES_CORE_DOMAIN_EXTRACTION_PLAN_20260503.md`

---

### SAAS-14 — Data-Plane Serving Models Materialization

**Mục tiêu:** Materialized `SymbolSnapshot`, `SessionFacts`, `UnifiedAlert` trong packages/core bằng Celery jobs. Cung cấp facts-first serving path mà không raw-scan từ legacy tables.

**Ưu tiên:** P0 — SAAS-15 decommission không an toàn khi data path vẫn phụ thuộc legacy.

**Phụ thuộc:** SAAS-13 domain extraction phải xong.

**Thời gian ước tính:** 3-4 ngày

**Output chính:**
- `packages/core/backend/src/market_serving/materializers.py` — Celery tasks
- `packages/core/backend/src/market_serving/views.py` — DRF views với cursor pagination
- `packages/core/backend/src/signal_intelligence/materializers.py` — Whale/alert materializers
- `packages/web/src/adapters/coreApiAdapter.js` — web adapter gọi /core/v1
- Cursor pagination cho tất cả list endpoints

**Exit criteria:**
1. Celery beat kích hoạt materialization jobs đúng schedule.
2. `/core/v1/symbol-snapshot/{symbol}` trả fresh data từ read model, không raw scan.
3. `/core/v1/whale-feed-aggregate/{symbol}` trả data từ materialized model.
4. Cursor pagination hoạt động trên `/core/v1/unified-alert/` list.
5. packages/web có thể fetch từ `/core/v1` qua coreApiAdapter.

**Tài liệu chi tiết:** `docs/SAAS14_DATA_PLANE_SERVING_MODELS_PLAN_20260503.md`

---

### SAAS-15 — Legacy Decommission Final Gate

**Mục tiêu:** Kiểm tra toàn bộ điều kiện cần thiết trước khi decommission legacy roots. Chạy formal go/no-go gate. Thực hiện decommission nếu pass.

**Ưu tiên:** P1 — chỉ thực hiện sau SAAS-14 hoàn thành.

**Phụ thuộc:** SAAS-14 phải hoàn thành và có evidence đầy đủ.

**Thời gian ước tính:** 1-2 ngày

**Gate checklist (tóm tắt — xem tài liệu chi tiết):**
1. packages/core phục vụ tất cả endpoints mà legacy backend đang phục vụ.
2. packages/mobile, packages/web không còn gọi legacy paths.
3. Data-plane read models đã materialized và đang sync.
4. Tenant lifecycle API hoàn chỉnh trong packages/core.
5. Rollback plan đã được test.
6. Production traffic có thể route sang packages/core mà không cần legacy.

**Tài liệu chi tiết:** `docs/SAAS15_LEGACY_DECOMMISSION_GATES_20260503.md`

---

### SAAS-16 — packages/opencore Community Distribution (Bootstrap in progress)

**Mục tiêu:** Xây dựng community/self-host distribution bundle từ packages/opencore. Tạo upgrade journey từ community → SaaS.

**Ưu tiên:** P2 — chỉ khởi động sau SAAS-15.

**Phụ thuộc:** Tất cả SAAS-12 đến SAAS-15 phải xong.

**Trạng thái bootstrap:** compose overlay, activation bootstrap, distribution manifest va public-safe docs da co; build automation community lane van con can hoan thien.

**Evidence:** `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_EXECUTION_EVIDENCE_20260503_SAAS16.md`

---

## 4. Dependency graph

```
SAAS-11 ✅
    │
    ▼
SAAS-12 ─────────────────────────────────────────────
(Shared contracts + mobile migration)                │
    │                                                │
    ▼                                                │
SAAS-13 ────────────────────────────────────────────┤
(packages/core Django extraction)                    │
    │                                                │
    ▼                                                │
SAAS-14 ────────────────────────────────────────────┤
(Data-plane materialization)                         │
    │                                                │
    ▼                                                │
SAAS-15 ◄────────────────────────────────────────────
(Legacy decommission gate)
    │
    ▼
SAAS-16 (Future)
(packages/opencore)
```

---

## 5. Điều kiện "SaaS thực sự" — checklist cuối

| # | Điều kiện | Kiểm tra ở | Trạng thái |
|---|---|---|---|
| 1 | packages/core chạy Django/DRF đầy đủ | SAAS-13 | ⬜ |
| 2 | shared/ có contracts cho tất cả data flows | SAAS-12 | ⬜ |
| 3 | Mobile không gọi legacy paths | SAAS-12 | ⬜ |
| 4 | Web không gọi legacy paths | SAAS-14 | ⬜ |
| 5 | Tenant lifecycle trong packages/core | SAAS-13 | ⬜ |
| 6 | Data-plane read models materialized | SAAS-14 | ⬜ |
| 7 | Cursor pagination trên list APIs | SAAS-14 | ⬜ |
| 8 | X-Request-ID propagation | SAAS-13 | ⬜ |
| 9 | Legacy decommission go/no-go passed | SAAS-15 | ⬜ |
| 10 | Legacy roots không còn trong normal operation | SAAS-15 | ⬜ |

---

## 6. Tài liệu liên quan

| Tài liệu | Mục đích |
|---|---|
| `docs/SAAS_ARCHITECTURE_GAPS_ASSESSMENT_20260503.md` | Root anchor — gap analysis |
| `docs/SAAS_COMPLETION_MASTER_ROADMAP_20260503.md` | Tài liệu này — master roadmap |
| `docs/SAAS12_SHARED_CONTRACT_LOCK_EXECUTION_PLAN_20260503.md` | Chi tiết SAAS-12 |
| `docs/SAAS13_PACKAGES_CORE_DOMAIN_EXTRACTION_PLAN_20260503.md` | Chi tiết SAAS-13 |
| `docs/SAAS14_DATA_PLANE_SERVING_MODELS_PLAN_20260503.md` | Chi tiết SAAS-14 |
| `docs/SAAS15_LEGACY_DECOMMISSION_GATES_20260503.md` | Chi tiết SAAS-15 |
| `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md` | Taskboard tổng |
