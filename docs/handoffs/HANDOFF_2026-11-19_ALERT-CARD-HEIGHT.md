# HANDOFF — Alert card height E2E regression (2026-11-19)

- **Phạm vi**: Sau P1-7, E2E staging `dashboard-alert-probe.spec.ts` fail 2 case — card cảnh báo 138px, vượt contract 100/110px.
- **Branch / commit**: `feat/dash-alert-card-height` · base `dev @ 69141ab93` · fix `00f37df3b`.
- **Trạng thái**: **done** — E2E 3/3 xanh, VPS 197/1304 (5 fail SSE baseline), build 0.

## Kết quả

- `UnifiedAlertCenter.js`: action buttons (đọc/tắt 30p) chuyển thành overlay `absolute`, hiện hover/focus-within — không chiếm chiều cao; vẫn focusable & có accessible name.
- Đo sau fix: `firstCardH = 96px`, `overlapY = 0`, `cardCount = 5`.
- Evidence: `docs/evidence/dashboard-uiux/gates-alert-card-height.md`.

## Next / Owner

1. Merge PR → `dev`, restore staging về `dev`.
2. **a11y runtime CHƯA XÁC MINH**: gate báo staging build khác hash baseline (`adapters-CqPqhZ1i.js` vs `BLMSU645.js`) ⇒ 67 "violation mới", chủ yếu `ai-advisory`/`screener`; chỉ 1 trên `/dashboard` là `<h1>` sidebar có sẵn. Cần owner re-baseline a11y trên build mới — không phải regression của slice này.
3. ⚠ **Vệ sinh index**: agent khác đang làm trong cùng main tree; commit đầu tiên đã kéo nhầm file của họ, đã tách & khôi phục blob từ `dev` mà không đè working copy. Slice sau nên dùng **worktree riêng**.
4. E2E suite đầy đủ & jest (7 fail auth module có sẵn trên `dev@577ddf646`) — CHƯA CHẠY.
