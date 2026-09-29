# Báo Cáo Nghiên Cứu & Phân Tích — Stock Detail Page (`/stocks/TPB`) Audit FE↔BE + Roadmap Đẳng Cấp Quốc Tế

**Ngày:** 2026-08-06
**Phạm vi:** `packages/web/src/pages/StockDetailPage.tsx` + `features/stock-detail/*` + `components/VNStockChartPanel.js` + `adapters/*` ↔ `packages/core/backend/src/{market_data/stock_mgmt_native_views.py, market_serving/, signal_intelligence/, advisory/, user_workspace/portfolio_analytics_views.py}`
**Loại:** AUDIT (research only — không sửa code)

---

## Tóm tắt 5 findings nghiêm trọng nhất

1. **[F-01 P0]** AI Advisory card CHẾT: serializer chỉ expose `advisory_text` nhưng FE render `signal/summary/rationale/confidence_score` (không tồn tại) + model hook cố định `advisory: null` khi mount → người dùng không bao giờ thấy nội dung khuyến nghị AI.
2. **[F-02 P0]** Session-date filter silent-fail: FE gửi `session_date` tới `/realtime/whale-feed-aggregate/` nhưng backend không đọc param → click nến ngày X hiển thị dữ liệu whale của session mới nhất (dữ liệu sai theo phiên đã chọn).
3. **[F-03 P0]** Order book là MOCK: `/realtime/depth-chart/` sinh bids/asks giả bằng MD5-seeded pseudo-random → widget "Độ sâu thị trường" hiển thị sổ lệnh giả như thật.
4. **[F-04 P0]** Whale feed item fields sai contract: FE đọc `event_time/triggered_at` + `price/avg_price` nhưng backend trả `ts/alert_at` + `matched_value` → danh sách khớp lệnh cá mập hiện "— — CP —", whale markers trên chart plot tại giá 0.
5. **[F-06 P1]** WhaleBubbleChart summary mismatch: FE đọc `summary.total_orders/buy_orders/sell_orders` nhưng backend trả `whale_order_count/extreme_order_count` → thống kê luôn 0.

---

## A. Bản đồ kiến trúc

| File | Line | Trách nhiệm | Note |
|------|------|-------------|------|
| `packages/web/src/pages/StockDetailPage.tsx` | 383 | Page shell — layout, watchlist sync, toast, workstation v2 | Lazy-load qua `pageRegistry.js:231`, route `main.tsx:101` |
| `features/stock-detail/hooks/useStockDetailPageModel.js` | 444 | SSOT model hook — blocking/deferred/lazy lanes, realtime batching 250ms | Là nguồn gốc F-01, F-02 |
| `features/stock-detail/components/StockDetailHeader.js` | 176 | Header 3-row: badge + price + iBoard strip | Đã i18n ✓ |
| `features/stock-detail/components/StockDetailTabs.js` | 583 | 8-tab panel dispatcher | F-01 (advisory card), F-11 (hardcoded) |
| `features/stock-detail/components/StockContextDeck.js` | 278 | 3-card grid: Whale + Depth + Strength | F-04 (whale item fields) |
| `features/stock-detail/components/StockSessionWitness.js` | 64 | Session filter strip | UX chỉ hiển thị — data không lọc (F-02) |
| `components/VNStockChartPanel.js` | 281 | Widget bridge — lazy-load `vninvestcharts-widget` | F-07 (darkFlowStrength), F-08 (whale price) |
| `components/WhaleBubbleChart.jsx` | 1734 | Whale analytics bubble chart | F-06 (summary fields) |
| `components/workstation/hooks/useOrderBook.js` | 80 | Poll depth-chart 5s | Tiêu thụ MOCK (F-03) |
| `components/workstation/hooks/useTradeLog.js` | — | Poll intraday 5s | Nguồn thật (IntradayTick) ✓ |
| `adapters/core/market.js` | 560 | Market API client | F-05 (duplicate method), F-10 (`?date=`) |
| `adapters/chartAdapter.js` | 197 | Core API → chart bar format | Contract OK |
| `features/stock-detail/orderFlowFallback.js` | 84 | Merge order-flow + CVD + whale snapshot | OK |
| `pages/StockDetailPage.css` | 2486 | Glassmorphism design system | Có mobile breakpoints + prefers-reduced-motion ✓ |
| `backend market_data/stock_mgmt_native_views.py` | 4469 | Overview/chart/dark-money/order-flow/news/financials/ai-advisory | F-03 liên quan depth-chart (file khác) |
| `backend market_serving/native_views.py` | 419 | Intraday (thật) + depth-chart (MOCK) | F-03 |
| `backend market_serving/legacy_views.py` | 1297 | Whale feed aggregate | F-02 (bỏ qua session_date), F-04 (item shape) |
| `backend advisory/serializers.py` | 141 | AdvisoryRecordSerializer | F-01 |
| `backend user_workspace/portfolio_analytics_views.py` | 908+ | Whale analytics snapshot | F-06 |

## B. Luồng dữ liệu đã trace (use-case: mở `/stocks/TPB`)

1. `main.tsx:101` route → `pageRegistry.js:231` lazy-load `StockDetailPage` → `useParams` lấy symbol (`StockDetailPage.tsx:44-46`).
2. `useStockDetailPageModel` mount: blocking lane `loadBlocking` (`useStockDetailPageModel.js:105-144`) → `Promise.allSettled` 4 endpoints:
   - `getStockOverview` → `/stock-management/stocks/TPB/overview/` (stock_mgmt_native_views.py:1647) → snapshot (header + depth cards) ✓
   - `getStockOrderFlow(window=1h)` → `/order-flow/` (2043) → radar contract ✓
   - `getSessionFactsCvd(window=1h)` → `/session-facts/TPB/cvd` (market_serving/views.py:342) — 404 → null được catch (market.js:303-306) ✓
   - `getWhaleAnalyticsSnapshot(timeframe=1h, compact=0, includeBaseline=false)` → `/workspace/whale-analytics/TPB/` (portfolio_analytics_views.py:908) — param `compact`/`include_baseline` backend bỏ qua (dead params, ít tác hại)
   → `buildEffectiveOrderFlowData` merge (orderFlowFallback.js:42-82) → chart + ContextDeck.
3. Deferred lane (`useStockDetailPageModel.js:161-194`): chỉ fetch whale feed → `getWhaleFeedAggregate(TPB, {session_date})` → **`advisory: null` cố định** (F-01) + **session_date bị bỏ qua** (F-02).
4. Widget chart: `chartAdapter.fetchBarsInRange` → `getStockChartHistory(timeframe, days)` → `/chart/` (1758) → `points` ✓; realtime quote poll 5s qua `useRealtimeFeedFromManager` → `pushRealtimeBar` (VNStockChartPanel.js:101-106).
5. Tabs lazy lane (`useStockDetailPageModel.js:204-276`): profile (tab ho-so), news (tin-tuc), financials (tai-chinh/thong-ke/von-co-tuc) — fetch đúng endpoint, shape đúng.
6. Workstation v2 (nếu enabled): `useOrderBook` poll `/realtime/depth-chart/` **MOCK** (F-03) + `useTradeLog` poll `/realtime/intraday/` thật ✓.
7. Click "Làm mới" advisory: `refreshAdvisoryData` → POST `/advisory/refresh/` (legacy, advisory/views.py:150) → Celery `generate_advisory_task` → poll GET `/advisory/latest/` mỗi 2s × 15 (tối đa 30s) → **kể cả thành công, card chỉ hiện badge "—"** (F-01).

## C. CONTRADICTIONS (audit cũ vs code hiện tại)

| Audit cũ (STOCK_DETAIL_PAGE_AUDIT_20260717.md) | Thực tế code hiện tại | Trạng thái |
|---|---|---|
| F-06: watchlist button dummy, không gọi API | `StockDetailPage.tsx:165-180` gọi `addWatchlistItem`/`removeWatchlistItem` | ĐÃ SỬA |
| F-07: 100% hardcoded VN, không dùng useI18n | 91 keys i18n có trong vi.js+en.js; còn ~10 chuỗi hardcoded (F-11 mới) | SỬA MỘT PHẦN |
| F-09: `isWatched` không persist khi navigate | `StockDetailPage.tsx:128-159` load watchlists + check membership | ĐÃ SỬA |
| F-11: `onSymbolChange` dùng `window.location.href` | `VNStockChartPanel.js:269-271` dùng `navigate` | ĐÃ SỬA |
| F-12: không mobile responsive | CSS có media queries 768px/480px + `prefers-reduced-motion` (StockDetailPage.css:429,2779,2837,2491) | ĐÃ SỬA |
| F-17: chart adapter subscribe là stubs | `chartAdapter.js:114-176` implement polling trades/orderbook | ĐÃ SỬA |
| F-20/21: locale `'vi'`, theme `'dark'` hardcode | `VNStockChartPanel.js:253` locale từ context, :46-48 theme từ data-theme | ĐÃ SỬA |
| F-10: tabs không lazy-load | `StockDetailTabs.js` vẫn 8 renderers trong 1 bundle | CÒN MỞ |
| F-14: fmtPrice/fmtCompact duplicate | Header/Tabs/ContextDeck vẫn duplicate | CÒN MỞ |
| F-15: `createElement` alias `e` trade-off | Giữ nguyên (chủ đích) | CÒN MỞ |

## D. Findings

**[F-01] ERROR | P0 | AI Advisory card chết — serializer thiếu field + model hook không load**
- `advisory/serializers.py:46-61`: AdvisoryRecordSerializer chỉ expose `advisory_id, symbol, session_date, status, ai_model, advisory_text, tokens_used, error_message, generated_at, created_at`.
- `StockDetailTabs.js:138-156`: render `advisory.signal` (badge), `advisory.confidence_score`, `advisory.summary`, `advisory.rationale` — tất cả undefined.
- `useStockDetailPageModel.js:178-183`: deferred lane set `advisory: null` cố định, không bao giờ gọi `getAdvisoryLatest` khi mount (chỉ `refreshAdvisoryData` sau khi user bấm nút).
- Nội dung AI thực nằm trong `advisory_text` (advisory/tasks.py:58) — KHÔNG BAO GIỜ được render.
- **Tác động:** Tính năng AI Advisory (điểm bán chính) hiển thị trống "🧠 Chưa có phân tích" hoặc badge "—" với mọi user. | **Đề xuất:** (1) deferred lane gọi `getAdvisoryLatest(symbol)` khi mount (fallback null); (2) render `advisory_text` (Markdown); (3) bổ sung `signal`/`confidence_score` vào serializer (derive từ advisory_text hoặc cột mới).

**[F-02] ERROR | P0 | Session-date filter silent-fail trên whale feed**
- FE: `useStockDetailPageModel.js:174` → `getWhaleFeedAggregate(symbol, { session_date })` → `/realtime/whale-feed-aggregate/` (market.js:394-400).
- BE: `legacy_views.py:535-639` chỉ đọc `scope/symbols/watchlist_group_ids/sort/window/limit/cursor`; `window='session'` = `Max('session_date')` (legacy_views.py:620-623). `session_date` param không tồn tại.
- **Tác động:** User click nến ngày X (`StockDetailPage.tsx:187-198`) → witness strip hiện "Phiên X" nhưng khớp lệnh cá mập vẫn của session mới nhất — sai dữ liệu, mất niềm tin. | **Đề xuất:** thêm param `session_date` vào `RealtimeWhaleFeedAggregateView` (filter `executed_at__date`/`session_date`) hoặc FE dùng `/core/v1/whale-feed` (signal_intelligence/views.py:663 đọc session_date nhưng route thiếu prefix `signals/` — cần fix route).

**[F-03] ERROR | P0 | Order book là dữ liệu MOCK**
- `native_views.py:319-407`: `RealtimeDepthChartView` tạo 3 bids/3 asks giả bằng `hashlib.md5(symbol+date)` seed (dòng 364-372), volume phân phối 40/30/20% từ `snapshot.volume`.
- `useOrderBook.js:26-30` poll endpoint này 5s → `StockOrderBookWidget` hiển thị như dữ liệu thật.
- **Tác động:** Nhà đầu tư giao dịch dựa trên sổ lệnh giả — rủi ro pháp lý + uy tín; vi phạm "truthful state" mà StockContextDeck đang cố gắng giữ. | **Đề xuất:** (1) nguồn thật: vnbroker/SSI board depth hoặc `OrderBookSnapshot` mới; (2) tạm thời: gắn nhãn rõ "Dữ liệu ước tính" + `is_mock: true` trong payload; (3) tính depth gần đúng từ `IntradayTick` + snapshot nhưng phải công khai.

**[F-04] ERROR | P0 | Whale feed item fields sai contract**
- FE `StockContextDeck.js:83-96`: đọc `ev.event_time ?? ev.triggered_at`, `ev.price ?? ev.avg_price`, `ev.volume ?? ev.net_volume`.
- BE item `legacy_views.py:707-751`: `id, event_id, symbol, side, matched_value, volume, threshold, size_class, ts, alert_at, alert_age_seconds, ...` — không có `event_time`, `price`, `net_volume`.
- Hệ quả dây chuyền: `VNStockChartPanel.js:128-136` `mappedWhaleOrders` đọc `s.price ?? s.close` (không có) → whale orders plot tại giá 0; time hiện "—".
- **Tác động:** Card "Khớp lệnh trong ngày" hiện dòng rỗng "— — CP —"; overlay cá mập trên chart sai vị trí giá. | **Đề xuất:** FE map `ts/alert_at` → time, `matched_value` → price (hoặc `value` nếu có); thêm normalized adapter ở `orderFlowFallback.js` để đổi shape một nơi.

**[F-05] GAP | P1 | Duplicate `getWhaleFeedAggregate` trong market.js**
- `market.js:180-190` (gọi `/whale-feed-aggregate/` — thiếu `/realtime/` prefix, sẽ 404 nếu gọi) và `market.js:394-400` (gọi `/realtime/whale-feed-aggregate/` đúng) — method sau shadow method trước.
- **Tác động:** Dead code + trap cho developer mới. | **Đề xuất:** xoá method :180-190, giữ method đúng; thêm test path coverage.

**[F-06] GAP | P1 | WhaleBubbleChart summary mismatch**
- FE `WhaleBubbleChart.jsx:1771-1810`: `summary.total_orders / buy_orders / sell_orders / internal_orders`.
- BE `portfolio_analytics_views.py:1241-1246`: `summary = {whale_order_count, extreme_order_count}`.
- **Tác động:** Stats block hiển thị 0/0/0 (100% mọi phiên). | **Đề xuất:** FE dùng `whale_order_count` + tính buy/sell từ `bubble_series` side count, hoặc BE bổ sung field.

**[F-07] GAP | P1 | Dark flow strength không tới chart**
- BE order-flow trả `dark_flow: {signal_type, strength, confidence, direction, components}` (stock_mgmt_native_views.py:2112-2125).
- FE chart đọc `orderFlowData?.darkFlowStrength` (flat, `VNStockChartPanel.js:260`) → luôn null.
- **Tác động:** Overlay dark flow trên chart không bao giờ hiển thị. | **Đề xuất:** FE đọc `orderFlowData?.dark_flow?.strength` hoặc map trong `buildEffectiveOrderFlowData`.

**[F-08] GAP | P1 | Pagination whale feed bị bỏ**
- `useStockDetailPageModel.js:182`: chỉ lấy `whaleFeedRes?.results ?? []` — bỏ `next_cursor`/`has_more` (legacy_views.py:794-846).
- **Tác động:** Chỉ 20 item đầu (limit mặc định legacy_views.py:351-358), không có "xem thêm". | **Đề xuất:** nâng limit + expose next_cursor hoặc nút Load more.

**[F-09] GAP | P1 | Advisory refresh poll 30s không có phản hồi tiến trình**
- `useStockDetailPageModel.js:343-397`: poll 2s × 15 lần; quá thời gian → timeout với advisory null, không thông báo rõ.
- **Tác động:** User bấm "Làm mới" thấy spinner 30s rồi trắng — UX tệ khi Celery chậm. | **Đề xuất:** trả `task_id` (backend đã có: advisory/views.py:461) + poll task-status endpoint; hoặc WebSocket/SSE push khi xong.

**[F-10] RISK | P2 | `getSessionFacts` param `?date=` vs backend `trade_date`**
- `market.js:39` gửi `?date=` nhưng `market_serving/views.py:35-52` đọc `trade_date` — param bị bỏ qua (hiện chưa caller, latent). | **Đề xuất:** đổi sang `trade_date` hoặc hỗ trợ alias `date` phía backend.

**[F-11] GAP | P2 | Hardcoded VN strings còn lại**
- `StockDetailPage.tsx:167,178,200,254,306`; `StockDetailTabs.js:56,82,113,124,149-150,155`; `StockContextDeck.js:56,117,205` ("CVD & Dark Flow", "Order Book", "Institutional / Retail", "Thử lại", "Hôm nay"...). | **Đề xuất:** đưa vào `stockDetail.page.*`.

**[F-12] GAP | P2 | Dead prop `flowData` + whaleSignals thiếu matched_value**
- `StockDetailPage.tsx:277` truyền cả `flowData` lẫn `orderFlowData`; `VNStockChartPanel.js` chỉ dùng `orderFlowData` (`:136,139,260`), `flowData` dead. | **Đề xuất:** xoá prop thừa; map whale `matched_value` → `price` cho markers.

**[F-13] GAP | P2 | Không có test cho page/model hook**
- Chỉ có `__tests__/orderFlowFallback.test.js` + `viewportWhaleMarkers.test.js`; không có `StockDetailPage.component.test` / `useStockDetailPageModel.test`. | **Đề xuất:** viết component test cho header (price color classes), tabs (advisory empty state), model hook (lanes, 404 handling) — theo pattern `*.component.test.js` vitest.

**[F-14] GAP | P2 | fmtPrice/fmtCompact duplicate 3 files** (Header/Tabs/ContextDeck) | **Đề xuất:** extract `utils/format.js`.

**[F-15] GAP | P2 | Adapter tạo lại nhiều lần** — `StockDetailPage.tsx:130,172` + `useStockDetailPageModel.js:108,169,206,318` mỗi nơi `createCoreApiAdapter` mới | **Đề xuất:** singleton adapter (module-level) + `useMemo`.

## E. Quality gates audit

- **i18n**: 91/91 keys `stockDetail.page.*` tồn tại trong cả vi.js và en.js ✓; còn ~15 chuỗi hardcoded (F-11).
- **Test**: vitest pattern `*.component.test.*` — không cover StockDetailPage (F-13); jest suites còn lại không cover backend stock-mgmt views mới (chỉ `test_stock_management_native_api.py` tồn tại).
- **Type-check/build**: pre-existing green (ledger Entry 35 — tsc PASS, build PASS); không có thay đổi code trong audit này.
- **Lint**: không có thay đổi code trong audit này.

## F. Câu hỏi cần làm rõ

1. Nguồn dữ liệu order book thật: SSI iBoard API / vnbroker có cung cấp depth thật không? (quyết định F-03)
2. `AdvisoryRecord.advisory_text` định dạng gì (plain text / Markdown)? → quyết định render (F-01).
3. `WhaleAlertCanonical` có cột `session_date` để filter theo phiên không? (F-02 — model hiện dùng `executed_at` + `session_date` theo legacy_views.py:620-627)
4. Ai chịu trách nhiệm chuẩn hóa whale item shape: FE adapter hay BE serializer? (F-04, F-06)

## G. Đánh giá tổng thể

Trang có skeleton tốt (i18n 91 keys, mobile CSS, realtime batching, error boundary, session filter UX) — nhưng **4 lỗi P0 về contract/data (F-01→F-04) khiến các tính năng khác biệt nhất (AI Advisory, session analysis, order book, whale feed) đang hiển thị sai hoặc trống**. Đây là các gap FE↔BE chưa từng được audit cũ (2026-07-17) phát hiện vì audit đó chỉ đọc FE. **Ưu tiên: Phase 1 fix contract trước (P0), sau đó Phase 2 UX quốc tế, Phase 3 enterprise.**

---

## Roadmap nâng cấp đẳng cấp quốc tế

### Phase 1 — Truth & Contract Fixes (1–2 sprints) — ưu tiên cao nhất
| Task | Mô tả | Liên quan |
|------|-------|-----------|
| T1.1 | Advisory: render `advisory_text` (Markdown) + auto-load mount + thêm `signal`/`confidence_score`/`summary` vào serializer (hoặc derive) | F-01 |
| T1.2 | Session filter end-to-end: `session_date` param trên whale-feed-aggregate + session-aware chart bars | F-02 |
| T1.3 | Order book: thay mock bằng depth thật hoặc gắn nhãn "ước tính" công khai | F-03 |
| T1.4 | Chuẩn hoá contract map 1-nơi (`orderFlowFallback.js` + adapter): whale item (ts/matched_value), summary (whale_order_count), dark_flow.strength | F-04, F-06, F-07 |
| T1.5 | Xoá duplicate method, dead props, pagination whale feed (next_cursor) | F-05, F-08, F-12 |

### Phase 2 — UX đẳng cấp quốc tế (2–3 sprints)
- **React Query adoption**: cache + stale-while-revalidate + optimistic watchlist; xoá 6 chỗ tạo adapter thủ công; refetchInterval cho snapshot (pattern đã có ở TenantAdmin).
- **Advisory nâng cấp**: Markdown + confidence gauge + "vì sao tín hiệu này" (component breakdown từ `ai-advisory-components`); indicator nhận diện key BYOK vs system fallback.
- **Chart pro-level**: wire dark flow strength overlay + whale markers đúng giá; session-aware candlestick (giữ nguyên bộ lọc khi đổi timeframe); draw tools + snapshots (widget đã hỗ trợ `workspaceId`).
- **Financials hoàn thiện**: bảng đầy đủ quý (hiện cắt 4 period), thêm cash flow, peer comparison, valuation percentile, highlight chữ ký tăng/giảm.
- **News + AI summary**: backend `ai-summary` đang STUB (stock_mgmt_native_views.py:2258) → nối real generation; render Markdown summary.
- **Performance**: code-split 8 tabs (React.lazy), virtualize news list, preload chart data, memo page model.
- **i18n**: dọn nốt hardcoded + parity en.

### Phase 3 — Enterprise-grade
- **Real-time layer**: WebSocket (hoặc SSE) cho quote/order book/trades thay polling 5s; backpressure + reconnect + heartbeat.
- **Accessibility**: aria-labels, keyboard nav, focus trap cho drawer, WCAG contrast (CSS đã có prefers-contrast).
- **Observability**: contract tests dùng chung FE↔BE (OpenAPI schema), RUM, error tracking, audit events cho advisory trigger.
- **SEO/PWA**: SSR meta tags cho `/stocks/:symbol`, canonical, PWA offline shell.
- **Analytics**: tracking sự kiện xem biểu đồ, click nến, refresh advisory → A/B.

### DoD cho Phase 1
- Mỗi task: tsc + vitest component tests (pattern `*.component.test.js`) + backend test mới (test_stock_management_native_api.py / test_native_views.py).
- Kiểm thử tay E2E: mở `/stocks/TPB` → advisory có nội dung; click nến ngày cũ → whale feed + CVD theo đúng phiên; order book không còn nhãn mock hoặc có label rõ.
- i18n: 0 hardcoded mới; ledger cập nhật sau mỗi sub-step.
