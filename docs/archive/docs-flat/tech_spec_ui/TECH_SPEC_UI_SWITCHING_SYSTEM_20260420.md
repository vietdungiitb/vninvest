# Thông số kỹ thuật: Hệ thống Giao diện Hybrid & Modern v6.0

Tài liệu này chi tiết các đặc tính kỹ thuật để triển khai bộ khung giao diện mới mà không ảnh hưởng đến code cũ.

---

## 1. InterfaceContext & State Persistence

### Quản lý trạng thái
- **Namespace**: `vninvest_ui_pref`
- **Giá trị**:
  - `legacy`: Hiện tại (Full vertical scroll).
  - `modern`: Mới (Workstation 65/35).
- **Persistence**: Sử dụng `localStorage`. Khi khởi tạo, Context sẽ kiểm tra giá trị này; nếu trống, mặc định là `legacy`.

### Chuyển đổi (Transition)
- Sử dụng hiệu ứng `fade-in` nhẹ (CSS Transitions) để việc chuyển đổi không gây cảm giác bị "giật" màn hình.

---

## 2. Component: ModularPositionDeck

Đây là linh hồn của giao diện mới, thay thế bảng Holdings đơn thuần.

### Cấu trúc Tabs
1. **Tab "Tổng quan"**:
   - Dữ liệu: Lấy từ `HoldingsTable.jsx` hiện tại.
   - Hiển thị: Mã, Số lượng, Lãi/Lỗ, Giá trị hiện tại.
2. **Tab "Kỹ thuật"**:
   - Dữ liệu thêm: RSI, MA, Volatility (từ backend) + Sparklines 24h.
3. **Tab "Cá mập (Flow)"**:
   - Dữ liệu: Lọc từ `useRealtimeFeed.alerts` chỉ lấy các cảnh báo liên quan đến các mã trong danh mục.

---

## 3. Hệ thống Layout Grid (Modern Mode)

Sử dụng CSS Grid để tối ưu hóa không gian hiển thị "Above the fold".

```css
.modern-dashboard-layout {
  display: grid;
  grid-template-columns: 65% 35%;
  grid-template-rows: auto 1fr;
  grid-template-areas: 
    "header header"
    "main side";
  height: calc(100vh - header-height);
}
```

- **Vùng Main (65%)**: Phân bổ 50/50 chiều cao giữa Biểu đồ (Heatmap/Curve) và Danh sách mã (Modular Deck).
- **Vùng Side (35%)**: Cố định (Fixed) hoặc cho phép cuộn nội bộ để theo dõi Alerts Stream liên tục.

---

## 4. Analytics & AI Modules

### Risk Metrics Module
- Hiển thị bảng 2 cột:
  - Chỉ số: Alpha, Beta, Sharpe, MaxDD, Volatility.
  - Giá trị: (Lấy từ API Portfolio Analytics).

### AI Digest Module
- Sử dụng dữ liệu từ `PortfolioNewsDigest` model.
- Hiển thị danh sách các "Bullet points" nhận định nhanh.

---

## 5. Danh sách các file mới dự kiến tạo
- `src/context/InterfaceContext.jsx`
- `src/pages/modern/ModernDashboard.jsx`
- `src/components/modern/SmartStatsHeader.jsx`
- `src/components/modern/ModularPositionDeck.jsx`
- `src/components/modern/PerformanceAnalytics.jsx`

---

> [!IMPORTANT]
> **Xác nhận**: Tôi đã sẵn sàng về mặt lý thuyết cho tất cả các thành phần trên. Tôi sẽ chỉ bắt đầu khởi tạo file code khi nhận được lệnh "BẮT ĐẦU" từ bạn.
