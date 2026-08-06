# Kế Hoạch Triển Khai — Stock Detail Page FE↔BE Gaps (Bàn giao đội code)

**Ngày:** 2026-08-06
**Nguồn:** `docs/AUDIT_STOCK_DETAIL_FEBE_GAPS_20260806.md` (15 findings: 4 P0, 6 P1, 5 P2)
**Phạm vi:** `packages/web` (React 19 / Vite) + `packages/core/backend` (Django)
**Nguyên tắc:** Mỗi sub-step chạy đủ quality gates: `npx tsc --noEmit` → vitest/jest → `npm run build` (web); backend chạy test theo app (pytest hoặc `manage.py test`). Cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` sau mỗi task.

## Tham chiếu tài liệu

| Tài liệu | Vai trò |
|---|---|
| `docs/AUDIT_STOCK_DETAIL_FEBE_GAPS_20260806.md` | 15 findings + trace file:line + roadmap |
| `docs/STOCK_DETAIL_PAGE_AUDIT_20260717.md` | Audit cũ (21 findings — 8 đã đóng) |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Ledger (Entry 36 = audit này, Entry 37 = plan) |
| AGENTS.md | Quy ước i18n, SOC patterns, build verification |

## Tổng quan timeline

| Phase | Nội dung | Tasks | Ước lượng |
|---|---|---|---|
| 1 | Truth & Contract Fixes (P0 + P1 + P2 contract) | T1.1–T1.5 | 5–7 ngày |
| 2 | UX đẳng cấp quốc tế (P2 + enhancements) | T2.1–T2.7 | 8–12 ngày |
| 3 | Enterprise-grade | T3.1–T3.5 | 10–15 ngày |

---

# PHASE 1 — Truth & Contract Fixes

**Mục tiêu:** Trang hiển thị đúng dữ liệu thật, không còn field chết / dữ liệu giả. **Ưu tiên thực hiện T1.1 → T1.4 tuần tự** (T1.5 viết test song song để tăng coverage cho code mới).

---

## T1.1 — AI Advisory hiển thị nội dung thật (F-01, F-09)

**Vấn đề:** `AdvisoryRecordSerializer` chỉ expose `advisory_text` nhưng FE đọc `signal/summary/rationale/confidence_score` (undefined); `useStockDetailPageModel.js:178-183` cố định `advisory: null` khi mount.

### Files
- `packages/core/backend/src/advisory/models.py` (AdvisoryRecord — hiện KHÔNG có field signal/confidence)
- `packages/core/backend/src/advisory/serializers.py:46-61`
- `packages/core/backend/src/advisory/tasks.py` (nơi ghi `advisory_text` sau generate)
- `packages/core/backend/src/advisory/views.py` (latest/refresh endpoints)
- `packages/core/backend/src/advisory/migrations/` (migration mới)
- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js:178-183` (deferred lane)
- `packages/web/src/features/stock-detail/components/StockDetailTabs.js:138-156` (card render)
- `packages/web/src/features/stock-detail/components/AIAdvisoryWarningBanner.js` (kiểm tra flags)

### Bước thực hiện

**Backend:**
- [ ] 1. Thêm `structured_output = models.JSONField(default=dict, blank=True)` vào `AdvisoryRecord` (models.py:54-94) — chứa `{signal: 'buy'|'sell'|'neutral'|null, confidence_score: 0-1, summary, rationale, components[]}`. Tạo migration mới.
- [ ] 2. `advisory/tasks.py`: sau khi nhận `advisory_text` từ orchestrator, lưu `structured_output` (parse tối thiểu: nếu orchestrator trả JSON thì dùng; không thì để `{}` — KHÔNG bắt buộc LLM trả JSON ở giai đoạn này).
- [ ] 3. `serializers.py:46-61`: thêm `signal`, `confidence_score`, `summary`, `rationale` vào `fields` — đọc từ `structured_output` (SerializerMethodField với fallback `None`). **Backward-compatible:** record cũ không có structured_output → trả null, FE fallback.
- [ ] 4. Giữ nguyên `advisory_text` trong response (FE sẽ render như fallback chính).

**Frontend:**
- [ ] 5. `useStockDetailPageModel.js` deferred lane (dòng 172-194): gọi `adapter.getAdvisoryLatest(symbol)` **khi mount** (song song với whale feed), `.catch(() => null)`; bỏ `advisory: null` cố định. Logic xử lý lỗi 404 → null (giữ nguyên).
- [ ] 6. `refreshAdvisoryData` (dòng 316-401): giữ nguyên poll 2s×15 nhưng trước khi kết thúc timeout (dòng 378-393), nếu vẫn chưa có mới → set `advisory` = record mới nhất bất kể `generated_at` (hiện chỉ nhận khi `genTime >= startTime`, gây timeout-trắng trơn).
- [ ] 7. `StockDetailTabs.js:138-156`: render ưu tiên `advisory_text` (Markdown — dùng thư viện markdown đã có trong repo, nếu chưa có thì render `<pre>` giữ newline); badge `signal` chỉ hiện khi `advisory.signal` tồn tại; confidence hiện dạng "Độ tin cậy: 87%".

### Minh chứng cần đạt (DoD)
| # | Minh chứng | Cách kiểm tra |
|---|---|---|
| M1 | `GET /core/v1/advisory/latest/TPB/` (với user đã generate) trả thêm keys `signal`, `confidence_score`, `summary`, `rationale` (hoặc null) | curl + jq |
| M2 | Record cũ (pre-migration) vẫn trả 200 với các field null — không 500 | curl trên bản ghi cũ |
| M3 | Mở `/stocks/TPB` → tab "Giao dịch" card AI Advisory hiển thị `advisory_text` đầy đủ, KHÔNG còn trạng thái "Chưa có phân tích" khi đã có record | Browser + DevTools network (có request `/advisory/latest/` khi mount) |
| M4 | Test tự động: `test_advisory_serializer.py` (serializer expose field mới, record cũ null-safe); `useStockDetailPageModel.component.test.js` case "mount → gọi getAdvisoryLatest" | pytest/manage.py + vitest |
| M5 | `npx tsc --noEmit` exit 0; `npm run build` pass; vitest pass | terminal |

---

## T1.2 — Session-date filter hoạt động end-to-end (F-02)

**Vấn đề:** FE gửi `session_date` tới `/realtime/whale-feed-aggregate/` nhưng `RealtimeWhaleFeedAggregateView.get()` (legacy_views.py:412-529) không đọc param → luôn trả session mới nhất. `WhaleAlertCanonical` ĐÃ có cột `session_date` (signal_intelligence/models.py:88) nên KHÔNG cần migration.

### Files
- `packages/core/backend/src/market_serving/legacy_views.py` (get:412, filter:482-502, `_build_response` filters:822-831)
- `packages/core/backend/src/market_serving/tests/` (test mới — kiểm tra thư mục test hiện có theo convention)
- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js:174` (đã gửi đúng — verify lại key `session_date`)
- `packages/web/src/adapters/core/market.js:394-400` (verify param đúng tên)

### Bước thực hiện
- [ ] 1. `legacy_views.py` trong `get()` (sau dòng 418): parse `session_date = request.query_params.get('session_date')`; validate format `YYYY-MM-DD` (invalid → 400 với message rõ, giống pattern `_parse_sort` dòng 629-633).
- [ ] 2. Sau dòng 482: nếu có `session_date` → `queryset = queryset.filter(session_date=session_date)`. **Ghi chú:** khi có `session_date` thì bỏ qua `window` filter (session_date là filter mạnh hơn) — document trong code.
- [ ] 3. Thêm `session_date` vào response `filters` (dòng 822-831) để FE/QA verify được backend đã áp dụng.
- [ ] 4. FE: verify `useStockDetailPageModel.js:174` đã gửi `{ session_date: selectedSession?.tradeDate }` — đúng rồi, chỉ cần đảm bảo `selectedSession` được truyền đúng từ `StockSessionWitness.js` (trace khi click nến ngày cũ).

### Minh chứng cần đạt (DoD)
| # | Minh chứng | Cách kiểm tra |
|---|---|---|
| M1 | `GET /realtime/whale-feed-aggregate/TPB/?session_date=2026-08-01` → `filters.session_date == "2026-08-01"` và mọi `results[].ts` thuộc đúng ngày | curl + jq |
| M2 | `?session_date=abc` → 400 kèm message rõ ràng | curl |
| M3 | `?session_date=` (rỗng) → hành vi cũ (window=session) — không break | curl |
| M4 | Browser: click nến ngày cũ trên chart → strip "Phiên X" + danh sách khớp lệnh thay đổi theo đúng phiên | E2E tay + DevTools |
| M5 | Test backend mới: filter đúng ngày + validation 400 + không break khi thiếu param | pytest/manage.py |

---

## T1.3 — Order book: gắn nhãn minh bạch / nguồn thật (F-03)

**Vấn đề:** `RealtimeDepthChartView` (native_views.py:318-419) là MOCK (md5-seed, 40/30/20% volume) nhưng widget hiển thị như sổ lệnh thật.

**Quyết định ưu tiên:** Không có nguồn depth thật trong dev → **Option A (làm trước): minh bạch nguồn dữ liệu**. Option B (depth thật từ vnbroker/SSI) là follow-up độc lập, không chặn Phase 1.

### Files
- `packages/core/backend/src/market_serving/native_views.py:398-407` (response)
- `packages/web/src/components/workstation/hooks/useOrderBook.js` (poll + map)
- `packages/web/src/components/workstation/index.js` → `StockOrderBookWidget` (badge nguồn)
- `packages/web/src/i18n/vi.js` + `en.js` (key mới)

### Bước thực hiện
- [ ] 1. Backend: response depth-chart thêm `"is_mock": true`, `"note": "estimates"` (thay `note` hiện tại), và ghi rõ `"source": "synthetic_from_snapshot"` (native_views.py:398-407).
- [ ] 2. `useOrderBook.js`: map `is_mock` vào state `dataSource`.
- [ ] 3. `StockOrderBookWidget`: khi `is_mock` → hiển thị badge "Dữ liệu ước tính" (màu amber) + tooltip "Sổ lệnh đang được ước tính từ snapshot — chưa phải dữ liệu khớp lệnh thật".
- [ ] 4. i18n: thêm keys `workstation.orderBook.estimatedBadge` + `workstation.orderBook.estimatedTooltip` vào cả vi.js + en.js.
- [ ] 5. (Follow-up, KHÔNG trong Phase 1) Backlog: nối nguồn depth thật — tạo task riêng mô tả nguồn (vnbroker board depth / SSI iBoard) + model `OrderBookSnapshot`.

### Minh chứng cần đạt (DoD)
| # | Minh chứng | Cách kiểm tra |
|---|---|---|
| M1 | `GET /realtime/depth-chart/TPB/` → `is_mock: true`, `source: synthetic_from_snapshot` | curl |
| M2 | Widget hiển thị badge "Dữ liệu ước tính" — user KHÔNG thể nhầm sổ lệnh giả với thật | Browser screenshot |
| M3 | i18n scan: 2 key mới có trong cả vi.js + en.js | grep |
| M4 | vitest `useOrderBook.component.test.js` mới (case is_mock mapping) | vitest |
| M5 | tsc + build pass | terminal |

---

## T1.4 — Chuẩn hoá contract một nơi (F-04, F-06, F-07, F-08, F-10, F-12)

**Vấn đề:** FE đọc field sai tên so với BE ở 6 chỗ. Giải pháp: tập trung chuẩn hoá trong `orderFlowFallback.js` (đã là điểm merge duy nhất) + dọn dead code.

### Files
- `packages/web/src/features/stock-detail/orderFlowFallback.js` (chuẩn hoá chính)
- `packages/web/src/components/WhaleBubbleChart.jsx:1766-1813` (summary stats)
- `packages/web/src/components/VNStockChartPanel.js:128-137,260` (whale markers + darkFlowStrength)
- `packages/web/src/features/stock-detail/components/StockContextDeck.js:83-96` (whale item render)
- `packages/web/src/adapters/core/market.js` (xoá duplicate :180-190; sửa `?date=` :39)
- `packages/web/src/pages/StockDetailPage.tsx:277` (xoá dead prop `flowData`)
- `packages/web/src/features/stock-detail/hooks/useStockDetailPageModel.js` (pagination state)

### Bước thực hiện
- [ ] 1. `orderFlowFallback.js` — thêm 2 function chuẩn hoá (export để test):
  - `normalizeWhaleFeedItem(item)`: map `ts ?? alert_at` → `time`, `matched_value ?? value` → `price`, `volume` giữ nguyên, `side` giữ nguyên, `size_class` giữ nguyên.
  - `normalizeWhaleSummary(summary, items)`: map BE `{whale_order_count, extreme_order_count}` → FE `{total_orders: whale_order_count, buy_orders: count(side==='buy' trong items), sell_orders: count(side==='sell'), internal_orders: count(side khác)}`. Nếu BE trả sẵn `total_orders` thì giữ nguyên (backward-compatible).
- [ ] 2. `useStockDetailPageModel.js`: deferred lane map `whaleFeedRes.results` qua `normalizeWhaleFeedItem`; thêm state `whaleFeedMeta = { next_cursor, has_more }` từ response (đã có sẵn: legacy_views.py:816-818).
- [ ] 3. `StockContextDeck.js:83-96`: đọc `ev.time` + `ev.price` (đã chuẩn hoá); bỏ `??` fallback chuỗi field sai.
- [ ] 4. `WhaleBubbleChart.jsx:1771-1810`: dùng `orderData.summary` đã chuẩn hoá từ `buildEffectiveOrderFlowData` (nếu summary hiện lấy từ snapshot trực tiếp thì chuyển qua normalize).
- [ ] 5. `VNStockChartPanel.js:128-137`: `mappedWhaleOrders` đọc `s.price ?? s.close ?? 0` → sau khi chuẩn hoá là `s.price` (đã map từ matched_value); dòng 260: `darkFlowStrength: orderFlowData?.dark_flow?.strength ?? null` (BE trả `dark_flow` object — stock_mgmt_native_views.py:2112-2125).
- [ ] 6. `market.js`: xoá method duplicate `getWhaleFeedAggregate` ở dòng 180-190 (giữ method dòng 394-400 gọi `/realtime/whale-feed-aggregate/`); sửa `getSessionFacts` (dòng ~39) `?date=` → `trade_date=` (BE đọc `trade_date` — market_serving/views.py:35-52).
- [ ] 7. `StockDetailPage.tsx:277`: bỏ prop `flowData` (chỉ giữ `orderFlowData`).
- [ ] 8. Pagination (F-08): render nút "Xem thêm" khi `has_more` → gọi `getWhaleFeedAggregate` với `cursor: next_cursor`; nâng limit mặc định FE từ 20 → 50.

### Minh chứng cần đạt (DoD)
| # | Minh chứng | Cách kiểm tra |
|---|---|---|
| M1 | vitest: `orderFlowFallback.test.js` mở rộng — case normalizeWhaleFeedItem (ts/matched_value), normalizeWhaleSummary (whale_order_count→total_orders), backward-compat | vitest |
| M2 | Browser: card "Khớp lệnh trong ngày" hiện `HH:mm:ss • 12,345 CP` (không còn "— — CP —"); whale markers trên chart ở đúng vùng giá | Browser + screenshot |
| M3 | Stats block WhaleBubbleChart: Tổng lệnh > 0 khi có dữ liệu thật (không còn 0/0/0) | Browser |
| M4 | `grep -n "getWhaleFeedAggregate" market.js` → chỉ 1 định nghĩa; `grep -rn "flowData"` → không còn dùng trong VNStockChartPanel | terminal |
| M5 | Nút "Xem thêm" nạp tiếp trang sau (network có param `cursor=`) | DevTools |
| M6 | tsc + vitest + jest (các suite còn lại không regression) | terminal |

---

## T1.5 — Test coverage cho page/model hook (F-13, F-15)

**Vấn đề:** Không có test cho `useStockDetailPageModel` + `StockDetailPage`.

### Files
- `packages/web/src/features/stock-detail/__tests__/useStockDetailPageModel.component.test.js` (MỚI — vitest convention, theo pattern `useTenantAdminQuery.component.test.ts` đã có)
- `packages/web/src/features/stock-detail/__tests__/StockDetailPage.component.test.jsx` (MỚI)

### Bước thực hiện
- [ ] 1. Test `useStockDetailPageModel`: (a) mount → blocking lane gọi đủ 4 endpoint (mock adapter), loadingBlocking=false; (b) `getSessionFactsCvd` 404 → `orderFlowData` vẫn build từ fallback, không throw; (c) deferred lane mount → `getAdvisoryLatest` được gọi + advisory set; (d) refreshAdvisory timeout → advisory = record mới nhất; (e) `selectedSession` thay đổi → `session_date` trong payload `getWhaleFeedAggregate`.
- [ ] 2. Test `StockDetailPage`: (a) render header + giá đúng class màu theo chiều change; (b) advisory null → empty state; (c) error → ErrorBoundary retry button gọi lại loadBlocking.
- [ ] 3. Verify adapter được mock: KHÔNG tạo adapter thật trong test (dùng vi.mock `adapters/core/market`).

### Minh chứng cần đạt (DoD)
| # | Minh chứng | Cách kiểm tra |
|---|---|---|
| M1 | `npm run test:components` → tối thiểu 5 test mới PASS (case a-e ở trên) | vitest |
| M2 | Coverage report: `useStockDetailPageModel.js` ≥ 60% statements | vitest coverage |
| M3 | Không break jest suite: `npm test` vẫn PASS | jest |
| M4 | tsc + build pass | terminal |

---

# PHASE 2 — UX đẳng cấp quốc tế

**Mục tiêu:** Trải nghiệm ngang mức platform quốc tế (TradingView-class) sau khi Phase 1 đã đúng dữ liệu. Không bắt đầu trước khi T1.1–T1.5 đóng DoD.

## T2.1 — React Query adoption cho stock-detail (F-15)
- [ ] Singleton `createCoreApiAdapter` (module-level, `useMemo` khi env đổi) — xoá 6 chỗ tạo adapter (StockDetailPage.tsx:130,172; useStockDetailPageModel.js:108,169,206,318).
- [ ] Chuyển blocking/deferred/lazy lanes sang React Query (pattern `useTenantAdminQuery` đã có — providers/QueryProvider.tsx): keys `['stock-detail', symbol, 'blocking']`, `['stock-detail', symbol, 'deferred', sessionDate]`, `['stock-detail', symbol, tab]`; refetchInterval 30s cho blocking.
- [ ] Watchlist toggle optimistic update (invalidate query `['watchlists']`).
- **Minh chứng:** không còn adapter tạo thủ công trong stock-detail; query cache không refetch khi đổi tab (network tab); tsc + vitest (mock QueryClient) pass.

## T2.2 — Advisory nâng cấp pro
- [ ] Render Markdown `advisory_text` (kiểm tra thư viện markdown có sẵn trong repo; không thì thêm `marked` — package nhỏ).
- [ ] Confidence gauge (vòng tròn 0-100%) khi có `confidence_score`; signal badge BUY/SELL/NEUTRAL màu chuẩn.
- [ ] Nút "Vì sao tín hiệu này?" → hiển thị `components[]` từ `structured_output` (nếu có).
- [ ] Badge nguồn model: "BYOK" vs "System fallback" (dùng `advisoryFallbackFlags` đã có).
- **Minh chứng:** component test render 3 trạng thái (có structured, chỉ text, null); i18n đủ 2 ngôn ngữ; screenshot.

## T2.3 — Chart pro-level
- [ ] Overlay dark flow strength lên chart (sau T1.4-5 đã map `dark_flow.strength`).
- [ ] Whale markers đúng giá + tooltip size_class; giữ nguyên khi đổi timeframe.
- [ ] Session-aware candlestick: chọn phiên trên witness strip → chart và whale feed cùng filter (đã có nền từ T1.2).
- [ ] Khai thác widget `workspaceId` để lưu drawing layouts theo symbol.
- **Minh chứng:** E2E tay 3 scenario (dark flow hiển thị khi strength>0; marker đúng giá; đổi timeframe không reset marker); widget messages i18n đầy đủ.

## T2.4 — Financials hoàn thiện
- [ ] Backend: bỏ giới hạn 4 period (stock_mgmt_native_views.py financials — verify hiện trả bao nhiêu kỳ) → 8-12 kỳ.
- [ ] Thêm Cash Flow + chỉ số định giá (P/E, P/B) percentile so ngành (nếu dữ liệu có sẵn — verify).
- [ ] Highlight chữ ký tăng/giảm (màu xanh/đỏ theo delta) trong bảng.
- **Minh chứng:** API trả ≥8 kỳ; component test render đủ cột; i18n đủ.

## T2.5 — News + AI summary
- [ ] Backend: `ai-summary` STUB (stock_mgmt_native_views.py:2258) → nối real generation qua advisory orchestrator (có sẵn orchestration).
- [ ] FE: render Markdown summary + trạng thái loading/generated/failed.
- **Minh chứng:** POST summary trả nội dung thật; fallback khi quota hết hiện rõ; test backend cho view mới.

## T2.6 — Performance
- [ ] Code-split 8 tabs (React.lazy + Suspense) — xoá tải toàn bộ renderers khi mở trang.
- [ ] Virtualize danh sách news (đã có pattern?) + whale feed.
- [ ] `useMemo` toàn model hook; tránh re-render chart khi snapshot đổi phiên.
- **Minh chứng:** bundle size giảm (báo cáo `vite build` chunk size); Lighthouse/Tab switch không jank; tsc pass.

## T2.7 — i18n dọn nốt hardcoded (F-11)
- [ ] Chuyển ~15 chuỗi sang `stockDetail.*`: StockDetailPage.tsx:167,178,200,254,306; StockDetailTabs.js:56,82,113,124,149-150,155; StockContextDeck.js:56,117,205.
- [ ] Verify en.js parity từng key; grep không còn chuỗi tiếng Việt trong JSX trừ defaultValue.
- **Minh chứng:** `npm run i18n:scan` 0 hardcoded mới; grep toàn bộ stock-detail + StockDetailPage.tsx không ra chuỗi tiếng Việt thô.

---

# PHASE 3 — Enterprise-grade

| Task | Nội dung | Minh chứng tối thiểu |
|---|---|---|
| T3.1 | WebSocket/SSE thay polling 5s (quote, depth, trades) — backpressure, reconnect, heartbeat | Wireshark/DevTools: 0 poll HTTP; reconnect test bằng kill server |
| T3.2 | Accessibility: aria-labels, keyboard nav, focus trap, WCAG contrast | Axe scan 0 critical; tab-order test |
| T3.3 | Observability: OpenAPI contract test chung FE↔BE, RUM, error tracking, audit events advisory | CI job contract test xanh; audit log có event trigger advisory |
| T3.4 | SEO/PWA: SSR meta `/stocks/:symbol`, canonical, offline shell | Google Rich Results valid; Lighthouse PWA ≥ 90 |
| T3.5 | Analytics: tracking xem chart, click nến, refresh advisory, A/B | Sự kiện xuất hiện trong warehouse |

---

# Definition of Done tổng thể

1. **T1.1–T1.5 (Phase 1) bắt buộc đóng trước khi merge.** T2.x không được bắt đầu khi còn P0 mở.
2. Mỗi task: tsc + vitest + jest + build xanh; backend test app tương ứng xanh.
3. Mỗi task: cập nhật `CODE_CHANGE_AUDIT_LEDGER.md` (Entry mới: Type=Implementation, Files touched, Validation thật).
4. E2E checklist cuối Phase 1 (chạy tay trên `/stocks/TPB`):
   - [ ] Advisory hiển thị nội dung đầy đủ (không empty state khi có record)
   - [ ] Click nến ngày cũ → whale feed + CVD đúng phiên
   - [ ] Order book có nhãn "Dữ liệu ước tính"
   - [ ] Card khớp lệnh cá mập có giờ + giá + khối lượng (không "— — CP —")
   - [ ] Stats tổng lệnh > 0
   - [ ] Dark flow overlay xuất hiện khi strength > 0
   - [ ] "Xem thêm" whale feed nạp trang sau
5. i18n: 0 hardcoded mới trong stock-detail.

# Rủi ro & giả định

| Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Migration `structured_output` trên bảng advisory lớn | Downtime ngắn | Migration thêm column nullable, default `{}` — không backfill nặng |
| LLM không trả JSON structured khi generate | `signal` luôn null | FE fallback render text; giai đoạn sau cải prompt (orchestrator.py) |
| Không có nguồn depth thật | Order book vẫn ước tính (đã minh bạch) | Đã tách Option B thành backlog độc lập |
| Thay đổi filter whale feed ảnh hưởng legacy clients | Contract mới nếu gọi sai session_date | Chỉ thêm param mới, backward-compatible; echo trong `filters` để client cũ không vỡ |
| React Query migrate đụng realtime polling | Quote trễ | Giữ `useRealtimeFeedFromManager` riêng, không đưa quote vào React Query |
