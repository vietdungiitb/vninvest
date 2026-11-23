# Giải thích 3 thành phần UI trên chart vninvest (widget 0.4.7-ent)

> Ngày: 2026-11-23 · Phạm vi: `/stocks/VIC` staging, widget `@vninvestcharts/widget` 0.4.7 (local tarball) + host `VNStockChartPanel.js`.
> Nguồn: source widget repo `D:\Mujoco Projects\vninvestcharts-widget` + ảnh chụp `/tmp/vic-chart-full.png` (đã lưu `vic-chart-full.png`, `vic-toolbar.png`).

## 1. Dòng "Chưa điều chỉnh" — badge chất lượng dữ liệu (đúng thiết kế)

- i18n: `src/widget/i18n/capability.messages.vi.ts:147` → `data.unadjusted.tag = "Chưa điều chỉnh"`.
- Render: `src/widget/components/canvas/ChartStatusLine.tsx:417-425` — hiện khi `showAdjustedBadge === true`, ngay dưới dòng OHLC.
- Điều kiện: `src/widget/components/fork/ForkEngineSurface.tsx:147-149`
  `hasAdjusted = typeof adapter.fetchAdjustedBars === "function"; showAdjustedBadge = !hasAdjusted`.
- Thực tế: `packages/web/src/adapters/chartAdapter.js` **không** implement `fetchAdjustedBars` (grep 0 hit).
- **ĐÍNH CHÍNH 2026-11-23 (sau câu hỏi "hệ thống không tự làm à"):** BE **có** pipeline tự tính giá điều chỉnh, không phải thiếu thiết kế:
  - `market_data/corporate_actions/adjustment.py:26-78` `compute_adj_factors` (cộng cash, nhân dồn ratio) → `:81-104` `apply_adjustments` materialize `DailyPrice.adj_close`.
  - `data_ingest/tasks.py:3480-3510` `sync_corporate_actions` gọi cả hai; `:3513+` `sync_all_corporate_actions` là nightly orchestrator; beat có `sync-corporate-actions-nightly`.
  - Flag staging **BẬT**: `compose.staging.env:111 CORPORATE_ACTIONS_ENABLED=true`, container env cũng `true`.
  - Đo thực staging: `AdjFactor` 17.324 dòng (VIC 75), `CorporateAction` 22.461 (VIC 84) — pipeline **đã chạy**.
- **Vì sao vẫn `adj_close = null` (VIC 0/4782 rows):** 70/84 event VIC `parse_status='unparsed'` (vd *"Phát hành cổ phiếu - Chuyển từ trái phiếu chuyển đổi"*, *"Quyền mua CP cho Cổ đông hiện hữu tỉ lệ 20.2%"*) ⇒ 64/75 factor bị đánh dấu `partial`. `adjustment.py:89` `reset = not affecting or any(f.status != COMPUTED ...)` → **fail-closed**: chỉ cần có partial factor ảnh hưởng thì xoá `adj_close` của ngày đó. Kết quả `/bars/` trả `adj_close:null, adjusted:false, note:"Bars chưa điều chỉnh: sự kiện chưa parse được tại ex_date ..."`.
- **Gapping thêm trên đường FE:** host gọi `/chart/` (`adapters/core/market.js:246`) — endpoint này **không có field `adj_close`** (đo curl thật). Endpoint có adj_close là `/bars/` (`stock_mgmt_native_views.py:4071-4072`), nhưng `chartAdapter.js:42-54 mapToBar` cũng **không map** `adj_close` vào bar. Nên dù BE có sửa xong parser, widget vẫn chưa nhận được giá điều chỉnh.
- ⇒ Kết luận đúng: hệ thống **có cơ chế tự điều chỉnh nhưng đang fail-closed vì parser VCI chưa parse được đa số event**, cộng thêm 2 điểm gapped ở FE. Muốn mất badge cần sửa cả 3: (a) parser `parse_event_title` cho các mẫu title trên → factor `computed`; (b) host dùng `/bars/` hoặc thêm adj_close vào `/chart/`; (c) `mapToBar` giữ `adj_close` / implement `fetchAdjustedBars`.

## 2. "Đo lường" — công cụ đo trong thanh vẽ (widget render cứng)

- i18n: `src/widget/i18n/messages.vi.ts:358` → `tool.group.measurement = "Đo lường"`; `messages.vi.ts:34` → `measurement.title = "Đo lường"`.
- Thanh vẽ: `src/widget/components/toolbar/DrawingToolbar.tsx:341-364` map **toàn bộ** `TOOL_GROUPS_V2` (14 nhóm) không filter tier; nhóm measurement (`config/toolGroups.ts:69-72`) chứa 8 tool: dateAndPriceRange, longPosition, shortPosition, priceRange, dateRange, barsCount, crossLine, datePriceRange. Không có prop nào để ẩn riêng nhóm này — chỉ `drawingUiEnabled` (host đang `true` ở `VNStockChartPanel.js:460`) tắt được cả thanh vẽ.
- Overlay trên canvas: `MeasurementOverlay.tsx:741-763, 244-299` chỉ vẽ khi `enabled && measurementState.enabled`; `enabled` lấy từ `props.measurementEnabled` (`VNInvestCharts.tsx:1650`), host truyền `measurementEnabled: isPro` (`VNStockChartPanel.js:503`). Khi có selection, hộp label vẽ 3 dòng: "Đo lường / Số nến: N / Δ giá: …" (`MeasurementOverlay.tsx:186-225`).
- ⇒ Nếu thấy chữ "Đo lường" trong thanh công cụ: đó là nhóm tool cố định, không tắt được từng cái. Nếu thấy hộp "Đo lường" trên chart: đó là measurement đã commit; xoá bằng chính tool measurement / không truyền `measurementEnabled: true` (tức bật `isPro`).

## 3. Đường kẻ ngang màu xanh/teal ở cuối chart — "Đường giá gần nhất"

- i18n: `messages.vi.ts:1359` → `settings.symbol.lastPriceLine = "Đường giá gần nhất"`.
- Mặc định **BẬT**: `src/widget/components/settings/model/defaultSettings.ts:26-27` `showLastPriceLine: true`, `lastPriceLineColor: upColor` (`#089981` teal/xanh lá).
- Render: `VNInvestCharts.tsx:347-349` `lastValue: scales.showSymbolLastValue || symbol.showLastPriceLine`, `lastColor: lastPriceLineColor || undefined` → đường ngang tại giá close cuối kéo tới mép phải chart + tag giá.
- Tắt: mở Settings (bánh răng) → tab Symbol → bỏ check "Đường giá gần nhất" (`SymbolSettingsTab.tsx:112-133`). Không có prop host nào override mặc định này.
- Phân biệt: các đường cong xanh dương khác trên chart là EMA(20)/EMA(50) — status line hiện "Đường trung bình động lũy thừa (20)/(50)" (xem ảnh `vic-toolbar.png`), cũng là indicator mặc định, không phải đường lỗi.

## Kết luận
Cả 3 đều đến từ widget, không phải lỗi wiring của vninvest: (1) badge trung thực vì thiếu adj_close; (2) nhóm tool measurement render cứng + overlay theo `isPro`; (3) last-price line bật mặc định trong settings.
