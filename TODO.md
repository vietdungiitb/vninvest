# Dashboard Improvement TODO
*Generated: 2026-04-XX | Status: Planning*

## Phase 1: Holdings + Core Alerts [3 files, 1 day]

### [ ] 1.1 HoldingsTable whale badges
```
frontend/src/components/HoldingsTable.jsx
- Add prop: whaleAlertsBySymbol
- Render badges: 🦈 HIGH BUY (2.5T)
- Row glow: extreme=red, high=orange
```
*Test*: FPT row shows 🦈 if recent alert

### [ ] 1.2 Sticky Alert Bar  
```
frontend/src/pages/Dashboard.jsx
+ New StickyAlertBar component
+ Show top 3: symbol + severity + time
```
*Test*: Alerts stick on scroll

### [ ] 1.3 RealtimePanel compact
```
frontend/src/components/DashboardRealtimePanel.jsx
- Observability → icon popover
+ Pin extreme alerts top
```
*Test*: Click icon → metrics popover

## Phase 2: Alert Polish [New components]

### [ ] 2.1 Unified AlertBadge
```
frontend/src/components/AlertBadge.jsx
- 🦈/🐋 + severity color
- Click → stock detail
- Hover → full details
```

### [ ] 2.2 Audio + Settings
```
+ User setting: alert_sound=true
+ Extreme → audio ping
```

## Phase 3: Backend Aggregation

### [ ] 3.1 Aggregated Risk API
```
backend/portfolio/views.py
+ GET /api/dashboard/aggregated-risk/
  - stale_positions_pct
  - whale_exposure_symbols  
  - dark_flow_avg_strength
```

## Validation
```
[ ] Demo data: FPT/VNM with whale/dark alerts
[ ] docker-compose up → test live
[ ] Metrics before/after: alert engagement
```

**Current Phase**: 1.1 HoldingsTable

