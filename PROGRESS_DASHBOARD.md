# 🎯 SPRINT 12 BƯỚC 16 - PROGRESS DASHBOARD
**Date**: 2026-04-03  
**Status**: Day 2 - Core implementation complete, validation in progress ✅

---

## 🚀 LATEST UPDATE (2026-04-16 ~17:15)

### ⚡ PRICE UNIT CANONICAL REFACTOR - PHASES 0-8 COMPLETE ✅

**Problem Fixed:** Data poisoning from inconsistent quote prices (26,600 | 0.00 | 23.80 in same table)

**Root Cause:** Backend declared `_SYSTEM_PRICE_UNIT='VND'` but system expected `THOUSAND_VND`. Prices from different sources (vnstock KBS/VCI, realtime snapshot, intraday tick) arrived in different units. Frontend created 3 separate heuristic normalization functions to reverse-engineer correct unit.

**Solution Architecture:** 
- Phase 0: New canonical module (`price_units.py`) with QuotePrice dataclass and conversion helpers
- Phase 1: Adapter standardization - ALL adapter outputs now guarantee THOUSAND_VND unit with metadata seal
- Phase 2: Services layer correction - `_SYSTEM_PRICE_UNIT` fixed to `THOUSAND_VND`, integrated in `fetch_and_save_daily_prices`
- Phase 3: Market data service - deprecate unit heuristic, keep backward-compatible identity scale
- Phase 4: Realtime collector - remove `* 0.001`, trust canonical price from adapter
- Phase 5: Tasks prefetch - canonical unit guard comments and safer assumptions
- Phase 6: Frontend cleanup - remove/neutralize heuristic normalization in Watchlist, Dashboard, StockDetail
- Phase 7: Optional historical migration command executed (`finalize_price_unit_migration --force`), post-check clean
- Phase 8: Final audit documentation completed

**Files Modified (Core):**
- ✅ `backend/portfolio/price_units.py` (NEW - 284 lines, 40 tests)
- ✅ `backend/portfolio/adapters/vnstock_adapter.py` (+150 lines, 8 tests)
- ✅ `backend/portfolio/services.py` (+60 lines)
- ✅ `backend/portfolio/market_data_service.py` (heuristic deprecated)
- ✅ `backend/portfolio/realtime/collector.py` (scale factor removed)
- ✅ `backend/portfolio/tasks_prefetch.py` (canonical guard comments)
- ✅ `backend/portfolio/management/commands/finalize_price_unit_migration.py` (NEW - phase 7 command)
- ✅ `frontend/src/pages/Watchlist.jsx` (watchlist heuristic removed)
- ✅ `frontend/src/utils/dashboardRealtimeSelectors.js` (dashboard heuristic removed)
- ✅ `frontend/src/pages/StockDetail.jsx` (normalize helpers removed, replaced by `finiteNumberOrNull`)
- ✅ 2 new test suites: 48/48 tests passing
- ✅ `AUDIT_PRICE_UNIT_CANONICAL_PHASE1_20260416.md` (phase 0-1 audit)
- ✅ `AUDIT_PRICE_UNIT_CANONICAL_PHASE2_6_20260416.md` (phase 2-6 audit)
- ✅ `PROGRESS_DASHBOARD_CANONICAL_UPDATE_20260416.md` (executive update)
- ✅ `RELEASE_SNAPSHOT_PRICE_UNIT_CANONICAL_20260416.md` (release snapshot for QA sign-off)

**Status:** 
- Phase 0: ✅ COMPLETE
- Phase 1: ✅ COMPLETE
- Phase 2: ✅ COMPLETE
- Phase 3: ✅ COMPLETE
- Phase 4: ✅ COMPLETE
- Phase 5: ✅ COMPLETE
- Phase 6: ✅ COMPLETE
- Phase 7: ✅ COMPLETE (force migration executed, suspicious records now 0)
- Phase 8: ✅ COMPLETE

**Validation:**
- ✅ Backend tests: 48/48 passing
- ✅ Frontend build: success
- ✅ Phase 7 dry-run (pre): scope 71,655 rows, suspicious >1000: 71,288 rows
- ✅ Phase 7 apply: `manage.py finalize_price_unit_migration --force` updated 71,288 rows
- ✅ Phase 7 dry-run (post): suspicious >1000: 0
- ✅ Git commits: `9154c681`, `1c8b3af0`, `722b225e`, `64234c9c`, `f5e13a88`, `32a6c991`, `64f9b1a0`, `235ed347`

**Token Budget:** ~150k / 200k used

---

## ✅ AUDIT FILE LIST (2026-04-16)

### Price Unit Canonical Refactor (Phases 0-1)
- backend/portfolio/price_units.py (NEW)
- backend/tests/test_price_units_canonical.py (NEW - 40 tests)
- backend/portfolio/adapters/vnstock_adapter.py (MODIFIED)
- backend/tests/test_adapter_canonical.py (NEW - 8 tests)
- backend/portfolio/services.py (MODIFIED)
- AUDIT_PRICE_UNIT_CANONICAL_PHASE1_20260416.md (NEW)

### Price Unit Canonical Refactor (Phases 2-8)
- backend/portfolio/services.py (MODIFIED)
- backend/portfolio/market_data_service.py (MODIFIED)
- backend/portfolio/realtime/collector.py (MODIFIED)
- backend/portfolio/tasks_prefetch.py (MODIFIED)
- backend/portfolio/management/commands/finalize_price_unit_migration.py (NEW)
- frontend/src/pages/Watchlist.jsx (MODIFIED)
- frontend/src/utils/dashboardRealtimeSelectors.js (MODIFIED)
- frontend/src/pages/StockDetail.jsx (MODIFIED - normalize removed)
- backend/CHANGELOG.md (MODIFIED - 2026-04-16 canonical phase summary)
- AUDIT_PRICE_UNIT_CANONICAL_PHASE2_6_20260416.md (NEW)
- PROGRESS_DASHBOARD_CANONICAL_UPDATE_20260416.md (NEW)
- RELEASE_SNAPSHOT_PRICE_UNIT_CANONICAL_20260416.md (NEW)
- PROGRESS_DASHBOARD.md (MODIFIED - status synchronized)

### Ticker Realtime + Offhours Close Accuracy (1+2+3)
- backend/portfolio/runtime_policy_helpers.py
- backend/portfolio/market_calendar.py
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/models.py
- backend/portfolio/migrations/0041_tickersessionclose.py
- backend/portfolio/market_data_service.py
- backend/portfolio/warmup_cache.py
- backend/portfolio/views_admin_runtime.py
- backend/portfolio/tests/test_ticker_prefetch_task.py
- backend/portfolio/tests/test_system_ai_admin_api.py
- backend/CHANGELOG.md
- frontend/src/pages/AdminOps.jsx
- frontend/src/hooks/useRealtimeFeedLegacy.js
- frontend/src/components/DashboardRealtimePanel.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js

### Delta hardening: Market Calendar + Market-local Retention
- backend/portfolio/market_calendar.py
- backend/portfolio/runtime_policy_helpers.py
- backend/portfolio/tasks_prefetch.py
- backend/portfolio/market_data_service.py
- backend/portfolio/warmup_cache.py
- backend/portfolio/tests/test_ticker_prefetch_task.py
- backend/portfolio/tests/test_system_ai_admin_api.py
- frontend/src/pages/AdminOps.jsx
- frontend/src/i18n/vi.js
- frontend/src/i18n/en.js
- backend/CHANGELOG.md

---

## ✅ COMPLETED TODAY (Day 1)

### ✅ Task 1.1: Code Review Watchlist (Lines 100-400)
**Status**: ✅ VERIFIED  
**Key Findings**:
- ✅ Imports hook: `import useRealtimeFeed from '../hooks/useRealtimeFeed'` (Line 15)
- ✅ Aggregates 3 symbol sources correctly
- ✅ Uses hook correctly: `useRealtimeFeed({ symbols: allRealtimeSymbols })`
- ✅ Merges quotes into groups, tracked, alerts
- ✅ Price alert triggering uses realtime data
- ✅ Zero WebSocket logic found

### ✅ Task 1.2: Code Review Dashboard Component
**Status**: ✅ VERIFIED  
**Key Findings**:
- ✅ Imports hook correctly
- ✅ Aggregates holdings + tracked symbols
- ✅ Uses hook: `useRealtimeFeed({ symbols: monitoredSymbols, maxAlerts: 5 })`
- ✅ Calculates portfolio stats from realtime quotes
- ✅ Detects stale positions correctly
- ✅ Zero WebSocket logic found

### ✅ Task 1.3: Global Search - Zero Duplication
**Status**: ✅ VERIFIED  
**Test Results**:
```
new WebSocket        → Only in: hooks/useRealtimeFeed.js ✅
.onmessage           → Only in: hooks/useRealtimeFeed.js ✅
.onopen              → Only in: hooks/useRealtimeFeed.js ✅
.setInterval (poll)  → Only in: hooks/useRealtimeFeed.js ✅

WebSocket duplication: ZERO ✅
```

**Command Evidence**:
```powershell
# Search result - only 1 file
C:\Mujoco Projects\vninvest\frontend\src\hooks\useRealtimeFeed.js
```

---

## 📊 CONSOLIDATION VERIFIED

| Component | Status | Notes |
|-----------|--------|-------|
| **Watchlist.jsx** | ✅ DONE | Uses hook, 0 websocket logic |
| **Dashboard** | ✅ DONE | Uses hook, 0 websocket logic |
| **useRealtimeFeed.js** | ✅ DONE | 243 lines, all logic centralized |
| **Global duplication** | ✅ ZERO | 100% consolidated |
| **Quote merging** | ✅ DONE | 2 consumers working correctly |
| **API calls** | ✅ CENTRALIZED | Only in hook |

---

## ✅ LATEST DELTA (Day 2)

### Advisory + Plan Gating
- ✅ Added `/api/auth/me/` consumption into frontend ability context
- ✅ Added CASL-gated route `/whale-advisory`
- ✅ Added upgrade fallback route `/upgrade`
- ✅ Added advisory feed UI with Premium-only detail masking

### Validation
- ✅ `npm run build` passes after advisory UI integration
- ✅ `manage.py test portfolio.tests.test_api_routes` passes (28 tests)
- ✅ Stock workspace smoke test stabilized by mocking vnstock live overlay in test
- ✅ Redis-backed local validation: 4 stream keys / 400 ticks / consumer batch writes 400 `IntradayTick`
- ✅ Advisory backend no longer crashes when `OPENCLAW_API_KEY` is missing
- ✅ `useRealtimeFeed` now sends explicit `unsubscribe` on cleanup and exposes runtime connection metrics for reconnect/fallback QA
- ✅ `manage.py test portfolio.tests.test_realtime_gateway portfolio.tests.test_realtime_compute` passes (6 tests)
- ✅ Market calendar hardening implemented: holiday-aware offhours + market-local retention/offpeak date resolution
- ✅ `VN_STOCK` runtime mặc định tự seed holiday_dates từ calendar `vnstock` năm hiện tại; warmup startup không còn log stacktrace khi DB chưa ready

### User Registration Extension
- ✅ Backend `/api/auth/register/` now requires email and returns JWT for auto-login
- ✅ Frontend auth modal now supports `Dang ky` mode with field-level validation
- ✅ Auto-login after register wired into `PortfolioContext`
- ✅ Backend route suite now passes 15 tests including register cases
- ⏳ Browser smoke QA for `register -> auto-login -> dashboard` still pending

---

## ⏳ REMAINING

### Task 1.4: Verify Subscription Patterns & Cleanup
**Est. Time**: 1.5 hours  
**Action Items**:
- [ ] Verify Watchlist subscription: groups + tracked + alerts
  ```
  Expected: allRealtimeSymbols = [
    ...groups items,
    ...trackedSymbols,
    ...priceAlerts symbols
  ]
  ```
- [ ] Verify Dashboard subscription: holdings + tracked
  ```
  Expected: monitoredSymbols = [
    ...holdings,
    ...trackedSymbols
  ]
  ```
- [ ] Test cleanup on unmount
  ```
  - Close component
  - Verify unsubscribe sent (hook instrumentation implemented)
  - Verify no memory leaks
  ```
- [ ] DevTools Profiler check
  ```
  - Record 30s activity with 50+ symbols
  - Check memory heap: no growth
  - Check CPU: < 30%
  ```

---

## 📋 NEXT STEPS

### Today Evening
- [ ] Complete Task 1.4 (subscription/cleanup)
- [ ] Create final VERIFICATION_REPORT_DAY1.md (already drafted)
- [ ] Update todo list

### Next Focus
**Focus**: Redis-backed validation + runtime QA

- Run Redis-backed checklist
- Browser QA for reconnect/unmount cleanup
- Validate live advisory generation path with Celery + WebSocket
- Measure publish->push latency p95 under browser runtime

---

## 🎯 SUCCESS CRITERIA

### ✅ Already Achieved
- [x] No WebSocket code outside hook
- [x] Watchlist + Dashboard consolidation
- [x] Symbol aggregation working
- [x] Quote overlay correct
- [x] Zero code duplication

### ⏳ Still Need
- [ ] Verify subscription patterns
- [ ] Test memory/cleanup
- [x] Add metrics (Day 2-3)
- [ ] Test fallback/reconnect (Day 4)
- [x] Add reconnect/cleanup observability into shared hook
- [ ] Redis validation (Day 5-6)
- [ ] QA matrix (Day 6-7)

---

## 📈 METRICS

```
Consolidation Progress:
├─ Code review:        ✅ 100% (Watchlist + Dashboard)
├─ Duplication search: ✅ 100% (Zero found)
├─ Metrics panel:      ✅ Implemented
├─ AI advisory gating: ✅ Implemented
├─ Redis streams:      ✅ Local validation pass
├─ Clean build:        ✅ Pass
├─ API smoke suite:    ✅ Pass (28 tests)
├─ Realtime gateway:   ✅ Pass (6 tests)
└─ Runtime QA:         ⏳ Pending

Overall Day 2:         ✅ Core implementation complete
```

---

## 📝 DOCUMENTS CREATED

✅ [VERIFICATION_REPORT_DAY1.md](VERIFICATION_REPORT_DAY1.md) (400 lines)
- Detailed findings per task
- Global search results
- Success criteria checklist

---

## 🚀 QUICK REFERENCE

### Current Status
- **Day**: 1 of 8
- **Progress**: 75% complete
- **Blockers**: None
- **Ready for**: Day 2 work

### Key Files
- `frontend/src/hooks/useRealtimeFeed.js` (243 lines)
- `frontend/src/pages/Watchlist.jsx` (1059 lines)
- `frontend/src/components/DashboardRealtimePanel.jsx` (300 lines)

### Command to Verify
```bash
# Still only one file with WebSocket
Get-ChildItem -Recurse -Include "*.jsx","*.js" | Select-String "new WebSocket"
# Result: Only hooks/useRealtimeFeed.js ✅
```

---

**Last Updated**: 2026-04-03 11:20  
**Next Update**: after Redis-backed validation  
**Target**: close Sprint 12 validation checklist
