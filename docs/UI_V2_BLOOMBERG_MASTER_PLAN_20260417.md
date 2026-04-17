# VNInvest UI V2: Bloomberg-style High-Density Architecture

**Version**: 2.0 (Proposed 2026-04-17)  
**Goal**: Chuyển đổi toàn bộ hệ thống sang giao diện mật độ cao, chuyên nghiệp, tối ưu hóa cho việc theo dõi dữ liệu thời gian thực và tín hiệu AI.

---

## 1. Global Layout Template (Hệ khung giao diện)

Tất cả các trang trong hệ thống phải tuân thủ khung `UnifiedLayout` chuẩn hóa:

### A. Sidebar (Cột cố định bên trái) - 260px
- **Top**: Logo VNInvest + Portfolio Switcher (Dropdown).
- **Middle**: **Quick Watchlist** (Sử dụng dữ liệu Watchlist của người dùng).
    - Hiển thị danh sách mã dạng thẻ nhỏ.
    - Thông tin: Mã CP, Giá hiện tại, % Biến động (Color-coded).
    - WebSocket: Phải được push dữ liệu thời gian thực liên tục.
- **Bottom**: Phím tắt "Bảng giá trực tiếp" + User Identity.

### B. Top Navigation (Thanh điều hướng trên) - 64px
Sử dụng cấu trúc gom nhóm (Grouped Tabs) để tối ưu không gian:
1.  **Tổng quan**: Liên kết tới Dashboard V2.
2.  **Tín hiệu & Whale** (Dropdown): AI Advisory, Whale Alerts, Radar thị trường.
3.  **Danh mục** (Dropdown): Giao dịch (Transactions), Quản lý Danh mục, Theo dõi (Watchlist).
4.  **Hệ thống** (Dropdown): Screener, Cấu hình (Settings), Admin Ops.

---

## 2. Page Template: Dashboard V2 (Trang mẫu chuẩn)

Dashboard được chia thành 3 tầng chức năng chính:

### Tầng 1: Thanh trạng thái (Consolidated Alert Bar)
- Chiều cao thấp, hiển thị các ô tóm tắt số lượng cảnh báo theo mức độ (Nghiêm trọng, Cao, Trung bình...).
- Cho phép cuộn ngang các mã có biến động cảnh báo mạnh nhất.

### Tầng 2: Khu vực Trung tâm (Main Grid) - 3:1 Split
- **Bên trái (3/4)**: **Unified Alert Center**. 
    - Feed tín hiệu chi tiết từ Dark Money và Whale alerts.
    - Thiết kế dạng danh sách Card có mật độ thông tin cao.
- **Bên phải (1/4)**: **Portfolio Analytics Sidebar**.
    - Xếp chồng các Widget: Allocation Pie, Equity Curve, Mini Heatmap.

### Tầng 3: Chân trang (Metrics Bar)
- Hiển thị 4-6 StatCards khổ lớn cho các chỉ số tài chính cốt lõi (NAV, P/L, Dividends...).

---

## 3. Quy chuẩn Design & Aesthetics
- **Theme**: Dark mode (Gray-950 background, Gray-900 boxes).
- **Accent Colors**: 
    - Emerald-500 cho tăng trưởng/mua.
    - Red-500 cho giảm/bán/cảnh báo nghiêm trọng.
    - Blue/Indigo cho các tab điều hướng.
- **Micro-interactions**: Các thành phần dữ liệu (Giá, % Change) phải có hiệu ứng nhấp nháy (Flash) khi cập nhật dữ liệu từ WebSocket.

---

## 4. Đặc tả Kỹ thuật (Technical Specification)

Để đảm bảo hiệu năng và tính nhất quán, đội code cần tuân thủ:

### 4.1 Data Flow & WebSocket
- **Sidebar Watchlist**: Gọi `useRealtimeFeedFromManager({ symbols: watchlistSymbols, pollInterval: 5000 })`. 
- **Global Alerts**: Dữ liệu cảnh báo được lấy từ `RealtimeContext` và đẩy vào `ConsolidatedAlertCenter`. Tránh tạo WebSocket socket riêng lẻ trong từng component.

### 4.2 Translation Keys (i18n)
Cần bổ sung các key sau vào `frontend/src/i18n/vi.js`:
- `layout.nav.group.dashboard`: "Tổng quan"
- `layout.nav.group.signals`: "Tín hiệu & Whale"
- `layout.nav.group.portfolio`: "Danh mục"
- `layout.nav.group.system`: "Hệ thống"

### 4.3 Component Mapping
- **Heatmap**: Dùng `PortfolioHeatmap.jsx` (đã sẵn sàng).
- **Line Chart**: Dùng `PortfolioLineChart.jsx` (truyền prop `mode="growth"`).
- **Alert Card**: Cần refactor `AlertItem` hiện tại để hỗ trợ view "Dark Flow" card khổ lớn.

---

## 5. Danh sách công việc (Checklist cho Đội Code)

- [ ] Khởi tạo nhánh `feat/ui-v2-bloomberg`.
- [ ] Refactor `Layout.jsx` -> `Sidebar.jsx`, `TopNav.jsx`.
- [ ] Xây dựng `UnifiedAlertBar` (Tầng 1).
- [ ] Xây dựng `ConsolidatedAlertCenter` (Tầng 2 - Left).
- [ ] Re-wire `RealtimeContext` để phục vụ sidebar và feed đồng thời.
- [ ] QC Review: Đảm bảo Layout không bị giật (flicker) khi WebSocket nhận tin hiệu liên tục.
