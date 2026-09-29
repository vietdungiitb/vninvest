# Chiến lược triển khai: Hệ thống Chuyển đổi Giao diện (Hybrid UI System)

**Ngày lập**: 2026-04-20
**Trạng thái**: Chờ phê duyệt (Draft)
**Mục tiêu**: Cho phép người dùng linh hoạt lựa chọn giữa **Giao diện Cổ điển (Legacy)** hiện tại và **Giao diện Hiện đại (Workstation v6.0)**.

---

## 1. Nguyên tắc cốt lõi
1. **Không phá vỡ cái cũ**: Bộ mã nguồn cho giao diện Legacy phải được giữ nguyên trạng.
2. **Tách biệt code (Separation of Concerns)**: Toàn bộ code cho giao diện Modern sẽ nằm trong thư mục riêng (`src/pages/modern/`).
3. **Hiệu suất (Performance)**: Chuyển đổi giao diện không gây load lại trang (SPA navigation/Context-based).

---

## 2. Các thành phần kỹ thuật cần xây dựng

### A. Quản lý trạng thái (`InterfaceContext`)
- Lưu trữ biến `uiMode`: `'legacy'` | `'modern'`.
- Phương thức: `setUiMode(mode)`, `currentLayout`.
- Persistence: Lưu vào `localStorage` key `vninvest_ui_preference`.

### B. Cấu trúc Dispatcher (`Dashboard.jsx`)
- Refactor Component Dashboard chính để đóng vai trò điều hướng:
```jsx
// Logic phác thảo
const Dashboard = () => {
    const { uiMode } = useInterface();
    return uiMode === 'modern' ? <ModernWorkspace /> : <LegacyDashboard />;
}
```

### C. Giao diện Modern (v6.0)
Xây dựng các khối module theo thiết kế đã chốt:
- **Header**: `SmartStatsHeader` (Thay thế TopNav khi ở chế độ Modern).
- **Workspace**: Grid 65/35.
- **Components**: `ModularPositionDeck`, `EquityCurveChart`, `RiskMetricsSidebar`.

---

## 3. Lộ trình thực hiện (Roadmap)

### Giai đoạn 1: Cơ sở hạ tầng
- [ ] Khởi tạo `InterfaceContext.jsx`.
- [ ] Thêm nút Switch UI vào `TopNav`.
- [ ] Kiểm tra khả năng lưu trữ và khôi phục trạng thái giao diện.

### Giai đoạn 2: Xây dựng Module Modern
- [ ] Thiết lập `ModernWorkspace` layout (Grid 65/35).
- [ ] Phát triển `ModularPositionDeck` (Bảng danh mục Tabbed).
- [ ] Chuyển đổi `HoldingsTable` thành Module "Tổng quan".

### Giai đoạn 3: Tích hợp Analytics & News
- [ ] Tích hợp `EquityCurve` vào Workspace.
- [ ] Xây dựng Sidebar `RiskMetrics` và `AINewsDigest`.

---

## 4. Xác nhận từ người dùng

> [!IMPORTANT]
> **Vị trí nút chuyển đổi**: Đề xuất đặt trực tiếp trên Header cạnh Profile để thuận tiện nhất.
> **Dữ liệu**: Mặc định sẽ dùng chung `RealtimeContext` để dữ liệu luôn đồng bộ giữa 2 giao diện.

---

## 5. Kế hoạch xác minh (Verification)
- Kiểm tra tính ổn định của Layout khi Switch.
- Kiểm tra Memory Leak khi Render lại các component lớn.
