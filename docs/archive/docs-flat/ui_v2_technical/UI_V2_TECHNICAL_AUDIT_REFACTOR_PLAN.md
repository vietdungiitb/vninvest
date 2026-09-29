# Technical Audit & Refactor Plan: Bloomberg UI V2 Implementation

**Auditor**: Antigravity (Planner Mode)  
**Date**: 2026-04-17  
**Scope**: Frontend Re-architecture for Unified Dashboards.

---

## 1. Audit Findings (Vấn đề hiện tại)

### 1.1 "God Component" DashboardRealtimePanel
- **Vấn đề**: `DashboardRealtimePanel.jsx` (1300+ dòng) đang gánh quá nhiều trách nhiệm: 
    - Tính toán NAV/Profit live.
    - Hợp nhất (Unify) dữ liệu Whale + Dark Flow + Price Shock.
    - Quản lý trạng thái Mute/Read.
    - Xử lý âm báo (Sound) và Toasts.
- **Rủi ro**: Khi triển khai Layout V2, nếu copy-paste logic này vào Sidebar hoặc Top Bar sẽ gây ra sự sai lệch dữ liệu (Desync) và tốn tài nguyên (Multiple calculations).

### 1.2 Trạng thái Cảnh báo (Alert State)
- **Vấn đề**: Trạng thái `readAlertIds` và `mutedSymbols` đang được lưu bằng `useState` cục bộ.
- **Rủi ro**: Khi người dùng chuyển trang (vd: từ Dashboard sang Whale Alerts Hub), các cảnh báo đã đọc sẽ hiện lại thành "Chưa đọc", gây phiền toái cho người dùng Pro.

---

## 2. Refactor Strategy (Kế hoạch tái cấu trúc)

### 2.1 Trích xuất Logic Cảnh báo (Extraction)
Đội code cần tạo một Custom Hook: `frontend/src/hooks/useUnifiedAlerts.js`.
- **Nhiệm vụ**:
    - Tiếp nhận `alerts` và `darkFlowAlerts` từ `RealtimeContext`.
    - Thực hiện Deduplication và Ranking.
    - Trả về danh sách `unifiedAlerts` và bộ đếm `alertSummary` (Critical, High...).
- **Lợi ích**: Cả `UnifiedAlertBar` (TopNav) và `UnifiedAlertCenter` (Main Page) sẽ dùng chung 1 nguồn dữ liệu đã được xử lý.

### 2.2 Quản lý Persistence (Bền vững)
Chuyển đổi trạng thái `readAlertIds` và `mutedSymbols` sang:
- **Option A**: `localStorage` (Đơn giản, tức thì).
- **Option B**: `UserConfigContext` (Đồng bộ với Server).
- **Khuyến nghị**: Sử dụng `localStorage` cho "Muted" (tạm thời 30p) và `UserConfig` cho "Read" (lâu dài).

### 2.3 Optimization: Sidebar Watchlist
Do Sidebar hiển thị liên tục, cần tối ưu render:
- Sử dụng `React.memo` cho `TickerRow` component.
- Chỉ cập nhật các Row có Symbol thay đổi giá (dựa trên `quotesBySymbol` từ context).

---

## 3. Kiến trúc Component mới (V2)

### A. Tầng Layout
- `AppLayout.jsx`: Chứa Sidebar và Main TopNav.
- `SidebarWatchlist.jsx`: Consumer của `RealtimeContext`, hiển thị mã CP + % Change.

### B. Tầng Dashboard
- `UnifiedAlertBar.jsx`: Widget nhỏ gọn hiển thị đếm số lượng lỗi/cảnh báo.
- `UnifiedAlertCenter.jsx`: Grid hiển thị list card cảnh báo (Refactor từ `WhaleFeedPanel` nhưng hỗ trợ chiều ngang rộng).

---

## 4. Ghi chú Reviewer (Auditor)
- Team code không được phép tự ý thay đổi Logic Ranking cảnh báo (Severity weights) mà không qua kiểm duyệt, vì đây là "linh hồn" của hệ thống Dashboard.
- Cần đặc biệt chú ý xử lý Sound Alert: Chỉ kích hoạt 1 lần cho 1 Event ID duy nhất để tránh "spam" âm thanh khi Re-render.
