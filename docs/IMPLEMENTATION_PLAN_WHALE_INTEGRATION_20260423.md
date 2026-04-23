# Implementation Plan: Whale Analytics Integration (Dual-Pane)

## 1. Goal
Implement a high-performance **Whale Analytics Tab** that combines individual trade visualization (Whale Bubbles) with aggregate institutional momentum (Dark Money Flow). This will be the new default view for the "Cá mập" (Shark) tab in the Modern Dashboard.

## 2. Technical Architecture
### A. Component Hierarchy
- `ModularPositionDeck.jsx` (Parent)
    - `WhaleAnalyticsTab.jsx` [NEW] (State Manager: Symbol, Timeframe)
        - Header: SMFI Badge, Strength Gauge, Controls.
        - `WhaleBubbleChart.jsx` (Scatter Plot - ECharts)
        - `CompactDarkMoneyFlow.jsx` [NEW] (Flow/CVD - Lightweight Charts)

### B. State Contract
The `WhaleAnalyticsTab` will act as the single source of truth for:
- `symbol`: The active ticker.
- `timeframe`: Shared bucket window (5m, 15m, 30m, 1h, Session).
- `data`: Fetched via hooks and passed down as props to ensure synchronization.

## 3. Proposed Changes

### [NEW] [CompactDarkMoneyFlow.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/CompactDarkMoneyFlow.jsx)
- Specialized version of `DarkMoneyMasterChart` optimized for limited vertical space (220-260px).
- **Series**: 
    - `AreaSeries`: Cumulative Volume Delta (CVD).
    - `LineSeries`: Institutional Strength.
- **Features**: Disabled legend/timeframe-controls (moved to parent), high-performance crosshair synchronization.

### [NEW] [WhaleAnalyticsTab.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/WhaleAnalyticsTab.jsx)
- Composition wrapper.
- Handles responsive layout: CSS Grid (1 col on mobile, 1 col stacked on desktop by default but optimized for dual-view).
- Centralizes state for `symbol` and `timeframe`.

### [MODIFY] [WhaleBubbleChart.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/WhaleBubbleChart.jsx)
- Refactor to accept `timeframe` as a prop (controlled component pattern).
- Remove internal timeframe selector when `isEmbedded` or `isControlled` prop is true.

### [MODIFY] [ModularPositionDeck.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/ModularPositionDeck.jsx)
- Replace the direct call to `WhaleBubbleChart` with `WhaleAnalyticsTab`.
- Pass necessary `symbolOptions` and `holdings`.

### [MODIFY] [client.js](file:///c:/Mujoco%20Projects/vninvest/frontend/src/api/client.js)
- Ensure API endpoints for intraday flow are robust and support the requested bucket resolution (1m).

## 4. Acceptance Criteria
- [ ] **Synchronization**: Hovering on the Bubble chart shows a timestamp that corresponds to the same data point on the Flow chart (within 1m tolerance).
- [ ] **Performance**: No lag during rapid zoom/pan in the Lightweight Chart section.
- [ ] **Visual Integrity**: Compact mode height is strictly between 220-260px.
- [ ] **Directional Consistency**: Total buy/sell delta in Bubble summary must align with the trend/direction of the CVD series (since units may differ). If units are both VND, then values must match within tolerance.

## 5. Operational Guidelines
- **Container Rebuild**: After frontend modifications, rebuild/restart dev containers to verify visual integrity.
- **Audit Logging**: Maintain a centralized log of all modified files in `CODE_CHANGE_AUDIT_LEDGER.md`.
- **Shared Logic**: Extract shared transforms/hooks from `WhaleAlertsDashboard` rather than cloning heavy components.
