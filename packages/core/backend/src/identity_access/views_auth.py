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
from .models import CorePATCredential, CoreServiceAccount, CoreTenant, PasswordResetToken
from .permissions import IsTenantActive, require_human_session
from data_ingest.tasks import send_email_verification_token, send_password_reset_email
from vninvest_core.exceptions import (
    ValidationErrorException,
    ConflictErrorException,
    RateLimitErrorException,
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
        routes.extend(['operations-center', 'ai-command-center'])

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
    Returns: { "token": "<raw_pat>", "token_prefix": "...", "tenant": {...} }
    
    B1 Fix: Rate limited to 5 requests per minute per IP (per Checklist H2, brute-force protection).
    Manual cache-based rate limiting to return proper 429 status (not 403 from django-ratelimit).
    """
    # Rate limit per IP (5 requests per minute per IP address)
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
    cache_key = f'ratelimit:login:{client_ip}'
    count = cache.get(cache_key, 0)
    if count >= 5:
        raise RateLimitErrorException(
            detail='Too many login attempts from this IP address. Please try again in 1 minute.',
            code='login_rate_limit_exceeded',
        )
    cache.set(cache_key, count + 1, 60)
    
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response(
            {'detail': 'username and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {'detail': 'Invalid credentials.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Issue a fresh PAT for this login session
    service_account = tenant.service_accounts.filter(status='active').first()
    if service_account is None:
        return Response(
            {'detail': 'No active service account for tenant.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    credential, raw_secret = CorePATCredential.issue_for_service_account(
        service_account=service_account,
        scopes=list(service_account.scopes or []),
        expires_at=_human_session_pat_expires_at(),
        label=f'login:{user.username}',
        audit_reason='core login',
        is_human_session=True,
    )

    return Response(
        _build_auth_payload(user, tenant, service_account, credential, raw_secret),
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def refresh_token_view(request):
    refresh = str(request.data.get('refresh', '') or '').strip()
    if not refresh:
        return Response(
            {'detail': 'refresh token is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    credential = CorePATCredential.resolve_from_raw_secret(refresh)
    if (
        credential is None
        or credential.effective_status != CorePATCredential.StatusChoices.ACTIVE
        or credential.service_account.status != CoreServiceAccount.StatusChoices.ACTIVE
        or not credential.is_human_session
    ):
        return Response(
            {'detail': 'Invalid or revoked refresh token.'},
            status=status.HTTP_401_UNAUTHORIZED,
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

    return Response(
        _build_auth_payload(
            user,
            tenant,
            credential.service_account,
            next_credential,
            next_raw_secret,
        ),
        status=status.HTTP_200_OK,
    )


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
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.conf import settings as django_settings
from django.utils import timezone

User = get_user_model()

# In-memory token store for email verification (dev/test). Email tokens remain in-memory.
# Password reset tokens are now persisted in PasswordResetToken model (C1 fix).
_EMAIL_VERIFY_TOKENS: dict[str, dict] = {}   # token → {user_id, expires_at}

_TOKEN_TTL_HOURS = 24


def _make_token() -> str:
    return secrets.token_urlsafe(32)


def _token_expired(entry: dict) -> bool:
    return timezone.now() > entry['expires_at']


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """
    SFI-B2.2: POST /api/auth/register/
    Body: { "username", "email", "password", "first_name"?, "last_name"? }
    Creates user + sends verification email.
    
    A4-A5 Fix: Uses standard error envelope via exceptions.
    B1 Fix: Rate limited to 3 requests per minute per IP (per Checklist H2).
    Manual cache-based rate limiting to return proper 429 status.
    """
    # Rate limit per IP (3 requests per minute per IP address)
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
    cache_key = f'ratelimit:register:{client_ip}'
    count = cache.get(cache_key, 0)
    if count >= 3:
        raise RateLimitErrorException(
            detail='Too many registration attempts from this IP address. Please try again in 1 minute.',
            code='register_rate_limit_exceeded',
        )
    cache.set(cache_key, count + 1, 60)
    
    username = str(request.data.get('username', '') or '').strip()
    email = str(request.data.get('email', '') or '').strip().lower()
    password = str(request.data.get('password', '') or '')
    first_name = str(request.data.get('first_name', '') or '').strip()
    last_name = str(request.data.get('last_name', '') or '').strip()

    if not username or not email or not password:
        raise ValidationErrorException(
            detail='username, email, and password are required.',
        )

    if len(password) < 8:
        raise ValidationErrorException(
            detail='Password must be at least 8 characters.',
        )

    if User.objects.filter(username=username).exists():
        raise ConflictErrorException(
            detail='Username already taken.',
        )

    if User.objects.filter(email=email).exists():
        raise ConflictErrorException(
            detail='Email already registered.',
        )

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        is_active=False,  # requires email verification
    )

    token = _make_token()
    _EMAIL_VERIFY_TOKENS[token] = {
        'user_id': user.pk,
        'expires_at': timezone.now() + timedelta(hours=_TOKEN_TTL_HOURS),
    }

    # C4 Fix: Use validated FRONTEND_URL from settings (required in production)
    # Send email asynchronously via Celery (C3 fix)
    send_email_verification_token.delay(email=email, token=token, frontend_url=settings.FRONTEND_URL)

    return Response(
        {'detail': 'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.'},
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def verify_email_view(request):
    """
    SFI-B2.3: POST /api/auth/verify-email/
    Body: { "token": "..." }
    Activates the user account.
    """
    token = str(request.data.get('token', '') or '').strip()
    if not token:
        return Response({'detail': 'token is required.'}, status=status.HTTP_400_BAD_REQUEST)

    entry = _EMAIL_VERIFY_TOKENS.get(token)
    if entry is None or _token_expired(entry):
        _EMAIL_VERIFY_TOKENS.pop(token, None)
        return Response(
            {'detail': 'Token không hợp lệ hoặc đã hết hạn.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(pk=entry['user_id'])
    except User.DoesNotExist:
        return Response({'detail': 'Tài khoản không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

    user.is_active = True
    user.save(update_fields=['is_active'])
    del _EMAIL_VERIFY_TOKENS[token]

    return Response({'detail': 'Email đã được xác minh. Bạn có thể đăng nhập.'}, status=status.HTTP_200_OK)


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
