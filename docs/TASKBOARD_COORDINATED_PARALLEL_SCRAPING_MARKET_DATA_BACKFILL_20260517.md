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
| P04 | Daily provider bucket tuning | TODO | Data Ingest | Toi uu throughput/fail-rate |
| P05 | Intraday tier depth policy | TODO | Data Ingest | Chot depth theo hot/warm/cold/recovery |
| P06 | DataOps observability UI/API | TODO | Frontend + Backend | Backlog trend, fail-rate, starvation |
| P07 | Shadow run and parity evidence | TODO | Ops + QA | 3 ngay giao dich that, parity gate |
| P08 | Cutover runbook and handoff close | TODO | Tech Lead | Rollback, incident, signoff |

Legend: TODO | IN PROGRESS | DONE | BLOCKED

---

## Gate checklist by phase

### Phase A - Foundation (P01, P02)
- [x] Planner missing symbol khong con trade_date-only.
- [x] daily bootstrap days policy configurable.
- [x] regression tests pass.

### Phase B - CPS execution (P03, P04, P05)
- [ ] tier dispatch quota active.
- [ ] provider bucket balancing active.
- [ ] intraday tier depth policy active.

### Phase C - Observability and rollout (P06, P07, P08)
- [ ] DataOps surface hien thi full CPS health.
- [ ] shadow/parity evidence complete.
- [ ] rollback drill evidence complete.

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
- [ ] Commit and push dev completed
