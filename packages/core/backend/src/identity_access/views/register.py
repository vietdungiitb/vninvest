import logging
import secrets
import hashlib
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.conf import settings as django_settings
from django.utils import timezone
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from ..models import CoreTenant, UserProfile, CoreServiceAccount, OutboxEvent, EmailVerificationToken
from vninvest_core.exceptions import (
    ValidationErrorException,
    ConflictErrorException,
    RateLimitErrorException,
    InternalErrorException,
)
from .helpers import success_response

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """
    SFI-B2.2: POST /api/auth/register/
    Upgraded SaaS Native User Registration with 3-Layer Spam Shield and Transactional Outbox.
    """
    from django.db import transaction
    from ..serializers import SaaSRegisterSerializer

    # Rate limit per IP, Email normalized, and Subnet (R3 Multi-dimension Anti-abuse)
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
    
    # 1. IP Rate Limiting (3/min)
    ip_key = f'ratelimit:register:ip:{client_ip}'
    ip_count = cache.get(ip_key, 0)
    if ip_count >= getattr(django_settings, 'REGISTER_IP_LIMIT_THRESHOLD', 3):
        raise RateLimitErrorException(
            detail='Thử lại quá nhanh từ IP này. Vui lòng đợi 1 phút.',
            code='register_rate_limit_exceeded',
        )
    
    # 2. Subnet Rate Limiting (10/min per /24 subnet)
    def get_subnet(ip):
        if ':' in ip:  # IPv6
            return ':'.join(ip.split(':')[:4])
        else:  # IPv4
            return '.'.join(ip.split('.')[:3])
    subnet = get_subnet(client_ip)
    subnet_key = f'ratelimit:register:subnet:{subnet}'
    subnet_count = cache.get(subnet_key, 0)
    if subnet_count >= getattr(django_settings, 'REGISTER_SUBNET_LIMIT_THRESHOLD', 10):
        raise RateLimitErrorException(
            detail='Thử lại quá nhanh từ mạng của bạn. Vui lòng đợi 1 phút.',
            code='register_rate_limit_exceeded',
        )
        
    # 3. Email Rate Limiting (2/min per normalized email)
    email_raw = str(request.data.get('email', '') or '').strip()
    normalized_email = email_raw.lower()
    if normalized_email:
        email_key = f'ratelimit:register:email:{normalized_email}'
        email_count = cache.get(email_key, 0)
        if email_count >= getattr(django_settings, 'REGISTER_EMAIL_LIMIT_THRESHOLD', 2):
            raise RateLimitErrorException(
                detail='Thử lại quá nhanh với email này. Vui lòng đợi 1 phút.',
                code='register_rate_limit_exceeded',
            )
            
    # Tăng và đặt các cache key
    cache.set(ip_key, ip_count + 1, 60)
    cache.set(subnet_key, subnet_count + 1, 60)
    if normalized_email:
        cache.set(email_key, email_count + 1, 60)
    
    # Check duplicate username and email to raise standard 409 Conflict error codes
    username = request.data.get('username')
    email = request.data.get('email')
    
    if username and User.objects.filter(username__iexact=username.strip()).exists():
        raise ConflictErrorException(
            detail="Tên đăng nhập này đã tồn tại.",
            code="username_already_exists"
        )
        
    if email and User.objects.filter(email__iexact=email.strip()).exists():
        raise ConflictErrorException(
            detail="Địa chỉ email này đã được đăng ký.",
            code="email_already_exists"
        )

    serializer = SaaSRegisterSerializer(data=request.data, context={'client_ip': client_ip})
    if not serializer.is_valid():
        raise ValidationErrorException(
            detail=serializer.errors,
            code='validation_error'
        )

    data = serializer.validated_data

    try:
        with transaction.atomic():
            # 1. Tạo đối tượng User (chờ kích hoạt qua email)
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

            # 3. Tạo UserProfile
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

            # 6. Sinh token xác minh và gửi email
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            
            # Hủy kích hoạt tất cả các token xác minh cũ của user
            EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)
            
            # Tạo token mới trong DB với TTL 30 phút
            token_ttl_min = getattr(django_settings, 'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', 30)
            expires_at = timezone.now() + timedelta(minutes=token_ttl_min)
            EmailVerificationToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=expires_at
            )

            # Lập lịch gửi Email bất đồng bộ an toàn qua on_commit
            from django.conf import settings
            from data_ingest.tasks import trigger_email_verification_flow
            transaction.on_commit(
                lambda: trigger_email_verification_flow.delay(user.id, outbox_event.event_id, email=user.email, token=raw_token, frontend_url=settings.FRONTEND_URL)
            )

        # Trả về Success Envelope chuẩn OpenAPI
        return success_response({
            "username": user.username,
            "email": user.email,
            "plan": tenant.plan,
            "tenant_id": str(tenant.id),
            "verification_required": True,
            "message": "Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản."
        }, status.HTTP_201_CREATED, request=request)

    except Exception as e:
        logger.exception("Error occurred during user registration provisioning transaction.")
        raise InternalErrorException(
            detail="Không thể xử lý yêu cầu đăng ký do lỗi hệ thống.",
            code="server_error"
        )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def verify_email_view(request):
    """
    SFI-B2.3: POST /api/auth/verify-email/
    Body: { "token": "..." }
    Activates the user account and elevates scopes.
    """
    from django.db import transaction
    token = str(request.data.get('token', '') or '').strip()
    if not token:
        raise ValidationErrorException(
            detail={'token': ['token is required.']},
            code='validation_error'
        )

    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    token_obj = EmailVerificationToken.objects.filter(token_hash=token_hash).first()
    
    if not token_obj:
        raise ValidationErrorException(
            detail='Token không hợp lệ hoặc đã hết hạn.',
            code='invalid_token'
        )

    # Đảm bảo email chưa bị khóa xác minh (Rate Limiting/Lockout)
    email_key = token_obj.user.email.strip().lower()
    lockout_key = f'ratelimit:verify:attempts:{email_key}'
    attempts = cache.get(lockout_key, 0)
    max_attempts = getattr(django_settings, 'EMAIL_VERIFICATION_MAX_ATTEMPTS', 5)
    if attempts >= max_attempts:
        raise RateLimitErrorException(
            detail='Tài khoản này đã bị khóa xác minh do thử quá nhiều lần. Vui lòng yêu cầu gửi lại email.',
            code='verification_locked_out'
        )

    if token_obj.is_used or token_obj.expires_at < timezone.now() or token_obj.attempts >= max_attempts:
        # Tăng số lần thử sai trên token và trong cache
        if not token_obj.is_used:
            token_obj.attempts += 1
            if token_obj.attempts >= max_attempts:
                token_obj.is_used = True
            token_obj.save(update_fields=['attempts', 'is_used'])
        
        cache.set(lockout_key, attempts + 1, 900) # Khóa 15 phút (900s)
        raise ValidationErrorException(
            detail='Token không hợp lệ hoặc đã hết hạn.',
            code='invalid_token'
        )

    try:
        user = token_obj.user
        with transaction.atomic():
            user.is_active = True
            user.save(update_fields=['is_active'])

            # Đánh dấu token đã được sử dụng
            token_obj.is_used = True
            token_obj.save(update_fields=['is_used'])

            # Reset cache attempts
            cache.delete(lockout_key)

            # Nâng scopes Service Account (Progressive Elevation)
            tenant, _ = CoreTenant.objects.get_or_create(
                owner_user=user,
                defaults={
                    'tenant_code': f"tenant_{user.username}",
                    'display_name': f"{user.first_name} {user.last_name}'s Workspace".strip() or f"{user.username}'s Workspace",
                    'plan': CoreTenant.PlanChoices.FREE,
                    'status': CoreTenant.StatusChoices.ACTIVE
                }
            )
            
            # Tạo default UserProfile nếu thiếu
            UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'tenant': tenant,
                    'display_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'theme': 'dark',
                    'language': 'vi'
                }
            )

            service_account, _ = CoreServiceAccount.objects.get_or_create(
                tenant=tenant,
                name="default",
                defaults={
                    'status': CoreServiceAccount.StatusChoices.ACTIVE,
                    'scopes': ['market:read', 'signals:read']
                }
            )
            # Nâng quyền (Progressive Elevation)
            extended_scopes = list(set(service_account.scopes or []) | {'ai:invoke', 'manage_pats'})
            service_account.scopes = extended_scopes
            service_account.save(update_fields=['scopes', 'updated_at'])

        return success_response({
            'message': 'Email đã được xác minh. Bạn có thể đăng nhập.'
        }, status.HTTP_200_OK, request=request)
        
    except Exception as e:
        logger.exception("Failed to activate user and elevate service account scopes.")
        raise InternalErrorException(
            detail='Quá trình kích hoạt thất bại do lỗi hệ thống.',
            code='activation_failed'
        )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def resend_email_verification_view(request):
    """
    SFI-B2.3a: POST /api/auth/resend-verification/
    Body: { "email": "..." }
    Resends the email verification token with anti-abuse multi-dimensional rate limiting.
    """
    from django.db import transaction
    
    email = str(request.data.get('email', '') or '').strip()
    if not email:
        raise ValidationErrorException(
            detail={'email': ['Email là bắt buộc.']},
            code='validation_error'
        )

    # Chuẩn hóa email
    normalized_email = email.lower()

    # Rate Limit 1: IP Rate Limit (3 requests per minute per IP)
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
    ip_limit_key = f'ratelimit:resend:ip:{client_ip}'
    ip_count = cache.get(ip_limit_key, 0)
    if ip_count >= getattr(django_settings, 'RESEND_IP_LIMIT_THRESHOLD', 3):
        raise RateLimitErrorException(
            detail='Thử lại quá nhanh từ IP này. Vui lòng đợi 1 phút.',
            code='rate_limit_exceeded'
        )
    cache.set(ip_limit_key, ip_count + 1, 60)

    # Rate Limit 2: Subnet Rate Limit (10 requests per minute per subnet)
    def get_subnet(ip):
        if ':' in ip:  # IPv6
            return ':'.join(ip.split(':')[:4])
        else:  # IPv4
            return '.'.join(ip.split('.')[:3])
            
    subnet = get_subnet(client_ip)
    subnet_limit_key = f'ratelimit:resend:subnet:{subnet}'
    subnet_count = cache.get(subnet_limit_key, 0)
    if subnet_count >= getattr(django_settings, 'RESEND_SUBNET_LIMIT_THRESHOLD', 10):
        raise RateLimitErrorException(
            detail='Thử lại quá nhanh từ mạng của bạn. Vui lòng đợi 1 phút.',
            code='rate_limit_exceeded'
        )
    cache.set(subnet_limit_key, subnet_count + 1, 60)

    # Rate Limit 3: Cooldown 60s per Email
    cooldown_key = f'cooldown:resend:email:{normalized_email}'
    if cache.get(cooldown_key):
        raise RateLimitErrorException(
            detail='Vui lòng đợi 60 giây trước khi yêu cầu gửi lại email xác minh.',
            code='resend_cooldown_active'
        )
    cache.set(cooldown_key, True, 60)

    # Để tránh username enumeration, trả về thành công giả lập nếu email không tồn tại
    try:
        user = User.objects.get(email__iexact=normalized_email)
    except User.DoesNotExist:
        return success_response({
            'message': 'Nếu email tồn tại trong hệ thống, một liên kết xác minh mới đã được gửi.'
        }, status.HTTP_200_OK, request=request)

    if user.is_active:
        return success_response({
            'message': 'Tài khoản đã được xác minh trước đó.'
        }, status.HTTP_200_OK, request=request)

    try:
        with transaction.atomic():
            # Hủy kích hoạt tất cả các token xác minh cũ của user
            EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)
            
            # Ghi nhận Transactional Outbox Event
            event_payload = {
                "user_id": user.id,
                "username": user.username,
                "email": user.email,
            }
            
            outbox_event = OutboxEvent.objects.create(
                event_type='UserRegisteredEvent',
                payload=event_payload,
                status=OutboxEvent.STATUS_PENDING
            )

            # Sinh token xác minh và lưu DB
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            
            token_ttl_min = getattr(django_settings, 'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', 30)
            expires_at = timezone.now() + timedelta(minutes=token_ttl_min)
            EmailVerificationToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=expires_at
            )

            # Lập lịch gửi Email bất đồng bộ an toàn qua on_commit
            from django.conf import settings
            from data_ingest.tasks import trigger_email_verification_flow
            transaction.on_commit(
                lambda: trigger_email_verification_flow.delay(
                    user.id, 
                    outbox_event.event_id, 
                    email=user.email, 
                    token=raw_token, 
                    frontend_url=settings.FRONTEND_URL
                )
            )

        return success_response({
            'message': 'Liên kết xác minh mới đã được gửi thành công.'
        }, status.HTTP_200_OK, request=request)

    except Exception as e:
        logger.exception("Failed to resend verification email.")
        raise InternalErrorException(
            detail='Không thể xử lý yêu cầu gửi lại email xác minh do lỗi hệ thống.',
            code='resend_failed'
        )
