# Audit: Project Optimization Roadmap

**Date**: 2026-04-17  
**Goal**: Identify and resolve hidden performance bottlenecks across the VNInvest codebase to ensure stability during high market volatility.

## 1. Backend Optimization (Django/Postgres)

### A. Non-Standardized VWAP Calculation
- **File**: `backend/portfolio/views_ai_advisory_session.py:146`
- **Issue**: VWAP (Volume Weighted Average Price) for the current day is calculated by looping over all `IntradayTick` records in Python.
- **Impact**: High latency and CPU usage on the backend server for high-volume stocks (e.g., HPG, SSI).
- **Optimization**: Use Django's `aggregate()` with `Sum(F('price') * F('volume'))` and `Sum('volume')` to perform the calculation directly in the database.

### B. Audit Log Trace N+1 Scanning
- **File**: `backend/portfolio/views_ai_advisory_trace.py`
- **Issue**: The `stock_ai_advisory_trace_list_api` iterates over `WhaleAdvisory` records and for EACH record, iterates over the ENTIRE `AdvisoryAggregateAuditLog` table for that symbol using an unindexed loop (`_matches_trace`).
- **Impact**: O(N*M) Big-O complexity where N is advisory count and M is log count. This will fail as history grows.
- **Optimization**: Denormalize `advisory_id` and `snapshot_id` directly into `AdvisoryAggregateAuditLog` as indexed ForeignKeys to allow O(1) lookups.

### C. Persistent "Cross-Market" Scanning Bottlenecks
- **File**: `backend/portfolio/market_data_service.py`
- **Issue**: Any feature scanning the entire market (e.g., Whale Campaigns, Volume Spikes) currently relies on filtering unindexed calculated fields.
- **Impact**: High Postgres CPU load and 504 Timeouts.
- **Optimization**:
    - Extend the `volume__gte` pre-filter heuristic developed for Unified Alerts across all market-wide queries.
    - Implement a "High Value Signal" materialized view or a dedicated table updated via Celery tasks to avoid scanning raw tick data on every request.

---

## 2. Infrastructure Optimization (Redis/Task Queue)

### A. Celery Worker Stability (Sync Fallback)
- **Problem**: Many views have a `STOCK_AI_ADVISORY_SYNC_FALLBACK` enabled. If Celery workers are slow, the web workers take over heavy AI calculations.
- **Impact**: Blocking Gunicorn/Daphne workers, leading to site-wide unresponsiveness.
- **Optimization**: Disable sync fallback for heavy tasks. Implement a proper "Processing" state on the frontend with WebSocket notification upon completion.

### B. Redis Stream Growth Control
- **Audit**: Verified `tick_producer.py` uses `MAXLEN`.
- **Action**: Audit all other producers (News, Social sentiment, etc.) to ensure consistent `MAXLEN` usage to prevent Redis OOM (Out of Memory).

---

## 3. Frontend Optimization (React/UI)

### A. ECharts Component Decoupling
- **Problem**: Changing `viewMode` (Sunburst/Treemap) triggers full re-renders of the state-heavy `PortfolioHeatmap`.
- **Impact**: UI freezing during mode switching and data updates.
- **Optimization**:
    - Use `notMerge: true` (Planned).
    - Implement `shouldComponentUpdate` or `React.memo` with custom comparison for the ReactECharts wrapper to ignore non-data-related prop changes.

### B. WebSocket Message Throttling
- **Problem**: During high market volatility, symbols might receive multiple ticks/second, flooding the Redux state.
- **Impact**: Browser lag due to excessive DOM updates.
- **Optimization**: Implement a 500ms `requestAnimationFrame` throttle for state updates in `useRealtimeData` hooks.

---

## Discussion & Next Steps

1.  **Priority 1**: Backend VWAP and Audit Log Trace fixes (Direct performance impact).
2.  **Priority 2**: WebSocket update throttling (Browser stability).
3.  **Priority 3**: Decoupling sync fallback from AI advisory (System resilience).
