# BÁO CÁO AUDIT CODEBASE & LỘ TRÌNH HOÀN THÀNH GIAI ĐOẠN 2 & GIAI ĐOẠN 3
**Dự án:** VNInvest Workspace  
**Tài liệu:** `docs/feedback/tenant_admin_phases_2_3_audit_report.md`  
**Trạng thái:** Sẵn sàng thảo luận  
**Ngày thực hiện:** 2026-06-16  

---

## 1. Kết Quả Audit Thực Tế (Codebase vs Master Plan)

Chúng tôi đã thực hiện quét và đối chiếu toàn bộ codebase (`packages/core` và `packages/web`) đối với các yêu cầu của **Giai đoạn 2** và **Giai đoạn 3** trong kế hoạch nâng cấp tổng thể:

| Giai đoạn | Tính năng / Yêu cầu | Trạng thái codebase hiện tại | Khoảng cách kỹ thuật (Gaps) | Đánh giá an ninh & Độ phức tạp |
| :--- | :--- | :--- | :--- | :--- |
| **GIAI ĐOẠN 2** | **Checkbox Policies** | **Hoàn thành 100%** | Không có. UI đã có component `PolicyCheckboxes.js` và `TenantAdminPATsPage.js` đã tích hợp đầy đủ. | Thấp |
| | **Biểu đồ Quota & Usage** | **Hoàn thành 50% (Backend)** | **Frontend Gap:** Màn hình `TenantAdminUsagePage.js` mới hiển thị các chỉ số tĩnh, chưa tích hợp thư viện `Recharts` để vẽ biểu đồ historical timeseries 30 ngày từ API `/partner/usage/history/`. | Trung bình |
| | **Stripe Billing Portal** | **Hoàn thành 60% (Backend)** | **Frontend Gap:** Màn hình `TenantAdminBillingPage.js` và `BillingCenterPage.js` chưa có nút bấm và giao diện chuyển hướng nâng cấp cước (Stripe Checkout) hoặc quản lý đăng ký tự phục vụ (Stripe Portal).<br>**Backend Bug:** File `commercial/views.py` dùng `stripe.error.StripeError` mà quên import `stripe` ở đầu file (sẽ gây lỗi `NameError` khi xảy ra exception). | Trung bình |
| **GIAI ĐOẠN 3** | **SAML SSO Enterprise** | **Chưa triển khai (0%)** | **Backend & Frontend Gap:** Hoàn toàn chưa có Model lưu cấu hình SSO (`TenantSSOConfig`), chưa có API config, chưa có luồng SSO Login và Callback. | Cao |
| | **IP Whitelisting cho PATs** | **Chưa triển khai (0%)** | **Backend & Frontend Gap:** Model `CorePATCredential` thiếu trường cấu hình dải IP (`allowed_cidr_blocks`). Bộ lọc xác thực `CorePATAuthentication` chưa hỗ trợ so khớp IP mạng CIDR. Giao diện tạo PAT thiếu ô nhập. | Trung bình |

---

## 2. Giải Pháp Kỹ Thuật Chi Tiết (Technical Specification)

### 2.1. Sửa Lỗi Regression Test Suite (Độ ưu tiên: P0)
* **Vấn đề:** Khi chạy test suite `tests.test_identity_access`, 11/21 test cases bị lỗi `403 Forbidden` do client giả lập xác thực bằng `force_authenticate` (DRF) đi qua middleware `TenantResolutionMiddleware` khi `request.user` vẫn là AnonymousUser (DRF gán user muộn tại tầng View). Điều này làm thiếu context `request.tenant` và `request.tenant_role`.
* **Giải pháp:** Cập nhật hàm `_get_request_tenant(request)` và `_get_request_tenant_role(request)` trong `views_tenant.py` và `tenant_member_views.py`. Nếu `getattr(request, 'tenant', None)` là `None` nhưng `request.user` đã được xác thực, thực hiện phân giải nóng theo trình tự:
  1. Header `X-Tenant-ID`.
  2. Fallback sang tenant do user làm Owner.
  3. Fallback sang tenant đầu tiên user làm Member.
  Gán trực tiếp `request.tenant` và `request.tenant_role` để xử lý kịp thời.

### 2.2. Bảo Mật API Token qua Dải IP (CIDR Whitelisting) (Độ ưu tiên: P1)
* **Backend:**
  - Bổ sung trường `allowed_cidr_blocks = models.JSONField(default=list, blank=True)` vào model `CorePATCredential`.
  - Cập nhật `PartnerPATIssueSerializer` và `PartnerPATRotateSerializer` để tiếp nhận mảng dải IP. Thêm validator xác thực định dạng CIDR hợp lệ bằng thư viện `ipaddress` của Python:
    ```python
    import ipaddress
    for block in value:
        try:
            ipaddress.ip_network(block, strict=False)
        except ValueError:
            raise serializers.ValidationError(f"Dải IP '{block}' không đúng định dạng CIDR.")
    ```
  - Cập nhật `CorePATAuthentication.authenticate` lấy IP nguồn client và kiểm tra:
    ```python
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
    if credential.allowed_cidr_blocks:
        ip_allowed = False
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            for cidr in credential.allowed_cidr_blocks:
                if ip_obj in ipaddress.ip_network(cidr, strict=False):
                    ip_allowed = True
                    break
        except ValueError:
            pass
        if not ip_allowed:
            raise AuthenticationFailed('Địa chỉ IP không được phép truy cập bằng Token này.')
    ```
* **Frontend:**
  - Bổ sung trường nhập text "Giới hạn dải IP (CIDR, phân tách bằng dấu phẩy)" trong modal tạo PAT của `TenantAdminPATsPage.js`.
  - Hiển thị thông tin dải IP cho phép dưới mỗi token card.

### 2.3. Tích Hợp Stripe Billing Portal trên Frontend (Độ ưu tiên: P1)
* **Backend:**
  - Thêm `import stripe` vào đầu `commercial/views.py`.
  - Tích hợp thêm trường `stripe_configured` (boolean) và `has_stripe_customer` (boolean) trong API `/api/core/v1/partner/billing/subscription/` để frontend nhận biết cấu hình.
* **Frontend (`TenantAdminBillingPage.js`):**
  - Fix lỗi hiển thị gói cước hiện tại: Thay thế `subscription?.plan_code` bằng `subscription?.plan` (khớp với model backend).
  - Thiết kế Deck Card hiển thị 3 plan:
    * **Starter**: 100,000 VND / tháng.
    * **Pro**: 500,000 VND / tháng.
    * **Enterprise**: 2,000,000 VND / tháng.
  - Tích hợp các nút hành động:
    * **Nâng cấp gói (Stripe Checkout)**: Gọi `POST /api/core/v1/partner/billing/stripe/session/` với body `{ plan: selected_plan, success_url: window.location.href, cancel_url: window.location.href }`, sau đó chuyển hướng `window.location.href = res.url`.
    * **Quản trị hóa đơn (Stripe Portal)**: Gọi `POST /api/core/v1/partner/billing/stripe/portal/` với body `{ return_url: window.location.href }`, sau đó chuyển hướng `window.location.href = res.url`.

### 2.4. Trực Quan Hóa Quota Tiêu Thụ bằng Recharts (Độ ưu tiên: P2)
* **Frontend (`TenantAdminUsagePage.js`):**
  - Import các component biểu đồ từ thư viện `recharts`.
  - Dưới mỗi dòng tài nguyên tiêu thụ (API Calls, Symbols, Users, Storage), thêm nút "Xem lịch sử biểu đồ".
  - Khi click mở rộng, gọi API `GET /api/core/v1/partner/usage/history/?meter_code={meter_code}&days=30` và vẽ `AreaChart` mượt mà, sử dụng gradient neon phù hợp với tone màu dark mode cao cấp của VNInvest.

### 2.5. Đăng Nhập Doanh Nghiệp SAML SSO (Độ ưu tiên: P2)
* **Backend:**
  - Tạo model `TenantSSOConfig` liên kết OneToOne với `CoreTenant`, lưu trữ: `is_enabled`, `idp_entity_id`, `idp_sso_url`, `idp_x509_cert`, `domain_hint`.
  - Viết API cấu hình `/api/core/v1/partner/sso/` (PartnerSSOConfigView).
  - Viết API đăng nhập `/api/core/v1/auth/sso/login/` nhận `?domain=company.com` hoặc `?email=user@company.com`, truy vấn cấu hình và sinh redirect URL (cho phép mock SSO chuyển tiếp).
  - Viết API callback `/api/core/v1/auth/sso/callback/` nhận dữ liệu callback, phân giải User dựa trên email, bỏ qua mật khẩu và cấp phát PAT dynamic (human session) trả về payload giống hệt `/auth/login/`.
* **Frontend:**
  - Đăng ký route `/tenant-admin/sso` trong `pageRegistry.js`.
  - Tạo mới trang `TenantAdminSSOPage.js` cung cấp giao diện điền thông số IdP SAML 2.0 và lưu cấu hình cho Workspace.

---

## 3. Lộ Trình Thực Hiện & Kiểm Thử (Remediation Roadmap)

1. **Bước 1: Sửa đổi Model & Migration (Day 1)**
   - Thêm các trường dữ liệu và model mới vào `identity_access/models.py`.
   - Chạy `python manage.py makemigrations` và `python manage.py migrate`.
2. **Bước 2: Xử lý Logic Backend & Sửa Test Suite (Day 2)**
   - Cập nhật cơ chế phân giải nóng trong views để khắc phục lỗi 403.
   - Hiện thực hóa whitelist IP và SAML SSO views.
   - Đảm bảo toàn bộ unit tests vượt qua với độ phủ dòng lệnh >85%.
3. **Bước 3: Hoàn thiện UI Frontend & Charts (Day 3-4)**
   - Cập nhật trang Billing (Stripe checkout/portal).
   - Tích hợp Recharts vẽ biểu đồ lịch sử tiêu thụ trong Usage.
   - Thêm ô nhập IP whitelist trong PATs và tạo trang cấu hình SSO.
