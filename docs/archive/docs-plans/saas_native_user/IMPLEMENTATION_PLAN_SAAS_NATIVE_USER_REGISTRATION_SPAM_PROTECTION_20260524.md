# KẾ HOẠCH NÂNG CẤP CHỨC NĂNG ĐĂNG KÝ NGƯỜI DÙNG SAAS NATIVE OPENAPI KÈM CHỐNG SPAM
**Mã tài liệu**: `IMPLEMENTATION_PLAN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524`  
**Ngày lập**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC (Đã tích hợp đầy đủ Kế hoạch Vận hành & Thiết kế Tin cậy Lần 2)  
**Phạm vi**: Backend API Service (`packages/core`) & Web Frontend (`packages/web`)  

---

## 1. TỔNG QUAN VÀ HIỆN TRẠNG (AUDIT DETAILS)

### 1.1 Lỗ hổng lớn về hạ tầng Tenant (Critical)
Trong kiến trúc SaaS của VNInvest, mỗi người dùng phải gắn liền với một Tenant (`CoreTenant`) và ít nhất một Service Account (`CoreServiceAccount`) đang hoạt động (`status = 'active'`) để có thể thực hiện đăng nhập và trao đổi Access Token / PAT (Personal Access Token).
- **Hiện trạng**: Hàm đăng ký native hiện tại (`register_view` trong `packages/core/backend/src/identity_access/views_auth.py`) mới chỉ tạo đối tượng Django `User`. 
- **Hậu quả**: Khi người dùng kích hoạt tài khoản qua email và cố gắng đăng nhập, hệ thống sẽ trả về lỗi `403 Forbidden` (`No tenant associated with this account.` hoặc `No active service account for tenant.`). Luồng đăng ký hiện tại bị đứt gãy hoàn toàn ở khâu provisioning do lỗi kiến trúc (deadlock logic).

### 1.2 Thiếu hụt cơ chế chống Spam & Abuse
Các cuộc tấn công đăng ký ảo bằng Bot farm hoặc email tạm thời (disposable emails) có thể làm tràn ngập cơ sở dữ liệu và làm cạn kiệt hạn ngạch gửi email OTP/xác thực.
- **Hiện trạng**: Hiện tại endpoint chỉ được bảo vệ bởi một IP rate limiter cơ bản (3 requests/phút).
- **Yêu cầu**: Cần tích hợp một lớp phòng thủ đa tầng (Multi-layered Anti-spam) tại cấp độ API mà không làm giảm trải nghiệm của người dùng thật.

---

## 2. KIẾN TRÚC PHÒNG THỦ CHỐNG SPAM 3 TẦNG (3-LAYER SHIELD)

Quy trình xử lý yêu cầu đăng ký sẽ đi qua bộ lọc nghiêm ngặt theo mô hình sau:

```
[Client Request: POST /api/auth/register/]
                   │
                   ▼
         ┌───────────────────┐
         │  Tầng 1: Honeypot │ ──► (Bẫy bot điền form ẩn field 'website')
         └───────────────────┘
                   │ Pass
                   ▼
         ┌───────────────────┐
         │ Tầng 2: Email Filter│ ──► (Chặn domain email rác: mailinator.com...)
         └───────────────────┘
                   │ Pass
                   ▼
         ┌───────────────────┐
         │ Tầng 3: Turnstile │ ──► (Xác thực token Cloudflare Turnstile)
         └───────────────────┘
                   │ Pass
                   ▼
         [Xử lý tạo tài khoản & Tenant]
```

### Chi tiết các tầng bảo mật:
1. **Tầng 1 - Bẫy Honeypot (`website` field)**:
   - Thêm một trường ẩn có tên là `website` vào request payload. Đối với người dùng thật, trường này sẽ trống (do giao diện ẩn đi). Đối với các công cụ cào/spammer bot tự động, chúng sẽ tự điền tất cả các trường dữ liệu tìm thấy. 
   - Nếu trường `website` có chứa bất kỳ giá trị nào, hệ thống sẽ từ chối ngay lập tức và trả về mã lỗi validation chung để bot không biết bị phát hiện.
2. **Tầng 2 - Bộ lọc Email tạm thời (Disposable Domain Filter)**:
   - Chặn đăng ký đối với các địa chỉ email sử dụng các dịch vụ tạo hộp thư ảo ngắn hạn (ví dụ: `mailinator.com`, `yopmail.com`, `trashmail.com`, `10minutemail.com`, `tempmail.com`,...).
   - **Tối ưu hóa hiệu năng**: Cấu hình bộ lọc sử dụng kiểu dữ liệu Python **`set`** thay vì `list` để đạt tốc độ truy vấn **`O(1)`** (bảng băm), đảm bảo CPU tối thiểu khi bị tấn công dồn dập.
3. **Tầng 3 - Cloudflare Turnstile (Privacy-First CAPTCHA)**:
   - Sử dụng giải pháp Turnstile của Cloudflare (thay thế cho reCAPTCHA vốn gây phiền toái cho người dùng bằng các câu đố hình ảnh).
   - Client gửi kèm một mã `turnstile_token` thu được sau khi trình duyệt vượt qua kiểm tra ẩn của Cloudflare.
   - Backend sẽ thực hiện một yêu cầu POST tới API xác thực của Cloudflare (`https://challenges.cloudflare.com/turnstile/v0/siteverify`) để kiểm chứng tính hợp lệ của token trước khi tiếp tục xử lý.
   - **Chính sách theo môi trường (Environment Policy)**:
     - `local/dev`: Cho phép bypass nếu thiếu `TURNSTILE_SECRET_KEY`, nhưng bắt buộc ghi log cảnh báo kèm `request_id`.
     - `staging/prod`: Không cho phép bypass. **Bắt buộc cấu hình Turnstile**.
     - **Fail-fast Startup Gate bảo vệ**: Trong phương thức `ready()` của AppConfig (`identity_access/apps.py`), hệ thống kiểm tra nếu `DEBUG = False` hoặc có cờ `STRICT_TURNSTILE_ENFORCEMENT = True`. Khi đó, nếu thiếu `TURNSTILE_SECRET_KEY` **và** đang chạy ở HTTP Web Server context (kiểm tra `sys.argv` tránh các command line như `migrate`, `collectstatic`, `test`, `shell` để không làm hỏng quy trình CI/CD hoặc tác vụ bảo trì), hệ thống sẽ raise lỗi `ImproperlyConfigured` và dừng khởi chạy để tránh phát hành dịch vụ không bảo vệ.

### 2.1 Tăng cường Anti-abuse ngoài IP
- Bổ sung rate-limit đa chiều thay vì chỉ theo IP:
  - Theo `email` đã chuẩn hoá (lowercase + trim).
  - Theo subnet (`/24`) để giảm botnet xoay vòng IP.
  - Theo nhịp gửi lại email xác thực (resend cooldown).
- Giới hạn số lần nhập sai token xác minh theo account/IP để giảm brute-force.

---

## 3. THIẾT KẾ MỚI CHO LUỒNG ĐĂNG KÝ SAAS NATIVE

### 3.1 Quy trình xử lý tại Backend (Atomic Provisioning)
Để đảm bảo tính nhất quán của dữ liệu khi tạo một loạt các bản ghi liên kết, toàn bộ luồng tạo tài khoản phải được bao bọc trong một Transaction duy nhất (`transaction.atomic()`):

1. **Khớp và xác thực dữ liệu đầu vào**:
   - `username`: Kiểm tra định dạng bằng regex `r'^[a-zA-Z0-9_]{3,30}$'`.
   - `email`: Chuẩn hoá viết thường, lọc khoảng trắng, và kiểm tra tính duy nhất.
   - `password` & `password_confirm`: Kiểm tra tính trùng khớp và chạy bộ lọc mật khẩu tiêu chuẩn của Django (`validate_password`).
   - Kiểm tra bộ lọc Spam (Honeypot, Email Filter, Turnstile).
2. **Tạo tài khoản User**:
   - Tạo đối tượng `User` với trạng thái `is_active = False` (chờ xác thực).
3. **Khởi tạo hạ tầng Tenant & Hồ sơ**:
   - Tạo `CoreTenant` thuộc quyền sở hữu của `User` (`plan = 'free'`, `status = 'active'`).
   - Tạo `UserProfile` để chứa thông tin cấu hình giao diện, ngôn ngữ mặc định (`theme = 'dark'`, `language = 'vi'`).
   - **Cơ chế phân quyền tối thiểu (Least Privilege)**: 
     - Khi đăng ký mới (chưa xác thực email): Tạo một `CoreServiceAccount` mặc định có trạng thái `active` nhưng giới hạn scopes tối thiểu: `['market:read', 'signals:read']`.
     - Sau khi người dùng click xác thực email thành công: Hệ thống sẽ tự động cập nhật / nâng quyền (elevate) của Service Account đó lên thêm `['ai:invoke', 'manage_pats']`. Điều này ngăn chặn việc lạm dụng API từ các tài khoản rác chưa xác minh.
4. **Decoupled Starter Portfolios (Decoupling Kiến trúc)**:
   - **Không liên kết chặt chẽ (decoupled)**: Không gọi trực tiếp các hàm legacy provisioning danh mục trong luồng đăng ký để tránh phụ thuộc chéo.
   - Thay vào đó, hệ thống sẽ phát tín hiệu một **Domain Event** (`UserRegisteredEvent`) thông qua cơ chế **Transactional Outbox** (chi tiết ở mục 8) để khởi tạo danh mục mẫu một cách bất đồng bộ và tin cậy tuyệt đối.
5. **Xác thực Email (Email Verification)**:
   - Tạo token xác minh ngẫu nhiên, chỉ lưu bản băm (SHA-256 hash), không lưu plaintext token trong DB.
   - Token có TTL rõ ràng (30 phút), one-time use, và revoke token cũ khi resend.
   - Áp dụng ngưỡng thử sai tối đa (max attempts) và lockout tạm thời khi vượt ngưỡng.

### 3.2 Cấu hình Mail hệ thống động (Dynamic Mail Configuration)
Để quản trị viên (admin/staff) có thể linh hoạt cấu hình, thay đổi hoặc bảo trì máy chủ gửi mail trực tiếp từ dashboard mà không cần thay đổi file cấu hình tĩnh. Máy chủ gửi mail hỗ trợ cả **giao thức SMTP truyền thống** và **Google Mail (Gmail API)**.

Google đã loại bỏ "Less Secure Apps" (SMTP bằng mật khẩu thông thường cho tài khoản Gmail/Google Workspace). Vì vậy, tích hợp **Gmail API** theo mô hình **Google Service Account (Domain-Wide Delegation - DWD)** là yêu cầu bắt buộc khi doanh nghiệp sử dụng hạ tầng của Google để gửi mail xác thực.

#### 3.2.1 Mô hình Dữ liệu (`SystemMailConfig`)
Định nghĩa bảng lưu trữ cấu hình SMTP và Google API động trong phân hệ `identity_access/models.py`:

```python
class SystemMailConfig(models.Model):
    class ProviderChoices(models.TextChoices):
        SMTP = 'smtp', 'SMTP Server'
        GMAIL_API = 'gmail_api', 'Google Gmail API (Service Account DWD)'

    provider = models.CharField(
        max_length=24,
        choices=ProviderChoices.choices,
        default=ProviderChoices.SMTP,
        verbose_name="Mail Provider"
    )
    is_active = models.BooleanField(default=False, db_index=True, verbose_name="Active Configuration")
    from_email = models.EmailField(max_length=255, verbose_name="Sender Email (From)")
    
    # --- Nhóm cấu hình SMTP ---
    smtp_host = models.CharField(max_length=255, blank=True, null=True, verbose_name="SMTP Host")
    smtp_port = models.IntegerField(default=587, blank=True, null=True, verbose_name="SMTP Port")
    smtp_username = models.CharField(max_length=255, blank=True, null=True, verbose_name="SMTP Username")
    smtp_password_encrypted = models.BinaryField(blank=True, null=True, verbose_name="SMTP Password (Encrypted)")
    smtp_use_tls = models.BooleanField(default=True, verbose_name="Use TLS")
    smtp_use_ssl = models.BooleanField(default=False, verbose_name="Use SSL")

    # --- Nhóm cấu hình Google API (Gmail API với Domain-Wide Delegation) ---
    # Hỗ trợ Service Account JSON private key cho Domain-Wide Delegation (DWD-only)
    google_service_account_json_encrypted = models.BinaryField(blank=True, null=True, verbose_name="Service Account JSON (Encrypted)")
    # Bắt buộc cho Service Account Domain-Wide Delegation (DWD) impersonation
    google_delegated_user_email = models.EmailField(max_length=255, blank=True, null=True, verbose_name="Delegated Admin Email")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "System Mail Configuration"
        verbose_name_plural = "System Mail Configurations"
        # Xem Ràng buộc DB ở mục 10

    # --- Helper mã hoá và giải mã Fernet ---
    def set_smtp_password(self, password: str):
        from .models import _encrypt_credential
        self.smtp_password_encrypted = _encrypt_credential(password) if password else None

    def get_smtp_password(self) -> str:
        from .models import _decrypt_credential
        return _decrypt_credential(bytes(self.smtp_password_encrypted)) if self.smtp_password_encrypted else ""


    def set_google_service_account_json(self, json_str: str):
        from .models import _encrypt_credential
        self.google_service_account_json_encrypted = _encrypt_credential(json_str) if json_str else None

    def get_google_service_account_json(self) -> str:
        from .models import _decrypt_credential
        return _decrypt_credential(bytes(self.google_service_account_json_encrypted)) if self.google_service_account_json_encrypted else ""
```

#### 3.2.2 Cơ chế Router Mail động tại Runtime
Trong celery task gửi email (`send_email_verification_token` trong `data_ingest/tasks.py`):
1. **Tìm cấu hình động đang hoạt động**:
   `mail_config = SystemMailConfig.objects.filter(is_active=True).first()`
2. **Nếu có cấu hình động**:
   - **Trường hợp `provider == 'smtp'`**: Sử dụng máy chủ SMTP động:
     ```python
     connection = get_connection(
         host=mail_config.smtp_host,
         port=mail_config.smtp_port,
         username=mail_config.smtp_username,
         password=mail_config.get_smtp_password(),
         use_tls=mail_config.smtp_use_tls,
         use_ssl=mail_config.smtp_use_ssl,
     )
     send_mail(..., connection=connection, from_email=mail_config.from_email)
     ```
   - **Trường hợp `provider == 'gmail_api'`**: Sử dụng API của Google với Gmail API theo DWD-only:
     - Giải mã Service Account JSON đã mã hóa.
     - Khởi tạo Google Credentials object qua `google.oauth2.service_account`.
     - **Impersonation cho Service Account (Domain-Wide Delegation)**: Hệ thống bắt buộc áp dụng subject impersonation thông qua trường cấu hình `google_delegated_user_email`:
       ```python
       credentials = service_account.Credentials.from_service_account_info(
           service_account_info,
           scopes=['https://www.googleapis.com/auth/gmail.send']
       ).with_subject(mail_config.google_delegated_user_email)
       ```
     - Sử dụng `googleapiclient.discovery.build('gmail', 'v1', credentials=credentials)` để mở phiên kết nối Gmail API.
     - Tạo gói tin MIME chuẩn (`email.mime.text.MIMEText`), mã hóa Base64 URL và kích hoạt phương thức gửi:
       `service.users().messages().send(userId='me', body={'raw': raw_message}).execute()`
3. **Nếu không có cấu hình động**: Fallback sử dụng cấu hình mặc định static trong `settings.py` (Fail-safe Fallback).

---

## 4. ĐẶC TẢ API (OPENAPI COMPLIANT SCHEMA)

Mọi endpoint trong tài liệu này được cấu trúc lại để **đồng bộ hoàn toàn** với chuẩn Error & Success Envelope của VNInvest Core OpenAPI.

### 4.1 Đăng ký Người dùng (`POST /api/auth/register/`)

#### Request Payload:
```json
{
  "username": "vietdung_iitb",
  "email": "vietdung@example.com",
  "password": "StrongPassword123!",
  "password_confirm": "StrongPassword123!",
  "first_name": "Viet",
  "last_name": "Dung",
  "website": "", 
  "turnstile_token": "0.XTz..."
}
```

#### Response Envelope (Thành công - `201 Created` - Đã chuẩn hoá):
```json
{
  "status": "success",
  "timestamp": "2026-05-24T08:30:00Z",
  "request_id": "req_a1b2c3d4...",
  "data": {
    "username": "vietdung_iitb",
    "email": "vietdung@example.com",
    "plan": "free",
    "tenant_id": "ten_8f2d5e...",
    "verification_required": true,
    "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản."
  }
}
```

#### Response Envelope (Lỗi Validation - `400 Bad Request`):
```json
{
  "detail": "Dữ liệu đăng ký không hợp lệ.",
  "code": "validation_error",
  "timestamp": "2026-05-24T08:30:00Z",
  "request_id": "req_a1b2c3d4...",
  "field_errors": {
    "password_confirm": ["Mật khẩu xác nhận không khớp."],
    "email": ["Không cho phép đăng ký bằng địa chỉ email tạm thời."]
  }
}
```

### 4.2 Quản trị Mail hệ thống (Staff-Only API)
Yêu cầu xác thực (`IsAuthenticated`) và có quyền Operator (`is_staff=True` hoặc `is_superuser=True`).

#### 4.2.1 Thêm cấu hình SMTP (`POST /core/v1/operator/mail-config/`):
- **Body**: `{ "provider": "smtp", "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_use_tls", "smtp_use_ssl", "from_email", "is_active" }`

#### 4.2.2 Thêm cấu hình Google Gmail API (`POST /core/v1/operator/mail-config/`):
- **Cấu hình bằng Service Account JSON (Domain-Wide Delegation - ĐƯỢC CHỌN)**:
  - **Body**: `{ "provider": "gmail_api", "google_service_account_json", "google_delegated_user_email", "from_email", "is_active" }`
  - *Ghi chú*: Cấu hình bằng OAuth2 client Web Flow đã bị decommission chính thức để nâng cao tính bảo mật và tự động hóa runtime ở cấp độ SaaS Enterprise.

#### 4.2.3 Kiểm thử kết nối động trước khi kích hoạt (`POST /core/v1/operator/mail-config/test/`):
- **Body**: `{ "provider", "smtp_host"?, "google_service_account_json"?, "google_delegated_user_email"?, ..., "test_email" }`
- **Response**:
  - `200 OK` nếu thành công:
    ```json
    {
      "status": "success",
      "timestamp": "2026-05-24T08:31:00Z",
      "request_id": "req_x9y8z7...",
      "data": {
        "message": "Thử nghiệm kết nối động và gửi email qua Google API/SMTP thành công."
      }
    }
    ```
  - `400 Bad Request` kèm chi tiết mã lỗi chi tiết trả về từ Google API hoặc SMTP socket nếu thất bại.

---

## 5. KẾ HOẠCH DI CƯ & HỒI PHỤC NGƯỜI DÙNG CŨ (BACKFILL MIGRATION RUNBOOK)

Một khoảng trống nghiêm trọng trong hạ tầng SaaS hiện tại là các tài khoản người dùng cũ (Legacy Users) được tạo trước đợt nâng cấp hoàn toàn **thiếu** bản ghi `CoreTenant` và `CoreServiceAccount`, dẫn tới lỗi đăng nhập `403 Forbidden` liên tục ở production.

### 5.1 Quản trị Command di cư (`backfill_missing_tenants`)
Chúng ta xây dựng một lệnh quản trị Django CLI (`packages/core/backend/src/identity_access/management/commands/backfill_missing_tenants.py`):

```python
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from identity_access.models import CoreTenant, CoreServiceAccount, UserProfile
from tenant_lifecycle.models import TenantLifecycleEvent

User = get_user_model()

class Command(BaseCommand):
    help = "Backfill CoreTenant, UserProfile, and default CoreServiceAccount for legacy users."

    def handle(self, *args, **options):
        # Tìm tất cả users chưa có CoreTenant
        legacy_users = User.objects.filter(core_tenant__isnull=True)
        self.stdout.write(f"[*] Tìm thấy {legacy_users.count()} người dùng cũ thiếu hạ tầng Tenant.")
        
        success_count = 0
        for user in legacy_users:
            try:
                with transaction.atomic():
                    # 1. Tạo CoreTenant
                    tenant = CoreTenant.objects.create(
                        owner_user=user,
                        tenant_code=f"tenant_{user.username}",
                        display_name=f"{user.get_full_name().strip() or user.username}'s Workspace",
                        plan=CoreTenant.PlanChoices.FREE,
                        status=CoreTenant.StatusChoices.ACTIVE,
                    )
                    
                    # 2. Tạo UserProfile
                    UserProfile.objects.get_or_create(
                        user=user,
                        defaults={
                            'tenant': tenant,
                            'display_name': user.get_full_name().strip() or user.username,
                            'theme': 'dark',
                            'language': 'vi'
                        }
                    )
                    
                    # 3. Tạo default active CoreServiceAccount
                    # Nếu user đã active (email verified), cấp scopes AI đầy đủ
                    default_scopes = ['market:read', 'signals:read', 'ai:invoke', 'manage_pats'] if user.is_active else ['market:read', 'signals:read']
                    
                    CoreServiceAccount.objects.create(
                        tenant=tenant,
                        name="default",
                        status=CoreServiceAccount.StatusChoices.ACTIVE,
                        scopes=default_scopes
                    )
                    
                    # 4. Ghi lifecycle event
                    TenantLifecycleEvent.objects.create(
                        tenant=tenant,
                        event_type=TenantLifecycleEvent.EventType.TRIAL_STARTED,
                        actor_type='system_backfill',
                        actor_user=user,
                        new_value={'status': tenant.status, 'plan': tenant.plan}
                    )
                success_count += 1
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"[x] Thất bại di cư cho user {user.username}: {str(e)}"))
        
        self.stdout.write(self.style.SUCCESS(f"[+] Hoàn tất di cư thành công cho {success_count} người dùng cũ."))
```

---

## 6. KẾ HOẠCH PHÁT HÀNH & KỊCH BẢN ỨNG PHÓ SỰ CỐ (ROLLOUT & INCIDENT PLAYBOOK)

### 6.1 Kế hoạch phát hành 3 Giai đoạn (Phased Rollout)

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Shadow Run (Chạy ngầm & So sánh)                  │ (2 tuần)
│  - Gửi song song qua Mail tĩnh và Mail động mới             │
│  - Validate outbox và SMTP connection qua log               │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: Canary Rollout (Canary 10% -> 50%)                │ (1 tuần)
│  - Định tuyến 10% lượng đăng ký mới qua hạ tầng SaaS        │
│  - Monitor tỷ lệ bounce, block spam, error rate             │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: Full Cutover & Decommission                       │ (Ngày Cutover)
│  - Chuyển 100% traffic đăng ký sang SaaS native             │
│  - Decommission hoàn toàn api/auth/register cũ ở Legacy     │
└─────────────────────────────────────────────────────────────┘
```

#### Tiêu chí Go-live (PASS/FAIL Gates)
- **GATE 1 (Bảo mật)**: Đạt 100% tỷ lệ chặn bot honeypot và chặn 100% email từ dải disposable domains trong test suite.
- **GATE 2 (Độ tin cậy)**: 100% outbox events của người đăng ký mới được đồng bộ thành công sang service provisioning. Tỷ lệ thất bại xử lý outbox = 0% trong 5 ngày liên tiếp chạy Shadow.
- **GATE 3 (Hiệu năng)**: P99 Latency của API `/api/auth/register` < 150ms khi bật Turnstile + bộ lọc spam.

### 6.2 Kịch bản Ứng phó Sự cố chi tiết (Incident Playbook)

Khi có sự cố xảy ra (ví dụ: Tỷ lệ lỗi 5xx trên endpoint đăng ký mới > 1% hoặc hàng đợi outbox bị nghẽn > 100 sự kiện), đội vận hành thực thi từng bước playbook sau:

```
[Báo động đỏ: 5xx > 1% hoặc Outbox Lag > 100]
                     │
                     ▼
         ┌───────────────────────┐
         │ Bước 1: Xác định lỗi  │ ──► (Kiểm tra Sentry & Grafana dashboard)
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Bước 2: Chuyển đổi    │ ──► (Staff API: Tắt dynamic config, tự động
         │       Khẩn cấp        │      hạ cấp sang static .env default SMTP)
         └───────────────────────┘
                     │ Lỗi chưa hết
                     ▼
         ┌───────────────────────┐
         │ Bước 3: Run Rollback  │ ──► (Triển khai rollback code & DB migrations)
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Bước 4: Đánh giá SLO  │ ──► (Xác minh P99 < 150ms, lỗi 5xx = 0%)
         └───────────────────────┘
```

#### Quy trình thao tác từng bước (Step-by-step instructions):
- **Bước 1: Xác định nguyên nhân (1 phút)**:
  - *Người thực hiện*: SRE / DevOps on-duty.
  - *Thao tác*: Truy cập Kibana/Elasticsearch quét lỗi `register_view` theo `request_id` để xác định lỗi do Turnstile API sập hay do Google Workspace API từ chối uỷ quyền DWD.
- **Bước 2: Hạ cấp cấu hình khẩn cấp (2 phút)**:
  - *Người thực hiện*: Lead Backend / DevOps.
  - *Thao tác*: Sử dụng API quản trị hoặc Django Admin tắt cấu hình dynamic đang hoạt động (`is_active = False`). Hệ thống sẽ lập tức kích hoạt cơ chế Fail-safe Fallback chuyển toàn bộ luồng gửi email về máy chủ SMTP tĩnh ổn định khai báo ở `.env`.
- **Bước 3: Rollback Code & Database (5 phút)**:
  - *Trường hợp*: Bước 2 không xử lý được (lỗi do DB constraint hoặc core views crash).
  - *Thao tác*:
    1. Gỡ bỏ container / Revert code commit trên Kubernetes cluster về phiên bản thẻ release trước đó:
       `git revert <commit_hash_migration> -m "Rollback registration upgrades"`
    2. Hạ cấp cơ sở dữ liệu về migration an toàn trước đó:
       `python src/manage.py migrate identity_access 0007_canonicalize_service_account_scope_codes`
- **Bước 4: Xác nhận Hồi phục thành công (2 phút)**:
  - *Chỉ số đánh giá*: P99 Latency quay về mức < 150ms, tỷ lệ lỗi 5xx = 0%, và người dùng thật có thể đăng ký tài khoản thành công ở luồng cũ.

---

## 7. THẢO LUẬN QUYẾT ĐỊNH THIẾT KẾ (ARCHITECTURAL DECISION RECORD - ADR)

### Gmail API Mode: Service Account Domain-Wide Delegation (DWD-ONLY)

| Tham số | Quyết định bắt buộc |
|---|---|
| **Mô tả** | Tạo Service Account trên Google Cloud, upload JSON key lên VNInvest, cấp quyền impersonation tại Google Workspace Admin Console. |
| **Ưu điểm** | Bảo mật cao, hoạt động hoàn toàn ở background, không phụ thuộc vòng đời refresh token. |
| **Nhược điểm** | Yêu cầu Google Workspace domain và quyền Admin để cấu hình DWD. |
| **Quyết định** | **DWD-only**. Không hỗ trợ OAuth2 Web Consent flow trong production path của gói nâng cấp này. |

---

## 8. THIẾT KẾ TIN CẬY HỆ THỐNG (RELIABILITY & OUTBOX DESIGN)

Để đảm bảo không bao giờ bị **mất sự kiện kích hoạt tài khoản** (Starter Provisioning) và **tránh việc tạo lặp tài khoản** khi hạ tầng gặp sự cố, hệ thống áp dụng bộ ba thiết kế tin cậy:

### 8.1 Transactional Outbox Pattern
Thay vì gửi trực tiếp `UserRegisteredEvent` sang message broker hoặc gọi trực tiếp task Celery trong quá trình đăng ký, hệ thống ghi sự kiện vào một bảng Outbox (`OutboxEvent`) nằm trong cùng một cơ sở dữ liệu và được thực thi trong cùng một database transaction với việc tạo `User` và `CoreTenant`.

#### Mô hình Outbox (`OutboxEvent`):
```python
class OutboxEvent(models.Model):
    event_id = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True)
    event_type = models.CharField(max_length=100) # e.g., 'user_registered'
    payload = models.JSONField() # Chứa { "user_id": 123, "tenant_id": "ten_..." }
    status = models.CharField(
        max_length=24,
        choices=[('pending', 'Pending'), ('processed', 'Processed'), ('failed', 'Failed')],
        default='pending',
        db_index=True
    )
    retry_count = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(blank=True, null=True)
```

Một tiến trình chạy nền tuần tự (Celery Beat quét mỗi 5 giây hoặc CDC engine) sẽ đọc các event `pending`, đẩy qua handler xử lý, và đánh dấu `processed` sau khi hoàn thành thành công.

### 8.2 Cơ chế Retry Policy & Dead-Letter Queue (DLQ)
- **Retry Policy**: Nếu xử lý outbox event thất bại (ví dụ: service provisioning bị lỗi mạng tạm thời), tiến trình outbox sẽ thực hiện thử lại với cơ chế **Exponential Backoff** kèm **Jitter** (ngẫu nhiên hóa khoảng thời gian chờ để tránh bão truy vấn):
  `delay = min(3600, (2 ** retry_count) + random.uniform(0, 10))`
- **Dead-Letter Queue (DLQ)**: Khi một sự kiện vượt quá **5 lần thử lại**, hệ thống tự động đổi trạng thái sang `failed`, chuyển bản ghi vào **Dead-Letter Queue (DLQ)**, và kích hoạt cảnh báo tới đội vận hành (PagerDuty/Slack) để kiểm tra thủ công.

### 8.3 Chính sách Idempotency (Chống xử lý lặp)
Để tránh trường hợp một outbox event được xử lý nhiều lần dẫn đến việc khởi tạo trùng lặp starter portfolios hoặc ghi đè dữ liệu tenant, phân hệ nhận sự kiện (Consumer) bắt buộc thực thi cơ chế **Idempotency**:
- Bảng nhận tin lưu vết xử lý sự kiện: `ProcessedEvent(event_id, processed_at)`.
- Trước khi xử lý bất kỳ sự kiện nào, consumer thực hiện kiểm tra:
  `if ProcessedEvent.objects.filter(event_id=event.event_id).exists(): return`
- Quá trình ghi nhận `ProcessedEvent` và khởi tạo tài nguyên mẫu được thực thi trong một `transaction.atomic()` duy nhất.

---

## 9. QUẢN TRỊ KHÓA BẢO MẬT & SECRETS GOVERNANCE

### 9.1 Nguồn khóa mã hóa (Key Source)
Hệ thống sử dụng khoá đối xứng AES-256 thông qua thư viện Fernet.
- **Nguồn khóa**: Khoá mã hoá bắt buộc được cấu hình qua biến môi trường độc lập **`MAIL_CREDENTIAL_FERNET_KEY`** (không dùng chung khoá với các phân hệ khác).
- Biến này được phân phối an toàn qua Docker Secrets hoặc HashiCorp Vault tại thời điểm runtime và cấm ghi đè hoặc fallback về giá trị mặc định tĩnh ở môi trường production.

### 9.2 Vòng đời và Quy trình đổi khóa (Key Rotation Runbook)
Thực hiện đổi khoá mã hoá SMTP/Google Credentials định kỳ 6 tháng một lần hoặc lập tức khi có nghi vấn rò rỉ:
1. **Bước 1**: Cấu hình hệ thống hỗ trợ khoá kép (Dual-key support) bằng cách bổ sung biến `MAIL_CREDENTIAL_FERNET_KEY_OLD`.
2. **Bước 2**: Chạy công cụ dòng lệnh (Management Job) để giải mã dữ liệu cũ bằng khoá cũ và mã hoá lại bằng khoá mới:
   ```python
   # Pseudocode migration job
   for config in SystemMailConfig.objects.all():
       if config.smtp_password_encrypted:
           plain = decrypt_with_key(config.smtp_password_encrypted, KEY_OLD)
           config.smtp_password_encrypted = encrypt_with_key(plain, KEY_NEW)
           config.save()
   ```
3. **Bước 3**: Gỡ bỏ khoá cũ `MAIL_CREDENTIAL_FERNET_KEY_OLD` khỏi môi trường và giữ duy nhất khoá mới.

### 9.3 Chính sách Chống rò rỉ Thông tin nhạy cảm (Audit Log Masking)
- Cấm ghi log (stdout/stderr) bất kỳ giá trị nào liên quan đến: `smtp_password`, `google_service_account_json`, `google_delegated_user_email`.
- Thiết lập bộ lọc Filter của Python Logging (`vninvest_core/utils/log_filters.py`) để quét và ghi đè toàn bộ các chuỗi có định dạng khoá bí mật thành `[MASKED]` trước khi đẩy ra console/file log/Sentry.

---

## 10. RÀNG BUỘC TOÀN VẸN CƠ SỞ DỮ LIỆU (DATABASE INTEGRITY CONSTRAINTS)

Để ngăn ngừa triệt để tình trạng bất nhất dữ liệu (Race Condition) khi nhiều quản trị viên cùng lúc thao tác bật `is_active=True` trên nhiều bản ghi khác nhau, hệ thống thực thi hai lớp bảo vệ dữ liệu ở mức DB:

### 10.1 Database-level Partial Unique Constraint
Chúng ta định nghĩa ràng buộc duy nhất một phần (Partial Unique Index) trực tiếp tại PostgreSQL ở mức định nghĩa Model Django:

```python
class Meta:
    constraints = [
        models.UniqueConstraint(
            fields=['is_active'],
            condition=models.Q(is_active=True),
            name='unique_active_system_mail_config'
        )
    ]
```

Ràng buộc này đảm bảo rằng: Hệ quản trị cơ sở dữ liệu sẽ **từ chối hoàn toàn** bất kỳ giao dịch ghi nào cố tình tạo ra bản ghi thứ hai có `is_active=True`, trả về lỗi `IntegrityError` ở mức SQL giúp chặn đứng hoàn toàn hiện tượng race condition ở mức vật lý.

### 10.2 Lock Giao dịch khi kích hoạt (Transaction Locking)
Khi một quản trị viên cập nhật trạng thái kích hoạt của một cấu hình thư qua API, luồng xử lý sẽ thực hiện khoá bản ghi trong DB bằng cơ chế **Optimistic Locking** hoặc **`select_for_update()`**:

```python
with transaction.atomic():
    # Khoá tất cả các cấu hình mail hiện tại để cập nhật an toàn
    configs = SystemMailConfig.objects.select_for_update().all()
    # Tắt cấu hình cũ
    configs.filter(is_active=True).update(is_active=False)
    # Bật cấu hình mới được chọn
    target_config = configs.get(pk=config_id)
    target_config.is_active = True
    target_config.save()
```

---

## 11. PHỤ LỤC: MA TRẬN KIỂM THỬ MỞ RỘNG (EXPANDED TEST MATRIX)

Bộ kiểm thử đạt chuẩn PR Gate phải chạy qua các bài test nâng cao sau:

| Mã Test Case | Loại kiểm thử | Kịch bản chi tiết | Kết quả mong đợi |
|---|---|---|---|
| **TC_CONCURRENCY_01** | Concurrency Test | Giả lập 10 luồng đồng thời gọi API kích hoạt (`is_active=True`) trên 10 cấu hình mail khác nhau. | Chỉ duy nhất 1 luồng thành công. 9 luồng còn lại bị DB rollback bằng `IntegrityError` và trả về lỗi 409 Conflict chuẩn. |
| **TC_CHAOS_FAILOVER_02** | Chaos/Failover | Bật cấu hình dynamic Gmail API nhưng ngắt kết nối mạng của API Google (giả lập Google sập). | Hệ thống tự động catch exception, ghi nhận lỗi, và **fallback mượt mà** sang SMTP mặc định trong `.env` để gửi mail cứu trợ. Người dùng không nhận lỗi 5xx. |
| **TC_OUTBOX_ATOMIC_03** | Reliability | Thực hiện tạo user thành công nhưng ép lỗi hệ thống ném ra ngay trước khi transaction kết thúc (giả lập crash DB). | Giao dịch rollback hoàn toàn. Không có User nào được tạo trong DB và cũng **không có** Outbox event nào bị lưu lạc. |
| **TC_OUTBOX_CONSUME_04** | Idempotency | Gửi một outbox event kích hoạt provisioning 2 lần liên tục cho consumer. | Consumer nhận dạng trùng lặp `event_id` thông qua bảng `ProcessedEvent`, hủy bỏ lượt xử lý thứ 2 và không tạo trùng lặp danh mục. |
| **TC_MIGRATION_KEY_05** | Migration Test | Thay thế khoá `MAIL_CREDENTIAL_FERNET_KEY` bằng khoá mới và chạy lệnh rotation script. | Toàn bộ dữ liệu mật khẩu được giải mã thành công bằng khoá cũ và tái mã hoá chính xác bằng khoá mới. |

---
*Tài liệu này được đề xuất, cập nhật và ký duyệt bởi Antigravity AI Coding Assistant.*
