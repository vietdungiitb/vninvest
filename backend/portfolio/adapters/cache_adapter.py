import os

from django.core.cache import cache
from django.utils import timezone


def get_cache(key):
    try:
        return cache.get(key)
    except Exception:
        return None


def set_cache(key, value, timeout):
    try:
        cache.set(key, value, timeout=timeout)
    except Exception:
        pass


def is_rate_limited_error(exc_or_message) -> bool:
    message = str(exc_or_message or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'giới hạn api' in message
    )


def vnbroker_rate_limit_cache_key(channel: str = 'intraday') -> str:
    normalized_channel = str(channel or 'default').strip().lower() or 'default'
    return f'vnbroker:rate-limit:{normalized_channel}'


def is_vnbroker_rate_limited(channel: str = 'intraday') -> bool:
    return bool(get_cache(vnbroker_rate_limit_cache_key(channel)))


def mark_vnbroker_rate_limited(channel: str = 'intraday', exc_or_message=None) -> None:
    cooldown_seconds = max(int(os.getenv('VNBROKER_RATE_LIMIT_COOLDOWN_SECONDS', '20')), 5)
    set_cache(
        vnbroker_rate_limit_cache_key(channel),
        {
            'triggered_at': timezone.now().isoformat(),
            'reason': str(exc_or_message or '')[:200],
        },
        timeout=cooldown_seconds,
    )
