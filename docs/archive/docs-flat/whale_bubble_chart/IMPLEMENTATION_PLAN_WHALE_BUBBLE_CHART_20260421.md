# Implementation Plan: Single-Symbol Whale Bubble Chart (Refined)

This document provides the technical roadmap for replacing the "Shark" alert list with a focused, single-symbol investigation bubble chart.

## 1. Backend Data Layer
### New API Endpoint
- **URL**: `GET /api/whale/orders/{symbol}?timeframe=15m&start={ts}&end={ts}`
- **Permissions**: `IsAuthenticated`, `IsProPlan`.
- **Logic**:
    - **Reference Price Sync**: Fetch `prev_close_price` from `TickerSessionClose` for the current symbol. Fallback to `DailyPrice.close_price` if session data is missing.
    - **Order Categorization**:
        - Compute `is_large` flag comparing `matched_value` against `UserConfig.whale_alert_threshold`.
        - Assign `side`: `buy`, `sell`, or `internal` (if side is UNKNOWN or headline contains ownership keywords).
    - **Freshness**: By default, return the last 60 minutes of data if no `start`/`end` is provided.
- **Response Schema**:
    ```json
    {
      "ok": true,
      "symbol": "VNM",
      "ref_price": 65000,
      "orders": [
        {
          "ts": "2026-04-21T09:15:00+07:00",
          "price": 65500,
          "volume": 10000,
          "matched_value": 655000000,
          "side": "buy",
          "is_large": true
        }
      ]
    }
    ```

## 2. Component Architecture
### Custom Hook: `useOrderBubbleCoordinates.js`
- **Goal**: Isolate shared logic for coordinate conversion.
- **Logic**:
    - **X-Axis**: Convert ISO timestamp to minutes since `9:00 AM` (Asia/Ho_Chi_Minh).
    - **Y-Axis**:
        - `Absolute`: `price - ref_price`.
        - `Percentage`: `((price - ref_price) / ref_price) * 100`.
    - **Size (R)**: Normalize `matched_value` using `sqrt` for bubble radius.

### UI Component: `WhaleBubbleChart.jsx`
- **Library**: `echarts-for-react`.
- **Layout**: Butterfly layout centered at `Y=0`.
- **Visual Encoding**:
    - **Green (#10b981)**: Net Buy.
    - **Red (#ef4444)**: Net Sell.
    - **Gray (#64748b)**: Internal/Non-directional large trades.
- **Polish**:
    - Detailed tooltips showing absolute and relative price delta.
    - Vertical lines for session open/close.
    - Loading skeleton and empty states for missing data.

## 3. Localization (i18n)
Update `vi.js` and `en.js` with keys in the `whaleChart` namespace:
- `whaleChart.vndMode` -> "Chế độ VNĐ"
- `whaleChart.percentageMode` -> "Chế độ Phần trăm"
- Labels for Tooltips, Legend, and Axis markers.

## 4. Dashboard Integration
### Component: `ModularPositionDeck.jsx`
- Replace legacy "Shark" list in the `whale` tab.
- Add Header Controls:
    - **Symbol Selector**: Dropdown to select from Portfolio/Watchlist.
    - **Unit Toggle**: `VNĐ` vs `%`.
    - **Timeframe Selector**: `15m | 30m | 1h | Session`.

## 5. Verification Roadmap
1. **Phase 1**: Backend API development and verification of reference price sync.
2. **Phase 2**: Core `useOrderBubbleCoordinates` logic and unit testing.
3. **Phase 3**: `WhaleBubbleChart.jsx` construction with ECharts and i18n.
4. **Phase 4**: Integration into `ModularPositionDeck` and cross-symbol stress testing.

