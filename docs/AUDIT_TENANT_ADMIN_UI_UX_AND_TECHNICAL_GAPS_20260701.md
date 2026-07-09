# Báo cáo Audit hiệu chỉnh: UI/UX & Lỗ hổng kỹ thuật hệ thống Tenant Admin (VNInvest)

Tài liệu này là bản hiệu chỉnh của báo cáo đánh giá hệ thống quản trị Tenant Admin, được cập nhật và đối chiếu trực tiếp với codebase (hơn 20 files, ~6.000 dòng code) và các phản hồi kỹ thuật.

---

## 1. Tóm tắt kết quả hiệu chỉnh (Executive Summary)

Sau khi rà soát và đối chiếu chéo kỹ lưỡng:
*   **Số claims chính xác confirmed:** 42 claims (phân loại từ CRITICAL, HIGH, MEDIUM đến LOW).
*   **Số claims sai đã loại bỏ:** 6 claims (bao gồm thông tin về chữ `"Loading..."` viết cứng, bóng biến `t` ở PATs, 3 catch blocks ở UsageHistory, hàm reduce ở UsagePage, và tình trạng trống của hai mục ngôn ngữ lớn trong vi.js).
*   **Trạng thái i18n của `vi.js`:** Phân hệ `tenantSecurity` (26 keys) và `tenantReports` (44 keys) đã được đồng bộ hóa đầy đủ từ `en.js` sang `vi.js` để tránh việc hiển thị mã khóa thô.
*   **Định tuyến & Code dư thừa:** Xác nhận tệp `main.js` là mã nguồn cũ (dead code) không được Vite sử dụng, cần dọn dẹp để đảm bảo tính gọn sạch.

---

## 2. Kết quả rà soát chi tiết từng trang (Page-by-Page Verified Gaps)

### 2.1. TenantAdminHomePage.tsx
*   **Lỗi logic (Bugs):**
    *   *Đóng modal khi lỗi deprovision (🚨 CRITICAL):* Hàm `setShowDeprovision(false)` nằm trong `finally` dẫn đến đóng modal lập tức khi gặp lỗi, khiến người dùng không đọc được thông báo lỗi từ server.
    *   *Nuốt lỗi đồ thị (HIGH):* Khối catch trong `handleTrendDaysChange` nuốt lỗi im lặng (`catch ((_err) => {})`), đồ thị không hiển thị dữ liệu mới và không có thông báo cho người dùng.
    *   *Logic checklist Token hết hạn (HIGH):* Điều kiện checklist `summary?.pats_expiring_soon !== undefined` luôn trả về `true` kể cả khi giá trị bằng `0` (không có token nào sắp hết hạn). Logic đúng phải là kiểm tra số lượng lớn hơn `0`.
    *   *SSO & Webhooks checklist (MEDIUM):* Checklist hoàn thành trạng thái dựa trên quyền hạn truy cập (`ability.can`) thay vì dữ liệu cấu hình thực tế của Tenant.
*   **UI/UX & Accessibility:**
    *   Ký tự biểu thị ngày (`7d`, `14d`, `30d`) bị viết cứng.
    *   Component con `KpiCard` định nghĩa lồng bên trong hàm render.

### 2.2. TenantAdminBillingPage.tsx
*   **Lỗi logic nghiêm trọng (🚨 CRITICAL BUG):**
    *   *Không nâng cấp thực tế:* Hàm `handleUpgrade` gọi API preview (`operatorClient.previewPlanChange`) và set `upgradeDone(true)`, người dùng tưởng nâng cấp thành công nhưng thực chất không có giao dịch Stripe nào được thực thi.
*   **Lỗi mức độ cao (HIGH):**
    *   *Crash do trích xuất hóa đơn:* Lệnh `setInvoices(invData.results || invData.data || invData || [])` có fallback cuối cùng là một đối tượng (`invData`), nếu API trả về dạng object thay vì array, lệnh `.map()` phía dưới sẽ crash trang.
*   **UI/UX & i18n:**
    *   Thiếu confirm modal khi click nâng cấp (MEDIUM).
    *   Cố định ký hiệu tiền tệ `"VND"` và hạn mức gói cước viết cứng ở frontend (MEDIUM).
    *   Thiếu 6 keys i18n tiếng Việt cho `tenantBilling.costTrend*` (HIGH).

### 2.3. TenantAdminUsagePage.tsx & TenantAdminUsageHistoryPage.tsx
*   **Lỗi logic & Kỹ thuật:**
    *   *3 silent catch blocks (HIGH - nằm tại UsagePage):* Các hàm `loadHistory`, `loadForecasts`, `loadAlertConfigs` trong `TenantAdminUsagePage.tsx` có catch block để trống (`// silently fail`), không set error state hay hiển thị toast báo lỗi.
    *   *Fragile reduce (MEDIUM - nằm tại UsageHistoryPage):* Hàm `.reduce()` tính toán peak day (`chartData.reduce(...)`) không phòng ngừa mảng rỗng, dễ gây lỗi.
    *   *Mã Meter cứng (MEDIUM):* `METER_CODES` bị viết cứng trong code.
*   **UI/UX & Accessibility:**
    *   Thanh Tab điều hướng tùy biến bằng `div` không hỗ trợ bàn phím và ARIA roles (MEDIUM).

### 2.4. TenantAdminMembersPage.tsx
*   **Lỗi logic & UI/UX:**
    *   *Hủy lời mời (MEDIUM):* Bấm hủy lời mời chỉ thực hiện lọc tạm ở frontend (`filter`), tải lại trang sẽ hiển thị lại nếu backend chưa kịp đồng bộ xóa.
    *   *Fix cứng ngôn ngữ (MEDIUM):* Các nhãn vai trò "Owner", "Admin" viết cứng tiếng Anh.
    *   *Thiếu i18n key (MEDIUM):* Khóa `tenantMembers.searchPlaceholder` bị thiếu ở cả hai file tiếng Anh và tiếng Việt.
    *   *CSS inline (LOW):* Nhúng cụm CSS `MEMBER_CSS` qua thẻ `<style>` inline.

### 2.5. TenantAdminServiceAccountsPage.tsx
*   **Lỗi logic & Bảo mật:**
    *   *API call trước kiểm tra quyền (🚨 CRITICAL):* `useEffect` kích hoạt API call `/partner/service-accounts/` trước khi check quyền `canRead` của component.
    *   *Lỗi undefined ID (HIGH):* Hàm `handleDeleteSA(saId!)` có thể gửi tham số dạng chuỗi `"undefined"` nếu `saId` không tồn tại.
    *   *Bật/tắt không confirm (MEDIUM):* Thao tác bật/tắt kích hoạt trạng thái Service Account thực thi ngay mà không hiển thị hộp thoại xác nhận.

### 2.6. TenantAdminPATsPage.tsx
*   **Lỗi logic & Kỹ thuật:**
    *   *Múi giờ UTC lệch (HIGH):* Sử dụng `toISOString().slice(0, 16)` lấy giờ UTC làm ô nhập liệu hết hạn mặc định bị lệch 7 tiếng so với giờ địa phương Việt Nam.
    *   *Nhãn tiếng Việt cứng (MEDIUM):* Một số nhãn hiển thị trong drawer vẫn bị viết cứng.

### 2.7. TenantAdminSSOPage.tsx
*   **Lỗi logic & Rủi ro:**
    *   *Mất dữ liệu chưa lưu (HIGH):* Bấm nút "Test connection" chuyển hướng trình duyệt lập tức bằng `window.location.href`, làm mất toàn bộ form đang chỉnh sửa dở dang.
    *   *Input SP cho phép sửa (HIGH):* Các trường thông tin cố định của hệ thống (Entity ID, ACS URL) hiển thị dưới dạng ô input cho phép chỉnh sửa thay vì Read-only.

### 2.8. TenantAdminSecurityPage.tsx
*   **Lỗi logic & i18n:**
    *   *Sai key path thời gian (HIGH):* Hàm `timeAgo` tham chiếu tới `common.justNow`, `common.minutesAgo`,... các key này chỉ tồn tại dưới dạng `tenantHome.justNow`,...
    *   *Thiếu trường hiển thị (MEDIUM):* Chỉ hiển thị `login_at` mà không hiển thị `last_active_at` của phiên hoạt động.

### 2.9. TenantAdminWebhooksPage.tsx
*   **Lỗi logic & Bảo mật:**
    *   *🚨 Bỏ qua phân quyền truy cập (CRITICAL):* Trang này hoàn toàn thiếu kiểm tra quyền hạn thông qua `ability`.
    *   *🚨 Stale closure hiển thị Secret (CRITICAL):* Đọc biến state `secretReveal` ngay sau khi set bằng `setSecretReveal`, khiến modal đóng lập tức và ẩn mất mã secret key vừa tạo.
    *   *Thiếu i18n event keys (MEDIUM):* Thiếu các khóa sự kiện như `eventMember`, `eventPAT` ở cả hai tệp ngôn ngữ.

### 2.10. TenantAdminAuditLogsPage.tsx
*   **Lỗi logic:**
    *   *Biểu đồ thống kê sai lệch (HIGH):* Các biểu đồ tròn và bar chart thống kê hoạt động được tính toán dựa trên dữ liệu phân trang hiển thị hiện tại (20-50 dòng), không phản ánh đúng phân bổ của toàn bộ hệ thống logs.

### 2.11. TenantAdminReportsPage.tsx
*   **Lỗi logic:**
    *   *Nút tạo mới bị ẩn (HIGH):* Nút tạo báo cáo định kỳ biến mất khi danh sách đã có dữ liệu (chỉ hiển thị ở Empty State).
    *   *Không hỗ trợ chỉnh sửa (MEDIUM):* Chỉ cho phép tạo mới và xóa, không hỗ trợ sửa cấu hình email nhận tin hay tần suất gửi.

---

## 3. Kế hoạch hành động điều chỉnh (Action Plan)

### Giai đoạn 1: Khắc phục 5 Lỗi nghiêm trọng (CRITICAL)
1.  **WebhooksPage:** Thêm kiểm tra quyền truy cập `ability.can("read", "TenantWebhookView")` và sửa logic hiển thị Secret Key.
2.  **BillingPage:** Kích hoạt luồng Stripe Checkout để nâng cấp gói cước thực tế.
3.  **HomePage:** Chỉ đóng modal Deprovision khi thao tác thành công.
4.  **ServiceAccountsPage:** Ngăn cuộc gọi API khi người dùng không có quyền xem.

### Giai đoạn 2: Sửa đổi 11 Lỗi mức độ cao (HIGH)
1.  **PATsPage:** Đồng bộ múi giờ hết hạn về UTC+7 cục bộ của người dùng.
2.  **SSOPage:** Đưa SP Entity ID / SP ACS URL về chế độ Read-only.
3.  **UsagePage:** Xử lý và hiển thị thông báo lỗi thay vì nuốt lỗi im lặng.
4.  **SecurityPage:** Sửa key path hiển thị thời gian của `timeAgo`.
5.  **AuditLogsPage:** Sửa logic thu thập dữ liệu thống kê biểu đồ.
6.  **ReportsPage:** Giữ hiển thị nút tạo mới báo cáo khi danh sách có sẵn dữ liệu.
