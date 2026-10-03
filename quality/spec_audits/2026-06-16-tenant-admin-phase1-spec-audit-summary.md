# SPEC AUDIT TRIAGE SUMMARY - Tenant Admin Console Phase 1

**Date:** 2026-06-16  
**Auditors:** Council of Three (Simulated AI Session)  
**Target:** Tenant Admin Console Phase 1 & SaaS Core API Invariants  
**Status:** ✅ AUDIT COMPLETE (NO-CODE REVIEW)

---

## 1. Mục tiêu Audit

Thực hiện rà soát chéo chất lượng thiết kế (Spec Audit) đối với gói nâng cấp **Tenant Admin Console Phase 1** và các vấn đề mã nguồn được tổng hợp tại [AUDIT_CODEBASE_SUMMARY_20260616.md](file:///C:/Mujoco%20Projects/vninvest/docs/AUDIT_CODEBASE_SUMMARY_20260616.md) & [TASK_APPROVAL.md](file:///C:/Mujoco%20Projects/vninvest/docs/feedback/TASK_APPROVAL.md). 

Mục tiêu chính: Phát hiện các lỗ hổng logic, rủi ro bảo mật (data semantics), lỗi kiến trúc frontend và rủi ro hồi quy (regression) trước khi nhóm bắt tay vào viết code triển khai.

---

## 2. Kết quả Triage (Đã tổng hợp từ 3 góc độ)

### 🔴 P0/P1 - Rủi ro nghiêm trọng (Cần điều chỉnh Spec/Thiết kế ngay)

#### 1. Lỗ hổng rò rỉ dữ liệu do cơ chế Fallback Tenant ngẫu nhiên (Auditor A)
* **Vị trí:** `tenant_admin_action_plan_PHASE_1.md`, mục 2.1 (Backend - `TenantResolutionMiddleware`).
* **Phát hiện:** Khi yêu cầu không đính kèm header `X-Tenant-ID`, middleware sẽ tìm kiếm tenant do user sở hữu (owner). Nếu không có, nó fallback sang **tenant đầu tiên** mà user làm thành viên (`TenantMember.objects.filter(user=user).first()`).
* **Rủi ro:** Nếu một người dùng (ví dụ: nhân viên hỗ trợ hoặc lập trình viên kiểm thử) là thành viên của nhiều tenant (Tenant X, Tenant Y), việc gọi hàm `.first()` không có sắp xếp (`order_by`) sẽ trả về kết quả ngẫu nhiên phụ thuộc vào cơ sở dữ liệu. Người dùng có thể vô tình thao tác trên dữ liệu của tenant khác mà không hề hay biết do hệ thống tự động gán nhầm context.
* **Khuyến nghị:** 
  * Bắt buộc loại bỏ cơ chế "tự đoán" tenant khi user thuộc nhiều tenant. 
  * Nếu thiếu header `X-Tenant-ID` và user thuộc từ 2 tenant trở lên, trả về lỗi `400 Bad Request` yêu cầu chỉ định rõ Tenant ID cần truy cập.

#### 2. Lỗi Race Condition và lẫn lộn dữ liệu do sử dụng localStorage (Auditor B)
* **Vị trí:** `tenant_admin_master_upgrade_plan.md`, mục 3 (Giai đoạn 1 - *Xây dựng Tenant Switcher*).
* **Phát hiện:** Spec yêu cầu lưu `tenant_id` được chọn vào `localStorage` của trình duyệt, sau đó reload trang để Header đính kèm `X-Tenant-ID` mới.
* **Rủi ro:** `localStorage` được chia sẻ chung giữa tất cả các tab của cùng một trình duyệt. Nếu người quản trị mở Tab A để quản lý Tenant 1 và Tab B để quản lý Tenant 2, việc chuyển đổi tenant ở Tab B sẽ ghi đè giá trị `tenant_id` trong `localStorage`. Khi Tab A thực hiện một hành động (như xóa thành viên), request của Tab A sẽ đính kèm `X-Tenant-ID` của Tenant 2, dẫn đến xóa nhầm thành viên ở Tenant 2.
* **Khuyến nghị:**
  * Không lưu Tenant ID ở cấp độ toàn cục của trình duyệt (`localStorage`).
  * Sử dụng `sessionStorage` (chỉ giới hạn trong phạm vi tab hiện tại) hoặc nhúng trực tiếp Tenant ID vào URL route (ví dụ: `/tenant-admin/:tenant_id/home`) để cách ly trạng thái hoạt động giữa các tab.

#### 3. Rủi ro chặn đứng luồng chạy Backend do thiếu Database Migration (Auditor C & Database D1)
* **Vị trí:** `AUDIT_CODEBASE_SUMMARY_20260616.md`, mục 3.3 (Database Issues - D1).
* **Phát hiện:** Báo cáo ghi nhận các bảng dữ liệu cho Ticket hệ thống hỗ trợ chưa được migrate sang database SaaS `vninvest_core`. Đồng thời, API Support Ticket đang trả về lỗi 404 (B1).
* **Rủi ro:** Nếu triển khai code backend và routing cho Support Ticket trên `packages/core` trước khi thực hiện chạy migration schema tạo bảng, Django ORM sẽ ném lỗi runtime sập hệ thống (`Relation "support_ticket" does not exist`) ngay khi truy cập vào trang quản trị hỗ trợ.
* **Khuyến nghị:** Chuyển đổi công việc D1 thành **P0 blocker**. Bắt buộc phải viết và áp dụng file migration cơ sở dữ liệu trước khi mount route hoặc kích hoạt view cho Support Ticket API.

---

### 🟡 P2 - Rủi ro logic (Cần rào chắn kỹ thuật)

#### 4. Bottleneck hiệu năng do truy vấn trạng thái SUSPENDED liên tục (Auditor A)
* **Vị trí:** `tenant_admin_master_upgrade_plan.md`, mục 2 (Giai đoạn 1 - *TenantResolutionMiddleware*).
* **Phát hiện:** Middleware thực hiện kiểm tra xem `CoreTenant` có bị khóa (`SUSPENDED`) hoặc thu hồi (`DEPROVISIONED`) hay không trên **mỗi request**.
* **Rủi ro:** Việc truy vấn database PostgreSQL liên tục trên mọi request API sẽ tạo ra điểm nghẽn hiệu năng (bottleneck) lớn khi lượng truy cập tăng cao.
* **Khuyến nghị:** Trạng thái hoạt động của Tenant nên được cache tạm thời trong Redis với thời gian hết hạn (TTL) ngắn (ví dụ: 1 phút) để giảm tải cho database, hoặc sử dụng cơ chế event-driven để invalidate cache khi trạng thái tenant thay đổi.

#### 5. Rủi ro biên dịch lỗi do file rỗng (Auditor B)
* **Vị trí:** `tenant_admin_codebase_audit_comparison.md`, mục 2.2 (Frontend UI).
* **Phát hiện:** Tệp tin `TenantAdminPATsPage.js` hiện tại đã được tạo nhưng có dung lượng 0 bytes.
* **Rủi ro:** Một tệp JS rỗng không có `export default` sẽ làm sập bộ biên dịch (Vite/Webpack) của frontend hoặc gây lỗi runtime trắng màn hình khi router cố tải trang.
* **Khuyến nghị:** Tạo cấu trúc component tối thiểu (stub export) cho `TenantAdminPATsPage.js` ngay lập tức để tránh làm lỗi build pipeline của CI/CD.

---

### 🔵 QUESTION / Cần làm rõ

#### 6. Đồng bộ hóa việc sửa đổi Test Suite và Dọn dẹp Route (Auditor C)
* **Phát hiện:** Trình chạy thử nghiệm (test suite) hiện tại bị lỗi hàng loạt (111 tests hỏng) do xung đột định tuyến của chiến dịch dọn dẹp trước đó (gọi `/api/` thay vì `/core/v1/`).
* **Nghi vấn:** Việc chỉnh sửa URL trong các file test có được gộp chung vào Sprint 2 (khi chỉnh sửa `TenantResolutionMiddleware` và views) hay sẽ được thực hiện riêng lẻ?
* **Khuyến nghị:** Khuyến nghị sửa đổi URL của test suite ngay tại Sprint 2 để đưa bộ test về trạng thái GREEN, làm cơ sở tin cậy trước khi tích hợp các tính năng bảo mật mới của Phase 1.

---

## 3. Khuyến nghị Hướng đi tiếp theo (Rollout Strategy)

1. **Tech Lead / Product Owner:** Chấp thuận các điểm sửa đổi P0/P1 trong tài liệu này và cập nhật lại vào đặc tả kỹ thuật (Spec) của Phase 1.
2. **Backend Team:** Điều chỉnh logic fallback của `TenantResolutionMiddleware` theo hướng từ chối nếu không xác định được tenant rõ ràng. Triển khai DB migration cho bảng support trước khi refactor View.
3. **Frontend Team:** Đổi phương án lưu trữ Tenant ID sang `sessionStorage` hoặc Route Params để chống lỗi lẫn lộn dữ liệu giữa các tab.
