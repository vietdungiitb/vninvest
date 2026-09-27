"""
Permissions module for user_workspace domain.

TenantScopePermission ensures request.user has active tenant and attaches
request.tenant for use in views.
"""
import logging
from typing import Optional
from rest_framework.permissions import BasePermission

from identity_access.utils.resolve_tenant import (
    RESOLVABLE_TENANT_STATUSES,
    first_eligible_tenant_for_user,
    is_plausible_tenant_public_id,
    owner_tenant_for_user,
    resolve_tenant_for_user,
)

logger = logging.getLogger(__name__)


class TenantScopePermission(BasePermission):
    """
    Ensure authenticated user has active tenant.
    Attaches request.tenant for downstream views.

    Use in view.permission_classes:
        permission_classes = [IsAuthenticated, TenantScopePermission]

    After check, request.tenant will be set (or None if single-tenant mode).
    """

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # ------------------------------------------------------------------
        # The middleware is authoritative. Do NOT overwrite its decision.
        # ------------------------------------------------------------------
        # TenantResolutionMiddleware (MIDDLEWARE index 8) already reads
        # X-Tenant-ID, applies the shared owner-or-member check, and sets
        # BOTH request.tenant and request.tenant_role. The previous version of
        # this class unconditionally re-resolved and overwrote request.tenant
        # from user.core_profile.tenant, which is a *different* tenant than the
        # one the middleware picked. That is the B5 bug: for a user who owns
        # tenant A and is a viewer in tenant B, TenantQuotaMiddleware (index 9,
        # earlier in the chain) metered and incremented Redis against A while
        # user_workspace views then read B - and get_tenant_role() returned A's
        # role, so a mere viewer in B passed `tenant:write`-style checks
        # measured against A's owner role.
        current = getattr(request, 'tenant', None)
        if current is not None:
            # Keep the middleware's tenant. Only apply this class's status gate,
            # which is what distinguishes PENDING_ACTIVATION (not resolvable)
            # from SUSPENDED/DEPROVISIONED (already 403'd by the middleware).
            return current.status in RESOLVABLE_TENANT_STATUSES

        # ------------------------------------------------------------------
        # No middleware resolution (exempt paths, or middleware bypassed):
        # resolve here, through the SAME shared membership check.
        # ------------------------------------------------------------------
        # X-Tenant-ID is the header the frontend actually sends, carrying
        # CoreTenant.public_id. The legacy names below are kept working.
        public_id_hint = (request.headers.get('X-Tenant-ID') or '').strip()
        if public_id_hint:
            # Bounded shape check before touching the DB. NOT a strict UUID
            # parse on purpose: public_id is a CharField(max_length=36) that
            # only *auto-fills* with str(uuid.uuid4()) (models.py:128-132), and
            # the existing test-suite uses non-UUID values such as
            # 'rbac_tenant' / 'test_tenant_123'. A strict UUID check would 403
            # legitimate requests. Garbage is rejected by the shape check and by
            # the membership check, never by a ValidationError 500.
            if not is_plausible_tenant_public_id(public_id_hint):
                logger.warning(
                    'TenantScopePermission: malformed X-Tenant-ID rejected '
                    '(user=%s).', getattr(request.user, 'username', '?'),
                )
                return False
            tenant, _role = resolve_tenant_for_user(request.user, public_id_hint)
            if tenant is None:
                return False
            request.tenant = tenant
            return True

        tenant_code_hint = (
            request.headers.get('X-Tenant-Code')
            or request.query_params.get('tenant_code')
            or request.query_params.get('tenant')
        )

        # Resolve tenant from user
        tenant = _resolve_tenant(request.user, tenant_code_hint=tenant_code_hint)
        if not tenant:
            return False
        request.tenant = tenant  # Attach to request for view use

        return True


def _resolve_tenant(user, tenant_code_hint: Optional[str] = None) -> Optional['CoreTenant']:
    """Resolve a tenant for ``user`` by DELEGATING to the shared SSOT.

    This used to be a fourth independent resolver: its own priority order
    (profile -> member -> owner), its own inline ``['active','trial']`` status
    literals, and its own hint vocabulary. That is not a style problem - the two
    implementations could pick DIFFERENT tenants for the same request. For a user
    who owns a SUSPENDED tenant A and is an active viewer in B, this function
    skipped A on status and returned B, while ``owner_tenant_for_user`` returned
    A, so identity_access views operated on A while user_workspace views operated
    on B from one request, and ``get_tenant_role`` then reported A's ``owner``.

    Delegating removes the possibility rather than documenting it. The order is the
    SSOT's: owner (status-filtered) -> first eligible membership. The profile-tenant
    preference is gone on purpose: it was the other half of the disagreement.
    ``RESOLVABLE_TENANT_STATUSES`` is imported rather than re-listed so the two
    cannot drift.
    """
    normalized_hint = (tenant_code_hint or '').strip().lower()

    # An explicit tenant_code hint is a different key from public_id, and the SSOT
    # resolves by public_id. Look it up here, but still subject it to the shared
    # owner-or-member membership check so a hint cannot reach another tenant.
    if normalized_hint:
        try:
            from django.db.models import Q

            from identity_access.models import CoreTenant, TenantMember
        except ImportError:  # identity_access not installed in this environment
            return None
        try:
            # A tenant_code hint still has to satisfy owner-or-member, exactly as
            # resolve_tenant_for_user does for a public_id hint.
            member_tenant_ids = TenantMember.objects.filter(user=user).values_list(
                'tenant_id', flat=True
            )
            candidate = (
                CoreTenant.objects.filter(tenant_code__iexact=normalized_hint)
                .filter(
                    Q(owner_user=user) | Q(pk__in=member_tenant_ids),
                    status__in=RESOLVABLE_TENANT_STATUSES,
                )
                .order_by('pk')
                .first()
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(
                '_resolve_tenant hint lookup failed for user=%s: %s',
                getattr(user, 'id', None),
                exc,
            )
            return None
        return candidate

    # NOTE: first_eligible_tenant_for_user returns a (tenant, role) TUPLE, while
    # owner_tenant_for_user returns a bare tenant. Mixing them up assigns the tuple
    # to request.tenant, and every downstream `filter(tenant=request.tenant)` then
    # raises "Field 'id' expected a number but got <CoreTenant>".
    #
    # The status check is HERE rather than inside owner_tenant_for_user on purpose.
    # That shared helper is unfiltered so the middleware can report the precise
    # `tenant_suspended` instead of a misleading `tenant_not_found`, which its
    # tests pin. Applying the same eligibility rule at both call sites is what
    # makes the two resolvers agree, without destroying the error detail.
    owner = owner_tenant_for_user(user)
    if owner is not None and owner.status in RESOLVABLE_TENANT_STATUSES:
        return owner
    tenant, _role = first_eligible_tenant_for_user(user)
    return tenant
