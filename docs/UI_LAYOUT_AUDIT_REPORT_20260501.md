# VNInvest - UI/UX Audit Report (Layout Template V1 Compliance)

**Ngày thực hiện**: 2026-05-01  
**Trạng thái**: CẦN HIỆU CHỈNH (REQUIRED REMEDIATION)  
**Tài liệu đối chiếu**: [PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md](file:///c:/Mujoco%20Projects/vninvest/docs/PROJECT_UI_LAYOUT_TEMPLATE_V1_20260421.md)

---

## 1) Tổng quan kết quả Audit

Hiện tại, phần lớn các trang chính (Whale Alerts, Stock Detail, Watchlist, Legacy Dashboard) đều **chưa tuân thủ đầy đủ** các quy tắc trong Template V1. Các trang này vẫn đang sử dụng hệ thống spacing và layout tự phát (ad-hoc) hoặc kế thừa từ các phiên bản cũ.

### Các vi phạm phổ biến (Global Anti-patterns):
- **Bố cục wrapper**: Không sử dụng class chuẩn `.app-page-shell`, dẫn đến việc `max-width` và `padding` không đồng nhất giữa các trang (1500px vs 1800px).
- **Header Contract**: Header trang không được bọc trong `<header className="page-header">`, sử dụng các thẻ `section` hoặc `div` với padding/margin tùy ý.
- **Màu sắc Semantic**: Một số nơi vẫn hard-code màu (ví dụ: `text-green-400`, `text-red-400`) thay vì dùng token `--accent-emerald` và `--accent-rose`.
- **Spacing**: Sử dụng `space-y-4`, `space-y-6` của Tailwind thay vì các biến `--space-1` đến `--space-8`.

---

## 2) Chi tiết từng trang

### A. Whale Alerts Dashboard (`WhaleAlertsDashboard.jsx`)
- **Vi phạm Layout**: Wrapper dùng `max-w-[1800px]` (đúng về giá trị nhưng sai về cách dùng token) và `p-4 xl:px-5`.
- **Vi phạm Header**: Dùng `section className="card-section"` thay vì `page-header`.
- **Vi phạm Grid**: Grid chính dùng `xl:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_340px]` thay vì tỉ lệ 22% - 39% - 39% chuẩn.
- **Ghi chú**: Đây là trang gần với chuẩn nhất nhưng vẫn cần bọc lại bằng các class utility trong template.

### B. Stock Detail (`StockDetail.jsx`)
- **Vi phạm Layout**: Wrapper dùng `mx-auto max-w-[1800px] space-y-4 p-4`.
- **Vi phạm Spacing**: Khoảng cách giữa các module không đồng nhất, một số chỗ dùng `mt-3`, `mt-4`.
- **Vi phạm Grid**: Tương tự Whale Alerts, grid 3 cột chưa đúng tỉ lệ phần trăm quy định.
- **Vi phạm Component**: Các card/section bên trong dùng `card-section` thay vì `page-panel`.

### C. Watchlist / Radar (`Watchlist.jsx`)
- **Vi phạm Layout**: Sử dụng cấu trúc `flex gap-6` tự chế cho sidebar và content thay vì `page-body-grid`.
- **Vi phạm Typography**: Font size cho các label và title chưa đồng bộ với scale trong template.
- **Vi phạm Color**: Sử dụng rất nhiều hard-code màu Tailwind (`text-brand-500`, `text-blue-700`, `text-gray-600`) thay vì hệ thống token của dự án.
- **Anti-pattern**: Sidebar trái tự đặt padding và style riêng, không kế thừa từ shell chung.

### D. Legacy Dashboard (`LegacyDashboard.jsx`)
- **Vi phạm Layout**: `max-w-[1500px]` (quá hẹp so với quy định 1800px).
- **Vi phạm Header**: Title dùng `text-lg font-bold` thay vì class `page-title`.
- **Vi phạm Spacing**: Dùng `space-y-6 px-5 py-6` (vi phạm quy tắc P0 về chuẩn hóa top spacing).

---

## 3) Đề xuất lộ trình khắc phục (Remediation Roadmap)

Dựa trên tài liệu V1, chúng ta cần thực hiện theo các bước:

1. **P0 (Ngay lập tức)**: Bọc lại wrapper của tất cả các trang bằng `.app-page-shell` và chuẩn hóa `<header className="page-header">`. Loại bỏ các `pt-` và `mt-` thừa ở đầu trang.
2. **P1 (Cấu trúc Grid)**: Chỉnh sửa các grid 3 cột về đúng tỉ lệ `minmax(320px, 22%) minmax(420px, 39%) minmax(420px, 39%)`.
3. **P2 (Tokenization)**: Thay thế toàn bộ màu hard-code và spacing Tailwind bằng các biến CSS chuẩn trong `index.css`.
4. **P3 (Component Audit)**: Cập nhật các component `Card`, `Button`, `Input` để sử dụng đúng radius và shadow tokens.

---

## 4) Checklist kiểm tra nhanh cho Developer:
- [ ] Trang có dùng `<div className="app-page-shell">` làm root không?
- [ ] Header có dùng `<header className="page-header">` không?
- [ ] Khoảng cách từ Top Nav đến Header có đúng `var(--layout-content-pad-y)` không?
- [ ] Có màu nào đang hard-code (#... hoặc Tailwind color) không?
- [ ] Các module có trạng thái Loading/Empty/Error theo chuẩn không?
