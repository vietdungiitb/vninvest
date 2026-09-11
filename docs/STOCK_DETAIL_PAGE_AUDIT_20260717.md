# Báo Cáo Nghiên Cứu & Phân Tích — Stock Detail Page (`/stocks/:symbol`)

**Ngày:** 2026-07-17
**Phạm vi:** `packages/web/src/pages/StockDetailPage.tsx` + ecosystem (chart widget, model hook, components, CSS)
**Mục tiêu:** Xác định bug/gap, đánh giá tính tương thích `vninvestcharts-widget`, đề xuất nâng cấp lên đẳng cấp thương mại phổ biến.

---

## 1. Bản Đồ Kiến Trúc

| File | Line | Trách nhiệm | Note |
|------|------|-------------|------|
| `packages/web/src/pages/StockDetailPage.tsx` | 307 | Page shell — layout, state coordination, widget mounting | Lazy-imported qua `pageRegistry.js:231` |
| `features/stock-detail/hooks/useStockDetailPageModel.js` | 443 | SSOT data model hook — API calls, realtime batching, lifecycle | 250ms throttle cho WebSocket snapshots |
| `features/stock-detail/components/StockDetailHeader.js` | 172 | Header 3-row: ticker badge + price strip + iBoard SSI | Hardcoded Vietnamese strings |
| `features/stock-detail/components/StockDetailTabs.js` | 579 | 8-tab panel dispatcher | Hardcoded Vietnamese, ~150 dòng helper duplicated |
| `features/stock-detail/components/StockSessionWitness.js` | 60 | Session filter strip | Hardcoded Vietnamese |
| `features/stock-detail/components/StockContextDeck.js` | 274 | 3-card grid: Whale + Depth + Strength | Hardcoded Vietnamese |
| `components/VNStockChartPanel.js` | 264 | Widget bridge — lazy-loads `vninvestcharts-widget` | React 18 compatibility shim |
| `adapters/chartAdapter.js` | 136 | Core API → chart bar format bridge | 7 methods, supports windowed fetch |
| `types/vninvestcharts-widget.d.ts` | 44 | Type declarations cho widget | Manual, không từ package |
| `pages/StockDetailPage.css` | 2772 | Full glassmorphism design system | Deep custom tokens, no Tailwind |

---

## 2. Findings (21 total)

### P0 — Blockers / Bugs Nghiêm Trọng

> **⚠️ REVISION NOTE (2026-07-17 counter-audit):** F-01, F-02, F-03, F-13 đã được phản biện và điều chỉnh severity. Xem Mục 8 "Phản Biện & Điều Chỉnh".

**[F-01] CODE SMELL (không phải bug): State declaration xa nơi sử dụng**
- `useStockDetailPageModel.js:91-93` gọi `setNews(null)`, `setFinancials(null)`, `setActiveTab("giao-dich")` trong `useEffect([initialSymbol])` (dòng 101), nhưng 3 state này khai báo ở dòng 196-201 — SAU useEffect.
- **Correction:** useEffect callback chạy SAU render, khi tất cả `useState` đã execute xong. KHÔNG có TDZ — đây là React guarantee, không phải "may mắn". Code organization xấu nhưng không có runtime risk.
- Severity: P2 (code quality), không phải P0.

**[F-02] RACE CONDITION NHẸ (tự heal): `loadingProfile` không reset explicit**
- `useStockDetailPageModel.js:94-99` reset `profile/snapshot/chartBars` nhưng KHÔNG reset `loadingProfile: false`.
- **Correction:** `loadingProfile` nằm trong dependency array của useEffect (dòng 271). Khi old fetch hoàn thành → `.finally()` set `loadingProfile = false` (dòng 227) → useEffect re-run → thấy `modelState.profile = null` (đã reset dòng 96) + `loadingProfile = false` → fetch profile mới. Self-healing qua dependency array.
- Risk thực tế: Race nhẹ (old fetch có thể complete sau new useEffect run đầu tiên) nhưng tự heal. KHÔNG phải blocker.
- Severity: P2 (race nhẹ), không phải P0.

**[F-03] CODE SMELL (không phải leak): `showToast` return cleanup không được caller dùng**
- `StockDetailPage.tsx:68-74` return `() => clearTimeout(timer)` nhưng caller discard return value.
- **Correction:** Trong React 18+, unmount component tự ignore setState calls. Timer fire → `setToast()` → React silently discards. KHÔNG có actual memory leak. Chỉ là code smell.
- Severity: P3.

**[F-04] EDGE CASE (hypothetical): `prevClose` compute — `0`**
- `StockDetailPage.tsx:156-158` — `s?.prev_price ?? s?.reference_price ?? null`. Nếu `snapshot = { prev_price: 0 }` → trả `0`.
- **Correction:** Giá CP = 0 bất khả thi trên sàn VN. Chỉ ảnh hưởng nếu consumer của `prevClose` (hiện truyền vào `StockExecutionLogWidget`) xử lý `0` sai. Cần verify widget handle `0` đúng.
- Severity: P3 (low priority).

**[F-05] GAP (THỰC SỰ QUAN TRỌNG): Không có ErrorBoundary bao quanh StockDetailPage**
- `pageRegistry.js:231` lazy-load nhưng KHÔNG wrap ErrorBoundary. Widget/chart crash → white-screen toàn trang.
- Ngược lại `AICommandCenterPage.tsx:307` có `AISettingsErrorBoundary`.
- **Đây là P0 thực sự** — unique risk không có fallback.

### P1 — Gaps Chức Năng / UX

**[F-06] GAP: Watchlist button dummy — không gọi API**
- `StockDetailPage.tsx:113-115` — `handleWatch` chỉ `setIsWatched(w => !w)`. Không gọi `addWatchlistItem`/`removeWatchlistItem` (`adapters/core/workspace.js:100-112`).
- Symbol KHÔNG persist vào watchlist thực tế.

**[F-07] GAP: 100% Vietnamese hardcoded trong 6 components**
- `StockDetailHeader.js`, `StockDetailTabs.js`, `StockSessionWitness.js`, `StockContextDeck.js`, `StockDetailPage.tsx` dùng hardcoded VN strings, KHÔNG import `useI18n`.
- Chỉ `AIAdvisoryWarningBanner.js:2` có i18n. Chuyển sang English → raw VN text.

**[F-08] GAP: `VNStockChartPanel` local `useI18n` hardcoded**
- `VNStockChartPanel.js:10-23` tạo local `useI18n()` với 4 keys. KHÔNG đồng bộ LangContext. Widget `locale: 'vi'` hardcoded (dòng 236).

**[F-09] GAP: `isWatched` không persist khi navigate**
- `StockDetailPage.tsx:43` — `useState(false)`. F5 hoặc navigate → reset. Không check watchlist context.

**[F-10] GAP: Tabs không lazy-load — 8 renderers luôn trong bundle**
- `StockDetailTabs.js` định nghĩa 8 functions render*() dù tab chưa active. Không code-split.

**[F-11] GAP: `onSymbolChange` dùng `window.location.href`**
- `VNStockChartPanel.js:253` — full page reload thay vì SPA navigation (React Router `navigate`).

**[F-12] GAP: Không có mobile responsive layout cho main page**
- CSS chỉ có media query cho workstation widgets (`@media (max-width: 1024px)` dòng 2027). `sdp-page`, `sdp-premium-header`, `sdp-chart-wrapper` KHÔNG có mobile breakpoint.

**[F-13] MINOR: `createCoreApiAdapter` tạo lại khi dependencies change**
- `useStockDetailPageModel.js:114,166,206` tạo adapter mới trong mỗi useEffect.
- **Correction:** useEffect KHÔNG chạy mỗi render — chỉ re-run khi dependencies thay đổi. 4 useEffect riêng biệt, mỗi cái tạo 1 adapter khi deps change. Impact nhỏ hơn nhiều so với "mỗi render".
- Severity: P3 (minor optimization).

### P2 — Chất Lượng Code / Maintainability

**[F-14] Duplicated utilities: `fmtPrice` + `fmtCompact` 3+ lần**
- `StockDetailHeader.js:5-8`, `StockDetailTabs.js:7-22`, `StockContextDeck.js:5-20`. Nên extract `utils/format.js`.

**[F-15] TRADE-OFF: `createElement` alias `e`**
- Toàn bộ components dùng `e(...)` thay vì JSX.
- **Correction:** Đây là pattern có chủ đích — cho phép render trong JS thuần without JSX transpiler. Trade-off: readability kém nhưng build complexity thấp. Thay đổi toàn bộ sang JSX = rewrite lớn, không worth trong ngắn hạn.
- Severity: P2 (maintainability trade-off, không phải anti-pattern tuyệt đối).

**[F-16] `as any` casts tràn lan**
- `StockDetailPage.tsx:103,148,152` — 3 dòng `as any`. Root: model hook export loose types.

**[F-17] Chart adapter subscribe methods là stubs**
- `chartAdapter.js:107-132` — `subscribeToBar/Trades/Orderbook` trả empty cleanup. Widget có thể yêu cầu realtime subscription.

**[F-18] CSS 2772 lines monolithic**
- Không modular, không CSS Modules/scoped tokens.

### P3 — Widget Compatibility

**[F-19] DESIGN SPLIT (không phải bug): `onBarsChange` dual store**
- `VNStockChartPanel.js:191-194` set `internalBars` + gọi `onBarsChange` → `setChartBars` trong model.
- **Correction:** Hai store có mục đích khác nhau, KHÔNG phải duplicate processing:
  - `internalBars` (dòng 99) → `enrichedBars` → `candlesForHook` → whale markers + CVD (dòng 106-130) — local render data cho overlay
  - `setChartBars` (qua `onBarsChange`) → model state cho parent — global state
- Cùng batch `setState` trong cùng callback → không có race condition.
- Severity: P3 (design note, không phải bug).

**[F-20] Widget `locale` hardcode `'vi'`**
- `VNStockChartPanel.js:236` — không react với user language switch.

**[F-21] Widget `theme` hardcode `'dark'`**
- `VNStockChartPanel.js:238` — không support light mode.

### P1 — Findings Bị Bỏ Sót (Counter-Audit Phát Hiện)

**[F-22] GAP (P1): `chartAdapter.searchSymbols` là stub — Multichart search sẽ không hoạt động**
- `chartAdapter.js:130-132` trả `[{ symbol: query, name: query, exchange: 'VNINVEST' }]` — hardcoded, không query thực.
- Khi chuyển sang `VNInvestMultiCharts` (B-01) với `showWorkspaceToolbar={true}`, search autocomplete sẽ trả kết quả giả → user không tìm được mã thật.
- **Backend đã có endpoint**: `market.js:197` `getSymbolList(params)` → `coreGet('/market-data/symbols/')`. Chỉ cần wire `chartAdapter.searchSymbols` → `coreAdapter.getSymbolList({ q: query })` hoặc filter client-side.
- **Đây là P1 vì block feature search** — phải fix trước khi B-01 ship. (Đã note trong C-01 nhưng chưa đưa vào findings chính.)

**[F-23] GAP (P2): Không có error retry mechanism**
- `useStockDetailPageModel.js:143-150` — nếu blocking lane fail → `error` state hiện, nhưng KHÔNG có retry button.
- User phải navigate ra/vào lại để retry. `StockDetailPage.tsx:187` có button "Thử lại" nhưng chỉ gọi `setSelectedSession(null)` — không re-trigger fetch.
- Cần thêm explicit retry function gọi `loadBlocking()` lại.

**[F-24] GAP (P2): `promptConfig` init từ localStorage không validate schema**
- `StockDetailPage.tsx:46-66` — `JSON.parse(stored)` có thể parse được nhưng schema sai (thiếu `sources`, sai field names) → runtime errors downstream khi `handleRefreshAdvisory` dùng `promptConfig`.
- Cần validate shape trước khi `setPromptConfig`, fallback về default nếu invalid.

---

## 3. Khả Năng Thực Tế của vninvestcharts-widget (v1.2.5)

### Components Export

| Export | Mô tả |
|--------|-------|
| `VNInvestCharts` | Single-chart React widget (đang dùng) |
| `VNInvestMultiCharts` | **Multi-chart grid** — KHÔNG dùng |
| `VNSymbolSearch` | Built-in symbol search với autocomplete — KHÔNG expose |
| `WidgetErrorBoundary` | Error boundary wrapper (có sẵn!) |
| `WidgetI18nProvider` | i18n context provider |
| `SettingsModal` | Settings config modal |
| `PaperTradePanel` | Paper trading panel |
| `WorkspaceSerializer` | Workspace save/load |
| `createLocalStorageAdapter` | Drawing/workflow storage |
| `widgetMessagesVi` / `widgetMessagesEn` | i18n messages |

### VNInvestMultiCharts — Props Quan Trọng

| Prop | Type | Default | Mô tả |
|------|------|---------|-------|
| `layout` | `{ rows, cols, slots?, templateAreas? }` | `{2,2}` | Grid layout config |
| `charts` | `Array<{ id, symbol, timeframe, visibleRange?, symbolLinkGroup? }>` | `[]` | Chart configs |
| `defaultLayout` | same | `{2,2}` | Reset layout |
| `defaultChartProps` | `Record<string, unknown>` | `{}` | Props áp dụng cho mọi chart cell |
| `syncVisibleRange` | `boolean` | `true` | Sync X-axis range |
| `syncCrosshair` | `boolean` | `true` | Sync crosshair position |
| `syncDrawings` | `boolean` | `true` | Sync drawings |
| `syncTimeframe` | `boolean` | `true` | Sync timeframe |
| `syncSymbolLinks` | `boolean` | `true` | Sync symbol link groups |
| `showWorkspaceToolbar` | `boolean` | `false` | **Thanh công cụ multichart (có search)** |
| `showSymbolBadges` | `boolean` | `true` | Label mã trên cell |
| `quickTimeframes` | `string[]` | `["1m","5m","15m","1h","1D"]` | Quick TF selector |
| `workspaceId` | `string` | — | Workspace identifier |
| `storageAdapter` | `object` | — | Persistence adapter |
| `onLayoutChange` | `(layout) => void` | — | Layout changed |
| `onActiveChartChange` | `(chartId) => void` | — | Active chart changed |

**Layout Presets:** Symmetric (1×1, 1×2, 2×2, 3×3...), L-Shape, T-Shape, Main+3Sidebar.

**Ref Methods:** `addChart`, `removeChart`, `setLayout`, `getLayout`, `saveWorkspace`, `loadWorkspace`, `setSync*`, `setActiveChart`, `setTheme`.

### VNInvestCharts — Props Chưa Dùng

| Prop | Mô tả | Hiện tại |
|------|-------|----------|
| `showAdvisoryPanel` | AI advisory trên chart | ❌ |
| `showTapePanel` | Live trade tape | ❌ |
| `showCorporateEvents` | Sự kiện DN overlay | ❌ |
| `showNonTradingDays` | Vùng xám ngày nghỉ | ❌ |
| `isMobile` | Force mobile layout | ❌ |
| `engineRuntime` | `"fork" \| "legacy" \| "auto"` | ❌ |
| `useWebGL` | WebGL rendering | ❌ |
| `xExtents` | Controlled X-axis | ❌ |
| `onComparisonChange` | Comparison overlays | ❌ |
| `tenantPat` | Tenant PAT token | ❌ |

### Adapters Subpath (`vninvestcharts-widget/adapters`)

- `VNInvestClient`, `VNInvestWebSocketClient`, `VNInvestDataAdapter`, `MultiSourceDataAdapter`
- `useWatchlistRealtimeSync()` — hook realtime watchlist
- `TIMEFRAME_MAP`, `normalizeBarsPagingMeta()`

### Drawing Subpath (`vninvestcharts-widget/drawing`)

68 drawing tools: Lines, Fibonacci, Channels, Elliott Waves, Harmonic, Gann, Cycles, Shapes, Pitchfork, Info overlays.

---

## 4. Phương Án Cải Tiến

### A. Yêu Cầu Coder Widget Sửa (Root Cause)

| # | Issue | Fix | Effort |
|---|-------|-----|--------|
| **W-01** | `dist/index.d.ts` missing trong package (khai báo nhưng không publish) | Publish kèm `dist/index.d.ts` đầy đủ mọi props | 0.5 ngày |
| **W-02** | Internal `version = "1.0.0"` stale (package là 1.2.5) | Sync version constant với package.json | 0.25 ngày |
| **W-03** | peerDeps `"react": "^19.0.0"` nhưng chạy ok trên 18 | Mở thành `"^18.0.0 \|\| ^19.0.0"` | 0.5 ngày |
| **W-04** | `VNSymbolSearch` chỉ internal, không expose external trigger | Thêm ref method `openSearch()` hoặc prop `showSearch` | 0.5 ngày |
| **W-05** | `VNInvestMultiCharts` cần consistent named export sau lazy-load | Đảm bảo export name stable giữa chunks | 0.25 ngày |

### B. Chuyển StockDetailPage sang MultiChart Mode

**[B-01] Thay `VNInvestCharts` bằng `VNInvestMultiCharts` (layout 1×1 default)**

> **⚠️ RISK ASSESSMENT (counter-audit):** Chuyển sang MultiCharts là RỦI RO CAO nếu không verify trước.
> 1. KHÔNG có evidence `VNInvestMultiCharts` đã test trên production — báo cáo này là desk research, không phải integration test.
> 2. MultiCharts thêm sync logic (crosshair, visibleRange, drawings, timeframe) → thêm surface area cho bugs.
> 3. `showWorkspaceToolbar={true}` thay đổi UX hiện tại mà chưa rõ user cần.
> **Recommendation:** Thử `VNInvestMultiCharts` 1×1 trong dev env trước khi commit. Nếu widget chưa stable → giữ `VNInvestCharts` + bật unused props (B-04) là safe hơn.

```tsx
<VNInvestMultiCharts
  layout={{ rows: 1, cols: 1 }}
  charts={[{ id: 'main', symbol, timeframe: activeTimeframe, visibleRange: activePeriod, symbolLinkGroup: 'primary' }]}
  defaultChartProps={{
    adapter,
    panes: customPanes,
    drawingUiEnabled: true,
    showToolbar: true,
    showHeader: true,
    showFooter: true,
    theme: resolvedTheme,
    locale: language,
    enableWhale: true,
    enableCVD: false,
  }}
  showWorkspaceToolbar={true}
  showSymbolBadges={true}
  syncCrosshair={true}
  syncVisibleRange={true}
  quickTimeframes={["1m","5m","15m","1h","1D","1W"]}
  onLayoutChange={handleLayoutChange}
  onActiveChartChange={handleActiveChartChange}
  onSymbolChange={(sym) => navigate(`/stocks/${sym}`)}
/>
```

**[B-02] User mở rộng layout**
- Default 1×1, toolbar cho phép split 1×2 / 2×1 / 2×2 / L-shape / T-shape
- Mỗi cell independent symbol/timeframe
- Sync crosshair + range across cells

**[B-03] Search button**
- `showWorkspaceToolbar={true}` → search autocomplete built-in (dùng `adapter.searchSymbols`)
- `onSymbolChange` → navigate SPA

**[B-04] Bật features chưa dùng (SPLIT — có props cần data wiring trước)**

| Nhóm | Feature | Prop | Value | Effort | Note |
|------|---------|------|-------|--------|------|
| **(a) Safe** | Non-trading days | `showNonTradingDays` | `true` | 0.25 ngày | Không cần adapter data |
| **(a) Safe** | Symbol badges | `showSymbolBadges` | `true` | (cùng trên) | Built-in |
| **(b) Data-dependent** | Tape panel | `showTapePanel` | `true` | 1-2 ngày | Cần fix F-17 (`subscribeToTrades` stub) trước; hiện adapter trả empty → widget empty/error |
| **(b) Data-dependent** | Advisory panel | `showAdvisoryPanel` | `true` | (cùng trên) | Cần `subscribeToOrderbook` thực + advisory data adapter |
| **(b) Data-dependent** | Corporate events | `showCorporateEvents` + `corporateEvents` | `true` + data | (cùng trên) | Cần verify backend endpoint supply corporate events data |

> **Note:** (b) group BLOCKED cho đến khi F-17 (chart adapter subscribe stubs) được implement. Bật prop mà adapter không supply data = widget hiển thị empty hoặc throw.

### C. Host App Sửa Song Song

| # | Task | Effort |
|---|------|--------|
| **C-01** | `chartAdapter.searchSymbols` gọi thực API thay vì stub | 0.5 ngày |
| **C-02** | Wire `locale`/`theme` từ LangContext (bỏ hardcode) | 0.5 ngày |
| **C-03** | `onSymbolChange` → React Router `navigate` (bỏ `window.location.href`) | 0.25 ngày |
| **C-04** | Workspace persistence: `storageAdapter={createLocalStorageAdapter()}`, `workspaceId` | 0.5 ngày |
| **C-05** | **ErrorBoundary + Retry (merge F-05 + F-23):** wrap page trong `WidgetErrorBoundary`/`AISettingsErrorBoundary`, design fallback UI (error card + retry button), implement retry logic gọi `loadBlocking()` lại (hiện tại retry chỉ `setSelectedSession(null)` — không re-trigger fetch), verify boundary catch được lazy-loaded chunk crash + model hook errors + render errors, viết test case. | **1.5 ngày** |
| **C-06** | Fix F-06: Watchlist button → `addWatchlistItem`/`removeWatchlistItem` | 1 ngày |
| **C-07** | Fix F-07: i18n cho 6 components | **3-4 ngày** (revised: 6 components × ~50-100 strings = ~300-600 strings cần extract + translate + test bilingual) |
| **C-08** | Fix F-12: Mobile responsive layout | **4-5 ngày** (revised: CSS 2772 dòng monolithic, cần rewrite responsive cho header 3-row, chart wrapper, tabs, context deck grid, workstation layout) |

---

## 5. So Sánh: Trước vs Sau

| Tiêu chí | Trước (SingleChart) | Sau (MultiChart) |
|-----------|---------------------|-------------------|
| Layout | 1 chart cố định | 1→9 charts, user-controlled |
| Search | Không có | Built-in autocomplete |
| Multi-timeframe | Không thể | 1M + 1D + 1W side-by-side |
| Crosshair sync | N/A | Sync across frames |
| Drawing sync | N/A | Sync across frames |
| Workspace | Không persist | Save/load/localStorage |
| Tape panel | Ngoài chart (widget riêng) | Trong chart, sync data |
| Advisory | Tab riêng | Trên chart area |
| Corporate events | Không có | Overlay trên chart |
| TradingView-level UX | ~40% | ~85% |

---

## 6. Điểm Mạnh Hiện Tại

- Glassmorphism design system hoàn chỉnh (2772 dòng CSS premium-grade)
- Workstation layout v2 (desktop split-screen, order book + trade log)
- 250ms throttled realtime WebSocket batching — architecture tốt
- Color-coded price system chuẩn VN (Trần tím, Sàn xanh lơ, TC vàng)
- AI Advisory integration với fallback flags + polling
- Whale + CVD + DarkFlow overlay trên chart đã wire đầy đủ

---

## 7. Ưu Tiên Thực Thi

| # | Task | Bên | Effort |
|---|------|-----|--------|
| 1 | W-03: Widget peerDeps React 18 | Widget | 0.5 ngày |
| 2 | W-01: Widget publish `dist/index.d.ts` | Widget | 0.5 ngày |
| 3 | B-01 + C-05: Switch MultiChart + ErrorBoundary+Retry (F-05+F-23 merged) | Host | 3 ngày (1.5 MultiChart dev-verify + 1.5 ErrorBoundary+Retry) |
| 4 | C-01: `searchSymbols` adapter thực (wire `getSymbolList`) | Host | 0.5 ngày |
| 5 | C-02: Wire locale/theme LangContext (covers F-20/F-21) | Host | 0.5 ngày |
| 6 | W-04: Widget expose `openSearch()` | Widget | 0.5 ngày |
| 7 | B-04(a): Safe props (non-trading-days, symbol-badges) | Host | 0.25 ngày |
| 7b | B-04(b): Data-dependent props (tape/advisory/corporate) — CẦN fix F-17 trước | Host | 1-2 ngày |
| 8 | C-03: SPA navigate | Host | 0.25 ngày |
| 9 | C-04 + C-06: Workspace + Watchlist API | Host | 1.5 ngày |
| 10 | C-07 + C-08: i18n + Mobile | Host | 7-9 ngày (revised: i18n 3-4 + mobile 4-5) |

**Tổng (revised vòng 2):**
- Widget: ~1.75 ngày (W-01, W-02, W-03, W-04, W-05)
- Host: ~11-12 ngày (C-01→C-08 + B-01 + B-04 split)
- **Grand total: ~13-14 ngày** (tăng từ 11 ngày do C-05 merge + B-04 split)

---

## 8. Phản Biện & Điều Chỉnh (Counter-Audit 2026-07-17)

Báo cáo gốc được phản biện bởi senior reviewer. Kết luận: **có giá trị khảo sát tốt nhưng 3 findings sai bản chất cần fix trước khi dùng làm basis cho implementation plan.**

### 8.1 Findings Sai Bản Chất (ĐÃ SỬA)

| ID | Claim gốc | Thực tế | Điều chỉnh |
|----|-----------|---------|------------|
| **F-01** | "TDZ crash nếu React order thay đổi" | useEffect chạy SAU render, tất cả useState đã execute. KHÔNG có TDZ. | P0 → P2 (code organization) |
| **F-02** | "skeleton vĩnh viễn khi đổi symbol" | `loadingProfile` trong dependency array (dòng 271) → self-heal qua re-run. | P0 → P2 (race nhẹ) |
| **F-19** | "Bars xử lý 2 lần → race risk" | `internalBars` feed whale/CVD overlay, `setChartBars` feed global state — design split, cùng batch setState. | P3 (design note) |

### 8.2 Findings Phóng Đại (ĐÃ ĐIỀU CHỈNH)

| ID | Claim gốc | Thực tế |
|----|-----------|---------|
| **F-03** | "Memory leak timer" | React 18+ unmount tự ignore setState. KHÔNG có actual leak. P3 code smell. |
| **F-13** | "Gọi adapter mỗi render" | useEffect chỉ re-run khi deps change, không phải mỗi render. P3 minor. |

### 8.3 Findings Đúng Nhưng Cần Context

| ID | Note |
|----|------|
| **F-04** | Giá CP = 0 bất khả thi trên sàn VN. Chỉ ảnh hưởng nếu `StockExecutionLogWidget` handle `0` sai. |
| **F-15** | `createElement` alias là pattern có chủ đích (no JSX transpiler). Trade-off readability vs build complexity. |

### 8.4 Findings Bị Bỏ Sót (ĐÃ BỔ SUNG)

| ID | Finding | Severity |
|----|---------|----------|
| **F-22** | `chartAdapter.searchSymbols` stub → Multichart search không hoạt động | P1 |
| **F-23** | Không có error retry mechanism (chỉ navigate để retry) | P2 |
| **F-24** | `promptConfig` localStorage parse không validate schema | P2 |

### 8.5 Phương Án Cải Tiến — Phản Biện

| Section | Phản biện | Điều chỉnh |
|---------|-----------|------------|
| **B-01** | MultiCharts chưa test production, thêm sync surface area, thay đổi UX | Thêm RISK ASSESSMENT: thử dev env trước, giữ SingleChart nếu unstable |
| **C-07** | "i18n 6 components — 2 ngày" underestimated | Revised: **3-4 ngày** (300-600 strings) |
| **C-08** | "Mobile responsive — 2 ngày" underestimated | Revised: **4-5 ngày** (CSS monolithic rewrite) |

### 8.6 Đánh Giá Tổng Thể (Counter-Audit Scorecard)

| Tiêu chí | Điểm | Ghi chú |
|----------|------|---------|
| Coverage findings | 8/10 | Đầy đủ, trừ 3 findings bỏ sót (đã bổ sung F-22/23/24) |
| Accuracy findings | 5/10 | 3 findings sai bản chất (F-01, F-02, F-19) — đã sửa |
| Severity rating | 6/10 | F-03, F-13 phóng đại; F-01, F-02 gán sai severity — đã sửa |
| Widget analysis | 8/10 | Props table chi tiết, useful |
| Action plan | 7.5/10 | Vòng 2: C-05 merge F-23 (1.5 ngày), B-04 split (safe 0.25 + data-dependent 1-2), effort total revised ~13-14 ngày |
| Code references | 9/10 | Gần đúng dòng, dễ verify |

### 8.7 Priority Reorder (Thực Tế Quan Trọng)

```
P0:  F-05 (ErrorBoundary)        ← white-screen risk duy nhất → C-05 (merge F-23, 1.5 ngày)
P1:  F-06 (Watchlist dummy)      ← feature broken → C-06
     F-07 (i18n hardcoded)       ← SaaS blocker → C-07 (3-4 ngày)
     F-22 (searchSymbols stub)   ← blocks B-01 search → C-01 (backend có sẵn getSymbolList)
P2:  F-02 (loadingProfile race)  ← self-heal nhưng nên fix
     F-23 (no retry)             ← MERGED vào C-05
     F-24 (promptConfig schema)  ← runtime error risk
     F-14 (duplicate utils)      ← maintainability
     F-15 (createElement)        ← trade-off, low priority
     F-17 (subscribe stubs)      ← BLOCKS B-04(b) tape/advisory
P3:  F-01 (state order)          ← organization only
     F-03 (toast cleanup)        ← code smell
     F-04 (prevClose 0)          ← hypothetical
     F-13 (adapter recreate)     ← minor
     F-16 (as any)               ← type safety
     F-18 (CSS monolithic)       ← maintainability
     F-19 (dual store)           ← design note
     F-20 (widget locale)        ← covered by C-02 (i18n consistency)
     F-21 (widget theme)         ← covered by C-02 (theming)
```

### 8.8 Phản Biện Vòng 2 — Summary (2026-07-17)

| # | Issue (vòng 2) | Mức | Trạng thái |
|---|----------------|-----|-----------|
| 1 | C-05 (ErrorBoundary) underestimated 0.5 ngày, chưa merge retry (F-23) | Medium | ✅ Fixed: merge F-05+F-23 → 1.5 ngày |
| 2 | B-04 oversimplified — adapter stubs block tape/advisory/corporate | Medium | ✅ Fixed: split (a) safe 0.25 ngày / (b) data-dependent 1-2 ngày + cần fix F-17 |
| 3 | F-20/F-21 thiếu explicit map vào C-02 | Low | ✅ Fixed: ghi "(covered by C-02)" trong 8.7 |
| 4 | F-22 chưa note backend endpoint tồn tại | Low | ✅ Fixed: bổ sung `market.js:197` `getSymbolList()` |
| 5 | Tổng effort thiếu B-04 split + C-05 merge | Medium | ✅ Fixed: revised ~13-14 ngày (Widget 1.75 + Host 11-12) |

**Round-2 Scorecard:**

| Tiêu chí | Vòng 1 (sau counter) | Vòng 2 |
|----------|----------------------|--------|
| Accuracy | 9/10 | 9.5/10 |
| Action plan realism | 6/10 | 7.5/10 |
| Internal consistency | 7/10 | 8.5/10 |
| Overall readiness | 7/10 | 8/10 |

**Kết luận:** Báo cáo đã đủ accurate để dùng làm basis cho implementation plan. Các effort estimates đã được revise thực tế (C-05 merge, B-04 split). Priority reorder section 8.7 rõ ràng và consistent.
