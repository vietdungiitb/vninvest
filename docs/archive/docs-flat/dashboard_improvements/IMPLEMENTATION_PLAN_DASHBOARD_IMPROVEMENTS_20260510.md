# IMPLEMENTATION PLAN — Dashboard UI/UX Improvements

**Ngày**: 2026-05-10  
**Trạng thái**: APPROVED  
**Mục tiêu**: Cải thiện mật độ thông tin, tính cân đối và trải nghiệm người dùng trên Modern Dashboard.

---

## 1. Các thay đổi đề xuất (Proposed Changes)

### 1.1 Chuẩn hóa Layout & Alignment
- **[MODIFY] [index.css](file:///c:/Mujoco%20Projects/vninvest/frontend/src/index.css)**: 
  - Cập nhật `.page-body-grid` sử dụng `grid-template-columns: repeat(3, 1fr)`.
  - Đảm bảo các vertical lines thẳng hàng tuyệt đối giữa `StickyAlertBar` và các cột bên dưới.
- **[MODIFY] [ModernDashboard.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/pages/modern/ModernDashboard.jsx)**: 
  - Điều chỉnh `gap-4` và `padding` để khớp pixel-perfect giữa các thành phần.

### 1.2 Logic Cảnh báo ghim (Sticky Alert Bar)
- **[MODIFY] [StickyAlertBar.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/StickyAlertBar.jsx)**:
  - Implement logic `deduplicateBySymbol`: Nếu có nhiều cảnh báo của cùng một mã trong top 3, chỉ hiển thị cảnh báo mới nhất.
  - Đảm bảo thanh ghim luôn hiển thị 3 mã khác nhau nếu có đủ dữ liệu.

### 1.3 Tối ưu Treemap Readability
- **[MODIFY] [PortfolioHeatmap.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/PortfolioHeatmap.jsx)**:
  - Thêm logic kiểm tra diện tích ô: Nếu `width < 40px` hoặc `height < 40px`, ẩn text và chỉ hiển thị màu sắc.
  - Tích hợp Tooltip chi tiết khi hover vào các ô nhỏ.

### 1.4 Chuẩn hóa Visual & UI Polish
- **[MODIFY] [UnifiedAlertCenter.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/UnifiedAlertCenter.jsx)**:
  - Thay thế icon Cá mập bằng bộ SVG Shark chuẩn, thiết kế cao cấp hơn.
- **[MODIFY] [SmartStatsHeader.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/SmartStatsHeader.jsx)**:
  - Bo tròn nút "UserConfig" và cập nhật border/background theo style pill-tab.
  - Hiển thị `--` cho các giá trị 0/null để tránh gây nhầm lẫn về dữ liệu.
- **[MODIFY] [AIAdvisorAlertPanel.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/AIAdvisorAlertPanel.jsx)**:
  - Nâng cấp thiết kế trạng thái "Stable State" (khi không có alert) bằng card design chuyên nghiệp hơn.

---

## 2. Kế hoạch xác minh (Verification Plan)

### 2.1 Kiểm tra thủ công (Manual Checks)
1. **Vertical Alignment**: Kiểm tra bằng ruler/grid trên trình duyệt để đảm bảo các đường kẻ dọc thẳng hàng từ thẻ ghim xuống sidebar.
2. **Alert Deduplication**: Giả lập dữ liệu có nhiều alert FPT liên tiếp, xác nhận thanh ghim hiển thị các mã khác nhau.
3. **Responsive**: Đảm bảo grid 3 cột vẫn hoạt động tốt trên các màn hình LG/XL.

### 2.2 Kiểm tra tự động
- Chạy lệnh build frontend để đảm bảo không có lỗi cú pháp/CSS.

---

## 3. Log thực hiện
- 2026-05-10: Khởi tạo kế hoạch dựa trên audit report.
