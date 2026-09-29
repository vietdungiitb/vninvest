# Implementation Plan - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17
**Status**: Approved - Ready for execution
**Parent**: docs/COORDINATED_PARALLEL_SCRAPING_MARKET_DATA_BACKFILL_HANDOFF_MASTER_20260517.md

---

## 1. Tong quan

Ke hoach gom 3 nhom:
1. Foundation and policy hardening.
2. CPS execution hardening (scheduler + workers + quotas).
3. Operator visibility + rollout safety.

---

## 2. Dependency graph

```text
P01 Daily bootstrap policy lock
  -> P02 Planner preview contract hardening
    -> P03 Queue-tier CPS scheduler quota
      -> P04 Daily parallel bucket tuning
        -> P05 Intraday depth tier policy
          -> P06 DataOps observability widgets
            -> P07 Shadow run + parity evidence
              -> P08 Cutover runbook and closeout
```

---

## 3. Task breakdown

| Task ID | Ten | Artifact chinh | DoD |
|---|---|---|---|
| P01 | Daily bootstrap policy lock | market_data/global_symbol_coverage.py, settings.py | Symbol missing coverage su dung days-window policy configurable |
| P02 | Planner preview contract hardening | market_data/global_symbol_coverage.py, tests | requested_window contract on dinh theo mode/tier |
| P03 | Queue-tier CPS scheduler quota | service_ops/tasks.py, service_ops/dataops_market_data.py | dispatch theo quota, khong starvation, khong duplicate run |
| P04 | Daily parallel bucket tuning | data_ingest/tasks.py | provider bucket balancing + safe retry/backoff |
| P05 | Intraday depth tier policy | data_ingest/tasks.py, global_symbol_planner.py | intraday depth co policy theo tier, khong fetch mu quang |
| P06 | DataOps observability widgets | service_ops/views/dataops.py, frontend SOC | hien thi backlog trend, fail-rate, tier starvation |
| P07 | Shadow run and parity evidence | docs + service_ops metrics | co evidence 3 ngay giao dich that cho CPS gate |
| P08 | Cutover runbook and closeout | docs and governance | runbook rollback/incident/chuyen giao complete |

---

## 4. Chi tiet task

### P01 - Daily bootstrap policy lock

**Muc tieu**
- Khoa policy daily bootstrap cho symbol missing coverage.

**Files du kien**
- packages/core/backend/src/market_data/global_symbol_coverage.py
- packages/core/backend/src/vninvest_core/settings.py

**DoD**
- Co setting GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS.
- Co clamp min/max ro rang.
- Regression test pass.

### P02 - Planner preview contract hardening

**Muc tieu**
- requested_window co semantics ro rang cho daily/intraday.

**Files du kien**
- packages/core/backend/src/market_data/global_symbol_coverage.py
- packages/core/backend/src/market_data/tests/test_global_symbol_coverage.py

**DoD**
- daily missing -> days-window.
- stale gap -> start_date/end_date.
- force_refresh -> trade_date.

### P03 - Queue-tier CPS scheduler quota

**Muc tieu**
- Dieu phoi dispatch co gioi han, khong flood queue.

**Files du kien**
- packages/core/backend/src/service_ops/tasks.py
- packages/core/backend/src/service_ops/dataops_market_data.py
- packages/core/backend/src/service_ops/tests/test_soc_tasks.py

**DoD**
- Moi tier co max dispatch per cycle.
- lock + cooldown pass.
- Co metric skipped_by_quota.

### P04 - Daily parallel bucket tuning

**Muc tieu**
- Tang throughput daily khong tang fail-rate.

**Files du kien**
- packages/core/backend/src/data_ingest/tasks.py
- packages/core/backend/src/data_ingest/tests/test_tasks.py

**DoD**
- provider bucket split on dinh.
- retry/backoff co gioi han.
- counter inserted/updated/skipped_existing/failed day du.

### P05 - Intraday depth tier policy

**Muc tieu**
- Intraday du day o hot tier, tiet kiem o cold tier.

**Files du kien**
- packages/core/backend/src/data_ingest/tasks.py
- packages/core/backend/src/market_data/global_symbol_planner.py
- packages/core/backend/src/market_data/tests/test_global_symbol_planner.py

**DoD**
- hot/warm/cold depth policy ro rang.
- khong full-depth cho long-tail.
- no regression planner core.

### P06 - DataOps observability widgets

**Muc tieu**
- Operator thay duoc tien do va nguy co.

**Files du kien**
- packages/core/backend/src/service_ops/views/dataops.py
- frontend/src/components/soc/DataOpsPanel.jsx

**DoD**
- backlog summary by dataset/tier.
- fail-rate 1h/24h.
- starvation indicator.

### P07 - Shadow run and parity evidence

**Muc tieu**
- Chung minh CPS van hanh on dinh truoc cutover.

**DoD**
- 3 ngay giao dich that.
- parity score >= 0.99 cho daily completeness sample set.
- rollback drill co bang chung.

### P08 - Cutover runbook and closeout

**Muc tieu**
- Ban giao doi van hanh + doi code khong can hoi lai.

**DoD**
- runbook incident + rollback + escalation day du.
- governance files cap nhat day du.
- final audit signoff.

---

## 5. Validation gates toan workstream

1. backend tests: market_data + data_ingest + service_ops focused suites.
2. start_dev runtime refresh per slice runtime/code.
3. module_tree_full.md regenerate khi source thay doi.
4. update governance files moi slice:
   - CODE_CHANGE_AUDIT_LEDGER.md
   - PROGRESS_DASHBOARD.md
   - MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md

---

## 6. Mandatory slice-exit gate (auto progression rule)

Moi slice Pxx chi duoc chuyen sang slice tiep theo khi da PASS day du 6 buoc sau:

1. Focused tests PASS cho pham vi slice.
2. Runtime refresh PASS qua ./start_dev.ps1 (neu slice co thay doi runtime/code).
3. Checklist doi chieu tai lieu PASS (Taskboard + Tech Spec + Self Audit protocol).
4. Evidence template cho slice duoc dien day du (commands, output, residual risk).
5. Governance artifacts da cap nhat (ledger/progress/modified-files + module tree neu co source change).
6. Commit/push dev cho slice hien tai da hoan tat.

Khong dat du 6 buoc tren thi status slice phai giu IN PROGRESS/BLOCKED, cam chuyen tiep.

## 7. Risk and mitigation

| Risk | Muc do | Mitigation |
|---|---|---|
| Provider throttle lam giam throughput | High | quota, backoff, provider spread |
| Queue flood khi bootstrap dien rong | High | tier dispatch cap + lock + cooldown |
| Intraday van thua du lieu | Medium | tier depth policy + targeted backfill run |
| Drift contract FE/BE DataOps | Medium | contract tests + OpenAPI schema checks |
