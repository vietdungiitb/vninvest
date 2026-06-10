import logging
from django.contrib.auth import authenticate, get_user_model
from django.conf import settings as django_settings
from django.core.cache import cache
from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from ..authentication import CorePATAuthentication
from ..models import CorePATCredential, CoreServiceAccount, CoreTenant
from vninvest_core.exceptions import (
    ValidationErrorException,
    AuthenticationErrorException,
    PermissionErrorException,
    RateLimitErrorException,
)
from .helpers import (
    _human_session_pat_expires_at,
    _build_auth_payload,
    success_response,
    TENANT_PERMISSION_CLASSES,
)

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    POST /core/v1/auth/login
    Body: { "username": "...", "password": "..." }
    Returns: success_response envelope with { "access": "...", "refresh": "...", "token": "...", ... }
    
    Upgraded SaaS Native Login with 3-Layer Brute-Force Rate Limiting (IP, Subnet, User).
    Fully compliant with StandardErrorEnvelope & success_response envelope.
    """
    # 1. IP & Subnet Extraction
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
    
    def get_subnet(ip):
        if ':' in ip:  # IPv6
            return ':'.join(ip.split(':')[:4])
        else:  # IPv4
            return '.'.join(ip.split('.')[:3])
            
    subnet = get_subnet(client_ip)
    
    # 2. Extract and Normalize Input Identifier
    username_input = str(request.data.get('username', '') or '').strip()
    password = request.data.get('password', '')

    if not username_input or not password:
        raise ValidationErrorException(
            detail='Tên đăng nhập và mật khẩu không được để trống.',
            code='validation_error',
        )

    # Resolve actual username from email if provided
    auth_username = username_input
    if '@' in username_input:
        try:
            resolved_user = User.objects.get(email__iexact=username_input)
            auth_username = resolved_user.username
        except User.DoesNotExist:
            pass

    normalized_user = auth_username.lower()

    # 3. 3-Layer Multi-Dimensional Brute-Force Rate Limiting
    # Layer 1: IP Rate Limit
    ip_key = f'ratelimit:login:ip:{client_ip}'
    ip_count = cache.get(ip_key, 0)
    ip_limit = getattr(django_settings, 'LOGIN_IP_LIMIT_THRESHOLD', 5)
    if ip_count >= ip_limit:
        raise RateLimitErrorException(
            detail='Quá nhiều yêu cầu đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau 1 phút.',
            code='login_rate_limit_exceeded',
        )

    # Layer 2: Subnet Rate Limit
    subnet_key = f'ratelimit:login:subnet:{subnet}'
    subnet_count = cache.get(subnet_key, 0)
    subnet_limit = getattr(django_settings, 'LOGIN_SUBNET_LIMIT_THRESHOLD', 15)
    if subnet_count >= subnet_limit:
        raise RateLimitErrorException(
            detail='Quá nhiều yêu cầu đăng nhập từ mạng này. Vui lòng thử lại sau 1 phút.',
            code='login_rate_limit_exceeded',
        )

    # Layer 3: Username/Email Rate Limit
    user_key = f'ratelimit:login:user:{normalized_user}'
    user_count = cache.get(user_key, 0)
    user_limit = getattr(django_settings, 'LOGIN_USER_LIMIT_THRESHOLD', 3)
    if user_count >= user_limit:
        raise RateLimitErrorException(
            detail='Quá nhiều yêu cầu đăng nhập cho tài khoản này. Vui lòng thử lại sau 1 phút.',
            code='login_rate_limit_exceeded',
        )

    # Increment rate limit counters
    cache.set(ip_key, ip_count + 1, 60)
    cache.set(subnet_key, subnet_count + 1, 60)
    cache.set(user_key, user_count + 1, 60)

    # 4. Check if User Exists & Is Active (Email Verified Check)
    try:
        user_check = User.objects.get(username__iexact=auth_username)
        if not user_check.is_active:
            raise AuthenticationErrorException(
                detail='Tài khoản chưa được kích hoạt. Vui lòng xác minh email trước khi đăng nhập.',
                code='user_inactive',
            )
    except User.DoesNotExist:
        # Username check failed, credentials check below will handle authentication failure natively.
        pass

    # 5. Authenticate credentials
    user = authenticate(request, username=auth_username, password=password)
    if user is None:
        raise AuthenticationErrorException(
            detail='Tên đăng nhập hoặc mật khẩu không chính xác.',
            code='invalid_credentials',
        )

    # 6. Tenant and Service Account Validation
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        raise PermissionErrorException(
            detail='Không tìm thấy Workspace/Tenant liên kết với tài khoản này.',
            code='tenant_not_found',
        )

    service_account = tenant.service_accounts.filter(status='active').first()
    if service_account is None:
        raise PermissionErrorException(
            detail='Tài khoản chưa có Service Account hoạt động.',
            code='service_account_inactive',
        )

    # 7. Issue dynamic PAT credentials
    credential, raw_secret = CorePATCredential.issue_for_service_account(
        service_account=service_account,
        scopes=list(service_account.scopes or []),
        expires_at=_human_session_pat_expires_at(),
        label=f'login:{user.username}',
        audit_reason='core login',
        is_human_session=True,
    )

    auth_payload = _build_auth_payload(user, tenant, service_account, credential, raw_secret)
    return success_response(auth_payload, status.HTTP_200_OK, request=request)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def refresh_token_view(request):
    """
    POST /core/v1/auth/token/refresh/
    Validate PAT token and return a rotated new PAT token.
    SaaS native OpenAPI compliant.
    """
    refresh = str(request.data.get('refresh', '') or '').strip()
    if not refresh:
        raise ValidationErrorException(
            detail='Refresh token không được để trống.',
            code='validation_error',
        )

    credential = CorePATCredential.resolve_from_raw_secret(refresh)
    if (
        credential is None
        or credential.effective_status != CorePATCredential.StatusChoices.ACTIVE
        or credential.service_account.status != CoreServiceAccount.StatusChoices.ACTIVE
        or not credential.is_human_session
    ):
        raise AuthenticationErrorException(
            detail='Refresh token không hợp lệ hoặc đã hết hạn.',
            code='invalid_refresh_token',
        )

    tenant = credential.service_account.tenant
    user = tenant.owner_user
    next_credential, next_raw_secret = CorePATCredential.issue_for_service_account(
        service_account=credential.service_account,
        scopes=list(credential.scopes or []),
        expires_at=_human_session_pat_expires_at(),
        label=credential.label,
        audit_reason='core refresh rotation',
        is_human_session=True,
    )
    credential.revoke_pat(reason='core refresh rotation')

    auth_payload = _build_auth_payload(
        user,
        tenant,
        credential.service_account,
        next_credential,
        next_raw_secret,
    )
    return success_response(auth_payload, status.HTTP_200_OK, request=request)


@api_view(['POST'])
@authentication_classes([CorePATAuthentication])
@permission_classes(TENANT_PERMISSION_CLASSES)
def logout_view(request):
    """
    POST /core/v1/auth/logout
    Revokes the PAT used for this request.
    """
    credential = getattr(request, 'auth', None)
    if credential and isinstance(credential, CorePATCredential):
        credential.revoke_pat()
        return Response({'detail': 'Logged out and PAT revoked.'}, status=status.HTTP_200_OK)
    return Response({'detail': 'No active PAT to revoke.'}, status=status.HTTP_200_OK)
