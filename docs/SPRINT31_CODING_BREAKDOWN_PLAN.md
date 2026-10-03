# Sprint 31 - Coding Breakdown Plan

Status: READY FOR IMPLEMENTATION
Date: 2026-04-10
Scope: WA-P0-1..WA-P0-5 + WA-P1-1 kickoff
Primary objective: chot trust/consistency cho whale workspace truoc khi mo rong intelligence layer

Related docs:
- docs/SPRINT31_WHALE_ALERTS_PROFESSIONALIZATION_EXECUTION_PLAN.md
- docs/SPRINT31_ACCEPTANCE_CHECKLIST.md
- docs/SPRINT31_TASKBOARD.csv
- docs/WHALE_ALERTS_PHASE0_PHASE1_EXECUTION_PLAN_20260410.md
- docs/WHALE_ALERTS_API_CONTRACT_V2_DRAFT_20260410.md

## 1) Pre-coding gates (must pass truoc Day 1)

1. Gate P0 - Contract lock
- Chot danh sach field trust/event metadata bat buoc cho whale payload:
  - `event_id`
  - `source_layer`
  - `threshold_source`
  - `freshness_bucket`
  - `recovered`
- Chot window enum cho aggregate feed: `5m|15m|1h|session|5d`.

2. Gate P1 - Ownership lock
- BE owner cho WA-P0-1, WA-P0-2, WA-P0-4, WA-P1-1 backend.
- FE owner cho WA-P0-5, WA-P1-1 frontend selector.
- QA owner cho test matrix threshold/time-window/payload.

3. Gate P2 - Runtime readiness
- Redis + Celery + Channels san sang de chay smoke.
- IntradayTick retention du de verify window `5d`.

## 2) Architecture delta for Sprint 31

1. Threshold policy duoc resolve nhat quan o moi path thay vi xu ly phan tan.
2. Order-flow time windows theo local market time thay vi UTC.
3. Whale event payload duoc bo sung trust semantics chung cho FE.
4. Aggregate feed support window filter v2 nhung van giu deterministic cursor.

## 3) File-level implementation map

### 3.1 Backend files update (expected)
1. backend/portfolio/whale_feed_helpers.py
- threshold resolver chuan hoa + metadata merge.

2. backend/portfolio/tasks.py
- advisory accumulation/generation dung resolver dong nhat.

3. backend/portfolio/order_flow.py
- local market time normalization cho window filtering.

4. backend/portfolio/views.py
5. backend/portfolio/market_views.py
- aggregate/window params + response metadata pass-through.

6. backend/portfolio/realtime/compute.py
- payload builder bo sung trust metadata fields.

7. backend/portfolio/tests/*
- tests cho threshold consistency, market-time semantics, aggregate window, payload contract.

### 3.2 Frontend files update (expected)
1. frontend/src/components/DashboardRealtimePanel.jsx
2. frontend/src/pages/WhaleAlertsHub.jsx
3. frontend/src/pages/WhaleAdvisory.jsx
- render trust chips (live/recovered, threshold source, freshness).

4. frontend/src/api/client.js
- aggregate feed window filter wiring.

## 4) Story-by-story coding breakdown

### S31-02 - Threshold consistency (2d)
1. Refactor helper threshold resolver theo user + symbol context.
2. Wire resolver vao realtime publish va advisory path.
3. Bo sung `threshold_source` trong payload.
4. Add regression tests cho mismatch edge-cases.

Deliverable code:
- Khong con duong nao fallback sai ve user default khi symbol override ton tai.

### S31-03 - Market-time normalization (1.5d)
1. Chuan hoa `_today()` va `_now_time()` theo local market timezone.
2. Review cac ham detect_* dung window minute.
3. Add test matrix 5m/15m/30m/1h theo gio VN.

Deliverable code:
- Order-flow signal semantics khop voi user expectation theo gio giao dich.

### S31-04 - Event metadata contract (1.5d)
1. Add `source_layer`, `freshness_bucket`, `recovered` vao payload.
2. Dinh nghia rules map `source` -> `source_layer`.
3. Add contract tests de chan null/field drift.

Deliverable code:
- FE co du metadata de hien trust state ro rang.

### S31-05 - Trust chips UX (1d)
1. Render chips tai dashboard/hub/advisory surfaces.
2. Hien thi label threshold source va freshness.
3. Dam bao fallback text khi metadata chua co.

Deliverable code:
- User nhin card la biet event live/recovered va muc do tin cay co ban.

### S31-06 - Observability baseline (2d)
1. Add metrics freshness/dedup/recovery/source-mix.
2. Expose health summary endpoint.
3. Add ops note cho evidence collection.

Deliverable code:
- Co baseline runtime evidence cho sprint sign-off.

### S31-07 - Window filter v2 kickoff (2d)
1. API aggregate nhan `window` + validate enum.
2. Cursor/sort semantics deterministic cho moi window.
3. FE selector refetch theo window.

Deliverable code:
- Window filters chay on dinh ma khong vo pagination.

### S31-08 - QA + release gate (1d)
1. Chay regression suites whale/order-flow.
2. Thu thap evidence metrics + API contract checks.
3. Chot go/no-go note.

Deliverable artifact:
- cap nhat docs/SPRINT31_ACCEPTANCE_CHECKLIST.md
- cap nhat docs/SPRINT_EXECUTION_LOG.md

## 5) Commit and merge strategy (recommended)

1. PR-1 (S31-02 + S31-03)
- Muc tieu: consistency core
- Gate can pass: A1, A2, A3, A4

2. PR-2 (S31-04)
- Muc tieu: payload semantics lock
- Gate can pass: B1, B2, B3, B4

3. PR-3 (S31-05)
- Muc tieu: trust UX visibility
- Gate can pass: B5, B6

4. PR-4 (S31-06)
- Muc tieu: observability baseline
- Gate can pass: C1, C2, C3, C4, C5

5. PR-5 (S31-07 + S31-08)
- Muc tieu: window filter kickoff + release closure
- Gate can pass: D1, D2, D3, E1, E2, E3

## 6) Coding checklist per PR

1. Code updates bat buoc
- cap nhat docs/SPRINT31_TASKBOARD.csv
- cap nhat docs/SPRINT31_ACCEPTANCE_CHECKLIST.md
- cap nhat docs/SPRINT_EXECUTION_LOG.md

2. Verification bat buoc
- Backend focused tests (whale/order-flow/api routes)
- Frontend build
- Runtime smoke cho aggregate feed windows

3. QA bat buoc
- Verify trust chips tren 3 surfaces: Dashboard, Whale Hub, Whale Advisory

## 7) Risks and fallback decisions

1. Risk: payload trust fields chua du o mot so source fallback
- Fallback: map `source_layer=recovered` + conservative defaults, ghi warning log.

2. Risk: window `5d` query nong tren IntradayTick
- Fallback: hard cap page size + canh bao performance trong release note.

3. Risk: mismatch threshold khi co user config race
- Fallback: resolve threshold o mot helper duy nhat va dung chung moi path.

## 8) Definition of coding completion

1. PR-1..PR-5 merge theo dependency.
2. Tat ca gates A/B/C/D/E co evidence ro trong checklist.
3. Co closure note sprint voi go/no-go decision.
4. Whale workspace hien trust semantics dong nhat va khong mo ho payload.
