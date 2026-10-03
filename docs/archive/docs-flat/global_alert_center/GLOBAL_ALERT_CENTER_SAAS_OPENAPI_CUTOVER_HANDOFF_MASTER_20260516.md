# Global Alert Center SaaS OpenAPI Cutover — Handoff Master
**Ngày**: 2026-05-16  
**Status**: Approved for planning and execution  
**Scope**: Thiết lập `Global Alert Center` thành capability SaaS native của `core-api`, dùng `global symbol matrix` làm nền tảng thống nhất cho detection universe, prefetch/backfill, canonical alert facts, per-user delivery và legacy cutover.

---

## 1. Mục tiêu

Gói tài liệu này bàn giao lộ trình và hard rules để:

1. Dùng `global symbol matrix` làm SSOT nền tảng cho toàn bộ alert-center.
2. Chuyển alert-center sang kiến trúc `core-api + OpenAPI + packages/web`.
3. Chuẩn hóa 2 lớp nghiệp vụ: `global detection` và `per-user delivery`.
4. Giữ `AI Alerts / AI Suggests` ở lane riêng, không làm loãng main alert feed.
5. Cutover dần các compat/legacy alert paths mà không tạo parallel writer hoặc browser-side truth.

---

## 2. Bootstrap bắt buộc

Đọc trước khi thực hiện bất kỳ slice nào:

1. `quality/QUALITY.md`
2. `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`
3. `docs/TECH_SPEC_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
4. `docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
5. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md`
6. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
7. `docs/SAAS_FULL_INDEPENDENCE_HANDOFF_MASTER_20260504.md`
8. `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
9. `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`

---

## 3. Quyết định đã khóa

1. `Global symbol matrix` là nền tảng chung, không phải một khối ngang hàng với các khối khác.
2. Detection chạy một lần ở cấp toàn cục; delivery được lọc theo holdings/watchlist/tracked/preferences của từng user.
3. Main alert center chỉ chứa alert time-critical: `whale`, `dark_flow`, `price_shock`, `stale_quote`, `system`.
4. `AI Alerts / AI Suggests` là lane riêng; chỉ được promote vào main feed bằng policy explicit.
5. Mọi contract mới phải đi qua `/core/v1/` với OpenAPI metadata đầy đủ; không tạo native write/read path mới ở `/api/realtime/*`.
6. `packages/web` là UI target; mọi API call phải đi qua `coreApiAdapter.js`.
7. Browser-side synthesis cho alert nghiệp vụ là cấm; client chỉ render server truth.
8. Không được mở thêm legacy bridge hoặc compat proxy mới cho alert-center.
9. Không được xóa legacy code hoặc bỏ shadow/parity gates trước cutover.
10. Yêu cầu “bỏ qua soak test/shadow validation” không được chấp thuận trong gói này vì trái hard rules của SaaS migration và full independence.

---

## 4. Deliverables trong gói này

| # | Tài liệu | Đường dẫn |
|---|---|---|
| 1 | Handoff Master | `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md` |
| 2 | Implementation Plan | `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` |
| 3 | Technical Spec | `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` |
| 4 | Taskboard | `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` |
| 5 | Traceability Matrix | `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md` |
| 6 | Self Audit & Test Protocol | `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md` |
| 7 | Execution Evidence Template | `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_EXECUTION_EVIDENCE_TEMPLATE_20260516.md` |
| 8 | Config Ownership Matrix | `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CONFIG_OWNERSHIP_MATRIX_20260516.md` |
| 9 | Code Quality Constitution | `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CODE_QUALITY_CONSTITUTION_20260516.md` |
| 10 | Run Code Review | `docs/RUN_CODE_REVIEW_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` |
| 11 | Run Integration Tests | `docs/RUN_INTEGRATION_TESTS_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` |
| 12 | Run Spec Audit | `docs/RUN_SPEC_AUDIT_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md` |

---

## 5. Kiến trúc mục tiêu

```text
Demand Sources
  system defaults
  admin global groups
  holdings
  watchlists
  tracked symbols
  alerts
        |
        v
Global Symbol Matrix (SSOT foundation)
  registry + demand ledger + priority tier + coverage/freshness
        |
        +--> coverage/freshness planner
        +--> alert detection universe
        +--> operator observability
        |
        v
Canonical Alert Facts
  OrderFlowEvent
  MarketAnomalyEvent
  AdvisorySignalEvent
        |
        v
Unified Alert Read Models
        |
        +--> main alert center
        +--> AI alert lane
        |
        v
Per-User Delivery Projection
        |
        v
packages/web + temporary frontend bridge
```

---

## 6. Workstreams

1. Foundation: `global symbol matrix` contract, demand ledger, operator read path.
2. Workstream A: prefetch/backfill planner và freshness policy bám matrix.
3. Workstream B: canonical alert facts và unified alert models.
4. Workstream C: per-user delivery, preferences, AI lane.
5. Workstream D: OpenAPI contracts, packages/web cutover, compat/legacy sunset.

---

## 7. Non-goals

1. Không triển khai notification channels mới như email/push/Telegram trong chương trình này.
2. Không mở rộng sang footprint chart, scoring model mới hoặc AI prompt redesign ngoài nhu cầu alert-center.
3. Không chấp nhận direct big-bang cutover bỏ shadow/parity gates.

---

## 8. Định nghĩa thành công

Chương trình được coi là complete khi đồng thời đạt:

1. `Global symbol matrix` là source duy nhất cho detection universe của alert-center.
2. Browser không còn tự synthesize `price_shock`, `stale_quote` hoặc audience truth.
3. Alert-center có family OpenAPI native ở `/core/v1/` với pagination, error envelope, tenant isolation, rate-limit semantics.
4. `packages/web` render được main alert feed và AI lane riêng từ native contracts.
5. Compat/legacy alert surfaces được shadow, parity-validated, rồi mới sunset theo gate.
