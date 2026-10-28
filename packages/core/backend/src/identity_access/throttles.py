"""PAT-based rate limiting for tenant API access."""
from __future__ import annotations

import logging
import os
import time

from django.core.cache import cache
from rest_framework.throttling import BaseThrottle

from identity_access.models import CoreTenant

logger = logging.getLogger(__name__)

_DEV_MODE = os.environ.get('DJANGO_DEBUG', '').strip().lower() in ('1', 'true', 'yes')

# Plan → requests per hour mapping
# -1 means unlimited (no rate limiting for enterprise/internal)
# Dev mode: much higher limits to avoid 429 during reload cycles
PAT_RATE_MAP: dict[str, int] = {
    CoreTenant.PlanChoices.FREE: 10_000 if _DEV_MODE else 100,
    CoreTenant.PlanChoices.STARTER: 10_000 if _DEV_MODE else 1_000,
    CoreTenant.PlanChoices.PRO: 10_000,
    CoreTenant.PlanChoices.ENTERPRISE: -1,  # unlimited
    CoreTenant.PlanChoices.CUSTOM: -1,
    CoreTenant.PlanChoices.INTERNAL: -1,
}


class PATRateThrottle(BaseThrottle):
    """
    Rate limit per PAT credential using sliding window (1 hour).

    Uses Redis sorted set where:
    - Key: `throttle_pat:{pat_public_id}`
    - Members: request timestamps (unix epoch float)
    - Score: same as member (timestamp)
    - Window: 3600 seconds (1 hour)
    """

    scope = 'pat'

    def get_cache_key(self, request, view):
        """Return cache key for the PAT credential."""
        pat = getattr(request, 'auth', None)
        if not pat or pat.__class__.__name__ != 'CorePATCredential':
            return None  # No rate limit for non-PAT auth
        
        return f'throttle_pat_{pat.public_id}'

    def allow_request(self, request, view):
        """Check if request is within rate limit."""
        cache_key = self.get_cache_key(request, view)
        if not cache_key:
            return True  # No PAT = no PAT rate limit

        # Get PAT credential for plan lookup
        pat = getattr(request, 'auth', None)
        if not pat or pat.__class__.__name__ != 'CorePATCredential':
            return True

        # Get rate limit for tenant's plan
        try:
            tenant = pat.service_account.tenant
            rate_limit = PAT_RATE_MAP.get(tenant.plan, 100)
        except Exception:
            rate_limit = 100  # Default to free tier

        if rate_limit <= 0:
            # Unlimited: skip rate limit, but still track for headers
            self._record_request(cache_key)
            return True

        # Sliding window: remove expired entries, count current, add new
        now = time.time()
        window_start = now - 3600  # 1 hour window

        cache_client = getattr(cache, '_cache', None)
        if cache_client is None:
            return True  # No Redis = no rate limit (fail-open)

        try:
            # Remove expired entries
            cache_client.zremrangebyscore(cache_key, 0, window_start)

            # Count current requests in window
            current_count = cache_client.zcard(cache_key)

            if current_count >= rate_limit:
                # Rate limited
                self._request_limit = rate_limit
                self._request_remaining = 0
                self._window_reset = int(window_start + 3600)
                # Share state with RateLimitHeadersMiddleware via request object
                request._pat_rate_limit = rate_limit
                request._pat_rate_remaining = 0
                return False

            # Record this request
            self._record_request(cache_key)
            self._request_limit = rate_limit
            self._request_remaining = max(0, rate_limit - current_count - 1)
            self._window_reset = int(window_start + 3600)
            # Share state with RateLimitHeadersMiddleware via request object
            request._pat_rate_limit = rate_limit
            request._pat_rate_remaining = self._request_remaining
            return True

        except Exception as exc:
            logger.warning('PATRateThrottle error: %s', exc)
            return True  # Fail-open

    def _record_request(self, cache_key: str):
        """Add current request timestamp to sorted set."""
        now = time.time()
        cache_client = getattr(cache, '_cache', None)
        if cache_client is None:
            return
        try:
            # Use timestamp as both score and member (unique per request)
            request_id = f'{now}:{__import__("uuid").uuid4().hex[:8]}'
            cache_client.zadd(cache_key, {request_id: now})
            # Expire key after window + buffer
            cache_client.expire(cache_key, 3700)
        except Exception:
            pass

    def wait(self):
        """Return seconds until next window."""
        return getattr(self, '_window_reset', 0) - int(time.time())

    def get_rate_limit_headers(self, request, view):
        """Return rate limit headers for response."""
        limit = getattr(self, '_request_limit', None)
        remaining = getattr(self, '_request_remaining', None)
        reset = getattr(self, '_window_reset', None)

        if limit is not None and remaining is not None and reset is not None:
            return {
                'X-RateLimit-Limit': str(limit),
                'X-RateLimit-Remaining': str(max(0, remaining)),
                'X-RateLimit-Reset': str(reset),
            }
        return {}