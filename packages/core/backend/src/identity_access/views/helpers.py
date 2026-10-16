import os
from datetime import timedelta
import logging
import uuid

from django.conf import settings
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.throttling import UserRateThrottle
from rest_framework.response import Response

from ..authentication import CorePATAuthentication
from ..models import CorePATCredential, CoreServiceAccount, CoreTenant, PasswordResetToken, UserProfile, OutboxEvent, EmailVerificationToken
from ..permissions import IsTenantActive, require_human_session

logger = logging.getLogger(__name__)

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
        'max_active_pats': tenant.max_active_pats,
        'status': tenant.status,
        'features': list(tenant.features or []),
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
        {'action': 'read', 'subject': 'TenantWebhookView'},
        {'action': 'manage', 'subject': 'TenantWebhookView'},
        {'action': 'read', 'subject': 'TenantSecurityView'},
        {'action': 'manage', 'subject': 'TenantSecurityView'},
        {'action': 'read', 'subject': 'TenantAuditAdmin'},
        {'action': 'manage', 'subject': 'TenantAuditAdmin'},
        {'action': 'read', 'subject': 'TenantSSOAdmin'},
        {'action': 'manage', 'subject': 'TenantSSOAdmin'},
        {'action': 'read', 'subject': 'TenantReportsView'},
        {'action': 'manage', 'subject': 'TenantReportsView'},
        {'action': 'read', 'subject': 'TenantRoleAdmin'},
        {'action': 'manage', 'subject': 'TenantRoleAdmin'},
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
            # R0.9 AC6: quan tri policy he thong AI (lop B) — staff-only.
            {'action': 'manage', 'subject': 'ai.policy.manage'},
            {'action': 'read', 'subject': 'ServiceOpsCenter'},
            # Operator admin panel subjects used by ProtectedRoute in frontend App.jsx
            {'action': 'read', 'subject': 'AdminOps'},
            {'action': 'read', 'subject': 'AdminCrawlControl'},
            {'action': 'read', 'subject': 'CoreJobOps'},
            {'action': 'read', 'subject': 'CoreAuditTrace'},
        ])

        # Advertising admin — gated behind the ADVERTISING_ADMIN_ENABLED flag
        # for gradual rollout.
        if getattr(settings, 'ADVERTISING_ADMIN_ENABLED', True):
            abilities.extend([
                {'action': 'read', 'subject': 'Advertising'},
                {'action': 'manage', 'subject': 'AdCampaign'},
                {'action': 'update', 'subject': 'TrademarkConfig'},
            ])

    if _build_target() == 'vip':
        abilities.append({'action': 'read', 'subject': 'vip.local_control.read'})

    return abilities


def _build_navigation(user, tenant: CoreTenant) -> dict:
    # Menu 2026-09-22: đồng bộ với FE sidebaritems.ts (5 nhóm / 13 mục + flag).
    # 'whale-alerts' giữ để tương thích client cũ (FE redirect về 'alert-center').
    groups = ['workspace', 'signals', 'system']
    # R0.9 AC5: ai-command-center la self-service cho moi user (khop menu FE),
    # khong phai dac quyen staff. Quyen doc/ghi cau hinh ca nhan khong doi.
    routes = ['dashboard', 'watchlist', 'screener', 'support', 'settings', 'upgrade', 'ai-command-center']

    if tenant.plan != CoreTenant.PlanChoices.FREE:
        routes.extend(['ai-advisory', 'whale-alerts', 'alert-center', 'transactions', 'portfolios'])

    if user.is_staff or user.is_superuser:
        groups.append('admin')
        routes.extend([
            'operations-center',
            'operations-center-mail-config',
            'admin-crawl-control',
            'tenant-admin',
            'commercial-billing-center',
        ])
        if getattr(settings, 'ADVERTISING_ADMIN_ENABLED', True):
            routes.append('advertising-admin')

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
    active_pat_count = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        status=CorePATCredential.StatusChoices.ACTIVE,
        expires_at__gt=timezone.now(),
    ).count()
    return {
        'access': raw_secret,
        'refresh': raw_secret,
        'token': raw_secret,
        'token_prefix': credential.token_prefix if credential else raw_secret[:12],
        'plan': tenant.plan,
        'active_pat_count': active_pat_count,
        'max_active_pats': tenant.max_active_pats,
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
