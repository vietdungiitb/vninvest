# THIẾT KẾ GIAO DIỆN PORTFOLIO MANAGEMENT — ĐẲNG CẤP PHẦN MỀM THƯƠNG MẠI

**Ngày:** 2026-09-27  
**Phạm vi:** Toàn bộ giao diện portfolio (overview, holdings, activity, analytics, broker hub, order)  
**Loại:** Thiết kế UI/UX specification — KHÔNG code  
**Reference:** Bloomberg Terminal, TradingView, Refinitiv Eikon, VNĐỰC, SOC DataOps hiện tại

---

## PHẦN I: ĐÁNH GIÁ THỰC TRẠNG UI

### 1.1 Hiện tại — Giao diện đang có

**PortfoliosPage.tsx** (142 dòng) — Visual Quality: **3/10**

```
┌─────────────────────────────────────────────┐
│  eyebrow: "Portfolio"  title: "Danh mục     │
│           đầu tư"                            │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐   │
│  │ DNSEConnectionPanel (513 dòng)       │   │
│  │  - Credential form                   │   │
│  │  - Sync buttons                      │   │
│  │  - OTP flow                          │   │
│  │  - Order form (trộn lẫn!)            │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  Form: "Tạo danh mục mới" (hardcode VI)    │
│  [Tên: ___________] [Tiền tệ: VND ▼]       │
│  [Tạo danh mục]                            │
├─────────────────────────────────────────────┤
│  Table: Tên | Tiền tệ | Trạng thái | Ngày  │
│  tạo | Thao tác                            │
│  [Xóa button trên mỗi row]                 │
└─────────────────────────────────────────────┘
```

**Missing hoàn toàn:**
- Không có portfolio selector dropdown để switch giữa các danh mục
- Không có KPI cards (total value, P&L, return %, holdings count)
- Không có chart/visualization nào trên trang portfolio
- Không có holdings table (thông tin chi tiết từng cổ phiếu)
- Không có allocation chart
- Không có performance metrics
- Không có search/filter trên table
- Không có sortable columns
- Không có pagination
- Không có responsive design (table chỉ có 1 breakpoint @640px)
- Không có ARIA labels
- Không có light mode support
- Tất cả string hardcode tiếng Việt, không dùng i18n

### 1.2 So sánh trực quan với thương mại

| Khía cạnh | Bloomberg/TradingView | vninvest hiện tại | Gap |
|-----------|---------------------|-------------------|-----|
| **KPI summary** | 4-6 metric cards với sparkline phía trên | KHÔNG CÓ | **Critical** |
| **Portfolio selector** | Dropdown với search, health badge | Sidebar only, no inline | **Critical** |
| **Holdings table** | 10+ columns, sort, filter, pagination | Basic 5-column table | **High** |
| **Equity curve** | Real-time chart trên mỗi portfolio | Chỉ có trên Dashboard heatmap | **High** |
| **Allocation viz** | Treemap/donut/sector bar | KHÔNG CÓ trên portfolio page | **High** |
| **P&L breakdown** | Realized/unrealized/dividend per holding | KHÔNG CÓ | **Critical** |
| **Risk metrics** | VaR, Sharpe, drawdown, volatility | KHÔNG CÓ | **High** |
| **Breadcrumb/nav** | Portfolio > Holdings > Detail | KHÔNG CÓ | **Medium** |
| **Dark/Light mode** | Full both modes | Dark only | **Medium** |
| **i18n** | 100% tokenized | ~30% hardcoded | **High** |
| **A11y** | ARIA labels, keyboard nav | None | **High** |
| **Order execution** | Separate page/modal with confirmation | Inside connection panel | **Critical** |
| **Widget config** | Drag-drop, collapse, resize | None | **Medium** |
| **Responsive** | 4+ breakpoints | 1 breakpoint | **Medium** |
| **Loading states** | Skeleton screens | Text "Đang tải..." | **Low** |
| **Empty states** | Illustrated, actionable | Text "Chưa có..." | **Low** |

### 1.3 Lý do giao diện hiện tại không đạt thương mại

1. **Một page chứa quá nhiều trách nhiệm** — PortfoliosPage = list + create + DNSE panel + delete. Bloomberg có separate tabs cho mỗi view.
2. **Thiếu thông tin quyết định** — Investor không biết portfolio đang làm gì (P&L bao nhiêu, return %, risk) mà phải vào từng holding.
3. **Trộn cấu hình với giao dịch** — DNSEConnectionPanel trộn credential management (cấu hình) với order placement (giao dịch). Đây là UX error nghiêm trọng.
4. **Không có visual hierarchy** — Tất cả elements có cùng visual weight. Commercial UI có KPI cards lớn > table > form > text.
5. **Thiếu dữ liệu time-series** — Không có equity curve, không có performance trend — investor không thể đánh giá historical performance.

---

## PHẦN II: THIẾT KẾ TARGET — 4 TRANG CHÍNH

### 2.1 Layout hệ thống (dựa trên SOC design system hiện tại)

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         SIDEBAR (w-72 / w-16)                             │
│  ┌─────────┐  "Danh mục"  icon                                           │
│  │Briefcase│  Portfolio      ▼                                            │
│  └─────────┘  ├─ Overview                                                   │
│               ├─ Holdings                                                   │
│               ├─ Activity                                                   │
│               └─ Analytics                                                  │
│  ┌─────────┐  "Giao dịch" icon                                            │
│  │Wallet   │  Broker Hub                                                   │
│  └─────────┘  ├─ Providers                                                 │
│               ├─ Sync Center                                               │
│               └─ Orders                                                    │
│  ┌─────────┐  Alert icon                                                  │
│  │Bell     │  Alert Center                                                 │
│  └─────────┘                                                               │
│  ── Profile ──                                                            │
│  [Avatar] John Doe  ▼                                                     │
│  ── Tenant Switch ──                                                      │
│  [Tenant A ▼] [Tenant B ▼]                                                │
├───────────────────────────────────────────────────────────────────────────┤
│  HEADER                                                                   │
│  [Search]  [Notifications]  [Theme toggle]  [Locale VI/EN]                │
├───────────────────────────────────────────────────────────────────────────┤
│  MAIN CONTENT                                                             │
│  ┌── glassPanel ──────────────────────────────────────────────────────┐   │
│  │  breadcrumb: Trang chủ > Danh mục > Dài hạn VN30                  │   │
│  │  ┌── metricGrid (responsive 4→2→1) ───────────────────────────┐   │   │
│  │  │  [Total Value $1.23B]  [Daily P&L +$45.2M]                │   │   │
│  │  │  [Return +12.3%]       [Holdings 47]                       │   │   │
│  │  │  [Sharpe 1.85]         [Max DD -8.2%]                     │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │  ┌── tabBar ───────────────────────────────────────────────────┐   │   │
│  │  │  [Overview] [Holdings] [Activity] [Analytics] [Allocation]  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │  ┌── tabContent ───────────────────────────────────────────────┐   │   │
│  │  │  (dynamic content per tab)                                  │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Nguyên tắc thiết kế

```
┌─────────────────────────────────────────────────────────────────────┐
│               NGUYÊN TẮC THIẾT KẾ UI PORTFOLIO                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. KPI FIRST                                                        │
│     → Investor thấy tổng quan trước, detail sau                     │
│     → 4-6 metric cards với sparkline trên mỗi page                   │
│                                                                     │
│  2. TAB-BASED WORKSPACE                                            │
│     → Overview | Holdings | Activity | Analytics | Allocation       │
│     → Mỗi tab là một view hoàn chỉnh, không phụ thuộc nhau         │
│                                                                     │
│  3. GLASS PANEL HIERARCHY                                            │
│     → glassPanel > sectionCard > metricCard                         │
│     → Glass opacity 0.4-0.5, blur 8-12px                           │
│                                                                     │
│  4. MONOSPACE CHO SỐ                                                 │
│     → font-variant-numeric: tabular-nums                            │
│     → Tất cả giá trị tài chính hiển thị căn phải                    │
│                                                                     │
│  5. SEMANTIC COLORS                                                  │
│     → Positive: #00B96B / #34d399 (green)                           │
│     → Negative: #F23645 / #f87171 (red)                             │
│     → Neutral: #94a3b8 (muted)                                      │
│     → Accent: #22d3ee / #06b6d4 (cyan info)                         │
│                                                                     │
│  6. TRANSITIONS                                                     │
│     → cubic-bezier(0.16, 1, 0.3, 1) cho hover/enter               │
│     → 0.15-0.2s cho micro-interactions                              │
│     → 0.3s cho panel transitions                                    │
│                                                                     │
│  7. RESPONSIVE GRID                                                  │
│     → sectionGrid: repeat(auto-fit, minmax(320px, 1fr))            │
│     → metricGrid: 4 col desktop → 2 tablet → 1 mobile              │
│     → table: horizontal scroll trên mobile                          │
│                                                                     │
│  8. EMPTY/HOLDING STATES                                             │
│     → Không hiển thị "0" — hiển thị null + reason + source         │
│     → Empty state có icon + action button                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## PHẦN III: THIẾT KẾ CHI TIẾT TỪNG TRANG

### 3.1 Trang Overview (Tổng quan)

**Mục đích:** Nhà đầu tư nhìn thấy toàn bộ tình trạng portfolio trong 1 cái nhìn.

**Layout:**

```
┌── glassPanel ─────────────────────────────────────────────────────────┐
│  breadcrumb: Trang chủ › Danh mục › Dài hạn VN30                     │
│  ┌── toolbar ────────────────────────────────────────────────────┐    │
│  │  [🔍 Search portfolio...] [⬇ Export CSV] [📅 Period: 1M ▼]  │    │
│  │  [↻ Refresh]                                                  │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── metricGrid (4-6 columns) ───────────────────────────────────┐    │
│  │  ┌─ metricCard ──────┐  ┌─ metricCard ──────┐               │    │
│  │  │  Total Value       │  │  Daily P&L        │               │    │
│  │  │  ─────────────     │  │  ─────────────     │               │    │
│  │  │  $1,234,567,890   │  │  +$45,234,567     │               │    │
│  │  │  sparkline ──────  │  │  +12.3% sparkline │               │    │
│  │  │  [vs VN30 +2.1%]  │  │                   │               │    │
│  │  └───────────────────┘  └───────────────────┘               │    │
│  │  ┌─ metricCard ──────┐  ┌─ metricCard ──────┐               │    │
│  │  │  Return (1Y)       │  │  Holdings         │               │    │
│  │  │  ─────────────     │  │  ─────────────     │               │    │
│  │  │  +18.5%           │  │  47 positions     │               │    │
│  │  │  sparkline ──────  │  │  ─────────────     │               │    │
│  │  │                   │  │  cash: $50M       │               │    │
│  │  └───────────────────┘  └───────────────────┘               │    │
│  │  ┌─ metricCard ──────┐  ┌─ metricCard ──────┐               │    │
│  │  │  Sharpe Ratio      │  │  Max Drawdown     │               │    │
│  │  │  ─────────────     │  │  ─────────────     │               │    │
│  │  │  1.85              │  │  -8.2%            │               │    │
│  │  │                   │  │  [since Jan 2026]  │               │    │
│  │  └───────────────────┘  └───────────────────┘               │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── sectionGrid (2 columns) ──────────────────────────────────┐    │
│  │  ┌─ glassPanel ──────┐  ┌─ glassPanel ──────┐              │    │
│  │  │  Equity Curve      │  │  Sector Allocation │              │    │
│  │  │  ─────────────     │  │  ─────────────     │              │    │
│  │  │  [line chart]      │  │  [treemap/donut]   │              │    │
│  │  │  1Y period selector│  │  [symbol legend]   │              │    │
│  │  │  VN30 overlay      │  │                    │              │    │
│  │  └───────────────────┘  └───────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── sectionGrid ──────────────────────────────────────────────┐    │
│  │  ┌─ glassPanel ──────┐  ┌─ glassPanel ──────┐              │    │
│  │  │  Top Gainers       │  │  Top Losers       │              │    │
│  │  │  ─────────────     │  │  ─────────────     │              │    │
│  │  │  1. VNM +8.3%     │  │  1. VCB -3.2%     │              │    │
│  │  │  2. MSN +5.1%     │  │  2. BID -2.8%     │              │    │
│  │  │  3. HPG +4.7%     │  │  3. VIC -2.1%     │              │    │
│  │  └───────────────────┘  └───────────────────┘              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ banner (if stale data) ────────────────────────────────────┐    │
│  │  ⚠️ Dữ liệu chưa cập nhật — lần sync: 14:30 ICT            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**CSS Classes sử dụng:**
- `.glassPanel` — main container
- `.overviewMetricGrid` — responsive 4→2→1 metric card grid
- `.metricCard` — individual KPI tile
- `.tabBar`, `.tabButton`, `.tabButtonActive` — tab navigation
- `.sectionGrid` — 2-column content grid
- `.breadcrumb` — navigation path
- `.toolbar` — action bar with search/export/refresh

**Data flow:**
```
usePortfolio() → coreApiAdapter.getPortfolioSummary(id) + getPortfolioAnalytics(id)
  → Promise.all([summary, analytics, allocation, topGainers, topLosers])
  → metricCards: total_value, daily_pnl, return_pct, holdings_count, sharpe, max_drawdown
  → equity_curve: [{date, value, benchmark}]
  → allocation: [{sector, weight, color}]
  → sparklines: mini time-series per metric card
```

**Comparison with current:**
| Hiện tại | Target |
|----------|--------|
| 1 table + 1 form | 6 KPI cards + 4 sections + 2 charts + 2 tables |
| Không có chart | Equity curve + allocation treemap |
| Không có metrics | Sharpe, Max DD, Return, P&L, Value |
| Không có benchmark overlay | VN30 comparison line |
| Loading text | Skeleton screens with shimmer |
| No refresh control | Refresh button + auto-stale banner |

### 3.1.1 vninvestcharts-widget — Chiến lược tích hợp

**KẾT LUẬN: CÓ — widget phải được tích hợp vào `mainChartArea` của portfolio. Nó không chỉ làm K-line cổ phiếu.**

> **Đính chính (2026-09-27):** Bản nháp đầu của tài liệu này kết luận sai rằng widget "chỉ làm candlestick, không dùng cho equity curve". Kết luận đó dựa trên `packages/web/src/types/vninvestcharts-widget.d.ts` (chỉ 73 dòng, khai báo props nhưng **không** liệt kê loại series). Đã đọc source thật của widget và bác bỏ kết luận cũ. Bằng chứng dưới đây.

#### A. Bằng chứng đã kiểm chứng

**Version thực tế:**
| Nơi | Version |
|------|---------|
| `packages/web/package.json` pin | `^1.2.5` |
| `packages/web/node_modules/vninvestcharts-widget/package.json` | **1.2.5** (đang dùng thật) |
| Source repo `vninvestcharts-widget/package.json` | **1.4.0** (chưa cài vào vninvest) |

**Series registry có 31 loại** — trong đó có `Line` và `Area`:

`Candlestick · HollowCandle · OHLC · HeikinAshi · Bar · Volume · BollingerBand(s) · RSI · MACD · StrengthElder · Whale · SAR · AO · MARibbon · Ichimoku · Supertrend · Keltner · Donchian · VWAP · AnchoredVWAP · Alligator · Fractals · Gator · PivotStandard · PivotHighLow · MarketProfile · VolumeProfile · Footprint · DeltaProfile · HTFOverlay · Comparison`

Nguồn: `src/lib/core/registry/SeriesRegistry.ts`

| Series | Component | Dòng | Dùng cho portfolio |
|---------|-----------|------|-------------------|
| `Line` | `LineSeries` | `:292` | **Equity curve** (giá trị danh mục) |
| `Area` | `AreaSeries` | `:301` | **Drawdown** (vùng âm) |
| `Comparison` | — | đăng ký | **Overlay benchmark VN30/VN100** |
| `HTFOverlay` | — | đăng ký | Overlay khung thời gian khác |
| `Bar` | `BarSeries` | `:309` | **Monthly return bars** |
| `Volume` | — | `:320` | Khối lượng tổng hợp danh mục |
| `Whale` | — | đăng ký | Cảnh báo dòng tiền lớn trên holding |
| `Footprint` / `VolumeProfile` | — | đăng ký | Order flow (tier Pro) |

**Đã verify trong `dist` của bản 1.2.5 đang cài** (không chỉ source 1.4.0):

| Chuỗi | Kết quả |
|-------|---------|
| `"Line"` | FOUND |
| `"Area"` | FOUND |
| `"Comparison"` | FOUND |
| `"HTFOverlay"` | FOUND |
| `"Footprint"` | FOUND |
| `paperTrading` / `PaperTrading` | FOUND |

→ **Không cần nâng version để dùng `Line`/`Area`/`Comparison`.** Có thể ship ngay trên 1.2.5.

#### B. Ràng buộc kỹ thuật THEN CHỐT (không được bỏ qua)

1. **`Line` và `Area` đọc giá trị từ field `close`** — `SeriesRegistry.ts:292-298` và `:301-307`:
   ```
   registerLineSeries("Line", { component: LineSeries,
     tooltipEntry: (config) => ({ accessor: (d) => d.close, ... }) })
   ```
   → Hệ quả: adapter phải **map NAV vào field `close`**, không dùng field `value`.
   → `chartAdapter.js:38-50` hiện `mapToBar` fallback `Number(p.close ?? 0)` ⇒ nếu BE trả `{date, value}` thì **mọi bar = 0**. Phải map `close: p.value ?? p.close` hoặc BE trả `close`.

2. **Widget không có "ngày nghỉ kinh doanh" mặc định** — `showNonTradingDays` mặc định phải kiểm tra. Equity curve chỉ có dữ liệu ngày giao dịch; nếu widget mặc định giãn dài theo lịch thì 1M/3M/6M sẽ lệch trục X so với mong đợi.

3. **Benchmark phải dùng `Comparison` series, không phải series thứ 2 tùy ý** — series có `tier` và bị gate fail-closed: `isSeriesAvailableForTier()` tại `SeriesRegistry.ts:213`, `SERIES_TIER_ORDER` tại `:205`.

4. **Tier + license bắt buộc** — `getSeriesTier()` default `"free"` (`:209`). Series Pro/Enterprise **không render** nếu chưa có license hợp lệ. Không được giả dữ liệu để lách gate (`AGENTS.md` Rule 15 của repo widget).

5. **`data`/`panes` props chưa có type đầy đủ** trong `packages/web/src/types/vninvestcharts-widget.d.ts:22-23` (`data?: unknown[]`, `panes?: unknown[]`). Cần mở rộng type khi triển khai — hiện type là `unknown`, không an toàn.

#### C. Phân công chart giữa widget và ECharts

| Chart | Library | Lý do |
|-------|---------|-------|
| **Equity curve** (Overview) | **widget** `Line` | Cần zoom/pan/crosshair nhất quán với K-line; `Comparison` overlay benchmark |
| **Cumulative return** (Analytics) | **widget** `Line` + `Comparison` | Cùng engine, cùng crosshair, cùng period selector |
| **Drawdown** (Analytics) | **widget** `Area` | `Area` đọc `close` ⇒ map `drawdown_pct` vào `close` |
| **Monthly return** (Analytics) | **widget** `Bar` | `BarSeries` có sẵn |
| **Top holdings mini-chart** (Overview) | **widget** `VNInvestMultiCharts` | 2–4 chart nhỏ cùng lúc |
| **K-line chi tiết holding** (Holdings → click) | **widget** `Candlestick` + `EMA` + `Volume` | Đã có sẵn ở `VNStockChartPanel.js` |
| **Allocation treemap** (Allocation) | **ECharts** | Widget không có `Treemap`/`Sunburst`; `PortfolioHeatmap.js` đã làm tốt |
| **Allocation donut/bar** | **ECharts** | Cùng lý do |

**Quy tắc:** Widget cho mọi chart **thời gian theo phiên giao dịch** (equity, drawdown, return, K-line). ECharts cho **treemap/sunburst** (phân bổ không phải trục thời gian). Không trộn hai engine trong cùng một panel.

#### D. Paper trading — tích hợp engine của widget với ledger server

> **Quyết định đã chốt (2026-09-27):** dùng engine paper trading có sẵn của `vninvestcharts-widget`. Không viết `OrderTicket`/`ExecutionSimulator` mới trong vninvest.

##### D.1 Engine đã có — đã verify

Core engine nằm trong repo widget, **không** nằm ở engine repo:

| Module | Dòng | Vai trò |
|--------|------|---------|
| `VirtualBrokerEngine.ts` | 398 | Facade — implement `IBrokerAPI` |
| `OrderManagementSystem.ts` | 328 | Vòng đời lệnh, validate, TIF |
| `PositionManager.ts` | 238 | Vị thế, cost basis, P&L |
| `RiskEngine.ts` | 169 | Pre-trade risk check |
| `ExecutionSimulator.ts` | 156 | Khớp lệnh, slippage |
| `FillSettlement.ts` | 157 | Settlement T+2 |
| `MarketRules.ts` | 186 | Luật theo thị trường |
| `SettlementCalendar.ts` | 67 | Lịch thanh toán |
| `AnalyticsEngine.ts` | 131 | `ClosedTradeRecord[]`, Sharpe, drawdown |
| `MarketDataPort.ts` | 108 | Cầu nối nến |
| `BrokerAPI.ts` | 56 | Interface |
| `types.ts` | 118 | Domain types (SSOT) |

**Đã có sẵn luật thị trường Việt Nam** — `MarketRules.ts`:

| Nội dung | Giá trị | Dòng |
|----------|---------|------|
| `MarketProfileType` | `VN_SPOT` \| `VN_DERIVATIVES` \| `GLOBAL_MARGIN` | `:5` |
| `ExchangeType` | `HOSE` \| `HNX` \| `UPCOM` \| `GLOBAL` | `:14` |
| `VN_SPOT_RULES.lotSize` | **100** | `:40-43` |
| Lot theo giá | `<10000` → 10, còn lại → 100 | `:49-51` |
| Vốn mặc định | `1_000_000_000` VND / `100_000` USD | `:17-18` |
| Order type VN | `ato` `atc` `mp` `mtl` `plo` | `types.ts:13-19` |
| Settlement | T+2 | `types.ts:61-63`, `paperRuntimeConfig.ts:30` |
| Reject message | "Khối lượng phải là bội số của 100" | `MarketRules.ts:63` |
| Cảnh báo lẫn market | `isUnclassifiedMarketSymbol()` — crypto rơi vào `VN_SPOT` sẽ định giá sai | `:116, :126` |

**API surface host dùng được** — `VirtualBrokerEngine.ts`:

| Nhóm | Method |
|------|--------|
| Đọc | `getAccount()` · `getPositions()` · `getPositionById()` · `getOrders()` · `getHistory()` · `getAnalytics()` |
| Ghi | `placeOrder()` · `cancelOrder()` · `modifyOrder()` · `closePosition()` · `closeAllPositions()` |
| Nạp giá | `onBar()` · `updateMarkPrice()` |
| Admin | `resetAccount(initialBalance?)` · `applyRuntimeConfig()` |

`TradingContextValue` **expose trực tiếp instance `broker`** → host đọc được state không cần CSV.

##### D.2 Ba ràng buộc quyết định kiến trúc

| # | Ràng buộc | Bằng chứng | Hệ quả |
|---|-----------|-----------|--------|
| **R1** | **KHÔNG có API seed/nạp vị thế.** Chỉ có `placeOrder()` + `onBar()` + `resetAccount()`. Không có `setPositions()` / `importPositions()` | `VirtualBrokerEngine.ts:118-353` (12 method, không có method nạp vị thế) | **Không thể phản chiếu portfolio thật vào paper engine bằng 1 lệnh.** Muốn mirror phải replay order → lệch phí/thuế/T+2 |
| **R2** | **State chỉ ở client.** `localStorage` key `vnsc_paper` · `vnsc_trading` · `vnsc_quickTrade` · `vnsc.paper.enabled` · `vnsc.paperHeader.pos` | grep `vnsc[._]` trong `src/widget/trading` | Mất khi clear storage / đổi máy / xóa cookie. Không có bản sao server |
| **R3** | **Cross-tab sync không gồm lịch sử.** `TradingSyncSnapshot = { account, positions, orders, updatedAt }` — thiếu `getHistory()` | `WorkspaceTradingSync.ts:13-18` | Đóng tab có thể mất fill đã xảy ra. Cần verify bằng test thật |

##### D.3 Ba phương án — trade-off

| PA | Mô tả | Cách làm | Ưu | Nhược |
|----|-------|----------|-----|-------|
| **PA-1 Sandbox độc lập** *(khuyến nghị)* | Paper là thế giới riêng, vốn mặc định 1 tỷ VND | Chỉ dùng widget, **không** ghi server | Đơn giản, không rủi ro lẫn số thật, ship nhanh, không cần migration | Paper P&L ≠ portfolio thật; user phải hiểu 2 thế giới |
| **PA-2 Export 1 chiều** | Paper chạy client, ghi log ra server để lưu vết | `broker.getAnalytics()` → `POST .../paper-trades/import` với `source=paper` | Lịch sử bền, audit được, xem lại được, không mất khi xóa cookie | Cần endpoint + bảng mới; phải chống trùng; **vẫn không phản chiếu portfolio thật** |
| **PA-3 Phản chiếu 2 chiều** | Paper bám sát portfolio thật | Phải có `importPositions()` — **widget chưa có** | UX tốt nhất | Phải sửa repo widget; replay order để seed ⇒ lệch phí/thuế/T+2; 2 nguồn sự thật |

**Khuyến nghị: PA-1 ở Wave 4, cân nhắc PA-2 ở Wave 5. Không làm PA-3** — đổi lại UX tốt hơn nhưng phải sửa widget và tạo 2 nguồn sự thật cho cùng một danh mục. Đây là vi phạm nguyên tắc "Ledger là nguồn sự thật" của plan §5.1.

##### D.4 Nếu chọn PA-2 — thiết kế endpoint

```
POST /core/v1/workspace/portfolios/{id}/paper-trades/import

{
  "trades": [{
    "external_id": "<clientOrderId của widget>",   // idempotency
    "symbol": "VNM",
    "side": "buy" | "sell",
    "date": "2026-09-27",
    "price": 65000,
    "quantity": 100,
    "fee": 195000,
    "tax": 6500,
    "exit_reason": "manual" | "tp" | "sl" | "trailing_stop" | "liquidation" | "session_end"
  }]
}
```

- `external_id` = `clientOrderId` của widget (`types.ts:49`) → unique → idempotent, replay an toàn
- Phải chạy qua **cùng policy gate** với write tài chính khác: tenant scope, capability, audit, `Idempotency-Key` HTTP header

**Quyết định cần chốt: bảng riêng hay dùng chung `Transaction`?**

| Phương án | Ưu | Nhược |
|-----------|-----|-------|
| **Bảng riêng `PaperTrade`** *(khuyến nghị)* | `Transaction`/`LedgerEntry` giữ đúng D-06 cho tiền thật; NAV/P&L thật không bị nhiễm | Thêm 1 bảng + 1 migration |
| Ghi vào `Transaction` chung + field `source` | Ít bảng hơn | `models.py:61-162` hiện **không có** field `source`; trộn paper vào làm NAV/P&L thật sai — vi phạm `PLAN §5.1` "Ledger là nguồn sự thật" |

→ **Chọn bảng riêng `PaperTrade`.**

##### D.5 Contract cần chốt khi triển khai

| Thuộc tính | Mặc định widget | Cần đổi? | Lý do |
|-----------|-----------------|----------|-------|
| `costBasisMethod` | `"average"` (`:28`) | **Giữ** | Khớp D-06 của plan |
| `taxRate` | `0.001` (`:26`) | **Giữ** | Khớp thuế bán cổ phiếu VN |
| `commissionPerContract` | `3000` (`:25`) | Tùy broker | Khác nhau DNSE/SSI/TCBS |
| `settlementDays` | `2` (`:30`) | **Giữ** | T+2 |
| `pnlDisplayMode` | `"gross"` (`:32`) | **ĐỔI → `"net"`** | Plan D-06: phí/thuế SELL trừ khỏi realized P&L. Mặc định widget là gross ⇒ lệch plan |
| `brokerFeeRate` | `0.001` (`:24`) | Tùy | Kiểm tra công thức phí thực tế của broker |
| `allowShortSelling` | `false` (`:29`) | **Giữ** | VN spot không cho bán khấn |
| `maxLeverage` | `1` (`:31`) | Tùy | Chỉ cho phép >1 nếu có margin account |

`pnlDisplayMode: "net"` là **thay đổi bắt buộc** — đây là chỗ dễ sai nhất khi ghép với ledger thật.

##### D.6 Rủi ro

| # | Rủi ro | Mức | Xử lý |
|---|--------|-----|--------|
| 1 | Widget state local → mất khi clear storage / đổi máy | Cao | Nếu PA-2: export định kỳ + cảnh báo "chưa đồng bộ" |
| 2 | `Transaction` không có field `source` | Cao | PA-2 dùng bảng `PaperTrade` riêng, không đụng `Transaction` |
| 3 | `vnsc_trading_sync` không sync history | Trung bình | Test thật: đóng tab giữa lúc fill → xem mất không |
| 4 | Nâng 1.2.5 → 1.4.0 có thể đổi `getAnalytics()` / storage key | Trung bình | Chốt contract bằng test trước khi nâng |
| 5 | `pnlDisplayMode` gross ≠ net của plan | **CỰC** | Set `net` + test đối chiếu 1 case bán hàng có phí/thuế |
| 6 | Crypto symbol rơi vào `VN_SPOT` bị định giá sai (lot 100, T+2) | Trung bình | `isUnclassifiedMarketSymbol()` phải chặn trước khi vào paper engine |
| 7 | `mode: "live"` trong `TradingContext` là **live market data**, không phải live trading order | Cao | Dễ hiểu nhầm thành đặt lệnh thật. Ghi rõ trong UI + i18n |

**Rủi ro #7 đáng chú ý:** `TradingContextValue.mode: "live" | "replay"` (`:3`) chỉ phân biệt *nguồn giá* (giá thị trường thật vs replay lịch sử), **không** phải *chế độ đặt lệnh*. Toàn bộ lệnh trong engine đều là paper. Nếu không ghi rõ, người dùng dễ tưởng đang đặt lệnh thật.

##### D.7 Điều chỉnh scope trong plan gốc

Wave PAP-01/02 của `IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` cần sửa:

| Slice | Scope cũ | Scope mới |
|-------|----------|----------|
| PAP-01 | "Paper engine" (xây mới) | "Tích hợp `VirtualBrokerEngine` của widget; set `pnlDisplayMode=net`; chặn `isUnclassifiedMarketSymbol`" |
| PAP-02 | "Order ticket UI" (xây mới) | "Mount `TradingDockPanel` / `ConnectedTradingDockPanel` của widget vào Broker Hub; **không** viết `OrderTicketForm` mới" |
| PAP-03 | "Plan gating" | Giữ nguyên, thêm: paper không bao giờ gọi broker thật |
| PAP-04 | "Canary" | Giữ nguyên |

#### E. Data flow — Equity curve (đã sửa)

```
PortfolioEquityCurveView (BE) → [{date, nav, benchmark_nav, drawdown, return_pct}]
  ↓
chartAdapter mapToBar: { date, open: nav, high: nav, low: nav, close: nav, volume: 0 }
   ⚠ close BẮT BUỘC = nav, vì Line/Area accessor đọc d.close
  ↓
<VNInvestCharts
    data={bars}
    panes={[
      { id:'equity', series:['Line','Comparison'] },   // NAV + VN30
      { id:'drawdown', series:['Area'] },              // drawdown %
    ]}
    showNonTradingDays={false}
    showHeader={false} showToolbar={true} showFooter={false}
  />
```

#### F. Data flow — K-line holding (không đổi)

```
HoldingsTable row click → useNavigate → /stocks/{symbol}
  → StockDetailPage → VNStockChartPanel
    → lazy import('vninvestcharts-widget')
    → createChartStockDataAdapter({ env })
    → coreApiAdapter.getStockChartHistory(symbol, { timeframe, days })
    → parseBars(payload) → [{date, open, high, low, close, volume}]
    → VNInvestCharts prop: { symbol, timeframe, theme, locale, panes }
    → Candlestick + EMA + BB + RSI + MACD + Volume
    → Whale overlay: mapToWhaleOrders(whaleSignals)
    → CVD overlay: mapToCvdSeries(orderFlowData)
    → Real-time: useRealtimeFeedFromManager → pushRealtimeBar
```

#### G. License

- Định dạng key: `vni1.<payload>.<sig>`, verify offline ECDSA P-256 (`WIDGET_INTEGRATION_GUIDE.md:42-44`).
- Truyền vào prop `licenseKey` (`:27`). Không dùng prefix tự xung `vni_pro_...` — không có hiệu lực.
- `renderTier` mở UI; `data` vẫn do server quyết. Thiếu license Pro ⇒ UI Pro hiện nhưng data hiện banner.
- Tier quyết định: số chart (Free 1–2 / Pro 1–2 / Enterprise 4–6), Order Flow (`Footprint` = Pro), Replay (Pro).

#### H. Việc cần làm cho tài liệu type

`packages/web/src/types/vninvestcharts-widget.d.ts` cần bổ sung — hiện khai báo thiếu và để `unknown`:
- `data?: PortfolioBar[]` thay `unknown[]`
- `panes?: PaneDescriptor[]` thay `unknown[]`
- Khai báo `SeriesTypeId` gồm `Line | Area | Comparison | Bar | ...`
- Khai báo `licenseKey?: string`

### 3.2 Trang Holdings (Danh mục nắm giữ)

**Mục đích:** Chi tiết từng vị thế trong portfolio — giá, khối lượng, P&L, tỷ trọng.

**Layout:**

```
┌── glassPanel ─────────────────────────────────────────────────────────┐
│  breadcrumb: Trang chủ › Danh mục › Dài hạn VN30 › Holdings          │
│  ┌── toolbar ────────────────────────────────────────────────────┐    │
│  │  [🔍 Search symbol...] [Filter by sector ▼] [Sort: P&L ▼]   │    │
│  │  [Columns: ⚙] [⬇ Export CSV] [📄 Print]                     │    │
│  │  [↻ Refresh] [⏱ Last update: 14:30]                         │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── summaryBar ───────────────────────────────────────────────┐    │
│  │  47 holdings | Total: $1,234,567,890 | Unrealized: +$134M   │    │
│  │  | Realized: +$23M | Dividend: +$5.6M | Cash: $50M          │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── holdingsTable ────────────────────────────────────────────┐    │
│  │  ┌─ thead (sortable) ───────────────────────────────────┐  │    │
│  │  │  ☐ Select | Symbol | Name | Qty | Avg Cost | Last    │  │    │
│  │  │  | Market Value | Unreal. P&L | P&L % | Weight |     │  │    │
│  │  │  | Sector | 24h % | Actions                           │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  │  ┌─ tbody ───────────────────────────────────────────────┐  │    │
│  │  │  ☐ VNM | Vinamilk | 1000 | 60,000 | 65,000 |         │  │    │
│  │  │  | 65,000,000 | +5,000,000 | +8.3% | 5.2% |           │  │    │
│  │  │  | Consumer | ▲ +2.1% | [Detail]                       │  │    │
│  │  │  ☐ MSN | Masan | 500 | 70,000 | 72,000 |              │  │    │
│  │  │  | 36,000,000 | +1,000,000 | +2.9% | 2.9% |           │  │    │
│  │  │  | Consumer | ▼ -0.5% | [Detail]                       │  │    │
│  │  │  ... (paginated, 20/page)                              │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── pagination ───────────────────────────────────────────────┐    │
│  │  ◀ 1 2 3 ... 3 ▶ | Show: [20 ▼] | Rows: 47               │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── heatmapMini (optional toggle) ──────────────────────────┐    │
│  │  [Treemap/Sunburst toggle] [Weight/MarketCap toggle]       │    │
│  │  [visual portfolio map]                                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Table columns (11 columns, commercial standard):**

| Column | Type | Sortable | Description |
|--------|------|----------|-------------|
| Select | checkbox | No | Multi-select for batch actions |
| Symbol | text | Yes | Ticker code (VNM, MSN, HPG...) |
| Name | text | Yes | Company name |
| Qty | number | Yes | Holdings quantity |
| Avg Cost | currency | Yes | Weighted average cost |
| Last Price | currency | Yes | Current market price |
| Market Value | currency | Yes | Qty × Last Price |
| Unreal. P&L | currency | Yes | Market Value - (Qty × Avg Cost) |
| P&L % | percent | Yes | Unreal. P&L / (Qty × Avg Cost) |
| Weight | percent | Yes | Market Value / Total Portfolio Value |
| Sector | text | Yes | Industry classification |
| 24h % | percent | Yes | Daily price change |
| Actions | icon | No | Detail, Chart, Sell, etc. |

**Color coding:**
- P&L positive: `color: var(--color-success-500, #34d399)`, background `rgba(52, 211, 153, 0.1)`
- P&L negative: `color: var(--color-danger-500, #f87171)`, background `rgba(248, 113, 113, 0.1)`
- P&L zero: `color: var(--text-muted, #94a3b8)`
- Row hover: `background: rgba(var(--soc-rgb-5078a8) / 0.08)`
- Zebra striping: alternating `rgba(0,0,0,0.05)` opacity

**CSS Classes:**
- `.holdingsTable`, `.holdingsTableHead`, `.holdingsTableRow`
- `.holdingsTableCell` with modifier classes (`.num`, `.currency`, `.positive`, `.negative`)
- `.summaryBar` — aggregate stats line
- `.toolbar` — search/filter/sort/export
- `.pagination`

**Data flow:**
```
usePortfolio(id) → coreApiAdapter.getPortfolioHoldings(id)
  → HoldingsTable: [{symbol, name, qty, avgCost, lastPrice, marketValue, unrealizedPnl, pnlPct, weight, sector, change24h}]
  → Sort/filter/paginate client-side
  → Summary bar: totals computed from all holdings
  → Heatmap optional: same data → PortfolioHeatmap component
```

**Comparison with current:**
| Hiện tại | Target |
|----------|--------|
| 5 columns (Tên, Tiền tệ, Trạng thái, Ngày tạo, Thao tác) | 13 columns with sort, filter, pagination |
| No P&L per holding | Per-holding P&L, cost basis, weight |
| No sector grouping | Sector column + filter |
| No search | Symbol search with debounce |
| Basic table | Sortable, selectable, paginated |
| No batch actions | Select multiple → batch sell/export/delete |
| No heatmap toggle | Treemap mini-view integrated |

### 3.3 Trang Activity (Hoạt động)

**Mục đích:** Nhật ký giao dịch, cash flow, corporate actions — dòng chảy tài chính.

**Layout:**

```
┌── glassPanel ─────────────────────────────────────────────────────────┐
│  breadcrumb: Trang chủ › Danh mục › Dài hạn VN30 › Activity          │
│  ┌── filterBar ────────────────────────────────────────────────┐    │
│  │  [Type: All ▼] [Date: 1M ▼] [Symbol: All ▼] [Sort: Date ▼]│    │
│  │  [Search: ...] [⬇ Export CSV]                              │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── timeline ─────────────────────────────────────────────────┐    │
│  │  ┌─ activityGroup ──────────────────────────────────────┐  │    │
│  │  │  📅 27/09/2026  | 3 transactions                   │  │    │
│  │  │  ┌─ txnRow ────────────────────────────────────┐   │  │    │
│  │  │  │  BUY  VNM  1000 sh  @ 65,000  | +$65M  │   │  │    │
│  │  │  │  Fee: $65,000 | Tax: $130,000 | Total: $65.2M│  │  │    │
│  │  │  │  [expand icon]                                │  │  │    │
│  │  │  └───────────────────────────────────────────────┘   │  │    │
│  │  │  ┌─ txnRow ────────────────────────────────────┐   │  │    │
│  │  │  │  DIVIDEND VNM  1,000,000 VND  | Cash flow  │   │  │    │
│  │  │  │  Ex-date: 25/09/2026 | Cash: $1M            │   │  │    │
│  │  │  └───────────────────────────────────────────────┘   │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  │  ┌─ activityGroup ──────────────────────────────────────┐  │    │
│  │  │  📅 26/09/2026  | 1 transaction                    │  │    │
│  │  │  ┌─ txnRow ────────────────────────────────────┐   │  │    │
│  │  │  │  SELL MSN  200 sh  @ 72,000  | -$14.4M     │   │  │    │
│  │  │  │  Fee: $14,400 | Tax: $28,800 | Net: $14.36M │   │  │    │
│  │  │  └───────────────────────────────────────────────┘   │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  │  ...                                                        │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── cashFlowSummary ────────────────────────────────────────┐    │
│  │  ┌─ metricCard ──────┐  ┌─ metricCard ──────┐          │    │
│  │  │  Total Invested    │  │  Total Fees       │          │    │
│  │  │  $1,100,000,000   │  │  $5,234,567       │          │    │
│  │  └───────────────────┘  └───────────────────┘          │    │
│  │  ┌─ metricCard ──────┐  ┌─ metricCard ──────┐          │    │
│  │  │  Dividend Income   │  │  Realized P&L     │          │    │
│  │  │  +$5,678,901      │  │  +$23,456,789     │          │    │
│  │  └───────────────────┘  └───────────────────┘          │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**CSS Classes:**
- `.activityTimeline`, `.activityGroup`, `.activityGroupDate`
- `.txnRow`, `.txnRowBuy`, `.txnRowSell`, `.txnRowDividend`
- `.txnDetail` — expandable row detail
- `.cashFlowSummary`, `.cashFlowMetricCard`

**Data flow:**
```
getTransactions(portfolioId, {type, dateRange, symbol, sort})
  → paginated transaction list
  → Group by date
  → Each group: [{type, symbol, qty, price, fee, tax, total, date}]
  → Summary: totals by type (invested, fees, dividends, realized P&L)
  → CSV export via advisorExport.js pattern
```

**Comparison with current:**
| Hiện tại | Target |
|----------|--------|
| Không có trang riêng | Dedicated Activity timeline page |
| Không có grouping by date | Grouped timeline by day/month |
| Không có fee/tax breakdown | Per-transaction fee, tax, net |
| Không có cash flow summary | Summary cards: Invested, Fees, Dividend, Realized |
| No CSV export | CSV export with BOM encoding |
| No filter by type/date/symbol | Multi-filter toolbar |
| No expandable detail | Click row → expand detail |

### 3.4 Trang Analytics (Phân tích)

**Mục đích:** Performance metrics, risk analysis, benchmark comparison — dành cho nhà đầu tư chuyên nghiệp.

**Layout:**

```
┌── glassPanel ─────────────────────────────────────────────────────────┐
│  breadcrumb: Trang chủ › Danh mục › Dài hạn VN30 › Analytics          │
│  ┌── periodSelector ───────────────────────────────────────────┐    │
│  │  [1M] [3M] [6M] [1Y] [3Y] [YTD] [ALL]                     │    │
│  │  Benchmark: [VN30 ▼] [VN100] [None]                        │    │
│  │  Method: [TWR ▼] [MWR]                                     │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── perfChart (full width) ───────────────────────────────────┐    │
│  │  ┌─ chartPanel ─────────────────────────────────────────┐  │    │
│  │  │  Cumulative Return                                     │  │    │
│  │  │  ─────────────────────────────────────────────────  │  │    │
│  │  │  [line chart: portfolio vs VN30 vs VN100]            │  │    │
│  │  │  Y-axis: % return                                      │  │    │
│  │  │  X-axis: date                                          │  │    │
│  │  │  Hover tooltip: date, portfolio %, benchmark %        │  │    │
│  │  └───────────────────────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── sectionGrid (2 col) ────────────────────────────────────┐    │
│  │  ┌─ glassPanel ──────┐  ┌─ glassPanel ──────┐            │    │
│  │  │  Performance Metrics│  │  Risk Metrics     │            │    │
│  │  │  ─────────────     │  │  ─────────────     │            │    │
│  │  │  Total Return:     │  │  Volatility:       │            │    │
│  │  │  +18.5% (1Y)      │  │  22.3% (annual)    │            │    │
│  │  │  Annualized:       │  │  Sharpe:           │            │    │
│  │  │  +16.2%           │  │  1.85              │            │    │
│  │  │  Alpha:            │  │  Sortino:          │            │    │
│  │  │  +3.2% vs VN30    │  │  2.41              │            │    │
│  │  │  Beta: 1.12        │  │  Max Drawdown:     │            │    │
│  │  │  Correlation: 0.87 │  │  -8.2%             │            │    │
│  │  └───────────────────┘  └───────────────────┘            │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── sectionGrid ────────────────────────────────────────────┐    │
│  │  ┌─ glassPanel ──────┐  ┌─ glassPanel ──────┐            │    │
│  │  │  Drawdown Chart    │  │  Attribution       │            │    │
│  │  │  ─────────────     │  │  ─────────────     │            │    │
│  │  │  [drawdown area]   │  │  [by sector/bar]   │            │    │
│  │  │  peak: $1.34B      │  │  Consumer: +5.2%   │            │    │
│  │  │  trough: $1.23B    │  │  Tech: +3.1%       │            │    │
│  │  └───────────────────┘  └───────────────────┘            │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── sectionGrid ────────────────────────────────────────────┐    │
│  │  ┌─ glassPanel ──────┐  ┌─ glassPanel ──────┐            │    │
│  │  │  Monthly Returns   │  │  Best/Worst Days   │            │    │
│  │  │  ─────────────     │  │  ─────────────     │            │    │
│  │  │  [bar chart]       │  │  Best: +3.2%       │            │    │
│  │  │  Jan +1.2%         │  │  Worst: -2.8%      │            │    │
│  │  │  Feb +0.8%         │  │  2026-09-15        │            │    │
│  │  │  ...               │  │  ─────────────     │            │    │
│  │  └───────────────────┘  └───────────────────┘            │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Metric cards specification:**

| Metric | Format | Source | Description |
|--------|--------|--------|-------------|
| Total Return | +X.X% | ledger/performance | Cumulative return since inception |
| Annualized Return | +X.X% | TWR/MWR method | Annualized compound return |
| Alpha | +X.X% vs benchmark | Regression vs VN30 | Excess return above benchmark |
| Beta | X.XX | Regression | Sensitivity to benchmark |
| Sharpe Ratio | X.XX | (Return - Risk-free) / Volatility | Risk-adjusted return |
| Sortino Ratio | X.XX | (Return - Risk-free) / Downside Vol | Downside risk-adjusted |
| Volatility | X.X% (annual) | Std dev of daily returns | Total risk |
| Max Drawdown | -X.X% | Peak-to-trough | Worst historical decline |
| Correlation | X.XX vs VN30 | Pearson correlation | Portfolio-benchmark correlation |
| Tracking Error | X.X% | Std dev of excess returns | Deviation from benchmark |
| Information Ratio | X.XX | Alpha / Tracking Error | Active management quality |

**Chart specification:**
- **Cumulative Return chart**: Line chart, portfolio return line + benchmark overlay lines
- **Color**: Portfolio = amber (#FFA02F, Bloomberg signature), VN30 = cyan (#22d3ee), VN100 = purple (#a855f7)
- **Y-axis**: Percentage return
- **X-axis**: Date timeline
- **Interactions**: Hover tooltip with exact values, click-and-drag zoom, double-click to reset
- **Time period selectors**: 1M/3M/6M/1Y/3Y/YTD/ALL buttons
- **Benchmark toggle**: Checkbox for VN30, VN100

**Data flow:**
```
getPortfolioAnalytics(portfolioId, {period, benchmark, method})
  → ledger/performance.compute({portfolioId, period, benchmark})
  → {
      totalReturn, annualizedReturn, alpha, beta, sharpe, sortino,
      volatility, maxDrawdown, correlation, trackingError, informationRatio,
      monthlyReturns: [{month, return}],
      bestDays: [{date, return}],
      worstDays: [{date, return}],
      drawdownSeries: [{date, drawdown}],
      attribution: [{sector, contribution}]
    }
```

**Comparison with current:**
| Hiện tại | Target |
|----------|--------|
| Chỉ có i18n key, không compute | Full TWR/MWR, Sharpe, Sortino, VaR, Alpha, Beta |
| Không có chart | Cumulative return line with benchmark overlay |
| Không có drawdown | Drawdown area chart |
| Không có attribution | Sector attribution bar chart |
| Không có monthly returns | Monthly return bar chart |
| Không có best/worst days | Best/Worst day cards |

### 3.5 Trang Allocation (Phân bổ)

**Mục đích:** Visual representation of portfolio composition — by sector, asset type, market cap.

**Layout:**

```
┌── glassPanel ─────────────────────────────────────────────────────────┐
│  breadcrumb: Trang chủ › Danh mục › Dài hạn VN30 › Allocation         │
│  ┌── toggleBar ────────────────────────────────────────────────┐    │
│  │  View: [Treemap ▼] [Donut] [Bar Chart] [Sunburst]          │    │
│  │  Group by: [Sector ▼] [Market Cap] [Exchange] [Custom]     │    │
│  │  Size by: [Weight ▼] [Market Value] [Qty]                  │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── mainChartArea ──────────────────────────────────────────┐    │
│  │  ┌─ chartPanel ────────────────────────────────────────┐  │    │
│  │  │  Sector Allocation                                   │  │    │
│  │  │  ────────────────────────────────────────────────  │  │    │
│  │  │  [Treemap: sectors sized by weight, colored by      │  │    │
│  │  │   P&L performance, hover shows detail]               │  │    │
│  │  │  Or: [Donut chart with legend]                       │  │    │
│  │  │  Or: [Horizontal bar chart sorted by weight]         │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── sectionGrid ────────────────────────────────────────────┐    │
│  │  ┌─ glassPanel ──────┐  ┌─ glassPanel ──────┐            │    │
│  │  │  Sector Breakdown  │  │  Market Cap Dist.  │            │    │
│  │  │  ─────────────     │  │  ─────────────     │            │    │
│  │  │  Consumer: 35%     │  │  Large: 45%        │            │    │
│  │  │  Tech: 25%         │  │  Mid: 35%          │            │    │
│  │  │  Banking: 20%      │  │  Small: 20%        │            │    │
│  │  │  ...               │  │                    │            │    │
│  │  └───────────────────┘  └───────────────────┘            │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌─ table ────────────────────────────────────────────────────┐    │
│  │  Symbol | Name | Sector | Market Value | Weight | 24h% |    │
│  │  VNM | Vinamilk | Consumer | $65M | 5.2% | +2.1% |        │    │
│  │  ...                                                         │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Visualization modes:**
1. **Treemap**: Rectangle areas proportional to weight, colored by P&L performance
2. **Donut**: Circular chart with sector legend, hover shows sector detail
3. **Bar Chart**: Horizontal bars sorted by weight descending
4. **Sunburst**: Hierarchical (Sector → Symbol) radial visualization

**Color scheme for allocation:**
- Each sector has a distinct color from the palette
- P&L performance overrides color intensity (green tint for positive, red tint for negative)
- Hover: highlight sector, dim others to 30% opacity
- Click: drill down to see symbols within sector

### 3.6 Trang Broker Hub & Orders

**Mục đích:** Quản lý kết nối broker, sync, và đặt lệnh — tách hoàn toàn khỏi portfolio overview.

**Layout:**

```
┌── glassPanel ─────────────────────────────────────────────────────────┐
│  breadcrumb: Trang chủ › Giao dịch › Broker Hub                        │
│  ┌── providerGrid ───────────────────────────────────────────┐    │
│  │  ┌─ providerTile ──────┐  ┌─ providerTile ──────┐        │    │
│  │  │  🔵 DNSE             │  │  🟢 SSI             │        │    │
│  │  │  Connected           │  │  Connected          │        │    │
│  │  │  Last sync: 14:25    │  │  Last sync: 14:28    │        │    │
│  │  │  [Accounts: 2]       │  │  [Accounts: 1]       │        │    │
│  │  │  [Sync] [Configure]  │  │  [Sync] [Configure]  │        │    │
│  │  └─────────────────────┘  └─────────────────────┘        │    │
│  │  ┌─ providerTile ──────┐                                │    │
│  │  │  🟡 TCBS            │                                │    │
│  │  │  Verifying...       │                                │    │
│  │  │  [Sync] [Configure] │                                │    │
│  │  └─────────────────────┘                                │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── tabBar ───────────────────────────────────────────────────┐    │
│  │  [Overview] [Sync Center] [Orders] [Reconciliation]         │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── ordersTab ──────────────────────────────────────────────┐    │
│  │  ┌── orderTicket ─────────────────────────────────────┐  │    │
│  │  │  📋 Đặt lệnh                                        │  │    │
│  │  │  ─────────────────────────────────────────────────  │  │    │
│  │  │  Broker: [DNSE ▼]  Account: [ACC001 ▼]             │  │    │
│  │  │  Symbol: [VNM ___]  Side: [BUY ▼] [SELL ▼]         │  │    │
│  │  │  Qty: [____]  Price: [_______]  Type: [Limit ▼]    │  │    │
│  │  │  Idempotency-Key: [auto-generated]                  │  │    │
│  │  │  Mode: [Paper ▼] [Live — requires approval]         │  │    │
│  │  │  ┌─ orderSummary ────────────────────────────────┐ │  │    │
│  │  │  │  Estimated Total: $65,000,000                 │ │  │    │
│  │  │  │  Fee: $65,000 | Tax: $130,000                 │ │  │    │
│  │  │  │  Net Value: $64,805,000                       │ │  │    │
│  │  │  └───────────────────────────────────────────────┘ │  │    │
│  │  │  [Preview Order] → Confirm Modal → [Confirm]        │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  │                                                           │    │
│  │  ┌── orderHistory ─────────────────────────────────────┐  │    │
│  │  │  [Filter: Type/Status/Date/Symbol]                  │  │    │
│  │  │  Table: ID | Symbol | Side | Qty | Price | Status   │  │    │
│  │  │  Status badges: [Pending] [Filled] [Cancelled]      │  │    │
│  │  │  Actions: [Cancel] [Details] [Replicate]            │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────────────────────────┘    │
│                                                                       │
│  ┌── syncCenterTab ──────────────────────────────────────────┐    │
│  │  ┌─ syncRun ──────────────────────────────────────────┐  │    │
│  │  │  DNSE Account Sync — Last: 14:25 ICT                │  │    │
│  │  │  Status: ✅ Completed (3 accounts, 142 transactions) │  │    │
│  │  │  Progress: [████████████████████░░░░░] 78%           │  │    │
│  │  │  [Run Now] [View Log]                               │  │    │
│  │  └─────────────────────────────────────────────────────┘  │    │
│  │  ┌─ reconciliation ──────────────────────────────────┐  │    │
│  │  │  Matched: 142/142 | Mismatched: 0 | Missing: 0    │  │    │
│  │  │  [View Details]                                    │  │    │
│  │  └───────────────────────────────────────────────────┘  │    │
│  └───────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
1. **Order ticket is SEPARATE from connection panel** — No more cramming into one 513-line component
2. **Paper mode DEFAULT** — Server-side control, live requires explicit approval
3. **Idempotency-Key auto-generated** — Every order has unique key, prevents double-submit
4. **Order confirmation modal** — Full summary before execution: symbol, qty, price, fee, tax, net value
5. **Order history with status badges** — Pending/Filled/Cancelled/Rejected, filterable
6. **Sync runs as durable jobs** — Not synchronous HTTP requests
7. **Reconciliation dashboard** — Visual match/mismatch status

**Comparison with current:**
| Hiện tại | Target |
|----------|--------|
| Order form inside DNSEConnectionPanel | Separate Orders page with dedicated form |
| No order confirmation modal | Full preview + confirmation |
| No order history | Paginated order history with status |
| No reconciliation dashboard | Visual reconciliation status |
| Sync = HTTP request | Sync = durable Celery job with progress |
| No paper/live distinction | Paper default, live requires approval |
| No Idempotency-Key | Auto-generated per order |

---

## PHẦN IV: THIẾT KẾ HỆ THỐNG COMPONENT

### 4.1 Component hierarchy cho portfolio

```
PortfolioWorkspace (page container)
├── PortfolioBreadcrumb (navigation path)
├── PortfolioToolbar (search, filter, export, refresh)
├── MetricGrid (responsive KPI card grid)
│   ├── MetricCard (individual KPI)
│   │   ├── MetricLabel (uppercase, 0.65rem)
│   │   ├── MetricValue (bold, 1.15-1.2rem, tabular-nums)
│   │   ├── MetricChange (positive/negative indicator)
│   │   └── MetricSparkline (mini time-series SVG)
│   └── MetricCard (×5-6 per grid)
├── TabBar (Overview | Holdings | Activity | Analytics | Allocation)
├── TabContent (dynamic per tab)
│   ├── OverviewContent
│   │   ├── EquityCurve (line chart with benchmark)
│   │   ├── AllocationChart (treemap/donut)
│   │   ├── TopGainersList
│   │   └── TopLosersList
│   ├── HoldingsContent
│   │   ├── HoldingsSummaryBar (totals)
│   │   ├── HoldingsTable (sortable, selectable, paginated)
│   │   │   ├── HoldingsTableHeader (sortable)
│   │   │   ├── HoldingsTableRow (with P&L coloring)
│   │   │   └── HoldingsTablePagination
│   │   └── HoldingsHeatmapToggle (mini treemap)
│   ├── ActivityContent
│   │   ├── ActivityFilterBar
│   │   ├── ActivityTimeline (grouped by date)
│   │   │   ├── ActivityGroup (date header)
│   │   │   └── ActivityRow (expandable)
│   │   └── CashFlowSummary
│   ├── AnalyticsContent
│   │   ├── PerformanceChart (cumulative return)
│   │   ├── MetricGrid (risk/performance metrics)
│   │   ├── DrawdownChart
│   │   ├── AttributionChart
│   │   ├── MonthlyReturnChart
│   │   └── BestWorstDays
│   └── AllocationContent
│       ├── AllocationChart (treemap/donut/bar/sunburst)
│       ├── SectorBreakdown
│       ├── MarketCapDistribution
│       └── AllocationTable
├── StaleBanner (data freshness warning)
├── ErrorBoundary (per-section fallback)
└── SkeletonScreen (loading states)
```

### 4.2 Component specification chi tiết

#### MetricCard

```
Props:
  - label: string (i18n key)
  - value: string | number
  - change?: { value: number, direction: 'up' | 'down' | 'neutral' }
  - sparkline?: [{date, value}]
  - subtitle?: string
  - loading?: boolean

Layout:
  ┌─ metricCard ───────────┐
  │  metricLabel            │
  │  ─────────────          │
  │  metricValue (bold)     │
  │  changeIndicator (±%)   │
  │  ─────────────          │
  │  sparkline (optional)   │
  │  subtitle (optional)    │
  └─────────────────────────┘

Hover: translateY(-1.5px), border-color brightens
CSS: .metricCard { background: rgba(0f172a/0.3); border: 1px solid ...; border-radius: 8px; padding: 0.75rem 1rem; transition: all 0.15s ease; }
```

#### HoldingsTableRow

```
Layout per row:
  [☐ select] [symbol] [name] [qty] [avg cost] [last price] [market value] [unrealized P&L] [P&L %] [weight] [sector] [24h%] [actions]

Coloring:
  P&L > 0 → green text + light green background
  P&L < 0 → red text + light red background
  P&L = 0 → muted text
  Row hover → subtle highlight
  Zebra striping → alternating opacity

Interaction:
  Click row → navigate to stock detail page
  Hover row → tooltip with full details
  Checkbox → select for batch actions

CSS: .holdingsTableRow { display: grid; grid-template-columns: 40px 80px 100px 80px 100px 100px 120px 120px 80px 80px 80px 60px 80px; }
```

#### EquityCurve (chart)

```
Props:
  - data: [{date, nav, benchmarkNav, drawdown, returnPct}]
  - period: '1M' | '3M' | '6M' | '1Y' | '3Y' | 'YTD' | 'ALL'
  - benchmark: 'VN30' | 'VN100' | null
  - showDrawdownPane: boolean

Layout:
  ┌─ chartPanel ────────────────────┐
  │  Title: "Cumulative Return"      │
  │  ┌─ chart area ──────────────┐  │
  │  │  Line series: NAV         │  │  ← series "Line"  (đọc d.close)
  │  │  Comparison series: VN30  │  │  ← series "Comparison"
  │  │  VN100 (tuỳ chọn)         │  │
  │  │  portfolio line (amber)   │  │
  │  │  VN30 line (cyan)         │  │
  │  │  VN100 line (purple)      │  │
  │  │  Y-axis: NAV hoặc %       │  │
  │  │  X-axis: date             │  │
  │  │  Hover tooltip            │  │
  │  └───────────────────────────┘  │
  │  ┌─ pane 2 (tuỳ chọn) ───────┐  │
  │  │  Area series: drawdown %   │  │  ← series "Area"  (đọc d.close)
  │  └───────────────────────────┘  │
  │  Period buttons: 1M 3M 6M 1Y... │
  └──────────────────────────────────┘

Interaction (của widget, dùng sẵn):
  Hover → tooltip with date, values
  Click + drag → zoom to selection
  Double-click → reset zoom
  Period buttons → update data range
  Benchmark toggle → bật/tắt series "Comparison"

Technology — ĐÃ CHỐT (2026-09-27):
  vninvestcharts-widget, series "Line" + "Comparison" + "Area"
  BẰNG CHỨNG: SeriesRegistry.ts:292 ("Line"), :301 ("Area"),
  "Comparison" đã đăng ký; grep dist 1.2.5 → FOUND cả 3.
  KHÔNG dùng ECharts cho chart trục thời gian.
  ECharts chỉ dùng cho Allocation treemap/sunburst.
  ⚠ close BẮT BUỘC = nav (xem §3.1.1-B ràng buộc 1)
```

#### OrderTicket

```
Props:
  - portfolioId: string
  - broker: 'DNSE' | 'SSI' | 'TCBS'
  - mode: 'paper' | 'live' (default: paper)
  - onSubmit: (orderData) => void

Layout:
  ┌─ orderTicket ────────────────────────┐
  │  📋 Đặt lệnh                         │
  │  ┌─ form ──────────────────────────┐ │
  │  │  Broker: [dropdown]              │ │
  │  │  Account: [dropdown]             │ │
  │  │  Symbol: [search input]          │ │
  │  │  Side: [BUY/SELL toggle]         │ │
  │  │  Qty: [number input]             │ │
  │  │  Price: [number input]           │ │
  │  │  Type: [Limit/Market]            │ │
  │  │  Idempotency-Key: [auto]         │ │
  │  │  Mode: [Paper ▼] [Live 🔒]       │ │
  │  │  ──────────────────────────────  │ │
  │  │  Summary:                        │ │
  │  │  Total: $XX,XXX | Fee: $X,XXX    │ │
  │  │  Tax: $X,XXX | Net: $XX,XXX      │ │
  │  │  ──────────────────────────────  │ │
  │  │  [Preview Order → Confirm]       │ │
  │  └──────────────────────────────────┘ │
  └──────────────────────────────────────┘

Validation:
  - Symbol must exist and be tradable
  - Qty must be > 0 and multiple of board lot (100)
  - Price must be > 0 and within trading range
  - Paper mode: always allowed
  - Live mode: requires approval + risk check
  - Idempotency-Key: generated automatically

Confirmation flow:
  1. Preview Order → shows full summary
  2. Confirmation modal → "Bạn có chắc chắn đặt lệnh này?"
  3. [Confirm] → POST /core/v1/workspace/orders/ with Idempotency-Key
  4. Response: 201 Created + order ID
  5. Order history updates automatically
```

#### StaleBanner

```
Props:
  - lastSync: ISO datetime
  - freshnessSla: number (minutes, e.g., 15 for DNSE)
  - provider: 'DNSE' | 'SSI' | 'TCBS'

Layout:
  ┌─ bannerWarning ─────────────────────┐
  │  ⚠️ Dữ liệu có thể đã lỗi thời      │
  │  Lần sync cuối: 14:30 ICT           │
  │  SLA: 15 phút | Đã quá 20 phút     │
  │  [↻ Sync ngay]                      │
  └──────────────────────────────────────┘

Color: amber background, amber border
Only shown when lastSync > freshnessSLA
Auto-dismiss when fresh data received
```

#### SkeletonScreen (loading state)

```
Layout:
  ┌─ skeleton ──────────────────────────┐
  │  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]        │ ← KPI cards
  │  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]        │
  │  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]        │
  │  ───────────────────────────────   │
  │  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]   │ ← Table rows
  │  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]   │
  │  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]   │
  └──────────────────────────────────────┘

CSS: .skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; }
```

---

## PHẦN V: THIẾT KẾ HỆ THỐNG MÀU SẮC VÀ THƯƠNG HIỆU

### 5.1 Palette tài chính (dựa trên Bloomberg + TradingView)

```css
/* Primary — Bloomberg amber signature */
--port-accent: #FFA02F;           /* Main brand color for portfolio */
--port-accent-hover: #FFB84D;     /* Hover state */
--port-accent-muted: rgba(255, 160, 47, 0.15);  /* Background for accent */

/* Positive/Negative — universal finance */
--port-profit: #00B96B;           /* Bloomberg green (up) */
--port-profit-bg: rgba(0, 185, 107, 0.1);
--port-profit-muted: rgba(0, 185, 107, 0.3);
--port-loss: #F23645;             /* Bloomberg red (down) */
--port-loss-bg: rgba(242, 54, 69, 0.1);
--port-loss-muted: rgba(242, 54, 69, 0.3);
--port-neutral: #94a3b8;          /* Muted/zero */

/* Info — TradingView blue */
--port-info: #22d3ee;             /* Info, links, active states */
--port-info-bg: rgba(34, 211, 238, 0.1);
--port-info-muted: rgba(34, 211, 238, 0.3);

/* Chart palette — OKLCH based (TradingView) */
--port-chart-1: oklch(0.75 0.18 180);   /* Portfolio line — amber */
--port-chart-2: oklch(0.65 0.15 200);   /* VN30 — cyan */
--port-chart-3: oklch(0.70 0.12 280);   /* VN100 — purple */
--port-chart-4: oklch(0.60 0.20 50);    /* Sector highlight */
--port-chart-5: oklch(0.65 0.18 300);   /* Alert/warning */

/* Surface — Bloomberg dark ground */
--port-bg-canvas: #0A0E1A;        /* Main background */
--port-bg-surface: #11172A;       /* Panel background */
--port-bg-elevated: #1A2138;      /* Elevated cards */
--port-bg-input: #0F172A;         /* Input fields */
--port-bg-hover: rgba(255, 160, 47, 0.05);  /* Hover highlight */

/* Text */
--port-text-primary: #F1F5F9;     /* Main text */
--port-text-secondary: #94a3b8;   /* Secondary labels */
--port-text-muted: #5E6680;       /* Muted/placeholder */
--port-text-high: #E8ECF4;        /* High-importance data */
```

### 5.2 Light mode override

```css
:root[data-theme="light"] {
  --port-bg-canvas: #F1F5F9;
  --port-bg-surface: #FFFFFF;
  --port-bg-elevated: #F8FAFC;
  --port-bg-input: #E2E8F0;
  --port-bg-hover: rgba(255, 160, 47, 0.08);
  --port-text-primary: #0F172A;
  --port-text-secondary: #475569;
  --port-text-muted: #94A3B8;
  --port-text-high: #1E293B;
  /* Keep profit/loss colors — they're semantic, not theme-dependent */
  --port-profit: #059669;
  --port-loss: #DC2626;
}
```

### 5.3 Typography scale cho portfolio

```css
/* Portfolio-specific typography */
--port-fs-hero: 2rem;             /* KPI values, page titles */
--port-fs-xl: 1.5rem;             /* Section titles */
--port-fs-lg: 1.15rem;            /* Metric values, table headers */
--port-fs-md: 0.95rem;            /* Body text, table cells */
--port-fs-sm: 0.8rem;             /* Labels, badges, subtitles */
--port-fs-xs: 0.65rem;            /* Uppercase labels, timestamps */

--port-fw-normal: 400;
--port-fw-medium: 500;
--port-fw-semibold: 600;
--port-fw-bold: 700;               /* All numeric values */

--port-lh-tight: 1.1;             /* Numbers */
--port-lh-normal: 1.4;            /* Body text */

--port-font-nums: ui-sans-system, -apple-system, "Segoe UI", Roboto, sans-serif;
--port-font-mono: "JetBrains Mono", "Fira Code", monospace;  /* For numbers */
```

---

## PHẦN VI: HÀNH TRÌNH UI/UX CHI TIẾT

### 6.1 User journey — Investor checking portfolio

```
1. LOGIN → Redirect to Dashboard
2. SIDEBAR → Click "Danh mục" → Overview page loads
3. OVERVIEW → See 6 KPI cards with sparklines + equity curve
   - If data stale → see StaleBanner
   - If loading → see SkeletonScreen
4. CLICK "Holdings" tab → Holdings table loads
   - See 47 positions sorted by market value
   - P&L columns color-coded green/red
   - Search for "VNM" → table filters instantly
   - Click VNM row → navigate to stock detail
   - Select multiple stocks → batch actions appear
5. CLICK "Analytics" tab → Performance metrics + charts
   - Default period: 1Y, benchmark: VN30
   - See cumulative return line (portfolio vs VN30)
   - Sharpe 1.85, Max DD -8.2%
   - Switch period to 3M → chart animates
   - Drawdown chart shows worst decline periods
6. CLICK "Activity" tab → Transaction timeline
   - See grouped by date
   - Click expand → see fee/tax breakdown
   - Filter by type: BUY only
   - Export CSV button
7. CLICK "Allocation" tab → Visual portfolio map
   - Switch to Treemap view → see sector sizes
   - Hover Consumer sector → see 35% + top symbols
   - Click → drill down to individual stocks
8. SIDEBAR → Click "Giao dịch" → Broker Hub
   - See 3 provider tiles (DNSE/SSI/TCBS)
   - Click "Orders" tab → see OrderTicket form
   - Fill order → Preview → Confirm → Success
   - Order appears in history with "Pending" status
   - After fill → status changes to "Filled"
```

### 6.2 Micro-interactions specification

| Interaction | Trigger | Animation | Duration |
|-------------|---------|-----------|----------|
| Hover metric card | mouseenter | translateY(-1.5px), border brighten | 0.15s cubic-bezier(0.16,1,0.3,1) |
| Hover table row | mouseenter | background highlight | 0.1s |
| Click tab button | click | tabActiveSlide underline animation | 0.2s |
| Sort column | click | header arrow rotate | 0.2s |
| Page transition | navigate | fade + slide | 0.3s |
| Chart period change | button click | line morph | 0.4s ease-out |
| Order submit | button click | loading spinner → success checkmark | 0.5s |
| Confirm modal open | button click | overlay fade + modal scale | 0.2s |
| Filter applied | input change | table rows reorder | 0.15s |
| Stale banner auto-dismiss | data refresh | banner slide up → removed | 0.3s |
| Export CSV | button click | download trigger | instant |

### 6.3 Responsive breakpoints

```css
/* Desktop (>1200px) */
.metricGrid { grid-template-columns: repeat(4, 1fr); }
.sectionGrid { grid-template-columns: repeat(2, 1fr); }
.holdingsTable { font-size: 0.95rem; }
.sidebar { width: 288px; }

/* Tablet (768px - 1200px) */
.metricGrid { grid-template-columns: repeat(2, 1fr); }
.sectionGrid { grid-template-columns: 1fr; }
.holdingsTable { font-size: 0.85rem; horizontal scroll }
.sidebar { width: 72px; collapsed }

/* Mobile (<768px) */
.metricGrid { grid-template-columns: 1fr; }
.sectionGrid { grid-template-columns: 1fr; }
.holdingsTable { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch }
.holdingsTableRow { min-width: 900px; }
.sidebar { width: 100%; bottom navigation }
.equityCurve { height: 200px; }
.orderTicket { form fields stacked vertically }
```

### 6.4 Accessibility (WCAG 2.2 AA)

| Requirement | Implementation |
|-------------|---------------|
| **Keyboard navigation** | Tab through metric cards → table → tabs → order form |
| **ARIA labels** | `aria-label` on all icons, buttons, table columns |
| **ARIA live** | `aria-live="polite"` on dynamic content updates |
| **Focus management** | Focus trap in modals, return focus on close |
| **Color contrast** | All text ≥ 4.5:1 contrast ratio (WCAG AA) |
| **Screen reader** | `role="table"`, `aria-sort` on sortable headers |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` — disable animations |
| **CVD mode** | Don't rely solely on color — use icons/text labels |
| **Focus visible** | `:focus-visible` outline using `--port-info` |
| **Form labels** | Every input has associated `<label>` |

---

## PHẦN VII: SO SÁNH KẾT QUẢ — TRƯỚC VÀ SAU

### 7.1 Bảng so sánh tổng thể

| Khía cạnh | Hiện tại (3/10) | Target (9/10) | Đối thủ |
|-----------|----------------|---------------|---------|
| **Page layout** | 1 page, 1 table, 1 form | 5 tabs, workspace pattern | Bloomberg, TradingView |
| **KPI metrics** | 0 | 6 cards + sparklines | Bloomberg, Refinitiv |
| **Charts** | 0 trên portfolio page | Equity curve, drawdown, attribution, heatmap | Bloomberg, TradingView |
| **Table features** | Basic, 5 cols | Sortable, filter, paginate, 13 cols, batch | Bloomberg, TradingView |
| **Performance metrics** | 0 | TWR, Sharpe, Sortino, Alpha, Beta, VaR, MaxDD | Bloomberg, Koyfin |
| **Allocation viz** | 0 | Treemap/donut/bar/sunburst | Bloomberg, Morningstar |
| **Activity timeline** | 0 | Grouped, expandable, filtered, CSV export | TradingView |
| **Order execution** | Inside connection panel | Separate page, paper default, confirm modal | Bloomberg, TradingView |
| **Broker management** | 1 panel, 513 lines | Hub page with tabs, async sync, reconciliation | Bloomberg |
| **i18n** | ~30% hardcoded | 100% tokenized | All commercial |
| **Dark/Light** | Dark only | Full both modes | Bloomberg, TradingView |
| **A11y** | None | WCAG 2.2 AA | Bloomberg, TradingView |
| **Responsive** | 1 breakpoint | 4 breakpoints | Bloomberg, TradingView |
| **Loading states** | Text "Đang tải..." | Skeleton screens | Bloomberg, TradingView |
| **Empty states** | Text "Chưa có..." | Illustrated + actionable | TradingView |
| **Widget config** | None | Drag-drop layout, collapse | Bloomberg, TradingView |
| **Data freshness** | No indicator | Stale banner + SLA | Bloomberg, Refinitiv |
| **Export** | None | CSV with BOM, all pages | Bloomberg, Refinitiv |

### 7.2 Điểm giống thương mại

Những yếu tố UI mà vninvest target sẽ GIỐNG thương mại:

| Yếu tố | Thương mại | vninvest target | Khác biệt |
|---------|-----------|-----------------|-----------|
| Dark theme | Bloomberg #0A0E1A | SOC tokens #081734 | Same ground, slightly different blue |
| KPI cards with sparkline | Bloomberg Portfolio | metricCard + MetricSparkline | Same pattern |
| Tab-based workspace | Bloomberg tabs | tabBar + tabContent | Same pattern |
| Sortable table columns | TradingView | holdingsTable with sort | Same pattern |
| Benchmark overlay | Bloomberg VN30 | EquityCurve with overlay | Same pattern |
| Allocation treemap | Bloomberg | Allocation treemap/sunburst | Same pattern |
| Paper/live mode | Bloomberg | OrderTicket mode toggle | Same concept |
| Idempotency | Bloomberg | Idempotency-Key | Same concept |
| Glass panels | Bloomberg glass | .glassPanel | Same pattern |
| Status badges | Bloomberg | .statusBadge | Same pattern |
| Monospace numbers | Bloomberg | font-variant-numeric: tabular-nums | Same pattern |
| SVG sparklines | Bloomberg | MetricSparkline | Same pattern |
| Filter/search toolbar | Bloomberg | PortfolioToolbar | Same pattern |
| Confirmation modal | Bloomberg | Order confirmation | Same pattern |
| Breadcrumb navigation | Bloomberg | PortfolioBreadcrumb | Same pattern |
| Skeleton loading | Bloomberg, TradingView | SkeletonScreen | Same pattern |
| Stale data banner | Bloomberg | StaleBanner | Same concept |
| CSV export | Bloomberg, Refinitiv | advisorExport.js | Same pattern |
| Responsive grid | TradingView | sectionGrid | Same pattern |

### 7.3 Điểm khác biệt (VN-native advantage)

Những gì vninvest sẽ CÓ mà Bloomberg/TradingView KHÔNG:

| Yếu tố | Mô tả |
|---------|-------|
| **VN30 benchmark** | Bloomberg có S&P, VNIndex — vninvest có VN30 native |
| **SSI/TCBS/DNSE integration** | Bloomberg không kết nối broker VN |
| **Vietnamese diacritics** | Full UI in tiếng Việt có dấu |
| **Tax/fee Vietnamese rules** | Fee/tax tính theo quy định VN (0.1% VAT, 0.015% stamp) |
| **Board lot 100** | VN market unique lot size |
| **Trading hours ICT** | 9:00-11:30, 13:00-14:45 ICT |
| **VNĐ currency** | VND base, not USD |
| **Glassmorphism SOC style** | Bloomberg doesn't have this aesthetic |
| **DataOps backfill** | Bloomberg doesn't have this |
| **Multi-tenant SaaS** | Bloomberg is single-user terminal |

---

## PHẦN VIII: ROADMAP UI/UX IMPLEMENTATION

### 8.1 Phase breakdown (theo Wave)

| Wave | UI Work | Deliverables |
|------|---------|-------------|
| **Wave -1** | Fix hardcode strings | `portfolioManagement` namespace used in PortfoliosPage; `dnseConnection` namespace created |
| **Wave 0** | Safety UI | Order confirmation modal; Idempotency display; Paper/live visual distinction |
| **Wave 1** | Tenant UI | Portfolio selector dropdown with tenant indicator; tenant-aware breadcrumb |
| **Wave 2** | **Overview + Holdings + Analytics + Allocation pages** | 4 new pages với widget cho mọi chart trục thời gian (`Line`/`Area`/`Comparison`/`Bar`); ECharts cho allocation treemap; KPI cards, tables, i18n, a11y, responsive |
| **Wave 3** | Broker Hub + Orders page | Provider tiles, Sync Center, OrderTicket, OrderHistory |
| **Wave 4** | Paper trading — **dùng engine widget** | Mount `TradingDockPanel` vào Broker Hub; set `pnlDisplayMode=net`; chặn `isUnclassifiedMarketSymbol`; nhãn UI "Paper" rõ ràng; **không** viết `OrderTicketForm` mới |
| **Wave 5** | Live trading UI | Live mode gates, risk limit display, order confirmation with approval |
| **Wave 6+** | Polish + Advanced | Widget configuration, keyboard shortcuts, terminal mode, custom dashboards |

### 8.2 Component priority order

**Priority 1 (Wave 2 — bắt buộc):**
1. MetricGrid + MetricCard (overview foundation)
2. HoldingsTable (most-used feature)
3. PortfolioToolbar (search/filter/sort/export)
4. TabBar + TabContent (workspace navigation)
5. StaleBanner + SkeletonScreen (UX polish)
6. EquityCurve (visual anchor)

**Priority 2 (Wave 3 — broker integration):**
7. OrderTicket (broker trading)
8. ProviderTile (broker status)
9. OrderHistory (trade records)
10. SyncRun display (sync status)

**Priority 3 (Wave 4+ — advanced):**
11. AllocationChart (visual allocation)
12. PerformanceChart (cumulative return)
13. DrawdownChart (risk visualization)
14. ActivityTimeline (transaction history)
15. Widget configuration (drag-drop)
16. Keyboard shortcuts
17. Terminal mode

### 8.3 File structure target

```
packages/web/src/
├── pages/
│   ├── portfolio/                    # NEW: portfolio workspace pages
│   │   ├── PortfolioOverviewPage.tsx
│   │   ├── PortfolioHoldingsPage.tsx
│   │   ├── PortfolioActivityPage.tsx
│   │   ├── PortfolioAnalyticsPage.tsx
│   │   └── PortfolioAllocationPage.tsx
│   ├── broker/                       # NEW: broker hub pages
│   │   ├── BrokerHubPage.tsx
│   │   ├── SyncCenterPage.tsx
│   │   └── OrderTicketPage.tsx
│   └── PortfoliosPage.tsx            # UPDATED: simpler, uses new components
├── components/
│   ├── portfolio/                    # NEW: portfolio-specific components
│   │   ├── PortfolioWorkspace.tsx
│   │   ├── PortfolioBreadcrumb.tsx
│   │   ├── PortfolioToolbar.tsx
│   │   ├── MetricGrid.tsx
│   │   ├── MetricCard.tsx
│   │   ├── MetricSparkline.tsx
│   │   ├── HoldingsTable.tsx
│   │   ├── HoldingsTableRow.tsx
│   │   ├── HoldingsSummaryBar.tsx
│   │   ├── EquityCurve.tsx
│   │   ├── AllocationChart.tsx
│   │   ├── ActivityTimeline.tsx
│   │   ├── ActivityRow.tsx
│   │   ├── CashFlowSummary.tsx
│   │   ├── PerformanceChart.tsx
│   │   ├── DrawdownChart.tsx
│   │   ├── StaleBanner.tsx
│   │   ├── SkeletonScreen.tsx
│   │   └── OrderConfirmationModal.tsx
│   ├── broker/                       # NEW: broker components
│   │   ├── BrokerHub.tsx
│   │   ├── ProviderTile.tsx
│   │   ├── OrderTicket.tsx
│   │   ├── OrderHistory.tsx
│   │   ├── SyncRunDisplay.tsx
│   │   └── ReconciliationPanel.tsx
│   └── shared/                       # Existing: reused components
│       ├── ui/                       # Button, Card, Table, etc.
│       └── ...
├── hooks/
│   ├── usePortfolioWorkspace.ts      # NEW: portfolio data hook
│   ├── useHoldings.ts                # NEW: holdings data hook
│   ├── usePerformance.ts             # NEW: analytics data hook
│   └── useOrderTicket.ts             # NEW: order form hook
├── adapters/
│   └── portfolio.js                  # UPDATED: portfolio-specific methods
├── i18n/
│   ├── vi.js                         # UPDATED: portfolio workspace keys
│   └── en.js                         # UPDATED: portfolio workspace keys
└── styles/
    ├── portfolio.module.css          # NEW: portfolio-specific styles
    ├── portfolio-tokens.css          # NEW: portfolio design tokens
    └── order-ticket.module.css       # NEW: order ticket styles
```

### 8.4 i18n keys cần thêm (portfolio workspace namespace)

```javascript
// vi.js — portfolioWorkspace namespace
portfolioWorkspace: {
  title: "Tổng quan danh mục",
  breadcrumbHome: "Trang chủ",
  breadcrumbPortfolio: "Danh mục",
  breadcrumbHoldings: "Nắm giữ",
  breadcrumbActivity: "Hoạt động",
  breadcrumbAnalytics: "Phân tích",
  breadcrumbAllocation: "Phân bổ",
  // Metric labels
  totalValue: "Tổng giá trị",
  dailyPnl: "P&L hôm nay",
  totalReturn: "Tổng lợi nhuận",
  holdings: "Vị thế",
  sharpeRatio: "Sharpe",
  maxDrawdown: "Max DD",
  // Table headers
  symbol: "Mã CP",
  name: "Tên",
  quantity: "Khối lượng",
  avgCost: "Avg cost",
  lastPrice: "Last price",
  marketValue: "GT thị trường",
  unrealizedPnl: "Unrealized P&L",
  pnlPct: "P&L %",
  weight: "Tỷ trọng",
  sector: "Ngành",
  change24h: "24h",
  actions: "Thao tác",
  // Filter/sort
  searchSymbol: "Tìm mã CP...",
  filterSector: "Lọc theo ngành",
  sortBy: "Sắp xếp theo",
  exportCSV: "Xuất CSV",
  refresh: "Làm mới",
  // Status
  staleData: "Dữ liệu có thể đã lỗi thời",
  lastSync: "Lần sync cuối: {time}",
  loading: "Đang tải...",
  empty: "Chưa có vị thế nào",
  // Order
  placeOrder: "Đặt lệnh",
  previewOrder: "Xem trước lệnh",
  confirmOrder: "Xác nhận đặt lệnh",
  paperMode: "Chế độ giấy",
  liveMode: "Chế độ thực",
  orderSummary: "Tóm tắt lệnh",
  // Analytics
  cumulativeReturn: "Lợi nhuận tích lũy",
  performanceMetrics: "Chỉ số hiệu suất",
  riskMetrics: "Chỉ số rủi ro",
  benchmark: "Benchmark",
  period: "Kỳ",
  // Broker
  providers: "Nhà cung cấp",
  connected: "Đã kết nối",
  sync: "Đồng bộ",
  orders: "Đơn hàng",
}
```

---

## PHẦN IX: KẾT LUẬN

### 9.1 Tóm tắt thiết kế

Giao diện portfolio management target sẽ:

1. **Có 5 trang chuyên biệt** (Overview, Holdings, Activity, Analytics, Allocation) thay vì 1 trang duy nhất với form + table
2. **Có 6 KPI cards với sparklines** làm thông tin đầu tiên người dùng thấy
3. **Có equity curve + allocation treemap** cho visual analysis
   - Equity curve / drawdown / cumulative return / monthly return → **vninvestcharts-widget** (`Line`/`Area`/`Comparison`/`Bar`)
   - Allocation treemap / donut → **ECharts** (widget không có loại series này)
4. **Có table 13 columns** với sort, filter, paginate, batch actions
5. **Có performance/risk metrics** (TWR, Sharpe, Sortino, VaR, MaxDD)
6. **Tách hoàn toàn Broker Hub + Orders** khỏi portfolio overview
7. **Có full i18n** 100% tokenized, không hardcode
8. **Có dark + light mode** với SOC design tokens
9. **Có WCAG 2.2 AA** accessibility
10. **Có responsive 4 breakpoints**

### 9.2 Giống thương mại ở đâu?

Giao diện target sẽ GIỐNG Bloomberg Terminal, TradingView, Refinitiv Eikon ở:
- Layout: tab-based workspace, KPI cards, multi-panel grid
- Visual: dark theme, amber accent, glass panels, monospace numbers
- Interaction: sortable tables, benchmark overlay charts, confirmation modals
- UX: skeleton loading, stale data banners, CSV export, keyboard navigation
- Component patterns: metric cards, status badges, sparklines, tooltips

### 9.3 Khác biệt VN-native ở đâu?

- VN30/VN100 benchmark (Bloomberg có S&P 500)
- SSI/TCBS/DNSE broker integration (không có trên TradingView)
- Vietnamese diacritics full UI (Bloomberg có nhưng không tiếng Việt)
- Tax/fee theo quy định VN (0.1% stamp duty, 0.015% VAT)
- Board lot 100 shares
- Trading hours 9:00-11:30, 13:00-14:45 ICT
- Glassmorphism aesthetic (SOC design system signature)

### 9.4 Quyết định đã chốt (2026-09-27)

| # | Câu hỏi | Trả lời | Hệ quả cập nhật |
|---|---------|---------|-----------------|
| 1 | 5 trang workspace (Overview/Holdings/Activity/Analytics/Allocation)? | **CÓ** | Wave 2 scope |
| 2 | Broker Hub tách hoàn toàn khỏi portfolio page? | **CÓ** | Thêm `pages/broker/` |
| 3 | Paper trading dùng engine của widget? | **CÓ** | Không viết `OrderTicket` mới — xem §3.1.1-D |
| 4 | Nâng `vninvestcharts-widget`? | **CÓ — lên 1.4.x** | Xem §9.5 |
| 5 | Chart engine cho trục thời gian? | **`vninvestcharts-widget`** | ECharts chỉ cho allocation treemap |

### 9.5 Nâng widget 1.2.5 → 1.4.x — kế hoạch

| Bước | Nội dung | Điều kiện |
|------|----------|-----------|
| 1 | Chốt contract bằng test **trước** khi nâng: `getAnalytics()` shape, storage key `vnsc_*`, `TradingSyncSnapshot`, `PaperRuntimeConfig` defaults | Bắt buộc — không có bước này thì nâng mù |
| 2 | Nâng pin `^1.2.5` → `^1.4.0` trong `packages/web/package.json` | Cần hỏi trước khi `npm install` (junction `node_modules` dùng chung — `AGENTS.md`) |
| 3 | Chạy lại gate: `tsc --noEmit`, `build`, `lint`, `test:components` ×3, `check:shell` | `AGENTS.md` D-19 |
| 4 | Verify runtime: equity curve (`Line`+`Comparison`), drawdown (`Area`), monthly return (`Bar`), K-line, paper order flow | Cần bằng chứng runtime, không tin build pass |
| 5 | Set `pnlDisplayMode: "net"` + test 1 case bán hàng có phí/thuế đối chiếu D-06 | Chống lệch số |
| 6 | Test `isUnclassifiedMarketSymbol()` chặn crypto trước khi vào paper engine | `MarketRules.ts:126` |

**Điểm cần lưu ý:** 1.2.5 đã đủ cho `Line`/`Area`/`Comparison` (đã verify trong `dist`). Việc nâng **không phải** vì thiếu series, mà vì 1.4.0 có module trading đầy đủ hơn + sửa các lỗi mà repo widget ghi trong AGENTS.md. Nếu Wave 4 (paper trading) không chạy được trên 1.2.5 thì bắt buộc nâng; nếu chạy được thì nâng vì lý do độc lập (bugfix/token), không vì series.

### 9.6 Quyết định còn để mở

| # | Câu hỏi | Ảnh hưởng |
|---|---------|-----------|
| 1 | Có dùng Bloomberg amber (#FFA02F) làm accent? | Visual identity |
| 2 | Có cho phép widget drag-drop configuration? | Wave 6 |
| 3 | 4 pages trong 1 PR hay tách theo Wave? | Team coordination |
| 4 | Có muốn terminal mode (keyboard shortcuts)? | Wave 7 |
| 5 | **Paper trades có export sang server (PA-2) không?** | Bảng `PaperTrade` + migration; hiện chốt **PA-1** (không export) |
| 6 | Tier nào cho multi-chart 4-6 ô? (Enterprise) | Phụ thuộc license đã cấp |
| 7 | `commissionPerContract` / `brokerFeeRate` cụ thể cho DNSE/SSI/TCBS? | Chốt `PaperRuntimeConfig` theo broker |

**Khuyến nghị cuối:** Thiết kế này đạt **đẳng cấp Bloomberg/TradingView** ở cả bố cục, interaction, và visual language. Khác biệt duy nhất là VN-native features (VN30, broker integration, tiếng Việt). Bắt đầu từ **MetricCard + HoldingsTable + EquityCurve** — 3 component quan trọng nhất — rồi mở rộng dần.

**Về chart engine (đã chốt 2026-09-27):** dùng **một** engine cho toàn bộ chart trục thời gian — `vninvestcharts-widget`. Lý do: nó đã có sẵn `Line` (equity curve), `Area` (drawdown), `Comparison` (overlay VN30), `Bar` (monthly return), cùng một engine zoom/pan/crosshair, cùng một bộ period selector, cùng một hệ design token. Dùng ECharts thêm cho equity curve sẽ tạo ra **hai** UX khác nhau trên cùng một trang (một cái có crosshair từ widget, một cái không) — đây là lý do thiết kế thường bị phê phán. ECharts giữ lại đúng một chỗ: allocation treemap/sunburst, vì widget không có loại series đó.

**Về paper trading (đã chốt 2026-09-27):** dùng `VirtualBrokerEngine` của widget. Engine này **đã có sẵn luật thị trường Việt Nam** — lot 100, ATO/ATC/MP/MTL/PLO, vốn mặc định 1 tỷ VND, T+2, `taxRate=0.001`, `costBasisMethod=average` — tức khớp gần như trọn vẹn D-06 của plan. Chốt **PA-1** (sandbox độc lập, không ghi server). Hai điều chỉnh bắt buộc: `pnlDisplayMode` phải đổi `gross` → `net`, và phải chặn `isUnclassifiedMarketSymbol()` trước khi cho crypto vào engine. Không chọn PA-3 (phản chiếu portfolio thật) vì widget không có API nạp vị thế — sẽ phải sửa widget và tạo 2 nguồn sự thật cho cùng một danh mục.

**Rủi ro cần ghi nhận (không được bỏ qua khi lên kế hoạch):**

| # | Rủi ro | Mức | Xử lý |
|---|--------|-----|--------|
| 1 | `Line`/`Area` đọc `d.close` ⇒ map sai field sẽ ra chart 0 | **CỰC** | Bắt buộc test contract: NAV vào `close` |
| 2 | `PaperRuntimeConfig.pnlDisplayMode` mặc định `gross` ≠ D-06 | **CỰC** | Set `net` + test 1 case bán có phí/thuế |
| 3 | `TradingContext.mode: "live"` = **live market data**, không phải live order | Cao | Ghi rõ trong UI + i18n, tránh hiểu nhầm là đặt lệnh thật |
| 4 | `packages/web/src/types/vninvestcharts-widget.d.ts` để `data`/`panes` là `unknown` | Cao | Mở rộng type trước khi code UI |
| 5 | Series tier-gated fail-closed ⇒ Pro series không hiện nếu thiếu license | Cao | Kiểm tra license server trước khi bật `Footprint` |
| 6 | Widget không có API nạp vị thế ⇒ không phản chiếu portfolio thật | Cao | Chốt PA-1; nếu cần PA-3 thì phải sửa repo widget |
| 7 | Paper state chỉ ở `localStorage` (`vnsc_*`) | Cao | PA-1 không ảnh hưởng; PA-2 cần export định kỳ |
| 8 | Crypto symbol rơi vào `VN_SPOT` bị định giá sai (lot 100, T+2) | Trung bình | Chặn bằng `isUnclassifiedMarketSymbol()` |
| 9 | `showNonTradingDays` mặc định có thể làm lệch trục X của equity curve | Trung bình | Set `false` + test 1M/3M/6M |
| 10 | `vnsc_trading_sync` không sync `getHistory()` | Trung bình | Test thật: đóng tab giữa lúc fill |
| 11 | Widget 1.2.5 → 1.4.0 có thể đổi `getAnalytics()` / storage key | Trung bình | Chốt contract bằng test **trước** khi nâng (§9.5) |
