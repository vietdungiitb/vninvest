# Taskboard — Global Market Data Backfill Effectiveness Hardening
**Ngày**: 2026-05-19
**Status**: Planned

---

## Overview

| Task | Tên | Status | Owner | Note |
|---|---|---|---|---|
| B00 | Doc-pack khởi tạo | DONE | Copilot | Bộ tài liệu handoff đầy đủ đã được tạo |
| B01 | Scheduler run truth hardening | TODO | Service Ops Backend | Loại bỏ `ĐANG CHẠY` giả, khóa lifecycle queued/running/success/failed |
| B02 | Backfill progress persistence | TODO | Core Backend | Tạo source-of-truth cho progress và ETA |
| B03 | Operator progress API/UI | TODO | Frontend + Backend | DataOps/SchedulerBoard đọc progress thật |
| B04 | Coverage gap inventory | TODO | Market Data Backend | Tính `actual_days`, `expected_days`, `gap_score`, `priority_reason` |
| B05 | Gap-first planner | TODO | Market Data Backend | Ưu tiên hot gap nặng, newly promoted, active-demand |
| B06 | Promotion fast-path bootstrap | TODO | Market Data + Service Ops | Symbol mới/promote được bootstrap nhanh |
| B07 | Multi-mode backfill execution | TODO | Data Ingest Backend | `daily_delta`, `repair_missing`, `deep_bootstrap`, `targeted_symbol_repair` |
| B08 | Coverage anomaly guard | TODO | Service Ops + DataOps | Bắt case hot tier coverage breach như `VNM` |
| B09 | Shadow, cutover, handoff close | TODO | Ops + QA + Tech Lead | Completeness evidence, rollback, closeout |

Legend: TODO | IN PROGRESS | DONE | BLOCKED

---

## Phase gates

### Phase A — Scheduler Truth Foundation (B01, B02, B03)
- [ ] `run_now` không còn tạo trạng thái running kéo dài do cache-only inflight.
- [ ] Hai jobs backfill có history đúng cho cả beat và manual runs.
- [ ] Progress API/UI hiển thị done/remaining/ETA/current provider.

### Phase B — Planner and Priority Hardening (B04, B05)
- [ ] Có gap inventory per symbol.
- [ ] Planner không còn default alphabet-first.
- [ ] Preview trả `priority_reason` rõ ràng.

### Phase C — Fast-path and Execution Modes (B06, B07)
- [ ] Symbol newly promoted có repair obligation tự động.
- [ ] Có `repair_missing` và `targeted_symbol_repair` rõ ràng.
- [ ] Force refresh không bị implicit enable.

### Phase D — Guardrails and Rollout (B08, B09)
- [ ] Coverage anomalies visible trên DataOps.
- [ ] Có completeness KPI before/after.
- [ ] Có rollback drill và handoff closeout.

---

## Mandatory artifacts each task

1. File list changed.
2. Validation commands và outputs.
3. API payload/UI snapshot nếu có contract hoặc UI.
4. Residual risk note.
5. Governance updates.

---

## Mandatory slice-exit checklist

- [ ] Focused tests PASS cho slice hiện tại
- [ ] OpenAPI/API contract checks PASS nếu có endpoint change
- [ ] `./start_dev.ps1` PASS nếu có runtime/code change
- [ ] Evidence template cập nhật xong
- [ ] Taskboard/status/docs cross-check PASS
- [ ] Governance docs cập nhật (`CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`)
- [ ] Commit và push `origin/dev` hoàn tất
