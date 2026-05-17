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
| P10 | Strict-fresh execution uplift | DONE | Core Backend | Scheduler hot/warm chay planner mode strict_fresh; planner cho phep warm daily refresh de nang kha nang dat gate strict-fresh |
| P11 | Parity trend observability | DONE | Frontend + Backend | Da bo sung trend delta vs ky truoc cho parity 24h/72h tren API/DataOps monitor de operator thay huong cai thien hay suy giam |
| P12 | Parity history multi-window | DONE | Frontend + Backend | Da bo sung chuoi 7 moc parity history cho 24h/72h tren API va DataOps monitor de theo doi xu huong nhieu ky |
| P13 | Persisted parity snapshots | DONE | Core Backend | Scheduler ghi immutable parity_snapshot vao metadata planner-run; observability history uu tien doc persisted snapshots thay vi rolling-only |
| P14 | Append-only parity snapshot store | DONE | Core Backend | Tach persistence parity history sang bang append-only rieng, observability uu tien doc bang moi va fallback metadata de giu backward compatibility |
| P15 | Parity snapshot retention cleanup | DONE | Core Backend | Bo sung retention policy cho parity snapshot store, scheduler tu dong cleanup stale rows theo runtime config |

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

### Phase E - Strict-fresh execution uplift (P10)
- [x] Planner mode `strict_fresh` cho phep plan daily `warm`.
- [x] Queue-tier scheduler ap mode `strict_fresh` cho hot/warm tiers.
- [x] Regression tests khoa mode selection va planner behavior.

### Phase F - Parity trend observability (P11)
- [x] Observability API tra ve `trend` cho moi parity window.
- [x] DataOps monitor hien thi delta strict-fresh/fresh-or-warm vs ky truoc.
- [x] Regression tests khoa contract `parity_gates.trend`.

### Phase G - Parity history multi-window (P12)
- [x] Observability API tra ve `parity_history` cho window 24h/72h.
- [x] DataOps monitor hien thi 7 moc gan nhat cho moi window.
- [x] Regression tests khoa contract `parity_history`.

### Phase H - Persisted parity snapshots (P13)
- [x] Queue-tier scheduler gan `parity_snapshot` vao metadata cua planner-run.
- [x] Observability `parity_history` uu tien nguon persisted snapshots.
- [x] Regression tests khoa metadata persistence path.

### Phase I - Append-only parity snapshot store (P14)
- [x] Them model append-only `MarketDataParitySnapshot` + migration schema.
- [x] Queue-tier scheduler persist parity snapshots vao bang moi moi chu ky.
- [x] Observability `parity_history` uu tien doc bang moi va fallback metadata cu.
- [x] Regression tests khoa model uniqueness, scheduler write path, va API read path.

### Phase J - Retention cleanup policy (P15)
- [x] Bo sung runtime config `parity_snapshot_retention_days` cho market-data SSOT.
- [x] Queue-tier scheduler auto cleanup parity snapshot rows qua retention helper.
- [x] Regression tests khoa config validation, cleanup execution, va API contract field moi.

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
