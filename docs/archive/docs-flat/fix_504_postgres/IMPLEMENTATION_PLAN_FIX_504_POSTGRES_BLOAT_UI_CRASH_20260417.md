# Plan: Realtime Engine Hardening & UI Stability Fix

**Date**: 2026-04-17  
**Goal**: Resolve persistent 504 Gateway Timeouts, stabilize Postgres resource consumption, and fix ECharts runtime crashes in the Portfolio Heatmap.

## User Review Required

> [!IMPORTANT]
> - **Backend Performance**: The "Market-wide Analysis" (Mega Whales) will now use a global 60-second cache. This reduces database load by 95% under multi-user concurrency but introduces a minor lag for market-wide alerts (not affecting your personal watchlist).
> - **UI Changes**: `colorSaturation` is being removed from the Treemap to fix a documented ECharts transition bug. The heat coloring remains accurate via `visualMap`.

## Phase 1: Frontend UI Stability (ECharts Fix)

### Problem
React error: `TypeError: Cannot read properties of null (reading 'colorStops')`.
Triggered during Sunburst <-> Treemap transition when `visualMap` and `colorSaturation` conflict in the animator.

### [MODIFY] [PortfolioHeatmap.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/PortfolioHeatmap.jsx)
- **Change**: Set `notMerge={true}` in `ReactECharts`.
- **Change**: Remove `colorSaturation: [min, max]` from Treemap `levels`.
- **Change**: Replace `shadowColor: 'transparent'` with `'rgba(0, 0, 0, 0)'` for stable animation interpolation.
- **Change**: Add null-guards in formatter functions for `params.data`.

---

## Phase 2: Backend Performance & Watchlist Prioritization

### Problem
504 Gateway Timeout in `/api/realtime/unified-alerts/`.
Postgres CPU @ 100% due to Full Table Scan in `_build_market_top_tier_whale_unified`.

### [MODIFY] [market_data_service.py](file:///c:/Mujoco%20Projects/vninvest/backend/portfolio/market_data_service.py)

#### 1. Watchlist Prioritization (High Frequency)
- **Watchlist Symbols**: Tiếp tục sử dụng `get_whale_feed_aggregate` với filter `symbol__in`. Đây là truy vấn có Index (Fast Path), đảm bảo dữ liệu mới nhất cho các mã user quan tâm.
- **Severity Boost**: Các mã trong Watchlist sẽ có trọng số ưu tiên cao hơn trong logic `_compute_unified_priority_rank`.

#### 2. Market-wide Optimization (Heavy Scanner)
- **Problem**: Truy vấn quét toàn bộ bảng để tìm "Siêu cá mập" ngoài Watchlist đang giết chết DB.
- **Fix - SQL-Side Performance**: 
    - Bổ sung `volume__gte` filter dựa trên `threshold` tối thiểu của thị trường để DB dùng Index cột `volume` lọc bớt 99% dữ liệu trước khi chạy Annotation.
    - Chuyển `window` filtering sang SQL.
- **Fix - Global Caching**: Kết quả quét toàn thị trường sẽ được cache Global trong 60 giây. Điều này tách biệt tải trọng của việc quét "Siêu cá mập" ra khỏi các hành động real-time của user trên Watchlist.

---

## Phase 3: Verification & Soak Test

### Automated Verification
- Run `python manage.py test portfolio.tests.test_api_routes_stock_workspace_realtime_bulk` to ensure no regression in alert logic.
- Verify Daphne logs to ensure `Application instance took too long to shut down` warnings disappear.

### Manual Verification
- **Stress Test**: Quickly toggle Heatmap view modes while keeping the Network tab open. Ensure no crashes and fast API responses (< 200ms for cached hits).
- **Postgres Health**: Monitor CPU/RAM usage during peak traffic.

## Open Questions

- **Cache Duration**: Is 60 seconds acceptable for market-wide "Mega Whale" alerts, or do we need lower latency (e.g., 10s)?
- **Max Price Assumption**: Is 500,000 VND/share a safe "Max Price" for the volume-prefilter heuristic, or should we query the max price dynamically?

---
