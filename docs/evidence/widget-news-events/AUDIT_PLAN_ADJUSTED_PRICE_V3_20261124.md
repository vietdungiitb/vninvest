# Audit v3 — plan `PLAN_WIDGET_ADJUSTED_PRICE_DISPLAY_20261124.md` (2026-11-24)

> Auditor độc lập (subagent, chỉ đọc). Verdict: **NEED_REVISION** — vòng 3/3.
> Theo workflow-dev-loop B3/B4: quá 3 vòng ⇒ **ghi blocker, trả partial state, dừng**.

## Đã đóng
- O1: đường uncontrolled/adapter đã chọn đúng.
- O4: SSOT badge đủ (`showAdjustedBadge` chỉ ở ForkEngineSurface/ForkPaneTooltips/ChartStatusLine + test); capability/contract giữ nguyên là quyết định có ý thức.
- O5: không tự mâu thuẫn — chỉ là reservation (upsell copy cũ).

## O6 (BLOCKER — chưa đóng)
`setBars` là wrapper (`useWidgetData.ts:254-263`), có ≥9 chỗ ghi: `:515` controlled, `:739` reset, `:838` initial, `:888` warmup, `:990` live tick + `useWidgetDataBackfill.ts:269,344,458,554,667`.
`historyChunkStoreRef` giữ bar **thô** (`replaceAll:770`, `append:814/876/936`). Transform chỉ tại `:838` ⇒ bản copy React state bị ghi đè bởi warmup/live tick từ store thô ⇒ mất adjustment, trộn 2 hệ giá tại ranh warm-up.
**Phải cắm trong wrapper `:254-263` (hoặc trước khi đưa vào store)**, không phải `:838`.

## Reservation (không chặn)
- `usedAdjustedBars` đã tự chảy qua `dataResult` (`VNInvestCharts.tsx:511 → :2620,:2667`) — không cần thêm prop.
- Định nghĩa "≥1 bar có adjClose" ≠ "bar thực sự được adjust" khi guard từ chối factor.
- §2.5:32 trỏ "§6.1" nhưng §6 không có mục con (lỗi trích dẫn).

## Quyết định
Dừng theo limit 3 vòng. Plan ở trạng thái BLOCKED. Muốn tiếp tục cần owner cho phép vòng 4 (hoặc thu hẹp scope), **không tự ý sửa code**.
