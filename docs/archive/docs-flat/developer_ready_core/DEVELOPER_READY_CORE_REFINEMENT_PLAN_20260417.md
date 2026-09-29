# Detailed Implementation Plan: Dashboard Refinement & Stability Fix

**Date**: 2026-04-17
**Status**: Ready for Implementation (Dev-Ready)
**Goal**: Resolve DB performance bottlenecks and implement a premium Slate Dark UI/UX.

---

## 1. Phase 1: Performance Optimization (CRITICAL)

### Task 1.1: Bulk Aggregation for Whale Stats
**Target**: `backend/portfolio/views_stock_order_flow.py`
**Objective**: Eliminate N+1 queries in `whale_advisory_symbol_stats_api`.

#### Implementation Spec:
1.  Instead of iterating over `symbols` list:
2.  Create a single queryset on `IntradayTick`.
3.  Filter by `symbol__in=symbols` and the resolved `trade_date`.
4.  Annotate the `matched_value` (`price * volume`).
5.  Use `.values('symbol').annotate(...)` to calculate:
    - `buy_count`: `Count('pk', filter=Q(side__iexact='BUY'))`
    - `sell_count`: `Count('pk', filter=Q(side__iexact='SELL'))`
    - `total_value`: `Sum('matched_value')`
    - `total_volume`: `Sum('volume')`
6.  Handle the division by zero for `avg_order_value` in Python post-processing.

**SQL Target Verification**:
The final query should be a single `SELECT ... FROM portfolio_intradaytick GROUP BY symbol`.

---

## 2. Phase 2: Design System & Global Styles

### Task 2.1: Slate Dark Palette Migration
**Target**: `frontend/src/index.css`

#### Implementation Spec:
Update the following CSS variables:
```css
:root {
  --terminal-bg: #0f172a;        /* Slate 950 */
  --terminal-panel: #1e293b;     /* Slate 800 */
  --terminal-border: #334155;    /* Slate 700 */
  --terminal-text: #f1f5f9;      /* Slate 100 */
  --terminal-text-muted: #94a3b8; /* Slate 400 */
  --accent-up: #10b981;          /* Emerald 500 */
  --accent-down: #f43f5e;        /* Rose 500 */
  --accent-neutral: #64748b;     /* Slate 500 */
}
```

---

## 3. Phase 3: Component-Specific Overhaul

### Task 3.1: Enhanced Portfolio Heatmap
**Target**: `frontend/src/components/PortfolioHeatmap.jsx`

#### Implementation Spec:
1.  **VisualMap Configuration**:
    - Use `type: 'piecewise'` or `continuous` for the color gradient.
    - Ranges:
      - `< -5%`: Dark Red (`#991b1b`)
      - `-5% to -2%`: Red (`#ef4444`)
      - `-2% to 0%`: Light Red (`#fca5a5`)
      - `0%`: Grey (`#475569`)
      - `0% to 2%`: Light Green (`#86efac`)
      - `2% to 5%`: Green (`#22c55e`)
      - `> 5%`: Dark Green (`#166534`)
2.  **View Modes Toggle**:
    - State: `viewMode` ('market_cap' | 'portfolio_weight').
    - If 'market_cap', set node area based on total market capitalization.
    - If 'portfolio_weight', set node area based on holding value.

### Task 3.2: High-Density Sidebar
**Target**: `frontend/src/components/Sidebar.jsx`

#### Implementation Spec:
1.  **Sticky Header**:
    - Set `position: sticky; top: 0; z-index: 10;` for the "Danh sách theo dõi" title container.
    - Apply a subtle backdrop-filter (blur).
2.  **Information Density**:
    - Reduce vertical padding of symbol items from `12px` to `8px`.
    - Use a monospaced font for price values to prevent layout shift.

### Task 3.3: StatCard Sparklines
**Target**: `frontend/src/components/StatCard.jsx`

#### Implementation Spec:
1.  **Data Ingestion**: Pass an array of 24 points (last 24h) to use as the sparkline.
2.  **SVG Rendering**:
    - Implement a minimal `<polyline>` or `<path>` component.
    - Color based on `isPositive` flag.
    - Area fill with subtle gradient under the line.

---

## 4. Phase 4: Integration & QA

1.  **Auth Persistence**: Ensure `api/auth/token/` 401 errors are resolved by fixing the DB latency first.
2.  **Mobile Responsiveness**: Verify the 3-column dashboard layout collapses correctly on tablets.
3.  **Real-time Stability**: Ensure WebSocket updates don't trigger full-page re-renders during Heatmap updates (use `React.memo`).
