# Audit: Real-time Heatmap & Daily Price Fix Analysis

**Date:** 2026-06-15  
**Analyst:** BlackboxAI  
**Status:** Plan Documented - Awaiting Implementation

---

## 1. Executive Summary

This audit analyzes the root cause of why real-time WebSocket feeds are not reaching the Dashboard Heatmap (Treemap) and Stock Detail pages (Daily Price + KLineChart) in the SaaS Native frontend (`packages/web`). The analysis confirms the issues described in `IMPLEMENTATION_PLAN_FIX_REALTIME_HEATMAP_DAILY_PRICE_20260615.md` and provides detailed code-level findings.

---

## 2. Root Cause Analysis

### 2.1 DashboardPage.js — Heatmap (Treemap)

| Finding | Details |
|---------|---------|
| **Current State** | Receives `quotesBySymbol` and `realtimeBreadth` as props from parent `PackageDashboardHost` |
| **Problem** | Props are often empty/null because parent doesn't subscribe to WebSocket feed |
| **Data Flow** | `useCoreDashboardData` hook fetches holdings/watchlists via REST API only — no WebSocket subscription |
| **Symbols Available** | Exports `collectUniqueSortedSymbols` function to aggregate all tracked symbols |

**Code Evidence:**
```js
// DashboardPage.js already has this helper:
export const collectUniqueSortedSymbols = (holdings, trackedSymbols, watchlists, watchlistGroups) => {
  // Returns pipe-delimited symbol string, e.g. "ACB|CTG|FPT|VNM"
};
```

**Conclusion:** DashboardPage doesn't subscribe to real-time feed internally — relies on parent passing data that never arrives.

---

### 2.2 useStockDetailPageModel.js — Stock Detail Header & Tabs

| Finding | Details |
|---------|---------|
| **Current State** | Fetches `snapshot` via REST API (`getStockOverview`) once on symbol change |
| **Problem** | Has `handleRealtimeSnapshot` function with 250ms throttling, but it's **never called** |
| **Root Cause** | Model doesn't subscribe to WebSocket feed — `handleRealtimeSnapshot` is a dead code |
| **Expected Behavior** | When quote ticks arrive via WebSocket, forward to `handleRealtimeSnapshot` to update header |

**Code Evidence:**
```js
// useStockDetailPageModel.js — handleRealtimeSnapshot exists but is unused:
const handleRealtimeSnapshot = useCallback((nextSnapshot) => {
  // 250ms batched update logic — never invoked
}, []);
```

**Conclusion:** The throttling infrastructure is ready but disconnected from the real-time feed source.

---

### 2.3 VNStockChartPanel.js — KLineChart Live Updates

| Finding | Details |
|---------|---------|
| **Current State** | Uses `CoreApiChartAdapter` class to fetch historical bars |
| **Problem** | `subscribeToBar(symbol, timeframe, onBar)` returns empty function `() => {}` |
| **Root Cause** | WebSocket subscription is stubbed out, no actual tick-to-candle conversion |

**Code Evidence:**
```js
// VNStockChartPanel.js — CoreApiChartAdapter class:
subscribeToBar(symbol, timeframe, onBar) {
  return () => {};  // Stub — doesn't connect to WebSocket
}
```

**Conclusion:** The chart adapter has the subscription interface but no implementation.

---

## 3. Infrastructure Available (Already Built)

The system already has the necessary real-time feed infrastructure:

| Component | Location | Status |
|-----------|----------|--------|
| `RealtimeProvider` | `packages/web/src/context/RealtimeContext.js` | ✅ Provided in app root |
| `useRealtimeFeedFromManager` | Same file | ✅ Exports hook for component subscription |
| `handleRealtimeSnapshot` | `useStockDetailPageModel.js` | ✅ Has 250ms batching logic |
| `collectUniqueSortedSymbols` | `DashboardPage.js` | ✅ Helper function exported |

---

## 4. Proposed Implementation Plan

### 4.1 Step 1: DashboardPage.js — Integrate Real-time Feed

**File:** `packages/web/src/pages/DashboardPage.js`

**Changes:**
1. Import `useRealtimeFeedFromManager` from `../context/RealtimeContext.js`
2. Use `collectUniqueSortedSymbols` to get symbol list from holdings/watchlists
3. Call `useRealtimeFeedFromManager({ symbols: normalizedSymbols })`
4. Merge `quotesBySymbol` from feed into existing prop
5. Compute `realtimeBreadth` from real-time quote changes (up/down/flat counts)

**Code Pattern:**
```js
import { useRealtimeFeedFromManager } from "../context/RealtimeContext.js";

// Inside component:
const symbolString = collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, watchlistGroups);
const symbols = symbolString.split("|");
const realtimeFeed = useRealtimeFeedFromManager({ symbols, pollInterval: 10000 });

// Merge real-time quotes
const mergedQuotes = { ...quotesBySymbol, ...realtimeFeed?.quotesBySymbol };
```

---

### 4.2 Step 2: useStockDetailPageModel.js — Connect Realtime Snapshot

**File:** `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js`

**Changes:**
1. Import `useRealtimeFeedFromManager` from context
2. Call `useRealtimeFeedFromManager({ symbols: [symbol] })` when symbol is valid
3. Use `useEffect` to watch for quote changes in the feed
4. Forward new quotes to existing `handleRealtimeSnapshot(quote)` function

**Code Pattern:**
```js
import { useRealtimeFeedFromManager } from "../../../context/RealtimeContext.js";

// Inside hook:
const realtimeFeed = useRealtimeFeedFromManager({ 
  symbols: symbol ? [symbol] : [],
  pollInterval: 5000 
});

// Forward real-time updates to snapshot handler
useEffect(() => {
  if (realtimeFeed?.quotesBySymbol?.[symbol]) {
    const quote = realtimeFeed.quotesBySymbol[symbol];
    handleRealtimeSnapshot(quote);
  }
}, [realtimeFeed, symbol]);
```

---

### 4.3 Step 3: VNStockChartPanel.js — Enable Live Candlestick Updates

**File:** `packages/web/src/components/VNStockChartPanel.js`

**Changes:**
1. Modify `CoreApiChartAdapter.subscribeToBar` to store callback:
   ```js
   subscribeToBar(symbol, timeframe, onBar) {
     this.onBarCallback = onBar;
     return () => { this.onBarCallback = null; };
   }
   ```
2. Import and use `useRealtimeFeedFromManager` in component
3. When new quote arrives, convert to OHLCV bar format and call callback

**Code Pattern:**
```js
// Inside VNStockChartPanel component:
const realtimeFeed = useRealtimeFeedFromManager({ 
  symbols: symbol ? [symbol] : [] 
});

useEffect(() => {
  if (quote && chartAdapter.onBarCallback) {
    const nextBar = {
      date: new Date(quote.last_date || Date.now()),
      open: Number(quote.open_price ?? quote.current_price),
      high: Number(quote.high_price ?? quote.current_price),
      low: Number(quote.low_price ?? quote.current_price),
      close: Number(quote.current_price),
      volume: Number(quote.volume ?? 0),
    };
    chartAdapter.onBarCallback(nextBar);
  }
}, [quote, chartAdapter]);
```

---

## 5. Files to Edit

| Priority | File Path | Changes |
|----------|-----------|---------|
| P1 | `packages/web/src/pages/DashboardPage.js` | Import hook, subscribe to feed, merge quotes, compute breadth |
| P2 | `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js` | Import hook, subscribe to symbol, forward to handler |
| P3 | `packages/web/src/components/VNStockChartPanel.js` | Enable callback storage, subscribe to feed, convert ticks to bars |

---

## 6. Testing Strategy

### 6.1 Unit Tests
- Verify `useRealtimeFeedFromManager` returns quotes for subscribed symbols
- Verify `handleRealtimeSnapshot` correctly batches updates within 250ms window
- Verify `CoreApiChartAdapter.subscribeToBar` stores and clears callback properly

### 6.2 Integration Tests
- Dashboard: Observe Treemap cells flashing on price change
- Stock Detail: Observe header price/ceiling/floor/volume updating live
- Chart: Observe current candle extending in real-time

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| Excessive re-renders | Medium | High | Keep 250ms throttling already in place |
| Memory leaks | Low | Medium | Cleanup callbacks on unmount |
| Race conditions | Low | Low | Use refs for latest values |

---

## 8. Dependencies

- **Internal:** `RealtimeContext.js` — already provides all needed infrastructure
- **No external packages required**

---

## 9. Success Criteria

- [ ] Dashboard Treemap shows live price updates (color flashing)
- [ ] Stock Detail header shows live price/ceiling/floor/volume
- [ ] KLineChart current candle extends in real-time
- [ ] No excessive re-renders (maintain < 60fps)
- [ ] All existing tests pass

---

## 10. Follow-up Actions

1. **Implement Step 1** — DashboardPage.js real-time integration
2. **Implement Step 2** — useStockDetailPageModel.js snapshot updates
3. **Implement Step 3** — VNStockChartPanel.js live candlestick
4. **Run tests** — Verify no regressions
5. **Manual verification** — Observe live updates in browser

---

**Audit Complete.** Implementation can proceed based on this plan.
