# Implementation Plan: Whale Bubble Chart Modernization (2026-04-22)

## 1. Overview
Modernize the "Whale Bubble Chart" visual analytics tool to enhance institutional order flow tracking by shifting from a price-centric to a volume-centric visualization. This upgrade ensures that "Whales" are identified not just by price movement but by their massive execution volume.

## 2. Key Features
- **Volume-Centric Y-Axis**: Map `matched_value` (VND) or `volume` (Shares) on the Y-axis.
- **Robust Reference Price Resolution**: 4-tier fallback logic leveraging `TickerSessionClose` and `DailyPrice`.
- **Extreme Order Detection**: Highlights orders exceeding 10x the average matched value.
- **Moving Average (MA10)**: Visualizes intraday flow trends.
- **Rich Tooltips**: Includes badges for "EXTREME" and "WHALE" orders.
- **CSV Export**: Fully updated schema with `IsExtreme` flags.

## 3. API Contract Updates
- **Endpoint**: `GET /api/whale/orders/{symbol}/`
- **New Fields in Summary**:
    - `extreme_threshold_value`
    - `extreme_order_count`
    - `avg_matched_value`
    - `degraded_mode_reason`

## 4. Design Logic
- **Scaling**: Bubble size is proportional to `sqrt(matched_value)` for visual balance.
- **Extreme Detection**: `matched_value >= max(whale_threshold, avg_matched_value * 10)`.
- **Fallback Hierarchy**: `TickerSessionClose.prev_close` -> `TickerSessionClose.close` -> `DailyPrice.close` (D-1) -> `DailyPrice.close` (D).
- **Chart Layout**: Minimum visual height of 10 cm (~400px - 450px) to ensure Y-axis clarity.


## 5. Verification Matrix
| Component | Test Case | Status |
|-----------|-----------|--------|
| Backend | 4-tier Fallback | ✅ PASSED |
| Backend | Extreme Order Logic | ✅ PASSED |
| Frontend | VND/Volume Toggle | ✅ PASSED |
| Frontend | MA10 Trend Line | ✅ PASSED |
| Frontend | CSV Export Schema | ✅ PASSED |

## 6. Definition of Done
- [x] Backend logic matches the 4-tier fallback specification.
- [x] Frontend supports interactive zooming and volume-based scaling.
- [x] Zero-division guards in ratio bars.
- [x] Audit entries added to `CODE_CHANGE_AUDIT_LEDGER.md`.
- [x] Documentation Trio (Plan, Spec, Taskboard) finalized in `docs/`.
