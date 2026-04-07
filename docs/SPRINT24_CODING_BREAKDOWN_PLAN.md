# Sprint 24 - Coding Breakdown Plan

Status: READY FOR IMPLEMENTATION
Date: 2026-04-05
Scope: S24-01..S24-10 (Dashboard consistency + Trust/Decision control)
Primary objective: tang do tin cay du lieu va giup user lam chu quyet dinh

Related docs:
- docs/SPRINT24_DASHBOARD_REALTIME_EXECUTION_PLAN.md
- docs/SPRINT24_TRUST_DECISION_STORIES.md
- docs/SPRINT24_ACCEPTANCE_CHECKLIST.md
- docs/SPRINT24_QA_TEST_CHECKLIST_TRUST_DECISION.md
- docs/SPRINT24_TASKBOARD.csv

## 1) Pre-coding gates (must pass truoc khi vao Day 1)

1. Gate P0 - Codebase alignment
- Frontend main page: frontend/src/pages/Dashboard.jsx
- Realtime panel: frontend/src/components/DashboardRealtimePanel.jsx
- Realtime hook: frontend/src/hooks/useRealtimeFeed.js + useRealtimeFeedLegacy.js
- Advisory page (hien co): frontend/src/pages/WhaleAdvisory.jsx

2. Gate P1 - Contract clarification
- Chot schema recommendation explainability (why, confidence, invalidation_trigger).
- Chot stale threshold UI (de nghi: 20-30s) va nguon timestamp.
- Chot policy risk mode mapping (Defensive/Balanced/Growth).
- Chot source cho history T+1/T+3/T+5 (API endpoint moi hoac adapter frontend).

3. Gate P2 - Quality baseline
- Luu y hien tai frontend/package.json khong co script test.
- Truoc coding nen thong nhat 1 trong 2 cach:
  - Cach A: bo sung script test cho react-scripts.
  - Cach B: dung build + QA checklist manual lam gate chinh trong Sprint 24.

## 2) Architecture delta cho Sprint 24

1. Dashboard tro thanh "decision surface" thay vi chi "data surface".
2. Realtime state va trust metadata duoc tap trung vao Dashboard level de:
- HoldingsTable
- StatCards
- Trust/Decision widgets
3. Advisory UI duoc tach thanh cac component nho de release doc lap:
- RecommendationCardExplainability
- DataFreshnessBadge
- ActionChecklist
- RiskModeSelector
- RecommendationHistoryMini
4. Telemetry hook duoc bo sung de ghi event trust flow.

## 3) File-level implementation map

### 3.1 Files update (existing)
1. frontend/src/pages/Dashboard.jsx
- Hoist state trust va decision controls.
- Wire risk mode, freshness badge, history mini, checklist trigger.

2. frontend/src/components/DashboardRealtimePanel.jsx
- Chuan hoa freshness metadata + stale status hien thi ro.
- Expose data cho badge va trust telemetry.

3. frontend/src/components/HoldingsTable.jsx
- Doc live overlay (gia/market value/P-L) tu shared selector thay vi snapshot thuong truc.

4. frontend/src/components/StatCard.jsx
- Doc value tu shared selector de khop holdings summary cung timestamp.

5. frontend/src/hooks/useRealtimeFeed.js
- Giu API on dinh, bo sung metadata can thiet (lastEventAt, stale counts neu can).

6. frontend/src/hooks/useRealtimeFeedLegacy.js
- Chuan hoa fields stale/freshness_seconds de phuc vu DataFreshnessBadge.

7. frontend/src/api/client.js
- Bo sung API cho recommendation history neu backend co endpoint.
- Neu chua co endpoint, bo sung adapter tam thoi doc tu whale-advisory feed.

8. frontend/src/i18n/vi.js
9. frontend/src/i18n/en.js
- Them text cho explainability, stale states, checklist, risk mode, history.

### 3.2 Files create (new)
1. frontend/src/components/advisory/RecommendationCardExplainability.jsx
2. frontend/src/components/advisory/DataFreshnessBadge.jsx
3. frontend/src/components/advisory/ActionChecklist.jsx
4. frontend/src/components/advisory/RiskModeSelector.jsx
5. frontend/src/components/advisory/RecommendationHistoryMini.jsx
6. frontend/src/hooks/useTrustTelemetry.js
7. frontend/src/utils/recommendationPolicy.js
- map confidence label
- map risk mode filter
- fallback explainability validator

## 4) Story-by-story coding breakdown

### S24-01 - Single source quote state (2d)
1. Tach shared selector cho quote + holdings merge.
2. Dashboard hoist quotesBySymbol va pass xuong HoldingsTable/StatCards.
3. Loai logic duplicate tinh live market value o nhieu component.
4. Validate fallback polling compatibility.

Deliverable code:
- shared merge util trong frontend/src/utils/recommendationPolicy.js hoac file util rieng.
- Dashboard render khong con mismatch summary va holdings.

### S24-02 - Live overlay holdings/cards (1d)
1. HoldingsTable nhan data da merge (livePrice/liveMarketValue/livePL/livePLPct).
2. StatCards doc tong so live tu shared selector.
3. Bo sung visual hint neu data stale.

Deliverable code:
- HoldingsTable hien gia realtime neu co.
- Market Value/P-L khop tren card va table.

### S24-03 - Realtime UX polish (1d)
1. Compact observability mode tren DashboardRealtimePanel.
2. Sync button context-aware theo realtime status.
3. Giam clutter khi user o trader mode.

Deliverable code:
- Dashboard header va panel co hanh vi theo status live/polling/idle.

### S24-04 - Runtime KPI instrumentation (1d)
1. Tao useTrustTelemetry hook (track event + payload chuan).
2. Capture p95 UI refresh, stale ratio, fallback count o FE-side evidence.
3. Dam bao evidence script scripts/ops/sprint24_collect_dashboard_evidence.ps1 thu duoc artifact.

Deliverable code:
- telemetry function dung cho S24-06..S24-10.

### S24-06 - Decision card explainability (1d)
1. Tao RecommendationCardExplainability.
2. Validate bat buoc 3 field: why, confidence, invalidation_trigger.
3. Low-confidence state + missing-field fallback.
4. Emit telemetry:
- recommendation_explainability_opened
- recommendation_explainability_insufficient

Deliverable code:
- recommendation card co explainability block 100%.

### S24-07 - Data freshness badge (1d)
1. Tao DataFreshnessBadge dung lastEventAt + freshness_seconds.
2. Hien thi mode Realtime/Delayed/Polling.
3. Ho tro stale threshold va clock-skew safe formatting.

Deliverable code:
- moi decision surface co freshness badge.

### S24-08 - Action checklist pre-decision (1d)
1. Tao ActionChecklist (3-5 items).
2. Chan confirm neu checklist chua complete.
3. Emit telemetry:
- recommendation_action_attempt_blocked
- recommendation_action_checklist_completed

Deliverable code:
- hanh dong bi guard boi checklist.

### S24-09 - User risk mode control (1d)
1. Tao RiskModeSelector.
2. Persist mode vao localStorage (hoac user config neu backend san sang).
3. Ap dung filter recommendation theo mode.
4. Emit telemetry recommendation_risk_mode_changed.

Deliverable code:
- mode restore dung sau reload.

### S24-10 - Recommendation history mini (1d)
1. Tao RecommendationHistoryMini.
2. Hien toi da 5 records moi nhat, ket qua T+1/T+3/T+5.
3. Empty state + gain/loss color policy.
4. Emit telemetry recommendation_history_opened.

Deliverable code:
- user xem bang chung hieu qua gan day ngay tren dashboard.

### S24-05 - Canary UX validation + sign-off (2d)
1. Chay mini canary 3-5 user.
2. Thu feedback theo trust KPI.
3. Chot go/no-go voi PM/FE/QA.

Deliverable artifact:
- update docs/SPRINT24_ACCEPTANCE_CHECKLIST.md
- update docs/SPRINT_EXECUTION_LOG.md
- cap nhat evidence trong docs/SPRINT24_TASKBOARD.csv

## 5) Commit and merge strategy (recommended)

1. PR-1 (S24-01 + S24-02)
- Muc tieu: data consistency core
- Gate can pass: A1, A2, B1, B2

2. PR-2 (S24-03 + S24-04)
- Muc tieu: UX polish + instrumentation
- Gate can pass: B3, B4, D1, D2

3. PR-3 (S24-06 + S24-07)
- Muc tieu: explainability + freshness
- Gate can pass: F1, F2

4. PR-4 (S24-08 + S24-09)
- Muc tieu: user control
- Gate can pass: F3, F4

5. PR-5 (S24-10 + S24-05)
- Muc tieu: trust evidence + release closure
- Gate can pass: F5, F6, D3, D4

## 6) Coding checklist per PR

1. Code changes bat buoc
- update story status trong docs/SPRINT24_TASKBOARD.csv
- update gate evidence trong docs/SPRINT24_ACCEPTANCE_CHECKLIST.md
- them note vao docs/SPRINT_EXECUTION_LOG.md

2. Verification bat buoc
- Frontend build: npm run build
- Backend smoke: python manage.py test portfolio.tests.test_api_routes
- Runtime evidence: scripts/ops/sprint24_collect_dashboard_evidence.ps1

3. Manual QA bat buoc
- Chay test cases critical theo docs/SPRINT24_QA_TEST_CHECKLIST_TRUST_DECISION.md

## 7) Risks and fallback decisions

1. Risk: Chua co endpoint history T+1/T+3/T+5
- Fallback: dung temporary adapter tu whale advisory records + danh dau beta.

2. Risk: Frontend test infra chua lock
- Fallback: su dung build + QA checklist + canary feedback gate trong Sprint 24.

3. Risk: stale status nhiu do network rung
- Fallback: debounce stale badge state (2-3s) de tranh flicker.

4. Risk: over-coupling voi WhaleAdvisory page
- Fallback: tach advisory components thanh reusable block trong folder components/advisory.

## 8) Definition of coding completion (implementation-ready)

1. Code cho S24-01..S24-10 da merge theo thu tu dependency.
2. Tat ca gate A/B/C/D/F co evidence ro trong checklist.
3. Co mini canary report va go/no-go sign-off.
4. User co the:
- nhin thay freshness du lieu
- hieu ly do khuyen nghi
- tu chon risk mode
- bi guard boi checklist truoc hanh dong
- xem history hieu qua gan day
