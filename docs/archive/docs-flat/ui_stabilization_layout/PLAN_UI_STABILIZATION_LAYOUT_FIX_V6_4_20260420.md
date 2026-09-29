# Implementation Plan: UI Stabilization & Layout Refinement (v6.4)

Dựa trên phản hồi và ảnh chụp màn hình, tôi đã xác định được 3 khu vực trọng tâm cần xử lý để đạt được trải nghiệm chuyên nghiệp nhất.

## User Review Required

> [!IMPORTANT]
> Tôi sẽ ưu tiên việc xử lý **Z-Index** để các menu không bao giờ bị che khuất, đồng thời tinh chỉnh lại hoàn toàn cấu trúc **Sidebar** để tránh hiện tượng chồng lấn module.

## Proposed Changes

### 1. Fix Menu & Dropdown clipping

#### [MODIFY] [SmartStatsHeader.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/SmartStatsHeader.jsx)
- Tăng `z-index` lên `z-50`.
- Đảm bảo các menu thả xuống (Portfolio Selector) có độ ưu tiên hiển thị cao nhất.

### 2. Tái cấu trúc Heatmap theo yêu cầu

#### [MODIFY] [PortfolioHeatmap.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/PortfolioHeatmap.jsx)
- **Tách Header**: Đưa tiêu đề "Theo dõi dòng tiền" lên một hàng riêng phía trên các nút điều khiển.
- **Tối ưu chiều cao**: Tăng chiều cao mặc định cho Sunburst để hiển thị đủ 100% vòng tròn mà không cần scroll.

### 3. Chống chồng lấn Sidebar

#### [MODIFY] [ModernSidebar.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/components/modern/ModernSidebar.jsx)
- Cấu trúc lại Flexbox: Gán chiều cao tối thiểu (`min-h`) cho khu vực biểu đồ tròn.
- Xử lý việc tính toán chiều cao tự động để "Luồng tín hiệu Live" luôn nằm dưới cùng mà không đè lên các module trên.

### 4. Tăng diện tích Workspace

#### [MODIFY] [ModernDashboard.jsx](file:///c:/Mujoco%20Projects/vninvest/frontend/src/pages/modern/ModernDashboard.jsx)
- Chỉnh sửa Grid layout hàng trên từ `h-[40%]` lên `h-[44%]` để phù hợp với chiều cao mới của Heatmap Sunburst.

## Verification Plan

### Automated Tests
- Kiểm tra hiển thị Sunburst chart không bị mất "chân" trên các tỉ lệ màn hình khác nhau.

### Manual Verification
- Thử mở menu "Danh mục" và kiểm tra xem nó có đè lên Heatmap hay bị chui xuống dưới không.
- Kiểm tra các module bên phải xem có còn hiện tượng chữ đè lên biểu đồ không.
