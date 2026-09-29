# 🎯 Bước 16 - Kế Hoạch Triển Khai Chi Tiết

**Sprint**: Sprint 12  
**Bước**: 16 - Tách layer realtime frontend dùng chung  
**Thời gian**: 2026-04-02 đến 2026-04-08 (7 ngày)  
**Trạng thái hiện tại**: 95% hoàn thành (verification + optimization remaining)

---

## 🗓️ TIMELINE THỰC HIỆN

### **Day 1: 2026-04-02 (Wednesday)**
**Focus**: Verification - Kiểm chứng consolidation đã hoàn thành 100%

#### Morning (09:00 - 12:00)
**Task 1.1**: Code Review Watchlist.jsx (Lines 100-400)
```
Target:
├─ Xác nhận import useRealtimeFeed ✅
├─ Xác nhận const allRealtimeSymbols = [groups + tracked + alerts]
├─ Xác nhận groupsWithRealtime = useMemo(mergeTickerIntoItem)
├─ Xác nhận trackedSymbolsWithRealtime = useMemo(mergeTickerIntoItem)
└─ Xác nhận giá realtime được overlay vào render

Command:
$ grep -n "useRealtimeFeed\|allRealtimeSymbols\|groupsWithRealtime" \
  frontend/src/pages/Watchlist.jsx | head -20
```

**Task 1.2**: Code Review Watchlist.jsx (Lines 600-900)
```
Target:
├─ Xác nhận return statement render groups + tracked + alerts
├─ Xác nhận quotesBySymbol được sử dụng trong mergeTickerIntoItem
├─ Xác nhận status badge (realtimeStatus) được hiển thị
├─ Xác nhận không có websocket logic riêng
└─ Xác nhận cleanup khi component unmount

Command:
$ sed -n '600,900p' frontend/src/pages/Watchlist.jsx | \
  grep -i "websocket\|socket\|onmessage\|onopen"
# Expected: 0 results
```

#### Afternoon (13:00 - 18:00)
**Task 1.3**: Code Review DashboardRealtimePanel.jsx
```
Target:
├─ Xác nhận import useRealtimeFeed ✅
├─ Xác nhận const monitoredSymbols = [holdings + trackedSymbols]
├─ Xác nhận realtimePortfolioStats calculation
├─ Xác nhận không có duplicate websocket logic
└─ Xác nhận quote overlay vào holdings

Command:
$ grep -n "useRealtimeFeed\|monitoredSymbols\|realtimePortfolioStats" \
  frontend/src/components/DashboardRealtimePanel.jsx
```

**Task 1.4**: Global Search - Zero Websocket Duplication
```
Tests:
1. WebSocket constructor
   $ grep -r "new WebSocket" frontend/src --exclude-dir=hooks
   Expected: 0 results (all in useRealtimeFeed.js only)

2. Socket message handlers
   $ grep -r "\.onmessage\|\.onopen\|\.onclose\|\.onerror" frontend/src
   Expected: 0 results outside hooks

3. Polling logic
   $ grep -r "setInterval" frontend/src --exclude-dir=hooks
   Expected: 0 results (all in useRealtimeFeed.js)

4. Fetch ticker/realtime
   $ grep -r "getRealtimeTicker\|getRealtimeWebSocketUrl" frontend/src
   Expected: only in useRealtimeFeed.js and consumer usage

Result Document:
├─ WebSocket search: ✅ Pass (0 outside hooks)
├─ Message handlers: ✅ Pass (0 outside hooks)
├─ Polling logic: ✅ Pass (0 outside hooks)
└─ API calls: ✅ Pass (correct usage pattern)
```

**Deliverable Day 1:**
```
📋 VERIFICATION_REPORT_DAY1.md
├─ Watchlist consolidation: ✅ VERIFIED
├─ Dashboard consolidation: ✅ VERIFIED
├─ Zero websocket duplication: ✅ VERIFIED
├─ Subscription patterns: ✅ VERIFIED
└─ Cleanup logic: ✅ VERIFIED
```

---

### **Day 2: 2026-04-03 (Thursday)**
**Focus**: Observability Metrics - Thêm event tracking & debug UI

#### Morning (09:00 - 12:00)
**Task 2.1**: Modify useRealtimeFeed.js - Event Counters
```
Files to modify:
$ backend/src/hooks/useRealtimeFeed.js

Changes (+40 lines):
├─ Add state: const [eventCounts, setEventCounts] = useState({
│    ticker_update: 0,
│    whale_alert: 0,
│    heartbeat: 0,
│    reconnect_attempts: 0
│  })
│
├─ Add tracking in socket.onmessage:
│  if (payload.event_type === 'ticker_update') {
│    setEventCounts(prev => ({ ...prev, ticker_update: prev.ticker_update + 1 }))
│  }
│  if (payload.event_type === 'whale_alert') {
│    setEventCounts(prev => ({ ...prev, whale_alert: prev.whale_alert + 1 }))
│  }
│  if (payload.event_type === 'heartbeat') {
│    setEventCounts(prev => ({ ...prev, heartbeat: prev.heartbeat + 1 }))
│  }
│
├─ Add reconnect counter:
│  on socket.onclose, increment reconnect_attempts
│
└─ Export metrics:
  return {
    ...,
    metrics: { eventCounts, reconnectAttempts }
  }

Testing:
$ npm run build
$ Verify: No TypeScript errors
$ Verify: Hook still works in Watchlist & Dashboard
```

#### Afternoon (13:00 - 18:00)
**Task 2.2**: Modify useRealtimeFeed.js - Latency Tracking
```
Changes (+20 lines):
├─ Add state: const [lastLatencyMs, setLastLatencyMs] = useState(0)
│
├─ In socket.onmessage, if payload has ts field:
│  const receivedTs = new Date().getTime()
│  const publishedTs = new Date(payload.ts).getTime()
│  const latency = receivedTs - publishedTs
│  setLastLatencyMs(latency)
│
└─ Export:
  return {
    ...,
    metrics: { eventCounts, reconnectAttempts, lastLatencyMs }
  }

Testing:
$ npm run build
$ Open DevTools console
$ Verify: No errors
```

**Deliverable Day 2:**
```
✅ Modified files:
├─ frontend/src/hooks/useRealtimeFeed.js (+60 lines)
└─ Metrics exported: eventCounts, reconnectAttempts, lastLatencyMs

✅ Verification:
├─ npm run build: Success
├─ No TypeScript errors
└─ Hook still works in both consumers
```

---

### **Day 3: 2026-04-04 (Friday)**
**Focus**: Debug Panel - Optional visualization component

#### Morning & Afternoon (Full day)
**Task 3.1**: Create RealtimeDebugPanel.jsx
```
File to create:
$ frontend/src/components/RealtimeDebugPanel.jsx (NEW)

Requirements (150 lines):
├─ Import useRealtimeFeed context/context (or pass as prop)
├─ Only render when URL has ?debug=realtime param
├─ Position: Fixed bottom-right corner (z-index: 9999)
├─ Show:
│  ├─ Status: live | connecting | polling | idle
│  ├─ Event counts (ticker, whale, heartbeat, reconnect)
│  ├─ Last latency: 1.2s
│  ├─ Connection timeline: [live →60s] [polling →3s] [live]
│  ├─ Last 5 events log: [timestamp] [type] [symbol]
│  └─ Close button (X)
│
├─ Styling:
│  ├─ Background: dark gray with opacity
│  ├─ Font: small (11px)
│  ├─ Good readability in dark theme
│  └─ Don't show on mobile (optional)
│
└─ React hook: useEffect to monitor URL param

Code sketch:
---
export default function RealtimeDebugPanel() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('debug') !== 'realtime') return null
  
  const { metrics, realtimeStatus, lastEventAt } = // get from somewhere
  
  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {/* Panel content */}
    </div>
  )
}
---

Testing:
$ npm run build
$ Open http://localhost:3000?debug=realtime
$ Verify: Panel shows, metrics visible
$ Check: metrics.eventCounts increments as events come
```

**Task 3.2**: Integrate debug panel into Watchlist
```
File to modify:
$ frontend/src/pages/Watchlist.jsx

Changes:
├─ Import RealtimeDebugPanel
├─ Add before closing </div>:
│  <RealtimeDebugPanel />
│
└─ Testing:
  $ npm start
  $ Navigate to Watchlist
  $ Add ?debug=realtime to URL
  $ Panel should appear bottom-right
```

**Deliverable Day 3:**
```
✅ New files:
├─ frontend/src/components/RealtimeDebugPanel.jsx (150 lines)
└─ Integrated into Watchlist

✅ Verification:
├─ npm run build: Success
├─ http://localhost:3000/watchlist?debug=realtime: Panel visible
├─ Event counts incrementing as quotes update
└─ No TypeScript/compilation errors
```

---

### **Day 4: 2026-04-05 (Saturday)**
**Focus**: Manual Testing - Fallback & Reconnect Behavior

#### Morning (09:00 - 12:00)
**Task 4.1**: Test WebSocket → Polling Fallback
```
Prerequisite:
├─ npm start (frontend running)
├─ Backend running on port 8000
└─ Open Chrome DevTools (F12)

Test Steps:
1. Navigate to: http://localhost:3000/watchlist
2. Open DevTools Network tab
3. Verify status showing "Realtime đang chạy" (live)
4. Look for: WebSocket connection (wss://...)
5. Observe: Quotes updating every 5s

6. DevTools → Network → Right-click WebSocket → Disconnect
7. Observe in UI:
   ├─ Status → "Đang kết nối" (connecting)
   ├─ Wait 20s
   ├─ Should change to "Fallback polling"
   └─ Check Network tab for HTTP GET /api/realtime/ticker/*

8. In console:
   $ // Watch for polling requests every 15s
   $ // Should see: GET /api/realtime/ticker/VNM 200
```

#### Afternoon (13:00 - 18:00)
**Task 4.2**: Test Reconnect After Network Recovery
```
Prerequisites:
├─ WebSocket currently disconnected / polling
├─ Network throttle applied in DevTools
└─ Console open to see logs

Test Steps:
1. Remove WebSocket disconnect (Network tab reset)
2. Observe:
   ├─ Status → "Đang kết nối" (connecting)
   ├─ After ~3s → "Realtime đang chạy" (live)
   └─ HTTP polling stops (no more GET requests)

3. Verify quotes resume updating via WebSocket

Result:
├─ ✅ Reconnect works
├─ ✅ Status transitions correct
├─ ✅ Polling stops automatically
└─ ✅ Quotes update live again
```

**Task 4.3**: Stale Detection Test
```
Prerequisite:
├─ DevTools Network throttle to "Slow 3G"
└─ Open DashboardRealtimePanel (if integrated)

Test Steps:
1. Check initial stalePositions count: 0
2. Wait 20s with throttle active
3. Observe:
   ├─ No new quotes coming
   ├─ Dashboard stalePositions counter increases
   ├─ Quote rows show "Stale" badge
   └─ Color change (amber warning)

4. Remove throttle
5. Observe:
   ├─ Stale badge disappears after 1-2 events
   └─ stalePositions counter decreases

Result:
├─ ✅ Stale detection triggers at ~20s
├─ ✅ Visual indicator correct
└─ ✅ Recovery works after network restore
```

**Deliverable Day 4:**
```
✅ Test Results:
├─ Fallback polling: ✅ PASS
├─ Reconnect after 3s: ✅ PASS
├─ Stale detection: ✅ PASS
└─ Status transitions: ✅ PASS

📋 TEST_LOG_DAY4.md
├─ Screenshots of each test
├─ Timing observations
└─ Any issues found (if any)
```

---

### **Day 5: 2026-04-06 (Sunday)**
**Focus**: Redis-backed Environment Validation

#### Morning (09:00 - 12:00)
**Task 5.1**: Backend Redis Setup
```
Prerequisites:
├─ Redis server running locally
├─ Check: redis-cli ping
│ └─ Expected: PONG
│
└─ Backend .env settings:
  ├─ REALTIME_ENABLED=true
  ├─ REALTIME_CHANNEL_LAYER=redis
  ├─ CELERY_BROKER_URL=redis://localhost:6379/0
  └─ REDIS_URL=redis://localhost:6379/0

Verification:
$ # Start backend with Redis
$ cd backend
$ python manage.py runserver 0.0.0.0:8000
$ # Check logs for Redis connection

$ # In separate terminal, check Redis
$ redis-cli PING
$ # Expected: PONG

$ # Verify Celery collector running (if Beat enabled)
$ celery -A config worker -l info --without-mingle --without-gossip
```

#### Afternoon (13:00 - 18:00)
**Task 5.2**: End-to-End Data Flow Test
```
Test Setup:
├─ Frontend Watchlist open
├─ Backend running with REALTIME_CHANNEL_LAYER=redis
├─ Redis running
└─ Terminal with redis-cli SUBSCRIBE ready

Test Steps:
1. Terminal 1: Monitor Redis channels
   $ redis-cli SUBSCRIBE 'ticker:*'
   
2. Frontend: Navigate to Watchlist

3. Observe:
   ├─ Quotes updating every 5s in UI
   ├─ Terminal 1 shows messages:
   │  {
   │    "event_type": "ticker_update",
   │    "symbol": "VNM",
   │    "data": {"price": 12345, ...},
   │    "ts": "2026-04-06T..."
   │  }
   └─ Message every 5s per symbol

4. Measure latency:
   ├─ Backend: Add console.log on publish_ts
   ├─ Frontend: Add console.log on received_ts
   ├─ Calculate delta
   ├─ Expected: p95 < 1500ms
   └─ Log results

Test Result:
├─ ✅ Quotes updating every 5s
├─ ✅ Redis messages visible
├─ ✅ p95 latency < 1.5s
└─ ✅ No errors in logs
```

**Task 5.3**: Whale Alert Integration Test
```
Prerequisites:
├─ Backend management command to trigger whale alert
└─ Frontend Dashboard open

Test Steps:
1. Backend: Trigger whale alert
   $ python manage.py shell
   $ from portfolio.tasks import publish_whale_alert
   $ publish_whale_alert('VNM', 'BUY', '100000000')

2. Frontend: Check DashboardRealtimePanel
   ├─ Should see alert appear in "Whale alerts gần nhất"
   ├─ Check: symbol, side, matched_value, threshold

3. Verify: Alert details correct

Result:
├─ ✅ Whale alert triggered
├─ ✅ Alert appeared in UI
└─ ✅ Data display correct
```

**Deliverable Day 5:**
```
✅ Environment:
├─ Redis: Running ✅
├─ Backend: Connected to Redis ✅
├─ Frontend: Receiving data ✅

✅ Measurements:
├─ Quote frequency: 5s ✅
├─ p95 latency: < 1.5s ✅
├─ Whale alert flow: Working ✅
└─ No error logs ✅
```

---

### **Day 6: 2026-04-07 (Monday)**
**Focus**: QA & Regression Testing

#### Morning (09:00 - 12:00)
**Task 6.1**: Browser Compatibility Testing
```
Browsers to test:
├─ Chrome (latest): Open Watchlist page
│  ├─ Verify quotes updating
│  ├─ Verify status badge correct
│  ├─ Verify no console errors
│  └─ Result: ✅ PASS
│
├─ Firefox (latest): Same as Chrome
│  └─ Result: ✅ PASS
│
└─ Safari (if available): Same as Chrome
   └─ Result: ✅ PASS

Device sizes to test:
├─ Desktop (1920x1080)
├─ Tablet (768x1024)
└─ Mobile (375x667)

For each browser/size:
├─ Check layout responsive
├─ Check quotes visible
├─ Check no layout breaks
└─ Check performance (no lag)
```

#### Afternoon (13:00 - 18:00)
**Task 6.2**: Regression Testing
```
Test cases:

1. Watchlist functionality
   ├─ [TEST] Price updates visible
   ├─ [TEST] Realtime status badge
   ├─ [TEST] Price alert triggering
   └─ [TEST] Manual sync button still works

2. Dashboard functionality
   ├─ [TEST] Portfolio realtime stats calculate
   ├─ [TEST] Holdings market value updates
   ├─ [TEST] P/L realtime calculation
   ├─ [TEST] Stale position detection
   └─ [TEST] Whale alerts show correct data

3. Core features
   ├─ [TEST] Stock workspace routes still work
   ├─ [TEST] Navigation between pages
   ├─ [TEST] Login/logout flow
   └─ [TEST] Admin sync functionality

4. Edge cases
   ├─ [TEST] Empty watchlist behavior
   ├─ [TEST] Network disconnect recovery
   ├─ [TEST] Browser tab inactive/active
   └─ [TEST] Refresh page state preservation
```

**Deliverable Day 6:**
```
✅ Browser Tests:
├─ Chrome: ✅ PASS
├─ Firefox: ✅ PASS
├─ Safari: ✅ PASS
├─ Mobile: ✅ PASS

✅ Regression Tests:
├─ 20/20 test cases: ✅ PASS
├─ No new bugs found: ✅ PASS
└─ Performance acceptable: ✅ PASS
```

---

### **Day 7: 2026-04-08 (Tuesday)**
**Focus**: Light Load Test & Final Preparation

#### Morning (09:00 - 12:00)
**Task 7.1**: Light Scale Test
```
Objective: Test system with ~50 symbols

Steps:
1. Add 40+ symbols to Watchlist
   ├─ Manually add from Securities Groups
   └─ Or add via API script

2. Monitor metrics:
   ├─ CPU usage: Should stay < 30%
   ├─ Memory: No leaks over 5 minutes
   ├─ WebSocket message frequency: 5s * 50 symbols
   └─ UI responsiveness: No lag

3. DevTools Performance tab:
   ├─ Record 1 minute of activity
   ├─ Check frame rate: Should be ~60fps
   └─ Analyze bottlenecks if any

Result:
├─ ✅ No performance degradation
├─ ✅ UI responsive
├─ ✅ No memory leaks
└─ ✅ System handles 50+ symbols
```

#### Afternoon (13:00 - 18:00)
**Task 7.2**: Documentation & Cleanup
```
1. Code cleanup:
   ├─ Remove any debug console.logs
   ├─ Run prettier: npm run format
   ├─ Check for unused imports
   └─ Fix any linting warnings

2. Update docs:
   ├─ Update SPRINT12_BU0C16_PREPARATION.md (mark done)
   ├─ Add Day 1-7 outcomes
   ├─ Update ROADMAP_STATUS.md:
   │  ├─ Bước 16: COMPLETE ✅
   │  └─ Next: Bước 17
   └─ Create SPRINT12_BU0C16_HANDOFF.md

3. Final verification:
   ├─ $ npm run lint (if configured)
   ├─ $ npm run build
   └─ All tests pass

4. Prepare for Bước 17:
   ├─ Review ADMIN_UI_IMPLEMENTATION_STEPS.md Bước 17
   ├─ Identify API changes needed
   ├─ Create SPRINT12_BU0C17_PREPARATION.md
   └─ List tasks for next sprint
```

**Deliverable Day 7:**
```
✅ Code:
├─ Cleaned ✅
├─ Built successfully ✅
└─ No linting errors ✅

✅ Documentation:
├─ Updated ✅
├─ Handoff guide ready ✅
└─ Bước 17 prep started ✅

✅ Status:
├─ Bước 16: COMPLETE ✅
├─ Sprint 12: Ready for next phase ✅
└─ Ready to start Bước 17 ✅
```

---

## 📊 SUMMARY BY DAY

```
┌───────────┬─────────────────┬──────────────────┬────────────────┐
│ Day       │ Focus           │ Key Deliverable  │ Status         │
├───────────┼─────────────────┼──────────────────┼────────────────┤
│ Apr 2     │ Verification    │ VERIFIED report  │ ✅ Code Review │
│ Apr 3     │ Observability   │ Metrics + Debug  │ ✅ Implement   │
│ Apr 4     │ Manual Testing  │ Fallback/Reconn  │ ✅ Test Pass   │
│ Apr 5     │ Redis Validation│ Redis-backed OK  │ ✅ Measure p95 │
│ Apr 6     │ QA Testing      │ All tests pass   │ ✅ Regression  │
│ Apr 7     │ Scale + Cleanup │ Ready for Prod   │ ✅ Load test   │
│ Apr 8     │ Handoff + Prep  │ Bước 17 ready    │ ✅ Sign-off    │
└───────────┴─────────────────┴──────────────────┴────────────────┘
```

---

## 🎯 SUCCESS CRITERIA (Checklist)

### Code Quality
- [ ] Zero WebSocket duplication outside useRealtimeFeed.js
- [ ] Watchlist & Dashboard using same hook
- [ ] npm run build succeeds (no TypeScript errors)
- [ ] No linting errors

### Observability
- [ ] Event counters working (ticker, whale, heartbeat)
- [ ] Latency tracking implemented
- [ ] Debug panel shows metrics correctly
- [ ] ?debug=realtime parameter working

### Functionality
- [ ] Fallback polling activates when socket disconnects
- [ ] Auto-reconnect works after 3s
- [ ] Stale indicator shows after 20s
- [ ] Whale alerts trigger and display

### Performance
- [ ] p95 publish→push latency < 1.5s (Redis-backed)
- [ ] No memory leaks over 5 minutes
- [ ] CPU usage < 30% with 50+ symbols
- [ ] 60fps UI responsiveness

### Testing
- [ ] Browser compatibility (Chrome, Firefox, Safari)
- [ ] Mobile responsive ✅
- [ ] All regression tests pass
- [ ] Light scale test (50+ symbols) passes

### Documentation
- [ ] VERIFIED_REPORT created
- [ ] TEST_LOGs created
- [ ] ROADMAP_STATUS updated
- [ ] Bước 17 prep document created

---

## 🚀 HOW TO START TODAY (2026-04-02)

### Morning Checklist
1. Open [SPRINT12_BU0C16_CHECKLIST.md](../sprint12_bu0c16_checklist/SPRINT12_BU0C16_CHECKLIST.md)
2. Start Task 1.1: Code review Watchlist (lines 100-400)
3. Use provided commands for verification
4. Document findings in notes

### Quick Commands to Verify Now
```bash
# Verify hook exists
test -f frontend/src/hooks/useRealtimeFeed.js && echo "✅ Hook ready"

# Verify Watchlist uses hook
grep "useRealtimeFeed" frontend/src/pages/Watchlist.jsx && echo "✅ Watchlist uses hook"

# Verify Dashboard uses hook
grep "useRealtimeFeed" frontend/src/components/DashboardRealtimePanel.jsx && echo "✅ Dashboard uses hook"

# Quick build test
npm run build 2>&1 | tail -5
```

### Expected Output
```
✅ Hook ready
✅ Watchlist uses hook
✅ Dashboard uses hook
Compiled successfully. File sizes above gzip are new.
```

---

## 📞 TRACKING & UPDATES

**Daily standup checklist:**
```
Day X - 09:00 AM:
├─ [ ] Read yesterday's deliverable
├─ [ ] Check todo list status
├─ [ ] Note any blockers
└─ [ ] Start first task

Day X - 05:00 PM:
├─ [ ] Complete all tasks
├─ [ ] Document findings
├─ [ ] Update todo status
└─ [ ] Prepare summary for next day
```

**When stuck:**
1. Check this document (SPRINT12_BU0C16_IMPLEMENTATION_PLAN.md)
2. Review [SPRINT12_BU0C16_CHECKLIST.md](../sprint12_bu0c16_checklist/SPRINT12_BU0C16_CHECKLIST.md) for task details
3. Check [SPRINT12_BU0C16_PREPARATION.md](../sprint12_bu0c16_preparation/SPRINT12_BU0C16_PREPARATION.md) for troubleshooting
4. Review browser console / backend logs

---

**Created**: 2026-04-01  
**Valid from**: 2026-04-02  
**Target completion**: 2026-04-08  
**Next phase**: Bước 17 (P/L Realtime Dashboard)
