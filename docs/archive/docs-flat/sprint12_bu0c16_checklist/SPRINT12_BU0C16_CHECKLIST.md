# Bước 16 Implementation Checklist & Tasks

**Sprint**: Sprint 12  
**Bước**: 16 - Tách layer realtime frontend dùng chung  
**Status**: CODE COMPLETE, RUNTIME QA PENDING  
**Timeline**: 5-8 ngày làm việc  

---

## ✅ Completed (Phase 1: Consolidation)

### Hook Layer
- [x] Create `useRealtimeFeed.js` with WebSocket + polling
- [x] Implement connection lifecycle (connecting → live → polling)
- [x] Implement auto-reconnect logic (3s retry)
- [x] Handle ticker_update events
- [x] Handle whale_alert events
- [x] Handle heartbeat events
- [x] Normalize quotes (price, change_pct, freshness_seconds)

### Watchlist Layer
- [x] Import `useRealtimeFeed` hook
- [x] Subscribe to all symbols (groups + tracked + alerts)
- [x] Merge quotes into groups items
- [x] Merge quotes into tracked symbols
- [x] Merge quotes into price alerts
- [x] Render realtime price updates in table
- [x] Trigger price alert logic on quote updates
- [x] Display realtime status badge

### Dashboard Layer (DashboardRealtimePanel)
- [x] Import `useRealtimeFeed` hook
- [x] Subscribe to holdings + tracked symbols
- [x] Calculate realtime portfolio market value
- [x] Calculate realtime P/L (unrealized_pl, pct)
- [x] Detect stale positions
- [x] Render breadth stats (up/down/flat)
- [x] Display whale alert table
- [x] Show live vs snapshot delta

---

## ⏳ Remaining Tasks (Phase 2: Verification & Optimization)

### Day 1 Morning: Code Review & Verification

**Task 1.1: Verify Watchlist consolidation**
- [ ] Read Watchlist.jsx line range 100-300 (hook usage + subscription)
- [ ] Read Watchlist.jsx line range 400-600 (quote merging)
- [ ] Read Watchlist.jsx line range 700-900 (render logic)
- [ ] Search: `WebSocket` → Should be 0 results outside useRealtimeFeed.js
- [ ] Search: `.onmessage` → Should be 0 results outside useRealtimeFeed.js
- [ ] Search: `.onopen` → Should be 0 results outside useRealtimeFeed.js
- [ ] Result: ✅ Clean consolidation

**Task 1.2: Verify Dashboard consolidation**
- [ ] Read DashboardRealtimePanel.jsx (full file 300 lines)
- [ ] Confirm no duplicate websocket logic
- [ ] Confirm proper quote overlay to holdings
- [ ] Confirm portfolio stats calculation correct
- [ ] Result: ✅ Clean consolidation

**Task 1.3: Global sweep for duplicate realtime logic**
- [ ] Search frontend: `setInterval` → Should only be in useRealtimeFeed
- [ ] Search frontend: `setInterval` + `polling` → Should only be hook
- [ ] Search frontend: `fetch.*ticker` → Should only be hook + API client
- [ ] Search frontend: `useEffect.*realtime` → Should only track dependencies
- [ ] Result: ✅ No duplicate logic

**Task 1.4: Verify subscription pattern consistency**
- [ ] Watchlist: symbols = all groups + tracked + alerts ✅
  - [ ] Every group subscribed
  - [ ] Every tracked symbol subscribed
  - [ ] Every price alert symbol subscribed
  - [ ] No duplicates (useMemo + Set(symbols))

- [ ] Dashboard: symbols = holdings + tracked ✅
  - [ ] Every holding subscribed
  - [ ] Every tracked symbol subscribed
  - [ ] Dynamic update on holdings change
  
- [ ] Cleanup on unmount ✅
  - [x] Hook da gui explicit `unsubscribe` truoc khi close socket khi `readyState === OPEN`
  - [x] Interval polling da duoc clear trong cleanup
  - [ ] Verify no memory leaks (use Profiler React DevTools)

**Deliverable**: VERIFIED document listing:
- Hook line count: 243 ✅
- Watchlist ws search results: 0 ✅
- Dashboard ws search results: 0 ✅
- Global duplicate logic: 0 ✅

---

### Day 1-2 Afternoon: Add Observability Metrics

**Task 2.1: Enhance useRealtimeFeed.js with metrics**
- [ ] Add counter: `eventCounts = { ticker_update: 0, whale_alert: 0, heartbeat: 0 }`
- [ ] Add counter: `reconnectAttempts = 0`
- [ ] Add tracking: `latencyMs` (last event publish_ts vs received_ts)
- [ ] Add tracking: `lastEventTypes` array
- [ ] Update hook return object: `{ ..., metrics: { eventCounts, reconnectAttempts, lastLatencyMs } }`

Cap nhat thuc te:
- [x] `eventCounts` da mo rong them `subscribed`, `unsubscribed`, `polling_successes`, `polling_failures`
- [x] Hook da export `connectionState` cho QA runtime (`transport`, `lastSubscribedAt`, `lastUnsubscribedAt`, `lastReconnectAt`, `lastErrorAt`, `lastCloseCode`, `lastCloseReason`, `subscribedSymbols`)

**Task 2.2: Create metrics context (optional)**
- [ ] Create `frontend/src/context/RealtimeMetricsContext.js` (NEW)
- [ ] Expose hook: `useRealtimeMetrics()` → returns global metrics
- [ ] Wrap App in provider: `<RealtimeMetricsProvider>`
- [ ] Watchlist/Dashboard can access shared metrics

**Task 2.3: Create debug panel (optional)**
- [ ] Create `frontend/src/components/RealtimeDebugPanel.jsx` (NEW)
- [ ] Show: connection status with timeline
- [ ] Show: event counts breakdown
- [ ] Show: last 10 events log
- [ ] Show: average latency
- [ ] Show: reconnect history
- [ ] Trigger: `?debug=realtime` URL param
- [ ] Render: bottom-right corner (fixed pos, z-index)

Cap nhat thuc te:
- [x] `RealtimeDebugPanel.jsx` da hien event lifecycle (`event_id`, `config_version`, `source`) va runtime connection metrics.

**Deliverable**: 
- useRealtimeFeed.js updated (metrics +20 lines)
- RealtimeDebugPanel.jsx created (150 lines)
- Metrics visible on screen when ?debug=realtime param set

Cap nhat them ve contract whale event:
- [x] Backend WS `whale_alert` da phat `severity`, `event_score`, `display_score`, `weights_version`
- [x] Backend WS `whale_alert` da co them `event_id`, `config_version`, `source`
- [x] Frontend dedup whale alerts uu tien theo `event_id`
- [x] Realtime whale panels da dung truc tiep `severity` va `size_class` tu backend contract

---

### Day 2-3: Fallback & Stale Behavior Testing

**Task 3.1: Manual test fallback polling**
- [ ] Start app, open browser DevTools (Network tab)
- [ ] Verify WebSocket connects: `wss://... 101 Switching Protocols`
- [ ] Wait 2 minutes
- [ ] Close WebSocket in DevTools (Throttle → Offline)
- [ ] Verify status changes: `live` → `connecting` → `polling` (30s later)
- [ ] Observe: HTTP GET /api/realtime/ticker/{symbol} every 15s
- [ ] Observe: Quotes still updating (from polling)
- [ ] Verify: Stale indicator appears after 20s no update

**Task 3.2: Test reconnect behavior**
- [ ] With websocket offline, wait 3s
- [ ] Close DevTools throttle (back online)
- [ ] Verify: Immediate reconnect attempt
- [ ] Verify: Status: `connecting` → `live` (few seconds)
- [ ] Verify: HTTP polling stops
- [ ] Verify: WebSocket events resume
- [ ] Check: Console logs show reconnect attempts

**Task 3.3: Test stale state calculations**
- [ ] Open DashboardRealtimePanel
- [ ] Note: stalePositions count (should be 0 if just loaded)
- [ ] Throttle connection (Slow 3G)
- [ ] Wait 20s
- [ ] Verify: stalePositions count increases
- [ ] Verify: Stale indicator on quote rows

**Deliverable**: Test log documenting:
- Fallback polling triggered correctly ✅
- Reconnect works after 3s ✅
- Stale detection triggers at ~20s ✅
- P95 latency polling: acceptable ✅

---

### Day 4-5: Redis-backed Environment Validation

**Task 4.1: Backend setup**
- [ ] Verify Redis server running: `redis-cli ping` → PONG
- [ ] Backend started with correct settings:
  - [ ] `REALTIME_ENABLED=true`
  - [ ] `REALTIME_CHANNEL_LAYER=redis`
  - [ ] `CELERY_BROKER_URL=redis://...`

**Task 4.2: Verify end-to-end data flow**
- [ ] Start: Frontend Watchlist page
- [ ] Observe: Quotes updating every 5s
- [ ] Monitor Redis: `redis-cli SUBSCRIBE 'ticker:*'` (separate terminal)
- [ ] Should see: `ticker:VNM`, `ticker:TCB`, etc. messages
- [ ] Measure: Time from publish (backend) to receive (frontend) < 1.5s
  - [ ] Add timestamp logging to backend publisher
  - [ ] Add timestamp logging to frontend websocket handler
  - [ ] Calculate delta

**Task 4.3: Simulate whale alert**
- [ ] Backend: Run management command to trigger whale alert
- [ ] Frontend: Should see alert in DashboardRealtimePanel whale table
- [ ] Verify: Alert shows correct data (symbol, value, threshold, side)

**Task 4.4: Scale test (light load)**
- [ ] Frontend: Subscribe to 50 symbols (add to Watchlist)
- [ ] Monitor: WebSocket message frequency, CPU usage, memory
- [ ] Verify: No lag in UI updates
- [ ] Check: Browser console for errors

**Deliverable**: 
- Redis-backed working ✅
- p95 latency < 1.5s documented ✅
- Whale alert flow confirmed ✅
- Load test informal pass ✅

---

### Day 5-6: QA Matrix Execution

**Task 5.1: Use Sprint 11 Acceptance Checklist**
Reference: [SPRINT11_ACCEPTANCE_CHECKLIST.md](../sprint11_acceptance_checklist/SPRINT11_ACCEPTANCE_CHECKLIST.md)

- [ ] A. Architecture & Contract
  - [ ] WebSocket contract per docs
  - [ ] Message envelope has contract_version, ts, seq

- [ ] B. Backend Pipeline
  - [ ] Celery collector poll 5s active ✅
  - [ ] Pandas compute pass ✅
  - [ ] Redis Pub/Sub working ✅
  - [ ] Channels consumer auth pass ✅

- [ ] C. Gateway & Frontend
  - [ ] FE subscribe/unsubscribe logic correct
  - [ ] FE fallback polling when ws disconnect
  - [ ] Stale indicator visible/correct

- [ ] D. Quality & Performance
  - [ ] QA matrix tests pass
  - [ ] p95 publish→client < 1.5s
  - [ ] Worker success rate > 99%

- [ ] E. Operations
  - [ ] Monitoring dashboard exists
  - [ ] Alert rules for error/disconnect

- [ ] F. Release Sign-off
  - [ ] BE Lead: approved ✅
  - [ ] FE Lead: approved (that's us)
  - [ ] QA: all tests pass
  - [ ] DevOps: deployment ready

**Task 5.2: Browser compatibility test**
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (if Mac available)
- [ ] Mobile (iOS Safari, Chrome Mobile)
- [ ] Result: All pass ✅

**Task 5.3: Regression testing**
- [ ] Watchlist price updates work
- [ ] Price alert triggering works
- [ ] Dashboard portfolio realtime stats correct
- [ ] Whale alert panel displays correctly
- [ ] Manual price refresh (sync) still works
- [ ] Result: All pass ✅

**Deliverable**: QA matrix passed document with all boxes checked

---

### Day 6: Documentation & Cleanup

**Task 6.1: Update docs**
- [ ] Update [SPRINT12_DETAILED_PLAN.md](../sprint12_detailed_plan/SPRINT12_DETAILED_PLAN.md) with actual completion
- [ ] Add notes on any issues found/fixed

Trang thai tam dung hien tai:
- [x] Contract whale realtime da duoc hardening xong o muc code + targeted tests.
- [x] Route smoke suite va realtime gateway suite da pass.
- [ ] Browser runtime QA va do p95 publish -> push tren runtime that van la buoc tiep theo.
- [ ] Update DoD checklist

**Task 6.2: Code cleanup (if needed)**
- [ ] Remove any debug console.log statements
- [ ] Format code (Prettier)
- [ ] Check for unused imports
- [ ] Verify no linting errors: `npm run lint` (if configured)

**Task 6.3: Prepare handoff docs**
- [ ] Create [REALTIME_LAYER_HANDOFF.md](../REALTIME_LAYER_HANDOFF.md)
  - Hook API documentation
  - Integration examples
  - Known limitations
  - Troubleshooting guide

**Deliverable**: 
- Docs updated ✅
- Code clean ✅
- Handoff guide ready ✅

---

### Day 7: Sprint 12 Sign-off & Bước 17 Prep

**Task 7.1: Sprint 12 Bước 16 sign-off**
- [ ] All tasks completed ✅
- [ ] QA matrix passed ✅
- [ ] Code review passed ✅
- [ ] Mark SPRINT12_BU0C16_PREPARATION.md as DONE
- [ ] Update ROADMAP_STATUS.md:
  - [ ] Sprint 12 Bước 16: COMPLETE ✅
  - [ ] Status: Ready for Bước 17

**Task 7.2: Prepare Bước 17 (P/L Realtime)**
- [ ] Review [ADMIN_UI_IMPLEMENTATION_STEPS.md](../../../ADMIN_UI_IMPLEMENTATION_STEPS.md) Bước 17 requirements
- [ ] Identify API endpoints needed
- [ ] Identify UI components to modify
- [ ] Create SPRINT12_BU0C17_PREPARATION.md

**Deliverable**: 
- Bước 16 DONE ✅
- Sprint 12 backlog updated ✅
- Bước 17 ready to start ✅

---

## 🎯 Success Criteria

**Bước 16 100% Complete when:**
1. ✅ Watchlist & Dashboard use same `useRealtimeFeed` hook (zero duplicate websocket logic)
2. ✅ All verification tests pass (code review, search, consolidation check)
3. ✅ Observability metrics working (event counts, latency, reconnect visible)
4. ✅ Fallback polling tested & working (manual test passes)
5. ✅ Redis-backed environment validated (p95 < 1.5s, whale alerts work)
6. ✅ QA matrix passed (all tests + browsers + regression)
7. ✅ Docs updated & ready for Bước 17

---

## 🚀 Next Steps (When Bước 16 done)

### Bước 17: P/L Realtime on Dashboard (3 days)
- Reuse `realtimePortfolioStats` from DashboardRealtimePanel
- Add animated P/L card on top
- Add mini P/L chart

### Bước 18: Price Alerts Domain (5 days)
- Backend: Create PriceAlertRule model (if not done)
- Backend: Create CRUD API endpoints
- Frontend: Add price alert management UI to Watchlist
- Integration: Hook into realtime alert evaluator

### Bước 19: Auto-sync Watch Assets (3 days)
- Backend: Expand sync to all 3 tracking layers
- Backend: Add Celery Beat scheduling
- Frontend: Add config UI

---

## 📞 Questions / Blockers?

If blocked on any task:
1. Check test failure output (browser console, server logs)
2. Verify backend servers running correctly
3. Verify Redis running (redis-cli ping)
4. Check network throttling not interfering
5. Ask for help with specific error message

---

**Prepared by**: GitHub Copilot  
**Target Completion**: 2026-04-08 (7 days from now)  
**Review Date**: 2026-04-01 EOD (Today)
