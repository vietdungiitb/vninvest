# IMPLEMENTATION PLAN — Stock Detail SaaS Native VNStockChart Redesign
## Feature: STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN | Ngày: 2026-05-22

---

## 1. Bối cảnh

Route `/stocks/:symbol` đã được cutover sang shell mới trong `packages/web`, nhưng bề mặt hiện tại mới đạt mức MVP:

- Có `VNStockChart` làm centerpiece.
- Có `OrderFlowRadarPanel` và một advisory card đơn giản.
- Chưa phục hồi đầy đủ command-center behavior của stock detail cũ.
- Chưa khai thác hết các native contracts đã có trong `packages/core`.
- Vẫn còn khoảng trống giữa page SaaS mới và stock workspace cũ về tính năng, mật độ thông tin và khả năng thao tác.

Mục tiêu của workstream này là thiết kế lại trang stock detail mới theo kiến trúc SaaS native, dùng `VNStockChart` làm surface trung tâm, và tách ownership hoàn toàn sang `packages/core` + `packages/web`, không tiếp tục phát triển business logic mới trong `frontend/` hoặc `backend/` cũ.

Visual target:

- Chart-first, facts-first.
- Stock workstation mật độ cao, nhưng chart vẫn là lớp thị giác số 1.
- Tham chiếu trực quan khóa theo ảnh VNStockChart đã chia sẻ: light analytical workspace, toolbar nằm trong chart shell, meta strip OHLC/indicator ngay dưới toolbar, price pane chiếm ưu thế, các pane phụ xếp dọc gọn phía dưới.
- Một nguồn truth duy nhất theo `selected session` từ chart.
- Các khối phụ trợ phải phục vụ chart workspace, không được tranh chiều ngang với chart ở desktop mặc định.

Lưu ý:

- Ảnh tham chiếu VNStockChart đã được dùng để khóa định hướng frontend cho workstream này. Tài liệu này ưu tiên layout và interaction model gần với ảnh mẫu, sau đó mới map vào ràng buộc nghiệp vụ của VNInvest.

---

## 2. Hiện trạng vs Mục tiêu

| Thành phần | Trạng thái hiện tại | Gap cần xử lý |
|---|---|---|
| Route `/stocks/:symbol` | Đã đi qua `packages/web` shell | Cần hoàn thiện page architecture, không chỉ thin MVP |
| Chart centerpiece | Đã có `VNStockChartPanel` với CVD pane và strength pane riêng | Cần trở thành state owner thực sự cho toàn page, không chỉ là chart block |
| Chart shell / toolbar / meta strip | Chưa có shell frontend đủ gần với VNStockChart reference | Thiếu control bar, OHLC/indicator strip, range footer và density kiểu workstation |
| Selected session truth | Có session selection cơ bản ở page mới | Chưa propagate đầy đủ cho toàn bộ panel phụ và user actions |
| Header / quote / actions | Mới có header tối giản + nút watch placeholder | Thiếu command bar cho tracked/watchlist/alert và context badges |
| Realtime contextual modules | Chưa có trong page mới | Thiếu intraday matched, depth/liquidity, session witness, nhưng các khối này phải là lane phụ trợ chứ không phải lane chính |
| Order flow lane | Mới chỉ có panel rời rạc | Chưa được đặt ngay dưới hero chart như một extension của chart workspace |
| Insight deck | Mới có whale mini list + advisory card | Thiếu tab/section điều phối advisory, alerts, news, fundamentals |
| Tracked symbols | Backend native đã có | `packages/web` chưa expose đủ write methods và page chưa dùng |
| Price alerts | Backend native đã có | `packages/web` chưa bọc adapter và page chưa dùng |
| Watchlist actions | Native workspace routes đã có | Page mới chưa dùng để add/remove symbol |
| News | Backend native hiện vẫn là stub | Cần backend completion hoặc defer khỏi P0 |
| Financials | Backend native hiện vẫn là stub | Cần backend completion hoặc defer khỏi P1 |
| Legacy dependency boundary | `frontend/src/pages/StockDetail.jsx` vẫn là reference nghiệp vụ | Cần khóa rõ: chỉ tham chiếu hành vi, không import/runtime coupling |

---

## 3. Scope

### Trong scope

- Thiết kế lại stock detail page theo kiến trúc SaaS native trong `packages/web`.
- Chuẩn hóa page-level state ownership cho `symbol`, `selected session`, `timeframe`, `visible range`, `blocking/deferred panel state`.
- Tổ chức lại information architecture cho `/stocks/:symbol` quanh `VNStockChart`.
- Reuse và mở rộng `coreApiAdapter` để dùng native `/core/v1/*` contracts hiện có.
- Bổ sung các native web panels cần thiết cho command center behavior.
- Hoàn thiện native contracts thật sự còn thiếu hoặc đang stub ở `packages/core` nếu bắt buộc cho page mới.
- Viết tests, audit gates, validation plan và evidence checklist cho từng slice.

### Ngoài scope

- Không phát triển feature business mới trong root `frontend/` hoặc root `backend/`.
- Không redesign `whale-alerts/:symbol` trong workstream này, trừ các redirect/cutover liên quan trực tiếp đến stock detail final state.
- Không xây full research terminal đa tab vượt quá nhu cầu stock detail hiện tại.
- Không thêm direct fetch ngoài `packages/web/src/adapters/coreApiAdapter.js`.
- Không cố materialize news/fundamentals giả ở client nếu backend native chưa có truth.

---

## 4. Architecture Notes

### 4.1 Ownership boundary

- `packages/web` sở hữu toàn bộ page composition, UI state và panel orchestration.
- `packages/core` sở hữu toàn bộ API contract, validation, tenant isolation và serving truth.
- Root `frontend/` và `backend/` chỉ là reference behavior để audit parity, không phải nơi implement runtime mới.

### 4.2 Canonical route

- Route canonical duy nhất: `/stocks/:symbol`.
- Entry phải tiếp tục đi qua shell host ở `packages/web/src/pages/market/ShellStockDetailPage.js`.
- Consumer shell ở root frontend chỉ làm bridge, không chứa business/data logic.

### 4.3 State contract page-level

`selectedSession` phải nằm tại page root, không duplicate ở child components.

```ts
type StockDetailPageState = {
  symbol: string
  activeTimeframe: '1m' | '5m' | '15m' | '1H' | 'D' | 'W'
  activePeriod: string
  selectedSession: {
    tradeDate: string
    timestamp: number
  } | null
  visibleRange: {
    startIndex?: number
    endIndex?: number
    fromTs?: number | null
    toTs?: number | null
  } | null
}
```

### 4.4 Data loading lanes

Tách dữ liệu thành 2 lane để tránh waterfall và giữ page responsive:

- Blocking lane: `symbol identity`, `quote snapshot`, `chart bars`, `selected-session-aware order flow summary`.
- Deferred lane: `tracked/watchlist state`, `price alerts`, `whale/alert summary`, `intraday matched`, `depth/liquidity`, `advisory history`, `news`, `financials`.

### 4.5 Facts-first rule

- Mọi panel phụ phải tiêu thụ normalized page view model hoặc selected-session payload.
- Không để từng panel tự chọn session truth riêng.
- Không browser-side synthesize business truth nếu `packages/core` đã có serving truth phù hợp.

### 4.6 Hard rules áp dụng cho redesign này

- `VNStockChart` là centerpiece bắt buộc.
- CVD và strength phải ở pane riêng, cùng trục X theo selected session truth.
- Chart shell phải đi theo topology của ảnh tham chiếu: top toolbar inline, meta strip OHLC/indicator ngay dưới, price pane chiếm ưu thế, các pane phụ xếp dọc gọn và đồng bộ trục X.
- `OrderFlowRadarPanel` phải nằm ngay dưới hero chart, không đặt ở right rail mặc định.
- Shark markers chỉ áp dụng cho top 10% nến đang hiển thị trong viewport.
- Heatmap giai đoạn này chỉ theo `time bucket`, không làm footprint theo giá x thời gian.
- Footer chart phải có lane cho range presets và action shortcuts nếu VNStockChart integration hỗ trợ.
- Mọi text mới trong `packages/web` phải qua i18n tiếng Việt đầy đủ dấu.
- Không thêm direct fetch song song ngoài `coreApiAdapter`.
- Không tái sử dụng runtime logic trực tiếp từ `frontend/src/pages/StockDetail.jsx`.

---

## 5. Frontend Design Direction

### 5.1 Visual Anchor Từ Ảnh VNStockChart

- Theme nền sáng kiểu analytical workstation là visual anchor mặc định; dark mode nếu có là biến thể sau, không phải baseline cho slice này.
- Chart card phải có control bar gắn trong shell, tối thiểu gồm: `symbol`, `timeframe`, `chart type`, `compare`, `replay`, `panes`, `live venue badge`.
- Ngay dưới control bar là `meta strip` hiển thị OHLC, volume, số nến hiển thị, các giá trị indicator chính như EMA/BB/CVD context.
- Price pane phải chiếm khoảng 60-70% chiều cao chart workspace; volume pane và các pane phân tích phía dưới chiếm phần còn lại theo chiều dọc.
- Range presets/action footer kiểu `1D`, `5D`, `1M`, `3M`, `YTD`, `1Y`, `All`, `Kịch bản`, `Cảnh báo`, `Giao dịch` là mẫu tham chiếu tốt cho interaction density của chart workspace.

### 5.2 Visual Hierarchy

1. Hero chart workspace là bề mặt số 1 và phải áp đảo thị giác.
2. Order flow lane ngay dưới chart là bề mặt số 2.
3. Context modules như intraday matched, depth/liquidity, user state là bề mặt số 3.
4. News, fundamentals, hồ sơ doanh nghiệp là bề mặt số 4.

### 5.3 Layout Blueprint

Desktop chuẩn:

```text
[Header bar: symbol, realtime quote, change, market cap, actions]
[Hero chart workspace full-width]
  [Top toolbar]
  [Meta strip OHLC/indicator]
  [Price pane + overlays]
  [Volume pane]
  [CVD pane]
  [Strength pane]
  [Range/action footer]
[OrderFlowRadarPanel full-width ngay dưới chart]
[Context deck 2-3 cột: intraday matched, liquidity/depth, alert/advisory summary]
[Deferred deck: news, financials, company profile]
```

Widescreen `>= 1600px`:

- Có thể có contextual side rail mảnh cho user state hoặc quick actions.
- Side rail không được lấy chiều ngang của hero chart xuống mức khiến chart mất cảm giác “workspace trung tâm”.

Laptop `1366px`:

- Không duy trì right rail cố định nếu làm chart hẹp.
- Context modules tự động chuyển xuống dưới `OrderFlowRadarPanel`.

### 5.4 Component Breakdown

1. `StockDetailHeaderBar`
2. `StockChartWorkspaceCard`
3. `StockChartToolbar`
4. `StockChartMetaStrip`
5. `StockSessionWitnessStrip`
6. `StockRangeActionFooter`
7. `StockOrderFlowLane`
8. `StockContextDeck`
9. `StockNewsPanelNative`
10. `StockFundamentalsPanelNative`

### 5.5 Responsive Behavior

- Desktop: hero chart full-width, order flow full-width, context deck theo 2-3 cột.
- Laptop: rút gọn control bar thành overflow menus, giữ chart rộng trước khi nghĩ đến side modules.
- Mobile: stack theo thứ tự `header -> quote -> command bar -> hero chart -> order flow -> context deck -> deferred modules`.

### 5.6 UI State Matrix

- `loading-blocking`: render skeleton nhưng giữ nguyên khung hero chart để tránh layout jump.
- `loading-deferred`: chart usable, modules dưới chart hiển thị skeleton riêng.
- `stale`: có badge thời gian dữ liệu cũ ở meta strip hoặc session witness strip.
- `empty`: hiển thị empty state mô tả rõ module nào chưa có dữ liệu.
- `partial-failure`: chỉ panel lỗi hiển thị recovery state, không kéo sập cả trang.

---

## 6. File Ownership Mục tiêu

### `packages/web`

- `packages/web/src/pages/market/ShellStockDetailPage.js`
- `packages/web/src/pages/StockDetailPage.js`
- `packages/web/src/adapters/coreApiAdapter.js`
- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.ts` or `.js`
- `packages/web/src/features/stock-detail/mappers/*`
- `packages/web/src/features/stock-detail/components/*`
- `packages/web/src/features/stock-detail/__tests__/*`

### `packages/core`

- `packages/core/backend/src/market_data/core_urls.py`
- `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
- `packages/core/backend/src/market_serving/native_views.py`
- `packages/core/backend/tests/test_stock_management_api_routes.py`
- `packages/core/backend/tests/test_market_serving_api_routes.py`

### Reference-only sources

- `frontend/src/pages/StockDetail.jsx`
- `frontend/src/api/client.js`

---

## 7. Task Breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| SD-00 | Contract & parity inventory | plan delta + adapter matrix | Chốt reuse/wrap/missing/stub, không còn ambiguity trước khi code |
| SD-01 | VNStockChart workspace contract & page architecture | chart workspace model + page orchestrator + feature folder | Khóa chart shell, pane topology, selected-session contract, viewport rules, page ownership |
| SD-02 | Hero workspace frontend redesign | header, quote, toolbar, meta strip, hero chart, session strip | `/stocks/:symbol` có chart-first workstation shell đúng ảnh tham chiếu |
| SD-03 | Order flow lane & contextual modules | order flow lane + intraday/depth/liquidity context | OrderFlow nằm đúng dưới chart; modules phụ không tranh chart |
| SD-04 | Insight deck native | advisory/alerts/news/fundamentals selected-session-aware | Dưới order flow có deck bám selected session truth và deferred states rõ |
| SD-05 | Adapter completion | `coreApiAdapter.js` | Watchlist/tracked/alerts/advisory APIs được bọc đầy đủ |
| SD-06 | Core contract completion | `packages/core` market_data / market_serving | Chỉ bổ sung endpoint thật sự thiếu hoặc đang stub blocker |
| SD-07 | P1 enrichment + final cutover audit | news/fundamentals/deferred panels | Hoàn thiện parity còn thiếu và khóa regression evidence |

---

## 8. Dependency Graph

```text
SD-00 -> SD-01 -> SD-02 -> SD-03 -> SD-04 -> SD-07
       \-> SD-05 -/
         \-> SD-06 -/
```

Quy tắc:

- SD-05 chỉ được làm sau khi SD-00 xác định đúng adapter gaps.
- SD-06 chỉ được làm nếu SD-05 không đủ để hoàn thành page bằng native contracts hiện có.
- SD-07 chỉ bắt đầu khi SD-02, SD-03, SD-04 đã pass focused validation.

---

## 9. Detailed Task Specs

### SD-00 — Contract & Parity Inventory

**Mục tiêu:**

Khóa chính xác khoảng cách giữa page cũ và page mới, đồng thời chốt native API nào đã dùng được ngay, API nào cần bọc lại, API nào vẫn là stub thực sự.

**Files bị ảnh hưởng:**

- `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` (this file, refine if needed)
- Optional: `docs/TASKBOARD_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` (nếu tách taskboard sau)

**Deliverables:**

- Bảng `legacy feature -> native target -> endpoint -> owner -> status`.
- Bảng `adapter method -> exists / missing / wrap needed`.
- Danh sách backend stubs blocker thật sự.

**DoD:**

- [ ] Không còn ambiguity về tracked symbols, price alerts, watchlists, advisory, news, financials.
- [ ] Đã xác nhận selected-session contract cho chart, flow, advisory.
- [ ] Đã chốt file ownership để code team làm không phải hỏi lại.

**Không thuộc scope task này:**

- Không chỉnh code runtime.

---

### SD-01 — VNStockChart Workspace Contract & Page Architecture

**Mục tiêu:**

Khóa chart workspace contract và tái cấu trúc `packages/web` stock detail page theo feature-module architecture, biến page thành orchestrator mỏng với page-level state owner duy nhất.

**Files bị ảnh hưởng:**

- `packages/web/src/pages/StockDetailPage.js` (MODIFY)
- `packages/web/src/pages/market/ShellStockDetailPage.js` (MODIFY)
- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.*` (CREATE)
- `packages/web/src/features/stock-detail/mappers/*` (CREATE)
- `packages/web/src/features/stock-detail/components/*` (CREATE)

**Interface / Signature cần implement:**

```ts
export function useStockDetailPageModel(args: {
  env?: object
  symbol: string
}): {
  loadingState: {
    blocking: boolean
    deferred: boolean
  }
  pageState: StockDetailPageState
  actions: {
    setActiveTimeframe(next: string): void
    setActivePeriod(next: string): void
    setSelectedSession(next: { tradeDate: string; timestamp: number } | null): void
    setVisibleRange(next: object | null): void
    refreshBlocking(): Promise<void>
    refreshDeferred(): Promise<void>
  }
  viewModel: StockDetailPageViewModel
}
```

```ts
type StockChartWorkspaceModel = {
  toolbar: {
    symbol: string
    timeframe: string
    chartType: string
    compareEnabled: boolean
    replayEnabled: boolean
    panesControlEnabled: boolean
    liveVenueLabel: string | null
  }
  metaStrip: {
    open?: number
    high?: number
    low?: number
    close?: number
    volume?: number
    visibleBarCount?: number
    indicatorSummary: Array<{ key: string; label: string; value: string }>
  }
}
```

**Test cases bắt buộc:**

1. Symbol thay đổi phải reset selected session đúng cách.
2. Timeframe đổi không làm child panels tự giữ session cũ sai symbol.
3. Blocking error không làm crash shell; deferred error không che chart.
4. Viewport đổi phải cho phép recompute shark-marker candidate set mà không phá page state.

**DoD:**

- [ ] `StockDetailPage` không còn fan-out thô rải rác qua nhiều state độc lập.
- [ ] Chart toolbar, meta strip, visible range và selected session cùng thuộc một page model nhất quán.
- [ ] Child panels nhận normalized view model hoặc action props, không fetch tùy tiện.
- [ ] `ShellStockDetailPage` chỉ còn routing/shell concerns.

**Không thuộc scope task này:**

- Chưa làm visual redesign hoàn chỉnh.

---

### SD-02 — Hero Workspace Frontend Redesign

**Mục tiêu:**

Biến vùng đầu trang thành chart-first workstation đúng với ảnh VNStockChart tham chiếu, gồm identity, live quote, toolbar, meta strip, hero chart và session witness strip.

**Files bị ảnh hưởng:**

- `packages/web/src/pages/StockDetailPage.js` (MODIFY)
- `packages/web/src/features/stock-detail/components/StockDetailHeaderBar.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockPrimaryQuoteCard.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockChartToolbar.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockChartMetaStrip.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockSessionWitnessStrip.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockRangeActionFooter.*` (CREATE)
- `packages/web/src/pages/StockDetailPage.css` or feature CSS file (MODIFY)

**Interface / Signature cần implement:**

```ts
type StockChartToolbarProps = {
  symbol: string
  timeframe: string
  chartType: string
  liveVenueLabel?: string | null
  onTimeframeChange(next: string): void
  onChartTypeChange(next: string): void
  onOpenCompare(): void
  onToggleReplay(): void
  onOpenPanesManager(): void
}
```

**Test cases bắt buộc:**

1. Page hiển thị đúng khi có dữ liệu đầy đủ.
2. Page hiển thị đúng khi thiếu một phần snapshot nhưng vẫn còn chart.
3. Symbol invalid phải vào not-found state, không render placeholder giả.
4. Toolbar không lấn át chart; meta strip phải scan nhanh được như ảnh tham chiếu.

**DoD:**

- [ ] `VNStockChart` vẫn là centerpiece.
- [ ] Toolbar, meta strip, witness strip và footer actions tạo thành một chart shell hoàn chỉnh.
- [ ] Price pane giữ ưu thế rõ ràng so với volume/CVD/strength panes.
- [ ] Layout desktop và mobile đều render hợp lý.

**Không thuộc scope task này:**

- Chưa làm deck phía dưới chart.

---

### SD-03 — Order Flow Lane & Contextual Modules

**Mục tiêu:**

Đặt `OrderFlowRadarPanel` làm lane full-width ngay dưới hero chart và đưa các module realtime phụ trợ sang vai trò contextual blocks, không cạnh tranh trực tiếp với chart.

**Files bị ảnh hưởng:**

- `packages/web/src/features/stock-detail/components/StockOrderFlowLane.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockIntradayMatchedPanel.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockDepthOrLiquidityPanel.*` (CREATE)
- `packages/web/src/pages/StockDetailPage.js` (MODIFY)
- `packages/web/src/adapters/coreApiAdapter.js` (MODIFY if new adapter methods needed)
- `packages/core/backend/src/market_serving/native_views.py` (MODIFY only if native contract missing)

**Interface / Signature cần implement:**

```ts
type StockOrderFlowLaneProps = {
  symbol: string
  selectedSession: { tradeDate: string; timestamp: number } | null
  flowModel: object
}
```

```ts
getRealtimeTicker(symbol: string): Promise<object>
getRealtimeIntraday(symbol: string, params?: { page_size?: number }): Promise<object>
getRealtimeDepthOrLiquidity(symbol: string): Promise<object>
```

**Test cases bắt buộc:**

1. Intraday panel hiển thị stale/empty states minh bạch.
2. Depth/liquidity panel không render dữ liệu giả nếu native chưa có truth.
3. Order flow lane luôn nằm ngay dưới chart ở desktop và laptop.
4. Module contextual lỗi không được kéo sập whole page.

**DoD:**

- [ ] `OrderFlowRadarPanel` full-width nằm đúng ngay dưới chart.
- [ ] Có ít nhất 2 contextual modules native hữu ích dưới order flow lane.
- [ ] Realtime statuses có timestamp/staleness witness.
- [ ] Không có direct dependency vào root legacy components.

**Không thuộc scope task này:**

- Không cố clone 100% giao diện cũ từng pixel.

---

### SD-04 — Insight Deck Native

**Mục tiêu:**

Tạo insight deck phía dưới order flow lane, tổ chức `alerts`, `advisory`, `news`, `fundamentals` quanh selected session truth và deferred state matrix rõ ràng.

**Files bị ảnh hưởng:**

- `packages/web/src/features/stock-detail/components/StockInsightDeck.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockAlertSummaryPanel.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockAdvisoryPanel.*` (CREATE)
- `packages/web/src/features/stock-detail/components/StockNewsPanelNative.*` (CREATE or MODIFY)
- `packages/web/src/features/stock-detail/components/StockFundamentalsPanelNative.*` (CREATE or MODIFY)
- `packages/web/src/pages/StockDetailPage.js` (MODIFY)
- `packages/web/src/adapters/coreApiAdapter.js` (MODIFY if advisory helper methods needed)

**Interface / Signature cần implement:**

```ts
type StockInsightDeckProps = {
  symbol: string
  selectedSession: { tradeDate: string; timestamp: number } | null
  alertSummaryModel: object
  advisoryModel: object
  newsModel: object
  fundamentalsModel: object
}
```

**Test cases bắt buộc:**

1. Đổi selected session trên chart phải đổi advisory summary tương ứng.
2. Alert summary phải ưu tiên symbol-scoped server truth.
3. News/fundamentals nếu chưa có native truth phải hiện degraded state đúng.
4. Tab/section switching không gây duplicate fetch vô ích.

**DoD:**

- [ ] Insight deck bám selected session truth.
- [ ] Advisory không còn chỉ là card tối giản.
- [ ] News/fundamentals không được dựng giả ở client.
- [ ] Từng module trong deck có loading/empty/stale/error state riêng.

**Không thuộc scope task này:**

- Chưa đưa news/fundamentals vào deck nếu backend chưa sẵn.

---

### SD-05 — Adapter Completion

**Mục tiêu:**

Làm đầy `coreApiAdapter` để page mới thao tác được tracked/watchlist/alerts/advisory bằng native contracts, không cần quay lại `frontend/src/api/client.js`.

**Files bị ảnh hưởng:**

- `packages/web/src/adapters/coreApiAdapter.js` (MODIFY)
- `packages/web/src/adapters/coreApiAdapter.test.js` (MODIFY)

**Interface / Signature cần implement:**

```ts
addTrackedSymbol(symbol: string, sourceGroupId?: number | null, whaleAlertThresholdMillion?: number | null): Promise<object>
removeTrackedSymbol(id: number): Promise<void>
getPriceAlerts(): Promise<object[]>
createPriceAlert(payload: CreatePriceAlertPayload): Promise<object>
updatePriceAlert(id: number, payload: object): Promise<object>
deletePriceAlert(id: number): Promise<void>
getStockNews(symbol: string, params?: object): Promise<object>
getStockFinancials(symbol: string): Promise<object>
```

**Test cases bắt buộc:**

1. Adapter build đúng path `/core/v1/*` cho từng method.
2. Missing symbol/watchlistId phải throw rõ ràng.
3. Query params phải được encode đúng.

**DoD:**

- [ ] Page mới không cần fallback về legacy `client.js` cho user actions cốt lõi.
- [ ] Unit tests adapter pass.

**Không thuộc scope task này:**

- Không sửa UI ngoài call site cần thiết.

---

### SD-06 — Core Contract Completion

**Mục tiêu:**

Chỉ bổ sung hoặc hoàn thiện đúng các native endpoints đang block redesign vì chưa có truth usable.

**Files bị ảnh hưởng:**

- `packages/core/backend/src/market_data/stock_mgmt_native_views.py` (MODIFY)
- `packages/core/backend/src/market_data/core_urls.py` (MODIFY)
- `packages/core/backend/src/market_serving/native_views.py` (MODIFY if needed)
- `packages/core/backend/tests/test_stock_management_api_routes.py` (MODIFY)
- `packages/core/backend/tests/test_market_serving_api_routes.py` (MODIFY)

**Candidate gaps dự kiến:**

- News native hiện stub.
- Financials native hiện stub.
- Symbol-scoped alert summary wrapper nếu current feed contracts quá rộng cho page.
- Aggregate snapshot endpoint chỉ khi above-the-fold cần giảm request count thực sự.

**Test cases bắt buộc:**

1. 404/401/403/error envelope đúng chuẩn OpenAPI constitution.
2. Symbol validation chặn input xấu.
3. Tenant-scoped reads không rò dữ liệu cross-tenant.

**DoD:**

- [ ] Mọi endpoint mới có OpenAPI metadata.
- [ ] Tests route + serializer pass.
- [ ] Không dùng legacy bridge hoặc monolith fallback cho feature mới.

**Không thuộc scope task này:**

- Không mở rộng backend ngoài những blocker đã chứng minh được từ SD-00.

---

### SD-07 — P1 Enrichment + Final Cutover Audit

**Mục tiêu:**

Hoàn thiện các panel deferred, khóa validation, evidence, và xác nhận stock detail SaaS-native đủ thay thế page cũ về runtime behavior mục tiêu.

**Files bị ảnh hưởng:**

- `packages/web/src/pages/StockDetailPage.js` (MODIFY)
- `packages/web/src/features/stock-detail/components/*` (MODIFY)
- `docs/*` audit/evidence files as needed

**Test cases bắt buộc:**

1. Browser smoke `/stocks/FPT`, `/stocks/HPG`, `/stocks/VCB`.
2. Invalid symbol returns not-found UI đúng.
3. Selected session switch không phá advisory/flow truth.
4. Tracked/watchlist/alert actions hoạt động qua native API.
5. Hero workspace, order flow lane và context deck giữ đúng thứ bậc thị giác theo tài liệu.

**DoD:**

- [ ] P0 surfaces hoàn chỉnh và ổn định.
- [ ] P1 surfaces có degraded state đúng nếu backend chưa có truth đầy đủ.
- [ ] Audit evidence đủ để reviewer kiểm lại không cần đoán.

**Không thuộc scope task này:**

- Không tạo workstream mới ngoài stock detail redesign.

---

## 10. Validation Gates

### Toàn workstream

- [ ] `get_errors` trên mọi file chạm vào không có diagnostics mới.
- [ ] Unit/integration tests cho `packages/web` pass.
- [ ] Focused backend tests cho `packages/core` pass.
- [ ] `git diff --check` sạch.
- [ ] Scan cấm `print(`, `console.log`, direct legacy imports.
- [ ] `python scripts/ops/generate_module_tree.py` chạy nếu source modules thay đổi cấu trúc cần phản ánh.
- [ ] `./start_dev.ps1` chạy thành công sau mỗi slice code xong.

### Browser smoke tối thiểu

- [ ] `/stocks/FPT`: chart render, selected session đổi được.
- [ ] `/stocks/HPG`: tracked/watchlist/alert actions hoạt động.
- [ ] `/stocks/VCB`: right rail realtime panels không lỗi.
- [ ] `/stocks/INVALID`: not-found state đúng.

---

## 11. Governance Artifacts

- `CODE_CHANGE_AUDIT_LEDGER.md`: cập nhật sau mỗi slice code.
- `PROGRESS_DASHBOARD.md`: cập nhật trạng thái workstream.
- `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`: cập nhật danh sách file sửa.
- `module_tree_full.md`: regenerate khi có source modules mới hoặc move đáng kể.
- Commit riêng mỗi slice, push lên `dev` ngay sau khi validation pass.

---

## 12. Risks

| Risk | Probability | Mitigation |
|---|---|---|
| Adapter chưa bọc đủ native methods, khiến page quay lại `client.js` legacy | High | Chốt SD-05 sớm, block mọi direct fetch ngoài adapter |
| News/financials native vẫn là stub làm plan bị overpromise | High | Xử lý như deferred P1, chỉ ship khi backend truth sẵn |
| Selected session bị duplicate state giữa chart và deck | High | Khóa state owner ở page root từ SD-01 |
| Realtime right rail gây waterfall hoặc render nặng | Medium | Deferred lane + lazy mount + panel-level error boundary |
| UI density cao nhưng khó dùng trên laptop nhỏ | Medium | Quy định responsive/collapse rõ từ SD-02, SD-03 |
| Scope creep thành “full trading terminal” | Medium | Giữ strict scope theo P0/P1 ở mục 3 |
| Tái sử dụng nhầm logic root `frontend/` làm vỡ boundary SaaS-native | High | Reference-only rule + code review grep imports |

---

## 13. Open Assumptions / Decision Notes

1. `VNStockChart` hiện tại là visual foundation bắt buộc và đủ trưởng thành để giữ làm centerpiece.
2. Tracked symbols và price alerts sẽ dùng native `packages/core` routes hiện có; không cần tạo contract mới nếu adapter wrapper là đủ.
3. News và financials chỉ được đưa vào native page nếu backend không còn trả stub.
4. Nếu ảnh mục tiêu chi tiết được share sau, có thể bổ sung `FRONTEND_DESIGN_*` doc riêng; implementation plan này vẫn giữ hiệu lực về architecture và execution order.

---

## 14. Exit Criteria

Workstream chỉ được coi là done khi đồng thời đạt các điều kiện sau:

- `/stocks/:symbol` là stock detail SaaS-native hoàn chỉnh, không dựa vào root legacy runtime logic.
- `VNStockChart` là selected-session truth owner cho toàn page.
- Tracked/watchlist/alert actions chạy qua native contracts trong `packages/core`.
- Right rail và insight deck đủ thay thế workflow phân tích chính của stock detail cũ.
- Mọi bề mặt còn thiếu do backend stub đều có degraded state rõ ràng hoặc đã được native hóa.
- Có đầy đủ evidence để reviewer/auditor kiểm lại mà không cần đọc lại toàn bộ codebase.

---

## 15. Khuyến nghị thực thi

Thứ tự thực thi an toàn nhất:

1. SD-00
2. SD-01
3. SD-05
4. SD-02
5. SD-03
6. SD-04
7. SD-06 nếu còn blocker thật sự
8. SD-07

Lý do:

- Khóa contract và adapter trước sẽ giúp tránh rework UI.
- Hoàn thiện above-the-fold sớm để page usable ngay.
- Chỉ chạm backend khi chắc chắn page không thể hoàn thành bằng native contracts hiện có.
