# Thẩm Định Kỹ Thuật (Vòng 3): Kết Quả Audit Codebase & Kế Hoạch Di Trú Legacy Frontend

*   **Tài liệu gốc:** `LEGACY_FRONTEND_MIGRATION_IMPLEMENTATION_PLAN_20260622.md` (Phiên bản Live Audit)
*   **Ngày audit:** 2026-06-22 (Vòng 3 - Thẩm định Codebase thực tế)
*   **Trạng thái:** Dự thảo phê duyệt (Approved-Ready)

---

## 1. Đánh Giá Thành Quả Thực Tế (Completed Milestones)

Dựa trên kết quả rà soát (live audit) trực tiếp cấu trúc thư mục và cấu hình của `packages/web/`, đội ngũ kỹ thuật ghi nhận phần lớn các hạng mục phức tạp của kế hoạch ban đầu đã được hoàn thành xuất sắc trước thời hạn:

1.  **Hạ Tầng Lõi (Context & WS):** `ShellAuthProvider` (trong `authReact.js`), `RealtimeContext.js` và hook `useRealtimeFeedCore` đã được tích hợp ổn định. Hệ thống WebSocket đẩy live price và whale alerts hoạt động đúng thiết kế.
2.  **Di Trú Trang Nghiệp Vụ (Pages Migration):** Tất cả các trang cốt lõi của người dùng (`/dashboard`, `/watchlist`, `/stocks/:symbol`, `/screener`, v.v.) đều đã được chuyển đổi hoàn toàn sang định dạng `.tsx` và đăng ký chính xác trong `pageRegistry.js` thay thế các component wrapper cũ.
3.  **Tự Đóng Gói (Packaging):** `packages/web/Dockerfile` đã chuyển sang cơ chế build 2-stage độc lập, không còn phụ thuộc hay sao chép bất kỳ tài nguyên nào từ thư mục `frontend/`. Lịch trình deploy trong `web-ci.yml` và `web.yml` đã được cập nhật thành công.

---

## 2. Các Hạng Mục Còn Thiếu & Điểm Nghẽn Kỹ Thuật (Critical Remaining Gaps)

Mặc dù 90% công việc đã hoàn thành, để dự án di trú đạt trạng thái hoàn tất 100% (Definition of Done), team dev cần tập trung giải quyết **5 hố đen kỹ thuật** sau:

### 2.1 Thiếu 8 Trang Quản Trị Hệ Thống (Admin Core Pages)
*   **Vấn đề:** Thư mục `packages/web/src/pages/admin/` hiện chỉ có 2 file (`ShellMailConfigPage.tsx` và `ShellOperationsCenterPage.tsx`). Toàn bộ 8 trang quản trị cốt lõi của legacy frontend vẫn chưa có phiên bản TSX tương ứng:
    1.  `AdminCoreOverview.jsx` (13.4KB)
    2.  `AdminCoreTenants.jsx` (21KB)
    3.  `AdminCoreServiceAccounts.jsx` (27.9KB)
    4.  `AdminCorePATs.jsx` (30.9KB)
    5.  `AdminCoreUsage.jsx` (20.1KB)
    6.  `AdminCoreBilling.jsx` (14.8KB)
    7.  `AdminCoreJobs.jsx` (26.2KB)
    8.  `AdminCoreAuditTrace.jsx` (30.8KB)
*   **Rủi ro:** Khi xóa bỏ thư mục `frontend/`, quản trị viên hệ thống sẽ mất hoàn toàn khả năng giám sát tenant, cấu hình PAT và audit log.
*   **Giải pháp:** Bắt buộc tiến hành chuyển đổi (convert) 8 file JSX legacy này sang TSX trong `packages/web/src/pages/admin/` và đăng ký route `/admin/core/*` trong `pageRegistry.js`.

### 2.2 Cảnh Báo Kích Thước Bundle Chunk Lớn (Vite Chunks Warning)
*   **Vấn đề:** Khi chạy đóng gói production (`npm run build`), trình biên dịch Vite phát cảnh báo kích thước file chunk vượt ngưỡng 500KB đối với hai component:
    *   `WhaleBubbleChart` (689KB)
    *   `ShellStockDetailPage` (909KB)
*   **Rủi ro:** Làm tăng đáng kể thời gian tải trang lần đầu (First Contentful Paint - FCP và Time to Interactive - TTI) của người dùng trên thiết bị cấu hình thấp hoặc mạng yếu.
*   **Giải pháp:** 
    *   Áp dụng kỹ thuật tải động (dynamic import) của React (`React.lazy()`) để tách nhỏ (code-splitting) các thư viện chart nặng như ECharts hoặc Kline engine khỏi bundle chính.
    *   Cấu hình `output.manualChunks` trong `vite.config.ts` để gộp các thư viện bên thứ ba (vendor) vào một chunk riêng biệt.

### 2.3 Chưa Đồng Bộ Linter i18n & ESLint Rules
*   **Vấn đề:** Cấu hình `i18next-scanner.config.js` tồn tại nhưng runtime thực tế của packages/web lại sử dụng một custom engine dịch thuật riêng biệt. Chưa có ESLint rule để tự động bắt lỗi chữ tiếng Việt cứng (hardcode text) trong mã TSX.
*   **Giải pháp:** Đồng bộ hóa scanner hoặc xây dựng custom linter script để quét toàn bộ file TSX trước khi commit. Thiết lập rule Husky pre-commit từ chối các chuỗi Unicode tiếng Việt nằm ngoài file dịch.

### 2.4 Playwright E2E Tests Bị Khuyết
*   **Vấn đề:** Mã nguồn hiện tại mới chỉ có `stock-detail-workstation.spec.ts` (bao phủ tốt trang chi tiết cổ phiếu) và `critical-pages.spec.ts` (kiểm tra visual). Đang thiếu hoàn toàn kịch bản kiểm thử E2E cho các luồng:
    1.  *Login Flow:* Đăng nhập, lưu token, refresh token tự động.
    2.  *Watchlist CRUD:* Thêm, xóa mã và cập nhật giá live WebSocket.
    3.  *Screener:* Thao tác lọc rules, phân trang kết quả.
*   **Giải pháp:** Viết bổ sung 3 file spec Playwright tương ứng để đạt tiêu chí DoD 9.

---

## 3. Khuyến Nghị Về Quy Chuẩn & Dọn Dẹp (Policy & Decommission Recommendations)

1.  **Chính Thức Bãi Bỏ Hybrid Syntax Policy:**
    *   *Quyết định:* Nhất trí loại bỏ quy định cấm JSX ở page-level. Cú pháp JSX tiêu chuẩn sẽ là chuẩn duy nhất áp dụng cho toàn bộ dự án `packages/web/` để đảm bảo tốc độ phát triển.
    *   *Lý do:* Cấu hình Vite (`jsx: "react-jsx"`) và TypeScript (`moduleResolution: "bundler"`) hiện tại đã hỗ trợ phân giải hoàn hảo, không phát sinh lỗi biên dịch.
2.  **Lưu Trữ Tạm Thời (Archive) Thay Vì Xóa Vĩnh Viễn:**
    *   *Quyết định:* Khi thực hiện Giai đoạn 6 (Cutover), không xóa vĩnh viễn thư mục `frontend/` ngay lập tức khỏi ổ đĩa. Thay vào đó, di chuyển nó vào thư mục `/archive/frontend-legacy/` hoặc gắn thẻ Git branch `archive/legacy-frontend-pre-cleanup` để làm tham chiếu đối chiếu nghiệp vụ khi cần thiết.

---

## 4. Kế Hoạch 5 Ngày Cuối Để Hoàn Tất 100% (5-Day Action Plan)

Để giải quyết triệt để các hạng mục còn lại, team dev sẽ tập trung triển khai theo lịch trình 5 ngày làm việc dưới đây:

| Ngày thực hiện | Hạng mục công việc chính | Người thực hiện | Tiêu chí hoàn thành (DoD) |
| :--- | :--- | :--- | :--- |
| **Ngày 1 - 2** | Convert 8 trang Admin Core sang TSX. Đăng ký sub-routing `/admin/core/*` trong `pageRegistry.js`. | Mid-level Frontend Dev | Build check pass 0 lỗi; 8 file TSX mới xuất hiện. |
| **Ngày 3** | Cấu hình code-splitting trong `vite.config.ts` để phân rã `WhaleBubbleChart` & `ShellStockDetailPage` thành các chunk nhỏ hơn < 500KB. Đồng bộ i18n scanner. | Senior Frontend Dev / DevOps | Vite build warning bundle size biến mất. |
| **Ngày 4** | Viết bổ sung 3 file E2E tests Playwright cho luồng Login, Watchlist CRUD và Screener. | QA Engineer | Chạy `npx playwright test` pass 100%. |
| **Ngày 5** | Triển khai Shadow Run trên host beta, verify Parity Gate Score >= 0.99. Tech Lead và CTO ký duyệt Pre-decommission Gates để chuyển legacy frontend vào `/archive`. | DevOps / Tech Lead / PO | Hoàn tất Gate A-G. Thư mục `frontend/` được chuyển vào `archive/`. |

---

## 5. Bảng Độ Ưu Tiên Thảo Luận (Team Meeting Priority)

| Thứ tự | Chủ đề thảo luận | Mức độ | Nhân sự bắt buộc |
| :--- | :--- | :--- | :--- |
| **1** | **Phương án convert 8 trang Admin Core:** Phân bổ người viết và timeline 2 ngày có khả thi? | **Critical** | Tech Lead + PM |
| **2** | **Tối ưu hóa Bundle Chunk Size:** Cấu hình manualChunks của Vite có ảnh hưởng gì tới các shell page nạp động khác? | **High** | Senior Frontend Dev |
| **3** | **Shadow Run Exit Criteria:** Xác định parity metrics so khớp dữ liệu. | **High** | Tech Lead + PO |
| **4** | **i18n Linter & Check Hardcode:** Cách thức tự động hóa quét string tiếng Việt. | **Medium** | QA + Tech Lead |
| **5** | **Database Rollback:** Đánh giá lại các migration của core-api có liên quan tới admin config. | **Medium** | Backend Dev |
| **6** | **Quyết định lưu trữ (Archive vs Delete):** Đồng thuận chuyển legacy sang thư mục `/archive`. | **Low** | CTO |
