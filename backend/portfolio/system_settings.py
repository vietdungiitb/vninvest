"""
Utility để đọc/ghi SystemSetting với Redis cache làm fast-path.

Cách dùng:
    from portfolio.system_settings import get_system_timezone, get_setting

    tz = get_system_timezone()              # 'Asia/Ho_Chi_Minh'
    val = get_setting('my_key', 'default')  # bất kỳ key nào
"""
from __future__ import annotations

import logging
import zoneinfo

from django.conf import settings

logger = logging.getLogger(__name__)

# Redis cache TTL cho system settings (5 phút)
_CACHE_TTL = 300
_CACHE_PREFIX = 'system_setting:'

DEFAULT_TIMEZONE = getattr(settings, 'TIME_ZONE', 'Asia/Ho_Chi_Minh')


def _cache_key(key: str) -> str:
    return f'{_CACHE_PREFIX}{key}'


def get_setting(key: str, default: str = '') -> str:
    """Đọc SystemSetting theo key. Ưu tiên Redis cache, fallback về DB."""
    from django.core.cache import cache

    cached = cache.get(_cache_key(key))
    if cached is not None:
        return cached

    try:
        from portfolio.models import SystemSetting
        obj = SystemSetting.objects.filter(key=key).first()
        if obj is not None:
            cache.set(_cache_key(key), obj.value, timeout=_CACHE_TTL)
            return obj.value
    except Exception as exc:
        logger.warning('get_setting(%s) DB lookup failed: %s', key, exc)

    return default


def set_setting(key: str, value: str, description: str = '', user=None) -> None:
    """Ghi SystemSetting và invalidate cache."""
    from django.core.cache import cache
    from portfolio.models import SystemSetting

    obj, _ = SystemSetting.objects.update_or_create(
        key=key,
        defaults={'value': value, 'description': description, 'updated_by': user},
    )
    cache.set(_cache_key(key), value, timeout=_CACHE_TTL)


def get_system_timezone() -> str:
    """Trả về IANA timezone name cho hệ thống (mặc định Asia/Ho_Chi_Minh)."""
    tz_name = get_setting('system_timezone', DEFAULT_TIMEZONE)
    # Validate: nếu không hợp lệ, fallback về default
    try:
        zoneinfo.ZoneInfo(tz_name)
        return tz_name
    except (zoneinfo.ZoneInfoNotFoundError, KeyError):
        logger.error('Invalid system_timezone value "%s", falling back to %s', tz_name, DEFAULT_TIMEZONE)
        return DEFAULT_TIMEZONE


def get_zoneinfo() -> zoneinfo.ZoneInfo:
    """Trả về ZoneInfo object cho system timezone."""
    return zoneinfo.ZoneInfo(get_system_timezone())


def ensure_defaults() -> None:
    """
    Đảm bảo các SystemSetting mặc định tồn tại trong DB.
    Gọi trong AppConfig.ready() hoặc một management command.
    """
    defaults = [
        (
            'system_timezone',
            DEFAULT_TIMEZONE,
            'Múi giờ hiển thị toàn hệ thống. Nhập IANA timezone name, ví dụ: Asia/Ho_Chi_Minh, UTC, Asia/Singapore.',
        ),
    ]
    from portfolio.models import SystemSetting
    for key, value, description in defaults:
        SystemSetting.objects.get_or_create(
            key=key,
            defaults={'value': value, 'description': description},
        )
