# Audit Report: Dashboard Portfolio Heatmap

**Date**: 2026-04-20  
**Target**: `PortfolioHeatmap.jsx` & `HoldingsView` API  
**Status**: ⚠️ **Needs Refinement** (Functional but has technical/UX debt)

## 1. Overview of Current Implementation
The heatmap uses **ECharts** to visualize portfolio concentration and performance. It supports two modes: **Treemap** and **Sunburst**. It implements a sophisticated "Bloomberg-style" Square Root normalization to prevent large-cap stocks from overwhelming the visualization.

---

## 2. Identified Issues & Bottlenecks

### A. Visual & UX (High Impact)
1.  **Metric Naming Confusion**: The UI toggle uses "Weight", but in professional trading context, "Weight" means %, while the current logic uses absolute "Market Value". This leads to confusion.
2.  **Label Visibility**: In high-density portfolios (20+ stocks), labels on small tiles are either cut off or completely hidden.
3.  **Hardcoded Sizing**: The container height is hardcoded at 420px.
4.  **Static Normalization**: Users cannot toggle back to "Absolute Value" (Linear).
5.  **Color Aesthetic (New)**: The current Fintech palette is too "muted" (ám màu). It needs more vibrant, high-contrast colors (Electric Emerald, Blood Red) to feel premium and alive.
6.  **Interaction Fatigue (New)**: Current hover-based tooltips are too sensitive, causing visual noise when the user just wants to scan the board. A **Click-to-Show** model is required for deliberate data inspection.

### B. Technical Performance (Medium Impact)
1.  **Backend N+1 Pattern**: The `HoldingsView` in `views_portfolio_watchlist.py` performs a separate query for industries after calculating holdings. This should be combined at the `compute_holdings` level or pre-fetched.
2.  **Tooltip Overhead**: The tooltip generates an inline SVG sparkline on every mouse move. While visually premium, this can cause micro-stuttering on lower-end devices or very busy heatmaps.
3.  **Missing Dynamic Period**: The heatmap is locked to "Day Change". Users lack the ability to see a "Weekly Change" or "Monthly Change" perspective on the same tiles.

### C. Gating & Compliance (Low Impact)
1.  **Symbol Masking Consistency**: While masking is applied in serializers, the Heatmap frontend needs to double-check if the "Gift Ticker" (top 3) logic is perfectly aligned with the backend's masking behavior.

---

## 3. Risk Assessment
- **Reliability**: High. The use of Pandas on the backend ensures calculations are robust.
- **Scalability**: Medium. Frontend `useMemo` for 100+ items might start lagging due to normalization loops.
- **Maintenance**: Low-Medium. The `sunburst` mode is relatively complex and might break if data structures for industries change.

---
**Auditor**: Antigravity AI  
**Recommendation**: Proceed with refinement plan [IMPLEMENTATION_PLAN_HEATMAP_REFINEMENT_20260420.md](file:///c:/Mujoco Projects/vninvest/docs/IMPLEMENTATION_PLAN_HEATMAP_REFINEMENT_20260420.md).
