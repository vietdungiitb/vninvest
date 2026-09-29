# Taskboard: Whale Analytics Integration

- [x] **Phase 1: Architecture & State**
    - [x] Create `WhaleAnalyticsTab.jsx` wrapper with timeframe state.
    - [x] Refactor `WhaleBubbleChart.jsx` to be a controlled component.
    - [x] Create `useWhaleAnalyticsData` hook for parallel fetching.

- [x] **Phase 2: Flow Visualization**
    - [x] Create `CompactDarkMoneyFlow.jsx` using Lightweight Charts.
    - [x] Implement CVD AreaSeries and Strength LineSeries (Real intraday series).
    - [x] Apply "Compact Mode" styling (height 240px, hidden controls).

- [x] **Phase 3: Integration & Polishing**
    - [x] Update `ModularPositionDeck.jsx` to use `WhaleAnalyticsTab`.
    - [x] Implement SMFI/Strength badges in the header (i18n compliant).
    - [x] Synchronize X-axis intervals to 1m buckets (Canonical Time Sync).
    - [x] Add mobile responsiveness (Vertical Stack).

- [x] **Phase 4: Verification & Operations**
    - [x] Implement `toCanonicalMinute` shared adapter.
    - [x] Audit directional consistency (Bubble vs CVD).
    - [x] Verify crosshair/tooltip alignment (Dual-Pane Sync implemented).
    - [x] Rebuild/restart dev containers for visual verification.
    - [x] Update `CODE_CHANGE_AUDIT_LEDGER.md`.
