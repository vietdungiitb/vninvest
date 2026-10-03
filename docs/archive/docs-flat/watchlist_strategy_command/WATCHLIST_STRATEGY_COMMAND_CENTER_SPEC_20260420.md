# Tài liệu Đặc tả: Watchlist Strategy Command Center

📅 **Ngày lập**: 2026-04-20
🎯 **Mục tiêu**: Nâng cấp trang Watchlist hiện tại thành một "Trung tâm điều hành chiến thuật" mạnh mẽ, tập trung vào cá nhân hóa và quản lý tiêu chí riêng của người dùng.

---

## 1. Triết lý thiết kế: "Personalization First"

Trang Watchlist không chỉ là nơi xem giá, mà là nơi người dùng thực thi các chiến thuật cá nhân. Mọi nâng cấp phải đảm bảo:
- **Bảo toàn 100% tính năng quản lý**: Thêm/xóa mã, chia nhóm, thiết lập cảnh báo giá và ngưỡng Whale cá nhân.
- **Tối ưu hóa khả năng ra quyết định**: Cung cấp thêm bộ lọc kỹ thuật và chỉ báo trực quan trên chính danh mục người dùng đã chọn.
- **Hiệu suất "Zero Lag"**: Xử lý dữ liệu streaming mượt mà cho danh sách lên đến 120+ mã.

---

## 2. Các Tính năng Nòng cốt & Nâng cấp

### 2.1 Quản lý Danh mục & Tiêu chí Cá nhân
- **Nhóm Chứng khoán (Groups)**: Giữ nguyên hệ thống phân loại theo Ngành, Vốn hóa và Nhóm Tùy chỉnh (Custom).
- **Ngưỡng Whale Riêng (Personal Whale Threshold)**: Tiếp tục hỗ trợ việc thiết lập ngưỡng VND riêng cho từng mã trong Watchlist (ghi đè ngưỡng Global của User).
- **Cảnh báo giá (Price Alerts)**: Nâng cấp giao diện quản lý cảnh báo giá, cho phép highlight trực tiếp dòng cổ phiếu khi đạt target.

### 2.2 Hệ thống Bộ lọc Tiêu chí Nâng cao (Advanced Criteria)
Đây là nâng cấp trọng tâm giúp hiện thực hóa khái niệm "Tiêu chí riêng":
- **Lọc theo Kỹ thuật**: Người dùng có thể lọc danh sách cá nhân của mình theo:
    - RSI (ví dụ: Chỉ hiện các mã đang quá bán < 30).
    - Khoảng cách MA (ví dụ: Các mã đang chạm đường MA20).
    - Đột biến khối lượng (RVOL > 2.0).
- **Lọc theo Trạng thái dữ liệu**: Gainers, Losers, Flat, Synced, Stale.

### 2.3 Hiển thị Kỹ thuật Trực quan (Smart Radar View)
- **Cột chỉ báo**: Tích hợp thêm các cột RSI, RVOL, MA20_Dist ngay trong bảng.
- **Mini-Sparklines**: Biểu đồ đường xu hướng 24h siêu nhỏ cho từng dòng.
- **Biểu tượng Whale/Shark**: Hiển thị icon cá mập/cá voi ngay cạnh mã chứng khoán khi có giao dịch lớn khớp với ngưỡng cá nhân của người dùng.

---

## 3. Kiến trúc Kỹ thuật (Refactoring Strategy)

Để giải quyết vấn đề file `Watchlist.jsx` quá lớn (2000+ dòng), chúng ta sẽ thực hiện tái cấu trúc:

### 3.1 Cấu trúc Component Mới
- **`WatchlistPage`**: Component cha quản lý state tổng và điều phối dữ liệu.
- **`useWatchlistProcessor`**: Custom hook xử lý toàn bộ logic tính toán, lọc tiêu chí và sắp xếp.
- **`WatchlistManagementPanel`**: Chứa Form thêm mã, nút Sync giá, Bulk actions.
- **`PriceAlertPanel`**: Module quản lý và theo dõi các Alert giá.
- **`SmartRadarTable`**: Table hiển thị hiệu suất cao, tối ưu render cho dữ liệu streaming.

### 3.2 Backend Enrichment
- Mở rộng payload của `ticker_update` để bao gồm các giá trị kỹ thuật tiền tính toán (pre-computed indicators) nhằm giảm tải CPU cho trình duyệt.

---

## 4. Lộ trình Thực hiện (Refined Roadmap)

1. **Giai đoạn 1 (Architecture)**: Tái cấu trúc file `Watchlist.jsx` thành các module, xây dựng `useWatchlistProcessor`.
2. **Giai đoạn 2 (Logic & Data)**: Nâng cấp Backend để gửi indicators và tích hợp bộ lọc "Tiêu chí riêng" vào UI.
3. **Giai đoạn 3 (Experience)**: Triển khai hiệu ứng Glow/Flash, Sparklines và Premium UI.

---

> [!IMPORTANT]
> Mục tiêu cuối cùng là giúp người dùng trả lời câu hỏi: "Trong số 50 mã tôi đang theo dõi, mã nào đang thỏa mãn tiêu chí kỹ thuật để tôi có thể giải ngân ngay lúc này?"
