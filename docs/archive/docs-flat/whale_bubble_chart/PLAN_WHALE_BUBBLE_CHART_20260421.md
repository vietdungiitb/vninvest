# Research and Implementation Plan: Single-Symbol Whale Bubble Chart

## Overview
Based on refinement sessions and comprehensive audit (20260421), the Whale Bubble Chart will focus on **single-symbol investigation** to avoid visual clutter and provide deeper insights into big player movements relative to the market reference. This tool will replace the "Shark" alert list in the lower dashboard deck.

## New Requirements

### 1. Scope & Coordinate System
- **Focus**: One symbol at a time (user-selectable).
- **Y-Axis Reference**: Centered at **0** (Reference Price / Giá tham chiếu).
- **Scaling Modes**:
    - **VND Mode**: Y-axis shows absolute price difference from reference (e.g., +1.5k, -0.5k).
    - **Percentage Mode**: Y-axis shows the percentage change from reference (e.g., +2.5%).
- **X-Axis**: Timeline starting from session open (09:00 AM Asia/Ho_Chi_Minh).

### 2. Visual Encoding & Interaction
- **Color Coding**:
    *   **Green**: Large Buy flow.
    *   **Red**: Large Sell flow.
    *   **Gray**: Internal transactions or UNKNOWN side large orders.
- **Bubble Size**: Proportional to `matched_value`.
- **Interactive Controls**:
    - Stock selector (Dropdown with portfolio/watchlist).
    - Timeframe filter (15m, 30m, 1h, All).
    - Unit toggle (VND/%).
- **Visual Polish**:
    - Detailed tooltips (Price, Ref Price, Delta VND/%, Time, Matched Value, Flow Type).
    - Loading skeletons and clean empty states.
    - Session boundary markers (Vertical lines).

## Data Processing Layer
- **Reference Price Source**: Verified against `TickerSessionClose.prev_close_price` (fallback to `DailyPrice.close_price`).
- **Data Freshness**: Specify window (e.g., last 60 minutes) for real-time visualization.
- **Categorization**: Backend computation of `is_large_order` based on `UserConfig` or specific thresholds.
- **Timezone**: Explicit `Asia/Ho_Chi_Minh` handling for all timestamps.

## Component Architecture
- **WhaleBubbleChart.jsx**: Logic for ECharts configuration using `echarts-for-react`.
- **useOrderBubbleCoordinates()**: Custom hook for coordinate calculation.
- **ModularPositionDeck.jsx**: Integration point in the dashboard.
- **i18n**: Full Vietnamese support by default.

## Verification Checklist
1. ✅ Y-axis centering at reference price across different stocks.
2. ✅ VND/% toggle and axis label updates.
3. ✅ Color assignments (Buy/Sell/Internal).
4. ✅ Session-start time robustness (9:00 AM).
5. ✅ Performance with large datasets (100K+ orders using ECharts).
6. ✅ Responsiveness and Vietnamese rendering (diacritics).
7. ✅ Timezone edge cases (midnight crossing).

