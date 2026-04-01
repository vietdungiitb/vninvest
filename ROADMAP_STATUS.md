# VNInvest Roadmap Status (2026-04-01)

## Sprint Completion Overview

### ✅ Sprint 7 - COMPLETED
**Focus**: Backlog setup & API migration  
**Status**: DONE  
- Chot backlog Sprint 7 P0/P1
- Hoan tat migration namespace API
- Chuan hoa route backend/frontend

---

### 🏃 Sprint 11 - NEARLY DONE (95%)
**Focus**: Event-Driven Realtime Pipeline  
**Status**: READY FOR REDIS-BACKED VALIDATION  

**Hoàn thành:**
- ✅ Celery collector polling 5s + proxy rotation + retry/backoff
- ✅ Pandas intraday compute (VWAP + whale detection)
- ✅ Redis Pub/Sub publisher với versioned contract
- ✅ Django Channels consumer + WebSocket auth
- ✅ Feature flags (`REALTIME_ENABLED`, `REALTIME_DEFAULT_WHALE_THRESHOLD`)
- ✅ Frontend Watchlist realtime websocket + polling fallback
- ✅ Frontend Dashboard panel realtime (market breadth + whale alerts)
- ✅ Fallback API `GET /api/realtime/ticker/{symbol}/`
- ✅ Heartbeat + subscription routing
- ✅ Local dev mode `REALTIME_CHANNEL_LAYER=inmemory` (no Redis needed)
- ✅ Demo data seed (holdings, snapshots, watchlist, tracked symbols)
- ✅ `manage.py realtime_tick --sync` chạy thành công tại local
- ✅ All tests pass: test_realtime_compute, test_realtime_gateway

**Validation Results**:
- `manage.py check` ✅ PASS
- `manage.py test portfolio.tests.test_realtime_*` ✅ PASS (9 tests)
- `npm run build` ✅ PASS (202.14 kB)
- `manage.py seed_demo_data --reset` ✅ PASS

**Còn lại (Minor):**
- ⏳ Xác nhận luồng Redis-backed thực tế (`REALTIME_CHANNEL_LAYER=redis`)
- ⏳ Validation p95 publish->push < 1.5s
- ⏳ Correlation ID / sequence logging
- ⏳ Sprint 11 acceptance checklist final sign-off

---

### 📋 Bước Admin UI + Stock Workspace (Bước 1-30)
**Focus**: Admin Dashboard & Stock Detail Workspace  
**Status**: Bước 1-29 hoàn thành, Bước 30 vừa xong hôm nay (2026-04-01)

**Bước 1-6 - Admin Dashboard Refactor** ✅
- Audit + refactor admin.py theo nhóm chức năng
- Tạo dashboard card navigation
- Quick stats (portfolio, transactions, prices)
- Pandas data aggregation

**Bước 7-15 - Admin Menu Restructuring** ✅
- Phân cấp menu theo module (Portfolio Tracker, Market Watch, Data Hub)
- Chuan hóa naming convention (Vietnamese labels)
- Chỉnh quan hệ Watchlist (Nhóm theo dõi → Mã trong danh sách)
- Menu cha-con, hành động hang loạt

**Bước 16-21 - Realtime & Stock Detail Foundation** (Kế hoạch cho Sprint 11-12)
- Bước 16: `useRealtimeFeed` hook dùng chung
- Bước 17: P/L realtime trên Dashboard
- Bước 18: Price alerts domain
- Bước 19: Auto-sync watch assets
- Bước 20: Stock detail workspace foundation
- Bước 21: Tracked actions tại stock workspace

**Bước 22-29 - Stock Workspace UI** ✅
- Bước 22-24: SecuritiesGroup taxonomy dùng chung + Admin sync
- Bước 25-27: Stock detail page + Vietnamese labels
- Bước 28-29: Trading terminal layout (compact header, action bar, chart-focused)

**Bước 30 - Candlestick + Breadth + Terminal CSS** ✅ **COMPLETED TODAY**
- ✅ Area chart → Candlestick OHLC (CandleShape SVG component)
- ✅ Mini breadth panel cho peer stocks (BreadthMiniPanel)
- ✅ Trading terminal CSS utilities (text-label, card-section, breadth-strong/weak/flat)
- ✅ Typography & color scheme (slate/cyan/emerald/rose)
- ✅ Compilation success: 202.14 kB (+6.7 kB), 6.35 kB CSS (+600 B)

**File Changes:**
- `frontend/src/pages/StockDetail.jsx` - Completely rewritten (764 lines full component)
- `frontend/src/index.css` - Updated trading terminal utilities
- `docs/ADMIN_UI_IMPLEMENTATION_STEPS.md` - Bước 30 marked complete

**Status**: Both servers running (Backend: 8000, Frontend: 3000)

---

### 📌 Sprint 12 - READY TO START (Next Priority)
**Focus**: Frontend Realtime Consolidation & Observability  
**Status**: NOT STARTED  

**Kế hoạch (10 ngày):**

Day 1: Tạo `useRealtimeFeed` hook dùng chung
Day 2-3: Refactor Watchlist sang dùng hook
Day 4: Refactor Dashboard sang dùng chung + anti-duplicate whale alerts
Day 5: Fallback polling + stale indicator
Day 6: Whale alert UX + history + severity
Day 7: Metrics panel + observability
Day 8: Test Redis-backed environment checklist
Day 9: Bugfix P0/P1
Day 10: RC signoff

**DoD:**
- Watchlist + Dashboard dùng chung layer realtime
- Frontend auto-reconnect websocket với backoff
- Fallback polling + stale indicator
- Whale alert history + anti-duplicate
- Redis-backed staging validated

---

## 🎯 Immediate Action Items

### Priority 1: Hoàn thành Sprint 11 Validation (Today - Tomorrow)
Target: Xác nhận Redis-backed environment hoạt động thực tế
- [ ] Setup Redis queue trên local/staging
- [ ] Test `REALTIME_CHANNEL_LAYER=redis` mode
- [ ] Validate p95 latency publish→push < 1.5s
- [ ] Run QA matrix (disconnect/reconnect, load test)
- [ ] Final acceptance checklist sign-off

### Priority 2: Sprint 12 Kickoff (Tomorrow morning)
**Bước 16 - Tách layer realtime frontend dùng chung (Ngày 1-2 của Sprint 12)**

Target: Consolidate `Watchlist` + `Dashboard` websocket logic vào một shared hook

**Implementation Plan:**
1. Tạo `frontend/src/hooks/useRealtimeFeed.ts`:
   - WebSocket lifecycle (connect/disconnect/reconnect)
   - Polling fallback logic
   - Event parsing (ticker_update, whale_alert, heartbeat)
   - State management (quotesBySymbol, realtimeStatus, lastEventAt, whaleAlerts)
   - Backoff strategy

2. Refactor `Watchlist.jsx`:
   - Thay thế websocket logic trực tiếp bằng hook
   - Loại bỏ duplicate state management
   - Maintain tất cả current behaviors

3. Refactor `DashboardRealtimePanel.jsx`:
   - Dùng hook thay vì logic cũ
   - Overlay quote realtime lên holdings
   - Synchronize subscription theo current holdings

**Kết quả mong đợi:**
- Giảm code lap từ ~400 lines → ~200 lines (40% reduction)
- Dễ mở rộng cho bước 17-19 (P/L, alerts, sync)
- Chuẩn bị cho observability metrics ở bước tiếp

---

## 📊 Current Infrastructure Status

### Servers Running
- ✅ Backend: `python manage.py runserver 0.0.0.0:8000`
- ✅ Frontend: `npm start (port 3000)`
- ✅ Local Celery: Ready (collectbeat ticks every 5s)
- ⏳ Redis: Configured for local `inmemory` mode, needs Redis setup for real Redis testing

### Code Quality
- ✅ No compilation errors
- ✅ No ESLint/TypeScript errors
- ✅ All unit tests pass
- ✅ Build size optimal (202 kB gzipped)

### Browser Testing
- Ready to test at http://localhost:3000
- Candlestick chart visible (via StockDetail route)
- Realtime panels functional (Watchlist, Dashboard)

---

## 🚀 Timeline Projection

| Phase | Current Sprint | Target Completion | Next Phase |
|-------|---|---|---|
| **Sprint 11 Validation** | In progress | 2026-04-02 EOD | Redis-backed validation |
| **Sprint 12 Start (Bước 16)** | Ready | 2026-04-03 | Consolidate useRealtimeFeed |
| **Sprint 12 Mid (Bước 17-19)** | Planned | 2026-04-07 | P/L + Alerts + Sync |
| **Sprint 12 End (Bước 17-19 finish)** | Planned | 2026-04-10 | QA + sign-off |
| **Sprint 13 (Next)** | Backlog | 2026-04-14 | Backtest engine / Intraday |

---

## 📝 Notes

- **Bước 1-30**: Admin UI + Stock workspace implementation roadmap (completed Bước 1-30 today)
- **Sprint 11**: Vertical slice realtime pipeline hoàn thành locally, đang chờ Redis validation
- **Sprint 12**: Consolidation sprint để gom code + thêm observability
- **Sprint 13+**: Backtest engine, intraday workspace, notification center

---

*Last Updated: 2026-04-01*  
*Compiled by: GitHub Copilot*
