# Taskboard - Coordinated Parallel Scraping Market Data Backfill
**Ngay**: 2026-05-17
**Status**: Active

---

## Overview

| Task | Ten | Status | Owner | Note |
|---|---|---|---|---|
| P00 | Doc-pack khoi tao | DONE | Copilot | Bo tai lieu ban giao day du duoc tao |
| P01 | Daily bootstrap policy lock | DONE | Core Backend | Da khoa setting default/min/max, test bien pass, runtime smoke pass |
| P02 | Planner requested_window hardening | DONE | Core Backend | Da chot contract missing/stale/force cho daily va non-daily, test/regression/runtime pass |
| P03 | Queue-tier quota scheduler | DONE | Service Ops | Da them max_dispatch_per_cycle per tier, inflight/cooldown gate giu nguyen, co metric skipped_by_quota |
| P04 | Daily provider bucket tuning | DONE | Data Ingest | Da bo sung bucket split on dinh, retry/backoff bounded va telemetry per-provider |
| P05 | Intraday tier depth policy | DONE | Data Ingest | Da ap policy hot/warm/cold/recovery vao intraday requested_window va page_size theo tier |
| P06 | DataOps observability UI/API | DONE | Frontend + Backend | Da co endpoint + widget backlog/fail-rate/starvation, contract test + build/runtime pass |
| P07 | Shadow run and parity evidence | DONE | Ops + QA | Da co baseline 72h runtime run logs, parity sample 0.99, rollback drill evidence |
| P08 | Cutover runbook and handoff close | DONE | Tech Lead | Da ban hanh cutover runbook, rollback playbook, escalation flow va closeout note |
| P09 | Strict-fresh parity hardening | DONE | Frontend + Backend | Da bo sung parity_gates 24h/72h (strict_fresh + fresh_or_warm + pass/fail) tren API/DataOps monitor de giam ambiguity gate policy |

Legend: TODO | IN PROGRESS | DONE | BLOCKED

---

## Gate checklist by phase

### Phase A - Foundation (P01, P02)
- [x] Planner missing symbol khong con trade_date-only.
- [x] daily bootstrap days policy configurable.
- [x] regression tests pass.

### Phase B - CPS execution (P03, P04, P05)
- [x] tier dispatch quota active.
- [x] provider bucket balancing active.
- [x] intraday tier depth policy active.

### Phase C - Observability and rollout (P06, P07, P08)
- [x] DataOps surface hien thi full CPS health.
- [x] shadow/parity evidence complete.
- [x] rollback drill evidence complete.

### Phase D - Parity gate hardening (P09)
- [x] DataOps API tra ve parity_gates theo 24h/72h.
- [x] DataOps monitor hien thi strict-fresh va fresh-or-warm gate status.
- [x] Regression tests cover parity_gates contract.

---

## Mandatory artifacts each task

1. File list changed.
2. Validation commands and outputs.
3. Residual risk note.
4. Governance updates.

---

## Mandatory slice-exit checklist (must pass before auto-next)

- [x] Focused tests PASS for current slice
- [x] start_dev runtime refresh PASS (for runtime/code slices)
- [x] Self-audit checklist PASS and documented
- [x] Taskboard/plan/spec cross-check PASS
- [x] Evidence template updated
- [x] Governance docs updated
- [x] Commit and push dev completed
