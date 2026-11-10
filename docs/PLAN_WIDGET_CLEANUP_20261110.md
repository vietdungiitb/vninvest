# PLAN — Dọn thừa widget UI: bỏ badge Dark Flow + ẩn right-dock rail (2026-11-10)

## 1. Triệu chứng (ảnh user, CAR 1d)
- Badge `Dark Flow100 Mạnh` đè góc phải chart (thừa — widget đã có right dock riêng).
- Rail dock phải (⋮ + ổ khoá) + tooltip `Nâng cấp Pro để mở Dock` — tier free không dùng được, chỉ gây rối.
- Còn lại (toolbar, header OHLC, footer Pine/tester/paper, Bán/Mua, volume, legend) giống demo → giữ.

## 2. Root cause (đọc dist thật, không đoán)
- Badge render khi và chỉ khi `typeof darkFlowStrength=="number" && isFinite` (`node_modules/@vninvestcharts/widget/dist/index.js`, 3 hits cùng điều kiện `?Vn(jC,{strength...}):null`). App đang truyền strength=100 từ `orderFlowData.dark_flow` → badge hiện.
- Dock rail render khi `e.showDock !== !1` (2 hits `index.js`: `showDock!==!1&&Vn(Fg,{dockTierGate...`). App không truyền `showDock` → rail hiện ở tier free dưới dạng upsell khoá.

## 3. Fix (scope 1 file + test + 1 css)
- `VNStockChartPanel.js`: **không truyền** `darkFlowStrength`/`darkFlowSignalType` (comment lý do); thêm `showDock: false` (comment: ẩn rail upsell tier free).
- Legend chips: widget 0.4.1 **không có prop tắt legend** (grep 0 hit `legend` trong `VNInvestChartsProps.d.ts`) → ẩn bằng CSS override `VNStockChartPanel.css` (class stable `rsc-/vnsc-`, scope `.vnstock-chart-panel`). Giữ lines, hover vẫn có giá trị.
- Giữ: whaleOrders/enableWhale/enableCVD, tape off, DEFAULT_PANES, i18n provider, tier-gating P3b.
- Test: thêm S6 — assert `showDock:\s*false` + vắng `darkFlowStrength:` (fail-before đỏ → xanh sau fix).
- Non-goals: không đụng widget package, adapter, BE, CSS.

## 4. Nghiệm thu (Given/When/Then)
- Given login admin, When mở `/stocks/VNM`, Then: không badge Dark Flow góc phải; không rail dock phải; không legend chips; 0 console error mới; tsc 0, build OK, vitest 7/7, deploy verify PASS.

## 5. Lessons áp dụng
- Lessons áp dụng: [L-F12, L-V02, L-V04, L-V05]
- Checklist:
  - [x] Root cause đọc từ dist minified (điều kiện render), không đoán tên prop
  - [x] Ảnh user đã mở xem trực tiếp
  - [x] Test fail-before trước khi sửa code (L-V04: assert giá trị thật)
