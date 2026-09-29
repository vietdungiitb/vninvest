# KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT - GIAI ĐOẠN 1
**Tài liệu gốc:** `docs/feedback/tenant_admin_audit_report.md`  
**Phản hồi:** `docs/feedback/tenant_admin_audit_report_AGENT_FEEDBACK_RESPONSE.md`  
**Kế hoạch:** `docs/feedback/tenant_admin_action_plan_PHASE_1.md`  
**Người lập:** Antigravity (Advanced Agentic Coding Agent)  
**Ngày:** 2026-06-16  

---

## 1. Giải quyết 3 Câu Hỏi Mở (Open Questions)

### ❓ Câu 1: Định nghĩa Scopes có cần Migration cơ sở dữ liệu không?
* **Trả lời:** **KHÔNG cần migration cơ sở dữ liệu mới.** 
* **Giải thích:** Các scopes (`market:read`, `signals:read`, `ai:invoke`...) thực tế là các chuỗi text canonical được lưu trữ trực tiếp dưới dạng Array/JSON trong các trường `scopes` của model `CoreServiceAccount` và `CorePATCredential`. Phép ánh xạ tĩnh này được định nghĩa tại `POLICY_TO_SCOPE_CODES` trong `serializers.py` và đã được migrate dữ liệu cũ thông qua file migration `0007_canonicalize_service_account_scope_codes.py`. Do đó, chúng ta có thể tái sử dụng trực tiếp các mapping này mà không cần động chạm tới DB schema.

### ❓ Câu 2: Các file trong `packages/web/` đã có cấu trúc chưa?
* **Trả lời:** **Chưa có thư mục tenant-admin.**
* **Giải thích:** Phân hệ `packages/web/src/pages/` hiện tại chưa chứa folder `tenant-admin`. Chúng ta sẽ tạo mới thư mục `packages/web/src/pages/tenant-admin/` và di chuyển mã nguồn từ legacy `frontend/src/pages/admin/tenant/` sang, chuyển đổi phần mở rộng file thành `.js` để đồng bộ với cấu trúc modern shell của `packages/web`.

### ❓ Câu 3: Có cần viết integration test cho `TenantResolutionMiddleware` không?
* **Trả lời:** **CÓ, bắt buộc.**
* **Giải thích:** Đây là tính năng bảo mật P0 kiểm soát per-request. Chúng ta sẽ viết file test độc lập `packages/core/backend/src/identity_access/tests/test_tenant_resolution_middleware.py` để chạy thử nghiệm các trường hợp: gửi header hợp lệ, không gửi header (fallback owner/member), chặn khi tenant bị Suspended, và chặn truy cập trái phép (403).

---

## 2. Kế Hoạch Triển Khai Chi Tiết (Phase 1 Proposed Changes)

### 2.1. Backend (packages/core)
* **[NEW] test_tenant_resolution_middleware.py:** Viết test suite bao phủ toàn bộ các kịch bản middleware.
* **[MODIFY] middleware.py:** 
  * Hiện thực hóa lớp `TenantResolutionMiddleware` đặt trước các middleware nghiệp vụ.
  * Tối ưu hóa `TenantQuotaMiddleware` sử dụng trực tiếp `request.tenant` thay vì tự truy tìm theo `owner_user`.
* **[MODIFY] views_tenant.py & tenant_member_views.py:** Refactor toàn bộ các class View, thay thế `CoreTenant.objects.get(owner_user=request.user)` thành `request.tenant`.
* **[MODIFY] views_tenant.py:** Viết thêm class `PartnerAuditLogsView` để expose nhật ký vận hành ra API.
* **[MODIFY] partner_urls.py:** Khai báo route `/core/v1/partner/audit-logs/`.

### 2.2. Frontend (packages/web)
* **[NEW] packages/web/src/pages/tenant-admin/:** Di cư 7 trang UI legacy sang, đổi tên đuôi file thành `.js`.
* **[NEW] TenantAuditLogs.js:** Xây dựng màn hình xem nhật ký vận hành (Audit Logs) dạng timeline trực quan.
* **[MODIFY] pageRegistry.js:** Đăng ký các route động của phân hệ `/tenant-admin/*`.
* **[MODIFY] TenantPATs.js:** Thay thế text input của scopes bằng danh sách Checkbox tương ứng với 6 Policy.

---

## 3. Kế Hoạch Kiểm Thử (Verification Plan)

### Kiểm thử tự động:
Chạy lệnh kiểm thử độc lập cho middleware mới:
```bash
pytest packages/core/backend/src/identity_access/tests/test_tenant_resolution_middleware.py
```

### Kiểm thử thủ công:
1. Đăng nhập môi trường local dev, truy cập `/tenant-admin/home`.
2. Kiểm tra xem các API calls đã tự đính kèm header `X-Tenant-ID` chưa.
3. Tạo Service Account mới sử dụng checkbox và xác nhận dữ liệu được ghi đúng vào database.
4. Xoay vòng hoặc thu hồi PAT, kiểm tra xem sự kiện có xuất hiện ngay lập tức trên màn hình **Audit Logs** mới hay không.
