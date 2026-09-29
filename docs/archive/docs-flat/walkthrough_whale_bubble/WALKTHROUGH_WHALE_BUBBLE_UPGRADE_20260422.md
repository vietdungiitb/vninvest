# Walkthrough: Whale Bubble Chart Modernization

## 1. Visual Changes

### 1.1 Volume-Centric Y-Axis
The chart now reflects Matched Value (VND) or Volume (Shares) on the Y-axis. This ensures that massive orders are instantly recognizable by their vertical position and size.

### 1.2 Extreme Order Highlighting
Orders exceeding 10x the average matched value are flagged. In the tooltip, they appear with a `🧨 LỆNH CỰC LỚN` badge and a distinctive glow.

### 1.3 Moving Average Trend
A smoothed MA10 line tracks the volume trend, helping users identify periods of institutional accumulation or distribution.

## 2. Technical Verification

### 2.1 Backend Fallback Test
- **Scenario**: Missing `TickerSessionClose` for a new symbol.
- **Result**: System successfully falls back to `DailyPrice` from the previous session.
- **Degraded Mode**: If all tiers fail, the chart displays a banner and maps bubbles to $Y=0$, ensuring the tool remains functional.

### 2.2 Extreme Detection Test
- **Input**: Avg Matched Value = 100M.
- **Test Order**: 1.2B.
- **Result**: `is_extreme` returns `true` (since 1.2B > 1B threshold).

### 2.3 Data Export
- Clicking the 📥 button downloads a CSV with `Timestamp, Side, Price, Volume, Value, IsExtreme`.

## 3. How to Audit
1.  **Check API**: Hit `/api/whale/orders/{symbol}/` and verify `extreme_threshold_value` in the summary.
2.  **Verify Tooltip**: Hover over the largest bubbles to see the `LỆNH CỰC LỚN` badge.
3.  **Toggle Units**: Switch between VND and CP (Shares) to ensure the Y-axis and MA line update correctly.
4.  **CSV Check**: Export the data and verify that the `IsExtreme` column reflects the visual state of the chart.

---
*Completed by Antigravity on 2026-04-22*
