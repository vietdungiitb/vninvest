# Implementation Plan — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19
**Status**: Approved — Ready for execution
**Parent**: docs/GLOBAL_MARKET_DATA_BACKFILL_EFFECTIVENESS_HARDENING_HANDOFF_MASTER_20260519.md

---

## 1. Tổng quan

Kế hoạch được chia làm 4 cụm:
1. Observability truth và scheduler run integrity.
2. Planner/prioritization hardening.
3. Fast-path backfill và anomaly guard.
4. Operator/API/UI completion và rollout safety.

---

## 2. Dependency graph

```text
B01 run_now truth + job history
  -> B02 backfill run/progress model
    -> B03 progress API + SchedulerBoard truth
      -> B04 planner gap inventory
        -> B05 gap-first prioritization
          -> B06 fast-path for promoted/new symbols
            -> B07 targeted repair and repair-missing modes
              -> B08 anomaly guard + SLA monitoring
                -> B09 rollout, shadow, cutover evidence
```

---

## 3. Task breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| B00 | Doc-pack lock | docs/* | Pack tài liệu đầy đủ, cross-reference sạch |
| B01 | Scheduler run truth hardening | `service_ops/views/scheduler.py`, `scheduler_catalog.py` | `run_now` có queued/running/completed truth; cache inflight không treo sai |
| B02 | Backfill progress persistence | new/focused backend models + migrations | Có run-level + batch-level progress, ETA, counters, resume-safe |
| B03 | Operator progress API/UI | `service_ops/views/dataops.py`, `socApi.js`, `SchedulerBoard.jsx` | UI hiển thị progress, ETA, provider, batch, result summary |
| B04 | Coverage gap inventory | `market_data` coverage layer | Có `actual_days`, `expected_days`, `missing_days`, `gap_score`, `priority_reason` |
| B05 | Gap-first planner | planner/task layer | Xếp ưu tiên hot gap nặng, newly promoted, active-demand trước alphabet |
| B06 | Promotion fast-path bootstrap | registry demand/promotion integration | Symbol mới/promote được enqueue repair nhanh theo SLA |
| B07 | Multi-mode backfill execution | executor + scheduler actions | Có `daily_delta`, `repair_missing`, `deep_bootstrap`, `targeted_symbol_repair` |
| B08 | Coverage anomaly guard | observability/alerts layer | Tự phát hiện hot symbols coverage bất thường và backlog critical |
| B09 | Shadow, cutover, handoff close | docs + evidence + runtime smoke | Có parity/completeness evidence, rollback path, final operator guide |

---

## 4. Chi tiết task

### B01 — Scheduler run truth hardening

**Mục tiêu**
- Loại bỏ trạng thái `ĐANG CHẠY` giả do cache-only inflight marker.
- Đồng nhất history cho `daily-backfill-prices-1700` và `deep-history-bootstrap-weekly`.

**Files dự kiến**
- `packages/core/backend/src/service_ops/views/scheduler.py`
- `packages/core/backend/src/service_ops/scheduler_catalog.py`
- `packages/core/backend/src/service_ops/tests/test_scheduler_action.py`
- `packages/core/backend/src/service_ops/tests/test_scheduler_s04.py`

**Definition of Done**
- Hai jobs backfill có `service_key` hợp lệ.
- `run_now` tạo run log và transition state rõ ràng.
- Inflight marker được clear khi task terminal-state.
- Scheduler history trả manual + scheduled runs đúng count.

### B02 — Backfill progress persistence

**Mục tiêu**
- Tạo source-of-truth cho progress và audit, không đọc suy diễn từ log text.

**Files dự kiến**
- `packages/core/backend/src/service_ops/models.py` hoặc module dedicated
- `packages/core/backend/src/service_ops/migrations/*`
- `packages/core/backend/src/data_ingest/tasks.py`
- `packages/core/backend/src/service_ops/tests/*`

**Definition of Done**
- Có model run-level và batch-level.
- Lưu `planned_symbols`, `completed_symbols`, `failed_symbols`, `inserted`, `updated`, `skipped_existing`, `provider_latency`.
- Task crash giữa chừng vẫn để lại evidence usable.

### B03 — Operator progress API/UI

**Mục tiêu**
- SOC thấy progress thực, không cần vào docker logs.

**Files dự kiến**
- `packages/core/backend/src/service_ops/views/dataops.py`
- `packages/core/backend/src/service_ops/operator_urls.py`
- `frontend/src/api/socApi.js`
- `frontend/src/components/soc/SchedulerBoard.jsx`
- `frontend/src/i18n/vi.json`

**Definition of Done**
- Có API progress summary và detail.
- UI hiển thị status, ETA, current provider, current batch, counters, latest error.
- Tất cả text mới qua i18n tiếng Việt đầy đủ dấu.

### B04 — Coverage gap inventory

**Mục tiêu**
- Tính được `gap_score` và `priority_reason` cho từng symbol.

**Files dự kiến**
- `packages/core/backend/src/market_data/global_symbol_coverage.py`
- `packages/core/backend/src/market_data/models.py`
- `packages/core/backend/src/market_data/tests/*`

**Definition of Done**
- Mỗi symbol active có inventory usable cho planner.
- Có thể query ra top gaps theo tier, recency, demand source.
- Không full-scan raw tables trên request path UI.

### B05 — Gap-first planner

**Mục tiêu**
- Planner sắp thứ tự đúng business importance.

**Files dự kiến**
- `packages/core/backend/src/market_data/global_symbol_planner.py`
- `packages/core/backend/src/data_ingest/tasks.py`
- `packages/core/backend/src/market_data/tests/test_global_symbol_planner.py`

**Definition of Done**
- Symbol hot thiếu sâu được xử lý trước symbol alphabet đứng đầu nhưng đã đủ coverage.
- Preview endpoint trả reason và ranking.
- Có tests chống regression quay lại `order_by(symbol)` làm priority mặc định.

### B06 — Promotion fast-path bootstrap

**Mục tiêu**
- Symbol mới/promote không phải chờ weekly deep-history.

**Files dự kiến**
- `packages/core/backend/src/market_data/*promotion*`
- `packages/core/backend/src/service_ops/tasks.py`
- `packages/core/backend/src/market_data/tests/*`

**Definition of Done**
- Event promote/activate demand tạo repair obligation.
- SLA cho hot/warm được cấu hình và quan sát được.
- Không duplicate crawl items cho cùng symbol-window.

### B07 — Multi-mode backfill execution

**Mục tiêu**
- Tách rõ mode vận hành và API contracts.

**Files dự kiến**
- `packages/core/backend/src/data_ingest/tasks.py`
- `packages/core/backend/src/service_ops/views/dataops.py`
- `packages/core/backend/src/service_ops/tests/*`

**Definition of Done**
- Có 4 mode canonical: `daily_delta`, `repair_missing`, `deep_bootstrap`, `targeted_symbol_repair`.
- Manual operator trigger bắt buộc chọn mode rõ ràng.
- Force refresh là override explicit, không implicit.

### B08 — Coverage anomaly guard

**Mục tiêu**
- Tự động lộ diện anomalies như `VNM` hot nhưng chỉ 4 ngày data.

**Files dự kiến**
- `packages/core/backend/src/service_ops/dataops_market_data.py`
- `packages/core/backend/src/service_ops/views/dataops.py`
- `frontend/src/components/soc/DataOpsPanel.jsx`

**Definition of Done**
- Có summary `critical_gap_symbols`, `hot_tier_breach`, `promotion_backlog`, `repair_backlog_age`.
- Có regression tests cho anomaly rules.
- UI operator nhìn thấy actionable backlog.

### B09 — Shadow, cutover, handoff close

**Mục tiêu**
- Rollout an toàn, có rollback và evidence.

**Definition of Done**
- Có shadow run evidence cho planner mới.
- Có completeness KPI before/after.
- Có rollback playbook và signoff criteria.
- Governance docs cập nhật đầy đủ.

---

## 5. Validation gates toàn workstream

1. Backend tests: `service_ops`, `market_data`, `data_ingest` focused suites.
2. Frontend build và UI smoke cho SOC SchedulerBoard/DataOps.
3. OpenAPI contract validation cho endpoints mới/chỉnh sửa.
4. `./start_dev.ps1` cho mọi slice có runtime/code change.
5. Evidence template được điền đầy đủ ở cuối mỗi slice.
6. Governance artifacts bắt buộc:
   - `CODE_CHANGE_AUDIT_LEDGER.md`
   - `PROGRESS_DASHBOARD.md`
   - `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`

---

## 6. Slice-exit gate bắt buộc

Mỗi slice chỉ được chuyển sang slice sau khi PASS đủ:
1. Focused tests PASS.
2. Runtime refresh PASS qua `./start_dev.ps1` nếu có code/runtime change.
3. Taskboard, Tech Spec, Self Audit protocol không conflict.
4. Evidence template được điền đủ command, result, risk.
5. Governance artifacts cập nhật xong.
6. Commit/push `origin/dev` cho slice đó hoàn tất.

---

## 7. Rủi ro và giảm thiểu

| Risk | Mức độ | Mitigation |
|---|---|---|
| Provider throttle khi tăng parallelism | High | adaptive concurrency, quota per provider, bounded retry |
| Progress persistence quá nặng | Medium | lưu run + batch summaries, không log mọi row |
| Planner ranking sai business priority | High | traceable `priority_reason`, explicit tests, preview evidence |
| UI đọc stale cache thay vì backend truth | High | progress API làm source-of-truth; hạn chế cache-only state |
| Contract drift giữa FE/BE | Medium | OpenAPI metadata + contract tests |
| Backfill modes bị dùng sai mục đích | Medium | mode-specific warnings, review checklist, guardrails |
