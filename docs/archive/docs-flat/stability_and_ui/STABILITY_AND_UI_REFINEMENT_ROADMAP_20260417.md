# Technical Roadmap: System Stability & UI/UX Refinement 2026-04-17

This document outlines the diagnosis of recent system instabilities (500 Internal Server Errors) and the strategic roadmap for the VNInvest dashboard UI/UX overhaul.

---

## 1. System Stability Audit (Emergency Diagnosis)

### Current Issue: 500 / 401 Errors on Dashboard
The system is currently under severe stress. During the audit, we observed:
- **Database CPU Usage**: **1125%** on the `vninvest-dev-db` container.
- **Celery Worker Memory**: **1.8GiB** usage with high CPU load.
- **API Failures**: Core endpoints (`/summary/`, `/analytics/`, `/holdings/`, `/tracked-symbols/`) are timing out or returning 500 errors.

### Root Cause Analysis
The bottleneck has been traced to **`whale_advisory_symbol_stats_api`** in `backend/portfolio/views_stock_order_flow.py`.

> [!CAUTION]
> **Technical Debt Identified**: The current implementation perform a per-symbol loop (N+1 query pattern) on the `IntradayTick` table. 
> For a user tracking 50-100 symbols, this triggers **400+ expensive aggregation queries** on every dashboard refresh.

---

## 2. Phase 1: Performance & Stability Refactoring

### Goal: Reduce DB CPU from 1000% to <50%

#### A. Backend Query Optimization
- **Action**: Replace the symbol-by-symbol loop with a single bulk aggregation query using Django's `.values('symbol').annotate()`.
- **Target File**: `backend/portfolio/views_stock_order_flow.py`.
- **Expected Impact**: Reduction of database roundtrips from $4N$ to $1$.

#### B. Database Indexing
- **Action**: Ensure a composite index exists on `IntradayTick` for `(symbol, trade_date, side)` to support fast multi-symbol counts.

---

## 3. Phase 2: UI/UX Core Refinement (Slate Dark)

Once the backend is stabilized, we will execute the visual overhaul as specified in the original audit.

### A. Color Palette Transition
- **From**: Pure Black (`#000000`)
- **To**: **Slate Dark**
  - Background: `#0f172a`
  - Sidebar: `#1e293b`
  - Accents: Emerald Green / Rose Red for indicators.

### B. Portfolio Heatmap (Treemap)
- **Visual Encoding**: Implementation of Red-Grey-Green saturation mapping based on price change percentage.
- **Interactivity**: Dynamic tooltips and "View Mode" toggle (Market Cap vs. Portfolio Weight).

### C. Sidebar High-Density Layout
- **Sticky Header**: "Danh sách theo dõi" section will stay fixed while scrolling items.
- **Consolidation**: Profile, Admin, and Logout widgets grouped at the bottom for better ergonomic reach.

### D. KPI Cards & StatCards
- **Sparklines**: Integration of SVG sparklines showing the last 24h variation.
- **Micro-animations**: Subtle hover transitions on card interaction.

---

## 4. Implementation Schedule

| Step | Action | Priority | Status |
| :--- | :--- | :--- | :--- |
| 1 | Bulk Query Refactor (`views_stock_order_flow.py`) | CRITICAL | [ ] Pending |
| 2 | DB Index Verification | HIGH | [ ] Pending |
| 3 | Slate Dark Palette CSS Update | MEDIUM | [ ] Pending |
| 4 | Heatmap Visual Map Implementation | MEDIUM | [ ] Pending |
| 5 | Sidebar Layout Refinement | LOW | [ ] Pending |

---

## 5. Verification Plan

1. **Stability Check**: Monitor `docker stats` after refactoring. DB CPU must drop below 50%.
2. **Performance Check**: Endpoint latency for `/whale-advisory-symbol-stats/` should be <200ms for 100+ symbols.
3. **UI Audit**: Side-by-side comparison with the Bloomberg V2 design spec.
