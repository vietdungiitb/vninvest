# Lộ trình Hoàn thiện VNInvest Workstation (v6.5 - v6.8)

Tài liệu này chi tiết các bước cuối cùng để biến Modern Dashboard từ một giao diện hiển thị dữ liệu thành một **Hệ thống điều hành đầu tư (Investment OS)** hoàn chỉnh, chuyên nghiệp và đầy đủ tính năng tương tác.

---

## Phase 6.5: Intelligent Deep Dive Drawer (Bảng Tình báo Chi tiết)
*Mục tiêu: Cung cấp thông tin chuyên sâu cho từng mã mà không làm gián đoạn luồng làm việc chính.*

- **Cơ chế**: Khi click vào bất kỳ mã cổ phiếu nào (trong Heatmap, Bảng giá, hoặc Sidebar), một Drawer sẽ trượt ra từ bên phải.
- **Nội dung hiển thị**:
    - **Technical Pulse**: Biểu đồ RSI/SMA mini và xu hướng giá trong 5-10 phiên gần nhất.
    - **Whale Campaign**: Tổng hợp các đợt lệnh lớn gần nhất của mã đó.
    - **AI Advisory Local**: Nhận định của AI dành riêng cho mã đó dựa trên tin tức và phân tích kỹ thuật hiện tại.
    - **Action Shortcuts**: Các nút lệnh nhanh: Mua/Bán (Draft), Thêm vào Watchlist, hoặc Xem biểu đồ kỹ thuật đầy đủ.

## Phase 6.6: Universal Command Center (Thanh Lệnh & Tìm kiếm)
*Mục tiêu: Khả năng soi mọi mã cổ phiếu trên thị trường ngay lập tức.*

- **Tính năng**: Thêm thanh tìm kiếm thông minh tại Header.
- **Khả năng**: 
    - Tìm kiếm bất kỳ mã nào trên sàn HOSE/HNX.
    - Soi nhanh dữ liệu (Quick View) cho mã không có trong danh mục.
    - Tích hợp phím tắt (Hotkeys) để mở nhanh các chức năng (như mở Modal Tối ưu hóa bằng phím `O`).

## Phase 6.7: High-Density UI Polish (Tinh chỉnh Giao diện Chuyên dụng)
*Mục tiêu: Tối ưu hóa mật độ thông tin và trải nghiệm Zen.*

- **Modern Holdings Table**: Thay thế bảng danh mục cũ bằng phiên bản mới có layout tinh gọn hơn, tích hợp thanh tiến trình lãi lỗ (Profit bar) và các icon trạng thái.
- **Zen Mode**: Cho phép thu gọn Sidebar hoặc Header để mở rộng diện tích Chart/Heatmap lên 100% màn hình khi cần tập trung soi mã.
- **Animation Refinement**: Thêm các hiệu ứng chuyển cảnh mượt mà khi đổi Tab hoặc mở Modal để tạo cảm giác cao cấp (Premium feel).

## Phase 6.8: Smart Notification Hub (Trung tâm Thông báo Tương tác)
*Mục tiêu: Đảm bảo không bỏ lỡ các cơ hội quan trọng.*

- **Interactive Toasts**: Thay vì chỉ ghi log vào sidebar, các tín hiệu Cá mập hoặc Hệ thống báo điểm AI vượt ngưỡng sẽ hiển thị dưới dạng pop-up nhỏ (Toast) ở góc màn hình.
- **One-click Action**: Cho phép click vào thông báo để mở ngay bảng Deep Dive của mã đó để xử lý.

---

## Definition of Done (Tiêu chuẩn Hoàn thành)
Giao diện Workstation được coi là hoàn thiện 100% khi:
1. [ ] Người dùng có thể soi chi tiết mọi mã cổ phiếu mà không cần tải lại trang.
2. [ ] Hệ thống AI không chỉ hiển thị điểm số chung mà còn gợi ý hành động cho từng mã cụ thể.
3. [ ] Không còn bất kỳ hiện tượng chồng lấn (overlap) hay cắt mất nội dung (clipping) trên mọi độ phân giải phổ biến.
4. [ ] Thời gian phản hồi khi tương tác giữa các thành phần < 100ms.

---
*Tài liệu được soạn thảo bởi VNInvest AI Assistant - Dành cho Audit v6.4+*
