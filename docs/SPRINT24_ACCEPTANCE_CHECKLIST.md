# Sprint 24 - Acceptance Checklist

Status: DRAFT FOR EXECUTION
Related plan: docs/SPRINT24_DASHBOARD_REALTIME_EXECUTION_PLAN.md

## A. Architecture gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-A1 | Quote state hoisted | FE-Lead-1 | Dashboard co source quote dung chung | In Progress | Dashboard.jsx hoisted quotesBySymbol via useRealtimeFeed |
| S24-A2 | Shared live selector | FE-1 | StatCards/Holdings dung cung selector | In Progress | utils/dashboardRealtimeSelectors.js wired into Dashboard + HoldingsTable |
| S24-A3 | Fallback compatibility | FE-1 | polling fallback van on dinh | Todo | TBD |

## B. UI/UX gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-B1 | Holdings live overlay | FE-2 | livePrice/livePL cap nhat realtime | In Progress | HoldingsTable reads live_current_price/live_market_value/live_unrealized_pl |
| S24-B2 | StatCards consistency | FE-Lead-1 | Market Value/P&L khop holdings summary | In Progress | Dashboard StatCards now bound to liveSummary derived from same overlay |
| S24-B3 | Observability compact | FE-2 | trader mode khong bi clutter | In Progress | DashboardRealtimePanel compact mode + stale badge |
| S24-B4 | Sync action context-aware | FE-2 | hide/disable dung theo status live | In Progress | Dashboard sync button and stale CTA wired by realtime status |

## C. Quality gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-C1 | Frontend tests pass | QA-FE-1 | unit/component tests PASS | Todo | TBD |
| S24-C2 | Build pass | QA-FE-1 | npm run build PASS | In Progress | 2026-04-05: frontend npm run build -> PASS |
| S24-C3 | API contract unchanged | QA-BE-1 | route smoke khong regress | In Progress | docs/ops-evidence/sprint24/backend-route-smoke.txt (Ran 97 tests, OK) |

## D. Runtime/validation gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-D1 | UI refresh p95 captured | Ops-FE-1 | co snapshot p95 cap nhat UI | In Progress | Runtime p95 badge implemented in DashboardRealtimePanel; pending manual snapshot capture in ops-evidence |
| S24-D2 | Stale/fallback counters captured | Ops-FE-1 | co baseline stale/fallback ratio | In Progress | stale/fallback badges implemented; pending manual runtime capture |
| S24-D3 | Mini canary feedback complete | PM-1 | >=3 user test co ket luan | Todo | TBD |
| S24-D4 | Go/No-Go signed | PM-1 | co chu ky FE/QA/PM | Todo | TBD |

## F. Trust and decision-control gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S24-F1 | Explainability completeness | FE-Lead-1 | recommendation card co why/confidence/invalidation | In Progress | WhaleAdvisory uses RecommendationCardExplainability |
| S24-F2 | Data freshness visibility | FE-2 | realtime/delayed + last update timestamp hien thi ro | In Progress | WhaleAdvisory uses DataFreshnessBadge |
| S24-F3 | Decision checklist flow | FE-2 | checklist co the mo/hoan thanh truoc hanh dong | In Progress | WhaleAdvisory uses ActionChecklist with stale-data blocking |
| S24-F4 | Risk mode persistence | FE-1 | mode luu va restore dung khi reload | In Progress | WhaleAdvisory uses RiskModeSelector + localStorage |
| S24-F5 | Recommendation history quality | FE-1 | hien thi du T+1/T+3/T+5 gan day khong sai du lieu mau | In Progress | WhaleAdvisory uses RecommendationHistoryMini for active symbol |
| S24-F6 | Trust telemetry captured | Ops-FE-1 | log duoc chuoi explainability/risk-mode/action | In Progress | useTrustTelemetry persists counters/logs to localStorage and WhaleAdvisory shows TrustTelemetryPanel |

## E. Final sign-off

Ops note (2026-04-05):
- Sprint24 evidence artifacts generated at `docs/ops-evidence/sprint24/`.
- `network-checks.txt` currently records timeout when calling `http://127.0.0.1:8000/api/health/` from terminal automation; needs manual re-check on active run window.

- FE Lead: ____ / Date: ____
- QA Lead: ____ / Date: ____
- BE Lead: ____ / Date: ____
- PM: ____ / Date: ____
