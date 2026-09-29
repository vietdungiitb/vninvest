# S0 baseline — Dashboard audit fix (2026-09-21)

## Route SSOT
- `packages/web/src/app/routeCatalog.js:47-52` — id `dashboard`, path `/dashboard`.
- Triad render tại `packages/web/src/pages/DashboardPage.tsx:351-414`.

## Truy nguồn `14/12/24` (S0.2) — KẾT LUẬN: STALE-ARTIFACT
- Grep `14/12/24` toàn repo: 0 hit trong source (chỉ hit trong docs plan/ledger này).
- `packages/web/src/components/dashboard/SmartStatsHeader.js:91-124` (bản trước fix): không render date nào;
  breadth render `${up}/${flat}/${down}` (dòng 108 cũ).
- Không tồn tại file `frontend/src/components/modern/SmartStatsHeader.*` render date (chỉ có import tại
  `ModernDashboard.jsx:9`, file nguồn chưa xác minh — ngoài phạm vi SSOT).
- Quyết định L4 giữ nguyên: thay bằng `Cập nhật HH:mm` + badge stale (S1.4), không block.

## Số đo từ code (đối chiếu audit #1)
| Audit ảnh | Code | Kết luận |
|---|---|---|
| Header ~100px | Header thuộc shell ngoài DashboardPage | Ngoài phạm vi, không chạm |
| KPI ~115px | `SmartStatsHeader.js` `px-6 py-2`, 1 hàng | Ảnh gồm shell+padding; đã gọn CTA rỗng (S1.3) |
| Cột 507/761/507px | `index.css` grid `1fr 1.5fr 1fr` (~28.5/43/28.5%) | Khớp tỉ lệ audit 27/41/27 — giữ ratio (L2) |
| Card ~202px | `UnifiedAlertCenter.js` `p-4` + 4 chips 2 hàng | Đã gọn `p-3` + head/meta 2 dòng (S2.2), mục tiêu 88–110px |
| Lane 580px cố định | `index.css` `.dashboard-triad-lane height:580px` | Đổi `height:100%` + grid `clamp(480px, 100dvh-320px, 720px)` + breakpoints (S4) |
