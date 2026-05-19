# Global Market Data Backfill Effectiveness Hardening — Handoff Master
**Ngày**: 2026-05-19
**Status**: Approved — Ready for execution
**Scope**: Hardening toàn bộ hệ thống backfill dữ liệu thị trường theo hướng đầy đủ, nhanh, có quan sát được, coverage-gap driven, tuân thủ SaaS native architecture, Global Market Data SSOT và OpenAPI governance.

---

## 1. Mục tiêu

1. Biến backfill daily history từ cơ chế quét toàn universe theo alphabet thành hệ thống planner-first, ưu tiên coverage gap và business priority.
2. Đảm bảo operator bấm `Chạy ngay` thì thấy được truth thật: queued, running, progress, completed, failed, ETA và batch hiện tại.
3. Rút ngắn thời gian đưa symbol mới hoặc symbol vừa promote vào trạng thái đủ dữ liệu lịch sử phục vụ người dùng.
4. Chuẩn hóa mọi scheduler/API/operator surfaces theo SaaS native rules và OpenAPI hard rules.
5. Tạo một doc-pack đủ chi tiết để đội code triển khai theo slice mà không cần hỏi lại về scope, kiến trúc, API contract, test gates hay evidence requirements.

---

## 2. Quyết định thiết kế đã khóa

1. `GlobalSymbolRegistry` tiếp tục là SSOT duy nhất cho universe; không tạo crawl silo theo user.
2. Backfill planner phải `missing-only` và `coverage-gap/freshness-gap driven` theo mặc định.
3. `run_now` không được coi là bằng chứng hoàn tất; UI phải bám run state thật từ backend progress layer.
4. Hai jobs `daily-backfill-prices-1700` và `deep-history-bootstrap-weekly` phải có history, run log và observability chuẩn như các scheduler jobs khác.
5. Symbol mới promote vào `hot`/`warm` phải có fast-path bootstrap thay vì chờ weekly deep-history.
6. `market_data/vnbroker_adapter.py` là SSOT duy nhất cho truy cập market provider; không được thêm call path bypass adapter.
7. Mọi API mới/chỉnh sửa ở operator surface phải theo OpenAPI constitution: contract-first, error envelope chuẩn, pagination, auth/rate limit phù hợp.
8. Frontend chỉ hiển thị planner truth; không tự tổng hợp coverage logic hay self-invent progress state.
9. Manual repair phải có mode nhỏ, có thể target symbol hoặc gap cohort; không dùng full-universe deep run như công cụ mặc định cho mọi sự cố.
10. Tiêu chí tối ưu theo thứ tự: data completeness trước, observability second, throughput third, operator ergonomics fourth, cost fifth.

---

## 3. Deliverables doc-pack

| # | Tài liệu | Đường dẫn |
|---|---|---|
| 1 | Handoff Master | docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_HANDOFF_MASTER_20260519.md |
| 2 | Implementation Plan | docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 3 | Technical Spec | docs/TECH_SPEC_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 4 | Taskboard | docs/TASKBOARD_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 5 | Traceability Matrix | docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_TRACEABILITY_MATRIX_20260519.md |
| 6 | Self Audit and Test Protocol | docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_SELF_AUDIT_AND_TEST_PROTOCOL_20260519.md |
| 7 | Execution Evidence Template | docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_EXECUTION_EVIDENCE_TEMPLATE_20260519.md |
| 8 | Config Ownership Matrix | docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_CONFIG_OWNERSHIP_MATRIX_20260519.md |
| 9 | Code Quality Constitution | docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_CODE_QUALITY_CONSTITUTION_20260519.md |
| 10 | Frontend Design | docs/FRONTEND_DESIGN_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 11 | Backend Design | docs/BACKEND_DESIGN_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 12 | Run Code Review | docs/RUN_CODE_REVIEW_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 13 | Run Integration Tests | docs/RUN_INTEGRATION_TESTS_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |
| 14 | Run Spec Audit | docs/RUN_SPEC_AUDIT_GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_20260519.md |

---

## 4. Kiến trúc mục tiêu

```text
Demand Sources
  holdings / watchlists / tracked / alerts / admin groups / defaults
        |
        v
GlobalSymbolRegistry + GlobalSymbolCoverage
        |
        +--> coverage gap inventory
        +--> freshness gap inventory
        +--> priority score inventory
        |
        v
Backfill Planner
  - daily_delta
  - repair_missing
  - deep_bootstrap
  - targeted_symbol_repair
        |
        v
Execution Coordinator
  - scheduler job action layer
  - run log / progress store
  - queue + provider bucket dispatch
  - lock / cooldown / quota / retry
        |
        v
Backfill Executors
  data_ingest.tasks.backfill_daily_prices
  future repair executors / targeted executors
        |
        v
Canonical Shared Data Layer
  DailyPrice / SymbolSnapshot / SessionFacts / coverage summaries
        |
        v
Operator Surfaces + Product Read Paths
  SOC SchedulerBoard / DataOps / dashboard / stock detail / alert center
```

---

## 5. Hiện trạng và gap thực tế

| Thành phần | Trạng thái hiện tại | Gap |
|---|---|---|
| `run_now` scheduler | Có dispatch | UI có thể báo running từ cache trước khi có completion truth |
| Backfill job history | Thiếu hoặc không đầy đủ | 2 backfill jobs chưa có mapping/log hoàn chỉnh |
| Progress realtime | Thiếu | Không có done/remaining/current batch/ETA |
| Planner priority | Yếu | Quét alphabet, không ưu tiên symbol thiếu nặng |
| Deep bootstrap | Có task | Chưa là fast-path cho symbol mới/promote |
| Hot anomaly detection | Thiếu | Không tự phát hiện case như `VNM` hot nhưng coverage cực thấp |
| API governance | Chưa khóa cho slice này | Cần OpenAPI-ready contracts, error envelope, pagination |
| Operator action proof | Yếu | Chưa có evidence đầy đủ cho manual backfill runs |

---

## 6. Định nghĩa thành công

1. Operator bấm `Chạy ngay` và thấy run record thật, progress thật, completion thật.
2. Các jobs backfill có lịch sử đầy đủ trong scheduler history.
3. Planner ưu tiên các symbol có gap nặng, hot tier, newly promoted và active user demand trước long-tail universe.
4. Symbol mới promote vào `hot` không nằm ở trạng thái thiếu sâu trong thời gian vượt SLA đã chốt.
5. Số symbol `<=10` ngày dữ liệu giảm về gần 0 trừ trường hợp mã niêm yết mới hoặc provider không có history.
6. `deep-history-bootstrap-weekly` không còn là công cụ duy nhất cho coverage repair; operator có targeted repair và repair-missing modes.
7. Mọi API/operator surfaces liên quan slice này đều đáp ứng OpenAPI gate, SaaS native rules và governance artifacts.

---

## 7. Non-goals

1. Không thêm market-data silo theo user.
2. Không di chuyển business logic coverage lên frontend.
3. Không cho phép UI gọi provider trực tiếp.
4. Không dùng full refresh hoặc overwrite-existing làm default policy.
5. Không mở rộng scope sang intraday tape DNSE hoặc unrelated alert lanes trong workstream này.

---

## 8. Hard rules áp dụng

1. Global market data matrix và global symbol registry là SSOT duy nhất.
2. Planner phải coverage-gap/freshness-gap driven, `missing-only` by default.
3. `packages/web` và frontend không direct fetch provider; chỉ gọi qua backend adapter/API chuẩn.
4. Endpoint mới/chỉnh sửa phải có OpenAPI metadata, error envelope chuẩn và pagination cho list endpoints.
5. Cấm `except: pass` và silent failure trong API path và scheduler path.
6. Runtime refresh cho slice code/runtime dùng `./start_dev.ps1`.
7. Kết thúc mỗi slice phải cập nhật `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`.

---

## 9. Files neo hiện tại

### Backend
- `packages/core/backend/src/service_ops/views/scheduler.py`
- `packages/core/backend/src/service_ops/scheduler_catalog.py`
- `packages/core/backend/src/data_ingest/tasks.py`
- `packages/core/backend/src/vninvest_core/settings.py`
- `packages/core/backend/src/market_data/global_symbol_planner.py`
- `packages/core/backend/src/service_ops/dataops_market_data.py`

### Frontend
- `frontend/src/components/soc/SchedulerBoard.jsx`
- `frontend/src/components/soc/DataOpsPanel.jsx`
- `frontend/src/api/socApi.js`
- `frontend/src/i18n/vi.json`

---

## 10. Related policy docs

- `quality/QUALITY.md`
- `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md`
- `docs/TECH_SPEC_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
- `docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md`
- `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
