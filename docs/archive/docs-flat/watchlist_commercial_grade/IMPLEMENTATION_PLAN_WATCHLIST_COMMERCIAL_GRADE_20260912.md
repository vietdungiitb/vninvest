# KẾ HOẠCH TRIỂN KHAI — WATCHLIST CHUẨN THƯƠNG MẠI

**Mã:** `IMPL-WATCHLIST-20260912`  
**Nguồn audit:** `docs/AUDIT_WATCHLIST_COMMERCIAL_GRADE_20260912.md` REV1 (286 dòng, 5 CONTRADICTIONS C1→C5, 15 findings W-01→W-15)  
**Phản biện độc lập:** `docs/AUDIT_WATCHLIST_INDEPENDENT_REVIEW_20260912.md` — verdict **~85% đúng, đủ duyệt có điều kiện** (4/5 P0 xác nhận, C2 bác bỏ false positive, W-02 hạ P0→P1 nếu VN-only, ledger 7→5 đã sửa)  
**Phạm vi:** `http://localhost:8080/watchlist` — `packages/web/src/pages/{WatchlistPage.tsx:1, workspace/ShellWatchlistPage.tsx:1, watchlist/**}` + `adapters/core/workspace.js:50|market.js:312` + `context/RealtimeContext.js:19` + `hooks/useRealtimeFeedCore.js:416` + `constants/marketGroups.ts:21` + `types/vninvestcharts-widget.d.ts:1` + `backend/src/user_workspace/{models.py:112, views.py:200}` + `market_data/stock_mgmt_native_views.py:4319` (đối chiếu C2)  
**Ràng buộc cứng (`AGENTS.md:5`):** SOC glassmorphism + `soc.module.css` tokens, i18n qua `LangContext` (`useI18n` — không hardcode), API qua `defaultCoreApiAdapter` cast `as unknown as {…}`, nhãn tiếng Việt có dấu, `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi slice, `npm run i18n:scan` xanh khi chạm i18n  
**Quyết định đã chốt trước kickoff (DoR):** §0.1 — VN-only hay song ngữ EN? Mặc định **VN-only ship** (W-02 = P1) để không block P0; EN là follow-up P1. Multi-portfolio scope Sprint 1: giữ `portfolios[0]` (không mở rộng) — ghi rõ trong §0.2. `handleAlert` inline dialog (không reuse `Workspace/PriceAlerts` page) — chốt §0.3. Limit 120 vs 500-mã: Sprint 1 giữ 120, Sprint 3 mới subscribe-visible — chốt §0.4.

---

## 0. MỤC TIÊU & DoD TỔNG

**Mục tiêu:** Đưa `/watchlist` từ demo đẹp (glassmorphism + flash 400ms + sparkline) lên **thương mại** cho 2 persona trả phí: Day-trader (50 mã sort % change, flash <400ms) + Holder (PnL + Weight% đúng) + Whale hunter (threshold + alert chạm ngưỡng) — không còn mock số, không mất dữ liệu khi lỡ tay, chịu 500 rows mượt.

**Blocker thật sau phản biện (REV1):**

- **P0 thật (3):** W-01 mock `WatchlistDetailPanel.tsx:78,100-156` + sparkline giả `WatchlistTable.tsx:62`, W-03 destructive không guard (`Sidebar:66-68`, `Table:133-135`, `Table:126` rỗng), W-04 nuốt lỗi từng nguồn (`Context:104-107,139-141,221`) không skeleton
- **P1 điều kiện:** W-02 i18n namespace lồng thiếu (P0 chỉ khi DoD yêu cầu EN/bilingual hoặc `i18n:scan` xanh chặn merge; mặc định VN-only = P1), W-05 thiếu sort/filter/bulk dù `@tanstack/react-table ^8.21.3:64` + `react-window ^1.8.11:91` đã cài (P0 chỉ khi DoD 500-mã ship)
- **Hủy:** C2 PriceAlert mapping — FE `target_price` đúng contract `stock_mgmt_native_views.py:4323,4334` + test `:1338`, không sửa BE

**DoD tổng (Definition of Done) — bàn giao không cần hỏi lại:**

- [ ] `npx tsc --noEmit` (packages/web) PASS 0 error sau mỗi slice
- [ ] `npx eslint src/pages/watchlist --max-warnings 0` PASS 0 error/0 warning (scope hẹp đã xác minh PASS 2026-09-12)
- [ ] `npm run build` (packages/web) PASS, `WatchlistPage-*` < 20 kB gz, `index-*` không tăng >5% so baseline 925 kB (đã 3623 modules)
- [ ] `npm run i18n:scan` PASS — VN-only: 0 missing cho namespace `watchlist.*` mới; EN: nếu ship song ngữ thì EN cũng 0 missing (quyết §0.1)
- [ ] Không còn P0 open; P1 còn lại có issue theo dõi với owner + ETA
- [ ] E2E `tests/visual/watchlist.spec.ts` PASS 4 tests không `waitForTimeout` fragile, thêm `data-testid` row stable
- [ ] Manual 3 persona demo qua (video 60s + screenshot evidence theo §4)
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` mỗi slice 1 Entry ghi `Validation` đủ 3 gates (tsc/eslint scope hẹp/build hoặc vitest)

**Gate toàn cục đã xác minh trước kickoff:**

- `npx tsc --noEmit` → `TSC_EXIT:0` PASS (re-run phản biện)
- `npx eslint src/pages/watchlist --max-warnings 0` → 0 output PASS (mới chạy 2026-09-12)
- `npm run build` → 3623 modules PASS, `WatchlistPage-BOkL9XFK.css 13.33k gzip2.74k` (tin audit có điều kiện)

---

## 0.1 DoR — QUYẾT ĐỊNH PHẢI CHỐT TRƯỚC KHI DEV BẮT ĐẦU (không để dev tự đoán)

| DoR | Câu hỏi audit §F | Quyết định chốt (PO/Arch ký) | Ảnh hưởng slice |
|-----|------------------|------------------------------|----------------|
| DoR-1 | Ship VN-only hay song ngữ EN? (W-02 mức) | **VN-only ship Sprint 1** — W-02 = P1. Thêm đủ keys `watchlist.*` vào `vi.js` ngay (Slice 1.4); `en.js` chỉ thêm stub tối thiểu `watchlist: {eyebrow, title, description}` để không vỡ khi QA chạy EN locale (không block P0). EN đầy đủ cho 61 keys còn lại là follow-up issue P1 ngoài plan (plan này chỉ có tới Slice 3.3 — không có Slice 2.5). | Slice 1.4 hạ từ P0 xuống P1, không chặn 1.1→1.3 |
| DoR-2 | Multi-portfolio holdings scope? `Context:135` chỉ `portfolios[0]` | **Giữ `portfolios[0]` Sprint 1** — không mở C3. Ghi `TODO MULTI-PORTFOLIO` trong `WatchlistContext.tsx:135` + issue P2. Nếu PO muốn gộp tất cả holdings thì tạo slice riêng `1.6b` (không làm trong Sprint 1). | Không sửa `loadAllLists` holdings logic Sprint 1 |
| DoR-3 | `handleAlert Table:126` nối tới dialog nào? | **Inline `PriceAlertDialog` trong `WatchlistTable` row** — không reuse page `Workspace/PriceAlerts`. Dùng `workspace.js:254 createPriceAlert({symbol, condition, target_price, cooldown_seconds, is_active:true})` với `target_price` đúng contract (đã xác minh). Dialog có field `condition ABOVE/BELOW`, `target_price`, `cooldown 300`. | Slice 1.2 quyết inline |
| DoR-4 | Limit 120 (`Context:256` slice 0,120) có phải DoD 500-mã? | **Sprint 1 giữ 120.** DoD 500-mã là P2, implement subscribe-visible ở Phase 3 Slice 3.1 (50 visible + debounce 300ms). Sprint 1 chỉ ghi chú `NOTE LIMIT 120` trong code. | Slice 1.x không đụng limit |
| DoR-5 | Lint gate treo toàn repo? | **Scope hẹp `src/pages/watchlist --max-warnings 0` là gate chính** cho watchlist PR. Toàn repo `npm run lint` treo do 3524 warnings legacy — không chặn watchlist merge. | Gate §3 áp scope hẹp |

> Dev **không được** tự đổi các DoR trên khi đang code. Nếu PO đổi ý → tạo slice mới, không sửa giữa slice.

---

## 1. PHÂN RÃ SLICE (mỗi slice ≤4 file, 1 PR, review độc lập)

### Phase 0 — Chuẩn bị & chốt DoR (0.5 ngày) — không code feature, chỉ quyết + key list

#### Slice 0.1 — Chốt DoR + liệt kê i18n keys watchlist mới
- **ID:** W-02/C1 + DoR-1→5
- **Files:** `docs/IMPLEMENTATION_PLAN_WATCHLIST_COMMERCIAL_GRADE_20260912.md` (này — §0.1), `packages/web/src/i18n/vi.js:3018` + `en.js:3020` (chỉ liệt kê, chưa thêm keys — thêm ở 1.4)
- **Yêu cầu đạt:**
  - PO ký 5 DoR trên (comment `LGTM DoR-1..5` trong PR hoặc Slack thread ID ghi vào plan §0.1)
  - Liệt kê **64 keys namespace lồng** (đếm chính xác bằng `Select-String … | Sort-Object -Unique` 2026-09-12: **58 keys đang gọi trong code** — root 3, `column` 4, `main` 11, `sidebar` 20, `table` 20 — **+ 6 keys mới** cho Slice 1.2: `table.delete_confirm` + 5 `dialog.*`; thay con số 35 cũ sai): xem danh sách chuẩn ở Slice 1.4 bên dưới — copy nguyên văn vào PR description để reviewer `grep` đối chiếu
  - Không còn "7 CONTRADICTIONS" — đảm bảo doc ghi **5** (C1→C5, C2 đã hủy nhưng giữ số 5 với note `C2 HỦY`)
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS (không đổi code)
  - PR chỉ doc + comment code `TODO MULTI-PORTFOLIO` + `NOTE LIMIT 120` (2 dòng)
- **Bằng chứng bàn giao:** Screenshot `grep` 64 keys chưa tồn tại (0 hit) trước khi làm 1.4
- **Rủi ro:** Thấp

---

### Phase 1 — P0 Blocker (4–5 ngày) — 3 P0 thật + wiring handleAlert

#### Slice 1.1 — W-01 P0: Nối DetailPanel data thật (bỏ mock)
- **ID:** W-01 `WatchlistDetailPanel.tsx:78,100-113,131-156` + `WatchlistTable.tsx:56-62` sparkline giả
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:1`
  - `packages/web/src/adapters/core/market.js:312` (đã có `getBulkTechnicalsBySymbols`, `getWhaleAnalyticsSnapshot:325`, `getStockNews:449`, `getStockOrderFlow:261`, `getWhaleFeedAggregate:375` — chỉ dùng, không sửa)
  - `packages/web/src/adapters/core/market.js:9` (đã có `getRealtimeTickers:9`, `getWhaleAnalyticsSnapshot:325`, `getStockNews:449`, `getStockOrderFlow:261`, `getWhaleFeedAggregate:375` — chỉ dùng, không sửa)
  - `packages/web/src/types/vninvestcharts-widget.d.ts:1` (giữ `VNInvestChartsProps:4` — không sửa)
- **Yêu cầu đạt (không được hỏi lại — spec đóng):**
  - **Xóa toàn bộ mock tĩnh trong `WatchlistDetailPanel.tsx:69-159`:**
    - `AI Advisor` text nối chuỗi `:78-81` → gọi `market.js:325 getWhaleAnalyticsSnapshot(activeSymbolDetail, {timeframe:"session", compact:1})` + `market.js:398 getAdvisoryLatest(activeSymbolDetail)` (fallback nếu 404 → null). Hiển thị `bias_label`, `rsi_14`, `display_score` + `advisory.summary` nếu có; loading `ShellSkeleton` 3 dòng; empty `"Chưa có advisory."` khi null.
    - `Whale Order Flow` 3 `<li> 14:28:10 MUA 150k :100-113` → gọi `market.js:375 getWhaleFeedAggregate(activeSymbolDetail, {session_date: today, limit:5, sort:"desc"})` hoặc `getWhaleFeed:536` nếu aggregate trống. Map `side matched_value/threshold` → `BUY/SELL` + `volume` format `toLocaleString`; empty `"Không có lệnh lớn trong phiên."`; timestamp `ts` format `HH:mm:ss` local.
    - `Tin tức liên quan` 2 link `# :131-156` → gọi `market.js:449 getStockNews(activeSymbolDetail, {page_size:5})`. Map `title/url/source/published_at` (fallback `title: "Tin {symbol}"` + `href: "#"` nếu trống nhưng không hardcode CafeF/FireAnt); empty `"Chưa có tin tức."`; meta `"{timeAgo} - {source}"`.
  - **Chart giữ nguyên:** `Chart:60` `symbol=activeSymbolDetail theme="dark" showToolbar false showFooter false` — không lazy Sprint 1 (đã là sync import `:1,4`); chỉ thêm `key={activeSymbolDetail}` để remount khi đổi mã (tránh stale)
  - **Sparkline `WatchlistTable.tsx:52`:** khi `history.length<2` không dùng path giả `:62-63` nữa → render `—` hoặc skeleton `width 90 height 30` với `aria-label="Chưa đủ dữ liệu xu hướng"`; khi `history≥2` giữ logic cũ nhưng thêm floor `range = Math.max(max-min, max*0.002)` (fix W-10 luôn trong slice này để không quay lại)
  - **State:** `WatchlistDetailPanel.tsx` thêm `useState<{whale, news, advisory, loading, error}>` + `useEffect([activeSymbolDetail])` fetch 3 nguồn `Promise.allSettled`; không dùng `defaultCoreApiAdapter` cast mới — dùng `coreApiAdapter` đã import sẵn trong `market.js` pattern (giữ `AGENTS.md:7` cast nếu cần)
  - **Error/loading:** mỗi section có `loading` skeleton + `error` banner `soc.module.css:inlineError:748` + retry button; toàn panel vẫn đóng được bằng `Escape` + overlay click (`:17-22` giữ)
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS, `npx eslint src/pages/watchlist --max-warnings 0` PASS
  - Manual: mở `/watchlist` → click `📊` (chart btn) ở 1 row → slide-over 420px hiện; mock text `Dòng tiền hiện tại… MACD Bullish` **không còn**; whale list là data thật (hoặc empty đúng); news link là URL thật (không `#` hardcode); sparkline row chưa có history hiện `—` không còn path giả
  - Network: 3 calls `whale-analytics/{symbol}`, `stocks/{symbol}/news/`, `realtime/whale-feed-aggregate/{symbol}/` khi mở panel; đóng panel không gọi lại
  - Test: `WatchlistDetailPanel.component.test.tsx` (mới) 3 tests — loading skeleton khi fetch, empty khi BE trả `[]`, render 1 whale item khi mock `whaleFeedAggregate: {results:[{symbol:"HPG", side:"BUY", matched_value:150000}]}`; mock `coreApiAdapter` qua `vitest vi.mock`
- **Bằng chứng bàn giao:**
  - Screenshot slide-over với data thật (whale + news) + DevTools Network 3 calls
  - `vitest run WatchlistDetailPanel.component.test.tsx` PASS log
  - `npx tsc --noEmit` PASS log
- **Rủi ro & giảm thiểu:** BE `whale-feed-aggregate` có thể trống ngoài giờ → hiển thị empty đúng, không crash; đã có `getWhaleFeed` fallback

#### Slice 1.2 — W-03 P0 + V-06: Guard destructive + nối handleAlert inline
- **ID:** W-03 `WatchlistSidebar.tsx:66-68`, `WatchlistTable.tsx:133-135`, `WatchlistTable.tsx:126-128` rỗng
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistSidebar.tsx:1`
  - `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:1`
  - `packages/web/src/adapters/core/workspace.js:245` (đã có `createPriceAlert:254`, `removeWatchlistItem:110`, `deleteWatchlist:79` — chỉ dùng)
  - `packages/web/src/i18n/vi.js:3018` + `en.js:3020` (thêm 6 keys cho dialog này — liệt kê ở 1.4 nhưng thêm luôn ở đây để dialog không fallback, không vi phạm AGENTS.md:7 `defaultValue` vẫn cho phép nhưng keys phải tồn tại trước merge)
- **Yêu cầu đạt:**
  - **Thay `window.confirm` native `Sidebar:66-68`:**
    - `handleDeleteWatchlist:66` → mở `@radix-ui/react-dialog:60` Dialog (`@radix-ui/react-dialog ^1.1.15` đã có `package.json:56`) với title `t("watchlist.sidebar.delete_confirm", {defaultValue:"Bạn có chắc chắn muốn xóa danh sách \"{name}\"?"})` + 2 nút `Hủy/Xóa` (Xóa = `buttonSignal` đỏ). Không dùng `window.confirm`.
    - Sau delete `await api.deleteWatchlist` + `await loadAllLists(false)` giữ nguyên `:74-75`; thêm `toast` success/error qua pattern `TenantAdmin` (nếu chưa có `toast` system thì dùng `setSuccessMsg/setErrorMsg` hiện có `:72-73` + `successMsg/errorMsg` banner `:275` — giữ đơn giản Sprint 1)
  - **`removeSymbol Table:133-135` thêm guard:**
    - `handleRemove:133` → mở Dialog confirm nhỏ `t("watchlist.table.delete_confirm", {defaultValue:"Xóa mã {symbol} khỏi danh sách?"})` + 2 nút. Chỉ khi confirm mới gọi `removeSymbol(selectedId, symbol)` (đã có `WatchlistContext:195` gọi `removeWatchlistItem` + `fetchItems` + `fetchPriceAlertsList`). Không xóa ngay khi click `✕`.
    - Thêm `aria-label={t("watchlist.table.delete", {defaultValue:"Xóa"}) + " " + symbol}` cho nút `✕` (`:156-160`) để a11y
  - **Nối `handleAlert Table:126-128` rỗng → inline PriceAlertDialog:**
    - `handleAlert:126` → `setPriceAlertDialog({open:true, symbol})` (local state `useState<{open,symbol,condition,target_price,cooldown}>`)
    - Dialog có fields: `symbol` readonly mono, `condition` select `ABOVE/BELOW` (`vi.js` key `watchlist.dialog.condition_above/below`), `target_price` number input `type="number" step="100" min="1000"` + `cooldown_seconds` number `default 300 min 0`. Validate `target_price>0` else inline error `t("watchlist.dialog.target_required")`.
    - Submit → `await api.createPriceAlert({symbol, condition, target_price: Number(target_price), cooldown_seconds: Number(cooldown), is_active:true})` (`workspace.js:254`). Toast/banner success `t("watchlist.dialog.create_success")`, close dialog. Error → inline `errorMsg` trong dialog (không đóng).
    - Dialog dùng Radix Dialog + focus trap mặc định, `onOpenChange` close, `Escape` đóng, overlay click đóng
  - **Icon:** giữ emoji `📊⚠️📈✕` Sprint 1 (không đổi `@iconify/react` để giữ scope ≤4 file); thêm `title` + `aria-label` đầy đủ cho 4 nút (`:142-160`)
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS, `eslint src/pages/watchlist` PASS
  - Manual: xóa watchlist → Dialog hiện (không còn native confirm); click Hủy → không xóa; Xóa → toast/banner + list biến mất; xóa mã trong table → Dialog confirm hiện, Hủy không xóa, Xóa thì row biến mất; click `⚠️` → PriceAlertDialog hiện, nhập 10000 ABOVE → Submit → banner success, dialog đóng; thử target rỗng → inline error không đóng
  - Test: `WatchlistDestructiveGuard.component.test.tsx` (mới) 4 tests — delete watchlist Dialog Cancel không gọi `deleteWatchlist`, Confirm gọi 1 lần; removeSymbol Guard Cancel/Confirm; PriceAlertDialog submit gọi `createPriceAlert` với `target_price` number
- **Bằng chứng:** Video 30s thao tác 3 flows + `vitest` 4 tests PASS + tsc/eslint log
- **Rủi ro:** Dialog Radix đã có sẵn, không thêm dep; nếu thiếu `toast` system thì fallback banner đã đủ

#### Slice 1.3 — W-04 P0: React Query + skeleton + error banner (3 query chính)
- **ID:** W-04 `WatchlistContext.tsx:104-107,139-141,185-193,208-221` + `WatchlistMainWorkspace.tsx:275` banners
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:1` (refactor chính)
  - `packages/web/src/pages/watchlist/components/WatchlistMainWorkspace.tsx:1` (banners đã có `:275` — chỉ thêm skeleton)
  - `packages/web/src/components/ShellSkeleton.tsx` (tái dùng — đã có tại `src/components/ShellSkeleton.tsx:18`, đang dùng `TenantAdmin` Sprint 6)
  - `packages/web/src/providers/QueryProvider.tsx` (đã có Sprint 6.2 — chỉ dùng, không sửa)
- **Yêu cầu đạt (không hỏi lại — spec đóng):**
  - **Giữ `WatchlistContext` API surface** (không vỡ consumer): `watchlists, legacyGroups, holdings, trackedSymbols, priceAlerts, selectedType/Id, items, activeItems, technicalsMap, priceFlashMap, lastSyncTime, realtimeFeed, activeSymbolDetail, loading, errorMsg, successMsg, setSelectedType/Id/setActiveSymbolDetail/setErrorMsg/setSuccessMsg, loadAllLists, fetchItems, fetchPriceAlertsList, removeSymbol, priceHistoryRef, visibleColumns/setVisibleColumns` — tất cả giữ nguyên type. Bên trong đổi implementation sang React Query.
  - **3 queries chính (scope `tenant_id` như `useTenantAdminQuery:42`):**
    - `queryKey: ["watchlist","lists", tenantId]` → `queryFn: loadAllLists` (4-parallel `allSettled` giữ nguyên `:103` nhưng không nuốt lỗi silent: mỗi `catch` vẫn return `[]` nhưng thêm `setErrorMsg` nếu cả 4 đều `rejected` hoặc `onError` của `useQuery` set `errorMsg`)
    - `queryKey: ["watchlist","items", String(selectedId), tenantId]` → `enabled: selectedType==="watchlist" && !!selectedId`, `queryFn: () => api.getWatchlistItems(selectedId).then(r=>r.results??r)` → `setItems` vẫn để `items` state nhưng đồng bộ từ `data` qua `useEffect` (hoặc bỏ `items` state, expose `data` trực tiếp — chọn phương án ít vỡ: giữ `items` state + sync `useEffect([query.data])`)
    - `queryKey: ["watchlist","technicals", symbolsKey, tenantId]` → `enabled: activeItems.length>0`, `queryFn: () => api.getBulkTechnicalsBySymbols(activeItems.map(i=>i.symbol))` → sync `technicalsMap`
  - **`loading/errorMsg/successMsg` mapping:**
    - `loading = isPendingLists || isPendingItems || isPendingTechnicals` (thay `setLoading` thủ công `:99,169`)
    - `errorMsg` expose từ `query.error?.message` + giữ `setErrorMsg` manual cho create/rename/delete flows; banner `WatchlistMainWorkspace.tsx:275` giữ `errorMsg && <div className="p-3 bg-rose-500/10 …">` + `successMsg` tương tự `:279`
  - **Realtime giữ nguyên:** `useRealtimeFeedFromManager:259` với `symbols: allSymbols.slice(0,120)` + `pollInterval 10000` vẫn để nguyên (không đổi limit Sprint 1 — DoR-4). Chỉ thêm `realtimeFeed` error expose nếu `realtimeFeed.metrics.connectionState.transport==="polling"` và `fallbackRatioPct>20` thì set `errorMsg` warn (không block)
  - **Skeleton:** `WatchlistMainWorkspace.tsx:275` trước khi render `WatchlistTable` nếu `loading && activeItems.length===0` → render `ShellSkeleton` 3 rows + header skeleton (thay vì `Danh sách trống.`). Khi `loading && activeItems.length>0` giữ table + overlay spinner nhỏ ở header `lastSyncTime`
  - **Không đụng:** `priceFlashMap`, `priceHistoryRef`, `visibleColumns` localStorage `:84`, `selectedType/Id` logic — giữ nguyên để không vỡ `WatchlistSidebar`/`Table`
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS, `eslint src/pages/watchlist` PASS
  - Manual: reload `/watchlist` → skeleton 3 dòng hiện 200ms rồi table hiện; tắt network cho `getWatchlists` → banner `Không thể tải dữ liệu.` hiện (không còn silent `console.warn`); switch watchlist khác → skeleton items hiện rồi data; mở DevTools React Query DevTools (nếu có) thấy keys có `tenantId`
  - Test: `WatchlistContext.rq.component.test.tsx` (mới) 3 tests — (1) loading skeleton khi `isPending`, (2) error banner khi `getWatchlists` reject, (3) switch watchlist khác `selectedId` thì `getWatchlistItems` gọi với id mới (mock `coreApiAdapter` + `QueryClientProvider` + `LangContext` như `TenantAdminHomePage.component.test.tsx:1`)
- **Bằng chứng:** `vitest` 3 tests PASS + tsc/eslint + screenshot skeleton vs banner
- **Rủi ro:** Thấp — giữ API surface, chỉ đổi internals; đã có `QueryProvider` Sprint 6 nên không thêm dep

#### Slice 1.4 — W-02 P1 (VN-only): Thêm namespace lồng `watchlist.*` (58 đang gọi + 6 mới = 64 keys `vi.js`, EN stub 3 keys)
- **ID:** W-02/C1 `i18n/vi.js:3018`, `en.js:3020`, `pages/watchlist/**:46` — hạ P0→P1 nếu VN-only (DoR-1)
- **Files (4):**
  - `packages/web/src/i18n/vi.js:3018`
  - `packages/web/src/i18n/en.js:3020`
  - `packages/web/src/pages/watchlist/components/WatchlistSidebar.tsx:1` (đổi 2 keys demo để proof scan — còn lại giữ `t(..., {defaultValue})` nhưng keys đã tồn tại nên scan không báo)
  - `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:1` (tương tự)
- **Yêu cầu đạt — danh sách CHÍNH XÁC 58 keys đang gọi + 6 keys mới (tổng 64 thêm vào `vi.js`; đếm bằng `Select-String -Pattern 't\("watchlist\.[a-z_\.]+"' | Sort-Object -Unique` + `ma20_dist` chứa digit nên đếm tay — thay mọi con số 34/35/92 cũ sai):**
  - **Nhóm `watchlist` root (3, đang gọi):** `eyebrow: "Rada Thị Trường" / stub "Market Radar"` (`WatchlistPage.tsx:46`), `title: "Danh Mục Theo Dõi" / stub "Watchlist"` (`:47`), `description: "Theo dõi biến động giá…"` (`:48`)
  - **Nhóm `watchlist.sidebar` (20 đang gọi + 1 mới `delete_confirm`):** `my_lists`, `holdings`, `money_flow_alert`, `count_suffix`, `badge_user`, `badge_system`, `rename`, `delete`, `new_list_placeholder`, `create_list`, `market_indices`, `collapse`, `expand`, `create_success`, `create_error`, `rename_success`, `rename_error`, `delete_success`, `delete_error` (20 — `WatchlistSidebar.tsx:35-461`) + mới `delete_confirm: "Bạn có chắc chắn muốn xóa danh sách \"{name}\"?"` (dùng ở Slice 1.2)
  - **Nhóm `watchlist.main` (11, đang gọi):** `column_picker`, `column_options`, `custom_list`, `market_indices`, `title`, `streaming_live`, `offline`, `last_updated`, `add_symbol_placeholder`, `add_symbol_btn`, `remove_success: "Đã xóa mã {symbol} khỏi danh sách."` (`WatchlistContext.tsx:200`)
  - **Nhóm `watchlist.table` (20 đang gọi + 1 mới `delete_confirm`):** `view_chart`, `set_alert`, `view_detail`, `delete`, `symbol`, `price`, `change`, `quantity`, `avg_cost`, `market_value`, `pnl`, `pnl_pct`, `quick_action`, `trend`, `company_name`, `limit`, `empty`, `neutral`, `pager_range`, `pager_page` (20 — `WatchlistTable.tsx:143-546`) + mới `delete_confirm: "Xóa mã {symbol} khỏi danh sách?"` (dùng ở Slice 1.2)
  - **Nhóm `watchlist.column` (4, đang gọi):** `rsi: "RSI(14)"`, `rvol: "RVOL"`, `ma20_dist: "% Cách MA20"`, `bias: "Định hướng"` (`WatchlistMainWorkspace.tsx:31-34`, `WatchlistTable.tsx:209-212`)
  - **Nhóm `watchlist.dialog` (5 keys HOÀN TOÀN MỚI cho Slice 1.2):** `condition_above: "Vượt lên trên"`, `condition_below: "Rơi xuống dưới"`, `target_required: "Giá mục tiêu là bắt buộc."`, `create_success: "Đã tạo cảnh báo giá."`, `target_price: "Giá mục tiêu"`
  - Các keys phẳng legacy (`tableSymbol:3142`, `targetPrice:3134`, `priceUnitHint:3024`…) giữ nguyên không xóa, không đổi
  - **EN (VN-only theo DoR-1):** `vi.js` thêm đủ 64 keys trên; `en.js` chỉ thêm stub tối thiểu `watchlist: {eyebrow:"Market Radar", title:"Watchlist", description:"Track price, RSI, RVOL…"}`. EN đầy đủ 61 keys còn lại là follow-up issue P1 ngoài plan
- **Tiêu chí đánh giá:**
  - `npx tsc --noEmit` PASS
  - `npm run i18n:scan` (package.json:26) → **0 missing** cho `watchlist.*` namespace mới (chạy `npx i18next-scanner --config i18next-scanner.config.js 2>&1 | grep -i "watchlist.*missing" → 0`)
  - `npx eslint src/pages/watchlist --max-warnings 0` PASS
  - Manual: đổi `localStorage.lang = "en"` reload → header/sidebar/table đổi EN ngay (không còn `defaultValue` VN rơi lại); VN locale vẫn `Rada Thị Trường / Danh Mục Theo Dõi`
  - Không cần test mới — scan là evidence
- **Bằng chứng:** `i18n:scan` log 0 missing + screenshot EN vs VN
- **Rủi ro:** Thấp — chỉ thêm keys, không đổi logic; đã tách stub C2 nên không vỡ BE

---

### Phase 2 — Table thương mại + a11y (5–6 ngày)

#### Slice 2.1 — W-05 P1: TanStack Table base (sort + filter + search)
- **ID:** W-05 `WatchlistTable.tsx:242`, `WatchlistMainWorkspace.tsx:280` — `package.json:64 @tanstack/react-table ^8.21.3` đã cài nhưng watchlist chưa import
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:1`
  - `packages/web/src/pages/watchlist/components/WatchlistMainWorkspace.tsx:1` (thêm search input)
  - `packages/web/src/pages/watchlist/WatchlistTypes.ts:1` (thêm `ColumnMeta` type nếu cần)
  - `packages/web/src/i18n/vi.js:3018` (thêm 3 keys `watchlist.table.search_placeholder, sort_asc/desc`)
- **Yêu cầu đạt:**
  - Dùng `createColumnHelper<MergedData>` + `useReactTable({data: paged? activeItems (đổi từ slice sang toàn bộ activeItems — bỏ slice thủ công :27, để TanStack handle pagination), columns, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, state:{sorting, globalFilter}, onSortingChange, onGlobalFilterChange})`
  - Columns giữ nguyên 4 modes nhưng extract `columnsWatchlist / columnsHolds / columnsTracked / columnsGroup` với `accessorKey: "symbol" | "price" | "price_change_pct" | "rsi_14" | "rvol" | "ma20_distance_pct" | "bias_label"` + `enableSorting` true cho `symbol/price/change/rsi/rvol/ma20Dist`, `cell` giữ `priceFlashMap` + `isUp/isDown` color
  - Search: `WatchlistMainWorkspace.tsx` thêm `input type="search" placeholder={t("watchlist.table.search_placeholder", {defaultValue:"Tìm mã, tên DN…"})} value={globalFilter} onChange={e=>setGlobalFilter(e.target.value)}` debounce 200ms; filter qua `globalFilterFn: "includesString"` trên `symbol + company_name`
  - Pagination giữ `PAGE_SIZE_OPTIONS [50,100,200]` nhưng dùng `table.getPageCount() / setPageSize` thay `useState page` thủ công `:18-19` (xóa `pagedItems` memo)
  - Giữ `density compact/comfortable` + `visibleColumns` toggles (`rsi/rvol/ma20Dist/bias`) → map `columnVisibility` state
  - Không đụng realtime/sparkline/actions — giữ `renderActions` + `renderSparkline` trong `cell`
- **Tiêu chí:**
  - `tsc` + `eslint watchlist` PASS
  - Manual: click header `Mã` sort A-Z ↔ Z-A; click `% Thay đổi` sort; gõ `HPG` filter chỉ HPG; đổi pageSize 50→100 → table phản hồi <100ms
  - Test: `WatchlistTable.sortfilter.component.test.tsx` 3 tests — sort symbol asc, globalFilter HPG, pagination page 2
- **Bằng chứng:** vitest 3 tests PASS + tsc/eslint + video sort/filter

#### Slice 2.2 — Bulk bar + holdings enrichment + tracked threshold
- **ID:** W-05 tiếp + W-08 `WatchlistMainWorkspace.tsx:290`, `WatchlistTable.tsx:386` cột rỗng `—`
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:1`
  - `packages/web/src/adapters/core/workspace.js:489` (đã có `bulkUpdateTrackedSymbolThreshold:489` — chỉ dùng)
  - `packages/web/src/pages/watchlist/WatchlistTypes.ts:1` (thêm `Holding.weightPct?`)
  - `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:1` (thêm `holdingsNav` nếu cần)
- **Yêu cầu đạt:**
  - Checkbox col `display` `enableSorting false` với `header: checkbox select all`, `cell: checkbox`; `rowSelection` state; bulk bar sticky trên table khi `selectedCount>0`: `"Đã chọn {n} mã"` + 3 nút `Xóa {n} mã` (gọi lần lượt `removeWatchlistItem` với confirm tổng), `Tạo alert hàng loạt` (mở dialog bulk `target_price/condition` áp cho n mã, gọi `Promise.all createPriceAlert`), `Áp ngưỡng whale {n} mã` (chỉ khi `selectedType==="tracked"` — gọi `bulkUpdateTrackedSymbolThreshold(ids, threshold)`)
  - **Holdings enrichment `Holds` mode `Table:271`:** thêm cột `Weight%` = `market_value / sum(market_value) *100` (tính trong `WatchlistTable` memo, format `toFixed(1)%`); thêm tooltip `Ngày mua` nếu có `Holding` extended (nếu BE không có thì để `—` nhưng không vỡ)
  - **Tracked threshold `WatchlistTable:386` fix `—`:**
    - Khi `selectedType==="tracked"` thì cột `limit` hiện `whale_alert_threshold_million` từ `TrackedSymbol:208` (lấy từ `trackedSymbols.find(t=>t.symbol===row.symbol)?.whale_alert_threshold_million`) fallback `"Mặc định"` nếu null; không còn `colSpan 2` với `—`
    - Khi `selectedType==="group"` giữ 2 cột RSI/RVOL như hiện tại `:224-225` nhưng không rỗng — lấy từ `technicalsMap`
- **Tiêu chí:** Manual bulk chọn 3 mã → bar hiện → Xóa 3 mã confirm tổng → 3 rows biến mất; tracked limit hiện số threshold; holdings có Weight%
- **Bằng chứng:** vitest bulk bar 2 tests + screenshot Weight% + threshold

#### Slice 2.3 — W-06 P1 + W-09 P1 + W-11 P2: a11y + CSS module + trap focus
- **ID:** W-06 `Table:170, css:661` hover-only, W-09 `css:1` global `:root`, W-11 `DetailPanel:26` trap/scroll/deep-link
- **Files (4):**
  - `packages/web/src/pages/WatchlistPage.css` → `packages/web/src/pages/WatchlistPage.module.css` (rename + refactor)
  - `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:1` (thêm `role="grid"`, `aria-label`)
  - `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:1` (thêm `Dialog` + deep link)
  - `packages/web/src/pages/WatchlistPage.tsx:1` (đổi import css)
- **Yêu cầu đạt:**
  - **CSS module:** rename `WatchlistPage.css:1` → `WatchlistPage.module.css`, đổi `:root --wl-*` thành `:local` + import `styles from "./WatchlistPage.module.css"` trong `WatchlistPage.tsx:2` + `Table/Sidebar/Main/Detail`. Thay `var(--wl-*)` giữ nguyên value nhưng scope module (không global leakage). Xóa `!important:722` bằng specificity module (`.sidebarCard` trong module đã đủ). Giữ `soc.module.css` tokens cho glassmorphism (`glassPanel`, `sectionCardTitle`) — không đụng `soc.module.css:1`
  - **a11y Table:** `table role="grid" aria-label={t("watchlist.table.aria_grid", {defaultValue:"Bảng danh mục theo dõi"})}`, `th aria-sort`, `tr tabIndex 0`, `Enter/Space` → `handleRowClick`, focus-visible ring `ring-2 ring-cyan-400`; 4 action btn có `aria-label` đã làm ở 1.2 + thêm `@media (hover:none)` luôn `opacity:1` cho `.rowActions` (touch); `density` toggle có `aria-pressed`
  - **DetailPanel trap + scroll lock + deep link:** đổi overlay `div` sang `@radix-ui/react-dialog` (`Dialog.Root open={!!activeSymbolDetail} onOpenChange={v=>!v && handleClose()}`) — mặc định có focus trap + `aria-modal`. Thêm `useEffect([activeSymbolDetail]) { document.body.style.overflow = activeSymbolDetail ? "hidden" : ""; return ()=>document.body.style.overflow="" }`. Deep link: `useEffect` mount đọc `searchParams.get("detail")` → `setActiveSymbolDetail`; khi `setActiveSymbolDetail` thì `history.replaceState(null,"", location.pathname + (symbol ? "?detail="+symbol : ""))` (không push). Đóng bằng `Escape` đã có `:17-22` giữ nhưng qua Radix thì tự có
  - **Reduced motion:** `@media (prefers-reduced-motion: reduce) { .priceCell--up/down {animation:none} }`
- **Tiêu chí:**
  - `tsc` + `eslint watchlist` PASS, `npm run build` PASS — `WatchlistPage.module.css` không vỡ Vite (đã có `css.modules` mặc định)
  - Manual: đổi tên `WatchlistPage.css` → build vẫn xanh; Lighthouse a11y ≥95 (axe 0 critical); mobile touch rowActions luôn hiện; deep link `?detail=HPG` mở panel sau reload; `Escape` đóng, focus trap Tab không leak ra ngoài
  - Test: `WatchlistA11y.component.test.tsx` 2 tests — `role="grid"` tồn tại, `?detail=HPG` mở panel
- **Bằng chứng:** Lighthouse a11y screenshot ≥95 + axe `0 critical` log + deep link video

#### Slice 2.4 — W-10 P1 + W-12 P2: Sparkline floor + visibleColumns versioned
- **ID:** W-10 `Table:85` flat phóng đại, W-12 `Context:84` localStorage không schema
- **Files (3):**
  - `packages/web/src/pages/watchlist/components/WatchlistTable.tsx:52` (sparkline floor đã làm 1.1 nhưng bổ sung tooltip)
  - `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:82` (visibleColumns zod)
  - `packages/web/src/pages/watchlist/WatchlistTypes.ts:1` (thêm `VisibleColumns` type)
- **Yêu cầu đạt:**
  - Sparkline tooltip `title={priceHistoryRef.current[symbol].join(" → ")}` hoặc `aria-label` khi hover
  - `visibleColumns` dùng `zod ^4.4.3` (đã có): `const VisibleColumnsSchema = z.object({rsi:z.boolean(), rvol:z.boolean(), ma20Dist:z.boolean(), bias:z.boolean()}).partial()` + `safeParse` khi `JSON.parse(localStorage.getItem)`, fallback `{rsi:true,rvol:true,ma20Dist:true,bias:true}` nếu fail; thêm `version:1` key `vninvest_watchlist_columns_v1` để migrate; `BroadcastChannel("watchlist-columns")` sync cross-tab khi `setVisibleColumns`
- **Tiêu chí:** `tsc` PASS; Manual: `localStorage.setItem("vninvest_watchlist_columns", "bad json")` reload → cột về default không crash; mở 2 tab đổi cột → tab kia sync
- **Bằng chứng:** vitest `visibleColumns` 2 tests (bad json + cross-tab)

---

### Phase 3 — Hiệu năng & polish + bàn giao (3–4 ngày)

#### Slice 3.1 — W-15 P3 + DoR-4: Subscribe visible + code-split widget (perf)
- **ID:** W-15 `package.json:98` eval warning + limit 120 DoR-4 + C4 sync import
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistContext.tsx:256` (visible subs)
  - `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:1` (lazy widget)
  - `packages/web/vite.config.ts` (manualChunks)
  - `packages/web/src/pages/WatchlistPage.tsx:1` (giữ `ShellPageChrome` — không đụng)
- **Yêu cầu đạt:**
  - **Subscribe visible only:** thay `allSymbols.slice(0,120):256` → `visibleSymbols = useMemo(() => pagedOrFilteredSymbols.slice(0,50).map(s=>s.toUpperCase()), [filtered paged, pageSize, pageIndex])` + `useRealtimeFeedFromManager({symbols: visibleSymbols, pollInterval:10000})` (50 bản ghi visible, debounce `onPaginationChange` 300ms). Giữ `allSymbols` cho bulk search nhưng không subscribe hết. Ghi chú `NOTE VISIBLE SUBS 50` trong code.
  - **Lazy widget:** `WatchlistDetailPanel.tsx:1` đổi `import {VNInvestCharts} from "vninvestcharts-widget":4` → `const VNInvestCharts = lazy(()=>import("vninvestcharts-widget").then(m=>({default:m.VNInvestCharts})))` + wrap `<Suspense fallback={<ShellSkeleton height={280} />}>` cho chart `:60-65`. Giữ `dist/index.css` import nhưng move vào `DetailPanel` lazy chunk (Vite tự tách).
  - **manualChunks `vite.config.ts`:** thêm `build.rollupOptions.output.manualChunks = {widget:["vninvestcharts-widget"], vendor:["react","react-dom","@tanstack/react-query","@tanstack/react-table","react-window"]}` (giữ `ecma` đã có cho dashboard). Xóa `eval` warning sau build (nếu còn thì ghi `CHƯA XÁC MINH` trong evidence — vì là package ngoài)
- **Tiêu chí:**
  - `npm run build` → `widget-*` chunk riêng, `WatchlistPage-*` <20k gz, `eval` warning hết hoặc giảm; `tsc` PASS
  - Manual: page 1 (50 rows) WS subscribe 50 symbols (Network `tickers?symbols=` 50); sang page 2 → subscribe đổi 50 mới sau 300ms; lazy chart chunk chỉ load khi mở detail panel (Network `widget-*` khi click `📊`)
- **Bằng chứng:** `npm run build` log chunk list + Network `tickers` 50 + `widget-*` lazy log

#### Slice 3.2 — W-14 P2 + W-04 tách stub: Tests mở rộng (FE + BE evidence)
- **ID:** W-14 `views.py:200` + `tests/visual/watchlist.spec.ts:1` mỏng + R-04 tách stub `isRequestCanceled:42`
- **Files (4):**
  - `packages/web/src/pages/watchlist/components/WatchlistContext.rq.component.test.tsx` (đã có ở 1.3 — bổ sung thêm 2 tests cross-tenant)
  - `packages/web/src/hooks/useRealtimeFeedCore.test.ts` (mới — unit `normalizeChangePct:103`, `mergeQuote:183`, `computeReconnectDelayMs:277`)
  - `packages/web/tests/visual/watchlist.spec.ts:1` (sửa fragile)
  - `packages/web/src/hooks/useRealtimeFeedCore.js:42` (ghi chú `TODO isRequestCanceled stub — CHƯA XÁC MINH tác động watchlist` — không sửa logic)
- **Yêu cầu đạt:**
  - **FE component tests (vitest `npm run test:components`):**
    - `WatchlistContext.rq.component.test.tsx` thêm `cross-tenant stale` như `useTenantAdminQuery.component.test.ts:1` (Sprint 7.3) — mock 2 tenant `localStorage tenant_id` khác nhau, verify cache không share
    - `useRealtimeFeedCore.test.ts` 5 tests theo hành vi thật trong code (dev đọc code trước khi chốt assert): `normalizeChangePct:103` fraction-vs-percent, `mergeQuote:183` gộp quote, `computeReconnectDelayMs:277` backoff, `normalizePollSymbolCandidates:330` loại symbol rỗng/trùng, `resolveRealtimePollIntervalMs:377` interval theo `wsHealthy` (KHÔNG test `MARKET_DISCOVERY` — symbol này không tồn tại trong `useRealtimeFeedCore.js`, grep 0 hit)
  - **Visual E2E `watchlist.spec.ts:1` sửa fragile:**
    - Thay `waitForTimeout 1000` bằng `await expect(page.locator('[data-testid="watchlist-row"]')).first().toBeVisible({timeout:10000})`
    - Thêm `data-testid="watchlist-row-{symbol}"` vào `WatchlistTable.tsx:275` `tr data-testid={`watchlist-row-${symbol}`}` và `data-testid="watchlist-add-input"`, `data-testid="watchlist-delete-confirm"`
    - Giữ 4 tests nhưng selector stable `getByTestId`
  - **BE evidence (không code, chỉ ghi nhận):** `test_stock_management_native_api.py:1332-1695` đã cover `target_price` POST `:1338` — ghi vào handover `BE contract đã có test, không cần thêm` (phản biện E test row)
- **Tiêu chí:**
  - `npm run test:components` → vitest 8+ files PASS (3 mới + 4 cũ watchlist + 16 legacy dashboard)
  - `npx playwright test tests/visual/watchlist.spec.ts --project=chromium` → 4 PASS không flaky
  - `npx tsc --noEmit` PASS
- **Bằng chứng:** `vitest run --reporter=verbose` log + `playwright test --reporter=list` log
- **Rủi ro:** Thấp — chỉ tests

#### Slice 3.3 — Handover evidence + gates cuối (không code, chỉ verify + doc)
- **ID:** Quality Gates E (lint/scan/build/test/a11y) + ledger
- **Files (1 + docs):**
  - `docs/CODE_CHANGE_AUDIT_LEDGER.md` (thêm Entry 43→47 cho 5 slices P0 + 4 slices P1 + 3 slices P3)
  - `docs/AUDIT_WATCHLIST_COMMERCIAL_GRADE_20260912.md` (không sửa — giữ REV1)
- **Yêu cầu đạt — checklist bàn giao (evidence phải đính kèm trong PR cuối hoặc `docs/evidence/watchlist-20260912/`):**
  - [ ] `npx tsc --noEmit` log `TSC_EXIT:0` (copy từ terminal)
  - [ ] `npx eslint src/pages/watchlist --max-warnings 0` log 0 output
  - [ ] `npm run build` log `3623 modules` + `WatchlistPage-*` chunk + `widget-*` chunk (nếu 3.1 xong)
  - [ ] `npm run i18n:scan` log 0 missing cho `watchlist.*` (VN-only: 0 missing; EN stub: 0 missing cho keys đã thêm)
  - [ ] `npm run test:components` log vitest 8+ files PASS (watchlist 5+ files)
  - [ ] `npx playwright test tests/visual/watchlist.spec.ts` log 4 PASS
  - [ ] Lighthouse a11y ≥95 screenshot (nếu 2.3 xong)
  - [ ] 3 video 30s persona: Day-trader sort % change flash <400ms, Holder Weight% + PnL, Whale threshold + alert inline
  - [ ] `npm run build` gzip sizes không tăng >5% baseline
- **Tiêu chí:** Tất cả evidence files nằm trong `docs/evidence/watchlist-20260912/` + ledger đủ Entry; PO/QA ký `LGTM` trong PR cuối
- **Bằng chứng:** Folder evidence + ledger

---

## 2. MA TRẬN PHỤ THUỘC (REV1 sửa C2 + W-02)

```
0.1 (DoR + key list) ──> 1.1 (DetailPanel real) ──> 1.2 (Destructive guard + handleAlert) ──> 1.3 (RQ + skeleton) ──> 1.4 (i18n VN-only)
                              │                              │
                              └─> 2.1 (TanStack base) ──> 2.2 (Bulk + enrichment) ──> 2.3 (a11y + CSS module) ──> 2.4 (sparkline + zod)
                                                        │
                                                        └─> 3.1 (visible subs + lazy) ──> 3.2 (tests) ──> 3.3 (evidence)
1.1 độc lập có thể song song 1.2 sau khi DoR chốt; 1.3 phụ thuộc 1.1 (để test skeleton không vỡ mock); 1.4 có thể song song 1.1-1.3 sau khi key list xong.
2.1 phụ thuộc 1.3 (table state từ RQ ổn định); 2.3 rename CSS phụ thuộc 2.1 (để không conflict table refactor).
3.1 phụ thuộc 2.1 (pagination mới mới có visible subs).
```

- 0.1 chặn tất cả 1.x (DoR + key list phải chốt trước).
- 1.1→1.2 tuần tự (DetailPanel real data dùng adapter đã có, không chặn nhưng nên xong trước destructive để test panel không bị guard vỡ).
- 1.2 và 1.3 có thể song song sau 1.1 (≤4 file mỗi slice, không chung file ngoài `Table`/`Context` overlap — nếu song song thì 1.2 chạm `Table+Sidebar`, 1.3 chạm `Context+Main` nên OK).
- 1.4 có thể song song 1.1-1.3 (chỉ i18n) nhưng phải xong trước 3.3 scan.
- 2.x tuần tự sau 1.x; 3.x tuần tự sau 2.x.

---

## 3. TIÊU CHÍ ĐÁNH GIÁ CHUNG (áp mọi slice) + DoR

**DoR trước mỗi slice (dev tự check):**

- [ ] Đọc §0.1 DoR chốt, không tự đổi quyết định
- [ ] File chạm ≤4, PR description ghi `Fixes W-xx / C-x` + `file:line` trước/sau
- [ ] `npx tsc --noEmit` local PASS trước push

| Gate | Lệnh | Tiêu chí PASS |
|------|------|---------------|
| Type | `npx tsc --noEmit` (packages/web) | 0 error |
| Lint (watchlist) | `npx eslint src/pages/watchlist --max-warnings 0` | 0 error, 0 warning |
| Lint (toàn repo) | `npm run lint` (optional) | Ghi log, không chặn (3524 warnings legacy) |
| Build | `npm run build` (packages/web) | PASS, chunk WatchlistPage <20k gz, widget chunk tách |
| Test | `npm run test:components` (vitest) | Liên quan slice PASS; ≥8 files sau 3.2 |
| E2E | `npx playwright test tests/visual/watchlist.spec.ts` | 4 PASS stable (không `waitForTimeout`) |
| i18n | `npm run i18n:scan` | 0 missing `watchlist.*` (VN-only OK) |
| Manual | Checklist từng slice §1 | Đạt mục "Tiêu chí đánh giá" của slice |
| Ledger | `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Mỗi slice 1 Entry, ghi `Validation` đủ tsc/eslint/build/vitest |

---

## 4. BẰNG CHỨNG BÀN GIAO (EVIDENCE) — PHẢI CÓ ĐỦ MỚI ĐƯỢC MERGE

```
docs/evidence/watchlist-20260912/
├── 1.1-detailpanel-network-3calls.png          # Network whale-analytics + news + whale-feed
├── 1.1-detailpanel-screenshot-real-data.png     # Slide-over với data thật (không mock text)
├── 1.2-destructive-dialogs.mp4                  # 30s video delete watchlist + removeSymbol + PriceAlert inline
├── 1.3-skeleton-vs-banner.png                   # Skeleton 3 rows + error banner
├── 1.4-i18n-scan-0-missing.log                  # npx i18next-scanner --config … | grep watchlist → 0
├── 1.4-en-vs-vn.png                             # EN vs VN header toggle
├── 2.1-sort-filter.mp4                          # Sort Mã, filter HPG, pageSize
├── 2.2-bulk-bar-weightpct.png                   # Bulk bar + Weight% + tracked limit
├── 2.3-lighthouse-a11y-95.png                   # Lighthouse ≥95 + axe 0 critical
├── 2.3-deep-link-HPG.png                        # ?detail=HPG reload mở panel
├── 3.1-build-chunks.log                         # npm run build chunk list (widget-*)
├── 3.1-tickers-50-network.png                   # tickers?symbols=50 (visible subs)
├── 3.2-vitest-verbose.log                       # vitest 8+ files PASS
├── 3.2-playwright-list.log                      # playwright watchlist.spec 4 PASS
├── gates/
│   ├── tsc-noEmit-TSC_EXIT-0.log
│   ├── eslint-watchlist-0.log
│   ├── build-3623-modules.log
│   └── i18n-scan-0-missing.log
└── demo-personas/
    ├── day-trader-50-sort-flash-400ms.mp4
    ├── holder-weight-pnl.mp4
    └── whale-threshold-alert.mp4
```

**Ledger:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 43 (1.1) → Entry 50 (3.2) + Entry 51 (3.3 handover) — mỗi entry ghi `Files touched (≤4)`, `Summary`, `Validation (tsc + eslint scope + build + vitest)`, `Risk: None/Low`.

---

## 5. RỦI RO & GIẢM THIỂU

| Rủi ro | Giảm thiểu |
|--------|-----------|
| BE `whale-feed-aggregate` trống ngoài giờ → DetailPanel empty bị coi là lỗi | Hiển thị empty đúng `"Không có lệnh lớn trong phiên."` + test empty, không crash (1.1) |
| `window.confirm` → Radix Dialog làm vỡ test cũ `watchlist.spec.ts` | Sửa spec sang `data-testid` stable (3.2), không dùng `has-text("Xóa")` fragile |
| Rename CSS → Vite HMR vỡ | Giữ `WatchlistPage.module.css` với `css.modules` mặc định, import `styles` trong 4 components, test build ngay sau rename (2.3) |
| TanStack Table vỡ `priceFlashMap` / sparkline | Giữ `priceFlashMap` trong `cell` via `useWatchlist()` context, không qua TanStack state; sparkline vẫn `priceHistoryRef.current` (2.1) |
| React Query scope `tenant_id` quên → stale cross-tenant như `TenantAdmin` F1 | Copy `useTenantAdminQuery:42` pattern `queryKey [..., tenantId]` + `QueryProvider:17` invalidate `tenant-changed` (1.3) |
| C2 false positive làm dev sửa nhầm BE | Đã ghi hủy C2 trong §0 + 1.2 spec inline dialog dùng `target_price` đúng, không đụng BE |
| W-02 EN vỡ nhưng VN-only ship | Thêm EN stub tối thiểu 3 keys root (`eyebrow/title/description`) để không vỡ khi QA chạy EN locale (1.4) |

---

## 6. ƯỚC LƯỢNG & NHÂN SỰ

| Phase | Effort | Người | Ghi chú |
|-------|--------|-------|---------|
| Phase 0 (0.1) | 0.5 ngày | 1 PO + 1 FE lead | Chốt DoR + key list |
| Phase 1 (1.1 + 1.2 + 1.3 + 1.4) | 4–5 ngày | 1 FE + 1 QA (1.2 dialog) | 1.1 và 1.2 có thể song song 2 người → 3.5 ngày |
| Phase 2 (2.1 + 2.2 + 2.3 + 2.4) | 5–6 ngày | 1 FE + 1 QA a11y | 2.3 Lighthouse cần QA |
| Phase 3 (3.1 + 3.2 + 3.3) | 3–4 ngày | 1 FE + 1 QA E2E | 3.2 vitest + playwright |
| **Tổng** | **13–16 ngày** (2.5–3 tuần) | 1 FE full + 0.5 QA | Không tính BE (không đổi) |

---

## 7. CHECKLIST PHÁT HÀNH

- [ ] Phase 0 DoR 5 quyết định có chữ ký (comment `LGTM` trong PR 0.1)
- [ ] Phase 1 4 slices merge, `w-01/w-03/w-04` 3 P0 đóng, `handleAlert` inline dialog xanh
- [ ] `npx eslint src/pages/watchlist --max-warnings 0` PASS + `npx tsc --noEmit` PASS (log trong evidence/gates)
- [ ] Phase 2 TanStack + bulk + a11y + CSS module merge, Lighthouse ≥95, deep link `?detail=HPG` xanh
- [ ] Phase 3 visible subs + lazy widget + tests xanh, `npm run build` widget chunk tách, `i18n:scan` 0 missing
- [ ] `docs/evidence/watchlist-20260912/` đủ 15 files + `gates/` + `demo-personas/` 3 video
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 43→51 đủ, mỗi entry ghi Validation 3 gates
- [ ] PO demo 3 persona 60s không mock số, mọi destructive có Dialog + Undo/confirm, table 500 rows scroll 60fps (nếu 3.1 xong)

---

## 8. PHỤ LỤC — LỆNH TÁI KIỂM NHANH (copy-paste cho QA)

```bash
# Gates (scope hẹp — gate chính cho watchlist PR)
npx tsc --noEmit; echo "TSC_EXIT:$LASTEXITCODE"
npx eslint src/pages/watchlist --max-warnings 0; echo "ESLINT_EXIT:$LASTEXITCODE"
npm run build 2>&1 | Select-String -Pattern "built in|WatchlistPage|widget-|index-.*\.js"
npm run i18n:scan 2>&1 | Select-String -Pattern "missing|watchlist"

# Tests
npm run test:components 2>&1 | Select-String -Pattern "Test Files|Tests|PASS|FAIL"
npx vitest run src/pages/watchlist --reporter=verbose
npx playwright test tests/visual/watchlist.spec.ts --project=chromium --reporter=list

# Manual
# - Mở http://localhost:8080/watchlist → skeleton → table → switch watchlist → skeleton items
# - Click 📊 → slide-over với whale/news thật (Network 3 calls) → ?detail=HPG deep link → reload vẫn mở → Escape đóng
# - Xóa watchlist → Dialog (không native) → Hủy không xóa → Xóa thì toast → table mất
# - Xóa mã ✕ → Dialog confirm → Hủy không xóa → Xóa thì row mất
# - Click ⚠️ → PriceAlertDialog → target 10000 ABOVE → Submit → banner success → dialog đóng
# - Đổi EN locale → header/sidebar/table EN ngay
# - Sort Mã, filter HPG, pageSize 100, chọn 3 mã → bulk bar → Xóa 3 mã confirm tổng
# - Lighthouse a11y ≥95, mobile touch rowActions luôn hiện
```

**Tham chiếu file:line chốt:** `WatchlistDetailPanel.tsx:78` mock → 1.1, `WatchlistSidebar.tsx:66` confirm → 1.2, `WatchlistTable.tsx:133` remove guard → 1.2, `Table:126` handleAlert rỗng → 1.2 inline, `Context:104-107,221` nuốt lỗi → 1.3 RQ, `Context:256` slice 120 → 3.1 visible 50, `market.js:325,449,375` adapter đã có → 1.1 dùng ngay, `stock_mgmt_native_views.py:4323,4334` + test `:1338` → C2 hủy, `vi.js:3018-3195` ~178 keys → W-02 P1 VN-only, `package.json:64,91` tanstack/react-window → 2.1.

---

*Generated 2026-09-12 — `docs/IMPLEMENTATION_PLAN_WATCHLIST_COMMERCIAL_GRADE_20260912.md` — Audit REV1 + Independent Review REV1 hợp nhất. Bàn giao cho đội code thực hiện không cần hỏi lại khi đã chốt 5 DoR §0.1.*
