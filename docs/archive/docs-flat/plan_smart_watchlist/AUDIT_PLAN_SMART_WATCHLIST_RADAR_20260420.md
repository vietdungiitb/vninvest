# Tài liệu Audit & Kế hoạch Nâng cấp: Smart Watchlist Radar (v1.0)

📅 **Ngày lập**: 2026-04-20
👤 **Người thực hiện**: Antigravity AI
🎯 **Mục tiêu**: Nâng cấp tính năng Watchlist đạt tiêu chuẩn quốc tế, giàu thông tin và giao diện "Bloomberg-style".

---

## 1. Kết quả Audit Chi tiết

### 1.1 UI/UX & Thẩm mỹ (Trạng thái: Cơ bản)
- **Phản hồi Real-time**: Thiếu các hiệu ứng thị giác tức thời khi giá thay đổi (chưa có hiệu ứng "flash" xanh/đỏ).
- **Mật độ thông tin**: Giao diện hiện tại còn quá "thoáng" (airy). Tiêu chuẩn quốc tế ưu tiên mật độ cao để người dùng theo dõi được >50 mã cùng lúc mà không cần scroll nhiều.
- **Micro-Animations**: Thiếu các tương tác nhỏ giúp ứng dụng cảm giác "sống động" (alive).
- **Bảng màu**: Sử dụng màu Tailwind mặc định, chưa toát lên vẻ chuyên nghiệp, cao cấp của các phần mềm tài chính chuyên dụng.

### 1.2 Độ giàu thông tin (Trạng thái: Hạn chế)
- **Dữ liệu thị trường**: Hiện chỉ hiển thị Giá, Thay đổi, % Thay đổi.
- **Thiếu chỉ báo kỹ thuật**: RSI(14), Khoảng cách tới MA20/MA50, và RVOL (Relative Volume) là các cột bắt buộc đối với trader chuyên nghiệp.
- **Thiếu dữ liệu cơ bản**: Vốn hóa (Market Cap), Nhóm ngành, và P/E chưa được hiển thị nhanh.
- **Hiệu suất lịch sử**: Chưa có các cột hiệu suất 1 tuần, 1 tháng hoặc YTD (Year-to-Date).

### 1.3 Tính năng & Luồng công việc (Trạng thái: Tiêu chuẩn)
- **Điều hướng**: Việc chuyển đổi giữa "Mã Theo dõi" và "Nhóm thị trường" còn tốn nhiều click.
- **Tích hợp biểu đồ**: Chưa có tính năng "click-to-chart" hoặc "click-to-advisory" mượt mà ngay trong bảng.
- **Cảnh báo**: Hệ thống cảnh báo giá hoạt động tốt nhưng chưa được tích hợp trực quan vào dòng của mã chứng khoán.

---

## 2. Checklist Tiêu chuẩn Quốc tế (Standard of Care)

| Tiêu chuẩn | Trạng thái hiện tại | Yêu cầu cải thiện |
| :--- | :---: | :--- |
| **Trạng thái Real-time** | [x] | Thêm chỉ báo độ trễ (latency ping) và cảnh báo dữ liệu cũ (stale). |
| **Tính toàn vẹn dữ liệu** | [x] | Hiển thị rõ thời điểm đồng bộ cuối cùng (Last Sync). |
| **Khả năng tiếp cận (WCAG)** | [/] | Tăng cường điều hướng bằng bàn phím và chế độ tương phản cao. |
| **Hiệu suất Rendering** | [ ] | Áp dụng Virtualization cho danh sách >100 mã để tránh lag UI. |
| **Phân cấp thị giác** | [/] | Phân biệt rõ các chỉ số chính (Giá) và chỉ số phụ (Khối lượng). |

---

## 3. Đề xuất Cải tiến "Smart Radar"

### Giai đoạn A: Thẩm mỹ & Tương tác (Wow Factor)
- **Real-time Glow**: Các ô giá sẽ nhấp nháy (pulse) Xanh/Đỏ mỗi khi có tick dữ liệu mới.
- **Neon Glassmorphism**: Sử dụng phong cách kính mờ với viền neon sắc nét (#00FFBB cho tăng, #FF3344 cho giảm).
- **Density Controls**: Thêm nút chuyển đổi giữa chế độ "Compact" (Gọn) và "Comfortable" (Thoáng).

### Giai đoạn B: Siêu nạp thông tin (Information Super-Charge)
- **Cột chỉ báo động**: Thêm các cột RVOL (Volume tương đối), RSI(14), và % Cách MA20.
- **Mini-Sparklines**: Biểu đồ xu hướng giá trong ngày dạng mini (SVG) ngay trong ô của bảng.
- **Tích hợp Whale Alert**: Hiển thị icon trạng thái "Cá mập đang gom/xả" trực tiếp trên dòng của mã đó.

### Giai đoạn C: Tái cấu trúc (Structural Refactoring)
- **Component Hóa**: Tách file `Watchlist.jsx` (hiện >2000 dòng) thành các component nhỏ: `WatchlistTable`, `WatchlistSidebar`, `PriceAlertPanel`.
- **Tối ưu Hook**: Cải tiến `useRealtimeFeed` để xử lý lưu lượng dữ liệu lớn với mức tiêu thụ CPU thấp nhất.

---

## 4. Kế hoạch Triển khai Kỹ thuật

### Bước 1: Refactor UI Foundation
- Cập nhật `index.css` với các animation keyframes cho hiệu ứng Flash giá.
- Xây dựng hệ thống Design Tokens cho bảng màu Neon Dark.

### Bước 2: Xây dựng Smart Radar Table
- Phát triển component `WatchlistRealtimeTable.jsx` hỗ trợ sort đa cấp và sticky header.
- Thêm logic tính toán RSI và MA20 trên frontend dựa trên dữ liệu lịch sử (fetching OHLCV 30 ngày gần nhất).

### Bước 3: Tích hợp Hệ sinh thái
- Kết nối click event từ Watchlist sang `StockDetail workspace` và `Whale Advisory`.
- Hiển thị P&L nhanh nếu mã đó đang có trong Portfolio của người dùng.

---

## 5. Câu hỏi Thảo luận
1. **Dữ liệu Kỹ thuật**: Chúng ta nên tính RSI/MA ở Frontend (nhanh, dễ triển khai ngay) hay đẩy về Backend worker (chính xác tuyệt đối, tiết kiệm ram client)?
2. **Ưu tiên**: Anh muốn tập trung vào việc hiển thị nhiều mã hơn (Density) hay hiển thị nhiều loại thông tin hơn (Richness) trước?

> [!TIP]
> Một giao diện Watchlist chuyên nghiệp không chỉ là nơi xem giá, mà là một **Radar** giúp nhận diện cơ hội trong chưa đầy 3 giây nhìn vào bảng.
