# VNInvest Dashboard Audit Report & Improvement Plan
*Date: 2026-04-XX | Auditor: BLACKBOXAI*

## Executive Summary
**Current State**: Solid realtime foundation with whale/dark alerts, but lacks stock-code specific warnings in holdings table and sticky prominence. Admin dashboard ops-focused; user dashboard trading-ready but fragmented.

**Priority Issues** (per user request):
1. **Alert Visibility**: Whale/dark warnings not overlaid on holdings rows
2. **Information Density**: Backend aggregated risk API now exists; UI risk summary card still needs wiring
3. **Meaningfulness**: Observability noise reduces trader focus
4. **Clarity**: Severity badges need actionability context

**ROI Estimate**: Phase 1 (3 files) → 80% user request coverage in 1 day.

## 1. Information Gathered (Codebase Analysis)

### File Structure & Key Components
```
Admin Dashboard: backend/templates/admin/index.html
├── Ops stats (portfolios/transaction counts)
├── Pandas insights (top symbols, data freshness)
└── Verification ops (email unverified counts)

User Dashboard: frontend/src/pages/Dashboard.jsx
├── StatCards (live market value/P&L overlay ✅)
├── DashboardRealtimePanel.jsx (whale feed + dark flow ✅)
├── HoldingsTable.jsx (live prices but NO whale badges ❌)
├── Charts (Equity/Benchmark, Allocation Pie)

Whale Dashboard: frontend/src/pages/WhaleAlertsDashboard.jsx
├── Money flow donut, bubble orders, RVOL, depth chart
└── OrderFlowRadar (dark money strength/confidence)

Backend APIs (backend/portfolio/views.py):
├── WhaleFeedView (Redis→DB→vnbroker fallback ✅)
├── RVOLView, DepthChartView, OrderFlowSignal ✅
└── Aggregated whale campaigns
```

### Current Strengths ✅
| Feature | Status | Notes |
|---------|--------|-------|
| Live quotes overlay | ✅ Working | Holdings/P&L update realtime |
| Whale/dark alerts | ✅ Prominent | Badges (🦈🐋), severity colors |
| Multi-source fallback | ✅ Robust | Redis stream → IntradayTick → vnbroker |
| Dark flow radar | ✅ Advanced | Strength/confidence/tick rate |

### Critical Gaps ❌ (User Priorities)
| Issue | Impact | Files |
|-------|--------|-------|
| No whale badges in holdings | High (core request) | HoldingsTable.jsx |
| Observability noise | High (trader UX) | DashboardRealtimePanel.jsx |
| No sticky alerts/risk summary | Medium | Dashboard.jsx |
| Alert actionability unclear | Medium | RealtimeContext.jsx |

## 2. Detailed Improvement Plan

### Phase 1: Holdings + Alerts (1 day, 80% coverage)
**Files & Diffs**:
```
1. frontend/src/components/HoldingsTable.jsx
   + Add whaleAlertsBySymbol prop → 🦈 badges per row
   + Row highlighting (extreme=red glow)

2. frontend/src/pages/LegacyDashboard.jsx / frontend/src/pages/modern/ModernDashboard.jsx  
   + StickyAlertBar (top 3 alerts) [implemented in current-code dashboard slice]
   + RiskSummaryCard (stale %, whale exposure)

3. frontend/src/components/DashboardRealtimePanel.jsx
   + Observability icon popover [implemented in current-code dashboard slice]
   + Pin high/extreme alerts
```

### Phase 2: Alert System Polish (0.5 day)
```
New: frontend/src/components/AlertBadge.jsx (unified) [implemented in current-code dashboard slice]
New: useDashboardAlerts.js (filter/priority) [implemented in current-code dashboard slice]
+ Audio ping toggle for extreme [implemented in current-code dashboard slice]
```

### Phase 3: Backend Aggregation (0.5 day)
```
backend/portfolio/views.py
+ /api/dashboard/aggregated-risk/ → stale %, whale exposure, dark flow avg [implemented]
```

## 3. Dependent Files
```
Phase 1 [Must]:
├── frontend/src/components/HoldingsTable.jsx
├── frontend/src/pages/LegacyDashboard.jsx
├── frontend/src/pages/modern/ModernDashboard.jsx  
├── frontend/src/components/DashboardRealtimePanel.jsx
└── frontend/src/context/RealtimeContext.jsx

Phase 2 [New]:
├── frontend/src/components/AlertBadge.jsx
└── frontend/src/hooks/useDashboardAlerts.js

Phase 3 [Backend]:
├── backend/portfolio/views.py
└── backend/portfolio/serializers.py
```

## 4. Follow-up Steps
```
1. [ ] Create TODO.md → Phase checklist
2. [ ] Phase 1: Holdings badges + sticky bar
3. [ ] Test: FPT/VNM whale demo data
4. [ ] Deploy: docker-compose up
5. [ ] Validate: Alerts visible + clickable
6. [ ] Metrics: Alert click-through + time-on-page
```

## Next Actions
```
✅ Plan approved? (Y/N)
✅ Priority changes? (Holdings first?)
✅ Proceed Phase 1? (Create TODO.md?)
✅ Demo symbols? (FPT, VNM, VCB?)
```

