# TECHNICAL SPEC: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524`  
**Ngày lập**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Backend API Service (`packages/core`) & Web Frontend (`packages/web`)  

---

## 1. THIẾT KẾ MÔ HÌNH DỮ LIỆU CHI TIẾT (MODEL SCHEMAS)

Đội ngũ phát triển cần tạo và migrate chính xác các thực thể sau đây trong DB:

### 1.1 Bảng Cấu hình Mail Động (`SystemMailConfig`)
Model này được khai báo trong `identity_access/models.py`.

```python
class SystemMailConfig(models.Model):
    # Trạng thái & Phân loại
    provider = models.CharField(
        max_length=24,
        choices=[('smtp', 'SMTP Server'), ('gmail_api', 'Google Gmail API')],
        default='smtp'
    )
    is_active = models.BooleanField(default=False, db_index=True)
    from_email = models.EmailField(max_length=255)
    
    # SMTP Parameters (Sử dụng null=True cho trường hợp dùng Google API)
    smtp_host = models.CharField(max_length=255, blank=True, null=True)
    smtp_port = models.IntegerField(default=587, blank=True, null=True)
    smtp_username = models.CharField(max_length=255, blank=True, null=True)
    smtp_password_encrypted = models.BinaryField(blank=True, null=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)

    # Google API Service Account Parameters
    google_service_account_json_encrypted = models.BinaryField(blank=True, null=True)
    google_delegated_user_email = models.EmailField(max_length=255, blank=True, null=True)

    # Audit fields bổ sung cho truy vết
    last_modified_by = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mail_configs_modified',
        verbose_name="Last modified by staff"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_system_mail_config'
        constraints = [
            # Lớp bảo vệ DB: Đảm bảo tối đa chỉ 1 cấu hình được is_active=True
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='unique_active_system_mail_config'
            )
        ]
```

### 1.2 Bảng Outbox Sự kiện (`OutboxEvent`)
Model này được lưu trữ trong `identity_access/models.py` hoặc `service_ops/models.py`.

```python
import uuid
from django.db import models

class OutboxEvent(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processed', 'Processed'),
        ('failed', 'Failed'),
    ]

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    event_type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(verbose_name="Event JSON Payload")
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default='pending', db_index=True)
    retry_count = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'core_outbox_event'
        ordering = ['created_at']
```

### 1.3 Bảng Nhật ký Consumer (`ProcessedEvent`)
Được lưu ở đầu thu (Consumer) trong `user_workspace/models.py` để chống xử lý lặp (Idempotency).

```python
class ProcessedEvent(models.Model):
    event_id = models.UUIDField(unique=True, primary_key=True, editable=False)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_processed_event'
```

---

## 2. CƠ CHẾ MÃ HOÁ VÀ BẢO MẬT CREDENTIALS (FERNET UTILITIES)

Tất cả các khoá bí mật (SMTP password, Google Client Secret, Refresh Token, Service Account JSON) bắt buộc được mã hoá đối xứng bằng AES thông qua Fernet.

### Bộ mã hoá chuẩn (`vninvest_core/utils/crypto.py`):
```python
import os
from cryptography.fernet import Fernet

def _get_mail_fernet() -> Fernet:
    """Tải và khởi tạo Fernet key riêng biệt cho email."""
    key = os.environ.get('MAIL_CREDENTIAL_FERNET_KEY', '').strip()
    if not key:
        raise RuntimeError("THIẾT LẬP THIẾU: MAIL_CREDENTIAL_FERNET_KEY bắt buộc phải có trong môi trường sản xuất.")
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_mail_secret(plaintext: str) -> bytes:
    """Mã hoá dữ liệu text đầu vào."""
    if not plaintext:
        return b''
    return _get_mail_fernet().encrypt(plaintext.encode('utf-8'))

def decrypt_mail_secret(ciphertext: bytes) -> str:
    """Giải mã dữ liệu nhạy cảm."""
    if not ciphertext:
        return ""
    return _get_mail_fernet().decrypt(bytes(ciphertext)).decode('utf-8')
```

---

## 3. LOGIC XÁC THỰC VÀ GỬI MAIL QUA GMAIL API (DOMAIN-WIDE DELEGATION)

Để gửi email dưới dạng Google Service Account DWD (Domain-Wide Delegation):
1. **Google Workspace Admin Setup**:
   - Quản trị viên truy cập **Google Workspace Admin Console** (`admin.google.com`).
   - Vào mục **Security** -> **API Controls** -> **Domain-Wide Delegation**.
   - Thêm Client ID của Service Account và gán scope tối thiểu duy nhất: `https://www.googleapis.com/auth/gmail.send`.
2. **Backend Authentication & Impersonation Logic**:
   Đoạn mã sau được tích hợp trong Celery Task gửi mail (`data_ingest/tasks.py`):

```python
import base64
from email.mime.text import MIMEText
from google.oauth2 import service_account
from googleapiclient.discovery import build
from vninvest_core.utils.crypto import decrypt_mail_secret

def send_via_google_gmail_api(mail_config, recipient_email, subject, html_content):
    """
    Gửi email thông qua Google Gmail API sử dụng Service Account JSON
    và giả lập tài khoản chủ thể (DWD subject impersonation).
    """
    # 1. Giải mã Service Account JSON
    sa_json_str = decrypt_mail_secret(mail_config.google_service_account_json_encrypted)
    import json
    sa_info = json.loads(sa_json_str)

    # 2. Khởi tạo credentials kèm subject impersonation (DWD)
    scopes = ['https://www.googleapis.com/auth/gmail.send']
    credentials = service_account.Credentials.from_service_account_info(
        sa_info, 
        scopes=scopes
    ).with_subject(mail_config.google_delegated_user_email)

    # 3. Mở phiên kết nối API Gmail
    service = build('gmail', 'v1', credentials=credentials)

    # 4. Thiết lập nội dung thư MIME
    message = MIMEText(html_content, 'html', 'utf-8')
    message['to'] = recipient_email
    message['from'] = mail_config.from_email
    message['subject'] = subject

    # 5. Mã hoá Base64 URL an toàn theo chuẩn RFC
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    
    # 6. Kích hoạt lệnh gửi trực tiếp qua Google
    send_payload = {'raw': raw_message}
    service.users().messages().send(userId='me', body=send_payload).execute()
```

---

## 4. BỘ THÔNG SỐ VẬN HÀNH THỰC TẾ (CONFIGURATION MATRIX)

Dưới đây là các thông số giới hạn (throttle, timeouts và cooldowns) được áp dụng tại hệ thống sản xuất.

| Tham số cấu hình | Giá trị mặc định | Giới hạn tối thiểu | Giới hạn tối đa | Quyền hạn thay đổi |
|---|---|---|---|---|
| **IP Registration Rate Limit** | 3 requests / phút | 1 request / phút | 10 requests / phút | Platform Tech Lead |
| **Email Registration Rate Limit** | 3 requests / phút | 1 request / phút | 5 requests / phút | Security Lead |
| **Subnet `/24` Rate Limit** | 5 requests / phút | 2 requests / phút | 15 requests / phút | Security Lead |
| **Email Resend Cooldown** | 60 giây | 30 giây | 300 giây | QA / Dev Team |
| **Verification Token TTL** | 30 phút | 10 phút | 1440 phút (24h) | Product Owner |
| **Verification Max Attempts** | 5 lần | 3 lần | 10 lần | Security Lead |
| **Verification Lockout Duration** | 15 phút | 5 phút | 60 phút | Security Lead |
| **Outbox Queue Lag Alert** | 100 sự kiện | 50 sự kiện | 500 sự kiện | DevOps / SRE |

---

## 5. THÔNG SỐ PHÂN BỔ TÀI NGUYÊN PHI CHỨC NĂNG (NON-FUNCTIONAL BUDGETS)

Để bảo đảm tính sẵn sàng cao (High Availability), các thao tác API và xử lý outbox phải đáp ứng đúng giới hạn non-functional:

- **Gmail API Call Timeout**: Bắt buộc đặt giới hạn timeout kết nối đến Google là **3000ms**. Luồng không được phép treo giữ kết nối lâu hơn.
- **SMTP Connection Timeout**: Đặt giới hạn kết nối socket SMTP là **3000ms**.
- **Retry Budget**: Số lần thử lại tối đa cho Outbox Event là **5 lần**.
- **Outbox Processing Delay Target**: Độ trễ từ lúc transaction commit tới khi consumer hoàn tất xử lý phải **< 10 giây** (trong điều kiện hoạt động bình thường).
- **SLO Email Delivery**: Đảm bảo **99%** email xác thực được gửi thành công đến Gateway nhận trong vòng **< 30 giây** từ khi user nhấn đăng ký.

---

## 6. ĐẶC TẢ CHI TIẾT DỊCH VỤ QUẢN TRỊ (OPERATOR MAIL API CRUD SPECIFICATION)

Tất cả các endpoint quản trị mail đều nằm trong namespace `/core/v1/operator/mail-config/` và yêu cầu quyền `is_staff=True` (hoặc `is_superuser=True`).

### 6.1 Lấy danh sách cấu hình (`GET /core/v1/operator/mail-config/`)
- **Phân trang**: Sử dụng **Cursor Pagination** mặc định (`limit=20`, tối đa `limit=100`) để tránh tải nặng DB.
- **Dữ liệu trả về**: 
  ```json
  {
    "status": "success",
    "request_id": "req_...",
    "data": {
      "results": [
        {
          "id": 1,
          "provider": "gmail_api",
          "is_active": true,
          "google_delegated_user_email": "admin@vninvest.vn",
          "created_at": "2026-05-24T08:00:00Z",
          "updated_at": "2026-05-24T08:15:00Z"
        }
      ],
      "next": "http://api/core/v1/operator/mail-config/?cursor=cD0x",
      "previous": null
    }
  }
  ```

### 6.2 Lấy chi tiết một cấu hình (`GET /core/v1/operator/mail-config/<id>/`)
- **Response**: Trả về chi tiết các thông số của cấu hình được chọn. Các trường mật khẩu/bí mật nhạy cảm (như `smtp_password_encrypted`, `google_client_secret_encrypted`) **không** bao giờ được trả về dưới dạng thô hoặc mã hóa; thay vào đó, hệ thống sẽ trả về cờ biểu thị sự tồn tại: `"smtp_password_configured": true`.

### 6.3 Tạo mới cấu hình (`POST /core/v1/operator/mail-config/`)
- **Body**: Payload gửi lên chứa các trường plaintext. Serializer sẽ mã hóa an toàn trước khi lưu.
- **Ghi nhận lịch sử (Audit Field)**: Hệ thống tự động gán `last_modified_by = request.user` và ghi nhật ký thay đổi.

### 6.4 Cập nhật cấu hình (`PUT/PATCH /core/v1/operator/mail-config/<id>/`)
- **Quy tắc**: Cho phép cập nhật từng phần (PATCH). Nếu người dùng thay đổi mật khẩu/secret, hệ thống sẽ thực hiện tái mã hóa và lưu.
- **Audit Field**: Ghi nhận `last_modified_by = request.user`.

### 6.5 Xoá cấu hình (`DELETE /core/v1/operator/mail-config/<id>/`)
- **Ràng buộc an toàn**: Cấm xóa hoàn toàn cấu hình đang có cờ `is_active=True`. Nếu cố tình xóa, API sẽ trả về lỗi `400 Bad Request` kèm mã lỗi `"cannot_delete_active_config"`.

### 6.6 Kích hoạt cấu hình (`POST /core/v1/operator/mail-config/<id>/activate/`)
- **Hành vi**: Cập nhật cờ `is_active=True` cho cấu hình chỉ định, đồng thời chuyển toàn bộ các cấu hình còn lại về `is_active=False`.
- **An toàn giao dịch**: Sử dụng `select_for_update()` kết hợp với DB-level partial unique constraint để chống race condition.

---

## 7. CHI TIẾT CÁC BỘ LỌC CHỐNG SPAM ĐA TẦNG

Bộ lọc chống spam được viết dạng một Helper validation độc lập hoặc tích hợp trong `SaaSRegisterSerializer.validate()`:

### 7.1 Honeypot Check
```python
def validate_honeypot(data):
    # Trường ẩn trên UI tên là 'website'
    if data.get('website'):
        # Log botnet attack với request_id cho SOC
        logger.warning("Spam bot detected: Honeypot field 'website' was filled.")
        # Trả về lỗi validate giả lập thông thường
        raise serializers.ValidationError({"website": "Lỗi kết nối. Vui lòng thử lại."})
```

### 7.2 Disposable Email Block
```python
from django.conf import settings

def validate_disposable_email(email):
    domain = email.split('@')[-1].lower().strip()
    # settings.BLOCKED_DISPOSABLE_DOMAINS là một 'set'
    if domain in getattr(settings, 'BLOCKED_DISPOSABLE_DOMAINS', set()):
        logger.warning(f"Registration blocked: Disposable email domain '{domain}' rejected.")
        raise serializers.ValidationError({"email": "Không cho phép đăng ký bằng địa chỉ email tạm thời."})
```

### 7.3 Cloudflare Turnstile Verification
```python
import requests
from django.conf import settings

def verify_cloudflare_turnstile(token, client_ip):
    secret_key = getattr(settings, 'TURNSTILE_SECRET_KEY', '').strip()
    if not secret_key:
        if settings.DEBUG:
            logger.warning("TURNSTILE_SECRET_KEY is empty. Skipping verification in DEBUG mode.")
            return True
        else:
            # Ở production, thiếu key cấu hình phải fail-fast
            logger.critical("Production error: TURNSTILE_SECRET_KEY is not configured.")
            raise RuntimeError("Hệ thống Mail và Bảo mật chưa được cấu hình đầy đủ.")

    verify_url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    payload = {
        'secret': secret_key,
        'response': token,
        'remoteip': client_ip
    }
    
    try:
        response = requests.post(verify_url, data=payload, timeout=5)
        result = response.json()
        if not result.get('success'):
            logger.warning(f"Turnstile verification failed: {result.get('error-codes')}")
            raise serializers.ValidationError({"turnstile_token": "Xác thực Turnstile không hợp lệ hoặc đã hết hạn."})
    except requests.RequestException as e:
        logger.exception("Failed to contact Cloudflare Turnstile API.")
        raise serializers.ValidationError({"turnstile_token": "Không thể kết nối máy chủ xác thực. Vui lòng thử lại sau."})
    return True
```

---

## 8. ĐẶC TẢ UỶ QUYỀN HẠN NGẠCH (LEAST PRIVILEGE WORKFLOW)

Quy trình vòng đời Service Account của người dùng được theo dõi và nâng cấp theo đúng chuẩn bảo mật Least Privilege:

```
[Người dùng đăng ký] 
        │
        ├──► User.is_active = False
        └──► CoreServiceAccount scopes = ['market:read', 'signals:read']
                                (Quyền đọc dữ liệu cơ bản, KHÔNG cấp PAT)
                                            │
                                            ▼
                               [Kích hoạt link xác minh Email]
                                            │
                                            ▼
        ┌───────────────────────────────────────────────────────────┐
        │  User.is_active = True                                    │
        │  CoreServiceAccount scopes += ['ai:invoke', 'manage_pats']│
        │  (Nâng cấp quyền hạn ngạch đầy đủ cho tài khoản thật)       │
        └───────────────────────────────────────────────────────────┘
```

---
*Tài liệu kỹ thuật được phê chuẩn bởi Core API Tech Lead.*
