# Sprint 24 - Acceptance Checklist

Status: DRAFT FOR EXECUTION
Related plan: docs/SPRINT24_DASHBOARD_REALTIME_EXECUTION_PLAN.md

## A. Architecture gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-A1 | Quote state hoisted | FE-Lead-1 | Dashboard co source quote dung chung | Todo | TBD |
| S24-A2 | Shared live selector | FE-1 | StatCards/Holdings dung cung selector | Todo | TBD |
| S24-A3 | Fallback compatibility | FE-1 | polling fallback van on dinh | Todo | TBD |

## B. UI/UX gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-B1 | Holdings live overlay | FE-2 | livePrice/livePL cap nhat realtime | Todo | TBD |
| S24-B2 | StatCards consistency | FE-Lead-1 | Market Value/P&L khop holdings summary | Todo | TBD |
| S24-B3 | Observability compact | FE-2 | trader mode khong bi clutter | Todo | TBD |
| S24-B4 | Sync action context-aware | FE-2 | hide/disable dung theo status live | Todo | TBD |

## C. Quality gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-C1 | Frontend tests pass | QA-FE-1 | unit/component tests PASS | Todo | TBD |
| S24-C2 | Build pass | QA-FE-1 | npm run build PASS | Todo | TBD |
| S24-C3 | API contract unchanged | QA-BE-1 | route smoke khong regress | Todo | TBD |

## D. Runtime/validation gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-D1 | UI refresh p95 captured | Ops-FE-1 | co snapshot p95 cap nhat UI | Todo | TBD |
| S24-D2 | Stale/fallback counters captured | Ops-FE-1 | co baseline stale/fallback ratio | Todo | TBD |
| S24-D3 | Mini canary feedback complete | PM-1 | >=3 user test co ket luan | Todo | TBD |
| S24-D4 | Go/No-Go signed | PM-1 | co chu ky FE/QA/PM | Todo | TBD |

## E. Final sign-off

- FE Lead: ____ / Date: ____
- QA Lead: ____ / Date: ____
- BE Lead: ____ / Date: ____
- PM: ____ / Date: ____
