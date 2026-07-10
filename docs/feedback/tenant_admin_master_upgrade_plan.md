# KẾ HOẠCH TỔNG THỂ NÂNG CẤP TENANT ADMIN CONSOLE ĐẠT CHUẨN QUỐC TẾ
**Dự án:** VNInvest Workspace  
**Tác giả:** Antigravity (Advanced Agentic Coding Agent)  
**Tài liệu:** `docs/feedback/tenant_admin_master_upgrade_plan.md`  
**Trạng thái:** Sẵn sàng thảo luận nhóm  

---

## 1. Tổng Quan Kiến Trúc Đề Xuất (Architecture Target-State)

Mục tiêu là chuyển đổi Tenant Admin Console của VNInvest từ mô hình MVP định danh tĩnh (Owner-based) sang kiến trúc **Multi-Tenant SaaS chuẩn doanh nghiệp**. Hệ thống mới sẽ hỗ trợ:
1. Phân giải không gian làm việc động (Dynamic Tenant Resolution) qua HTTP Header.
2. Kiểm tra an ninh per-request thông qua quan hệ Thành viên (`TenantMember`) thay vì quan hệ Sở hữu (`owner_user`).
3. Tích hợp thanh toán toàn cầu (Stripe Billing Portal) song song với cổng nội địa (VNPay).
4. Khả năng tuân thủ doanh nghiệp (Enterprise Compliance) qua Audit Logs và Giới hạn IP cho API Token.

```
+-------------------------------------------------------------------------+
|                         React Frontend (packages/web)                   |
|   +-------------------+  +--------------------+  +-------------------+  |
|   |  Tenant Switcher  |  |  Audit Logs Panel  |  | Checkbox Policies |  |
|   +-------------------+  +--------------------+  +-------------------+  |
+------------------------------------+------------------------------------+
                                     |
                          Header: X-Tenant-ID: <UUID>
                                     |
+------------------------------------+------------------------------------+
|                         Django Backend (packages/core)                  |
|   +-----------------------------------------------------------------+   |
|   | 1. TenantResolutionMiddleware (Parse Header & Validate Roles)   |   |
|   +-----------------------------------------------------------------+   |
|   | 2. TenantQuotaMiddleware (Redis Quota Metering & Rate Limit)    |   |
|   +-----------------------------------------------------------------+   |
|   | 3. API Views (Utilize request.tenant for Scoped Queries)        |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

---

## 2. Chi Tiết Kế Hoạch 3 Giai Đoạn (Detailed Phase Breakdown)

### GIAI ĐOẠN 1: Tái Cấu Trúc Cốt Lõi, Di Cư UI & Audit Logs (Ngắn hạn - 3 tuần)

Tập trung sửa chữa lỗ hổng phân quyền nghiêm trọng nhất (Gap #1), di cư UI sang cấu trúc SaaS Native, và hiển thị Audit Logs.

#### 1. Backend: Phân giải Tenant & Phân quyền Dynamic (P0)
* **Middleware mới (`TenantResolutionMiddleware`):**
  * Chạy ngay sau Authentication Middleware của Django.
  * Đọc header `X-Tenant-ID`. Nếu trống, tìm tenant do user sở hữu. Nếu vẫn trống, tìm tenant đầu tiên user làm thành viên.
  * Truy vấn bảng `TenantMember` để lấy vai trò (`RoleChoices`) của người dùng đối với tenant đó.
  * Nếu không có quyền thành viên, trả về `403 Forbidden`.
  * Nếu tenant có trạng thái `SUSPENDED` hoặc `DEPROVISIONED`, trả về `403 Forbidden` kèm thông báo tài khoản bị khóa.
  * Gán `request.tenant` và `request.tenant_role` để các view phía sau sử dụng.
* **Refactor Views hiện có:**
  * Sửa toàn bộ các câu query trong `views_tenant.py` và `tenant_member_views.py` từ lọc theo `owner_user=request.user` sang `tenant=request.tenant`.

#### 2. Backend: API Nhật ký vận hành (Audit Logs API) (P1)
* **Endpoint:** `GET /api/core/v1/partner/audit-logs/`
* **Phân trang:** Sử dụng `CoreCursorPagination` (phân trang dựa trên con trỏ để bảo đảm hiệu năng khi logs lớn).
* **Tham số lọc:** Hỗ trợ `?event_type=`, `?start_date=`, `?end_date=`.
* **Dữ liệu trả về:** 
  * `event_type`: Loại sự kiện (Ví dụ: `member_invited`, `pat_rotated`).
  * `actor_username`: Username của người thực hiện hành động.
  * `ip_address`: Địa chỉ IP thực hiện.
  * `old_value` và `new_value`: Dữ liệu JSON ghi nhận sự thay đổi giá trị.
  * `created_at`: Thời điểm diễn ra.

#### 3. Frontend: Di cư UI sang `packages/web` & Tích hợp Shell (P1)
* **Di chuyển file:** Dọn dẹp legacy UI, chuyển toàn bộ component sang `packages/web/src/pages/tenant-admin/` dưới dạng file `.js`.
* **Đăng ký Route:** Tích hợp vào `packages/web/src/pages/pageRegistry.js` các route:
  * `/tenant-admin/home` (Home Dashboard)
  * `/tenant-admin/members` (Quản lý thành viên & Lời mời)
  * `/tenant-admin/service-accounts` (Quản lý tài khoản máy)
  * `/tenant-admin/pats` (Quản lý API Token)
  * `/tenant-admin/usage` (Hạn mức sử dụng)
  * `/tenant-admin/billing` (Hóa đơn & Cước)
  * `/tenant-admin/audit-logs` (Màn hình Nhật ký vận hành mới)
* **Xây dựng Tenant Switcher:** Tạo dropdown selector trên Header. Khi user chuyển đổi tenant, lưu `tenant_id` mới vào `localStorage` và tự động reload trang để đính kèm header `X-Tenant-ID` mới.

---

### GIAI ĐOẠN 2: Stripe Billing Portal, Trực Quan Hóa Quota & Checkbox Policies (Trung hạn - 4 tuần)

Cải thiện trải nghiệm thanh toán quốc tế (Gap #5), quản lý trực quan scopes (Gap #2), và vẽ đồ thị sử dụng (Gap #4).

#### 1. Backend: Tích hợp Stripe Billing Portal (P2)
* **API Phiên thanh toán:** `POST /api/core/v1/billing/stripe/session/` tạo Stripe Checkout Session để khách hàng đăng ký cước (Starter, Pro, Enterprise).
* **API Cổng tự phục vụ:** `POST /api/core/v1/billing/stripe/portal/` trả về đường dẫn Stripe Customer Portal.
* **Webhook xử lý sự kiện:** Lắng nghe webhook từ Stripe để đồng bộ cước về bảng `Invoice` và cập nhật trường `plan` của `CoreTenant` trong PostgreSQL.
  * Sự kiện: `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`.

#### 2. Frontend: Checkbox Policies thay ô nhập Scopes (P1)
* Tại màn hình cấp phát PAT và Service Account, thay thế trường nhập chữ bằng giao diện Checkbox trực quan ánh xạ 6 policies tĩnh trong hệ thống:
  1. `pol_market_read` (Đọc dữ liệu thị trường)
  2. `pol_signals_read` (Đọc tín hiệu cá mập)
  3. `pol_ai_invoke` (Gọi AI Advisory)
  4. `pol_manage_pats` (Quản trị API Token)
  5. `pol_manage_service_accounts` (Quản trị SA)
  6. `pol_manage_tenant` (Quản lý thông tin Tenant)

#### 3. Frontend: Trực quan hóa dữ liệu sử dụng bằng Biểu đồ (P2)
* **Backend API:** Xây dựng endpoint `GET /api/core/v1/partner/usage/history/` lấy dữ liệu lịch sử gọi API theo ngày trong vòng 30 ngày từ bảng `QuotaRecord` hoặc từ Redis lưu trữ.
* **Frontend Chart:** Sử dụng thư viện `Recharts` để vẽ biểu đồ dạng Area/Bar Chart hiển thị tần suất gọi API của Tenant giúp lập trình viên dễ dàng theo dõi thời điểm cao điểm sử dụng API.

---

### GIAI ĐOẠN 3: Đăng Nhập Doanh Nghiệp (SAML SSO) & Giới Hạn IP Cho Token (Dài hạn - 3 tuần)

Hoàn thiện các tính năng bảo mật cấp Enterprise để bán gói cước cho khách hàng tổ chức lớn.

#### 1. Backend & Frontend: Cấu hình Enterprise SAML SSO (P3)
* **Tích hợp dịch vụ:** Tích hợp với SDK của WorkOS hoặc Auth0 tại backend để xử lý đăng nhập qua SAML 2.0 / OIDC (Okta, Azure AD).
* **Giao diện tự phục vụ:** Cung cấp trang cấu hình `/tenant-admin/sso` cho phép Tenant Owner tải lên file metadata XML hoặc dán link cấu hình IdP (Identity Provider) của họ để cấu hình đăng nhập riêng cho nhân viên trong công ty.

#### 2. Bảo mật API Token qua Dải IP (CIDR Whitelisting) (P2)
* **Model:** Thêm trường `allowed_cidr_blocks` (mảng JSON các dải IP, ví dụ: `["1.1.1.1/32", "192.168.1.0/24"]`) vào model `CorePATCredential`.
* **Xác thực an toàn:** Trong hàm authenticate của `CorePATAuthentication`, lấy ra IP nguồn của request (`client_ip`) và kiểm tra đối chiếu xem có nằm trong dải IP cho phép của PAT đó hay không bằng thư viện `ipaddress` của Python. Nếu nằm ngoài dải, từ chối request ngay lập tức với lỗi `403 Forbidden`.
* **Giao diện cấu hình:** Bổ sung ô nhập dải IP (tùy chọn) khi Tenant tạo mới hoặc chỉnh sửa PAT Credentials.

---

## 3. Kế Hoạch Đảm Bảo Chất Lượng & Kiểm Thử (Quality Gates)

### 1. Phép thử tự động (Backend Testing)
Tất cả các tính năng backend mới phải được bao phủ bằng unit test đạt trên 85% độ phủ dòng lệnh (coverage):
* `test_tenant_resolution_middleware.py`:
  * Test 1: Header `X-Tenant-ID` đúng -> resolves correct tenant.
  * Test 2: Header `X-Tenant-ID` sai -> 403 Forbidden.
  * Test 3: Không có header -> fallback owner -> resolved.
  * Test 4: Không có header, không là owner, có là member -> fallback member -> resolved.
  * Test 5: Tenant status là SUSPENDED -> 403 Forbidden.
* `test_audit_logs_api.py`:
  * Test 1: Đọc lịch sử logs -> lọc đúng logs của tenant gọi API.
  * Test 2: Thử đọc logs tenant khác -> 403 Forbidden/Empty.

### 2. Manual Verification Checklist (Frontend QA)
* Kiểm tra việc đồng bộ session khi switch tenant trên giao diện (tất cả các pane KLine, Watchlist, Portfolios phải thay đổi dữ liệu theo đúng Tenant được chọn).
* Thử cấu hình sai scope bằng checkbox và xác minh backend trả về lỗi đúng như phân quyền mong muốn.
