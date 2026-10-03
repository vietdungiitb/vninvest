# AUDIT: Phản biện độc lập — Kế hoạch Stock Detail FE-BE Gaps 2026-08-06

> Kiểm toán độc lập kế hoạch `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_FEBE_GAPS_20260806.md` (ledger Entry 37)
> trước khi kickoff Phase 1. Trace từng claim của plan qua code thực tế (backend + web).
> Kết quả: **plan đúng ~70%, có 3 điểm cần sửa (1 misattribution, 1 nhầm luồng dữ liệu, 1 thiếu phạm vi). Không blocker, nhưng nên chốt 5 hiệu chỉnh mục C trước khi làm.**

---

## 1. Tóm tắt 5 phát hiện nghiêm trọng nhất

1. **[C-1] T2.4 trỏ sai lớp**: Plan bảo "Backend: bỏ giới hạn 4 period" nhưng backend **không hề giới hạn** — giới hạn nằm ở FE `keys.slice(0, 4)` (StockDetailTabs.js:430). `fetch_company_financials` (vnbroker_adapter.py:1059-1118) trả toàn bộ kỳ quarterly. → Task T2.4 phải đổi thành FE-only.
2. **[C-2] T1.4 bước 4 nhầm luồng dữ liệu**: Plan bảo "dùng orderData.summary đã chuẩn hoá từ buildEffectiveOrderFlowData" nhưng WhaleBubbleChart **tự fetch** snapshot riêng (`internalOrderData` từ `adapter.getWhaleAnalyticsSnapshot`, WhaleBubbleChart.jsx:642), không đi qua `buildEffectiveOrderFlowData`/`orderFlowFallback.js`. → Bước 4 theo nhánh chính là chết đường.
3. **[R-1] Marker whale vẫn plot tại giá 0**: `VNStockChartPanel.js:128-137` map `price: s.price ?? s.close ?? 0`. Fix F-04 (backend trả `matched_value`) mà không sửa mapping này cùng task → chart vẫn vẽ marker ở giá 0.
4. **[R-2] `internal_orders` không bao giờ tồn tại**: WhaleBubbleChart.jsx:1810 đọc `summary?.internal_orders` vẽ bar "Internal", backend chỉ trả `{whale_order_count, extreme_order_count}` (portfolio_analytics_views.py:1254-1257) → bar luôn 0. `normalizeWhaleSummary` phải map mặc định `internal_orders: 0`.
5. **[R-3] i18n hardcode nằm ngay trong component plan sẽ sửa**: signalLabel "Mua/Bán/Chờ..." (StockDetailTabs.js), fmtCompact "Tr/K/N/T", "Lệnh mua"/"Lệnh bán" (WhaleBubbleChart.jsx:1666-1667). Đẩy hết sang T3 scan-batch là muộn — xử lý ngay trong task sửa component đó.

---

## 2. Phạm vi nghiên cứu

- **Plan đối chiếu**: `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_FEBE_GAPS_20260806.md`
- **Audit gốc**: `docs/AUDIT_STOCK_DETAIL_FEBE_GAPS_20260806.md` (ledger Entry 36, 15 findings 4 P0)
- **Backend**: `packages/core/backend/src/market_serving/native_views.py`, `market_serving/legacy_views.py`, `advisory/serializers.py`, `advisory/orchestrator.py`, `user_workspace/portfolio_analytics_views.py`, `market_data/vnbroker_adapter.py`
- **Web**: `packages/web/src/features/stock-detail/`, `packages/web/src/components/WhaleBubbleChart.jsx`, `packages/web/src/components/VNStockChartPanel.js`, `packages/web/src/adapters/core/market.js`, `packages/web/src/components/workstation/hooks/useOrderBook.js`
- **External coupling**: `vninvestcharts-widget` (npm ^1.2.5), `defaultCoreApiAdapter`

---

## 3. Đối chiếu plan ↔ code

### A. Claims XÁC NHẬN ĐÚNG

| Claim plan | Bằng chứng code | Kết luận |
|---|---|---|
| F-03 depth-chart là mock | `RealtimeDepthChartView` docstring "order book depth (mock implementation)" (native_views.py:318-319); sinh 3 bid + 3 ask từ reference price | ĐÚNG |
| F-06 summary mismatch | Backend `summary = {whale_order_count, extreme_order_count}` (portfolio_analytics_views.py:1254-1257) vs FE đọc `summary?.total_orders/buy_orders/sell_orders` (WhaleBubbleChart.jsx:1665-1667, 1771-1810) | ĐÚNG |
| F-01 advisory thiếu signal/confidence | `AdvisoryRecordSerializer` fields = `[advisory_id, symbol, session_date, status, ai_model, advisory_text, tokens_used, error_message, generated_at, created_at]` (advisory/serializers.py:49-60) — không có signal/confidence/summary/rationale | ĐÚNG (đã xác minh đầy đủ) |
| F-02 filter session_date khả thi | `WhaleAlertCanonical.session_date` có index `(symbol, session_date, side)`; `RealtimeWhaleFeedAggregateView` (market_serving/legacy_views.py, route urls.py:30) parse `limit/sort/window/cursor` nhưng chưa doc `session_date` | ĐÚNG — khả thi không cần migration |
| F-04 whale feed fields lệch contract | FE `getWhaleFeedAggregate` → `/realtime/whale-feed-aggregate/` (market.js:394-400); backend item trả `ts/matched_value` | ĐÚNG |

### B. CONTRADICTIONS (plan vs code)

| Plan | Thực tế | Tác động |
|---|---|---|
| **T2.4**: "Backend: bỏ giới hạn 4 period" | Backend KHÔNG giới hạn period. `fetch_company_financials` (vnbroker_adapter.py:1059-1118) trả **toàn bộ** kỳ quarterly (ratio/income/balance, không slice). Giới hạn 4 nằm ở FE: `keys.slice(0, 4)` (StockDetailTabs.js:427-431) | Task trỏ sai lớp. Sửa `slice(0,4)` → `slice(0,8)` (hoặc theo chuẩn sản phẩm) ở **FE**, backend không đổi |
| **T1.4 bước 4**: "dùng orderData.summary đã chuẩn hoá từ **buildEffectiveOrderFlowData**" | WhaleBubbleChart tự fetch `internalOrderData` qua `adapter.getWhaleAnalyticsSnapshot` (WhaleBubbleChart.jsx:642). Không đi qua `orderFlowFallback.js`. Nhánh phụ "nếu summary lấy từ snapshot trực tiếp" mới đúng | Bước 4 viết lại: **nhúng `normalizeWhaleSummary` vào luồng fetch của WhaleBubbleChart** (import từ orderFlowFallback.js), chạy ngay sau khi nhận snapshot |

### C. Findings — Rủi ro plan CHƯA COVER

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| R-1 | P1 | VNStockChartPanel.js:128-137 | `price: s.price ?? s.close ?? 0` — nếu cả 2 đều thiếu thì marker ở giá 0 | Fix F-04 mà không sửa mapping này cùng task → chart vẫn vẽ marker sai | T1.4 bổ sung bước sửa mapping này (dùng `matched_value` như normalizeWhaleFeedItem) **song song** với F-04 |
| R-2 | P2 | WhaleBubbleChart.jsx:1810 | `summary?.internal_orders` chưa từng tồn tại ở backend (chỉ `whale_order_count`/`extreme_order_count`) → bar "Internal" luôn 0 width | UI sai thầm lặng | `normalizeWhaleSummary` map mặc định `internal_orders: 0` |
| R-3 | P2 | market.js:180 vs :394 | `getWhaleFeedAggregate()` định nghĩa **2 lần** — bản :180 (old `/whale-feed-aggregate/`) bị bản :394 (native) shadow | May mắn bản đúng thắng, nhưng là dead code + nguồn nhầm lẫn | Plan T1.2/T1.4 đã nêu xoá duplicate — giữ, nhưng xoá đúng bản :180 (không xoá nhầm :394) |
| R-4 | P2 | StockDetailTabs.js signalLabel map; WhaleBubbleChart.jsx:1666-1667 | i18n hardcode nằm ngay trong component đang sửa | T3 scan-batch không đủ — string tồn tại trong chính diff của Phase 1/2 | Xử lý i18n ngay trong task sửa component, không đẩy sang T3 |

---

## 4. Cấu trúc kế hoạch đề xuất sửa (tối thiểu, không mở rộng scope)

1. **T2.4** → đổi thành FE-only task: "FE: nới giới hạn period từ 4 lên 8-12 kỳ (StockDetailTabs.js:430 `keys.slice(0,4)`), thêm cash-flow; backend xác nhận không giới hạn — không đổi code".
2. **T1.4 bước 4** → viết rõ: import `normalizeWhaleSummary` vào WhaleBubbleChart, chạy trong handler fetch snapshot; kèm mapping `internal_orders: 0`; tổng hợp buy/sell/total từ `whale_order_count` + đếm side trong `bubble_series`.
3. **T1.4** → bổ sung bước sửa `VNStockChartPanel.js:128-137` (mapping marker theo `matched_value`).
4. **T1.2** → giữ xoá duplicate `getWhaleFeedAggregate` market.js:180, ghi rõ xoá bản cũ giữ bản native (:394).
5. **T1.x mỗi task sửa component** → checklist i18n cho string hardcode trong chính file đó.

---

## 5. Quality gates

- Chưa chạy build/test (audit research-only, không đổi code) — plan đã yêu cầu `npx tsc --noEmit` + vitest/jest + `npm run build` mỗi sub-step, đạt.
- Không có mâu thuẫn nào giữa plan DoD và quality gates hiện hành của repo (AGENTS.md).

---

## 6. Câu hỏi cần làm rõ

1. Chuẩn số kỳ financials mong muốn là bao nhiêu (8 kỳ hay 12 kỳ)? Backend hiện không cần đổi, FE slice quyết định.
2. Nguồn "depth chart thật" (T1.3) là backlog riêng — `is_mock: true` + badge "Dữ liệu ước tính" có đủ cho Phase 1 không, hay cần quy ước contract trước với widget?
3. `extreme_order_count` có nên expose thành một KPI riêng (ví dụ "Lệnh cực lớn") thay vì gộp vào `total_orders`?

---

## 7. Đánh giá tổng thể

**Implementable: CÓ** (không blocker). Phân tích của plan chính xác ~70-80%; 3 vấn đề đáng sửa trước khi kickoff:
- T2.4 misattribute backend (sửa 1 dòng trong plan)
- T1.4 bước 4 nhầm luồng dữ liệu WhaleBubbleChart (sửa mô tả + vị trí nhúng)
- Thiếu 2 bước: mapping marker widget (`VNStockChartPanel.js:128-137`) và `internal_orders: 0`

Ưu tiên: sửa T1.4 trước (liên quan 2 P0: F-04/F-06), T2.4 chỉ là điều chỉnh mô tả, không chặn Phase 1.
