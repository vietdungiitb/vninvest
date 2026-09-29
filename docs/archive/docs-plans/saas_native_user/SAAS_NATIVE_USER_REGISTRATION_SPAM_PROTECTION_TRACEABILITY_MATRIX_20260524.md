# TRACEABILITY MATRIX: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_TRACEABILITY_MATRIX_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Backend API Service (`packages/core`) & Web Frontend (`packages/web`)  

---

## MA TRẬN TRUY VẾT YÊU CẦU & THÀNH PHẦN TRIỂN KHAI

Ma trận này đảm bảo 100% yêu cầu nghiệp vụ và kỹ thuật (được xác lập qua đợt Audit lần 2) được ánh xạ chính xác đến các cấu trúc dữ liệu, tầng logic nghiệp vụ, và các trường hợp kiểm thử (test cases) tương ứng.

| ID | Yêu cầu Nghiệp vụ / Kỹ thuật | Cấu trúc Dữ liệu (DB Models) | Logic Nghiệp vụ (Serializer & View) | Tệp kiểm thử (Test Case) |
|---|---|---|---|---|
| **REQ_HONEYPOT_01** | Chống spam bot thông qua bẫy trường `website` ẩn. | - | `SaaSRegisterSerializer.validate()` | `test_register_upgrade.py:test_register_honeypot_triggered` |
| **REQ_EMAIL_FILTER_02** | Chặn đăng ký từ các dải email rác (Disposable domains) qua hash set lookup hiệu năng `O(1)`. | - | `SaaSRegisterSerializer.validate_email()` | `test_register_upgrade.py:test_register_disposable_email` |
| **REQ_TURNSTILE_03** | Xác thực Cloudflare Turnstile token trực tiếp qua API Cloudflare. | - | `SaaSRegisterSerializer.validate()` | `test_register_upgrade.py:test_register_turnstile_success` / `test_register_turnstile_failed` |
| **REQ_TURNSTILE_GATE_04** | Fail-fast check Turnstile key ở production chỉ cho HTTP thread, tránh CI/commands block. | - | `identity_access/apps.py:AppConfig.ready()` | `test_register_upgrade.py:test_register_strict_gate_policy` |
| **REQ_PROVISION_05** | Tự động tạo User + Tenant + UserProfile + Service Account mặc định trong transaction atomic. | `User`, `CoreTenant`, `UserProfile`, `CoreServiceAccount` | `views_auth.register_view()` | `test_register_upgrade.py:test_register_success` |
| **REQ_PRIVILEGE_06** | Hạn chế quyền tối thiểu (scopes) cho SA chưa kích hoạt, nâng cấp quyền sau khi verified email. | `CoreServiceAccount.scopes` | `views_auth.verify_email_view()` | `test_register_upgrade.py:test_register_progressive_scope_elevation` |
| **REQ_OUTBOX_07** | Lưu sự kiện `UserRegisteredEvent` đáng tin cậy bằng Transactional Outbox. | `OutboxEvent` | `views_auth.register_view()` (Outbox commit) | `test_register_upgrade.py:test_register_outbox_atomic` |
| **REQ_IDEMPOTENCY_08** | Chống xử lý trùng lặp sự kiện ở phía Consumer. | `ProcessedEvent` | `user_workspace/consumers.py` | `test_register_upgrade.py:test_register_outbox_idempotency` |
| **REQ_DYNAMIC_SMTP_09** | Quản trị viên cấu hình SMTP động từ Admin API ở runtime. | `SystemMailConfig` (SMTP fields) | `views_operator.py` & `data_ingest/tasks.py` | `test_register_upgrade.py:test_dynamic_smtp_send` |
| **REQ_GMAIL_API_DWD_10** | Hỗ trợ Google Gmail API động với Impersonation DWD (`google_delegated_user_email`). | `SystemMailConfig` (Google fields) | `views_operator.py` & `data_ingest/tasks.py` | `test_register_upgrade.py:test_gmail_api_dwd_send` |
| **REQ_FERNET_11** | Mã hóa an toàn tuyệt đối các mật khẩu/tokens/JSON keys bằng symmetric Fernet (AES). | `SystemMailConfig` (BinaryFields) | `vninvest_core/utils/crypto.py` | `test_register_upgrade.py:test_migration_key_rotation` |
| **REQ_DB_CONSTRAINT_12** | Database constraint chỉ cho phép tối đa duy nhất 1 mail config hoạt động (`is_active=True`). | - | `SystemMailConfig.Meta.constraints` | `test_register_upgrade.py:test_concurrency_active_config` |
| **REQ_ENVELOPE_13** | Chuẩn hoá API response theo cấu trúc envelope chung của Core OpenAPI. | - | `vninvest_core/exceptions.py` (Enveloper) | `test_register_upgrade.py:test_error_envelope_compliance` |
| **REQ_FRONTEND_14** | Tích hợp Turnstile widget và trường Honeypot `website` ẩn trên UI đăng ký. | - | `RegisterForm.tsx` (React component & CSS) | Manual verification (Honeypot/Turnstile triggering on local) |
| **REQ_BACKFILL_15** | Khôi phục Tenant và Service Account cho các tài khoản người dùng cũ bị thiếu. | `CoreTenant`, `UserProfile`, `CoreServiceAccount` | `Command.handle()` (CLI command script) | `test_register_upgrade.py:test_backfill_missing_tenants_command` |

---
*Bản ma trận truy vết được phê chuẩn và lưu vết trên hệ thống kiểm soát PR của VNInvest.*
