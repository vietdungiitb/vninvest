# TASKBOARD — Dashboard UI/UX Improvements

**Mã Task**: `DASHBOARD_UX_20260510`  
**Trạng thái**: IN PROGRESS

---

## 📋 Danh sách Task

### 1. Cơ sở hạ tầng Grid & Layout
- [x] [Bx.1] Cập nhật `.page-body-grid` sang `repeat(3, 1fr)` trong `index.css`.
- [x] [Bx.2] Điều chỉnh `ModernDashboard.jsx` để đồng bộ layout và alignment.
- [x] [Bx.3] Kiểm tra Vertical Alignment giữa `StickyAlertBar` và grid bên dưới.

### 2. Logic Cảnh báo ghim
- [x] [Bx.4] Implement deduplication logic theo Symbol trong `StickyAlertBar.jsx`.
- [x] [Bx.5] Test hiển thị đa dạng mã trên thanh ghim.

### 3. Thành phần Trực quan (Treemap & Icons)
- [x] [Bx.6] Cập nhật logic render label theo diện tích ô trong `PortfolioHeatmap.jsx`.
- [x] [Bx.7] Cập nhật Icon Shark chuẩn trong `UnifiedAlertCenter.jsx`.

### 4. Đánh bóng UI (Polish)
- [x] [Bx.8] Cập nhật style nút "UserConfig" trong `SmartStatsHeader.jsx`.
- [x] [Bx.9] Nâng cấp Empty State cho `AIAdvisorAlertPanel.jsx`.
- [x] [Bx.10] Xử lý hiển thị giá trị null/0 trong Header.

---

## 🚀 Lịch trình thực hiện (Slices)

| Slice | Mô tả | File ảnh hưởng | Trạng thái |
|---|---|---|---|
| **Slice 1** | Layout & Grid Alignment | `index.css`, `ModernDashboard.jsx` | [x] |
| **Slice 2** | Sticky Alerts Deduplication | `StickyAlertBar.jsx` | [x] |
| **Slice 3** | Treemap & Icons | `PortfolioHeatmap.jsx`, `UnifiedAlertCenter.jsx` | [x] |
| **Slice 4** | Header & UI Polish | `SmartStatsHeader.jsx`, `AIAdvisorAlertPanel.jsx` | [x] |

---

## 📝 Nhật ký thay đổi (Progress Log)
- **2026-05-10**: Khởi tạo Taskboard.
