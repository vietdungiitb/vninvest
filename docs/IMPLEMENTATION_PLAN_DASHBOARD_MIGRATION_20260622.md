# Kế hoạch Triển khai: Di trú Tính năng Dashboard Legacy & Tái cấu trúc App Shell

* **Mã tài liệu:** `docs/IMPLEMENTATION_PLAN_DASHBOARD_MIGRATION_20260622.md`  
* **Ngày lập:** 2026-06-22  
* **Trạng thái:** Dự thảo thảo luận (Draft Spec for Discussion)  
* **Người thực hiện:** Pham Viet Dung

---

## 1. Tóm tắt Yêu cầu & Mục tiêu

Tài liệu này đặc tả kế hoạch kỹ thuật chi tiết để giải quyết hai nhiệm vụ lớn trên môi trường Beta của VNInvest:
1. **Tái cấu trúc Sidebar & Header Layout (App Shell)**: 
   * Loại bỏ hoàn toàn trạng thái thu gọn (collapsed state `w-16`) của menu bên trái trên Desktop. Sidebar sẽ luôn hiển thị rộng đầy đủ (`w-72`).
   * Thay thế toggle button co giãn trên Desktop bằng giao diện Sidebar cố định.
   * Thiết kế lại kiểu hiển thị các menu items: Item đang hoạt động (active) sẽ có màu nền xanh dương sáng (`bg-blue-600`) bo góc (`rounded-lg`), chữ trắng và icon trắng, thay vì viền cyan bên trái như hiện tại (tham chiếu mẫu hình 2).
   * Trên Mobile/Tablet: Sidebar sẽ trượt đè (overlay/overlap) lên nội dung chính khi click toggle từ Header thay vì co rúm.
2. **Di trú toàn bộ tính năng và hiển thị dữ liệu đầy đủ từ Database lên Dashboard mới**:
   * **Trung tâm cảnh báo (UnifiedAlertCenter)**: Tích hợp hook lấy dữ liệu cảnh báo lịch sử (snapshot) từ database, hỗ trợ phân trang và bộ lọc trực tiếp trên UI thay vì để trống.
   * **Bản đồ nhiệt (PortfolioHeatmap)**: Tổng hợp đầy đủ danh sách mã từ vị thế danh mục (holdings), danh sách theo dõi riêng (tracked symbols) và watchlists, kết hợp live quotes để hiển thị lưới Treemap ECharts đầy đủ màu sắc.
   * **Whale Bubble Chart**: Đảm bảo biểu đồ bong bóng Whale hoạt động tốt ở nửa dưới Dashboard (phần Lower Workspace), hỗ trợ thanh trượt tinh chỉnh tỷ lệ Log-scale và liên kết bảng thông số thống kê lệnh lớn.

---

## 2. Chi tiết Thay đổi Cấu trúc Layout (App Shell)

### A. Khung giao diện chính (`FullLayout.tsx`)
* **File tác động**: [FullLayout.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/FullLayout.tsx)
* **Kế hoạch thay đổi**:
  * Đặt giá trị state mặc định `sidebarCollapsed` thành `false` thay vì `true`.
  * Loại bỏ logic tự động co sidebar khi resize màn hình desktop.
  * Giữ nguyên cơ chế backdrop và mobileOpen drawer cho viewport `< 1024px` để đảm bảo menu trượt đè lên nội dung (overlap) mượt mà trên Mobile/Tablet.
  * Cố định left padding của phần main content area thành `lg:pl-72` khi màn hình rộng (Desktop).

### B. Menu bên trái (`Sidebar.tsx`)
* **File tác động**: [Sidebar.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx)
* **Kế hoạch thay đổi**:
  * Loại bỏ `onToggle` khỏi props và destructuring vì Sidebar luôn cố định.
  * Bỏ toàn bộ các class kiểm tra điều kiện `collapsed` để Sidebar luôn hiển thị rộng `w-72`.
  * Luôn hiển thị tiêu đề danh mục `h3` (e.g., `HOME`, `PAGES`) và tên đầy đủ của các Workspace/Mã cổ phiếu mà không cần kiểm tra `!collapsed`.
  * Cập nhật Tailwind CSS classes cho menu:
    * **Active item**: `bg-blue-600 text-white font-semibold rounded-lg flex items-center gap-3 px-4 py-2.5 shadow-md shadow-blue-600/20`
    * **Inactive item**: `text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors`
    * Đảm bảo màu của LucideIcon chuyển thành màu trắng (`text-white`) khi item đang active.

### C. Thanh Header trên cùng (`Header.tsx`)
* **File tác động**: [Header.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/header/Header.tsx)
* **Kế hoạch thay đổi**:
  * Loại bỏ hẳn element button toggle của Desktop (`hidden lg:flex`).
  * Giữ nguyên toggle button của Mobile (`lg:hidden`) để mở/đóng Sidebar overlap dạng drawer.
  * Loại bỏ class css thay đổi padding theo `sidebarCollapsed`.

---

## 3. Kế hoạch Di trú Tính năng & Dữ liệu Dashboard

### A. Tải Cảnh báo Lịch sử từ Database
* **File tạo mới**: [useAlertCenterFeed.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/hooks/useAlertCenterFeed.js)
  * Port hook `useAlertCenterFeed` từ legacy `frontend/src/hooks/useAlertCenterFeed.js` sang.
  * Thay thế API client cũ thành `coreApiAdapter.getAlertCenterFeed` để gọi trực tiếp endpoint `/signals/alert-center/feed`.
  * Tích hợp cơ chế phân trang cursor (tiến/lùi) và tự động cập nhật dữ liệu (polling) mỗi 30 giây từ database.
  * Tự viết các hàm chuẩn hóa phân loại mức độ nghiêm trọng và nguồn cảnh báo (`normalizeAlertSeverity`, `normalizeAlertType`) trực tiếp trong file để loại bỏ các dependencies cồng kềnh.
* **File tác động**: [DashboardPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/DashboardPage.tsx)
  * Gọi hook `useAlertCenterFeed` bên trong component Dashboard.
  * Truyền danh sách `filteredUnifiedAlerts` và bộ đếm `alertSummary` vào `<UnifiedAlertCenter />`.
  * Truyền các callback phân trang (`goToNextUnifiedPage`, `goToPreviousUnifiedPage`, v.v.) và state bộ lọc (`severityFilter`, `setSeverityFilter`) từ hook vào để người dùng thực hiện lọc/phân trang trực tiếp trên UI.

### B. Bản đồ nhiệt (Treemap Heatmap) Đầy đủ
* **File tác động**: [DashboardPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/DashboardPage.tsx)
  * Trích xuất toàn bộ danh sách mã cổ phiếu duy nhất từ: vị thế nắm giữ của danh mục (`holdings`), mã đang theo dõi (`trackedSymbols`), và các nhóm watchlist tự chọn (`watchlistGroups`).
  * Kết hợp danh sách mã này với thông tin live quotes từ websocket realtime và dữ liệu kỹ thuật từ database để tạo ra mảng `heatmapData` đầy đủ thông tin (gồm `symbol`, `company_name`, `live_current_price`, `live_change_pct`, `is_holding`, `industry`).
  * Truyền dữ liệu tổng hợp này vào `<PortfolioHeatmap />` để vẽ biểu đồ Treemap màu sắc xanh/vàng/đỏ đầy đủ theo thời gian thực thay vì để trống như hiện tại.

### C. Whale Bubble Chart & Lower Tabs
* **File tác động**: [FactsFirstModularPositionDeck.jsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/FactsFirstModularPositionDeck.jsx) và các file con.
  * Đảm bảo tab "Cá mập" (activeTab === 'whale') hiển thị đầy đủ WhaleAnalyticsTab.
  * Xác thực việc gọi API `/workspace/whale-analytics/{symbol}/` hoạt động chính xác từ database để vẽ bong bóng giao dịch lớn của cá mập.
  * Đảm bảo thanh trượt tinh chỉnh tỷ lệ Log-scale hoạt động trơn tru để co giãn kích thước bong bóng trên biểu đồ ECharts.

---

## 4. Kế hoạch Kiểm thử & Xác nhận (Verification Plan)

### A. Kiểm thử tự động (E2E Playwright Tests)
* Cập nhật file test [dashboard-ui-fixes.spec.ts](file:///c:/Mujoco%20Projects/vninvest/packages/web/tests/visual/dashboard-ui-fixes.spec.ts) để thêm các assertions:
  * Kiểm tra Sidebar có class `w-72` cố định trên desktop viewport.
  * Kiểm tra nút hamburger desktop không tồn tại trong Header.
  * Kiểm tra active link có màu nền xanh dương (`bg-blue-600`) và text màu trắng.
  * Kiểm tra ECharts Treemap render thành công danh sách các mã mock.
  * Kiểm tra việc click vào tab "Cá mập" hiển thị biểu đồ Whale Bubble Chart cùng thanh trượt log-scale.

### B. Kiểm thử thủ công (Manual Checks)
* Deploy lên môi trường Beta và kiểm tra tính trực quan trên các viewport Desktop, Tablet và Mobile.
* Xác nhận trên Mobile, menu bên trái trượt đè (overlap) lên nội dung thay vì đẩy vỡ bố cục.
* Xác nhận dữ liệu cảnh báo cũ và bản đồ nhiệt hiển thị đầy đủ ngay sau khi tải trang.
