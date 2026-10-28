"""Security primitives shared by the auth surface.

Three concerns live here, all of which used to be copy-pasted per view and had
drifted apart:

1. ``LoginRecorder`` — audit-logging of login attempts.
2. ``RateLimitBucket`` / ``enforce_rate_limit`` — the single atomic
   fixed-window counter used by register, resend, verify-email, login,
   password reset and password change.
3. ``get_user_by_email`` / ``get_user_by_username`` — duplicate-tolerant user
   lookups.

Nothing in here may raise on malformed input: every helper is called from an
unauthenticated request path, where an exception becomes a 500 and a 500 is
information.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from django.core.cache import cache
from django.utils import timezone

from vninvest_core.client_ip import (  # noqa: F401  (re-exported for callers)
    UNKNOWN_IP,
    get_client_ip,
    get_client_subnet,
)

logger = logging.getLogger(__name__)

#: Default fixed-window length for the auth rate limiters. Matches the previous
#: hard-coded ``cache.set(key, n, 60)`` calls.
RATE_LIMIT_WINDOW_SECONDS = 60


@dataclass(frozen=True)
class RateLimitBucket:
    """One dimension of a multi-dimensional fixed-window rate limit.

    Attributes:
        key: Cache key for the counter.
        limit: Maximum count allowed inside ``window``. ``None`` or a negative
            value disables the dimension (still tracked when ``consume`` is set).
        detail: Human-readable message returned when this dimension trips.
        window: Window length in seconds.
    """

    key: str
    limit: int | None
    detail: str
    window: int = RATE_LIMIT_WINDOW_SECONDS


def peek_rate_limit(key: str) -> int:
    """Return the current counter value for ``key`` (0 when unset/garbage)."""
    try:
        return int(cache.get(key) or 0)
    except (TypeError, ValueError):
        return 0


def atomic_bump(key: str, window: int = RATE_LIMIT_WINDOW_SECONDS) -> int:
    """Increment the counter for ``key`` atomically and return the new value.

    Why this exists: the previous implementation in every auth view was

        count = cache.get(key, 0)
        ...
        cache.set(key, count + 1, 60)

    which is a read-modify-write. Concurrent requests all read the same stale
    value, so N simultaneous requests counted as 1 and the limiter was
    effectively N times weaker under exactly the load an attacker generates.

    ``cache.add(key, 1, window)`` returns True only when the key is absent, so
    the very first request seeds the counter; afterwards ``cache.incr`` is a
    single atomic server-side operation (``INCRBY`` on Redis, lock-guarded on
    LocMemCache).

    Residual (documented, not fixed): the read used for the limit check and the
    increment are still two round-trips, so a perfectly simultaneous burst can
    overshoot the limit by a few. Closing that needs a Lua script or a Redis
    pipeline, which is out of scope here; the unbounded-under-concurrency defect
    it replaces was unbounded in the other direction.
    """
    if cache.add(key, 1, window):
        return 1
    try:
        return int(cache.incr(key))
    except ValueError:
        # Key expired between ``add`` and ``incr``. Re-seed instead of 500.
        logger.info('rate limit key %s vanished mid-increment; re-seeding', key)
        cache.set(key, 1, window)
        return 1


def enforce_rate_limit(
    buckets,
    *,
    exception_class=None,
    code: str = 'rate_limit_exceeded',
    consume: bool = True,
    on_reject=None,
) -> None:
    """Check every bucket, then consume every bucket — all or nothing.

    Args:
        buckets: Iterable of :class:`RateLimitBucket`.
        exception_class: Exception raised when a limit trips. Defaults to
            ``RateLimitErrorException`` (429). ``password_change_view``
            passes ``ValidationErrorException`` (400) because its existing
            contract is 400, not 429 — see the note at that call site.
        code: ``code`` attribute put on the raised exception.
        consume: When False the call is a read-only peek (used to check a budget
            before a request payload has been validated, so that a malformed
            request does not burn the budget — see ``register_view``).
        on_reject: Optional callable receiving the offending bucket, invoked
            before the exception is raised. ``login_view`` uses it to write an
            audit row naming the exact layer that tripped.

    A rejected request consumes nothing: a 429 must not itself extend the
    window, and a typo must not lock the user out.
    """
    if exception_class is None:
        from vninvest_core.exceptions import RateLimitErrorException

        exception_class = RateLimitErrorException

    materialized = tuple(buckets)
    for bucket in materialized:
        if bucket.limit is None or bucket.limit < 0:
            continue
        if peek_rate_limit(bucket.key) >= bucket.limit:
            if on_reject is not None:
                on_reject(bucket)
            raise exception_class(detail=bucket.detail, code=code)

    if consume:
        for bucket in materialized:
            atomic_bump(bucket.key, bucket.window)


def client_ip_bucket(namespace: str, request, limit, detail, window: int = RATE_LIMIT_WINDOW_SECONDS):
    """Build the per-client-IP dimension for ``namespace``."""
    return RateLimitBucket(
        key=f'ratelimit:{namespace}:ip:{get_client_ip(request)}',
        limit=limit,
        detail=detail,
        window=window,
    )


def client_subnet_bucket(namespace: str, request, limit, detail, window: int = RATE_LIMIT_WINDOW_SECONDS):
    """Build the per-subnet dimension for ``namespace``.

    The prefix length is family-aware: a /24 over IPv6 spans 2**104 addresses,
    so every IPv6 caller would land in one bucket. IPv6 uses /64, IPv4 /24.
    """
    client_ip = get_client_ip(request)
    bits = 64 if ':' in client_ip else 24
    return RateLimitBucket(
        key=f'ratelimit:{namespace}:subnet:{get_client_subnet(request, bits=bits)}',
        limit=limit,
        detail=detail,
        window=window,
    )


def value_bucket(namespace: str, name: str, value, limit, detail, window: int = RATE_LIMIT_WINDOW_SECONDS):
    """Build a dimension keyed on an arbitrary value (email, username, token hash)."""
    return RateLimitBucket(
        key=f'ratelimit:{namespace}:{name}:{value}',
        limit=limit,
        detail=detail,
        window=window,
    )


def get_user_by_email(email, *, active_only: bool = False):
    """Return the user owning ``email`` (case-insensitive), or ``None``.

    ``User.email`` has **no** unique index: ``AUTH_USER_MODEL`` is not set, so
    this is the stock ``auth_user`` table and only a plain index exists. Two
    concurrent registrations that pass the application-level ``.exists()``
    check can therefore both insert, after which every ``.get(email=...)``
    raises ``MultipleObjectsReturned`` — an exception no caller was catching,
    so it surfaced as a 500.

    Resolution is deterministic (lowest primary key wins) rather than
    "newest row", so repeated calls cannot flap between two accounts. The real
    fix is the unique constraint reported to the coordinator; until that lands
    this keeps the endpoints serving 401/400 instead of 500.
    """
    email = str(email or '').strip()
    if not email:
        return None
    from django.contrib.auth import get_user_model

    queryset = get_user_model().objects.filter(email__iexact=email)
    if active_only:
        queryset = queryset.filter(is_active=True)
    return queryset.order_by('pk').first()


def get_user_by_username(username):
    """Return the user with ``username`` (case-insensitive), or ``None``.

    ``User.username`` *is* unique (case-sensitively), so this cannot hit
    ``MultipleObjectsReturned``; the helper exists so every call site uses the
    same deterministic ``order_by('pk').first()`` shape.
    """
    username = str(username or '').strip()
    if not username:
        return None
    from django.contrib.auth import get_user_model

    return get_user_model().objects.filter(username__iexact=username).order_by('pk').first()


class LoginRecorder:
    @staticmethod
    def record_login(request, user, tenant, success, failure_reason=''):
        from identity_access.models import LoginAttempt
        LoginAttempt.objects.create(
            tenant=tenant,
            user=user if success else None,
            username=str(request.data.get('username', '')),
            email=user.email if user else '',
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            success=success,
            failure_reason=failure_reason,
        )

    @staticmethod
    def get_active_sessions(tenant):
        from identity_access.models import CorePATCredential
        return CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=True,
            status='active',
            expires_at__gt=timezone.now(),
        ).select_related('service_account', 'service_account__tenant')

    @staticmethod
    def revoke_session(session_id, tenant):
        from identity_access.models import CorePATCredential
        CorePATCredential.objects.filter(
            id=session_id,
            service_account__tenant=tenant,
            is_human_session=True,
        ).update(status='revoked', revoked_at=timezone.now(), revoked_reason='Revoked via Security Dashboard')

    @staticmethod
    def revoke_all_sessions_except(tenant, exclude_session_id):
        from identity_access.models import CorePATCredential
        CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=True,
            status='active',
        ).exclude(id=exclude_session_id).update(status='revoked', revoked_at=timezone.now(), revoked_reason='Revoked via Security Dashboard (revoke all)')


def revoke_user_human_sessions(user, *, exclude_session_id=None, reason: str = ''):
    """Revoke every active human-session PAT belonging to ``user``.

    Used by the password change / reset paths. A stolen human-session PAT is
    valid for 12h by default (``CORE_HUMAN_SESSION_PAT_HOURS``); without this
    a password reset did not stop the attacker, because the reset only changed
    the *password* — it never touched the bearer tokens that were already
    issued, so the attacker stayed logged in until they expired on their own.

    Args:
        user: The ``auth.User`` whose sessions are revoked.
        exclude_session_id: Credential id to keep alive — the caller's own
            session on the password-*change* path. ``None`` revokes everything,
            which is the correct behaviour on password *reset* (the caller is
            necessarily not logged in, so there is no legitimate session to
            preserve and keeping one would defeat the point).
        reason: Stored on the credential for audit.

    Returns:
        int: Number of credentials revoked.
    """
    from .models import CorePATCredential, CoreTenant, TenantMember

    # Human-session PATs are always issued against a service account belonging
    # to a tenant the user owns or is a member of (see ``login_view``), so that
    # tenant set is the complete scope of "this user's sessions".
    tenant_ids = set(
        CoreTenant.objects.filter(owner_user=user).values_list('id', flat=True)
    )
    tenant_ids.update(
        TenantMember.objects.filter(user=user).values_list('tenant_id', flat=True)
    )
    if not tenant_ids:
        return 0

    queryset = CorePATCredential.objects.filter(
        service_account__tenant_id__in=tenant_ids,
        is_human_session=True,
        status=CorePATCredential.StatusChoices.ACTIVE,
    )
    if exclude_session_id is not None:
        queryset = queryset.exclude(id=exclude_session_id)
    updated = queryset.update(
        status=CorePATCredential.StatusChoices.REVOKED,
        revoked_at=timezone.now(),
        revoked_reason=reason or 'Revoked on password change',
    )
    logger.info('revoked %s human session(s) for user=%s', updated, getattr(user, 'pk', None))
    return updated
