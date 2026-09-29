# Taskboard - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18
**Status**: Active

---

## Overview

| Task | Ten | Status | Owner | Note |
|---|---|---|---|---|
| S00 | Doc-pack khoi tao | DONE | Copilot | Da tao bo tai lieu ban giao day du |
| S01 | Scheduler catalog contract | TODO | Core Backend | Hop nhat beat/runtime jobs thanh read model |
| S02 | Capability matrix + ownership guard | TODO | Core Backend | Action permissions + deny semantics |
| S03 | Control actions executor | TODO | Core Backend | enable/disable/pause/resume/run_now/abort |
| S04 | Runtime status aggregator | TODO | Service Ops | lag/freshness/inflight/queue drift |
| S05 | OpenAPI endpoint standardization | TODO | Core API | schema + envelope + rate-limit policy |
| S06 | DataOps scheduler board UI | TODO | Frontend | table plan + action controls |
| S07 | Prefetch scheduler board UI | TODO | Frontend | profile schedule + status + controls |
| S08 | Read-only rollout and soak | TODO | Ops + QA | soak gate + no-regression evidence |
| S09 | Write-mode rollout + cutover closeout | TODO | Tech Lead | phased enable + rollback drill |

Legend: TODO | IN PROGRESS | DONE | BLOCKED

---

## Gate checklist by phase

### Phase A - Foundation (S01, S02)
- [ ] Co scheduler catalog contract ro rang va test pass
- [ ] Ownership deny path pass theo hard rules

### Phase B - Controls and status (S03, S04, S05)
- [ ] Action semantics idempotent, auditable
- [ ] Runtime status aggregator chinh xac
- [ ] OpenAPI gate checklist PASS

### Phase C - Frontend and rollout (S06, S07, S08, S09)
- [ ] SOC UI render dung server truth
- [ ] Read-only soak pass
- [ ] Write-mode rollout pass + rollback drill pass

---

## Mandatory artifacts each task

1. Danh sach file doi
2. Validation commands + ket qua
3. API payload snapshot (neu co contract change)
4. Screenshot/video (neu co UI)
5. Residual risk note

---

## Mandatory slice-exit checklist

- [ ] Focused tests PASS
- [ ] Runtime refresh PASS qua ./start_dev.ps1 (neu runtime/code)
- [ ] Evidence template cap nhat
- [ ] Taskboard/Spec/Plan doi chieu PASS
- [ ] Governance docs cap nhat
- [ ] Commit/push dev complete
