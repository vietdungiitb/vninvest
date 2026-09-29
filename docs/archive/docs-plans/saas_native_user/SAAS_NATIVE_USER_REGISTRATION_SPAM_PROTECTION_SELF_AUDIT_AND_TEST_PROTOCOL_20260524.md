# SELF-AUDIT & TEST PROTOCOL: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_SELF_AUDIT_AND_TEST_PROTOCOL_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Backend API Service (`packages/core`) & Web Frontend (`packages/web`)  

---

## NGHỊ ĐỊNH THƯ KIỂM THỬ VÀ ĐÁNH GIÁ CHẤT LƯỢNG (PR GATE PROTOCOL)

Nghị định thư này định nghĩa các bước thực thi kiểm thử và tự đánh giá bắt buộc dành cho nhà phát triển trước khi mở Pull Request (PR) lên hệ thống CI/CD của VNInvest Core.

---

## 1. QUY TRÌNH KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST PROTOCOL)

Nhà phát triển chạy toàn bộ test suite liên quan đến `identity_access` bằng các lệnh sau:

### 1.1 Khai báo biến môi trường tạm thời cho Test
```powershell
# Chạy trên Windows Powershell
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:DJANGO_DEBUG='true'
$env:MAIL_CREDENTIAL_FERNET_KEY='dev-mail-fernet-key-replace-in-prod-12345=' # 32-bytes base64 key
```

### 1.2 Chạy Test Suite & Lệnh Di cư Khôi phục (Backfill Command)

Di chuyển vào thư mục backend và chạy kiểm thử Django Test Suite:
```bash
cd "c:\Mujoco Projects\vninvest\packages\core\backend"
python manage.py test tests.test_register_upgrade --keepdb --verbosity 2
```

Hoặc chạy thông qua **Pytest** tiêu chuẩn của dự án:
```bash
pytest src/identity_access/tests/test_register_upgrade.py -vv
```

Để chạy thử nghiệm khôi phục Tenancy (Backfill Command) cho người dùng cũ ở môi trường giả lập (dry-run):
```bash
python manage.py backfill_missing_tenants --dry-run
```

Chạy khôi phục ghi đè dữ liệu thực tế:
```bash
python manage.py backfill_missing_tenants
```

### 1.3 Tiêu chuẩn PASS/FAIL
- **PASS**: Đạt 100% tỷ lệ chạy thành công cho toàn bộ ma trận kiểm thử nâng cao (TC_CONCURRENCY_01 đến TC_MIGRATION_KEY_05) và lệnh di cư backfill chạy không ném lỗi. Tỷ lệ coverage cho code mới sửa đạt >= 90%.
- **FAIL**: Có bất kỳ test case nào bị Fail hoặc Error, hoặc tỷ lệ coverage không đạt yêu cầu. PR sẽ bị tự động reject ở CI gate.

---

## 2. NGHỊ ĐỊNH THƯ TỰ KIỂM TRA ĐỘ TIN CẬY (MANUAL AUDIT FLOW)

Quản trị viên / Nhà phát triển có thể kiểm tra thực tế bằng các kịch bản môi trường sau:

### 2.1 Kiểm tra bẫy Honeypot
Sử dụng curl gửi payload đăng ký có chứa giá trị ở trường `website`:
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "spambot",
    "email": "bot@mailinator.com",
    "password": "Password123!",
    "password_confirm": "Password123!",
    "website": "http://spamsite.com",
    "turnstile_token": "0.XTz..."
  }'
```
- **Kết quả mong đợi**: HTTP `400 Bad Request`, body lỗi trả về chuẩn envelope với thông điệp validation, và hệ thống ghi log cảnh báo spam bot.

### 2.2 Kiểm tra bộ lọc email rác (Disposable domains)
Gửi mail có đuôi tạm thời:
```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "trashuser",
    "email": "trash@10minutemail.com",
    "password": "Password123!",
    "password_confirm": "Password123!",
    "website": "",
    "turnstile_token": "0.XTz..."
  }'
```
- **Kết quả mong đợi**: HTTP `400 Bad Request` kèm `"email": ["Không cho phép đăng ký bằng địa chỉ email tạm thời."]`.

### 2.3 Kiểm tra xác thực Google Gmail API và Impersonation DWD
Bật cấu hình dynamic Google API, gửi thử nghiệm qua operator test endpoint:
```bash
curl -X POST http://localhost:8000/core/v1/operator/mail-config/test/ \
  -H "Authorization: Bearer <ADMIN_PAT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "gmail_api",
    "google_service_account_json": "{\"type\":\"service_account\",...}",
    "google_delegated_user_email": "admin@yourdomain.com",
    "from_email": "notifications@yourdomain.com",
    "test_email": "yourtest@gmail.com"
  }'
```
- **Kết quả mong đợi**: HTTP `200 OK` và thư nhận được thành công tại `yourtest@gmail.com` gửi từ `notifications@yourdomain.com` sử dụng hạ tầng Gmail API.

---

## 3. CHECKLIST KIỂM TRA TRƯỚC KHI MERGE (CI GATE CHECKLIST)

- `[ ]` Không có file credentials (.json hoặc .env) nào bị lọt vào commit.
- `[ ]` Đã kiểm tra log console không chứa mật mã SMTP hoặc Google Refresh Token dạng plaintext.
- `[ ]` Database unique constraint cho `SystemMailConfig` đã được migrate vào DB thành công.
- `[ ]` Thư viện Google OAuth và Gmail Client đã được cập nhật vào file `requirements.txt`.
- `[ ]` Đã chạy `black` và `flake8` để format code đạt chuẩn thẩm mỹ dự án.

---
*Nghị định thư tự kiểm tra được phê chuẩn bởi QA Lead.*
