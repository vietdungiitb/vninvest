# B8 — Re-audit độc lập trên HEAD (fix click nến → bubble)

- **Date**: 2026-11-21 · **HEAD**: `9a9da6d3c` · **Auditor**: độc lập, chỉ đọc
  (subagent `ses_e01551022ffe8zEl2MNQdGdub2`), tự chạy lại gate, không tin báo cáo executor.
- **Plan đối chiếu**: `docs/PLAN_STOCK_TPB_CANDLE_BUBBLE_20261121.md`.

## Verdict: AGREE (+ 1 reservation, xem cuối)

1. `StockDetailPage.tsx:308` forward `tradeDate: selectedSession?.tradeDate ?? null`;
   `WhaleBubbleChart.jsx:685` `...(tradeDate ? {tradeDate} : {})` + `market.js:393-394`
   map sang `?trade_date=` → S1-AC1/AC2 đạt.
2. `WhaleBubbleChart.jsx:699` deps có `tradeDate`, effect `:700-705` reset
   `internalOrderData/FlowData` trước refetch (không flash phiên cũ); đổi mã an toàn vì
   `useStockDetailPageModel.js:100` reset `selectedSession=null` → không rò ngày cũ sang mã mới.
3. `chartSessionDate.js:15-24` dùng `Intl ... Asia/Ho_Chi_Minh` + guard invalid→null;
   `VNStockChartPanel.js:334-341` bỏ qua khi null → S2-AC1/AC2 đạt, không set session rác.
4. Dead-code xóa đúng: `flowSellStrengthSeries` chỉ định nghĩa 1 lần (0 chỗ dùng);
   `series` tương tự; `priceContextSeries` trong `buildHoverPanelData` chỉ ở destructure;
   panel block `visibleRange/candlesForHook/whaleTimes` chỉ tự dùng nội bộ; model
   `visibleRange` và hook `useViewportWhaleMarkers` + test riêng còn nguyên → không regression.
5. Gate auditor tự chạy: `tsc --noEmit` exit 0; vitest 14/14 (S1/S2/mới) + 5/5
   `WhaleBubbleChart` + 28/28 (viewport+model); eslint 0 error (warning cũ).
6. Lessons: L-V04 đạt (assert `tradeDate` thật + `not.toHaveProperty`); L-F09/L-F12 đạt
   (không đụng URL, không đổi widget); L-V02 đạt một nửa — fail-before + source-verify
   dist 0.4.4 có, nhưng repro runtime CHƯA CHẠY (đã khai thật trong `click-repro.md`).

## Reservation duy nhất (giữ nguyên sang B9/PR)

- S2-AC3 runtime (click nến khi drawing-tool/crosshair/pan bật) mới chứng minh tĩnh;
  plan B7 bắt staging VPS (`14.225.255.47`) — **CHƯA CHẠY** vì cần merge + deploy feat
  rồi thao tác tay (click 3 nến TPB). Đề xuất: merge sau khi B7 chạy, hoặc merge kèm
  nhãn monitoring + ticket follow-up click-runtime.
