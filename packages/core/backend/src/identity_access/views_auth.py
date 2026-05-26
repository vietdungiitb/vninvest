"""
Auth views for packages/core.

Endpoints:
    POST /core/v1/auth/login   — exchange credentials for session + PAT
    GET  /core/v1/auth/profile — return current tenant profile
    POST /core/v1/auth/logout  — invalidate session
"""
import os
from datetime import timedelta

import logging
from django.contrib.auth import authenticate
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from rest_framework import permissions, status

logger = logging.getLogger(__name__)
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.throttling import UserRateThrottle
from rest_framework.response import Response

from .authentication import CorePATAuthentication
from .models import CorePATCredential, CoreServiceAccount, CoreTenant, PasswordResetToken, UserProfile, OutboxEvent, EmailVerificationToken
from .permissions import IsTenantActive, require_human_session
from data_ingest.tasks import send_email_verification_token, send_password_reset_email, trigger_email_verification_flow
from vninvest_core.exceptions import (
    ValidationErrorException,
    ConflictErrorException,
    RateLimitErrorException,
    InternalErrorException,
)


TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]


class AuthBootstrapThrottle(UserRateThrottle):
    """Independent bucket for auth-bootstrap endpoints (/auth/me/, capabilities).
    Isolated from the global 'user' bucket so that operational polling can never
    starve critical session-initialization calls.
    """
    scope = 'auth_bootstrap'


_DEFAULT_USER_CONFIG = {
    'language': 'vi',
    'theme': 'dark',
    'whale_alert_threshold': 500,
    'advisory_whale_signal_enabled': True,
}
_USER_CONFIG_STORE = {}
DEFAULT_HUMAN_SESSION_PAT_HOURS = 12


def _build_target() -> str:
    return os.environ.get('CORE_BUILD_TARGET', 'saas').strip().lower() or 'saas'


def _human_session_pat_lifetime() -> timedelta:
    raw_hours = str(
        os.environ.get('CORE_HUMAN_SESSION_PAT_HOURS', DEFAULT_HUMAN_SESSION_PAT_HOURS)
    ).strip()
    try:
        hours = int(raw_hours)
    except (TypeError, ValueError):
        hours = DEFAULT_HUMAN_SESSION_PAT_HOURS
    return timedelta(hours=max(1, hours))


def _human_session_pat_expires_at():
    return timezone.now() + _human_session_pat_lifetime()


def _tenant_payload(tenant: CoreTenant) -> dict:
    return {
        'tenant_id': str(tenant.public_id),
        'public_id': str(tenant.public_id),
        'tenant_code': tenant.tenant_code,
        'display_name': tenant.display_name,
        'plan': tenant.plan,
        'status': tenant.status,
    }


def _user_payload(user) -> dict:
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': bool(user.is_staff),
        'is_superuser': bool(user.is_superuser),
    }


def _service_account_payload(service_account) -> dict:
    if service_account is None:
        return {
            'service_account_id': None,
            'service_account_name': None,
            'scopes': [],
        }
    return {
        'service_account_id': str(service_account.public_id),
        'service_account_name': service_account.name,
        'scopes': list(service_account.scopes or []),
    }


def _resolve_request_service_account(request, tenant: CoreTenant):
    auth = getattr(request, 'auth', None)
    if isinstance(auth, CorePATCredential):
        service_account = auth.service_account
        if service_account.tenant_id == tenant.id:
            return service_account

    return tenant.service_accounts.filter(status=CoreServiceAccount.StatusChoices.ACTIVE).first()


def _build_abilities(user, tenant: CoreTenant) -> list:
    abilities = [
        {'action': 'read', 'subject': 'Dashboard'},
        {'action': 'read', 'subject': 'Watchlist'},
        {'action': 'read', 'subject': 'Support'},
        {'action': 'read', 'subject': 'Settings'},
        # Tenant self-admin: quản lý tài khoản của chính mình — mọi plan đều được phép.
        {'action': 'read', 'subject': 'TenantAdminHome'},
        {'action': 'read', 'subject': 'TenantCapabilityView'},
        {'action': 'read', 'subject': 'TenantUsageView'},
        {'action': 'read', 'subject': 'TenantBillingView'},
        {'action': 'read', 'subject': 'TenantMemberAdmin'},
        {'action': 'create', 'subject': 'TenantMemberAdmin'},
        {'action': 'remove', 'subject': 'TenantMemberAdmin'},
        {'action': 'manage', 'subject': 'TenantServiceAccountAdmin'},
        {'action': 'manage', 'subject': 'TenantPATAdmin'},
    ]

    _paid_plans = {
        CoreTenant.PlanChoices.STARTER,
        CoreTenant.PlanChoices.PRO,
        CoreTenant.PlanChoices.ENTERPRISE,
        CoreTenant.PlanChoices.CUSTOM,
        CoreTenant.PlanChoices.INTERNAL,
    }
    if tenant.plan in _paid_plans:
        abilities.extend([
            {'action': 'read', 'subject': 'Transactions'},
            {'action': 'manage', 'subject': 'Portfolios'},
            {'action': 'read', 'subject': 'WhaleAdvisory'},
            {'action': 'read', 'subject': 'WhaleAlerts'},
        ])

    if user.is_staff or user.is_superuser or tenant.plan == CoreTenant.PlanChoices.INTERNAL:
        abilities.extend([
            {'action': 'read', 'subject': 'admin.operator.read'},
            {'action': 'manage', 'subject': 'system.ai_command_center.manage'},
            {'action': 'read', 'subject': 'ServiceOpsCenter'},
            # Operator admin panel subjects used by ProtectedRoute in frontend App.jsx
            {'action': 'read', 'subject': 'AdminOps'},
            {'action': 'read', 'subject': 'AdminCrawlControl'},
            {'action': 'read', 'subject': 'CoreJobOps'},
            {'action': 'read', 'subject': 'CoreAuditTrace'},
        ])

    if _build_target() == 'vip':
        abilities.append({'action': 'read', 'subject': 'vip.local_control.read'})

    return abilities


def _build_navigation(user, tenant: CoreTenant) -> dict:
    groups = ['workspace', 'signals', 'system']
    routes = ['dashboard', 'watchlist', 'support', 'settings']

    if tenant.plan != CoreTenant.PlanChoices.FREE:
        routes.extend(['ai-advisory', 'whale-alerts', 'transactions', 'portfolios'])

    if user.is_staff or user.is_superuser:
        groups.append('admin')
        routes.extend(['operations-center', 'operations-center-mail-config', 'ai-command-center'])

    if _build_target() == 'vip':
        groups.append('vip-local')
        routes.append('vip-local-control')

    return {
        'visible_groups': groups,
        'visible_routes': routes,
    }


def _build_entitlements(user, tenant: CoreTenant, service_account) -> dict:
    return {
        'plan': tenant.plan,
        'status': tenant.status,
        'tenant_id': str(tenant.public_id),
        'tenant_code': tenant.tenant_code,
        'service_account_id': str(service_account.public_id) if service_account else None,
        'service_account_name': service_account.name if service_account else None,
        'scopes': list(service_account.scopes or []) if service_account else [],
        'build_target': _build_target(),
        'features': list(tenant.features or []),
        'trial_ends_at': tenant.trial_ends_at.isoformat() if tenant.trial_ends_at else None,
        'is_staff': bool(user.is_staff),
        'is_superuser': bool(user.is_superuser),
    }


def _build_capabilities_payload(user, tenant: CoreTenant, service_account=None) -> dict:
    entitlements = _build_entitlements(user, tenant, service_account)
    return {
        'version': '1.0.0',
        'snapshot_version': '2026-05-03',
        'principal': {
            'mode': 'human',
            'identity': {
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': bool(user.is_staff),
                'is_superuser': bool(user.is_superuser),
            },
        },
        'actor': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': bool(user.is_staff),
            'is_superuser': bool(user.is_superuser),
            'plan': tenant.plan,
        },
        'build': {
            'target': _build_target(),
            'plan': tenant.plan,
        },
        'abilities': _build_abilities(user, tenant),
        'entitlements': entitlements,
        'navigation': _build_navigation(user, tenant),
        'surfaces': {
            'show_operations_center': bool(user.is_staff or user.is_superuser),
            'show_ai_command_center': _build_target() in {'saas', 'vip'},
            'show_vip_shell': _build_target() == 'vip',
        },
    }


def _build_auth_payload(user, tenant: CoreTenant, service_account, credential, raw_secret: str) -> dict:
    capabilities = _build_capabilities_payload(user, tenant, service_account)
    return {
        'access': raw_secret,
        'refresh': raw_secret,
        'token': raw_secret,
        'token_prefix': credential.token_prefix if credential else raw_secret[:12],
        'plan': tenant.plan,
        'user': _user_payload(user),
        'tenant': _tenant_payload(tenant),
        'abilities': capabilities['abilities'],
        'entitlements': capabilities['entitlements'],
        'capabilities': capabilities,
    }


def _current_user_config(tenant: CoreTenant) -> dict:
    key = str(tenant.public_id)
    current = dict(_DEFAULT_USER_CONFIG)
    current.update(_USER_CONFIG_STORE.get(key, {}))
    return current


def _normalize_user_config_payload(payload) -> dict:
    normalized = {}

    if 'language' in payload:
        language = str(payload.get('language') or '').strip().lower()
        if language:
            normalized['language'] = language

    if 'theme' in payload:
        theme = str(payload.get('theme') or '').strip().lower()
        if theme:
            normalized['theme'] = theme

    if 'whale_alert_threshold' in payload:
        try:
            normalized['whale_alert_threshold'] = max(1, int(payload.get('whale_alert_threshold')))
        except (TypeError, ValueError):
            normalized['whale_alert_threshold'] = _DEFAULT_USER_CONFIG['whale_alert_threshold']

    if 'advisory_whale_signal_enabled' in payload:
        value = payload.get('advisory_whale_signal_enabled')
        if isinstance(value, str):
            normalized['advisory_whale_signal_enabled'] = value.strip().lower() in {'1', 'true', 'yes', 'on'}
        else:
            normalized['advisory_whale_signal_enabled'] = bool(value)

    return normalized


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
    from django.core.cache import cache
    from django.conf import settings as django_settings
    from vninvest_core.exceptions import (
        ValidationErrorException,
        AuthenticationErrorException,
        PermissionErrorException,
        RateLimitErrorException
    )

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
    from vninvest_core.exceptions import ValidationErrorException, AuthenticationErrorException

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


@api_view(['GET'])
@authentication_classes([CorePATAuthentication])
@permission_classes(TENANT_PERMISSION_CLASSES)
@throttle_classes([AuthBootstrapThrottle])
def profile_view(request):
    """
    GET /core/v1/auth/profile
    Returns current user/tenant profile.
    Requires: Authorization: Bearer <raw_pat>
    """
    user = request.user
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    service_account = _resolve_request_service_account(request, tenant)
    subscription = getattr(tenant, 'subscription', None)
    capabilities = _build_capabilities_payload(user, tenant, service_account)

    subscription_payload = None
    if subscription and getattr(subscription, 'status', '') == 'active':
        subscription_payload = {
            'plan': subscription.plan,
            'status': subscription.status,
        }

    return Response(
        {
            **_user_payload(user),
            'plan': tenant.plan,
            'abilities': capabilities['abilities'],
            'entitlements': capabilities['entitlements'],
            'capabilities': capabilities,
            'user': _user_payload(user),
            'tenant': {
                **_tenant_payload(tenant),
                'created_at': tenant.created_at.isoformat() if hasattr(tenant, 'created_at') else None,
            },
            'subscription': subscription_payload,
        }
    )


@api_view(['GET'])
@authentication_classes([CorePATAuthentication])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthBootstrapThrottle])
def capabilities_view(request):
    user = request.user
    if not user or not user.is_authenticated:
        # Return minimal empty capabilities — frontend handles gracefully.
        # Must NOT return 401 here: syncAuthState treats 401 as auth failure → logout.
        return Response({
            'principal': {'identity': {}, 'is_authenticated': False},
            'abilities': [],
            'build': {'plan': 'free', 'target': 'core'},
            'navigation': {'visible_groups': [], 'visible_routes': []},
            'surfaces': {},
            'entitlements': {},
        }, status=200)
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    service_account = _resolve_request_service_account(request, tenant)
    return Response(_build_capabilities_payload(user, tenant, service_account), status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@authentication_classes([CorePATAuthentication])
@permission_classes(TENANT_PERMISSION_CLASSES)
def user_config_view(request):
    require_human_session(request)
    user = request.user
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    key = str(tenant.public_id)
    if request.method == 'GET':
        return Response(_current_user_config(tenant), status=status.HTTP_200_OK)

    if not isinstance(request.data, dict):
        return Response(
            {'detail': 'Invalid user config payload.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    current = _current_user_config(tenant)
    current.update(_normalize_user_config_payload(request.data))
    _USER_CONFIG_STORE[key] = current
    return Response(current, status=status.HTTP_200_OK)


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


# ── SFI-B2: Native Auth Endpoints ──────────────────────────────────────────

import secrets
import hashlib
import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.conf import settings as django_settings
from django.utils import timezone
from rest_framework.response import Response

User = get_user_model()


def success_response(data: dict, status_code: int = status.HTTP_200_OK, request=None) -> Response:
    request_id = None
    if request:
        request_id = getattr(request, 'request_id', None)
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:16]}"
    return Response({
        "status": "success",
        "timestamp": timezone.now().isoformat(),
        "request_id": request_id,
        "data": data
    }, status=status_code)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """
    SFI-B2.2: POST /api/auth/register/
    Upgraded SaaS Native User Registration with 3-Layer Spam Shield and Transactional Outbox.
    """
    from django.db import transaction
    from .serializers import SaaSRegisterSerializer

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


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def password_reset_request_view(request):
    """
    SFI-B2.4a: POST /api/auth/password-reset/
    Body: { "email": "..." }
    Sends password reset link to email (if account exists).
    
    C1 Fix: Uses PasswordResetToken model (DB-backed) instead of in-memory store.
    Tokens now persist across application restarts.
    B1 Fix: Rate limited to 3 requests per minute per EMAIL (per Checklist H2, OWASP A01 enumeration protection).
    """
    email = str(request.data.get('email', '') or '').strip().lower()
    if not email:
        return Response({'detail': 'email is required.'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Rate limit per email (3 requests per minute per email address)
    cache_key = f'ratelimit:password-reset-email:{email}'
    count = cache.get(cache_key, 0)
    if count >= 3:
        raise RateLimitErrorException(
            detail='Too many password reset requests for this email address. Please try again in 1 minute.',
            code='password_reset_rate_limit_exceeded',
        )
    cache.set(cache_key, count + 1, 60)

    # Always return 200 to avoid user enumeration (OWASP A01).
    user = User.objects.filter(email=email, is_active=True).first()
    if user:
        # Generate and save token in DB (survives restart)
        token_obj, raw_token = PasswordResetToken.generate_and_save(email=email, hours=1)
        
        # C4 Fix: Use validated FRONTEND_URL from settings (required in production)
        # Send email asynchronously via Celery (C3 fix)
        send_password_reset_email.delay(email=email, token=raw_token, frontend_url=settings.FRONTEND_URL)

    return Response(
        {'detail': 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.'},
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def password_reset_confirm_view(request):
    """
    SFI-B2.4b: POST /api/auth/password-reset/confirm/
    Body: { "token": "...", "password": "..." }
    Sets new password for user identified by token.
    
    C1 Fix: Uses PasswordResetToken model to verify token and mark as used.
    A4-A5 Fix: Uses standard error envelope via exceptions.
    """
    token = str(request.data.get('token', '') or '').strip()
    new_password = str(request.data.get('password', '') or '')

    if not token or not new_password:
        raise ValidationErrorException(
            detail='token and password are required.',
        )

    if len(new_password) < 8:
        raise ValidationErrorException(
            detail='Password phải có ít nhất 8 ký tự.',
        )

    # Verify token from DB and mark as used
    try:
        reset_token = PasswordResetToken.verify_and_mark_used(token)
    except ValueError as e:
        raise ValidationErrorException(
            detail=str(e),
        )

    # Find user by email from the reset token
    try:
        user = User.objects.get(email=reset_token.email, is_active=True)
    except User.DoesNotExist:
        raise ValidationErrorException(
            detail='Tài khoản không tồn tại hoặc bị vô hiệu hóa.',
        )

    user.set_password(new_password)
    user.save(update_fields=['password', 'updated_at'] if hasattr(user, 'updated_at') else ['password'])

    return Response({'detail': 'Mật khẩu đã được đặt lại thành công.'}, status=status.HTTP_200_OK)
