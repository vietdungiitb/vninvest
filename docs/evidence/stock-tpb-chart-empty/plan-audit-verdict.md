# B3/B4 — Verdict audit plan chart-empty (2 vòng)

- **Date**: 2026-11-22 · **Plan**: `docs/PLAN_STOCK_TPB_CHART_EMPTY_20261122.md` · **Auditor**: độc lập, chỉ đọc.

## B3 round 1: NEED_REVISION

- **OB-1**: S2 `onError` chỉ bắn khi fetch LỖI, không phủ nhánh no-fetch (0 HTTP/72h) — plan chưa thừa nhận. Panel thiếu `onError` (`VNStockChartPanel.js:397-484`), nhánh rỗng vứt UI lỗi (`:499-500`); dts có `onError` (`VNInvestChartsProps.d.ts:208`).
- **OB-2**: S1 wording provider sai — retry chỉ cùng provider (`tasks.py:653-685`); cross-provider là bucket round-robin cứng (`:1801-1808`), 1 symbol rơi 1 bucket → VCI 418 phải chạy lại thủ công.
- **OK-1/OK-2**: S1 khả thi không sửa code; SCOPE không bị giữ.

## B4 round 1 → B2 round 2 (đã sửa trong plan)

- S2 thêm (b): bọc adapter đếm lượt gọi `fetchBars*`, copy chẩn đoán riêng cho zero-call.
- S1 sửa wording provider + citation đúng (`:2093-2099`, `:1644-1649`, `:653-685`, `:1801-1808`).

## B3 round 2: AGREE (+1 reservation)

- Wrapper khả thi: `fetchBars*` chỉ dùng closure, `getSourceSemantics` tĩnh → spread an toàn, giữ shape `StockDataAdapter`.
- OB-2 sửa đúng (đã đối chiếu toàn bộ citation + constants).

## B4 round 2: AGREE → được qua B5 (reservation đóng lúc implement)

- **R1**: wrapper giữ **single identity** — 1 object cho cả prop widget lẫn `pushRealtimeBar` (tránh tách đôi `this._barCallbacks` registry); delegate đầy đủ; bọc 1 lần trong `useMemo`. Tick trong MANDATORY CHECKLIST lúc code.
- Phụ: S1 ghi rõ provider của bucket index 0 (single-symbol luôn rơi đó) để ops không mò.
