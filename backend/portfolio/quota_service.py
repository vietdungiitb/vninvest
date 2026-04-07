"""Quota consumption helpers for Open Core plan enforcement."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .permissions import resolve_user_entitlements

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _is_enforcement_enabled() -> bool:
    return bool(getattr(settings, "OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED", False))


def _now_vn() -> datetime:
    return timezone.now().astimezone(VN_TZ)


def _seconds_until_vn_midnight(now_vn: datetime | None = None) -> int:
    current = now_vn or _now_vn()
    next_midnight = (current + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    seconds = int((next_midnight - current).total_seconds())
    return max(seconds, 1)


def _quota_cache_key(user_id: int, quota_key: str, day_key: str) -> str:
    return f"open_core_quota:{day_key}:user:{user_id}:{quota_key}"


def _quota_reset_at_iso(now_vn: datetime | None = None) -> str:
    current = now_vn or _now_vn()
    next_midnight = (current + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return next_midnight.isoformat()


def _normalize_limit(raw_limit: object) -> int:
    try:
        return int(raw_limit)
    except (TypeError, ValueError):
        return 0


def _resolve_limit(entitlements: dict, quota_key: str) -> int:
    quota_caps = entitlements.get("quota_caps") or {}
    limit = _normalize_limit(quota_caps.get(quota_key, 0))
    
    trial_state = entitlements.get("trial_state")
    if trial_state == "trial_active" and limit > 0:
        return int(limit * 0.7)
    
    return limit


def get_usage(user, quota_key: str, entitlements: dict | None = None) -> dict:
    entitlements = entitlements or resolve_user_entitlements(user)
    now_vn = _now_vn()
    day_key = now_vn.date().isoformat()
    cache_key = _quota_cache_key(user.id, quota_key, day_key)
    used = int(cache.get(cache_key, 0) or 0)
    limit = _resolve_limit(entitlements, quota_key)
    remaining = -1 if limit < 0 else max(limit - used, 0)
    return {
        "quota_key": quota_key,
        "limit": limit,
        "used": used,
        "remaining": remaining,
        "reset_at": _quota_reset_at_iso(now_vn),
    }


def consume_quota(user, quota_key: str, amount: int = 1, entitlements: dict | None = None) -> dict:
    entitlements = entitlements or resolve_user_entitlements(user)
    limit = _resolve_limit(entitlements, quota_key)
    now_vn = _now_vn()

    if not _is_enforcement_enabled():
        usage = get_usage(user, quota_key, entitlements=entitlements)
        usage.update({"allowed": True, "enforced": False, "retry_after_seconds": 0})
        return usage

    if limit < 0:
        return {
            "allowed": True,
            "enforced": True,
            "quota_key": quota_key,
            "limit": limit,
            "used": 0,
            "remaining": -1,
            "reset_at": _quota_reset_at_iso(now_vn),
            "retry_after_seconds": 0,
        }

    day_key = now_vn.date().isoformat()
    cache_key = _quota_cache_key(user.id, quota_key, day_key)
    used = int(cache.get(cache_key, 0) or 0)
    next_used = used + max(int(amount), 0)

    if limit <= 0 or next_used > limit:
        return {
            "allowed": False,
            "enforced": True,
            "quota_key": quota_key,
            "limit": limit,
            "used": used,
            "remaining": max(limit - used, 0),
            "reset_at": _quota_reset_at_iso(now_vn),
            "retry_after_seconds": _seconds_until_vn_midnight(now_vn),
        }

    cache.set(cache_key, next_used, timeout=_seconds_until_vn_midnight(now_vn))
    return {
        "allowed": True,
        "enforced": True,
        "quota_key": quota_key,
        "limit": limit,
        "used": next_used,
        "remaining": max(limit - next_used, 0),
        "reset_at": _quota_reset_at_iso(now_vn),
        "retry_after_seconds": 0,
    }


def build_quota_exceeded_payload(quota_result: dict, message: str) -> dict:
    return {
        "code": "quota_exceeded",
        "message": message,
        "quota_key": quota_result.get("quota_key"),
        "limit": quota_result.get("limit"),
        "remaining": quota_result.get("remaining"),
        "reset_at": quota_result.get("reset_at"),
        "retry_after_seconds": quota_result.get("retry_after_seconds", 0),
    }
