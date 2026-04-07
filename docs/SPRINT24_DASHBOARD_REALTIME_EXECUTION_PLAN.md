# Sprint 24 - Dashboard Realtime Unification Plan (Execution Sprint)

Status: READY TO START (UPDATED)
Timebox: 10 ngay lam viec
Focus: dong no UX/consistency cua Dashboard va nang muc do trust/decion-control truoc khi mo rong tinh nang moi

## 1) Scope

In scope:
1. Hop nhat single source of truth cho quote/live P/L tren Dashboard.
2. Realtime overlay cho HoldingsTable + StatCards theo cung timestamp.
3. UX polish cho observability va sync action.
4. Thiet lap KPI + test matrix + evidence schema cho dashboard runtime.
5. Them trust layer cho khuyen nghi: data freshness, explainability va user decision checklist.
6. Them user control co gioi han: risk mode va lich su khuyen nghi gan day.

Out of scope:
1. Viet lai toan bo dashboard architecture.
2. Them tinh nang product nang cao (voice alerts, advanced notifications).
3. Backend business logic moi khong lien quan dashboard consistency.
4. Brokerage integration va dat lenh tu dong.
5. Multi-asset derivatives engine.

## 2) Input artifacts bat buoc

1. docs/DASHBOARD_CODE_AUDIT_$(date +%Y%m%d).md
2. docs/DASHBOARD_FRONTEND_AUDIT.md
3. docs/SPRINT_EXECUTION_LOG.md
4. docs/ROADMAP_STATUS.md
5. docs/SPRINT24_TRUST_DECISION_STORIES.md
6. docs/SPRINT24_QA_TEST_CHECKLIST_TRUST_DECISION.md
7. docs/SPRINT24_DAILY_STANDUP_TEMPLATE.md
8. docs/SPRINT24_CODING_BREAKDOWN_PLAN.md

## 3) Sprint backlog (code-level)

| Story ID | Muc tieu | Code area du kien | Output bat buoc | Test bat buoc | Status |
|---|---|---|---|---|---|
| S24-01 | Single source quote state | frontend/src/pages/Dashboard.jsx, frontend/src/hooks/useRealtimeFeed.js | quotesBySymbol hoisted + selector dung chung | unit test selector + component update tests | Todo |
| S24-02 | Live overlay holdings/cards | frontend/src/components/HoldingsTable.jsx, frontend/src/components/StatCard.jsx | liveMarketValue/livePL dong bo theo quote | snapshot+interaction tests | Todo |
| S24-03 | Realtime UX polish | frontend/src/components/DashboardRealtimePanel.jsx, frontend/src/pages/Dashboard.jsx | observability compact mode + sync button context-aware | UI behavior tests + manual checklist | Todo |
| S24-04 | Runtime KPI instrumentation | frontend metrics hook + docs/ops evidence | p95 UI refresh, stale ratio, fallback count | local runtime smoke + evidence capture | Todo |
| S24-05 | Canary UX validation | docs + checklist | mini canary 3-5 user test + go/no-go note | feedback log + closure report | Todo |
| S24-06 | Decision card explainability | frontend/src/components/advisory/*, frontend/src/pages/Dashboard.jsx | ly do khuyen nghi + confidence + invalidation trigger | UI tests + content checklist | Todo |
| S24-07 | Data freshness badge | frontend/src/components/*Realtime*, frontend/src/pages/Dashboard.jsx | hien thi nguon/trang thai/timestamp du lieu | UI behavior tests + stale fixture test | Todo |
| S24-08 | Action checklist truoc quyet dinh | frontend/src/components/advisory/ActionChecklist.jsx | checklist 3-5 cau hoi truoc hanh dong | interaction tests + manual UX script | Todo |
| S24-09 | User risk mode control | frontend/src/components/advisory/RiskModeSelector.jsx | mode Phong thu/Can bang/Tang truong, luu preference | state persistence tests | Todo |
| S24-10 | Recommendation history mini | frontend/src/components/advisory/RecommendationHistoryMini.jsx | hien thi ket qua T+1/T+3/T+5 gan day | rendering tests + sample data validation | Todo |

## 4) Milestones

1. M1 (Day 1-2): S24-01 done.
2. M2 (Day 3): S24-02 done.
3. M3 (Day 4): S24-03 done.
4. M4 (Day 5): S24-04 done.
5. M5 (Day 6): S24-06 + S24-07 done.
6. M6 (Day 7-8): S24-08 + S24-09 done.
7. M7 (Day 9): S24-10 done.
8. M8 (Day 10): S24-05 + sprint sign-off.

## 5) Definition of Done for Sprint 24

1. Market Value/P&L khong con lech giua StatCards va Holdings summary tren cung timestamp.
2. HoldingsTable nhan live overlay khong pha fallback behavior.
3. Observability khong gay clutter trong trader mode.
4. Co KPI evidence + mini canary feedback + sign-off bien ban.
5. 100% recommendation card co explainability block (why/confidence/invalidation).
6. 100% decision surface co freshness badge va timestamp du lieu.
7. Co event log cho luong: mo recommendation -> mo explainability -> doi risk mode -> hanh dong.

## 6) Mandatory commands checklist

```powershell
# Frontend tests/build
cd frontend
npm test -- --watch=false
npm run build

# Backend API smoke (de cap quote)
cd ../backend
python manage.py test portfolio.tests.test_api_routes

# Runtime smoke evidence
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ops/sprint24_collect_dashboard_evidence.ps1 -SkipNetworkChecks
```

## 7) Risk controls

1. Moi thay doi state realtime phai co fallback scenario test.
2. Neu UI consistency fail tren timestamp test fixture -> block merge.
3. Moi story phai cap nhat evidence vao sprint log.
4. Neu recommendation card khong du explainability fields -> block merge.
5. Neu stale-data state khong hien thi ro rang -> block merge.

## 8) Execution notes

- Sprint 24 chi bat dau coding sau khi plan/checklist/taskboard duoc lock.
- Uu tien chat luong consistency truoc animation/feature moi.
- Uu tien trust va kha nang tu ra quyet dinh cua nguoi dung truoc cac extension nang cao.
