# Audit Verification Report: Real-time Heatmap & Daily Price Fix

**Date:** 2026-06-15  
**Status:** Codebase Audited & Verified  
**Target:** [AUDIT_REALTIME_HEATMAP_DAILY_PRICE_FIX_ANALYSIS_20260615.md](file:///c:/Mujoco%20Projects/vninvest/docs/AUDIT_REALTIME_HEATMAP_DAILY_PRICE_FIX_ANALYSIS_20260615.md)

---

## 1. Executive Summary

This report confirms that the code analysis and findings presented in the audit document are **100% correct**. The components on the Dashboard (Heatmap/Treemap, Market Breadth stats) and the Stock Detail Page (header snapshot, live KLineChart candle updates) do not update in real-time due to missing integrations with the workspace's WebSocket manager (`RealtimeProvider`).

---

## 2. Key Findings & Code Evidence

### 2.1 Dashboard Page (`DashboardPage.js`)
- **Finding:** Props `quotesBySymbol` and `realtimeBreadth` are received but are empty because the parent route does not hook up to the WebSocket manager.
- **Verification:** **Confirmed**. The page contains the helper `collectUniqueSortedSymbols` but doesn't call `useRealtimeFeedFromManager`.

### 2.2 Stock Detail Model (`useStockDetailPageModel.js`)
- **Finding:** The model fetches the initial overview via HTTP REST API and defines a throttled updater (`handleRealtimeSnapshot`) but never calls it.
- **Verification:** **Confirmed**. There is no websocket subscription in the hook.

### 2.3 VNStockChartPanel (`VNStockChartPanel.js`)
- **Finding:** The `CoreApiChartAdapter.subscribeToBar` method is a blank stub returning `() => {}`, which disables live candlestick updates.
- **Verification:** **Confirmed**. The callback `onBar` is completely ignored.

---

## 3. Real-time Infrastructure Status
The backend WebSocket connection and the client-side context managers (`RealtimeContext.js` -> `useRealtimeFeedFromManager`) are fully operational and ready to be integrated.

---

## 4. Execution Plan (Finalized)

### Step 1: Dashboard page integration
- Edit `DashboardPage.js` to call `useRealtimeFeedFromManager` with unique sorted symbols.
- Merge WebSocket quotes into `quotesBySymbol` and compute breadth dynamically if empty.

### Step 2: Stock detail model integration
- Edit `useStockDetailPageModel.js` to subscribe to the current symbol.
- Forward new WebSocket quotes to `handleRealtimeSnapshot`.

### Step 3: KLineChart live candles
- Modify `CoreApiChartAdapter` to save the widget's update callback.
- Edit `VNStockChartPanel.js` to subscribe to the symbol and push mapped `OHLCVBar` objects to the callback on price ticks.
