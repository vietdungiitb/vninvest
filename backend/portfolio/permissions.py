"""
portfolio/permissions.py
Phân quyền theo plan: free < basic < pro < premium < admin.
Dùng has_plan() utility và các DRF Permission class cho views.
"""
from django.utils import timezone
from rest_framework.permissions import BasePermission

PLAN_ORDER = ['free', 'basic', 'pro', 'premium', 'admin']


def _get_plan(user) -> str:
    """Trả về plan hiện tại của user, tự động downgrade nếu hết hạn."""
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
        ]
    if PLAN_ORDER.index(plan) >= PLAN_ORDER.index('premium'):
        abilities += [
            {'action': 'read', 'subject': 'WhaleAdvisoryDetail'},
        ]
    if plan == 'admin':
        # Ghi đè tất cả bằng manage all
        abilities = [{'action': 'manage', 'subject': 'all'}]
    return abilities


def resolve_user_entitlements(user) -> dict:
    """Trả về contract quyền dùng chung cho Whale Alerts và auth/me."""
    plan = _get_plan(user)
    return {
        'plan': plan,
        'abilities': build_abilities(plan),
        'can_read_whale_feed': True,
        'can_read_whale_advisory': has_plan(user, 'pro'),
        'can_read_whale_advisory_detail': has_plan(user, 'premium'),
    }


# ---------- DRF Permission Classes ----------

class IsBasicPlan(BasePermission):
    message = 'Tính năng này yêu cầu gói Cơ bản trở lên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'basic')


class IsProPlan(BasePermission):
    message = 'Tính năng này yêu cầu gói Chuyên nghiệp (Pro) trở lên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'pro')


class IsPremiumPlan(BasePermission):
    message = 'Tính năng này yêu cầu gói Cao cấp (Premium) trở lên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'premium')


class IsAdminPlan(BasePermission):
    message = 'Tính năng này chỉ dành cho Quản trị viên.'

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_plan(request.user, 'admin')
