# Kế hoạch Triển khai: Di trú Tính năng Dashboard Legacy & Tái cấu trúc App Shell (Cập nhật)

* **Mã tài liệu:** `docs/IMPLEMENTATION_PLAN_DASHBOARD_MIGRATION_20260622.md`  
* **Ngày lập:** 2026-06-22  
* **Trạng thái:** Dự thảo thảo luận - Đã qua rà soát & Phản biện (Reviewed Draft)  
* **Người thực hiện:** Pham Viet Dung

---

## 1. Phản hồi Phản biện & Điều chỉnh Thiết kế

Sau khi kiểm tra chi tiết mã nguồn và rà soát các ràng buộc cứng (hard constraints) trong `AGENTS.md`, kế hoạch di trú được cập nhật để xử lý các vấn đề sau:

### 1.1 Khắc phục vi phạm Ràng buộc Cứng (Immutable Source)
* **Vấn đề**: `FactsFirstModularPositionDeck.jsx` là tệp tin bất biến (immutable source) thuộc về modern dashboard, không được phép sửa đổi trực tiếp.
* **Giải pháp**: **KHÔNG sửa đổi `FactsFirstModularPositionDeck.jsx`**. 
  * Chúng ta sẽ tạo một component mới hoàn toàn mang tên `CoreDashboardPositionDeck.tsx` đặt tại thư mục `packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx`.
  * Component mới này kế thừa cấu trúc tab-bar của `FactsFirstModularPositionDeck` để hiển thị trên Dashboard mới, đồng thời tích hợp `WhaleAnalyticsTab.jsx` mà không ảnh hưởng đến deck cũ.

### 1.2 Tận dụng Codebase hiện tại (Tránh trùng lặp)
* **Vấn đề**: Codebase hiện tại đã có sẵn cơ chế gộp `collectUniqueSortedSymbols`, gộp realtime quotes/alerts và `coreApiAdapter.getAlertCenterFeed` đã được test.
* **Giải pháp**:
  * **Không viết lại hook `useAlertCenterFeed`**: Thay vào đó, tạo một React Hook mỏng bằng TypeScript: `useAlertCenterSnapshot.ts` đặt tại `packages/web/src/hooks/useAlertCenterSnapshot.ts`. Hook này chỉ làm nhiệm vụ gọi API `coreApiAdapter.getAlertCenterFeed` để nạp snapshot cảnh báo lịch sử từ database và quản lý phân trang (cursors/page size).
  * Trong `DashboardPage.tsx`, chúng ta sẽ dùng hook `useAlertCenterSnapshot` này để nạp dữ liệu snapshot, sau đó sử dụng logic deduplicate có sẵn để merge vào `mergedAlerts` trước khi truyền vào `UnifiedAlertCenter`.
  * **Tận dụng Heatmap symbols**: Tận dụng hàm `collectUniqueSortedSymbols` để gộp danh sách mã, xây dựng mảng `heatmapData` đầy đủ ngay trong `DashboardPage.tsx` bằng cách map các mã này với `mergedQuotes` và `holdings` hiện có để truyền vào `PortfolioHeatmap`.

### 1.3 Vá lỗi `closeMobileSidebar` phá vỡ layout Desktop
* **Vấn đề**: Hàm `closeMobileSidebar` trong `FullLayout.tsx` gọi `setSidebarCollapsed(true)`, được kích hoạt trên mọi click liên kết điều hướng ở Sidebar. Điều này khiến sidebar trên Desktop tự động thu gọn lại thành `w-16`, phá vỡ yêu cầu "bỏ panel menu thu gọn trên desktop".
* **Giải pháp**: Loại bỏ dòng `setSidebarCollapsed(true)` khỏi hàm `closeMobileSidebar` trong `FullLayout.tsx`. Trên desktop, state `sidebarCollapsed` sẽ được cố định là `false` để giữ nguyên chiều rộng `w-72` mà không bị co lại khi click link.

---

## 2. Chi tiết Thay đổi Tệp tin & Đường dẫn Relative

### A. Khung giao diện chính (`packages/web/src/layouts/full/FullLayout.tsx`)
* **Thay đổi**:
  * Đặt mặc định `sidebarCollapsed` thành `false`.
  * Sửa hàm `closeMobileSidebar`:
    ```typescript
    const closeMobileSidebar = () => {
      setMobileSidebarOpen(false);
      // setSidebarCollapsed(true); <-- Xóa bỏ dòng này để tránh tự động thu hẹp sidebar trên Desktop khi chuyển link
    };
    ```
  * Cố định main content container padding ở mức `lg:pl-72`.

### B. Menu bên trái (`packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx`)
* **Thay đổi**:
  * Xóa bỏ thuộc tính check `collapsed` ở Sidebar container class.
  * Cấu hình i18n keys cho text nhóm và tiêu đề (dùng `layout.menu.home`, `layout.menu.pages`, `layout.menu.ai`).
  * Cập nhật CSS Active indicator theo mockup template (Hình 2):
    * **Active item**: Nền xanh dương sáng `bg-blue-600`, chữ trắng `text-white`, bo góc `rounded-lg`, đổ bóng nhẹ `shadow-md shadow-blue-600/20` và LucideIcon màu trắng.
    * **Inactive item**: `text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors`.

### C. Thanh Header (`packages/web/src/layouts/full/vertical/header/Header.tsx`)
* **Thay đổi**:
  * Loại bỏ element button toggle của Desktop (`hidden lg:flex`).
  * Chỉ render nút hamburger mobile/tablet (`lg:hidden`).

---

## 3. Di trú Tính năng & Dữ liệu Lịch sử

### A. Tải Cảnh báo Snapshot từ Database
* **Tạo mới hook**: `packages/web/src/hooks/useAlertCenterSnapshot.ts`
  * Gọi trực tiếp API `coreApiAdapter.getAlertCenterFeed` để lấy snapshot database.
  * Quản lý cursor stack cho phân trang và trạng thái loading.
* **Cập nhật**: `packages/web/src/pages/DashboardPage.tsx`
  * Dùng hook `useAlertCenterSnapshot` lấy snapshot lịch sử, gộp với `realtimeFeed?.alerts` thông qua hàm lọc trùng lặp ID.
  * Truyền state bộ lọc và callback phân trang vào `UnifiedAlertCenter` để hiển thị danh sách động có phân trang thay vì danh sách trống.
  * **Xử lý Error/Loading/Empty states**:
    * Khi API fail: Hiển thị Banner cảnh báo lỗi `ErrorBanner`.
    * Khi đang tải dữ liệu: Hiển thị 3 hàng Skeleton Loading.
    * Khi database không có dữ liệu: Hiển thị giao diện Empty State với biểu tượng chuông mờ.

### B. Tải Bản đồ nhiệt (Treemap)
* **Cập nhật**: `packages/web/src/pages/DashboardPage.tsx`
  * Dùng `collectUniqueSortedSymbols` thu thập các mã từ holdings, trackedSymbols, watchlists.
  * Map danh sách này thành mảng `heatmapData` chứa `symbol`, `is_holding`, `live_change_pct` (lấy từ `mergedQuotes`), `live_current_price` để truyền vào `<PortfolioHeatmap />`.
  * **Tính phản ứng realtime**: Props thay đổi từ `mergedQuotes` sẽ tự động trigger render lại ECharts Treemap nhờ React reactivity.

### C. Tải Whale Bubble Chart
* **Xác thực API**: Đã kiểm tra và xác nhận hàm `getWhaleAnalyticsSnapshot` tồn tại trong `coreApiAdapter.js` và map trực tiếp với endpoint `/workspace/whale-analytics/{symbol}/` trên backend.
* **Tạo mới component**: `packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx` (Copy và chỉnh sửa từ `FactsFirstModularPositionDeck.jsx` để giữ tính bất biến của file cũ).
  * Render tab "Cá mập" gọi `WhaleAnalyticsTab.jsx` để load dữ liệu bubble chart và hiển thị slider Log-scale.

---

## 4. Feature Flag & Kịch bản Rollback khẩn cấp

* **Feature Flag**: Sử dụng biến môi trường `VITE_ENABLE_SAAS_OVERLAP_SIDEBAR=true` trong tệp cấu hình `.env` để kiểm soát chế độ hiển thị Sidebar mới.
  * Nếu biến này bằng `false`, hệ thống sẽ fallback về cấu hình Sidebar co giãn cũ.
* **Rollback Plan**: Nếu xảy ra lỗi vỡ giao diện trên Beta, đội vận hành chỉ cần cập nhật lại giá trị biến môi trường trong container Nginx/Frontend mà không cần build lại code, thời gian khôi phục dưới 1 phút.

---

## 5. Cập nhật E2E Playwright Tests

Cập nhật tệp [dashboard-ui-fixes.spec.ts](file:///c:/Mujoco%20Projects/vninvest/packages/web/tests/visual/dashboard-ui-fixes.spec.ts):
* Assert `aside` luôn có width class `w-72`.
* Assert header toggle desktop `hidden lg:flex` không được render.
* Assert active link chứa class `bg-blue-600`.
* Assert Treemap có hiển thị các ô dữ liệu mock.
