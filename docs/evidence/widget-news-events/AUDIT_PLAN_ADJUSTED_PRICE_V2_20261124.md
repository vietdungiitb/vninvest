# Audit v2 — plan `PLAN_WIDGET_ADJUSTED_PRICE_DISPLAY_20261124.md` (2026-11-24)

> Auditor độc lập (subagent, chỉ đọc). Verdict: **NEED_REVISION**.
> v1 đã xử lý: CSV hard-code, factor>1/tolerance, process/owner questions.

## Objection mới
- **O1 (BLOCKER):** `VNStockChartPanel.js:452-545` không truyền prop `data`; `useWidgetData.ts:171 hasExternalData=false` ⇒ controlled path (`externalBarsNormalization`) không dùng được. Đường thật là uncontrolled: `chartAdapter.mapToBar:42-54` → `VNInvestClient.normalizeChartPoint:152-168` (bỏ adjClose) → `coordinatedFetch:781` → `setBars:838`. Plan phải chọn adapter path.
- **O2:** `OHLCVBar` là interface ⇒ intersection hợp lệ; worker structured-clone giữ field. Nhưng `adjClose` Q2-rounded ⇒ sai số lớn khi close nhỏ; citation factor>1 trỏ `:52` (guard) thay vì `:45-51`.
- **O3:** transform ở `:275` không đủ: MTF `:1320` + volume profile `:1284-1289` đọc trực tiếp `canaryFilteredBars`. Phải transform tại nguồn bar.
- **O4:** SSOT badge sót `ForkPaneTooltips.tsx:70,96,139`, `capabilityProbe.test.ts:45,77`, `scripts/conformance/contract.json:16-18`; `ChartStatusLine.adjusted.test.tsx:72,123-130` khoá presence-probe cũ ⇒ rewrite nhánh dương tính. Chưa nêu plumbing `usedAdjustedBars`.
- **O5:** resolver (backend capability) và badge (dataset reality) hợp lệ khi khác nhau — không nên ép đồng bộ.

## Phân công
- Tác giả sửa O1/O3/O4 → audit v3 (đã làm REVISION 2).
- Owner chốt O2 (tolerance close nhỏ), O5 (đã chọn tách semantic), §6.
