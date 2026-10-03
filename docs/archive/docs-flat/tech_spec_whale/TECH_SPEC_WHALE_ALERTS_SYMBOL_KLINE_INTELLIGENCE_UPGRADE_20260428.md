# TECH SPEC - Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Mục tiêu kỹ thuật

Thiết kế này nhằm đưa `whale-alerts/:symbol` về một KLine intelligence workspace có 3 đặc tính:

1. đúng semantics dữ liệu theo candle bucket,
2. đọc nhanh được cho nhà đầu tư thực chiến,
3. có thể mở rộng lâu dài mà không phải sửa đi sửa lại do drift dữ liệu.

## 2. Kiến trúc tổng thể

### 2.1 Frontend target modules

Các file hiện hữu sẽ là anchor chính:

1. `frontend/src/components/KLineChartPanel.jsx`
2. `frontend/src/pages/WhaleAlertsDashboard.jsx`
3. `frontend/src/pages/StockDetail.jsx`
4. `frontend/src/hooks/useWhaleAnalyticsData.js`

Các module mới nên được tạo dưới namespace riêng, ví dụ:

1. `frontend/src/features/whale-alerts/kline/buildFlowViewModel.js`
2. `frontend/src/features/whale-alerts/kline/buildHeatmapOverlay.js`
3. `frontend/src/features/whale-alerts/kline/buildWhaleMarkerCandidates.js`
4. `frontend/src/features/whale-alerts/kline/flowNormalization.js`

### 2.2 Backend target modules

1. `backend/portfolio/services_whale_analytics_snapshot.py`
2. `backend/portfolio/views_whale_analytics.py`
3. tests thuộc `backend/portfolio/tests/`

### 2.3 Rendering layers

`KLineChartPanel` phải render theo thứ tự lớp sau:

1. `Candle layer`
2. `Heatmap overlay layer`
3. `Whale marker overlay layer`
4. `Flow technical panes`
5. `Tooltip / hover / badges`

Thứ tự này là bắt buộc để tránh marker bị heatmap che, hoặc heatmap phá readability của candle.

## 3. Flow View Model

### 3.1 Mục đích

`Flow View Model` là single in-memory truth cho toàn bộ chart intelligence của một symbol/timeframe/session.

Nó giải quyết 4 lỗi kiến trúc phổ biến:

1. tooltip map timestamp theo cách riêng,
2. pane lấy lookup khác,
3. marker tự tính từ payload khác,
4. heatmap suy diễn độc lập từ data chưa chuẩn hóa.

### 3.2 Shape bắt buộc

```js
{
  symbol,
  timeframe,
  selectedTradeDate,
  latestValidTradeDate,
  qualityState,
  buckets: [
    {
      ts,
      minuteKey,
      tradeDate,
      candleIndex,
      cvdRaw,
      cvdNormalized,
      buyStrength,
      institutionalStrength,
      whaleBuyValue,
      whaleSellValue,
      whaleScore,
      buyHeat,
      sellHeat,
      netHeat,
      confidence,
      hasFlowData,
      isWhaleExtreme,
    }
  ]
}
```

### 3.3 Canonical minute rule

1. `minuteKey` phải đi qua `toCanonicalMinute` một lần ở adapter layer.
2. Từ đó trở đi tooltip, pane, heatmap, marker chỉ đọc `minuteKey` đã canonical.
3. Không được gọi `new Date(...)` rải rác ở nhiều lớp render để tự map lại bucket.

## 4. Flow technical panes

### 4.1 Vai trò

Đây là cụm 2 pane phân tích chính cho dòng tiền, thay cho mô hình nhồi mọi metric vào một pane duy nhất.

### 4.2 Các line bắt buộc

1. Pane `CVD`: `CVD normalized` và `Baseline` trung tính.
2. Pane `Strength`: `Buy Strength` và `Institutional Strength`.
3. Hai pane phải dùng cùng trục X và cùng bucket mapping.

### 4.3 Chuẩn hóa CVD

`CVD raw` không được đẩy thẳng lên chung scale với `Strength`.

Khuyến nghị kỹ thuật:

1. Backend hoặc adapter frontend tính `cvdNormalized` trên thang `0-100`.
2. Giá trị `50` là trung tính.
3. `>50` là thiên mua chủ động.
4. `<50` là thiên bán chủ động.

Khuyến nghị công thức khóa ở ARC-03:

```text
scale = max(rolling_p95_abs_cvd_of_session, 1)
cvdNormalized = clamp(50 + 50 * (cvdRaw / scale), 0, 100)
```

### 4.4 Baseline

`Baseline` trong pane CVD là `50`, không phải `0`, vì pane này dùng scale chuẩn hóa 0-100.

### 4.5 Inline controls

Trên toolbar hoặc mép cụm pane phải có toggle hiển thị:

1. `Pane CVD`
2. `Pane Strength`

Mục tiêu là bật/tắt nhanh đúng pane kỹ thuật theo loại chỉ số, không ép người dùng xem mọi line trong cùng một khung hẹp.

### 4.6 Last-value badges

Mép phải cụm flow panes phải có 3 badge:

1. `CVD normalized`
2. `Buy Strength`
3. `Institutional Strength`

## 5. Heatmap overlay

### 5.1 Giai đoạn hiện tại

Chỉ triển khai heatmap theo `time bucket`, không phải footprint theo giá x thời gian.

### 5.2 Chế độ hiển thị

1. `Off`
2. `Net`
3. `Buy`
4. `Sell`

### 5.3 Semantics màu

1. `Buy mode`: xanh tăng dần theo `buyHeat`.
2. `Sell mode`: đỏ tăng dần theo `sellHeat`.
3. `Net mode`: diverging scale xanh/đỏ theo `netHeat`.
4. Độ đậm không được che mất candle body.

### 5.4 Shape dữ liệu

```js
{
  ts,
  buyHeat: 0-100,
  sellHeat: 0-100,
  netHeat: -100..100,
  whaleScore: 0-100,
  confidence: 0-100,
}
```

### 5.5 Guardrails

1. Nếu `confidence` thấp, heatmap phải giảm nhấn mạnh hoặc hiển thị degraded label.
2. Không được hiển thị màu mạnh khi dữ liệu bucket thực tế thiếu.
3. Không dùng heatmap để thay thế tooltip số liệu tuyệt đối.

## 6. Whale marker scoring

### 6.1 Candidate pool

Marker candidates được tạo từ bucket có whale activity hợp lệ, sau đó lọc theo viewport.

### 6.2 Score đề xuất

Khuyến nghị khóa ở ARC-03:

```text
markerScore =
  0.45 * matchedValuePercentile
  + 0.20 * eventScorePercentile
  + 0.15 * abs(netHeat)
  + 0.10 * institutionalStrength
  + 0.10 * confidence
```

Fallback nếu chưa có percentile:

```text
markerScore = abs(whaleBuyValue - whaleSellValue) + max(whaleBuyValue, whaleSellValue)
```

### 6.3 Visible selection

1. Lấy candidates thuộc viewport hiện tại.
2. Chọn top `max(1, ceil(visible*10%))` theo `markerScore`.
3. Sắp lại theo timestamp để render ổn định.

### 6.4 Dominance và màu marker

1. `Buy dominance` -> marker xanh.
2. `Sell dominance` -> marker đỏ.
3. `Low confidence` hoặc cân bằng -> marker trung tính hoặc không render.

## 7. Tooltip v2

### 7.1 Trường bắt buộc

Tooltip phải hiển thị tối thiểu:

1. timestamp tới giây,
2. OHLC,
3. volume,
4. whale buy value,
5. whale sell value,
6. `CVD raw`,
7. `CVD normalized`,
8. `Buy Strength`,
9. `Institutional Strength`,
10. heat level hiện tại,
11. whale score,
12. confidence hoặc degraded note nếu cần.

### 7.2 Nguồn dữ liệu

Tooltip không được tự lookup bằng timestamp riêng. Nó phải đọc từ `Flow View Model` bucket gắn với candle đang hover.

## 8. Selected session state machine

### 8.1 State sources

1. `firstLoad`
2. `symbolChange`
3. `timeframeChange`
4. `candleClick`
5. `tradeDateFixed`

### 8.2 Rules

1. `firstLoad` -> chọn `latestValidTradeDate`.
2. `candleClick` -> cập nhật `selectedTradeDate` theo candle đã click.
3. `symbolChange` -> reset selected session nếu symbol cũ khác symbol mới.
4. `timeframeChange` -> giữ selected session nếu session còn hợp lệ, ngược lại fallback `latestValidTradeDate`.
5. `hover` không được mutate selected session.

### 8.3 Bubble and advisory sync

Bubble chart và advisory chỉ consume selected session đã được khóa bởi click hoặc default session logic ở trên.

## 9. Backend contract details

### 9.1 Strategy

Mở rộng `build_whale_analytics_snapshot` thay vì tạo route song song.

### 9.2 Payload fields cần thêm

1. `flow_compare_series`
2. `heatmap_series`
3. `marker_series`
4. `session_context`
5. `quality_flags`

### 9.3 Quality states

Giá trị đề xuất:

1. `READY`
2. `DEGRADED_FLOW_MISSING`
3. `DEGRADED_HEATMAP_MISSING`
4. `DEGRADED_SESSION_FALLBACK`
5. `NO_VALID_SESSION`

### 9.4 Cache key versioning

Cache key phải thêm `contract_version` hoặc `workspace_mode` để tránh mix payload cũ và mới.

## 10. Performance design

### 10.1 Frontend

1. Flow View Model phải `useMemo` theo payload canonical, không recompute trên mọi hover.
2. Heatmap render chỉ theo visible data slice nếu thư viện hỗ trợ.
3. Marker recompute phải bám visible range callback hiện có.

### 10.2 Backend

1. Reuse cache baseline hiện có.
2. Không tính percentile nặng nếu workspace không cần.
3. Nếu phải chuẩn hóa CVD ở backend, dùng vectorized path hoặc cached session aggregates.

## 11. Test strategy

### 11.1 Frontend risks phải có test riêng

1. bucket parity giữa candle, tooltip, pane và heatmap,
2. line toggle không làm mutate sai data source,
3. heatmap mode switch đổi semantics đúng,
4. marker recompute theo viewport,
5. selected session reset đúng khi symbol đổi.

### 11.2 Backend risks phải có test riêng

1. payload additive backward-compatible,
2. `quality_flags` đúng khi thiếu flow/heatmap,
3. `default_trade_date` đúng,
4. cache key versioning đúng,
5. marker/heatmap sections đúng bucket time.

## 12. Observability

### 12.1 Client telemetry

1. selected session fallback count,
2. heatmap mode usage,
3. marker visible count,
4. tooltip bucket miss count nếu có assertion guard.

### 12.2 Server metrics

1. snapshot build ms,
2. cache hit rate,
3. degraded payload rate,
4. session fallback rate.

## 13. Failure modes và safeguard

1. `Correct-looking but wrong bucket`
   - safeguard: Flow View Model canonical minute map.
2. `Heatmap đẹp nhưng sai nghĩa`
   - safeguard: locked color semantics + quality flags.
3. `Marker density gây nhiễu`
   - safeguard: top 10% visible + density audit.
4. `Bubble/advisory stale after symbol switch`
   - safeguard: selected-session reset rules.
5. `Parallel truth giữa snapshot cũ và snapshot mới`
   - safeguard: additive extension trên route SSOT hiện có.

## 14. Acceptance invariants

Một slice chỉ được xem là đúng khi cùng lúc đúng cả 5 invariant:

1. cùng bucket,
2. cùng session truth,
3. không sửa source bubble,
4. không tạo parallel pipeline,
5. có evidence đủ để audit lại độc lập.