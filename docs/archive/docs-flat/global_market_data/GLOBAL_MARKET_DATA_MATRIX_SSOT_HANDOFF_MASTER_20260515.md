# Global Market Data Matrix SSOT — Handoff Master
**Ngày**: 2026-05-15  
**Status**: Approved for planning and execution  
**Scope**: Thiết lập `global market data matrix` làm SSOT dữ liệu thị trường chung cho toàn bộ dự án, đồng thời đưa `SOC Data Ops` thành operator surface thống nhất cho runtime crawl planning, coverage, freshness và manual operations.

---

## 1. Mục tiêu

Gói tài liệu này bàn giao một định nghĩa và lộ trình thực thi thống nhất để:

1. Đưa `global symbol matrix` / `global symbol registry` thành SSOT duy nhất cho mọi nhu cầu dữ liệu thị trường dùng chung.
2. Hợp nhất các demand source hiện hữu như system defaults, admin global groups, holdings, watchlists, tracked symbols, alerts vào cùng một registry persistent.
3. Chuyển planner cào dữ liệu sang mô hình `coverage-gap` + `freshness-gap` driven, mặc định `missing-only`, không overwrite mù quáng.
4. Dùng lại các lớp runtime hiện có như `ServiceRunLog`, `ServiceConfig`, `provider_catalog`, `ScrapeMatrix` như execution/control plane, nhưng không dùng chúng làm persistent universe SSOT.
5. Chốt nguyên tắc mọi read path sản phẩm phải đọc từ global facts/snapshots/history/materialized layer, không cào lại theo user.
6. Mở rộng `SOC Data Ops` thành bề mặt vận hành thống nhất cho config runtime, schedule planning, queue tiers, manual crawl và coverage observability.

---

## 2. Hard rules bắt buộc

Các rule dưới đây là hard constraints tuyệt đối, không ngoại lệ:

1. Global symbol matrix là SSOT duy nhất cho dữ liệu thị trường dùng chung của hệ thống.
2. Global matrix là hợp nhất persistent của mọi demand source hợp lệ.
3. User không sở hữu bản sao dữ liệu thị trường riêng.
4. Watchlist/tracked/holding/alert chỉ promote demand vào global matrix, không tạo user-specific crawl silo.
5. `ScrapeMatrix` và run-state chỉ là execution tracking, không phải persistent universe SSOT.
6. Mọi read path phải ưu tiên facts-first global layer.
7. Planner ingest bắt buộc coverage-gap/freshness-gap driven và `missing-only` by default.
8. Symbol chỉ rời active crawl set sau khi hết mọi demand source và qua decay window vận hành.

Thứ tự ưu tiên khi có trade-off: đúng shared SSOT trước, tránh crawl lặp sau, rồi mới tối ưu UX/SLA/chi phí.

---

## 3. Deliverables trong gói tài liệu

| # | Tài liệu | Đường dẫn |
|---|----------|-----------|
| 1 | Handoff Master | `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_HANDOFF_MASTER_20260515.md` |
| 2 | Implementation Plan | `docs/IMPLEMENTATION_PLAN_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md` |
| 3 | Technical Spec | `docs/TECH_SPEC_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md` |
| 4 | Taskboard | `docs/TASKBOARD_GLOBAL_MARKET_DATA_MATRIX_SSOT_20260515.md` |
| 5 | Traceability Matrix | `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_TRACEABILITY_MATRIX_20260515.md` |
| 6 | Self Audit & Test Protocol | `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_SELF_AUDIT_AND_TEST_PROTOCOL_20260515.md` |
| 7 | Code Quality Constitution | `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_CODE_QUALITY_CONSTITUTION_20260515.md` |
| 8 | Execution Evidence Template | `docs/GLOBAL_MARKET_DATA_MATRIX_SSOT_EXECUTION_EVIDENCE_TEMPLATE_20260515.md` |

---

## 4. Kiến trúc mục tiêu

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
Global Symbol Registry (persistent SSOT)
  - symbol identity
  - effective tier / priority
  - active demand summary
  - coverage / freshness summary
        |
        +--> Global Symbol Demand Source rows
        |
        +--> Global Symbol Coverage rows
        |
        v
Coverage/Freshness Planner (missing-only)
        |
        v
SOC Data Ops Control Plane
  - config runtime
  - schedules
  - queue tiers
  - manual runs
  - audit/run-log
        |
        v
Execution Layer
  ServiceRunLog / queues / ScrapeMatrix / workers
        |
        v
Canonical Shared Data Layer
  DailyPrice / IntradayBar / IntradayTick / SymbolSnapshot / SessionFacts
        |
        v
All Product Read Paths
  Dashboard / Watchlist / Stock Detail / AI / Alerts / SOC
```

---

## 5. Non-goals

Các hạng mục dưới đây không được coi là thiết kế đúng cho chương trình này:

- Không xây data silo theo user.
- Không thêm provider call path mới bypass `market_data.vnbroker_adapter`.
- Không coi `ScrapeMatrix` là registry universe.
- Không dùng `days=N` full backfill như primary policy cho mọi crawl request.
- Không cho phép UI tự quyết định crawl strategy thay cho planner backend.

---

## 6. Định nghĩa thành công

Chương trình này được coi là hoàn thành khi đồng thời đạt các điều kiện sau:

1. Mọi demand source hợp lệ đều promote vào cùng một global registry native.
2. Mọi planner ingest chính đều có semantics `missing-only` hoặc `coverage-gap driven` chứng minh được bằng test/evidence.
3. `SOC Data Ops` hiển thị được config, coverage, freshness, queue tiers, manual run và run history cho market-data SSOT.
4. Watchlist/tracked/holding/alert không còn kích hoạt user-specific crawl path.
5. Các product read paths chủ chốt đọc từ global data layer thay vì recrawl theo user.

---

## 7. Tài liệu và policy liên quan

- `docs/AI_CODING_REGULATION.md`
- `AGENTS.md`
- `quality/QUALITY.md`
- `docs/TECH_SPEC_MARKET_DATA_SERVICE_UNIFICATION_20260421.md`
- `docs/OFFPEAK_VNBROKER_INGEST_IMPLEMENTATION_PLAN_20260416.md`
- `docs/AUDIT_PACKAGE_SYMBOL_ENGAGEMENT_WARMUP_20260423.md`
