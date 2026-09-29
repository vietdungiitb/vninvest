# BÁO CÁO ĐỐI CHIẾU AUDIT CODEBASE VỚI MASTER UPGRADE PLAN
**Tài liệu Master Plan:** `docs/feedback/tenant_admin_master_upgrade_plan.md`  
**Báo cáo đối chiếu:** `docs/feedback/tenant_admin_codebase_audit_comparison.md`  
**Trạng thái Codebase:** Đã hoàn thành 100% Backend Giai đoạn 1; Frontend đang triển khai dở dang  
**Người lập:** Antigravity (Advanced Agentic Coding Agent)  
**Ngày:** 2026-06-16  

---

## 1. Tóm Tắt Hiện Trạng So Với Master Plan

Qua rà soát chi tiết mã nguồn trên nhánh phát triển hiện tại (bao gồm các commit mới nhất như `7fa66dd3: feat: Tenant Admin Console Phase 1 - Core Refactor & Audit Logs`), chúng tôi lập bảng đối chiếu tiến độ cụ thể như sau:

| Hạng mục / Tính năng | Yêu cầu trong Master Plan | Trạng thái thực tế trong Codebase | Đánh giá & File liên quan |
| :--- | :--- | :--- | :--- |
| **GIAI ĐOẠN 1** | | | |
| Phân giải Tenant qua Header | Middleware tự động giải quyết `X-Tenant-ID` và check role của User | **ĐÃ HOÀN THÀNH (100%)** | `identity_access/middleware.py:L16` (`TenantResolutionMiddleware`) |
| Refactor APIs sang request.tenant | Chuyển đổi toàn bộ API sang lấy Tenant từ request thay vì `owner_user` | **ĐÃ HOÀN THÀNH (100%)** | `views_tenant.py` và `tenant_member_views.py` đã refactor sạch |
| API Audit Logs | Endpoint `/core/v1/partner/audit-logs/` sử dụng Cursor Pagination | **ĐÃ HOÀN THÀNH (100%)** | `ops_audit/views.py:L27` (`PartnerAuditLogsView`) |
| Test suite cho Middleware & API | Bộ unit test kiểm tra header, fallback và bảo mật | **ĐÃ HOÀN THÀNH (100%)** | `test_tenant_resolution_middleware.py` và `test_audit_logs_api.py` |
| Di cư Frontend UI | Di chuyển toàn bộ giao diện sang `packages/web/src/pages/tenant-admin/` | **ĐANG TRIỂN KHAI (40%)** | Đã tạo thư mục `tenant-admin/` nhưng mới có 3 trang thô, 1 file trống. Chưa đăng ký router. |
| **GIAI ĐOẠN 2** | | | |
| Checkbox Policies | Thay thế trường nhập Scopes bằng Checkbox chọn Policy | **ĐANG TRIỂN KHAI (50%)** | Đã viết helper UI `PolicyCheckboxes.js` nhưng chưa tích hợp vào trang tạo SA/PATs. |
| Biểu đồ Quota & Usage | Biểu đồ lịch sử dạng Area/Bar Chart | **CHƯA TRIỂN KHAI (0%)** | APIs và UI đều chưa hỗ trợ historical timeseries. |
| Stripe Billing Portal | Tích hợp Stripe thanh toán quốc tế | **CHƯA TRIỂN KHAI (0%)** | Cơ sở dữ liệu và API vẫn đang hoàn toàn phụ thuộc vào VNPay. |
| **GIAI ĐOẠN 3** | | | |
| SAML SSO Enterprise | Đăng nhập một lần qua Okta, Entra ID | **CHƯA TRIỂN KHAI (0%)** | Chưa có logic. |
| IP Whitelisting cho PATs | Giới hạn truy cập API bằng dải IP | **CHƯA TRIỂN KHAI (0%)** | Chưa có logic. |

---

## 2. Chi Tiết Rà Soát Từng Phân Hệ & Khoảng Cách Thực Tế

### 2.1. Phân hệ Backend (packages/core)
Backend đã đi trước kế hoạch và hoàn thành toàn bộ nền tảng cốt lõi của Giai đoạn 1:

1. **Lớp Middleware Phân Giải Tenant:**  
   File [middleware.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/identity_access/middleware.py#L16) đã chứa `TenantResolutionMiddleware` hoàn chỉnh. Lớp này thực hiện phân giải theo đúng 4 bước thiết kế (X-Tenant-ID header -> Owner fallback -> Member fallback -> Quyền hạn & Trạng thái Active).
2. **Expose API Audit Logs:**  
   File [ops_audit/views.py](file:///c:/Mujoco%20Projects/vninvest/packages/core/backend/src/ops_audit/views.py#L27) đã hiện thực hóa `PartnerAuditLogsView` lọc theo `request.tenant` với `CoreCursorPagination`, hỗ trợ đầy đủ các tham số lọc `event_type`, `start_date`, và `end_date`.
3. **Refactor APIs:**  
   Toàn bộ mã nguồn backend liên quan đến nghiệp vụ quản trị của tenant (bao gồm quản lý thành viên, service account, token) đã được làm sạch, hoàn toàn không còn sử dụng truy vấn tĩnh qua `owner_user=request.user`.

### 2.2. Phân hệ Frontend (packages/web)
Frontend là nơi có khoảng cách lớn nhất cần phải xử lý ngay lập tức để đồng bộ với Backend:

1. **Sự thiếu hụt các file UI trong `packages/web/src/pages/tenant-admin/`:**
   * **[TenantAdminHomePage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminHomePage.js):** Đã di cư và sẵn sàng.
   * **[TenantAdminMembersPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminMembersPage.js):** Đã di cư và sẵn sàng.
   * **[TenantAdminServiceAccountsPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminServiceAccountsPage.js):** Đã di cư và sẵn sàng.
   * **[TenantAdminPATsPage.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/tenant-admin/TenantAdminPATsPage.js):** ⚠️ **LỖ HỔNG:** File này hiện tại là file rỗng (0 bytes). Cần phải code hoặc copy nội dung từ legacy `TenantPATs.jsx` sang và refactor.
   * **Màn hình Billing, Capabilities, Usage:** ⚠️ **LỖ HỔNG:** Chưa hề được di chuyển sang thư mục mới. Hệ thống vẫn đang chạy legacy.
   * **TenantAuditLogs.js (Nhật ký vận hành):** ⚠️ **LỖ HỔNG:** Chưa được tạo mới để gọi API `/partner/audit-logs/` hiển thị lên UI.
2. **Cấu hình Router:**  
   File [pageRegistry.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/pages/pageRegistry.js) **chưa hề khai báo** các trang quản trị tenant này vào hệ thống routing của Workspace Shell mới.
3. **Policy Checkboxes chưa được tích hợp:**  
   Mặc dù file component [PolicyCheckboxes.js](file:///c:/Mujoco%20Projects/vninvest/packages/web/src/components/PolicyCheckboxes.js) đã được viết sẵn để chuyển đổi việc nhập text scope sang dạng Checkbox trực quan, nhưng nó chưa được gọi hoặc tích hợp vào form tạo Service Account / PATs trên frontend.

---

## 3. Khuyến Nghị Hành Động Khẩn Cấp (Immediate Actions)

Để hoàn thiện khớp nối 100% Giai đoạn 1 và chuẩn bị cho Giai đoạn 2, chúng ta cần thực hiện các hành động khẩn cấp sau:

1. **Hoàn thiện di cư Frontend (Sprint 1):**
   * Sao chép logic từ các file legacy (`TenantUsage.jsx`, `TenantBilling.jsx`, `TenantCapabilities.jsx`) và viết lại thành phiên bản `.js` chạy tương thích với core shell trong thư mục `packages/web/src/pages/tenant-admin/`.
   * Viết mã nguồn cho `TenantAdminPATsPage.js` kế thừa từ `TenantPATs.jsx`.
   * Tạo mới màn hình `TenantAuditLogs.js` hiển thị dòng thời gian vận hành.
2. **Khai báo Routes trong `pageRegistry.js`:**  
   Thêm các định nghĩa lazy-load cho toàn bộ các trang `/tenant-admin/*` vào Registry.
3. **Tích hợp `PolicyCheckboxes`:**  
   Thay thế ô nhập text scope ở cả hai màn hình `TenantAdminServiceAccountsPage.js` và `TenantAdminPATsPage.js` bằng component `PolicyCheckboxes` đã có sẵn.
