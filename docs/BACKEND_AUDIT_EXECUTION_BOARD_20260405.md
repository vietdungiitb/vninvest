# Backend Audit Execution Board 2026-04-05

Status: ACTIVE
Source of truth audit: docs/BACKEND_CODE_AUDIT_$(date +%Y%m%d).md
Scope: backend/portfolio hardening and rollout safety

## 1) Goal and constraints

Goal 30 ngay:
1. Giam coupling voi external provider trong HTTP path.
2. Giam do phuc tap monolith views ma khong vo API contract.
3. Rollout theo metric + co rollback gate ro rang.

Constraints:
- Khong rewrite big-bang.
- Uu tien strangler pattern + feature flags.
- Moi buoc deu phai co regression evidence.

## 2) Workboard (owner-ready)

| ID | Epic | Task | Owner | ETA | Dependency | DoD | Status |
|---|---|---|---|---|---|---|---|
| A1 | External IO Boundary | Chot 1 facade market external voi timeout/retry/backoff/error-map | BE Lead | D+2 | None | Co facade va unit tests | In Progress |
| A2 | External IO Boundary | Refactor Intraday/PriceBoard/RVOL/Depth/Financial qua facade | BE | D+4 | A1 | Khong con call vnbroker truc tiep tren nhom endpoint nay | Todo |
| A3 | External IO Boundary | Refactor Stock Workspace Overview/Chart qua facade | BE | D+5 | A1 | Khong con import vnbroker trong flow workspace | Todo |
| A4 | External IO Boundary | Chuan hoa external error schema (`vnbroker_timeout`, `vnbroker_rate_limited`, `vnbroker_unavailable`) | BE | D+5 | A1 | Contract loi thong nhat tren endpoint da tach | Todo |
| B1 | Views Decomposition | Tach route group market/whale/portfolio/ai-screener thanh module rieng | BE Lead | D+7 | A2,A3 | views.py giam >= 30% LOC | Todo |
| B2 | Views Decomposition | Bo sung route toggle matrix cho old/new implementation | BE | D+8 | B1 | Tat ca route co rollback switch | Todo |
| B3 | Views Decomposition | Contract parity tests old/new (payload + status + error path) | QA + BE | D+10 | B2 | Test pass tren CI, khong vo backward compatibility | Todo |
| C1 | Validation Unification | Chuyen top 10 endpoint nhieu traffic sang request serializer/schema nhat quan | BE | D+12 | B3 | Khong con parse tay query/body o top 10 endpoint | Todo |
| C2 | Domain Constants | Gom threshold va size-class policy vao module trung tam | BE | D+13 | C1 | Khong duplicate constants o views/order_flow/realtime | Todo |
| C3 | Domain Constants | Them regression tests cho threshold mapping + edge cases | QA + BE | D+14 | C2 | Pass CI, co test table-driven cho policy | Todo |
| D1 | Observability | Them metrics latency/error/fallback cho external calls | DevOps + BE | D+16 | A4 | Co metric theo endpoint + error code | Todo |
| D2 | Observability | Tao dashboard p50/p95/p99 + fallback ratio + 5xx rate | DevOps | D+17 | D1 | Dashboard hien du lieu theo env staging/prod | Todo |
| D3 | Rollout Gate | Dinh nghia canary gate 10% -> 50% -> 100% + rollback trigger | DevOps + PM | D+18 | D2 | Co gate checklist va duoc dry-run | Todo |
| E1 | Runtime Validation | Chay staging canary + ghi evidence theo khung thoi gian | QA + DevOps | D+20 | D3 | Evidence day du, gate sign-off duoc ky | Todo |
| E2 | Runtime Validation | Production progressive rollout + post-check 24h | PM + DevOps + BE | D+22 | E1 | Khong vuot rollback trigger, post-check pass | Todo |

## 3) KPI baseline capture sheet

Can dien truoc khi rollout production:

| Metric | Current | Target | Owner | Note |
|---|---:|---:|---|---|
| Intraday p95 latency (ms) | TBD | <= 200 | BE/DevOps | 15-min window |
| PriceBoard p95 latency (ms) | TBD | <= 220 | BE/DevOps | 15-min window |
| Whale Aggregate p95 latency (ms) | TBD | <= 260 | BE/DevOps | includes fallback path |
| HTTP 5xx rate (%) | TBD | <= baseline x 1.2 | DevOps | per endpoint |
| External timeout ratio (%) | TBD | down >= 30% | BE | by provider code |
| Fallback hit ratio (%) | TBD | stable within agreed band | BE/PM | stream->db->external |

## 4) Rollback and incident policy

Rollback trigger:
1. p95 tang > 30% trong 15 phut.
2. 5xx > 2x baseline trong 10 phut.
3. fallback ratio vuot nguong canh bao da ky.

Immediate actions:
1. Tat branch moi bang feature flags.
2. Bao dam adapter backoff cache van hoat dong.
3. Freeze deploy, mo RCA quick report trong 24h.

## 5) Daily operating ritual

1. 09:30 cap nhat trang thai A1..E2.
2. 13:30 cap nhat blocker + owner remove-block.
3. 17:30 cap nhat evidence link va quyet dinh gate.

## 6) Evidence links

- Audit v2: docs/BACKEND_CODE_AUDIT_$(date +%Y%m%d).md
- Sprint execution log: docs/SPRINT_EXECUTION_LOG.md
- Canonical board: docs/IMPLEMENTATION_BOARDS.md
- Daily tracker: docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md
- Endpoint migration checklist: docs/BACKEND_AUDIT_ENDPOINT_MIGRATION_CHECKLIST_20260405.md
- Owner assignment: docs/BACKEND_AUDIT_OWNER_ASSIGNMENT_20260405.md
- Run-day playbook: docs/BACKEND_AUDIT_RUN_DAY_PLAYBOOK_20260406.md
- Sprint 23 coding plan: docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md
- Sprint 23 acceptance: docs/SPRINT23_ACCEPTANCE_CHECKLIST.md
- Sprint 23 taskboard: docs/SPRINT23_TASKBOARD.csv
- Sprint 22 canary review: docs/SPRINT22_GO_NO_GO_REVIEW.md
- Sprint 22 status tracker: docs/SPRINT22_STATUS_TRACKER_20260405.md

## 7) Tracking workflow

1. Update `docs/BACKEND_AUDIT_DAILY_TRACKER_20260405.md` 3 lan/ngay (09:30, 13:30, 17:30).
2. Update `docs/BACKEND_AUDIT_ENDPOINT_MIGRATION_CHECKLIST_20260405.md` moi khi endpoint doi status.
3. Neu co gate decision, ghi them vao `docs/SPRINT_EXECUTION_LOG.md` trong ngay.

## 8) Next execution sequence

1. Chot owner theo `docs/BACKEND_AUDIT_OWNER_ASSIGNMENT_20260405.md`.
2. Chay ngay van hanh theo `docs/BACKEND_AUDIT_RUN_DAY_PLAYBOOK_20260406.md`.
3. Cap nhat tracker/checklist/sprint-log trong ngay theo evidence thu duoc.
