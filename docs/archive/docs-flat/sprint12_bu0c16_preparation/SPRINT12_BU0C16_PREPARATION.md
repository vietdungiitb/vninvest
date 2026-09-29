# Sprint 12 Preparation - Bước 16 Status

**Date**: 2026-04-01  
**Status**: 95% COMPLETE (Hook created & consolidated)  
**Priority**: Verification + optimization + observability

---

## 🎯 Bước 16 Current State

### ✅ Already Completed
1. **Hook created**: `frontend/src/hooks/useRealtimeFeed.js` (243 lines)
   - WebSocket + fallback polling logic
   - Quote merging (ticker_update)
   - Whale alert handling
   - Auto-reconnect with 3s timeout
   - Feature detection (tower: idle → connecting → live/polling)

2. **Watchlist consolidated**: `frontend/src/pages/Watchlist.jsx` (1059 lines)
   - Uses `useRealtimeFeed({ symbols: allRealtimeSymbols })`
   - `mergeTickerIntoItem()` merges realtime quotes into items
   - `groupsWithRealtime`, `trackedSymbolsWithRealtime`, `priceAlertsWithRealtime` overlay quotes
   - Price alert triggering integrated
   - NO duplicate websocket logic

3. **Dashboard consolidated**: `frontend/src/components/DashboardRealtimePanel.jsx` (300 lines)
   - Uses `useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 5 })`
   - Calculates realtime portfolio stats (market value, P/L, unrealized_pl_pct)
   - Detects stale positions
   - Shows whale alerts + breadth stats
   - NO duplicate websocket logic

### ⏳ Remaining Tasks (to achieve 100%)

**Task 1: Verify subscription consistency**
- [ ] Check if Watchlist subscription symbols match holdings + tracked + alerts
- [ ] Check if Dashboard subscription covers holdings + tracked symbols
- [ ] Verify unsubscribe cleanup when component unmounts
- [ ] Test dynamic subscription updates when symbols change

**Task 2: Optimize subscription overhead**
- [ ] Deduplicate symbols across components (avoid subscribing same symbol twice)
- [ ] Implement per-page subscription scope (Watchlist subs A, Dashboard subs B independently)
- [ ] Verify no memory leaks on component remount

**Task 3: Enhance observability metrics**
- [ ] Add event counter (ticker_update, whale_alert, heartbeat counts)
- [ ] Add reconnect counter (auto-reconnect attempts)
- [ ] Add latency tracking (publish → received)
- [ ] Expose metrics via debug panel or session logging

**Task 4: Validate fallback polling behavior**
- [ ] Simulate websocket close (disconnect)
- [ ] Verify fallback to polling 15s interval
- [ ] Check stale indicator updates correctly
- [ ] Verify reconnect attempts work every 3s

**Task 5: Test Redux-backed environment**
- [ ] Setup local Redis if not done
- [ ] Test with `REALTIME_CHANNEL_LAYER=redis` on backend
- [ ] Measure p95 publish→push latency < 1.5s
- [ ] Run full QA matrix (see Sprint 11 checklist)

---

## 📋 Implementation Roadmap (Next 5-10 days)

### Day 1: Verify consolidation (Morning)
**Goal**: Ensure 100% consolidation with zero duplicate logic

**Checklist:**
- [ ] Read Watchlist.jsx lines 100-300: verify quote merging logic
- [ ] Read Watchlist.jsx lines 600-750: verify websocket cleanup
- [ ] Read Watchlist.jsx lines 800-900: verify subscription updates
- [ ] Check DashboardRealtimePanel: verify holdings subscription pattern
- [ ] Search entire frontend for `new WebSocket` - should only exist in useRealtimeFeed.js
- [ ] Search entire frontend for duplicate poll logic - should only exist in useRealtimeFeed.js

---

### Day 2-3: Add observability & metrics (Full day)
**Goal**: Add event counters, latency tracking, debug UI

**Files to create/modify:**
1. `frontend/src/hooks/useRealtimeFeedMetrics.ts` (NEW)
   - Wrap useRealtimeFeed with metrics collection
   - Track event counts, latency, reconnect attempts
   - Expose via context or local debug panel

2. `frontend/src/components/RealtimeDebugPanel.jsx` (NEW)
   - Show current metrics
   - Show connection status timeline
   - Show recent events log
   - Optional: hidden behind `?debug=realtime` param

3. Modify `useRealtimeFeed.js`
   - Add eventCounter tracking
   - Add latency measurement (publish ts vs received ts)
   - Emit metric events

### Day 4: Fallback & stale indicator (Full day)
**Goal**: Verify stale state + reconnect logic works flawlessly

**Test matrix:**
- [ ] WebSocket connect successful → should see `live` status
- [ ] After 20s no heartbeat → should fallback to `polling`
- [ ] Fallback polling every 15s → should update quotes
- [ ] Quote from polling should have `stale: true` indicator
- [ ] Close websocket (alt+F12 → disable connection) → should see reconnect in console
- [ ] Reconnect after 3s → should switch back to `live`
- [ ] Manual refresh (F5) → should preserve settings and reconnect cleanly

### Day 5-6: Redis-backed validation (Full day)
**Goal**: Confirm real Redis Pub/Sub works end-to-end

**Prerequisites:**
- Backend running with feature flags enabled
- Redis server running locally (redis-cli available)
- Celery beat enabled for collector task

**Test sequence:**
1. Start backend with `REALTIME_CHANNEL_LAYER=redis`
2. Start frontend
3. Navigate to Watchlist → should see live quotes updating every 5s
4. Open console → should see ticker_update events
5. Monitor Redis channels: `redis-cli SUBSCRIBE ticker:*` in separate terminal
6. Check latency: publish_ts (from backend) vs received_ts (frontend) → should be < 1.5s p95
7. Trigger whale alert simulation (backend management command) → should appear in dashboard
8. Disconnect websocket → should fallback to polling
9. Reconnect websocket → should resume live updates

### Day 7: QA Matrix + Bug fixes (Full day)
**Goal**: Comprehensive testing before sign-off

**Use Sprint 11 acceptance checklist:**
- [ ] QA test matrix passed (disconnect/reconnect/load tests)
- [ ] p95 latency < 1.5s
- [ ] Worker success rate >= 99%
- [ ] Stale indicator correct
- [ ] Whale alert history preserved
- [ ] Mobile UI responsive (watchlist on mobile)

### Day 8: Sprint 12 sign-off (Half day)
**Deliverables:**
- [ ] useRealtimeFeed hook verified
- [ ] Watchlist + Dashboard consolidated ✅
- [ ] Observability metrics added
- [ ] Fallback polling tested
- [ ] Redis-backed validated
- [ ] QA matrix passed
- [ ] RunBook docs updated

---

## 🔍 Current Code Structure

### useRealtimeFeed.js (243 lines) - CORE LAYER
```
exported function: useRealtimeFeed({ symbols, pollInterval, maxAlerts })
├─ state: quotesBySymbol (by symbol)
├─ state: realtimeStatus ('idle'|'connecting'|'live'|'polling')
├─ state: lastEventAt (timestamp)
├─ state: alerts (whale alert list)
├─ effect: websocket connection + subscribe/unsubscribe
├─ effect: fallback polling interval
├─ effect: symbol normalization + cleanup
└─ return: { quotesBySymbol, realtimeStatus, lastEventAt, alerts, latestWhaleAlert }
```

### Watchlist.jsx (1059 lines) - CONSUMER 1
```
export default function WatchlistPage()
├─ const allRealtimeSymbols = [groups + trackedSymbols + priceAlerts]
├─ const { quotesBySymbol, realtimeStatus, ... } = useRealtimeFeed({ symbols })
├─ const groupsWithRealtime = useMemo(group.items.map(mergeTickerIntoItem))
├─ const trackedSymbolsWithRealtime = useMemo(tracked.map(mergeTickerIntoItem))
├─ const priceAlertsWithRealtime = useMemo(overlay quotes into alerts)
├─ price alert triggering logic
└─ render: table view of groups + tracked + alerts with realtime updates
```

### DashboardRealtimePanel.jsx (300 lines) - CONSUMER 2
```
export default function DashboardRealtimePanel({ holdings })
├─ const monitoredSymbols = [holdings + trackedSymbols]
├─ const { quotesBySymbol, realtimeStatus, alerts, ... } = useRealtimeFeed({ symbols })
├─ effect: fetch trackedSymbols on mount
├─ compute: realtimePortfolioStats (market_value, P/L, stale count)
├─ compute: liveVsSnapshotDelta (realtime vs snapshot)
└─ render: portfolio stats cards + quote table + whale alerts panel
```

---

## 🚀 Next Sprint (Sprint 13)

**After Bước 16 complete**, prioritize:

### Bước 17: P/L Realtime on Dashboard
- Reuse `realtimePortfolioStats` calculation
- Add animated percentage change
- Show P/L history micro-chart

### Bước 18: Price Alerts Domain
- Create `PriceAlertRule` model (if backend models not done yet)
- Create CRUD API endpoints
- Integrate alert evaluator into realtime pipeline
- UI: add/edit/delete alerts on Watchlist

### Bước 19: Auto-sync Watch Assets
- Expand `sync_watchlist_prices()` to union of all 3 tracking layers
- Add Celery Beat task scheduling
- Add config to enable/disable + adjust frequency

---

## 📝 Documentation & Notes

### Key Files
- `frontend/src/hooks/useRealtimeFeed.js` - Core websocket + polling logic
- `frontend/src/pages/Watchlist.jsx` - Consumer 1 (groups + tracked + alerts)
- `frontend/src/components/DashboardRealtimePanel.jsx` - Consumer 2 (holdings + breadth)
- `frontend/src/api/client.js` - API client methods (getRealtimeTicker, getRealtimeWebSocketUrl)

### Backend Integration Points
- `GET /api/realtime/ticker/{symbol}/` - Fallback polling endpoint
- `WebSocket /ws/realtime/` - WebSocket gateway (requires JWT token)
- Redis channels: `ticker:{symbol}`, `whale:{symbol}`, `user:{user_id}:alerts`
- Feature flags: `REALTIME_ENABLED`, `REALTIME_DEFAULT_WHALE_THRESHOLD`

### Known Limitations (Current)
1. Mock data for whale alerts (need backend integration)
2. No persistent alert history (only last 5 in memory)
3. Stale detection depends on fallback polling (< 20s = live, > 20s = stale)
4. No per-user subscription filtering (shows all alerts)

---

**Prepared by**: GitHub Copilot  
**Sprint Target**: Complete Bước 16 → Sign-off by Day 8  
**Next Review**: After Day 1 verification complete
