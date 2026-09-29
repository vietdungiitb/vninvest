# Plan: Integrating Dark Money Flow into Whale Bubble Chart (2026-04-23)

## 1. Objective
Integrate the **Dark Money Flow** (institutional flow) visualization into the **Whale Bubble Chart** component, specifically for the current session. This allows users to correlate individual large orders (Whale Bubbles) with the aggregate institutional momentum (Dark Money Flow) in a single view within the "Shark" (Cá mập) tab.

## 2. Current State Analysis
### Whale Bubble Chart (`WhaleBubbleChart.jsx`)
- **Focus**: Individual large orders (> threshold).
- **Visualization**: ECharts Scatter/Bubble plot.
- **Axes**: X = Time (minutes from session start), Y = Matched Value (VND) or Volume (Shares).
- **Features**: Timeframe filtering, VND/Volume toggle, MA10 trend line.

### Dark Money Flow (`DarkMoneyMasterChart.jsx` & `OrderFlowRadarPanel.jsx`)
- **Focus**: Aggregate institutional flow strength and Cumulative Volume Delta (CVD).
- **Visualization**: 
    - `DarkMoneyMasterChart`: Lightweight Charts (Historical + Intraday 15m/30m/1h).
    - `OrderFlowRadarPanel`: Recharts Area Chart (Intraday CVD).
- **Key Metric**: "Strength" (0-100) and "SMFI" (Smart Money Flow Index).

## 3. Proposed Enhancements

### A. UI/UX Layout Integration
- **Dual-Pane View**: Split the "Shark" tab content into two main sections:
    1. **Top Pane**: Enhanced Whale Bubble Chart (current scatter plot).
    2. **Bottom Pane**: Real-time Intraday Dark Money Flow (Strength & CVD).
- **Synchronization**: Ensure both charts use the same timeframe (e.g., Session start to current time).

### B. Technical Integration
- **Component Update**: Refactor `WhaleBubbleChart.jsx` to optionally include a sub-panel for Dark Money Flow.
- **Data Fetching**:
    - Continue using `getWhaleOrdersBySymbol` for bubbles.
    - Integrate `getStockOrderFlow` (from `OrderFlowRadarPanel`) or `getDarkMoneyHistory` (intraday mode) to fetch the flow strength and CVD series.
- **Unified Control**: The timeframe selector in the Bubble Chart should drive both visualizations.

### C. Feature Upgrades
- **Correlated Tooltips**: (Optional) If possible, hovering over a time point in one chart highlights the corresponding state in the other.
- **Institutional Context**: Add "Institutional Strength" as a background overlay or a small gauge within the Bubble Chart to provide immediate context without scrolling.

## 4. Proposed UI Mockup (Vertical Stack)
```
+-------------------------------------------------------------+
| [Symbol Select] [Timeframe: Session] [Unit: VND] [Export]   |
+-------------------------------------------------------------+
|                                                             |
|           WHALE BUBBLE CHART (ECharts)                      |
|      (Individual Whales Scattered over Session)             |
|                                                             |
+-------------------------------------------------------------+
|                                                             |
|           DARK MONEY FLOW / CVD (Recharts/Lightweight)      |
|      (Institutional Momentum & Cumulative Delta)            |
|                                                             |
+-------------------------------------------------------------+
| [Stats: Total Buy/Sell] [Strength Gauge: 85.2] [SMFI: +4.2] |
+-------------------------------------------------------------+
```

## 5. Implementation Roadmap
1.  **Phase 1: Component Preparation**
    - Create a wrapper component `WhaleAnalyticsTab` that composes `WhaleBubbleChart` and a new `IntradayDarkMoneyFlow` component.
2.  **Phase 2: Data Synchronization**
    - Ensure both components share the same `symbol` and `timeframe` state.
    - Optimize API calls to prevent redundant fetching.
3.  **Phase 3: UI Polishing**
    - Align styles (colors, fonts, borders) between the two chart types.
    - Add institutional strength indicators (Badges/Gauges) to the header.
4.  **Phase 4: Verification**
    - Test with real-time WebSocket updates.
    - Verify data consistency between the bubble summary and the flow aggregate.

## 6. Open Questions for USER
- Would you prefer a vertical stack (one above the other) or a side-by-side layout on larger screens?
- Should the "Dark Money Flow" use the detailed Lightweight Chart (like in `DarkMoneyMasterChart`) or a more streamlined Recharts version (like in `OrderFlowRadarPanel`)?
- Do you want to see the "SMFI" (Smart Money Flow Index) history as well, or just the current session's strength?
