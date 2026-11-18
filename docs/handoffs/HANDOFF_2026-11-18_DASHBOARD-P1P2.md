# HANDOFF — Dashboard wave 2: P1+P2 + Q4 (2026-11-18)

- **Phạm vi**: 7 mục P1 + 5 mục P2 + Q4 (kích hoạt popover Heatmap). Owner chốt làm toàn bộ sau khi P0 merge.
- **Branch / commit**: `feat/dash-p1p2-uiux` · base `dev @ 6aa570fa2` · `013c9ac77` (claim) · `c2a06706d` (code) · `261d7ef2a` (fix router) · evidence commit tiếp theo.
- **Trạng thái**: **done** (claim → done; Entry 529). B3 NEED_REVISION → B4 AGREE; B8 AGREE, 0 blocker/major code.

## Kết quả + evidence

| Nhóm | Kết quả | Evidence |
|---|---|---|
| A | filter pills wrap; body không lặp title; SPA Link + 4 prop read/mute | `src/components/dashboard/UnifiedAlertCenter.js`, `src/pages/DashboardPage.tsx` |
| B | heatmap header/subtitle; `--dash-chrome`; popover Q4; sunburst `isOther`; ECharts resize | `src/components/dashboard/PortfolioHeatmap.js`, `src/index.css`, `src/hooks/useChartResize.js` |
| C | Bell/status thật; breadcrumb/flag/search; sticky offset | `src/layouts/full/vertical/header/Header.tsx`, `src/context/RealtimeContext.js` + `.d.ts`, `SmartStatsHeader.js` |
| D | AI panel flash/dead button; deck i18n + link mã | `src/features/dashboard/AIAdvisorAlertPanel.js`, `CoreDashboardPositionDeck.tsx`, 4 file locale |
| E | breadth, watchlistGroups, status label | `src/utils/dashboardBreadth.js`, `DashboardPage.tsx` |

- Plan: `docs/PLAN_DASHBOARD_P1P2_20261118.md` · audit plan `docs/evidence/dashboard-uiux/AUDIT_PLAN_P1P2_B3.md` · re-audit `REAUDIT_P1P2_B8.md`.
- TDD: **14 RED → xanh**; VPS full suite **196 file / 1299 test · 5 fail SSE có sẵn trên dev** ⇒ 0 hồi quy; build exit 0. Chi tiết + CHƯA CHẠY: `docs/evidence/dashboard-uiux/gates-p1p2.md`.

## Next steps / Owner

1. Merge PR vào `dev` (merge-commit), chạy `agent-cleanup.ps1`.
2. **Bắt buộc để đóng P1-4 về mặt thị giác**: chụp/đo viewport cao ~900px trên staging, mở ảnh xem, xác nhận legend + tile đáy nằm trong khung nhìn; nếu `--dash-chrome: 296px` lệch thì chỉnh số đo và cập nhật `gates-p1p2.md` §4. Hiện số này mới là ước lượng từ CSS constants.
3. E2E `/dashboard` + `/alert-center`, a11y runtime cho dropdown/popover, `npm run test` (jest) — **CHƯA CHẠY**.
4. Không deploy branch lên shared staging khi chưa có coordinator chốt (staging đang chạy `dev @ 7a0bd7aa7`).
