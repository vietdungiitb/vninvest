# HANDOFF MASTER: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_HANDOFF_MASTER_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi áp dụng**: Đội ngũ Phát triển Backend & DevOps (packages/core)  

---

## 1. ĐỊNH HƯỚNG BÀN GIAO (EXECUTIVE BRIEFING)

Tài liệu này đóng vai trò là **Hồ sơ Bàn giao Chính thức (Handoff Master Index)** cho gói tính năng nâng cấp chức năng Đăng ký người dùng sang kiến trúc SaaS Native OpenAPI, kết hợp bộ phòng thủ Spam đa tầng và hạ tầng Quản trị Mail động (SMTP & Google Gmail API với Domain-Wide Delegation).

Mục tiêu bàn giao: **Cung cấp đầy đủ hướng dẫn kiến trúc, thiết kế tin cậy, đặc tả dữ liệu và quy trình kiểm thử để đội ngũ phát triển có thể tự triển khai độc lập 100% không cần hỏi lại.**

---

## 2. CHỈ MỤC TÀI LIỆU FEATURE PACK (DOCUMENT INDEX)

Gói bàn giao này bao gồm 10 tài liệu liên kết chặt chẽ với nhau nằm hoàn toàn trong thư mục `docs/plans/`:

1. **Handoff Master (Tài liệu này)**:
   - [SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_HANDOFF_MASTER_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_HANDOFF_MASTER_20260524.md)
2. **Bản kế hoạch triển khai đã được Audit Lần 2 (Implementation Plan)**:
   - [IMPLEMENTATION_PLAN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/IMPLEMENTATION_PLAN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md)
3. **Đặc tả Kỹ thuật Chi tiết (Technical Spec)**:
   - [TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md)
4. **Thiết kế Backend Chi tiết (Backend Design)**:
   - [BACKEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/BACKEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md)
5. **Thiết kế Frontend Chi tiết (Frontend Design)**:
   - [FRONTEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/FRONTEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md)
6. **Bảng Theo dõi Tiến độ & Định nghĩa Hoàn thành (Taskboard & Slices)**:
   - [TASKBOARD_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/TASKBOARD_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md)
7. **Ma trận Truy vết (Traceability Matrix)**:
   - [SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_TRACEABILITY_MATRIX_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_TRACEABILITY_MATRIX_20260524.md)
8. **Nghị định thư Tự Kiểm tra & CI Gate (Self-Audit & Test Protocol)**:
   - [SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_SELF_AUDIT_AND_TEST_PROTOCOL_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_SELF_AUDIT_AND_TEST_PROTOCOL_20260524.md)
9. **Hiến pháp Chất lượng Code (Code Quality Constitution)**:
   - [SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_CODE_QUALITY_CONSTITUTION_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_CODE_QUALITY_CONSTITUTION_20260524.md)
10. **Mẫu bằng chứng thực thi bàn giao (Execution Evidence Template)**:
    - [SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_EXECUTION_EVIDENCE_TEMPLATE_20260524.md](file:///c:/Mujoco%20Projects/vninvest/docs/plans/SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_EXECUTION_EVIDENCE_TEMPLATE_20260524.md)

---

## 3. TÓM TẮT KIẾN TRÚC MỤC TIÊU (TARGET ARCHITECTURE BRIEF)

Bộ tài liệu giải quyết triệt để 3 vấn đề lớn:

1. **Đứt gãy Provisioning Tenant**: Đảm bảo luồng đăng ký tự động tạo `CoreTenant`, `UserProfile`, và `CoreServiceAccount` mặc định (với scope tối thiểu `['market:read', 'signals:read']`) trong một Transaction vật lý duy nhất. Service Account sẽ tự động nâng cấp quyền (elevate scope) thêm `['ai:invoke', 'manage_pats']` sau khi người dùng xác thực email thành công.
2. **Chống Spam Đa tầng**:
   - **Tầng 1 (Honeypot)**: Trường ẩn `website` bẫy bot.
   - **Tầng 2 (Domain Filter)**: Chặn địa chỉ email tạm thời bằng `set` lookup hiệu năng `O(1)`.
   - **Tầng 3 (Turnstile)**: Tích hợp Cloudflare Turnstile, có chế độ strict mode fail-fast khi khởi động ở production nếu thiếu `TURNSTILE_SECRET_KEY` (chỉ áp dụng khi chạy HTTP server).
3. **Quản trị Thư hệ thống Động (dynamic SMTP/Google API)**:
   - Cho phép Staff tạo và quản trị cấu hình gửi mail trực tiếp từ DB qua bảng `SystemMailConfig` (mật khẩu/token được mã hóa AES Fernet).
   - Hỗ trợ gửi mail qua **Google Gmail API** với Domain-Wide Delegation (DWD) bằng cách impersonate tài khoản admin gửi qua `google_delegated_user_email` với scope `gmail.send`.
   - Cung cấp API test kết nối SMTP/Google API trước khi kích hoạt.
4. **Thiết kế Tin cậy (Reliability)**:
   - Thực thi **Transactional Outbox Pattern** với bảng `OutboxEvent` để lưu vết `UserRegisteredEvent`.
   - Đảm bảo **Idempotency** chống xử lý lặp sự kiện tại Consumer qua bảng `ProcessedEvent`.
   - Áp dụng **Database-level Partial Unique Constraint** bảo vệ tính toàn vẹn của cấu hình mail active.

---

## 4. HƯỚNG DẪN BÀN GIAO CHO ĐỘI NGŨ CODE (HANDOVER INSTRUCTIONS)

Đội ngũ code thực hiện theo quy trình sau:
1. Đọc và hiểu kỹ **Hiến pháp Chất lượng Code** (`docs/plans/*_CODE_QUALITY_CONSTITUTION_*.md`) trước khi gõ dòng code đầu tiên.
2. Triển khai tuần tự theo 7 Slices được định nghĩa trong **Taskboard** (`docs/plans/*_TASKBOARD_*.md`).
3. Đảm bảo đạt đầy đủ tiêu chí **Definition of Done (DoD)** cho mỗi Slice trước khi chuyển sang Slice kế tiếp.
4. Chạy kiểm thử tự động theo đúng **Test Protocol** (`docs/plans/*_SELF_AUDIT_AND_TEST_PROTOCOL_*.md`).
5. Ghi nhận toàn bộ bằng chứng kiểm thử thành công vào **Execution Evidence** (`docs/plans/*_EXECUTION_EVIDENCE_*.md`) để phục vụ PR review.

---
*Tài liệu đã được ký duyệt điện tử và phân phối tới nhánh chính.*
