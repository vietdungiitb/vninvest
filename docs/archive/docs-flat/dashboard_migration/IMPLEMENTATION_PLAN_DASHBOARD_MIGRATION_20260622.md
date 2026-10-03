# Kế hoạch Triển khai: Di trú Tính năng Dashboard Legacy & Tái cấu trúc App Shell (Cập nhật)

* **Mã tài liệu:** `docs/IMPLEMENTATION_PLAN_DASHBOARD_MIGRATION_20260622.md`  
* **Ngày lập:** 2026-06-22  
* **Trạng thái:** Dự thảo thảo luận - Đã qua rà soát & Phản biện (Reviewed Draft)  
* **Người thực hiện:** Pham Viet Dung

---

## 1. Phân tích Sai lệch giữa Thực tế Code và Deploy Beta

Sau khi kiểm tra chi tiết mã nguồn hiện tại trong workspace và đối chiếu với môi trường beta (`https://beta.edusuccess.vn`), chúng tôi đã phát hiện các nguyên nhân chính khiến giao diện Beta chưa có thay đổi:

1. **Mã nguồn chưa được Commit và Push**:
   * Các tệp tin chỉnh sửa giao diện (`FullLayout.tsx`, `Header.tsx`, `Sidebar.tsx`, `DashboardPage.tsx`) mới chỉ được sửa đổi cục bộ trong workspace chứ **chưa được commit và push** lên nhánh `dev`.
   * Các tệp tin tạo mới (`CoreDashboardPositionDeck.tsx`, `useAlertCenterSnapshot.ts`, `runtimeConfig.ts`) vẫn ở trạng thái **untracked** (chưa được Git theo dõi).
   * Do đó, quy trình build Docker trên máy chủ (kéo code từ GitHub) đã tải bản code cũ và không chứa bất kỳ thay đổi nào.
2. **Feature Flag `isNewLayoutEnabled` chưa được tích hợp**:
   * Biến cấu hình `isNewLayoutEnabled` đã được định nghĩa trong `runtimeConfig.ts` nhưng **chưa từng được import hay sử dụng** trong các tệp layout (`FullLayout.tsx`, `Sidebar.tsx`, `Header.tsx`). Layout mới hiện đang được code cứng vô điều kiện.
3. **Thiếu tổng hợp dữ liệu Heatmap**:
   * Dashboard mới hiện tại chỉ truyền trực tiếp mảng `holdings` (mã danh mục nắm giữ) vào `<PortfolioHeatmap />` thay vì gộp toàn bộ các mã giám sát (holdings + tracked + watchlist) như phiên bản legacy `ModernDashboard.jsx` đã làm.
4. **Thiếu giao diện Phân trang Cảnh báo**:
   * Tệp `UnifiedAlertCenter.js` có destructure các thuộc tính phân trang (`hasPreviousUnifiedPage`, `backendUnifiedHasMore`, v.v.) nhưng **không hề render bất kỳ nút bấm hay thanh điều hướng phân trang nào** ở cuối danh sách. Người dùng không thể click sang trang sau.
   * Đồng thời, `DashboardPage.tsx` đang truyền sai tên thuộc tính phân trang (`hasNextPage`, `hasPrevPage` thay vì `backendUnifiedHasMore`, `hasPreviousUnifiedPage`).

---

## 2. Kế hoạch Khắc phục & Điều chỉnh Mã nguồn

### A. Tích hợp Feature Flag vào App Shell Layout

Chúng ta sẽ import `isNewLayoutEnabled` từ `@/lib/runtimeConfig` hoặc `runtimeConfig.ts` để kiểm soát chế độ hiển thị động:

#### 1. [FullLayout.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/FullLayout.tsx)
* Đặt mặc định `sidebarCollapsed` dựa trên feature flag: `useState(!isNewLayoutEnabled())`.
* Nếu `isNewLayoutEnabled()` trả về `true` (New Layout):
  * Cố định desktop sidebar ở trạng thái mở `w-72` và content container padding `lg:pl-72`.
  * Mobile sidebar sẽ hoạt động ở dạng overlap (khi mở sẽ phủ đè lên nội dung chính thông qua backdrop).
* Nếu `isNewLayoutEnabled()` trả về `false` (Old Layout):
  * Khôi phục cơ chế co giãn linh hoạt (`lg:pl-16` hoặc `lg:pl-72` tùy thuộc `sidebarCollapsed`).

#### 2. [Sidebar.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx)
* Nếu feature flag được bật:
  * Ẩn hoàn toàn nút collapse bên trong Sidebar.
  * Cập nhật style menu active thành dạng nút pill màu xanh dương (`bg-blue-600 rounded-lg text-white shadow-md shadow-blue-600/20`).
  * Luôn hiển thị đầy đủ tiêu đề nhóm và profile góc dưới mà không bị co lại thành icons.
* Nếu feature flag tắt:
  * Sử dụng active style màu xanh lục/cyan cũ, tự co cụm khi `collapsed` là `true`.

#### 3. [Header.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/layouts/full/vertical/header/Header.tsx)
* Nếu feature flag được bật:
  * Ẩn nút hamburger desktop (`hidden lg:flex`). Chỉ giữ nút hamburger mobile (`lg:hidden`).
* Nếu feature flag tắt:
  * Hiển thị nút hamburger desktop để hỗ trợ co giãn menu bên trái.

---

### B. Đồng bộ dữ liệu Heatmap & Phân trang Cảnh báo

#### 1. [DashboardPage.tsx](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/DashboardPage.tsx)
* **Tổng hợp Heatmap**: Viết hàm thu thập tất cả các mã chứng khoán từ `holdings`, `trackedSymbols` và `watchlistGroups` (loại bỏ các mã chỉ số thị trường chung như HOSE, HNX, UPCOM, VN100). Map danh sách này thành mảng `heatmapData` đầy đủ để truyền vào `<PortfolioHeatmap />`.
* **Sửa tham số phân trang**: Truyền đúng các prop phân trang cho `UnifiedAlertCenter`:
  * `hasPreviousUnifiedPage={hasPrevPage}`
  * `backendUnifiedHasMore={hasNextPage}`
  * `goToPreviousUnifiedPage={goToPrevPage}`
  * `goToNextUnifiedPage={goToNextPage}`

#### 2. [UnifiedAlertCenter.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/dashboard/UnifiedAlertCenter.js)
* Bổ sung khối giao diện Phân trang ở chân danh sách cảnh báo (chỉ render khi `backendUnifiedHasMore` hoặc `hasPreviousUnifiedPage` bằng `true`).
* Gồm các nút: "Trang trước", "Trang sau", hiển thị số trang hiện tại `currentUnifiedPage` bằng Tailwind CSS tối giản, mượt mà phù hợp phong cách Bento.

---

## 3. Kế hoạch Kiểm tra & Triển khai

### Bước 1: Chạy E2E Tests cục bộ
* Chạy Playwright E2E tests trên môi trường local để đảm bảo không vỡ layout:
  ```bash
  npx playwright test tests/visual/dashboard-ui-fixes.spec.ts --project=chromium
  ```

### Bước 2: Commit và Push mã nguồn
* Add toàn bộ các tệp tin thay đổi và file untracked:
  ```bash
  git add packages/web/src/
  git commit -m "feat(dashboard): wire up layout feature flag, aggregate full heatmap, and add alert paging UI"
  git push origin dev
  ```

### Bước 3: Deploy Beta và Smoke Test
* Đội vận hành kéo code mới trên server `docker.edusuccess.vn`.
* Build lại Docker image `vninvest-frontend:beta`.
* Chạy lệnh khởi động lại container:
  ```bash
  docker compose -f docker-compose.beta.yml up -d --build frontend-beta
  ```
* Thực hiện smoke test truy cập trang `https://beta.edusuccess.vn/dashboard` để kiểm chứng.
