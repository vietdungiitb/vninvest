# Sprint 31 - Whale Alerts Professionalization Execution Plan

Ngay: 2026-04-10
Trang thai: READY TO EXECUTE
Pham vi: Phase 0 + Phase 1 kickoff cho `/whale-alerts`

## 1. Sprint objective

Muc tieu sprint la chot nen tang trust/consistency/observability cho whale workspace, dong thoi mo khoa aggregate window filter v2 theo contract v2 draft.

## 2. Scope in sprint

### In-scope

1. WA-P0-1 Threshold override consistency
2. WA-P0-2 Market-time normalization
3. WA-P0-3 Unified event metadata
4. WA-P0-4 Realtime observability baseline
5. WA-P0-5 FE trust hardening
6. WA-P1-1 Aggregate feed window filter v2 (kickoff)

### Out-of-scope

1. WA-P1-2 anomaly scoring full implementation
2. WA-P1-3 campaign grouping engine
3. Whale Hub v2 tabs/campaign board

## 3. Work breakdown

### Stream A - Backend consistency (BE)

- Refactor threshold resolver xuyen suot realtime/aggregate/advisory.
- Chuan hoa order-flow/dark-flow theo local market time.
- Bo sung metadata fields vao whale event payload.

### Stream B - Frontend trust UX (FE)

- Render chips: live/recovered, user threshold/symbol override, freshness bucket.
- Dam bao Dashboard + Whale Hub + Whale Advisory hien semantics dong nhat.

### Stream C - Observability and QA (BE/DevOps/QA)

- Baseline metrics freshness/dedup/recovery/source-mix.
- Health summary endpoint cho whale pipeline.
- Regression matrix cho threshold + time-window + payload contract.

### Stream D - Contract and window filter kickoff (BE/FE)

- Implement aggregate `window` filter (`5m|15m|1h|session|5d`).
- Lock adapter contract giua FE parser va BE payload mode.

## 4. Timeline de xuat (10 ngay cong)

1. Day 1-2: WA-P0-1
2. Day 2-3: WA-P0-2
3. Day 3-5: WA-P0-3 + FE trust chips
4. Day 5-7: WA-P0-4 observability + runbook
5. Day 7-9: WA-P1-1 window filter kickoff
6. Day 10: QA gates + release note + go/no-go prep

## 5. Definition of done

1. Khong con mismatch threshold semantics giua cac surface whale.
2. Order-flow windows theo dung gio thi truong VN va pass test matrix.
3. FE hien thi ro event freshness/source/threshold source.
4. Co metric evidence baseline tren staging.
5. Window filter aggregate hoat dong on dinh, cursor deterministic.

## 6. KPI gates

1. Regression tests cho whale core pass.
2. p95 aggregate response voi window filter dat muc chap nhan.
3. Co evidence freshness p95, dedup ratio, snapshot recovery ratio.
4. 0 blocker P0 severity mo o sprint closure.

## 7. Dependencies

1. Sprint 29 canary khong duoc block backend release branch.
2. Redis/Channels/Celery runtime phai san sang cho smoke tests.
3. Data retention IntradayTick du de test window `5d`.

## 8. Canonical references

- `docs/WHALE_ALERTS_PROFESSIONALIZATION_ROADMAP_20260410.md`
- `docs/WHALE_ALERTS_PHASE0_PHASE1_EXECUTION_PLAN_20260410.md`
- `docs/WHALE_ALERTS_API_CONTRACT_V2_DRAFT_20260410.md`
- `docs/SPRINT31_CODING_BREAKDOWN_PLAN.md`
- `docs/SPRINT31_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT31_TASKBOARD.csv`

