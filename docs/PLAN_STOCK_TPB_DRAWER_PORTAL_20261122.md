# PLAN — Drawer AI config bị `.sdp-page > :not()` đè `position:fixed` → rớt xuống cuối trang

- **Date**: 2026-11-22 · **Lessons áp dụng**: [L-V02, L-V04, L-F12, L-T01, L-F07]
- **Trạng thái vòng kín**: B1 đo lường xong → B2 (file này) → chờ B3 + B4.

## B1. Kết quả đo lường (đã đọc code thật)

- Drawer render tại `StockDetailPage.tsx:390-395` (`drawerOpen && e(AIAdvisoryPromptConfigDrawer...)`) — là con TRỰC TIẾP của `.sdp-page`.
- `.drawerOverlay` (`aiSettings.module.css:709-718`): `position: fixed; inset: 0` (specificity 0,1,0).
- `.sdp-page > :not(.sdp-bg-glow)` (`StockDetailPage.css:92-95`): `position: relative; z-index: 1` (specificity 0,2,0) → THẮNG → overlay thành relative in-flow, rớt xuống cuối trang ("nhảy xuống dưới"). Khớp ảnh user báo.
- `ai-cc-uiux` có nhắc `aiSettings.module.css` nhưng ghi rõ "CHƯA claim" → S1 KHÔNG đụng file đó, chỉ sửa `StockDetailPage.tsx` (claim `stock-tpb-candle-bubble` cũ đã done, không ai giữ).

## S1 (duy nhất) — portal drawer ra `document.body`

- **SCOPE**: `packages/web/src/pages/StockDetailPage.tsx` (bọc `createPortal(..., document.body)` khi `drawerOpen`, guard theo mẫu `SocSchedulerBoard.tsx:794`), test mới `packages/web/src/pages/__tests__/stock-drawer-portal.component.test.tsx` (chép bộ mock từ `StockDetailPage.component.test.tsx:15-49`, mở drawer qua `onOpenConfigDrawer` của `StockDetailTabs` thật).
- **AC (fail-before)**: (1) đỏ trên code cũ — overlay là con của `.sdp-page`; xanh sau sửa — overlay là con trực tiếp của `document.body`. (2) Đóng drawer → overlay biến mất khỏi body. (3) Config vẫn nhận `onConfigChange` (không hỏng luồng).
- Non-goals: TPB lặp (chờ product quyết định giữ/bỏ), copy empty advisory/billing (fail-closed đúng, không sửa), mọi CSS (không đụng `aiSettings.module.css` lẫn `StockDetailPage.css`).
- LIMIT: 2 vòng.

## Gates

`node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` · `npx eslint` file chạm · `npx vitest run` suite + test mới · `npm run i18n:scan` (không thêm key). CHƯA CHẠY → ghi rõ, không PASS giả.

## MANDATORY CHECKLIST

- [ ] L-V02: fail-before trên code chưa sửa (overlay trong `.sdp-page`)
- [ ] L-V04: assert parent THẬT (`overlay.parentElement === document.body`)
- [ ] L-F12: không đổi version widget; không đụng CSS người khác đang nhắc
- [ ] L-T01: numstat sau mỗi lần ghi; giữ LF
- [ ] Verdict B3/B4 + re-audit B8 thành văn bản trước khi qua bước tiếp theo
