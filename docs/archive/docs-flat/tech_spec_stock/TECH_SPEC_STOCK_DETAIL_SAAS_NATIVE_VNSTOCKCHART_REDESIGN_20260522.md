# TECH SPEC — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Scope**: Frontend layout contract, chart workspace semantics, adapter/backend boundaries, response assumptions, và quality invariants để triển khai `/stocks/:symbol` mà không drift thiết kế.

---

## 1. Nguyên tắc kỹ thuật bất biến

1. `VNStockChart` là render plane trung tâm và là selected-session truth owner.
2. Chart shell phải theo topology ảnh tham chiếu: toolbar, meta strip, price pane dominant, pane stack dọc, footer actions.
3. `Price`, `Volume`, `CVD`, `Strength` là 4 lane logic cơ bản của workspace; `CVD` và `Strength` không được gộp chung pane.
4. `OrderFlowRadarPanel` là extension của hero chart, không phải card phụ ở cạnh phải.
5. Selected session phải nằm ở page root; child panels không được tự giữ truth riêng.
6. `Shark markers` chỉ được tính theo viewport hiện tại.
7. `Heatmap` chỉ theo `time bucket` ở phase này.
8. Mọi web reads/writes phải đi qua `coreApiAdapter`.
9. Mọi backend change nếu có phải ở `packages/core/backend/` và expose qua `/core/v1/*`.
10. Nếu native backend chưa có truth cho `news`/`financials`, frontend phải degrade rõ ràng thay vì tự synthesize.

---

## 2. Canonical architecture

```text
Browser
→ consumer host bridge
→ ShellStockDetailPage
→ StockDetailPage
→ useStockDetailPageModel
→ coreApiAdapter
→ /core/v1/*
```

### Forbidden outcomes

1. `frontend/src/pages/StockDetail.jsx` được coi là implementation surface mới.
2. `frontend/src/api/client.js` là canonical stock-detail data plane.
3. `packages/web` tự `fetch()` trực tiếp trong page/components để đi tắt adapter.
4. Backend thêm route business mới dưới legacy `/api/*` chỉ để phục vụ redesign.

---

## 3. Page state contract

```ts
type SelectedSession = {
  tradeDate: string
  timestamp: number
} | null

type VisibleRange = {
  startIndex?: number
  endIndex?: number
  fromTs?: number | null
  toTs?: number | null
} | null

type StockDetailPageState = {
  symbol: string
  activeTimeframe: '1m' | '5m' | '15m' | '1H' | 'D' | 'W'
  activePeriod: string
  selectedSession: SelectedSession
  visibleRange: VisibleRange
}
```

### Invariants

1. Symbol đổi phải reset `selectedSession` và `visibleRange`.
2. Timeframe đổi không được giữ session cũ sai symbol.
3. `selectedSession` là input bắt buộc cho `OrderFlowRadarPanel`, `advisory`, `alert summary`, và các context modules phụ thuộc session.

---

## 4. Chart workspace contract

### 4.1 Toolbar contract

```ts
type StockChartToolbarModel = {
  symbol: string
  timeframe: string
  chartType: string
  compareEnabled: boolean
  replayEnabled: boolean
  panesControlEnabled: boolean
  liveVenueLabel: string | null
}
```

Toolbar tối thiểu phải có:

1. symbol context
2. timeframe switcher
3. chart type switcher
4. compare action
5. replay action
6. panes manager
7. live venue badge

### 4.2 Meta strip contract

```ts
type StockChartMetaStripModel = {
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  visibleBarCount?: number
  indicatorSummary: Array<{ key: string; label: string; value: string }>
}
```

Meta strip phải cho phép scan nhanh OHLC + indicator summary như ảnh tham chiếu. Không được biến thành khối text nặng.

### 4.3 Pane rules

1. `Price pane` chiếm 60-70% chiều cao workspace.
2. `Volume pane` giữ mỏng, không tranh chart.
3. `CVD pane` là pane riêng với normalized semantics.
4. `Strength pane` là pane riêng cho `Buy Strength` và `Institutional Strength`.
5. Tất cả panes đồng bộ trục X.

### 4.4 Overlay rules

1. Whale bubbles nằm trên price pane.
2. Shark icons chỉ recompute theo visible range.
3. Heatmap bands dùng `time bucket` semantics.
4. Không đưa RSI/MACD/Bollinger thành narrative chính của workspace; chúng chỉ là supporting layers nếu được bật.

---

## 5. Data loading lanes

### Blocking lane

1. symbol identity/profile core
2. live quote snapshot
3. chart bars + overlay facts
4. selected-session-aware order flow summary tối thiểu

### Deferred lane

1. tracked/watchlist/user state
2. price alerts
3. alert summary
4. advisory history
5. intraday matched
6. depth/liquidity
7. news
8. financials

Blocking errors không được kéo sập shell; deferred errors chỉ được cô lập ở module liên quan.

---

## 6. Frontend component responsibilities

| Component | Responsibility | Must not do |
|---|---|---|
| `ShellStockDetailPage` | Resolve symbol + bridge runtime env | Chứa data orchestration business |
| `StockDetailPage` | Compose page using one root view model | Tự gọi nhiều fetch fan-out rải rác |
| `useStockDetailPageModel` | SSOT for symbol/session/visible-range/loading lanes | Render UI trực tiếp |
| `VNStockChartPanel` | Render workspace + emit selected session + visible range | Tự fetch business data ngoài chart inputs |
| `OrderFlowRadarPanel` | Hiển thị flow lane theo selected session | Tự chọn session khác chart |
| Context modules | Render session-aware or symbol-aware panels | Tạo business truth mới ở client |

---

## 7. Adapter contract

### Existing/required wrappers

```ts
getStockProfile(symbol)
getStockChartHistory(symbol, params?)
getStockOrderFlow(symbol, params?)
getSessionFactsCvd(symbol, params?)
getWhaleAnalyticsSnapshot(symbol, params?)
getAdvisoryLatest(symbol, params?)
getAdvisoryHistory(symbol, params?)
getTrackedSymbols(params?)
addTrackedSymbol(symbol, sourceGroupId?, whaleAlertThresholdMillion?)
removeTrackedSymbol(id)
getWatchlists()
addWatchlistItem(watchlistId, symbol)
removeWatchlistItem(watchlistId, symbol)
getPriceAlerts(params?)
createPriceAlert(payload)
updatePriceAlert(id, payload)
deletePriceAlert(id)
getStockNews(symbol, params?)
getStockFinancials(symbol)
```

### Adapter rules

1. All path building must live in `coreApiAdapter`.
2. Input validation tại adapter boundary là bắt buộc.
3. Adapter tests phải lock path, query params, and error propagation.

---

## 8. Backend design rules

### 8.1 Default no-change policy for backend in v1

Nếu existing native endpoints + adapter wrappers đủ dùng, backend không được sửa chỉ để phục vụ bố cục UI.

### 8.2 If backend change is unavoidable

Chỉ được phép khi đồng thời đạt:

1. file change nằm trong `packages/core/backend/`
2. route mới/nâng cấp nằm dưới `/core/v1/*`
3. OpenAPI metadata được cập nhật
4. route tests + native tests được bổ sung
5. no new compat `/api/*` business route

### 8.3 Allowed backend touch areas

1. `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
2. `packages/core/backend/src/market_data/core_urls.py`
3. `packages/core/backend/src/market_serving/native_views.py`
4. `packages/core/backend/tests/test_stock_management_api_routes.py`
5. `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py`

### 8.4 Backend constraints by concern

| Concern | Default policy |
|---|---|
| News | Nếu còn stub, frontend degrade; backend chỉ làm thật nếu có source + contract rõ |
| Financials | Nếu còn stub, frontend degrade; không fabricate từ provider path ngầm |
| Depth/liquidity | Chỉ expose nếu native truth usable; không dùng mock |
| Aggregate endpoint | Chỉ mở khi chứng minh request fan-out là blocker thực sự |

---

## 9. Error and degraded-state semantics

### Frontend state matrix

1. `loading-blocking`: giữ shell chart ổn định bằng skeleton.
2. `loading-deferred`: chart usable, module dưới chart skeleton riêng.
3. `stale`: có witness badge ở meta strip hoặc context module.
4. `empty`: nói rõ chưa có dữ liệu, không dùng copy mơ hồ.
5. `partial-failure`: panel lỗi độc lập, whole page vẫn dùng được.

### Backend error policy if touched

1. Error envelope theo chuẩn core-api.
2. Input symbol invalid phải fail rõ ràng.
3. Không `except: pass` trong request path.

---

## 10. Observability and validation requirements

1. Browser smoke bắt buộc trên `/stocks/FPT`, `/stocks/HPG`, `/stocks/VCB`, `/stocks/INVALID`.
2. `npm run check:stock-detail-shell` trong `packages/web` là gate bắt buộc.
3. `npm run build-community` trong `packages/web` là package-level build sanity gate.
4. Root consumer frontend phải `npm run build` pass.
5. Focused backend suites phải pass nếu backend touched.
6. `./start_dev.ps1` là runtime refresh gate bắt buộc trước final evidence.
