# Run Spec Audit — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19

---

## Mục tiêu

Đối chiếu từng requirement từ traceability matrix với implementation thực tế. Mỗi item phải có PASS / FAIL / PARTIAL, file evidence và lệnh verify.

---

## Audit R1 — `run_now` không tạo running illusion

**Verify**:
```powershell
rg "scheduler:inflight|terminal|status='queued'|status='running'|status='success'" packages/core/backend/src/service_ops/views/scheduler.py packages/core/backend/src/data_ingest/tasks.py
```

---

## Audit R2 — Backfill jobs có history đúng

**Verify**:
```powershell
rg "daily-backfill-prices-1700|deep-history-bootstrap-weekly|service_key" packages/core/backend/src/service_ops/scheduler_catalog.py
```

---

## Audit R3 — Planner coverage-gap driven

**Verify**:
```powershell
rg "gap_score|priority_reason|missing_history_days|expected_history_days|actual_history_days" packages/core/backend/src/market_data
```

---

## Audit R4 — Không alphabet-first priority mặc định

**Verify**:
```powershell
rg "order_by\('symbol'\)|sort\(key=lambda item: \(item\['symbol'\]" packages/core/backend/src/data_ingest packages/core/backend/src/market_data
```

Kỳ vọng: không còn là ranking mặc định cho repair path.

---

## Audit R5 — Newly promoted fast-path active

**Verify**:
```powershell
rg "promot|fast-path|repair obligation|targeted_symbol_repair" packages/core/backend/src
```

---

## Audit R6 — Multi-mode execution đúng spec

**Verify**:
```powershell
rg "daily_delta|repair_missing|deep_bootstrap|targeted_symbol_repair" packages/core/backend/src
```

---

## Audit R7 — OpenAPI governance đúng chuẩn

**Verify**:
```powershell
rg "extend_schema|request_id|field_errors|page_size|total_pages" packages/core/backend/src/service_ops/views
```

---

## Audit R8 — Frontend render backend truth only

**Verify**:
```powershell
rg "lastRunAt|is_inflight|progress_pct|eta_seconds|priority_reason" frontend/src/components/soc frontend/src/api
```

---

## Summary table

| Req | Status | Evidence |
|---|---|---|
| R1 | | |
| R2 | | |
| R3 | | |
| R4 | | |
| R5 | | |
| R6 | | |
| R7 | | |
| R8 | | |
| R9 | | |
| R10 | | |
| R11 | | |
| R12 | | |

**Ngày audit**:
**Auditor**:
**Kết quả tổng**: ALL PASS / PARTIAL PASS / FAIL
**Open items**:
