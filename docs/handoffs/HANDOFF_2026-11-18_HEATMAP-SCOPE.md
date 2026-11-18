# HANDOFF — Heatmap scope bugfix (2026-11-18)

- **Phạm vi**: Sau khi deploy wave 2, owner báo heatmap hiện **1833 mã** (toàn thị trường) thay vì mã theo dõi. Root cause: `watchlistGroups` là `CachedSymbolGroup` (nhóm hệ thống), wave 2 đưa vào universe.
- **Branch / commit**: `feat/dash-heatmap-scope` · base `dev @ b83718ef9` · claim `?` → code `0debe3e3c`.
- **Trạng thái**: **done** — B3 NEED_REVISION → B4 PASS → B8 AGREE; visual QA thật trên staging với ảnh đã mở.

## Kết quả

- `constants/marketGroups.ts`: `isSystemMarketGroup` lọc theo `group_type` + fallback slug NFD.
- `useCoreDashboardData.js`: `filterUserWatchlistGroups` lọc trước `setState` ⇒ heatmap, deck, bulk technicals chỉ nhận mã user.
- Heatmap từ **1833 → 5 mã** (xem `docs/evidence/dashboard-uiux/dashboard-scope-1280x900.png`). Popover Q4 mở/Escape đóng xác nhận (`dashboard-popover.png`).
- VPS: 197 file/1304 test, 5 fail SSE baseline, 0 hồi quy; build exit 0.
- Evidence: `docs/evidence/dashboard-uiux/gates-heatmap-scope.md`, `REAUDIT_HEATMAP_SCOPE_B8.md`, `AUDIT_HEATMAP_SCOPE_B3.md`, plan tương ứng.

## Next / Owner

1. Merge PR vào `dev`, restore staging về `dev` (`bash scripts/deploy-staging.sh`).
2. Follow-up (không chặn): kênh `watchlists` ở `useCoreDashboardData.js:163-166` vẫn slug không bỏ dấu — có thể lọt nhóm hệ thống nếu tên có dấu; gom vào ticket riêng cùng `WatchlistContext.tsx:239,338`.
3. E2E/a11y/jest vẫn CHƯA CHẠY.
