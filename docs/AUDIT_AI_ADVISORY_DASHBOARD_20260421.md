# Audit Report: AI Advisory Command Center

**Date**: 2026-04-21
**Author**: Antigravity AI
**Subject**: Data Visibility Gaps and Single Source of Truth (SSOT) Compliance

## 1. Investigation: Why information is missing despite market data?

The audit identified two primary "gates" that prevent information from appearing on the AI Advisory page:

### A. The "Tracked Symbol" Gate
The backend API `whale_advisory_symbol_stats_api` (in `views_stock_order_flow.py`) and the background task `auto_generate_advisories_for_all_tracked` (in `tasks_whale_auto_generation.py`) only process symbols that the user has explicitly added to their **Tracked Symbols** list. 
> [!WARNING]
> If a "Whale" order occurs for a symbol like `VIC` but the user only tracks `VNM` and `FPT`, the AI Advisory page will remain empty for `VIC`, even with massive market flow.

### B. Threshold Mismatch
The stats API filters orders based on `_resolve_user_whale_threshold_vnd`. 
*   **Issue**: If a user has a high personal threshold (e.g., 2 Billion VND), any "Large Flow" below that threshold is discarded by the API, even if the market considers 1 Billion VND to be significant.

### C. Temporal Desync (Sidebar vs. Panel)
*   **Sidebar (Ticker Stats)**: Refreshes every 60 seconds based on today's `IntradayTick`.
*   **Main Panel (AI Advisory)**: Refreshes based on `WhaleAdvisory` records which are generated asynchronously.
*   **Gap**: A symbol may appear in the sidebar as "Hot", but if the AI generation task is queued or failing (e.g., Celery worker busy), the main panel will show "No advisory available".

---

## 2. Audit: Single Source of Truth (SSOT) Compliance

### Status: Partial Compliance (High Logic Duplication)

| Area | Status | Note |
| :--- | :--- | :--- |
| **Data Source** | ✅ Compliant | Both the "Shark Alert" list and "AI Advisory" pull from the same `IntradayTick` model. |
| **Threshold Logic** | ⚠️ At Risk | The logic to "resolve" thresholds is scattered across `views_stock_order_flow.py`, `whale_feed_helpers.py`, and `order_flow.py`. |
| **Normalization** | ⚠️ At Risk | Side detection (Buy/Sell) is recalculated in the API instead of using a canonical signal processor service. |

> [!IMPORTANT]
> **Conclusion**: There is a "Single Source of Truth" (the database), but "Multiple Sources of Interpretation" (redundant code definitions for what constitutes a "Whale").

---

## 3. Limitations & Proposed Improvements

### Current Limitations
1.  **Reactive UI**: The user often has to manually click "Refresh" to see the latest AI synthesis if auto-generation hasn't fired yet.
2.  **Closed Silo**: No "Market Discovery" mode. The AI Advisory is a walled garden of the user's own watchlist.
3.  **Explainability**: The "Trust Telemetry" panel currenty displays mock-like or high-level status without deep linking to the *specific* ticks that triggered the signal.

### Recommended Improvements
1.  **Discovery Mode**: Add a "Market Pulse" toggle that shows the top 5 Whale-heavy symbols in the whole market, regardless of whether they are in the user's watchlist.
2.  **Streaming Triggers**: Link the `RealtimePublisher` (WebSockets) directly to the AI Advisory generation queue. If a new symbol becomes "Extreme Intensity", the system should auto-generate an advisory *before* the user even navigates to the page.
3.  **Unified Signal Processor**: Refactor `views_stock_order_flow.py` to use a shared `WhaleSignalEngine` service to ensure 100% logic alignment with the `UnifiedAlerts` center.
4.  **Bubble Chart Integration**: Replace the sidebar text stats with the new **Whale Bubble Chart** (currently in planning) to provide a 2D view of intensity.

---

## 4. Verification & Audit Trail
*   **Files Audited**:
    *   `frontend/src/pages/WhaleAdvisory.jsx`
    *   `frontend/src/hooks/useWhaleAdvisoryData.js`
    *   `backend/portfolio/views_stock_order_flow.py`
    *   `backend/portfolio/views_ai_advisory_management.py`
    *   `backend/portfolio/tasks_whale_auto_generation.py`
