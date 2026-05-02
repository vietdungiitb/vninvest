"""
portfolio/permissions.py
Phân quyền theo plan: free < basic < pro < premium < admin.
Dùng has_plan() utility và các DRF Permission class cho views.
"""
from django.conf import settings
from django.utils import timezone
from rest_framework.permissions import BasePermission

PLAN_ORDER = ['free', 'basic', 'pro', 'premium', 'admin']

PLAN_TIER_MAP = {
    'free': 'community',
    'basic': 'community',
    'pro': 'pro_individual',
    'premium': 'pro_team',
    'admin': 'admin',
}

DEFAULT_QUOTA_CAPS_BY_TIER = {
    'community': {
        'api_calls_per_day': 300,
        'ai_regenerate_per_day': 0,
        'whale_symbols_max': 10,
        'exports_per_day': 0,
    },
    'pro_individual': {
        'api_calls_per_day': 3000,
        'ai_regenerate_per_day': 30,
        'whale_symbols_max': 25,
        'exports_per_day': 20,
    },
    'pro_team': {
        'api_calls_per_day': 10000,
        'ai_regenerate_per_day': 120,
        'whale_symbols_max': 100,
        'exports_per_day': 100,
    },
    'admin': {
        # -1 means unlimited for internal/admin usage.
        'api_calls_per_day': -1,
        'ai_regenerate_per_day': -1,
        'whale_symbols_max': -1,
        'exports_per_day': -1,
    },
}

ADMIN_CONSOLE_ABILITIES = [
    {'action': 'read', 'subject': 'AdminOps'},
    {'action': 'read', 'subject': 'AdminCrawlControl'},
    {'action': 'read', 'subject': 'StockDetailAdvancedTab'},
]


def _is_operator_user(user) -> bool:
    return bool(user and getattr(user, 'is_authenticated', False) and (user.is_staff or user.is_superuser))


def _resolve_tier(plan: str) -> str:
    return PLAN_TIER_MAP.get(plan, 'community')


def _resolve_quota_caps(tier: str) -> dict:
    custom_caps = getattr(settings, 'OPEN_CORE_QUOTA_CAPS_BY_TIER', None)
    caps_map = custom_caps if isinstance(custom_caps, dict) else DEFAULT_QUOTA_CAPS_BY_TIER
    caps = caps_map.get(tier, DEFAULT_QUOTA_CAPS_BY_TIER['community'])
    return {
        'api_calls_per_day': int(caps.get('api_calls_per_day', 300)),
        'ai_regenerate_per_day': int(caps.get('ai_regenerate_per_day', 0)),
        'whale_symbols_max': int(caps.get('whale_symbols_max', 10)),
        'exports_per_day': int(caps.get('exports_per_day', 0)),
    }


def _resolve_trial_state(user, plan: str) -> dict:
    """Resolve trial/grace state from UserPlanLifecycle model (Slice C)."""
    from django.utils import timezone
    now = timezone.now()
    
    try:
        lifecycle = getattr(user, 'plan_lifecycle', None)
        if not lifecycle:
            return {'trial_state': 'none', 'trial_ends_at': None, 'grace_ends_at': None}
        
        if lifecycle.trial_starts_at and lifecycle.trial_ends_at and now < lifecycle.trial_ends_at:
            return {
                'trial_state': 'trial_active',
                'trial_ends_at': lifecycle.trial_ends_at.isoformat(),
                'grace_ends_at': None,
            }
        
        if lifecycle.grace_ends_at and now < lifecycle.grace_ends_at:
            return {
                'trial_state': 'grace_active',
                'trial_ends_at': lifecycle.trial_ends_at.isoformat() if lifecycle.trial_ends_at else None,
                'grace_ends_at': lifecycle.grace_ends_at.isoformat(),
            }
        
        if lifecycle.grace_ends_at and now >= lifecycle.grace_ends_at:
            return {
                'trial_state': 'expired',
                'trial_ends_at': lifecycle.trial_ends_at.isoformat() if lifecycle.trial_ends_at else None,
                'grace_ends_at': lifecycle.grace_ends_at.isoformat(),
            }
    except Exception:
        pass
    
    return {'trial_state': 'none', 'trial_ends_at': None, 'grace_ends_at': None}


def _get_plan(user) -> str:
    """Trả về plan hiện tại của user, tự động downgrade nếu hết hạn."""
    if _is_operator_user(user):
        return 'admin'
    cfg = getattr(user, 'user_config', None)
    if not cfg:
        return 'free'
    if cfg.plan_expires_at and cfg.plan_expires_at < timezone.now():
        return 'free'
    return cfg.plan


def has_plan(user, required_plan: str) -> bool:
    """True nếu plan hiện tại của user >= required_plan."""
    current = _get_plan(user)
    try:
        return PLAN_ORDER.index(current) >= PLAN_ORDER.index(required_plan)
    except ValueError:
        return False


def build_abilities(plan: str) -> list:
    """
    Trả về danh sách abilities dạng CASL-compatible.
    [{action, subject}, ...] để Frontend createMongoAbility() đọc.
    """
    abilities = [
        {'action': 'manage', 'subject': 'Portfolio'},
        {'action': 'manage', 'subject': 'Transaction'},
        {'action': 'manage', 'subject': 'Watchlist'},
        {'action': 'manage', 'subject': 'Screener'},
        {'action': 'read',   'subject': 'WhaleFeed'},
    ]
    if PLAN_ORDER.index(plan) >= PLAN_ORDER.index('basic'):
        abilities += [
            {'action': 'use',    'subject': 'ScreenerAdvanced'},
            {'action': 'export', 'subject': 'Portfolio'},
        ]
    if PLAN_ORDER.index(plan) >= PLAN_ORDER.index('pro'):
        abilities += [
            {'action': 'read', 'subject': 'WhaleAdvisory'},
            {'action': 'read', 'subject': 'TenantAdminHome'},
            {'action': 'read', 'subject': 'TenantCapabilityView'},
            {'action': 'read', 'subject': 'TenantUsageView'},
            {'action': 'read', 'subject': 'TenantBillingView'},
            {'action': 'read', 'subject': 'TenantServiceAccountAdmin'},
            {'action': 'create', 'subject': 'TenantServiceAccountAdmin'},
            {'action': 'update', 'subject': 'TenantServiceAccountAdmin'},
            {'action': 'read', 'subject': 'TenantPATAdmin'},
            {'action': 'issue', 'subject': 'TenantPATAdmin'},
            {'action': 'rotate', 'subject': 'TenantPATAdmin'},
            {'action': 'revoke', 'subject': 'TenantPATAdmin'},
        ]
    if PLAN_ORDER.index(plan) >= PLAN_ORDER.index('premium'):
        abilities += [
            {'action': 'read', 'subject': 'WhaleAdvisoryDetail'},
        ]
    if plan == 'admin':
        abilities += ADMIN_CONSOLE_ABILITIES
    return abilities


def resolve_user_entitlements(user) -> dict:
    """Trả về contract quyền dùng chung cho Whale Alerts và auth/me."""
    plan = _get_plan(user)
    tier = _resolve_tier(plan)
    trial_state = _resolve_trial_state(user, plan)
    return {
        'plan': plan,
        'tier': tier,
        'abilities': build_abilities(plan),
        'quota_caps': _resolve_quota_caps(tier),
        'trial_state': trial_state['trial_state'],
        'trial_ends_at': trial_state['trial_ends_at'],
        'grace_ends_at': trial_state['grace_ends_at'],
        'can_read_whale_feed': True,
        'can_read_whale_advisory': has_plan(user, 'pro'),
        'can_read_whale_advisory_detail': has_plan(user, 'premium'),
        'can_read_tenant_admin_home': has_plan(user, 'pro'),
        'can_read_tenant_capabilities': has_plan(user, 'pro'),
        'can_read_tenant_usage': has_plan(user, 'pro'),
        'can_read_tenant_billing': has_plan(user, 'pro'),
        'can_read_tenant_service_accounts': has_plan(user, 'pro'),
        'can_write_tenant_service_accounts': has_plan(user, 'pro'),
        'can_read_tenant_pats': has_plan(user, 'pro'),
        'can_write_tenant_pats': has_plan(user, 'pro'),
        'can_read_admin_ops': has_plan(user, 'admin'),
        'can_read_admin_crawl_control': has_plan(user, 'admin'),
    }


# ---------- DRF Permission Classes ----------

class IsBasicPlan(BasePermission):
    message = 'Tính năng này yêu cầu gói Cơ bản trở lên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'basic')


class IsProPlan(BasePermission):
    message = 'Tính năng này yêu cầu gói Chuyên nghiệp (Pro) trở lên.'

    def has_permission(self, request, view):
        plan = _get_plan(request.user)
        # print(f"DEBUG: User {request.user.username} plan: {plan}")
        return request.user.is_authenticated and has_plan(request.user, 'pro')


class IsPremiumPlan(BasePermission):
    message = 'Tính năng này yêu cầu gói Cao cấp (Premium) trở lên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'premium')


class IsAdminPlan(BasePermission):
    message = 'Tính năng này chỉ dành cho Quản trị viên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'admin')
