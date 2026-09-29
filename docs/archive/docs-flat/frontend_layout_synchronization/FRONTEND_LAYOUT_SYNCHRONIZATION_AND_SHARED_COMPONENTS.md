# Frontend Layout Synchronization & Shared Components Documentation

**Date:** 2026-04-14  
**Subject:** Synchronization of StockDetail and WhaleAlertsDashboard Layouts

## 1. Overview
To provide a consistent "Bloomberg-style" terminal experience across the platform, the layout structures of the **Stock Detail** page (`/stocks/:symbol`) and the **Whale Alerts Dashboard** (`/whale-alerts/:symbol`) have been synchronized. This ensures that users transitioning between general stock analysis and specialized whale flow analysis maintain a consistent visual context.

## 2. Updated Grid Standard
The platform now uses a **weighted 3-column grid** for professional analysis dashboards.

- **Class:** `xl:grid-cols-[2fr_2fr_1fr]`
- **Column 1 & 2 (Left/Center):** Primary visualizations (Price charts, Dark Money Master Chart, Advisory Tabs).
- **Column 3 (Right Sidebar):** High-density real-time metrics and flow data.

## 3. Shared Whale Widgets (Architecture)
Previously, whale-related panels were internal functions within `WhaleAlertsDashboard.jsx`. They have been extracted into reusable components in `src/components/` to allow seamless integration into any stock-related page.

### List of Shared Components:
- **`WhaleFeedPanel.jsx`**: Real-time large order alerts (Shark/Whale Hub).
- **`MoneyFlowDonut.jsx`**: Session-based buy/sell volume distribution.
- **`BubbleOrderChart.jsx`**: Scatter plot visualization of large order groups.
- **`OrderFlowRadarPanel.jsx`**: Specialized Dark Money strength and CVD tracking.
- **`RVOLChartPanel.jsx`**: Relative Volume spike analysis.
- **`DepthChartPanel.jsx`**: Market depth (Bid/Ask) visualization.

## 4. Hierarchy of Information (Sidebar)
To ensure "khung nhìn" (viewport) consistency, the right sidebar across dashboards should follow this order:
1. **Real-time Feed / Signals** (`WhaleFeedPanel` or `IntradayMatchedPanel`).
2. **Market Liquidity** (`PriceDepthPanel`).
3. **Flow Distribution** (`MoneyFlowDonut`).
4. **Volume Analysis** (`RVOLChartPanel` or `BubbleOrderChart`).

## 5. Implementation Notes for Future Teams
- **Prop: `compact`**: When using `MoneyFlowDonut` or `DepthChartPanel` in a dense sidebar, pass the `compact` prop to ensure appropriate height scaling.
- **Prop: `feedHeightClass`**: Use this prop in `WhaleFeedPanel` to adjust the scrollable viewport height without breaking the grid container.
- **API Calls**: The shared components use dynamic imports for `../api/client` to prevent initialization race conditions and keep the main bundles lean.

---
**Maintaining Consistency:**  
If a new widget is added to the sidebar of one dashboard, the architectural standard is to evaluate its relevance for the other analysis dashboards and maintain structural parity where possible.
