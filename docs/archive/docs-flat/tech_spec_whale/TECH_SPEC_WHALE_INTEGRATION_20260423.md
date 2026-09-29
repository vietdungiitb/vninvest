# Technical Specification: Whale Analytics Integration

## 1. Overview
The Whale Analytics Integration aims to provide a unified view of institutional order flow. This document specifies the technical details of the `WhaleAnalyticsTab` composition and its children.

## 2. API Data Contract
### A. Whale Bubbles (`getWhaleOrdersBySymbol`)
- **Query Params**: `symbol`, `timeframe`, `bucket=1m`
- **Response**:
    ```json
    {
      "orders": { "buy": [], "sell": [], "internal": [] },
      "ref_price": 105.2,
      "summary": { "total_orders": 45, "buy_orders": 30, ... }
    }
    ```

### B. Intraday Flow (`getStockOrderFlow` or `getDarkMoneyHistory`)
- **Query Params**: `symbol`, `interval=1m`, `period=session`
- **Response**:
    ```json
    {
      "cvd_series": [ { "bucket_ts": "...", "cumulative_cvd": 120.5 }, ... ],
      "dark_flow": { "strength": 85.2, "confidence": "high", "signal_type": "accumulation" },
      "smfi": +4.2
    }
    ```

## 3. Component Interfaces

### `WhaleAnalyticsTab` (Wrapper)
- **Props**:
    - `holdings`: Array of holding objects.
    - `symbolOptions`: Array of available ticker symbols.
    - `selectedSymbol`: Initial symbol to display.
- **State**:
    - `timeframe`: string ('5m', '15m', '30m', '1h', 'session').
    - `symbol`: string (synchronized with parent if needed).

### `CompactDarkMoneyFlow` (Lightweight Charts)
- **Props**:
    - `symbol`: string.
    - `data`: Flow data object.
    - `height`: number (default: 240).
    - `isCompact`: boolean (true).
- **Chart Config**:
    - `priceScale`: Hidden or overlaid if needed.
    - `timeScale`: Visible, synchronized with ECharts X-axis.

## 4. State Management Logic
- **Single Source of Truth (SSOT)**: `WhaleAnalyticsTab` is the ONLY source for symbol, timeframe, normalized data, and loading/error states.
- **Data Fetching**: Use a custom hook `useWhaleAnalyticsData(symbol, timeframe)` that triggers parallel fetches for both bubbles and flow.
- **Sync Logic**: The `timeframe` prop passed to both charts ensures they render the same window. 
- **Time Adapter**: Implement `toCanonicalMinute(timestamp)` to normalize different time formats (ISO, Epoch, chart-specific keys) into a shared minute bucket for tooltip/crosshair synchronization.

## 5. Visual Specifications
- **Theme**: Slate/Emerald/Rose neon palette.
- **Typography**: IBM Plex Sans (11px for chart labels).
- **Responsiveness**:
    - Desktop: Grid template rows `[1fr 240px]`.
    - Mobile: `flex-col` with overflow-y (Fixed vertical stack).
