# B3/B4 — Verdict audit độc lập cho PLAN_STOCK_TPB_CANDLE_BUBBLE_20261121

- **Date**: 2026-11-21 · **Plan**: `docs/PLAN_STOCK_TPB_CANDLE_BUBBLE_20261121.md` (B2) · **Audit gốc**: `docs/AUDIT_STOCK_TPB_CANDLE_BUBBLE_20261121.md`.
- **Auditor**: độc lập, chỉ đọc (subagent `ses_e016b8ecaffesm6c2Kmq9LY6BX`), không sửa file.

## B3. Verdict: AGREE

Mọi citation trong plan đã được auditor tự mở đọc và khớp code thật:

1. `StockDetailPage.tsx:302-306` render `WhaleBubbleChart` thiếu session; `selectedSession` sẵn trong scope (`:108-109`), `handleSessionChange` (`:135-137`) — đúng root cause.
2. `WhaleBubbleChart.jsx:562-581` props không có `tradeDate`; `fetchOrders` (`:663-686`) gọi `getWhaleAnalyticsSnapshot` (`:670-674`) không gửi `trade_date`; adapter `market.js:386-400` đã hỗ trợ.
3. `VNStockChartPanel.js:353-364` khớp widget 0.4.4 (`VNInvestChartsProps.d.ts:142-146`, `types.d.ts:2,210`; `package.json:107-108`).
4. BE `portfolio_analytics_views.py:2790,2807,2814` đã nhận `trade_date`.
5. S1/S2/S3 khả thi, AC kiểm chứng được, SCOPE đủ (i18n dùng pattern `t(key,{defaultValue})`, không cần key mới).
6. Không claim `in-progress` nào giữ file SCOPE (ngoại lệ R1 bên dưới).

## B4. Đồng thuận: AGREE → được qua B5 (với 4 reservation đã đóng như sau)

| # | Reservation (auditor) | Xử lý |
|---|---|---|
| R1 | `market.js` đang bị 2 claim `in-progress` giữ (`stock-f07-slash` CLAIMS:2015, `stock-slow-load` CLAIMS:2022) — grep B1 của executor đã bỏ sót vì pattern thiếu `market.js` | Đóng tại B4: LIMIT S1 "không đổi adapter" giữ nguyên → executor **không chạm** `market.js`; nếu S2 ADR yêu cầu đổi adapter thì khai claim riêng + báo coordinator. Ghi nhận bài học: grep xung đột phải gồm cả tên file adapter. |
| R2 | Nếu phát sinh key i18n mới, tránh monolith `src/i18n/vi.js+en.js` (đang bị giữ) | Đóng tại B4: plan đã quy định `t(key,{defaultValue})` / `locales/vi\|en/stockDetail.js`; giữ nguyên. |
| R3 | Plan nhắc "theo RUNBOOK ở B7" nhưng không có §B7 — tham chiếu treo | Đóng tại B4: đã bổ sung `## B7. Verify staging` vào plan (VPS staging + checklist click 3 nến + cấm local Docker). |
| R4 | Baseline B1 chấp nhận theo khai báo, chưa chạy lại | Đóng tại B4: executor chạy lại toàn bộ §Gates sau rebase/sửa ở B7 mỗi slice; slice nào cũng fail-before đỏ trước. |

**Cửa B4→B5: PASS/AGREE — đủ điều kiện khai claim + cách ly khi owner duyệt thực thi.** Chưa sửa dòng code nào tới thời điểm này.
