# OHLCV + Dark Money History OpenAPI Cutover Handoff Master

Date: 2026-05-21
Status: Approved for implementation planning handoff
Scope: Standardize OpenAPI contracts for historical OHLCV and dark-money-history across multi-timeframe routes, then replace legacy read routes with core routes.
SSOT policy:
- docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md
- docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md

---

## 1. Objective

Ban giao cho doi code mot goi tai lieu implementation-ready de:
- Chuan hoa endpoint OpenAPI cho 2 use cases:
  1) OHLCV history by timeframe.
  2) dark-money-history by timeframe.
- Cat bo route cu sau khi dat parity gate trong moi truong dev.
- Dam bao frontend thue bao chi goi qua core API adapter.

---

## 2. Current-state summary

Legacy path (portfolio):
- /api/stock-management/stocks/{symbol}/dark-money-history/

Core path (already exists for chart history):
- /core/v1/stock-management/stocks/{symbol}/chart/

Gap can be closed:
- Chua co core native endpoint dark-money-history theo OpenAPI contract chuan.
- Timeframe alias giua chart va dark-money-history chua hoan toan dong nhat.

---

## 3. Target end-state

1. Core OpenAPI endpoints
- GET /core/v1/stock-management/stocks/{symbol}/chart/
- GET /core/v1/stock-management/stocks/{symbol}/dark-money-history/

2. Canonical timeframe set
- 1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W

3. Frontend consumption
- packages/web chi goi qua coreApiAdapter methods
- Khong con direct call vao legacy portfolio route cho 2 luong nay

4. Governance
- Full OpenAPI metadata + standard error envelope + tests + audit artifacts

---

## 4. Important execution policy for this pack

- Khong yeu cau shadow run production vi he thong chua deploy that.
- Thay vao do, bat buoc:
  - Dev parity replay test (old vs new) tren sample symbols/timeframes.
  - Contract snapshot tests.
  - Integration regression tests tren dev stack.

---

## 5. Deliverables in this handoff pack

1. docs/IMPLEMENTATION_PLAN_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
2. docs/TECH_SPEC_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
3. docs/TASKBOARD_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
4. docs/OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260521.md
5. docs/OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260521.md
6. docs/OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_EXECUTION_EVIDENCE_TEMPLATE_20260521.md
7. docs/OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_CONFIG_OWNERSHIP_MATRIX_20260521.md
8. docs/OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_CODE_QUALITY_CONSTITUTION_20260521.md
9. docs/FRONTEND_DESIGN_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
10. docs/BACKEND_DESIGN_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
11. docs/RUN_CODE_REVIEW_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
12. docs/RUN_INTEGRATION_TESTS_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md
13. docs/RUN_SPEC_AUDIT_OHLCV_DARK_MONEY_HISTORY_OPENAPI_CUTOVER_20260521.md

---

## 6. Acceptance gates

Gate G1: Core endpoint dark-money-history implemented with OpenAPI metadata.
Gate G2: Timeframe normalization unified for chart + dark-money-history.
Gate G3: Frontend adapter cutover complete for both functions.
Gate G4: Legacy route replacement readiness achieved (dev parity pass).
Gate G5: All runbooks pass and evidence package complete.

---

## 7. Reporting obligations

For each execution slice:
- Update docs/CODE_CHANGE_AUDIT_LEDGER.md
- Update PROGRESS_DASHBOARD.md
- Attach evidence according to execution evidence template.

No merge if obligations are missing.
