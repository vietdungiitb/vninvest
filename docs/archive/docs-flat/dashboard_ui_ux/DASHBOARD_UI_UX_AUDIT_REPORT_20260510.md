# DASHBOARD UI/UX AUDIT REPORT — Modern Dashboard Improvements

**Ngày thực hiện**: 2026-05-10  
**Đối tượng**: `ModernDashboard.jsx`  
**Trạng thái**: COMPLETED

---

## 1. Tổng quan thiết kế
Dashboard hiện tại sử dụng ngôn ngữ thiết kế **Premium Dark Mode**, tích hợp các thành phần Glassmorphism và Agentic UI. Tuy nhiên, qua quá trình audit thực tế trên giao diện runtime, đã phát hiện một số vấn đề về mật độ thông tin và sự cân đối của layout.

---

## 2. Các phát hiện chính (Key Findings)

### 2.1 Bố cục và Căn chỉnh (Layout & Alignment)
- **Vấn đề**: Cột thứ 3 (Sidebar/AI Alerts) đang có chiều rộng không tương xứng với 2 cột bên trái (tỷ lệ 35/35/30). Điều này gây ra sự lệch trục dọc so với 3 thẻ cảnh báo ghim phía trên (đang chia đều 33.3%).
- **Hệ quả**: Luồng thị giác bị đứt gãy, các đường kẻ dọc không thẳng hàng từ trên xuống dưới, tạo cảm giác khung hình bị lệch.

### 2.2 Hiển thị Cảnh báo ghim (Sticky Alert Bar)
- **Vấn đề**: Khi có nhiều biến động liên tiếp từ một mã (ví dụ: FPT), thanh cảnh báo ghim chiếm dụng cả 3 slot cho cùng một mã chứng khoán.
- **Hệ quả**: Người dùng bị "tràn ngập" thông tin của một mã và bỏ lỡ các tín hiệu quan trọng từ các mã khác trong danh mục.

### 2.3 Độ chi tiết biểu đồ (Treemap Readability)
- **Vấn đề**: Biểu đồ Treemap "Theo dõi dòng tiền" khi hiển thị danh mục lớn sẽ tạo ra các ô quá nhỏ. Text bên trong bị cắt xén (ví dụ: `VJC 0.0...`) hoặc chồng chéo.
- **Hệ quả**: Giảm khả năng đọc nhanh và tính chuyên nghiệp của biểu đồ.

### 2.4 Tính nhất quán về Visual (Icon & UI Polish)
- **Vấn đề 1**: Icon "Cá mập" (Whale) đang sử dụng icon mặc định, chưa đạt độ cao cấp (premium) theo tiêu chuẩn Whale Intelligence.
- **Vấn đề 2**: Nút "UserConfig" ở Header có style chưa đồng bộ hoàn toàn với các pill-tabs điều hướng.
- **Vấn đề 3**: Trạng thái dữ liệu trống (Empty states) còn đơn điệu, hiển thị số `0` hoặc `--` thiếu tính hướng dẫn.

---

## 3. Khuyến nghị (Recommendations)

1. **Chuẩn hóa Grid 3 cột**: Chuyển toàn bộ Layout sang hệ thống 3 cột bằng nhau (1/3 mỗi cột) để đảm bảo căn chỉnh dọc hoàn hảo.
2. **Deduplication Alerts**: Implement logic lọc trùng mã chứng khoán trên thanh ghim, chỉ hiển thị alert mới nhất cho mỗi mã.
3. **Smart Labeling cho Treemap**: Chỉ render text khi ô đủ lớn, kết hợp tooltip thông minh.
4. **Standardize Whale Icon**: Thay thế bằng bộ icon Shark SVG chuẩn của dự án.
5. **UI Refinement**: Đồng bộ style các nút điều khiển và nâng cấp thiết kế các trạng thái "Empty data".

---

## 4. Kế hoạch thực thi
Chi tiết xem tại: `docs/IMPLEMENTATION_PLAN_DASHBOARD_IMPROVEMENTS_20260510.md`
