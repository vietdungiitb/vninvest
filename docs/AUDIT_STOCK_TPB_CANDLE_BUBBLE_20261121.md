# AUDIT /stocks/:symbol — click nến không đổi bubble chart (TPB)

- **Scope**: trang `/stocks/TPB` (SPA, route `packages/web/src/app/routeCatalog.js:90` `/stocks/:symbol` → `ShellStockDetailPage` → `StockDetailPage`), luồng click nến trên chart chính → bubble chart phiên đó.
- **Date**: 2026-11-21 · **Branch**: `docs/tcbs-close` · **Loại**: audit read-only (không đổi code).
- **Cách kiểm**: `read`/`grep` trực tiếp FE + widget d.ts + BE view; chạy `npx tsc --noEmit` (exit 0), `eslint` 4 file liên quan (0 error, chỉ warning), `vitest` 2 file stock-detail (12/12 pass). Không probe staging có auth (ghi CHƯA XÁC MINH ở mục tương ứng).

## 0. Tóm tắt 5 findings nghiêm trọng nhất

1. **[P0] Bubble chart không nhận `selectedSession`** — `StockDetailPage.tsx:302-306` render `WhaleBubbleChart` chỉ với `selectedSymbol/env/isEmbedded`, không truyền session/trade_date; `WhaleBubbleChart.jsx:663-686` fetch chỉ theo `[symbol, timeframe]`. Click nến có set state cũng không bao giờ đổi bubble. Đây là root cause của bug user báo.
2. **[P0] BE đã hỗ trợ `trade_date` nhưng FE bỏ không dùng** — `market.js:386-400` (`tradeDate` → `?trade_date=`) và BE `portfolio_analytics_views.py:2704-2710,2790-2807` đã nhận `trade_date`; `WhaleBubbleChart` không truyền, `useStockDetailPageModel.js:126-130` cũng không truyền cho snapshot blocking lane.
3. **[P1] `handleClick` phụ thuộc widget `onClick(currentItem.date)` nhưng chưa từng được verify runtime** — `VNStockChartPanel.js:353-364` + `VNInvestChartsProps.d.ts:142-147` (`onClick?: (moreProps: {currentItem?: EnrichedDatum...})`), `EnrichedDatum extends RawOHLCV {date: Date}` (`types.d.ts:1-6,210`). Không có test/repro nào chứng minh click nến bắn đúng `currentItem.date`; nếu widget nuốt click (drawing/crosshair) thì cả banner session cũng không hiện.
4. **[P1] Lệch lane dữ liệu: deferred lane lọc theo session nhưng blocking lane không** — `useStockDetailPageModel.js:172-218` (whaleFeed/advisory lọc `session_date`) vs `loadBlocking` `useStockDetailPageModel.js:116-168` deps `[env, symbol, activeTimeframe]` (không có `selectedSession`). OrderFlow/bubble snapshot luôn của phiên mới nhất.
5. **[P2] UX hứa nhưng không có affordance/feedback cho historical session** — hint `vi/stockDetail.js:315` hứa "nhấp vào một cây nến…", nhưng nến không có cursor/hover gợi click; bubble của phiên cũ có thể rỗng (không còn intraday ticks) mà empty-state `WhaleBubbleChart.jsx:1481-1492` chỉ nói chung "Không có dữ liệu / thử khoảng thời gian khác", không nêu ngày đang xem.

## A. Bản đồ kiến trúc (file | trách nhiệm)

| File | Trách nhiệm | Note |
|---|---|---|
| `packages/web/src/app/routeCatalog.js:90` | route `/stocks/:symbol` | entry |
| `packages/web/src/pages/market/ShellStockDetailPage.js:20-37` | parse symbol từ URL, sync location | không giữ session state |
| `packages/web/src/pages/StockDetailPage.tsx:53-133` | orchestrate page model + layout | `selectedSession/setSelectedSession` từ model (`:108-109`); `handleSessionChange → setSelectedSession` (`:135-137`) |
| `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js:59-64` | SSOT `symbol/activeTimeframe/activePeriod/selectedSession/visibleRange` + 2 lane | blocking `:116-168`, deferred `:172-218`, pagination `:221-244`, realtime `:328-364` |
| `packages/web/src/components/VNStockChartPanel.js:37-62,353-369,415-502` | wraptime widget `@vninvestcharts/widget@0.4.4`, map timeframe, forward `onClick → onSessionChange`, `onBarsChange`, `onVisibleRangeChange` | `handleClick` build `{tradeDate: YYYY-MM-DD, timestamp}` từ `currentItem.date` |
| `packages/web/src/components/WhaleBubbleChart.jsx:562-601,663-692` | bubble intraday (echarts scatter) + flow pane | 2 mode `isControlled/external*` vs internal; trang này dùng internal → tự fetch `getWhaleAnalyticsSnapshot({timeframe, compact:1})` không `tradeDate` |
| `packages/web/src/adapters/core/market.js:386-400` | `getWhaleAnalyticsSnapshot(symbol,{timeframe,compact,tradeDate})` → `?trade_date=` | FE đã có tham số nhưng caller không dùng |
| `packages/web/src/hooks/useWhaleAnalyticsData.js:30,100-104` | hook đã biết `tradeDate` → snapshot | `WhaleBubbleChart` không dùng hook này |
| `packages/core/backend/src/user_workspace/portfolio_analytics_views.py:2681-2809` | `GET /core/v1/workspace/whale-analytics/{symbol}/?timeframe=&trade_date=` | `resolved_trade_date = requested or facts.session_date or latest_whale or today` (`:2807`) |
| `packages/web/src/features/stock-detail/components/StockSessionWitness.js:6-63` | banner "phiên đang chọn / hôm nay" + nút clear | hiển thị đúng nếu `selectedSession` set |
| `packages/web/src/features/stock-detail/components/StockDetailTabs.js:83-87,178-188` | tab Giao dịch: sessionLabel + `StockContextDeck` (whaleFeed đã lọc session) | whaleFeed lọc đúng (`useStockDetailPageModel.js:181-186`) |
| `packages/web/src/i18n/locales/vi/stockDetail.js:311-315` | copy hứa click nến | bằng chứng spec |
| `packages/web/node_modules/@vninvestcharts/widget/dist/dts/widget/VNInvestChartsProps.d.ts:142-147` | hợp đồng `onClick` | `currentItem?: EnrichedDatum`; `EnrichedDatum extends RawOHLCV {date: Date}` |

## B. Luồng dữ liệu đã trace (use-case: click 1 nến TPB)

1. User click nến → widget (nếu bắn) gọi `onClick(moreProps)` (`VNInvestChartsProps.d.ts:142-147`).
2. `VNStockChartPanel.js:353-364` đọc `moreProps.currentItem.date` → `YYYY-MM-DD` local → `onSessionChange({tradeDate, timestamp})`.
3. `StockDetailPage.tsx:135-137` → `setSelectedSession` (model `useStockDetailPageModel.js:63`).
4. `selectedSession` lan tới: `StockSessionWitness.js:14-22` (banner đổi) ✓; `useStockDetailPageModel.js:181-186,225-227` (deferred lane refetch `getWhaleFeedAggregate` + `getAdvisoryLatest` với `session_date`) ✓; `StockDetailTabs.js:84-86` (label phiên) ✓.
5. **Đứt tại bước 5**: `StockDetailPage.tsx:302-306` không truyền `selectedSession` cho `WhaleBubbleChart`; component này fetch độc lập (`WhaleBubbleChart.jsx:686-692` deps `[fetchOrders, isControlled]`, `fetchOrders` deps `[symbol, timeframe]` `:686`) → luôn phiên mới nhất. **Bubble không đổi.**
6. Nếu sửa wiring, BE đã sẵn: `market.js:393-395` gắn `?trade_date=`; BE resolve fallback (`portfolio_analytics_views.py:2807-2809`).

## C. CONTRADICTIONS (plan/doc vs code)

| # | Doc/spec | Code thực tế | Tác động |
|---|---|---|---|
| C1 | `vi/stockDetail.js:315` "Nhấp vào một cây nến… để xem dòng tiền… cho phiên đó" | `StockDetailPage.tsx:302-306` không truyền session cho bubble; `WhaleBubbleChart.jsx:670-674` không gửi `trade_date` | Hứa mà không làm = bug user báo |
| C2 | Tên yêu cầu "bubble chart của phiên đó sẽ hiển thị" | `useStockDetailPageModel.js:126-130` blocking lane (orderFlow/whale snapshot) không deps `selectedSession` | Ngay cả khi bubble được nối, snapshot nền vẫn lệch phiên |
| C3 | `WhaleBubbleChart` có mode `isControlled/external*` (`WhaleBubbleChart.jsx:570-578`) ngụ ý parent điều khiển được | Trang dùng `isEmbedded:false` không controlled, không có prop session nào (`StockDetailPage.tsx:302-306`) | API controlled tồn tại nhưng không được dùng đúng chỗ |

## D. Findings chi tiết

- **[F-01 | ERROR | P0] `StockDetailPage` không truyền session cho bubble** — `StockDetailPage.tsx:299-307`: `e(WhaleBubbleChart, {selectedSymbol: symbol, env, isEmbedded: false})`. `selectedSession` có trong scope (`:108-109`) nhưng không forward. **Tác động**: click nến chỉ đổi banner + whale feed list, bubble đứng yên. **Fix**: thêm prop (vd `tradeDate={selectedSession?.tradeDate}` hoặc `sessionDate`), `WhaleBubbleChart` đưa vào deps fetch + `getWhaleAnalyticsSnapshot(symbol,{timeframe, tradeDate})`. Ưu tiên cao nhất.
- **[F-02 | GAP | P0] `WhaleBubbleChart.fetchOrders` bỏ qua `trade_date` dù adapter/BE hỗ trợ** — `WhaleBubbleChart.jsx:663-686` vs `market.js:386-400` vs BE `portfolio_analytics_views.py:2704-2710`. `useWhaleAnalyticsData.js:100-104` đã làm đúng mẫu. **Tác động**: kể cả F-01 được nối, nếu chỉ set state mà không sửa fetch thì vẫn không đổi. **Fix**: cùng PR với F-01; thêm `tradeDate` vào deps, reset data khi đổi ngày (tránh flash ngày cũ như pattern `VNStockChartPanel.js:305-310`).
- **[F-03 | RISK | P1] `handleClick` chưa verify runtime (L-V02)** — `VNStockChartPanel.js:353-364` giả định `moreProps.currentItem.date` luôn có và là `Date`. Hợp đồng d.ts đúng (`EnrichedDatum.date: Date`), nhưng chưa có test/repro nào chứng minh widget 0.4.4 bắn `onClick` khi click nến (có thể bị drawing-tool/crosshair nuốt, hoặc `currentItem` undefined khi click vùng trống → `dateStr` thành `NaN-NaN-NaN`). **Tác động**: nếu widget không bắn, cả banner cũng không hiện — cần phân biệt "click không bắn" vs "bắn nhưng bubble không nghe". **Fix**: repro-first trên staging (click 1 nến TPB, log `moreProps`), guard `if (!item?.date || isNaN(...)) return`, thêm test `onClick → onSessionChange` với mock widget.
- **[F-04 | GAP | P1] Blocking lane không theo session** — `useStockDetailPageModel.js:157-168` deps `[env, symbol, activeTimeframe, loadBlocking]`; `loadBlocking` fetch `getStockOrderFlow/getSessionFactsCvd/getWhaleAnalyticsSnapshot` với `DEFAULT_ORDER_FLOW_WINDOW` cố định, không `session_date/trade_date`. Deferred lane thì có (`:181-186`). **Tác động**: `orderFlowData` cho widget (`VNStockChartPanel.js:290,341-344`) và context deck lệch phiên so với whale feed. **Fix**: hoặc đưa `selectedSession` vào blocking lane (cân nhắc tần suất fetch), hoặc tách lane thứ 3 cho session-scoped snapshot; tối thiểu document rõ lane nào theo session.
- **[F-05 | RISK | P1] Chuyển đổi ngày local có thể lệch phiên** — `VNStockChartPanel.js:356-358` dùng `getFullYear/getMonth/getDate` (local) trên `item.date`. Nếu `item.date` là UTC midnight của phiên VN thì có thể lệch ±1 ngày so với `trade_date` BE mong đợi (BE parse `YYYY-MM-DD`, `portfolio_analytics_views.py:2790`). Không có test biên timezone. **Fix**: format theo `Asia/Ho_Chi_Minh` (Intl hoặc helper dùng chung), thêm test biên (nến lúc 00:00Z).
- **[F-06 | GAP | P2] Timeframe 2 chart độc lập, ngữ nghĩa click mơ hồ** — chart chính `activeTimeframe` (`1D` mặc định, `useStockDetailPageModel.js:61`) vs bubble `timeframe` nội bộ (`session` mặc định, `WhaleBubbleChart.jsx:588`). Click nến daily → bubble intraday ngày đó là hợp lý, nhưng click khi chart đang ở `1H/15m` thì "phiên đó" nghĩa là gì chưa định nghĩa; `StockDetailPage` cũng không đồng bộ timeframe. **Fix**: spec rõ: click luôn resolve về `trade_date` (ngày), bubble luôn fetch `timeframe=session` (hoặc giữ timeframe bubble hiện tại + `trade_date`); hiển thị ngày đang xem trong header bubble.
- **[F-07 | UX/DATA | P2] Không affordance + empty-state không nêu ngày** — không có `cursor-pointer`/tooltip "click để xem phiên"; empty `WhaleBubbleChart.jsx:1481-1492` không in `tradeDate` đang xem; phiên cũ có thể không còn intraday ticks (BE fallback `resolved_trade_date`, degraded copy `:175-189`) → user tưởng "click hỏng". **Fix**: cursor + title trên pane nến (nếu widget cho), header bubble in `Phiên DD/MM/YYYY + nút quay về hôm nay`, empty-state nêu ngày + lý do (hết lưu intraday vs chưa phát sinh).
- **[F-08 | MAINT | P3] Dead code + warning nhiễu quanh luồng này** — `VNStockChartPanel.js:323` `whaleTimes` tính nhưng không dùng (eslint warning), `enableCVD/enableInstitutionalStrength`/`VNInvestMultiCharts` unused; `WhaleBubbleChart.jsx` nhiều unused (`series`, `flowSellStrengthSeries`, `priceContextSeries`, icon…). Không gây bug nhưng làm audit khó. **Fix**: dọn khi chạm file (PR riêng, không lẫn fix P0).
- **[F-09 | ARCH | P2] Session không vào URL → F5 mất, khó share/debug** — `selectedSession/visibleRange` chỉ `useState` (`useStockDetailPageModel.js:63-64`), `ShellStockDetailPage.js:20-37` chỉ sync symbol. Không blocker cho bug này; nếu sau này đưa lên URL thì nhớ L-F09 (không gọi 2 `setSearchParams` trong 1 tick).

## E. Quality gates audit

- **Type-check**: `npx tsc --noEmit` trong `packages/web` → **exit 0**.
- **Lint**: `npx eslint` 4 file luồng (`StockDetailPage.tsx`, `VNStockChartPanel.js`, `WhaleBubbleChart.jsx`, `useStockDetailPageModel.js`) → **0 error**, warning hiện có (unused vars/props, `jsx-no-literals` ở bubble). Không có lint gate chặn P0.
- **i18n**: `npm run i18n:scan` → **exit 0**; copy hứa click đã có cả `vi` + `en` (`vi/stockDetail.js:315`, `en/stockDetail.js:315`). Không thiếu key cho luồng này.
- **Test**: `npx vitest run` 2 file stock-detail (`useStockDetailPageModel.component.test.js`, `StockDetailPage.component.test.tsx`) → **12/12 pass**. Test hiện có đã cover deferred lane lọc `session_date` (`useStockDetailPageModel.component.test.js:184-201`) và mock `WhaleBubbleChart` (`StockDetailPage.component.test.tsx:35-36`), nhưng **không có test nào assert bubble nhận session** — chính là lỗ hổng cho phép F-01 lọt.
- **BE contract**: `portfolio_analytics_views.py:2681-2809` + `market.js:386-400` khớp `trade_date`; **CHƯA CHẠY** probe staging có auth cho TPB ngày cụ thể.

## F. Câu hỏi cần làm rõ (cho owner/dev)

1. Kỳ vọng đúng khi click nến là gì: bubble luôn về `session` intraday của ngày đó, hay giữ timeframe bubble hiện tại? Có cần đổi tab/bubble timeframe đồng bộ không?
2. Dữ liệu intraday lịch sử giữ bao lâu (bao nhiêu ngày có bubble)? Để viết empty-state trung thực cho phiên quá cũ.
3. Widget 0.4.4 `onClick` có còn bắn khi bật drawing tools không? Cần 1 repro trên staging (log `moreProps`) trước khi chốt fix là "chỉ thiếu wiring" hay "cả sự kiện click cũng hỏng".
4. Có muốn session lên URL (`?session=YYYY-MM-DD`) để share/F5 giữ không, hay giữ state nội bộ?

## G. Đánh giá tổng thể + đề xuất fix

- **Implementable? Có. Blocker? Không (không cần migration/secret).** Bug là thiếu wiring FE + thiếu param khi fetch, BE đã sẵn.
- **Ưu tiên**: P0 = F-01 + F-02 (1 PR: forward `selectedSession.tradeDate` → bubble → `trade_date`, reset + loading + header ngày + empty-state nêu ngày). P1 = F-03 repro log + guard + test click; F-04 quyết định lane session cho `orderFlowData`; F-05 format ngày theo `Asia/Ho_Chi_Minh` + test biên. P2 = F-06 spec timeframe + F-07 affordance. P3 = F-08 dọn dead code.
- **Test cần thêm**: (1) `StockDetailPage` render bubble với `tradeDate` từ `selectedSession`; (2) `WhaleBubbleChart` refetch khi `tradeDate` đổi (assert query có `trade_date=`); (3) `VNStockChartPanel.handleClick` map `currentItem.date` → `YYYY-MM-DD` đúng timezone + bỏ qua khi date invalid; (4) BE contract `trade_date` cho TPB 1 ngày quá khứ (staging có auth).
- **Next / owner**: FE owner nhận F-01+F-02; cần 1 buổi repro staging cho F-03 trước khi merge (tránh fix wiring nhưng click gốc không bắn). Sau merge: kiểm thủ công `/stocks/TPB` — click 3 nến (gần nhất / giữa / xa) → banner + bubble + whale feed cùng ngày; F5 giữ hay mất theo quyết định mục F.

---
- **Lessons áp dụng**: L-V02 (mọi root cause kế thừa phải có phản chứng — F-03 ghi CHƯA XÁC MINH thay vì đoán widget bắn click), L-V04 (test xanh giả — test hiện có mock bubble nên không bắt được F-01, cần assert giá trị thật đi tới fetch), L-F12 (đổi version widget phải verify props/CSS/pane — đã đối chiếu `VNInvestChartsProps.d.ts` 0.4.4 thay vì đoán shape).
- **Files read**: `routeCatalog.js:90`, `ShellStockDetailPage.js`, `StockDetailPage.tsx`, `useStockDetailPageModel.js`, `VNStockChartPanel.js`, `WhaleBubbleChart.jsx`, `StockDetailTabs.js`, `StockSessionWitness.js`, `market.js:272-400`, `coreAdapter.js:124-193`, `useWhaleAnalyticsData.js`, `vi/en stockDetail.js:311-315`, `package.json:73-108`, widget `VNInvestChartsProps.d.ts:142-173` + `calculators/types.d.ts:1-6,210`, BE `portfolio_analytics_views.py:2681-2809`.
