# BACKEND DESIGN: Nâng cấp Đăng ký Người dùng SaaS Native OpenAPI kèm Chống Spam
**Mã tài liệu**: `BACKEND_DESIGN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524`  
**Ngày phát hành**: 24-05-2026  
**Trạng thái**: BAN HÀNH CHÍNH THỨC  
**Phạm vi**: Backend API Service (`packages/core`)  

---

## 1. THIẾT KẾ CƠ SỞ DỮ LIỆU & QUY TẮC MÃ HÓA (DB SCHEMA & CRYPTOGRAPHY)

Để phục vụ phân hệ Quản trị Mail động và Transactional Outbox, backend thiết lập chi tiết các model và cơ chế mã hóa mật mã sau:

### 1.1 Model Cấu hình Mail (`SystemMailConfig`)
Bảng này lưu cấu hình kết nối mail (SMTP hoặc Google Gmail API). Chỉ cho phép duy nhất một cấu hình ở trạng thái hoạt động (`is_active=True`).

```python
# Location: packages/core/backend/src/identity_access/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()

class SystemMailConfig(models.Model):
    PROVIDER_SMTP = 'smtp'
    PROVIDER_GMAIL = 'gmail_api'
    PROVIDER_CHOICES = [
        (PROVIDER_SMTP, 'SMTP Server'),
        (PROVIDER_GMAIL, 'Google Gmail API (Service Account DWD)'),
    ]

    provider = models.CharField(max_length=24, choices=PROVIDER_CHOICES, default=PROVIDER_SMTP)
    is_active = models.BooleanField(default=False, db_index=True)
    from_email = models.EmailField(max_length=255)
    
    # SMTP Parameters
    smtp_host = models.CharField(max_length=255, blank=True, null=True)
    smtp_port = models.IntegerField(default=587, blank=True, null=True)
    smtp_username = models.CharField(max_length=255, blank=True, null=True)
    smtp_password_encrypted = models.BinaryField(blank=True, null=True)
    smtp_use_tls = models.BooleanField(default=True)
    smtp_use_ssl = models.BooleanField(default=False)

    # Google API Service Account Parameters
    google_service_account_json_encrypted = models.BinaryField(blank=True, null=True)
    google_delegated_user_email = models.EmailField(max_length=255, blank=True, null=True)

    # Audit Trail Fields
    last_modified_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mail_configs_modified'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'core_system_mail_config'
        constraints = [
            # SQL level constraint: Chỉ cho phép duy nhất 1 bản ghi có is_active=True
            models.UniqueConstraint(
                fields=['is_active'],
                condition=models.Q(is_active=True),
                name='unique_active_system_mail_config'
            )
        ]

    def clean(self):
        super().clean()
        if self.provider == self.PROVIDER_SMTP:
            if not all([self.smtp_host, self.smtp_port, self.smtp_username]):
                raise ValidationError("Cấu hình SMTP yêu cầu điền đầy đủ host, port và username.")
        elif self.provider == self.PROVIDER_GMAIL:
            if not all([self.google_service_account_json_encrypted, self.google_delegated_user_email]):
                raise ValidationError("Cấu hình Google Gmail API yêu cầu đầy đủ Service Account JSON và Email ủy quyền (DWD).")
```

### 1.2 Model Transactional Outbox & Idempotency
Bảo đảm tính nhất quán Zero-Loss giữa nghiệp vụ đăng ký và provisioning bất đồng bộ.

```python
# Location: packages/core/backend/src/identity_access/models.py
import uuid

class OutboxEvent(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSED = 'processed'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSED, 'Processed'),
        (STATUS_FAILED, 'Failed'),
    ]

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    event_type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField()
    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    retry_count = models.IntegerField(default=0)
    last_error = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'core_outbox_event'
        ordering = ['created_at']

# Location: packages/core/backend/src/user_workspace/models.py
class ProcessedEvent(models.Model):
    event_id = models.UUIDField(unique=True, primary_key=True, editable=False)
    processed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'core_processed_event'
```

### 1.3 Quy trình Mã hóa và Giám sát Audit Log Masking
Để tránh rò rỉ mã bảo mật, backend tích hợp bộ giải mã Fernet tự động:

```python
# Location: packages/core/backend/src/vninvest_core/utils/crypto.py
import os
from cryptography.fernet import Fernet

def get_crypto_cipher() -> Fernet:
    key = os.environ.get('MAIL_CREDENTIAL_FERNET_KEY', '').strip()
    if not key or len(key) != 44:  # Yêu cầu chuẩn 32-bytes base64 key
        raise RuntimeError("THIẾT LẬP THIẾU: MAIL_CREDENTIAL_FERNET_KEY bắt buộc phải được khai báo đúng định dạng AES-256 Fernet.")
    return Fernet(key.encode())

def encrypt_secret(plaintext: str) -> bytes:
    if not plaintext:
        return b''
    return get_crypto_cipher().encrypt(plaintext.encode('utf-8'))

def decrypt_secret(ciphertext: bytes) -> str:
    if not ciphertext:
        return ""
    return get_crypto_cipher().decrypt(bytes(ciphertext)).decode('utf-8')
```

---

## 2. LỚP THIẾT KẾ SERIALIZER CHỐNG SPAM 3 TẦNG (VALIDATION LAYER)

Lớp `SaaSRegisterSerializer` chịu trách nhiệm chặn đứng spam trước khi truy cập database.

```python
# Location: packages/core/backend/src/identity_access/serializers.py
import re
import requests
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()
logger = logging.getLogger(__name__)

class SaaSRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    
    # Spam Shield inputs
    website = serializers.CharField(required=False, allow_blank=True)  # Honeypot field
    turnstile_token = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        if not re.match(r'^[a-zA-Z0-9_]{3,30}$', value):
            raise serializers.ValidationError("Tên đăng nhập chỉ chứa ký tự chữ, số và dấu gạch dưới (3-30 ký tự).")
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Tên đăng nhập này đã tồn tại.")
        return value.lower().strip()

    def validate_email(self, value):
        email_clean = value.lower().strip()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("Địa chỉ email này đã được đăng ký.")
        
        # Tầng 2: Disposable Domain Block (O(1) Hash Set Lookup)
        domain = email_clean.split('@')[-1]
        disposable_set = getattr(settings, 'BLOCKED_DISPOSABLE_DOMAINS', set())
        if domain in disposable_set:
            logger.warning(f"[SPAM_SHIELD] Rejected disposable email domain: {domain}")
            raise serializers.ValidationError("Không cho phép đăng ký bằng địa chỉ email tạm thời.")
        return email_clean

    def validate(self, attrs):
        # Kiểm tra tính trùng khớp mật khẩu
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Mật khẩu xác nhận không khớp."})
        
        # Enforce Django password strength validation
        validate_password(attrs['password'])

        # Tầng 1: Bẫy Honeypot Check
        if attrs.get('website'):
            logger.warning("[SPAM_SHIELD] Honeypot field 'website' was filled. Potential bot registration dropped.")
            # Trả về lỗi validation giả để bot không nhận biết được cơ chế phòng thủ
            raise serializers.ValidationError({"website": "Lỗi kết nối máy chủ. Vui lòng thử lại sau."})

        # Tầng 3: Cloudflare Turnstile token validation
        token = attrs.get('turnstile_token')
        client_ip = self.context.get('client_ip', '0.0.0.0')
        self._verify_turnstile(token, client_ip)

        return attrs

    def _verify_turnstile(self, token, client_ip):
        secret_key = getattr(settings, 'TURNSTILE_SECRET_KEY', '').strip()
        if not secret_key:
            if settings.DEBUG:
                logger.warning("[SPAM_SHIELD] Missing TURNSTILE_SECRET_KEY in DEBUG mode. Skipping verification.")
                return
            else:
                logger.critical("[SPAM_SHIELD] ImproperlyConfigured: TURNSTILE_SECRET_KEY is empty in production.")
                raise RuntimeError("Hệ thống Mail và Bảo mật chưa được cấu hình đầy đủ.")

        if not token:
            raise serializers.ValidationError({"turnstile_token": "Yêu cầu mã xác thực Turnstile."})

        verify_url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
        try:
            res = requests.post(
                verify_url,
                data={'secret': secret_key, 'response': token, 'remoteip': client_ip},
                timeout=3.0  # 3000ms SLA budget
            )
            res.raise_for_status()
            result_json = res.json()
            if not result_json.get('success'):
                logger.warning(f"[SPAM_SHIELD] Turnstile verification failed. Error-codes: {result_json.get('error-codes')}")
                raise serializers.ValidationError({"turnstile_token": "Xác thực Turnstile không hợp lệ hoặc hết hạn."})
        except requests.RequestException as e:
            logger.error(f"[SPAM_SHIELD] Turnstile validation timeout/failure: {str(e)}")
            raise serializers.ValidationError({"turnstile_token": "Không thể kết nối máy chủ xác thực Turnstile. Vui lòng thử lại."})
```

---

## 3. THIẾT KẾ VIEW CHUYÊN BIỆT & TENANT PROVISIONING (ATOMIC TRANSACTIONS)

### 3.1 Views Đăng ký SaaS Native OpenAPI (`register_view`)
View điều phối việc tạo User, Tenant, UserProfile, Service Account, và Outbox Event trong một khối giao dịch duy nhất.

```python
# Location: packages/core/backend/src/identity_access/views_auth.py
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from identity_access.serializers import SaaSRegisterSerializer
from identity_access.models import OutboxEvent
from tenant_lifecycle.models import CoreTenant, CoreServiceAccount, UserProfile
import logging

logger = logging.getLogger(__name__)

class SaaSRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        # Thu thập Client IP để xác minh Turnstile
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        client_ip = x_forwarded_for.split(',')[0].strip() if x_forwarded_for else request.META.get('REMOTE_ADDR', '0.0.0.0')

        serializer = SaaSRegisterSerializer(data=request.data, context={'client_ip': client_ip})
        if not serializer.is_valid():
            # Đồng bộ hoá với cấu trúc Error Envelope của OpenAPI
            return Response({
                "detail": "Dữ liệu đăng ký không hợp lệ.",
                "code": "validation_error",
                "field_errors": serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        
        try:
            with transaction.atomic():
                # 1. Tạo đối tượng User (chờ kích hoạt qua email)
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.create_user(
                    username=data['username'],
                    email=data['email'],
                    password=data['password'],
                    first_name=data.get('first_name', ''),
                    last_name=data.get('last_name', ''),
                    is_active=False
                )

                # 2. Tạo CoreTenant tương ứng làm chủ sở hữu
                tenant = CoreTenant.objects.create(
                    owner_user=user,
                    tenant_code=f"tenant_{user.username}",
                    display_name=f"{user.first_name} {user.last_name}'s Workspace".strip() or f"{user.username}'s Workspace",
                    plan=CoreTenant.PlanChoices.FREE,
                    status=CoreTenant.StatusChoices.ACTIVE
                )

                # 3. Tạo UserProfile cho tuỳ chỉnh giao diện mặc định
                UserProfile.objects.create(
                    user=user,
                    tenant=tenant,
                    display_name=f"{user.first_name} {user.last_name}".strip() or user.username,
                    theme='dark',
                    language='vi'
                )

                # 4. Áp dụng Quyền tối thiểu (Least Privilege)
                # Tạo Service Account ở mức phân quyền thấp
                service_account = CoreServiceAccount.objects.create(
                    tenant=tenant,
                    name="default",
                    status=CoreServiceAccount.StatusChoices.ACTIVE,
                    scopes=['market:read', 'signals:read']  # Chỉ đọc dữ liệu thị trường căn bản
                )

                # 5. Ghi nhận Transactional Outbox Event
                event_payload = {
                    "user_id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "tenant_id": str(tenant.id),
                    "service_account_id": str(service_account.id)
                }
                
                outbox_event = OutboxEvent.objects.create(
                    event_type='UserRegisteredEvent',
                    payload=event_payload,
                    status=OutboxEvent.STATUS_PENDING
                )

                # 6. Lập lịch gửi Email bất đồng bộ an toàn qua on_commit
                # Tránh tình trạng celery task query DB trước khi transaction commit thực sự
                transaction.on_commit(
                    lambda: trigger_email_verification_flow.delay(user.id, outbox_event.event_id)
                )

            # Đồng bộ hoá với cấu trúc Success Envelope của OpenAPI
            return Response({
                "status": "success",
                "data": {
                    "username": user.username,
                    "email": user.email,
                    "plan": tenant.plan,
                    "tenant_id": str(tenant.id),
                    "verification_required": True,
                    "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản."
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.exception("Error occured during user registration provisioning transaction.")
            return Response({
                "detail": "Không thể xử lý yêu cầu đăng ký do lỗi hệ thống.",
                "code": "server_error"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

### 3.2 Kích hoạt & Nâng quyền Tiến trình (Progressive Scope Elevation)
View xác thực email sẽ nâng cấp scopes của Service Account sau khi link OTP được xác nhận thành công.

```python
# Location: packages/core/backend/src/identity_access/views_auth.py
class SaaSVerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        token_plaintext = request.GET.get('token')
        if not token_plaintext:
            return Response({"detail": "Thiếu mã xác nhận email.", "code": "missing_token"}, status=400)

        # 1. Tìm và xác thực token băm SHA-256 trong database
        import hashlib
        token_hash = hashlib.sha256(token_plaintext.encode()).hexdigest()
        
        # Triển khai logic tìm token, kiểm tra TTL quá hạn (30 phút)...
        # Giả định tìm thấy `verification_record` liên kết với `user`
        
        try:
            with transaction.atomic():
                user = verification_record.user
                user.is_active = True
                user.save()

                # Nâng cấp quyền Service Account lên mức Premium AI đầy đủ
                tenant = user.core_tenant
                service_account = CoreServiceAccount.objects.select_for_update().get(tenant=tenant, name="default")
                
                # Progressive elevation
                extended_scopes = list(set(service_account.scopes + ['ai:invoke', 'manage_pats']))
                service_account.scopes = extended_scopes
                service_account.save()

                # Đánh dấu token đã sử dụng
                verification_record.is_used = True
                verification_record.save()

            return Response({
                "status": "success",
                "data": {
                    "message": "Xác minh tài khoản thành công. Quyền hạn ngạch dịch vụ AI đã được nâng cấp đầy đủ."
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.exception("Failed to elevate service account scopes during email verification.")
            return Response({"detail": "Quá trình xác minh thất bại.", "code": "verification_failed"}, status=500)
```

---

## 4. THIẾT KẾ ROUTER GỬI EMAIL ĐỘNG & GOOGLE SERVICE ACCOUNT DWD

Hạ tầng định tuyến gửi email bất đồng bộ được thực hiện qua Celery Task.

```python
# Location: packages/core/backend/src/data_ingest/tasks.py
import json
import base64
import logging
from django.core.mail import send_mail, get_connection
from email.mime.text import MIMEText
from google.oauth2 import service_account
from googleapiclient.discovery import build
from identity_access.models import SystemMailConfig
from vninvest_core.utils.crypto import decrypt_secret

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=5)
def trigger_email_verification_flow(self, user_id, outbox_event_id):
    try:
        # Tìm cấu hình mail động active
        mail_config = SystemMailConfig.objects.filter(is_active=True).first()
        
        # Sinh token và sinh liên kết kích hoạt...
        verification_link = f"https://vninvest.vn/verify-email?token={token_plaintext}"
        subject = "[VNInvest] Xác minh tài khoản đầu tư của bạn"
        html_content = f"<p>Vui lòng click vào liên kết để kích hoạt: <a href='{verification_link}'>{verification_link}</a></p>"

        if not mail_config:
            # 1. FAIL-SAFE FALLBACK: Sử dụng SMTP tĩnh khai báo ở settings.py
            logger.info("[MAIL_ROUTER] No dynamic active mail config. Using default static SMTP in settings.py")
            send_mail(
                subject=subject,
                message="",
                html_message=html_content,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user_email],
                fail_silently=False
            )
        else:
            # 2. DYNAMIC ROUTING
            if mail_config.provider == SystemMailConfig.PROVIDER_SMTP:
                logger.info(f"[MAIL_ROUTER] Routing via dynamic SMTP host: {mail_config.smtp_host}")
                connection = get_connection(
                    host=mail_config.smtp_host,
                    port=mail_config.smtp_port,
                    username=mail_config.smtp_username,
                    password=decrypt_secret(mail_config.smtp_password_encrypted),
                    use_tls=mail_config.smtp_use_tls,
                    use_ssl=mail_config.smtp_use_ssl,
                    timeout=3.0  # connection timeout 3000ms
                )
                send_mail(
                    subject=subject,
                    message="",
                    html_message=html_content,
                    from_email=mail_config.from_email,
                    recipient_list=[user_email],
                    connection=connection,
                    fail_silently=False
                )
            elif mail_config.provider == SystemMailConfig.PROVIDER_GMAIL:
                logger.info(f"[MAIL_ROUTER] Routing via dynamic Google Gmail API (DWD target: {mail_config.google_delegated_user_email})")
                
                # A. Giải mã và nạp Service Account JSON key
                sa_json = decrypt_secret(mail_config.google_service_account_json_encrypted)
                sa_info = json.loads(sa_json)
                
                # B. Tạo credentials với quyền ủy nhiệm DWD (Domain-Wide Delegation)
                scopes = ['https://www.googleapis.com/auth/gmail.send']
                credentials = service_account.Credentials.from_service_account_info(
                    sa_info,
                    scopes=scopes
                ).with_subject(mail_config.google_delegated_user_email)

                # C. Xây dựng dịch vụ Gmail Client
                service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
                
                # D. Đóng gói MIME chuẩn RFC
                message = MIMEText(html_content, 'html', 'utf-8')
                message['to'] = user_email
                message['from'] = mail_config.from_email
                message['subject'] = subject

                # E. Base64 URL safe encoding
                raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
                
                # F. Gửi qua Google API
                service.users().messages().send(userId='me', body={'raw': raw_message}).execute()
        
        # Đánh dấu OutboxEvent processed thành công
        from identity_access.models import OutboxEvent
        OutboxEvent.objects.filter(event_id=outbox_event_id).update(
            status=OutboxEvent.STATUS_PROCESSED,
            processed_at=timezone.now()
        )

    except Exception as exc:
        logger.exception(f"[MAIL_ROUTER] Failed to send verification email. Retrying.")
        # Exponential backoff retry
        # delay = min(3600, (2 ** self.request.retries) + random.uniform(0, 10))
        self.retry(exc=exc, countdown=min(3600, (2 ** self.request.retries) + 5))
```

---

## 5. THIẾT KẾ OPERATOR API & BẢO MẬT GHI NHẬT KÝ (AUDIT TRAIL LOGGING)

Staff Operator API thực hiện CRUD trên bảng cấu hình và ghi nhật ký nhạy cảm an toàn.

```python
# Location: packages/core/backend/src/identity_access/views_operator.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from django.db import transaction
from django.db.models import Q
from identity_access.models import SystemMailConfig
from vninvest_core.utils.crypto import encrypt_secret
import logging

logger = logging.getLogger(__name__)

# Bảng ghi nhật ký kiểm toán (Audit Trail)
# Cần tạo bảng core_mail_config_audit_log trong DB để lưu vết thao tác staff
class MailConfigAuditLog(models.Model):
    operator_user = models.ForeignKey(User, on_delete=models.CASCADE)
    action = models.CharField(max_length=50) # create, update, activate, deactivate
    target_config_id = models.IntegerField()
    description = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

class OperatorMailConfigView(APIView):
    permission_classes = [IsAdminUser]  # Staff only (is_staff=True)

    def post(self, request):
        data = request.data
        provider = data.get('provider')
        from_email = data.get('from_email')

        try:
            with transaction.atomic():
                config = SystemMailConfig(
                    provider=provider,
                    from_email=from_email,
                    last_modified_by=request.user
                )

                if provider == 'smtp':
                    config.smtp_host = data.get('smtp_host')
                    config.smtp_port = int(data.get('smtp_port', 587))
                    config.smtp_username = data.get('smtp_username')
                    config.smtp_use_tls = data.get('smtp_use_tls', True)
                    config.smtp_use_ssl = data.get('smtp_use_ssl', False)
                    # Tự động mã hóa đối xứng AES
                    config.smtp_password_encrypted = encrypt_secret(data.get('smtp_password'))
                elif provider == 'gmail_api':
                    config.google_delegated_user_email = data.get('google_delegated_user_email')
                    # Tự động mã hóa đối xứng Private Key JSON của Service Account
                    config.google_service_account_json_encrypted = encrypt_secret(data.get('google_service_account_json'))

                config.save()

                # Ghi nhận Audit Log bắt buộc bảo vệ an ninh hệ thống
                # KHÔNG ghi logs các plaintext credentials
                MailConfigAuditLog.objects.create(
                    operator_user=request.user,
                    action="create",
                    target_config_id=config.id,
                    description=f"Staff created new mail config (Provider: {provider}, Sender: {from_email})"
                )

            return Response({
                "status": "success",
                "data": {"id": config.id, "message": "Tạo cấu hình mail hệ thống thành công."}
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception("Failed to create mail configuration.")
            return Response({"detail": "Lỗi hệ thống.", "code": "server_error"}, status=500)
```

---

## 6. THIẾT KẾ MANAGEMENT COMMAND KHÔI PHỤC DỮ LIỆU TENANT (BACKFILL RUNBOOK)

Cung cấp script CLI Django bảo đảm khôi phục dữ liệu tenancy đồng nhất cho toàn bộ người dùng cũ, giải quyết dứt điểm lỗi login 403.

- **Vị trí tệp**: `packages/core/backend/src/identity_access/management/commands/backfill_missing_tenants.py`
- **Thực thi**: `python manage.py backfill_missing_tenants`
- **Bảo vệ an toàn**: Chạy trong các giao dịch `transaction.atomic()` riêng biệt cho từng người dùng (isolated transactions) để nếu một tài khoản lỗi, toàn bộ tiến trình chung không bị crash hoặc ngắt quãng giữa chừng.

```python
# Location: packages/core/backend/src/identity_access/management/commands/backfill_missing_tenants.py
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from identity_access.models import CoreTenant, CoreServiceAccount, UserProfile
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Khôi phục hạ tầng Tenancy (CoreTenant, UserProfile, Service Account) cho người dùng cũ tránh lỗi login 403."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Chạy giả lập để đếm số lượng tài khoản lỗi mà không ghi đè thay đổi vào DB.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        # Tìm các tài khoản Django User thiếu hạ tầng CoreTenant
        legacy_users = User.objects.filter(core_tenant__isnull=True)
        total_found = legacy_users.count()

        self.stdout.write(self.style.WARNING(f"[*] Phát hiện {total_found} tài khoản người dùng cũ bị thiếu hạ tầng Tenancy."))
        
        if dry_run:
            self.stdout.write(self.style.SUCCESS("[+] Chế độ Dry-run hoạt động: Không có thay đổi nào được ghi nhận."))
            return

        success_count = 0
        error_count = 0

        for user in legacy_users:
            try:
                # Wrap isolated transaction cho từng user
                with transaction.atomic():
                    # 1. Tạo CoreTenant
                    tenant = CoreTenant.objects.create(
                        owner_user=user,
                        tenant_code=f"tenant_{user.username}",
                        display_name=f"{user.get_full_name().strip() or user.username}'s Workspace",
                        plan=CoreTenant.PlanChoices.FREE,
                        status=CoreTenant.StatusChoices.ACTIVE
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
                    # Nâng scopes AI đầy đủ nếu email người dùng cũ đã được xác thực trước đó
                    default_scopes = ['market:read', 'signals:read', 'ai:invoke', 'manage_pats'] if user.is_active else ['market:read', 'signals:read']
                    
                    CoreServiceAccount.objects.create(
                        tenant=tenant,
                        name="default",
                        status=CoreServiceAccount.StatusChoices.ACTIVE,
                        scopes=default_scopes
                    )

                success_count += 1
                if success_count % 10 == 0:
                    self.stdout.write(f"  [+] Đã xử lý khôi phục thành công {success_count}/{total_found} users...")

            except Exception as e:
                error_count += 1
                logger.error(f"Failed to backfill tenancy for user {user.username}: {str(e)}")
                self.stderr.write(self.style.ERROR(f"  [x] Lỗi di cư tài khoản {user.username}: {str(e)}"))

        self.stdout.write(self.style.SUCCESS(
            f"[+] BÀN GIAO HOÀN TẤT: Di cư thành công {success_count} tài khoản. Thất bại: {error_count}."
        ))
