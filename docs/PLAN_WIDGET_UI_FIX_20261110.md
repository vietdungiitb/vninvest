# PLAN — Sửa chart UI "kinh dị" về demo-parity (2026-11-10)

## 1. Triệu chứng (bằng chứng ảnh user cung cấp)
- App `/stocks/VNZ`: legend EMA/BB/DMI/CCI/MFI/RSI/MACD/VWAP/SAR chồng chữ lên nhau; pane phải "Dark Flow/Bán/Mua" đè chart; toolbar/bottom bar mất spacing ("Khung nến1m5m...", "Phạm vi5D1M3M...").
- Demo: 1 price pane gọn, legend 1 dòng, toolbar/header/footer đầy đủ style, Bán/Mua badges góc phải dưới.

## 2. Root cause (đã đọc source thật, file:line)
1. **Mất CSS**: `VNStockChartPanel.js:87-93` bỏ `import('@vninvestcharts/widget/dist/index.css')`, thay bằng `mod?.injectVNInvestChartsCSS?.()` **không truyền arg** — nhưng API mới yêu cầu `target: Document|ShadowRoot|HTMLElement` (`node_modules/@vninvestcharts/widget/dist/dts/widget/styles/injectStyles.d.ts:9`). Gọi không arg = no-op/thiếu target → toolbar/footer/legend không style → chữ dính nhau.
2. **Panes tràn**: `customPanes` (`VNStockChartPanel.js:189-248`) 4 pane heightRatio 0.55+0.22+0.23+0.23 = **1.23 > 1** + 14 series nhồi 2 pane nhỏ `splitScale:true` → legend 8 chỉ báo đè nhau. API mới `PaneDescriptor` (`pane-descriptor.d.ts`) không tự chuẩn hoá tổng = 1.
3. **Props chết/rác**: `showWorkspaceToolbar`, `showSymbolBadges` (`VNStockChartPanel.js:326,315`) **không tồn tại** trong `VNInvestChartsProps` mới (đã đọc toàn bộ `VNInvestChartsProps.d.ts`) → bị bỏ qua; `showTapePanel:true` mở side tape panel ăn chiều rộng + đè Bán/Mua.

## 3. Fix (scope 1 file)
- `packages/web/src/components/VNStockChartPanel.js`:
  - Khôi phục `import('@vninvestcharts/widget/dist/index.css')` + sửa inject thành `injectVNInvestChartsCSS(document)` (fallback an toàn).
  - **Bỏ prop `panes`** → dùng `DEFAULT_PANES` của widget (demo-parity); giữ whale/CVD props (overlay lên default pane).
  - Xoá `showWorkspaceToolbar`, `showSymbolBadges`; `showTapePanel: false`.
  - Giữ `WidgetI18nProvider` nhưng truyền đủ `locale + messages`.
  - Giữ tier-gating P3b (mặc định free = không panel phụ).
- Non-goals: không đổi adapter/BE, không đụng engine, không thêm feature mới.

## 4. Nghiệm thu (Given/When/Then)
- Given user đã login, When mở `/stocks/VNM`, Then: 1 price pane, legend 1 dòng không đè chữ, toolbar trái + header + footer có style, không side tape panel, 0 console error.
- Gates: `tsc 0`, `vite build OK`, `vitest vnstock-chart-panel 5/5`, `check-multi-agent PASS`, deploy staging verify PASS (0 restart).

## 5. Lessons áp dụng
- Lessons áp dụng: [L-V02, L-V05, L-V03, L-F01]
- Checklist:
  - [x] Root cause đọc từ source lib (`injectStyles.d.ts:9`, `VNInvestChartsProps.d.ts`), không đoán
  - [x] Ảnh user đã mở xem trực tiếp (không tin exit code)
  - [x] File screenshot/đo tạm (`chart-render-check.mjs`) đã xoá trước commit
  - [x] Phân biệt static vs dynamic import khi đánh giá bundle

## 6. Rollback
- Revert 1 commit là về bản P3b cũ. Không migration, không infra.
