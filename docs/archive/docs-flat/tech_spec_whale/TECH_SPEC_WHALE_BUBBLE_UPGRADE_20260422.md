# Technical Specification: Whale Bubble Chart Modernization

## 1. System Architecture
The Whale Bubble Chart consumes a canonical order flow feed and transforms it into a 2D scatter plot (ECharts).

### 1.1 Data Flow
`Market Data SSOT` -> `views_whale_orders.py` (Enrichment) -> `JSON API` -> `useOrderBubbleCoordinates.js` (Coordinate Transform) -> `WhaleBubbleChart.jsx` (Rendering).

## 2. Backend Specification (`views_whale_orders.py`)

### 2.1 Reference Price Logic
The `_get_reference_price` function implements an explicit 4-tier fallback:
- **Tier 1**: `TickerSessionClose.prev_close_price` (LTE trade_date).
- **Tier 2**: `TickerSessionClose.close_price` (LTE trade_date).
- **Tier 3**: `DailyPrice.close_price` (LTE trade_date - 1 day).
- **Tier 4**: `DailyPrice.close_price` (LTE trade_date).

### 2.2 Extreme Order Algorithm
```python
def get_extreme_threshold(whale_threshold, avg_value, count):
    if count >= 10:
        return max(whale_threshold, avg_value * 10)
    return whale_threshold * 2 if whale_threshold > 0 else 1_000_000_000
```
This logic is harmonized between bubble categorization and the summary payload.

## 3. Frontend Specification

### 3.1 Coordinate Transformation (`useOrderBubbleCoordinates.js`)
- **X-axis**: `minutes_since_start = (tick_time - session_start).total_seconds() / 60`.
- **Y-axis (Value)**: `matched_value`.
- **Y-axis (Volume)**: `volume`.
- **Size**: `(matched_value ** 0.5) / 1000`.

### 3.2 Visualization (`WhaleBubbleChart.jsx`)
- **Library**: Apache ECharts (via `echarts-for-react`).
- **Trend Line**: `type: 'line'`, `smooth: true`, calculated as MA10 of the active Y-axis metric.
- **Min Height**: `450px` (approx 10cm) to meet executive design standards.
- **Interactivity**: 
    - `dataZoom`: `[{type: 'inside'}, {type: 'slider'}]`.
    - `tooltip`: Custom HTML formatter using string interpolation (`${...}`) for reliable badge rendering.

## 4. Data Contract

### 4.1 API Response Summary
```json
"summary": {
    "total_orders": 124,
    "buy_orders": 75,
    "sell_orders": 40,
    "internal_orders": 9,
    "avg_matched_value": 150000000.0,
    "extreme_threshold_value": 1500000000.0,
    "extreme_order_count": 5
}
```

## 5. Security & Governance
- **Permission**: `IsProPlan` required for detailed whale flow analysis.
- **Audit**: All changes logged in `CODE_CHANGE_AUDIT_LEDGER.md` under entry `2026-04-22ax`.
- **Feature Flag**: `WHALE_BUBBLE_UPGRADE_ENABLED`. Component content is gated via conditional rendering to support controlled rollout.
