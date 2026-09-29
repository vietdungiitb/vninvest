# CODE QUALITY CONSTITUTION: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_CODE_QUALITY_CONSTITUTION_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Backend API Service (`packages/core`) & Web Frontend (`packages/web`)  

---

## HIẾN PHÁP CHẤT LƯỢNG MÃ NGUỒN VÀ BẢO MẬT (CODE CONSTITUTION)

Hiến pháp này đặt ra các nguyên tắc phát triển phần mềm bắt buộc phải tuân thủ tuyệt đối đối với mọi thay đổi code liên quan đến phân hệ Authentication, Dynamic Mail, và Spam Shield.

---

## 1. NGUYÊN TẮC BẢO MẬT TUYỆT ĐỐI (ZERO LEAK SECURITY)

### 1.1 Không Log Plaintext Secrets
Nghiêm cấm in ra console (stdout/stderr) hoặc ghi vào tệp logs bất kỳ thông tin nhạy cảm nào bao gồm: `smtp_password`, `google_client_secret`, `google_refresh_token`, `google_service_account_json`.
- Sử dụng hàm filter log đã được đăng ký trong hệ thống để tự động chuyển tất cả các chuỗi nhạy cảm thành `[MASKED]`.
- Mẫu kiểm tra code:
  ```python
  # SAI - Leak bí mật
  logger.info(f"Connecting to SMTP using password: {password}")
  
  # ĐÚNG - Masked
  logger.info(f"Connecting to SMTP using user: {username} (Password is masked)")
  ```

### 1.2 Mã hoá đầu vào tự động (Auto-Encryption)
Tất cả mật khẩu/token của mail server khi đi vào serializer tạo/sửa (`SystemMailConfigSerializer`) bắt buộc phải được mã hoá tự động bằng Fernet trước khi ghi vào cơ sở dữ liệu. Không cho phép bất kỳ luồng lưu trữ thô (raw persistence) nào hoạt động.

### 1.3 Bắt buộc ghi Nhật ký Kiểm toán Operator (Operator Audit Logging)
Mọi hành vi thao tác thay đổi dữ liệu cấu hình mail hệ thống (`create`, `update`, `activate`, `deactivate`) từ phía Staff/Admin bắt buộc phải được lưu vết tự động vào bảng nhật ký kiểm toán kiểm tra (`MailConfigAuditLog`).
- Log kiểm toán tuyệt đối **không** được chứa plaintext credentials hoặc ciphertext thô của keys. Chỉ được phép ghi chép siêu dữ liệu (metadata) mô tả hành vi (ví dụ: `Staff activated config ID 5 (Sender: notifications@vninvest.vn)`).
- Log kiểm toán được lưu đồng thời trong DB và đẩy sang Sentry/ELK Stack với mức cảnh báo `INFO` hoặc `WARNING` phục vụ giám sát SOC.

---

## 2. NGUYÊN TẮC TIN CẬY TRANSACTION VÀ LỖI (RELIABILITY & ERROR FLOW)

### 2.1 Cấm Swallow Exception
Nghiêm cấm tuyệt đối việc sử dụng `except: pass` hoặc `except Exception: pass` trong các phân hệ Outbox Event Processing và Email Sending.
- Mọi ngoại lệ (Exception) phải được bắt cụ thể (ví dụ: `SMTPException`, `GoogleAuthError`).
- Bắt buộc ghi log có ngữ cảnh (`logger.exception` để lấy stack trace) và ghi nhận `last_error` vào bản ghi `OutboxEvent` hoặc `SystemMailConfig` để quản trị viên dễ dàng gỡ lỗi.

### 2.2 Đảm bảo Giao dịch Atomic và Thả Celery an toàn
- Toàn bộ luồng đăng ký tạo hạ tầng User/Tenant/SA bắt buộc nằm trong `transaction.atomic()`.
- Việc đẩy sự kiện sang outbox worker bằng Celery **bắt buộc** phải sử dụng `transaction.on_commit(lambda: send_email_task.delay(...))` để triệt tiêu lỗi race-condition mồ côi.

---

## 3. CHUẨN HOÁ PHẢN HỒI (OPENAPI ENVELOPE STANDARD)

Tất cả các API Response phải kế thừa hoặc định dạng qua bộ máy Envelover thống nhất của VNInvest Core:
- Thành công: Trả về HTTP 200/201 kèm cấu trúc `data` chứa payload nghiệp vụ và `request_id`.
- Lỗi nghiệp vụ hoặc validate: Trả về HTTP 400/403/429/500 tương ứng kèm cấu trúc `field_errors` chi tiết và `code` định danh máy đọc được. Không trả về HTTP 200 cho các trường hợp xử lý lỗi.

---
*Hiến pháp này là bộ luật tối cao cho việc PR code của phân hệ Auth. Vi phạm bất kỳ điều khoản nào sẽ dẫn đến chất lượng Gate thất bại (Quality Gate Failure).*
