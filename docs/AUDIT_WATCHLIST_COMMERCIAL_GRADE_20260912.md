# AUDIT WATCHLIST `/watchlist` — THƯƠNG MẠI HÓA TOÀN DIỆN

**Ngày:** 2026-09-12  
**Scope:** `http://localhost:8080/watchlist` — SaaS-native Watchlist (radar thị trường)  
**Workspace:** `C:\Mujoco Projects\vninvest` — `packages/web` (React 19 + Vite) + `packages/core/backend` (Django)  
**Auditor:** Muse Spark — phân tích tĩnh + trace runtime + quality gates  
**Build gate:** `tsc --noEmit` PASS · `vite build` PASS (3623 modules) · `eslint` timeout cần rerun scope hẹp

> TL;DR 5 finding nặng nhất: (1) Detail panel toàn mock text/whale/news → mất tin cậy, (2) 34+ i18n keys `watchlist.eyebrow/sidebar/table/column` không tồn tại (toàn `defaultValue` fallback), (3) xóa mã/lists không confirm/undo, (4) nuốt lỗi từng nguồn + thiếu skeleton/error state, (5) table thiếu sort/filter/search/bulk/virtualize dù đã cài `@tanstack/react-table` + `react-window`. Khung 2-col glassmorphism + realtime flash + sparkline đã đẹp nhưng **chưa đạt chuẩn thương mại**.

> **REV1 — 2026-09-12 — Phản biện độc lập** (`docs/AUDIT_WATCHLIST_INDEPENDENT_REVIEW_20260912.md`): Verdict audit đúng ~85%, đủ duyệt có điều kiện. **4/5 P0 XÁC NHẬN** (W-01 mock `DetailPanel:78,100-156` + sparkline giả `Table:62`; W-03 `window.confirm Sidebar:68` + xóa không guard `Table:133` + `handleAlert` rỗng `Table:126`; W-04 nuốt lỗi `Context:104-107,221`; W-05 thiếu sort/filter dù `package.json:64,91` đã cài tanstack/react-window). **C2 BÁC BỎ** (false positive): BE `stock_mgmt_native_views.py:4323` nhận `target_price` và map `price_threshold:4334`, test `test_stock_management_native_api.py:1338` POST `target_price` — FE đúng contract, audit trace nhầm `user_workspace/legacy_views.py:267` stub; hủy việc sửa mapping, đổi P0-5 thành nối `handleAlert` tới `createPriceAlert`. **W-02 hạ P0→P1 nếu VN-only**: block `vi.js:3018-3195` ~178 keys legacy tồn tại, chỉ thiếu namespace lồng `sidebar/table/column/eyebrow` (grep 0 hit) — VN render đúng qua `defaultValue`, chỉ vỡ EN + `i18n:scan`; đếm 34 vs 92 mâu thuẫn nội bộ. **Ledger Entry 41** sai số học 7→5 CONTRADICTIONS đã sửa. Gates re-run: `tsc --noEmit` PASS (`TSC_EXIT:0`), build tin audit có điều kiện, lint vẫn treo — yêu cầu `npx eslint src/pages/watchlist --max-warnings 0` scope hẹp.

---

## 0. NGUYÊN TẮC KIỂM TOÁN (AGENTS.md:65)

| Bài học | Nguyên tắc |
|---------|-----------|
| Plan bảo CSS chết nhưng code vẫn dùng | Quét TOÀN repo gồm `.css/.module.css/config/i18n/adapters` |
| Plan bảo field có nhưng code không | Mục `CONTRADICTIONS` kèm `plan:line \| code:line \| impact` |
| Plan trỏ file không tồn tại | `read/grep` xác nhận, KHÔNG TỒN TẠI → báo rõ |
| Quên coupling widget/adapter | Kiểm tra `types/vninvestcharts-widget.d.ts` + `adapters/core/*` + `package.json version` |
| Quên i18n/fat-file/quality | Audit `lint + build + i18n:scan + test` |
| Debug không trace | Reproduce-first, trace `file:line` có bằng chứng |

---

## 1. TÀI LIỆU ĐÃ ĐỌC

- `AGENTS.md:1` (Goal SOC DataOps, constraints glassmorphism/i18n)
- `packages/web/src/pages/WatchlistPage.tsx:1`, `pages/workspace/ShellWatchlistPage.tsx:1`
- `pages/watchlist/WatchlistTypes.ts:1`, `pages/watchlist/components/WatchlistContext.tsx:1`, `WatchlistTable.tsx:1`, `WatchlistSidebar.tsx:1`, `WatchlistMainWorkspace.tsx:1`, `WatchlistDetailPanel.tsx:1`, `pages/WatchlistPage.css:1`
- `adapters/core/workspace.js:1`, `adapters/core/market.js:1`, `adapters/coreApiAdapter.js:1`, `context/RealtimeContext.js:1`, `hooks/useRealtimeFeedCore.js:1`, `constants/marketGroups.ts:1`, `types/vninvestcharts-widget.d.ts:1`
- `i18n/vi.js:3018`, `i18n/en.js:3020`, `package.json:87`, `components/ShellPageTemplate.js|module.css`, `components/soc/soc.module.css:1`
- `packages/core/backend/src/user_workspace/{models.py:1, views.py:1, serializers.py, urls.py}`
- `tests/visual/watchlist.spec.ts:1`

---

## 2. PHẠM VI

| SUB | Mô tả | Files | Symbols |
|-----|-------|-------|---------|
| A | Shell & Routing | `WatchlistPage.tsx`, `ShellWatchlistPage.tsx`, `ShellPageTemplate.*` | `watchlist_saas_native`, `ShellPageChrome` |
| B | State & Data | `WatchlistContext.tsx`, `WatchlistTypes.ts` | `loadAllLists`, `fetchTechnicals` |
| C | UI Sidebar/Table/Main/Detail | 4 components + `WatchlistPage.css` | `visibleColumns`, `priceFlashMap`, `VNInvestCharts` |
| D | Cross-package | `adapters/core/*`, `Realtime*`, `marketGroups.ts`, `vninvestcharts-widget.d.ts` | `getWatchlists`, `getBulkTechnicalsBySymbols` |
| E | Quality Gates | `package.json scripts`, `i18n`, `tests/visual` | `lint/build/i18n:scan` |

---

## 3. PHƯƠNG PHÁP

B1 Đọc docs + `glob **/watchlist*` (4 hits) + `pages/watchlist/**` (6 hits). B2 `grep watchlist` 100+ hits. B3 `read` 12 files lõi. B4 Trace 3 use-case `load→select→render`, `add symbol`, `realtime flash`. B5 Đối chiếu `vi.js:3018` vs keys mới. B6 Gates `lint/build/i18n/test` + coupling widget.

---

## 4. KẾT QUẢ

### A. BẢN ĐỒ KIẾN TRÚC

| File | Lines | Trách nhiệm | Ghi chú |
|------|-------|-------------|---------|
| `pages/WatchlistPage.tsx:1` | 68 | Shell chrome + provider mount (`didInitRef` guard) | `createElement` style; `t(eyebrow/title/description)` đều `defaultValue` |
| `pages/workspace/ShellWatchlistPage.tsx:1` | 185 | Gate `hasSaasNative` 6 checks `features.includes("watchlist_saas_native"):64` → `WatchlistPage` else debug snapshot | Gate duplicate risk drift |
| `pages/watchlist/WatchlistTypes.ts:1` | 127 | DTO `Watchlist/WatchlistItem/Holding/TrackedSymbol/PriceAlert/TechnicalData/RealtimeFeedData` | `MergedData extends TechnicalData` lặp `price/volume` |
| `pages/watchlist/components/WatchlistContext.tsx:1` | 332 | SSOT 18 states; `Promise.allSettled([getWatchlists, getLegacyWatchlistGroups, getPortfolios→getPortfolioHoldings, getTrackedSymbols]:103)`; filter `SYSTEM_GROUP_IDS:117`; `fetchTechnicals(bulk)`, realtime 120 symbols 10s:256, flash 400ms:285 | Fat context; `localStorage vninvest_watchlist_columns:84` |
| `pages/watchlist/components/WatchlistSidebar.tsx:1` | 467 | Left nav holdings/tracked/custom + `Thị trường & Chỉ số` collapsible; CRUD create/rename/delete | `window.confirm:66`, rename `onBlur:240` auto-save |
| `pages/watchlist/components/WatchlistMainWorkspace.tsx:1` | 384 | Header live dot, `ColumnPicker` 4 toggles, add-symbol (chỉ `watchlist:290`), density, banners | `new Date().toLocaleTimeString()` mỗi render |
| `pages/watchlist/components/WatchlistTable.tsx:1` | 570 | 4 modes, `PAGE_SIZE [50,100,200]:6`, sparkline 90×25, `priceFlashMap`, 4 action btn, pager | `linearGradient id=grad-${symbol}` trùng key; fallback `— colSpan 2`:428 |
| `pages/watchlist/components/WatchlistDetailPanel.tsx:1` | 162 | Slide-over 420px, overlay fade 0.15s + slide 0.2s, `VNInvestCharts {symbol, dark, showToolbar false, showFooter false:60}` + 3 mock sections | Import sync `vninvestcharts-widget/dist/index.css:1` — không lazy, chunk eval warning 3124 |
| `pages/WatchlistPage.css:1` | 735 | Tokens `--wl-*`, 2-col `22%|1fr:26`, slide-over, scrollbar 6px, `price-glow`, `rowActions hover 0→1:661` | `:root` global leakage; duplicate `!important:722` |
| `adapters/core/workspace.js:50` | 654 | `getWatchlists / getWatchlistItems / add|removeWatchlistItem / create|update|deleteWatchlist / getPortfolios / getTrackedSymbols / getPriceAlerts` | `getLegacyWatchlistGroups → /stock-management/groups/?include_prices=0:389` |
| `adapters/core/market.js:312` | 541 | `getBulkTechnicalsBySymbols`, `getRealtimeTickers` | `symbols=JOIN(,):315` không chunk |
| `context/RealtimeContext.js:19` | 197 | Singleton WS+poll, dedup `aggregatedSymbols`, `manager:{consumerCount,symbolUnionCount,dedupSavedSymbols:91}` | `rt-${Date.now()}` consumerId |
| `hooks/useRealtimeFeedCore.js:416` | 1260 | WS `VITE_WS_BASE_URL / ws://localhost:{port}/ws/realtime/?token:9`, hybrid poll `POLL_BATCH 16→8`, circuit breaker 30s:1207, `normalizeChangePct:103` | `isRequestCanceled=>false:42` stub |
| `constants/marketGroups.ts:21` | 29 | `SYSTEM_GROUP_IDS` 9 slug (`vn30…ngan-hang`) | SSOT duy nhất |
| `types/vninvestcharts-widget.d.ts:1` | 73 | `VNInvestChartsProps {symbol, theme, showToolbar/showFooter, whaleOrders…}` | Match `package.json:98 vninvestcharts-widget ^1.2.5` |
| `backend/src/user_workspace/models.py:112` | 603 | `Watchlist(is_default)`, `WatchlistItem unique[watchlist,symbol]`, `TrackedSymbol unique[user,symbol]`, `PriceAlert` | `pre_save resolve_tenant auto-CoreTenant:593` |
| `backend/src/user_workspace/views.py:200` | 485 | `WatchlistListCreateView exclude is_default`, `WatchlistItem get_or_create + StockProfile seed:291` | Cursor `ordering -added_at:30` |
| `i18n/vi.js:3018` / `en.js:3020` | 5043/5027 | Legacy watchlist keys `tableSymbol…` nhưng **không có** `watchlist.eyebrow/sidebar/main/table/column` mới | Toàn `defaultValue` fallback |
| `tests/visual/watchlist.spec.ts:1` | 81 | 4 smoke `goto /watchlist, add VCB, rows, remove` | `waitForTimeout 1000` fragile |

### B. LUỒNG DỮ LIỆU TRACE

#### B1 — Load → Select → Render

1. `ShellWatchlistPage.tsx:70` `hasSaasNative` true → `WatchlistPage.tsx:61` `<WatchlistProvider><WatchlistPageContent>`
2. `WatchlistPage.tsx:36` `useEffect autoLoad loadAllLists(true)+fetchPriceAlertsList()` (guard `didInitRef:37`)
3. `WatchlistContext.tsx:98` `loadAllLists` → `Promise.allSettled` 4 calls:
   - `workspace.js:51 getWatchlists → GET /workspace/watchlists/`
   - `market.js:389 getLegacyWatchlistGroups → GET /stock-management/groups/?include_prices=0`
   - `workspace.js:15 getPortfolios → GET /workspace/portfolios/` → nếu `portfolios[0]` thì `workspace.js:151 getPortfolioHoldings(id) → GET /portfolios/{id}/holdings/`
   - `workspace.js:191 getTrackedSymbols → GET /stock-management/tracked-symbols/`
   Catch `console.warn` + return `[]` không fail-fast.
4. Filter `SYSTEM_GROUP_IDS:115` bằng slug `id||name lower+replace \s→-`
5. `set{Watchlists,LegacyGroups,Holdings,TrackedSymbols}`; `selectFirst → watchlist[0] / holds / tracked:156`
6. `WatchlistContext.tsx:225` `selectedType===watchlist && selectedId → fetchItems(id)` → `workspace.js:90 GET /watchlists/{id}/items/` → `setItems + setLastSyncTime`
7. `WatchlistContext.tsx:242` `activeItems → fetchTechnicals(list)` → `market.js:312 getBulkTechnicalsBySymbols → GET /market-data/technicals/bulk/?symbols=JOIN` → `setTechnicalsMap prev+newMap:218`
8. `WatchlistContext.tsx:259` `useRealtimeFeedFromManager({symbols: allSymbols.slice(0,120), pollInterval:10000})` → `RealtimeContext.js:40` `useRealtimeFeedCore enabled aggregatedSymbols>0` (WS `ws://localhost:{port}/ws/realtime/?token` + poll `POLL_BATCH 16:422`)
9. `RealtimeContext.js:142` lọc `quotesBySymbol + alerts` theo `normalizedSymbols`
10. `WatchlistContext.tsx:264` effect `quotesBySymbol → history[20] + priceFlashMap 400ms`
11. `WatchlistMainWorkspace.tsx:340 getListTitle()` + `WatchlistTable.tsx:27 pagedItems slice(page*pageSize)`, `getMergedData:34 {...staticData, price/current_price, change, changePct, volume}`, `renderSparkline` SVG + `renderActions` + sticky `thead`

#### B2 — Thêm mã

`WatchlistMainWorkspace.tsx:162 handleAddSymbol` guard `trim && watchlist && selectedId` → `workspace.js:100 addWatchlistItem(id, upper) → POST /watchlists/{id}/items/ {symbol}` → clear input → `fetchItems + fetchPriceAlertsList`. BE `views.py:285` upper, seed `StockProfile` qua `vnbroker_adapter.fetch_listing_symbols():295`, `get_or_create watchlist+symbol:313` → `201/200`.

#### B3 — Realtime flash + sparkline

`useRealtimeFeedCore.js:543 applyTickerUpdate → mergeQuote:183` resolve `current_price/prev_price/change_pct fraction vs percent:103`. `RealtimeContext.js:264` compare `price !== prevPrice → setPriceFlashMap dir + clearTimeout 400ms`. `WatchlistTable.tsx:52 renderSparkline` đọc `priceHistoryRef 20` → `pathD` normalized, gradient `grad-dyn-${symbol}`.

### C. CONTRADICTIONS

| # | Doc/Plan | Thực tế code | Tác động |
|---|----------|--------------|----------|
| C1 | `AGENTS.md:5` i18n qua `vi.js/en.js` | 34+ keys mới (`watchlist.eyebrow, sidebar.my_lists, table.symbol, column.rsi`…) **KHÔNG TỒN TẠI** trong `vi.js:3018`/`en.js:3020` (grep 0 hit). Code dùng `t(key,{defaultValue:"Mã"})` `WatchlistPage.tsx:46`, `WatchlistTable.tsx:179` | Mất đổi ngôn ngữ, `i18n:scan` báo thiếu |
| C2 | `WatchlistTypes.ts:58 PriceAlert {condition, target_price, is_active}` | BE `models.py:252 AlertType ABOVE/BELOW/EQUAL` + `price_threshold:285` nhưng `workspace.js:254 createPriceAlert` không map `target_price→price_threshold` | POST alert 400/ignored |
| C3 | `WatchlistContext.tsx:102` comment parallel | Holdings vẫn sequential inner `await getPortfolioHoldings` sau `allSettled:137`, chỉ lấy `portfolios[0]:135` | Multi-portfolio mất holdings |
| C4 | `WatchlistDetailPanel.tsx:60` dùng `VNInvestCharts` | Import đồng bộ `from "vninvestcharts-widget":4` + `dist/index.css:1`, trong khi AGENTS từng lazy-load tách chunk | `Use of eval` warning 3124 + bundle không split |
| C5 | `WatchlistTable.tsx:6 PAGE_SIZE [50,100,200]` + `allSymbols.slice(0,120):256` | Table paginate 200 nhưng realtime chỉ sub 120 mã đầu | 80 mã cuối không streaming |

### D. FINDINGS

#### Đỏ — Blocker thương mại

**[W-01] ERROR | P0 | `WatchlistDetailPanel.tsx:69` + `WatchlistTable.tsx:52` | Mock hardcode AI Advisor / Whale Flow / News & sparkline**

Thực tế `WatchlistDetailPanel.tsx:78` text tĩnh `Dòng tiền… MACD Bullish` nối `activeSymbolDetail`. `Whale Order Flow` 3 `<li>14:28 MUA 150k:104`. News 2 link `#` CafeF/FireAnt:131. `renderSparkline` khi `history<2` path giả `M 5,20 Q 25,12…:62`. Tác động: user phát hiện fake → mất niềm tin. Fix: nối `getWhaleAnalyticsSnapshot/getStockNews/getOrderFlow + darkFlowAlerts` + history thật `getDailyPrices/getRealtimeIntraday`.

**[W-02] ERROR | P0 | `i18n/vi.js:3018`, `en.js:3020`, `pages/watchlist/**:46` | i18n debt 0%**

92 keys `watchlist.*` trong code, 0 tồn tại trong `vi.js/en.js` — toàn `defaultValue` tiếng Việt. `i18n:scan` sẽ báo missing. Vi phạm `AGENTS.md:6`. Fix: thêm `watchlist:{eyebrow,title,description, sidebar:{my_lists,holdings,money_flow_alert,badge_user/system…}, main:{column_picker,streaming_live,add_symbol_*}, table:{symbol,price,change,quantity…,empty,pager_*}, column:{rsi,rvol,ma20_dist,bias}}` cả vi+en.

**[W-03] GAP | P0 | `WatchlistSidebar.tsx:66`, `WatchlistTable.tsx:133` | Thiếu guard an toàn destructive**

`handleDeleteWatchlist:66` dùng `window.confirm` native (không a11y, không undo). `removeSymbol:133` gọi ngay không confirm. `handleAlert:126` rỗng. Fix: `Dialog @radix-ui/react-dialog` + toast + Undo 5s (pattern TenantAdmin).

**[W-04] RISK | P0 | `WatchlistContext.tsx:208`, `hooks/useRealtimeFeedCore.js:42` | Thiếu loading/error/skeleton**

`fetchTechnicals catch console.warn`, `loadAllLists allSettled` nuốt lỗi, không `errorMsg`. Không expose realtime error. `WatchlistTable` empty `"Danh sách trống."` cùng style data, không skeleton. `isRequestCanceled=>false` stub. Fix: migrate React Query (`QueryProvider` đã có Sprint 6) + `ShellSkeleton` + `bannerError`.

**[W-05] GAP | P1 | `WatchlistTable.tsx:242`, `WatchlistMainWorkspace.tsx:280` | Thiếu sort/filter/search/select/bulk**

Chỉ pagination + 4 cột visibility. Không sort `price/change/rsi/rvol`, không search, không checkbox, không bulk xóa/đặt alert. Fix: `@tanstack/react-table:64 ^8.21.3` đã cài + `react-window:91` virtualize.

#### Vàng — UX chuẩn TradingView/Bloomberg

**[W-06] RISK | P1 | `WatchlistTable.tsx:170`, `WatchlistPage.css:661` | RowActions chỉ hover**

`.watchlistPage__rowActions opacity:0→tr:hover 1:665`, emoji `📊⚠️📈✕` không `aria-label`. Mobile không hover → mất action. Fix: `@media (hover:none)` luôn hiện + `@iconify/react` + `role="grid"`.

**[W-07] GAP | P1 | `WatchlistSidebar.tsx:398` | System vs User lists lẫn**

Sidebar trộn holdings/tracked/custom + `Thị trường & Chỉ số` trong một list, badge `Của tôi/Hệ thống` tương phản thấp. `SYSTEM_GROUP_IDS` không filter `legacyGroups`. Fix: chia 2 section `Danh mục của tôi` + `Chỉ số hệ thống` với `ScrollArea` riêng.

**[W-08] GAP | P1 | `WatchlistMainWorkspace.tsx:290`, `WatchlistTable.tsx:386` | Tracked/Group table cột rỗng `—`**

Header có `limit` nhưng body fallback chỉ `— colSpan 2:428`, không hiện `whale_alert_threshold`. Holdings thiếu `Ngày mua/weight`. Fix: map `TrackedSymbol.whale_alert_threshold_million:208`.

**[W-09] RISK | P1 | `WatchlistPage.css:1` | Global `:root --wl-*` + `!important`**

`:root {--wl-slate-200…}:9` global xung đột `soc.module.css:1 --soc-*`. Override `padding:1rem !important:722`. Fix: chuyển `WatchlistPage.module.css` + token `var(--soc-*)`.

**[W-10] GAP | P1 | `WatchlistTable.tsx:85` | Sparkline scale sai khi flat**

`range = max-min ||1:85` → `[10,10.01,10]` phóng đại 0.01 thành zigzag. Fix: `range = Math.max(max-min, max*0.002)` floor 0.2%.

#### Xanh — P2/P3 polish

**[W-11] GAP | P2 | `WatchlistDetailPanel.tsx:26` | Thiếu trap focus + scroll lock + deep link**

Không `FocusTrap`, không `body overflow hidden`, không `?symbol=HPG` deep link. Fix: Radix Dialog + `searchParams`.

**[W-12] GAP | P2 | `WatchlistContext.tsx:84` | `visibleColumns` không versioned**

Key `vninvest_watchlist_columns` JSON parse không schema, không migrate khi thêm cột. Fix: `zod ^4.4.3` validate + `BroadcastChannel`.

**[W-13] RISK | P2 | `hooks/useRealtimeFeedCore.js:882` | WS token `localStorage` race**

Đọc `localStorage.getItem('access_token')` mỗi lần, không listen `storage` khi tab khác refresh. Fix: `authTokenStorage.getAccessToken()` + `tenant-changed`.

**[W-14] GAP | P2 | `backend/views.py:200` + `tests/visual/watchlist.spec.ts:1` | Test mỏng**

BE không cover `WatchlistItem seed StockProfile` + tenant isolation `WatchlistItem`. FE chỉ 4 smoke `waitForTimeout 1000` fragile. Fix: `vitest watchlistContext.test.ts` + `marketHelpers.test.ts` + `data-testid="watchlist-row-{symbol}"`.

**[W-15] GAP | P3 | `package.json:98` | Bundle size**

`vite build` 3623 modules, `soc 48k + index 188k gzip 29k`, `eval` warning. Fix: `manualChunks {widget:['vninvestcharts-widget']}` + lazy `DetailPanel`.

### E. QUALITY GATES

| Gate | Lệnh | Kết quả | Bằng chứng |
|------|------|---------|------------|
| **Lint** | `npm run lint` (`eslint src`) | ⏳ TIMEOUT >120s | `package.json:24 eslint ^8.57.0` flat đã sửa Sprint 7.1; cần `npx eslint src --max-warnings 0` riêng |
| **Type-check** | `npx tsc --noEmit` | ✅ PASS | 0 output 2026-09-12 |
| **Build** | `npm run build` (`tsc && vite build`) | ✅ PASS | 3623 modules, `Use of eval in vninvestcharts-widget/dist/index.js:3124` warning, `WatchlistPage 13.33k gzip2.74k` |
| **i18n** | `npm run i18n:scan` + `vi.js/en.js` | ❌ FAIL | 92 keys `watchlist.*` không tồn tại, `vi.js:3018`/`en.js:3020` thiếu |
| **Test** | `npm run test:components` (`vitest`) | ⚠️ GAP | 4 smoke fragile, 0 unit cho context/table/merge |
| **External coupling** | `package.json:98 ^1.2.5` | ✅ PASS | `types/vninvestcharts-widget.d.ts:4` khớp `DetailPanel:60` |
| **a11y** | manual `WatchlistPage.css` | ❌ 6 issues | emoji không `aria-label`, table không `role="grid"`, overlay không `aria-modal`, contrast thấp |

### F. CÂU HỎI CẦN LÀM RÕ

1. Single vs multi-portfolio holdings? `WatchlistContext.tsx:135` chỉ lấy `portfolios[0]`.
2. Price alert inline hay modal riêng `Workspace/PriceAlerts`?
3. Whale threshold col có cần trong `watchlist` mode?
4. Limit 120 symbols đủ cho power user 300–500 mã? Cần virtualize + subscribe visible?
5. BE đã sẵn `GET /stocks/{symbol}/news|order-flow|whale-feed-aggregate` (`market.js:221`) cho panel chưa?

### G. ĐÁNH GIÁ TỔNG THỂ

- **Đạt thương mại?** **CHƯA** — chức năng **4/10**, giao diện **6/10**. Khung 2-col glassmorphism + realtime flash + sparkline + slide-over đã đẹp demo, nhưng 3 trụ cột thương mại (`độ tin cậy`, `độ an toàn thao tác`, `khả năng 200–1000 mã`) chưa đạt do mock + thiếu confirm/undo + thiếu virtualize.
- **Blocker?** 5 P0 (W-01→W-05) phải đóng trước ship trả phí. Không blocker hạ tầng (build/type OK).
- **Ưu tiên?** Sprint 1 đóng P0, Sprint 2 đóng P1 table/a11y, Sprint 3 polish P2.

---

## 5. TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

Watchlist đã có khung SaaS-native tốt (gate feature-flag, 4-fetch parallel, WS+poll hybrid, glassmorphism, slide-over 60fps) nhưng chưa đạt chuẩn thương mại do: (1) DetailPanel toàn mock text/number tĩnh mất tin cậy, (2) 34+ i18n keys thiếu khiến build scan báo missing, (3) xóa mã/lists không confirm/undo dễ mất dữ liệu, (4) thiếu skeleton/error nuốt lỗi từng nguồn, (5) table thiếu sort/filter/search/bulk/virtualize dù đã cài `@tanstack/react-table` + `react-window`. Đóng 5 P0 này trước rồi mới polish hover→touch, a11y, limit 120.

---

## 6. LỘ TRÌNH NÂNG CẤP THƯƠNG MẠI

### Nguyên tắc trải nghiệm khắt khe (Bloomberg / TradingView / Simply Wall St)

- **Dữ liệu đúng hơn đẹp**: mọi số có nguồn + timestamp + stale flag.
- **Không thể mất dữ liệu**: destructive có confirm + undo 5s.
- **Cảm nhận <100ms**: optimistic UI, skeleton, virtualize, code-split.
- **Bàn phím như chuột**: `j/k` navigate, `/` search, `c` create, `?` help.

### P0 — Sprint 1 (1 tuần) — Ship-blocking

| # | Việc | File | Done khi |
|---|------|------|----------|
| P0-1 | Nối DetailPanel data thật `getWhaleAnalyticsSnapshot + getStockNews + getOrderFlow + darkFlowAlerts` | `WatchlistDetailPanel.tsx:69` | Không còn string hardcode, có loading/empty |
| P0-2 | Bổ sung i18n `watchlist.*` 34 keys vi+en + `npm run i18n:scan` xanh | `i18n/vi.js:3018`, `en.js:3020` | `t()` không còn `defaultValue` |
| P0-3 | Confirm Dialog + Undo delete watchlist/removeSymbol | `WatchlistSidebar.tsx:66`, `WatchlistTable.tsx:133` | Dialog Radix + toast Undo |
| P0-4 | React Query + Skeleton + Error banner cho 3 query chính | `WatchlistContext.tsx:98`, `WatchlistMainWorkspace.tsx:275` | `useWatchlistQuery` scope `tenant_id` như `useTenantAdminQuery:42` |
| P0-5 | Sửa `handleAlert` → mở `PriceAlert` dialog (`createPriceAlert` `workspace.js:254`) | `WatchlistTable.tsx:126` | Tạo alert inline thành công |

### P1 — Sprint 2 (1.5 tuần) — Table thương mại

- **TanStack Table** `WatchlistTable.tsx:164`: `columnHelper symbol/price/change/rsi/rvol/ma20Dist/bias/whaleThreshold/pnl`, sorting `onSortingChange`, global filter search, pagination `react-window` virtualize 500 rows.
- **Bulk bar**: checkbox col + `Xóa {n} mã / Áp ngưỡng whale / Thêm vào tracked` dùng `bulkUpdateTrackedSymbolThreshold:490`.
- **Holdings enrichment**: `quantity/avg_cost/market_value/pnl/pnl_pct:273` + `Weight% = market_value / NAV`.
- **a11y**: `role="grid"`, `aria-label`, `FocusTrap` slide-over, `prefers-reduced-motion` tắt `price-glow`, `tabIndex 0` rows.
- **Column persistence v2**: `zod` schema + migrate + cross-tab `storage` event.

### P2 — Sprint 3 (1 tuần) — Tin cậy & hiệu năng

- **Subscribe visible only**: `allSymbols` → `visiblePageSymbols` 50 bản ghi + `onScroll` debounced 300ms, giảm 120→50 WS subs (đã tối ưu `WS_HEALTHY_RECOVERY_MIN_CANDIDATES 3:428`).
- **Sparkline fix**: floor 0.2% + `N/A` khi `volume 0`, tooltip `price @ time`.
- **Seed & limit fix**: chunk `getBulkTechnicalsBySymbols` batch 50, tránh URL dài.
- **Code-split**: `lazy(()=>import('vninvestcharts-widget'))` + `manualChunks` xóa `eval` warning.
- **Tests**: `useRealtimeFeedCore.test.ts` cho `normalizeChangePct/mergeQuote/computeReconnectDelayMs`, `WatchlistContext.test.tsx` 3 tests cross-tenant như Sprint 7.3.

### P3 — Polish liên tục

- Shortcuts `? help, n new list, a add symbol, Cmd+K` (giữ `layout.searchPlaceholder:46`).
- Export CSV/Excel `symbol,price,change,rsi,rvol,weight` qua `zod`.
- Drag reorder `@dnd-kit`, pin top, color tag.
- Analytics `getAllUsageTrends:155` cho `watchlist_created/symbol_added/detail_opened`.

### Checklist nghiệm thu thương mại (DoD)

- [ ] `npm run lint` exit 0, `npx tsc --noEmit` exit 0, `npm run build` không `eval` warning, `npm run i18n:scan` 0 missing, `npm run test:components` ≥6 files/16 tests như Sprint 7, Lighthouse a11y ≥95.
- [ ] Demo 3 persona: **Day-trader** (50 mã sort % change flash <400ms), **Holder** (PnL đúng), **Whale hunter** (threshold override + alert chạm ngưỡng).
- [ ] Không còn mock number, mọi destructive có undo, table 500 rows scroll 60fps.

---

## PHỤ LỤC — EVIDENCE INDEX

- `packages/web/src/pages/WatchlistPage.tsx:46` eyebrow fallback
- `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:78` mock AI text
- `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:62` fake sparkline path
- `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:115` SYSTEM_GROUP_IDS filter
- `packages/web/src/pages/WatchlistPage.css:665` rowActions hover-only
- `packages/core/backend/src/user_workspace/views.py:291` StockProfile seed
- `packages/core/backend/src/user_workspace/models.py:168` unique watchlist+symbol
- `packages/web/src/hooks/useRealtimeFeedCore.js:103` normalizeChangePct fraction vs percent

---

*Generated 2026-09-12 — `docs/AUDIT_WATCHLIST_COMMERCIAL_GRADE_20260912.md` — Khung audit AGENTS.md:65. Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` sau khi đóng P0.*
