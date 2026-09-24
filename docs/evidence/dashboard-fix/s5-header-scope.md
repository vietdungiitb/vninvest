# S5.3 — Phạm vi header (ghi rõ để khỏi hỏi lại)

Header trong ảnh (breadcrumb `VNInvest / dashboard`, search, `Online`, `VN VI`, chuông, avatar)
thuộc **app shell** (FullLayout), không thuộc `DashboardPage.tsx` (bắt đầu từ stats slot, dòng 333).

## Đã làm trong phạm vi DashboardPage
- Bell/badge trong lane: badge unread + `title="{count} chưa đọc"` (`UnifiedAlertCenter.js:192-193`),
  link `Xem tất cả →` tới `/alert-center` (route `routeCatalog.js:77-78`).
- Breadcrumb/search shell: OUT-OF-SCOPE — không chạm behavior tìm kiếm hay layout shell.

## Severity duy nhất ở viền trái (S5.4)
- Dashboard: `severityCardStyles` border-l theo severity (`UnifiedAlertCenter.js:26-42` giữ nguyên);
  chip category (Cá mập/Dark flow/…) về trung tính `bg-slate-800 text-slate-300` (S2.2).
- Whale-alerts page (`AlertCenterPage.tsx` + `AlertCard.js`): chưa đổi trong task này (ngoài danh sách §8);
  follow-up riêng nếu cần đồng bộ.
