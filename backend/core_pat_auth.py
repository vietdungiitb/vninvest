"""
Legacy backend PAT authentication.

Allows the legacy Django backend to accept PAT tokens issued by core-api.
PAT credentials are resolved through the canonical `identity_access` ORM.

This is intentionally a transitional adapter for the SaaS cutover phase.
When the legacy backend is fully retired, this module can be removed.
"""

import hashlib
import hmac
import os
import secrets

from django.contrib.auth import get_user_model

from identity_access.models import CorePATCredential, CoreServiceAccount, CoreTenant

User = get_user_model()

_PAT_PREFIX = 'vni_'
_PREFIX_LEN = 12
_PEPPER = os.environ.get('CORE_PAT_PEPPER', 'dev-pat-pepper-replace-in-production')


def _hash_pat_secret(raw_secret: str) -> str:
    return hmac.new(_PEPPER.encode(), raw_secret.encode(), hashlib.sha256).hexdigest()


def _resolve_user_from_pat(raw_secret: str):
    """
    Validate a PAT token and return the associated Django User or None.

    Uses canonical identity_access ORM models so the legacy backend no longer
    depends on direct SQL against SaaS tables.
    """
    raw_secret = str(raw_secret or '').strip()
    if not raw_secret.startswith(_PAT_PREFIX):
        return None
    credential = CorePATCredential.resolve_from_raw_secret(raw_secret)
    if credential is None:
        return None

    tenant = getattr(credential.service_account, 'tenant', None)
    owner_user = getattr(tenant, 'owner_user', None)
    if owner_user is None:
        return None

    if not getattr(owner_user, 'is_active', False):
        return None
    return owner_user


def _resolve_or_create_tenant_for_user(user):
    owner_user_id = getattr(user, 'pk', None)
    if not owner_user_id:
        raise ValueError('owner_user must be saved before resolving CoreTenant.')

    username = str(getattr(user, 'username', '') or '').strip()
    email = str(getattr(user, 'email', '') or '').strip()
    email_local = email.split('@', 1)[0] if email else ''
    display_name = username or email or f'user-{owner_user_id}'

    tenant, created = CoreTenant.objects.get_or_create(
        owner_user=user,
        defaults={
            'display_name': display_name,
            'tenant_code': f'tenant-{owner_user_id}-{secrets.token_hex(4)}',
            'plan': CoreTenant.PlanChoices.FREE,
            'status': CoreTenant.StatusChoices.ACTIVE,
            'features': [],
        },
    )

    if created:
        return tenant

    update_fields = []
    if tenant.display_name != display_name:
        tenant.display_name = display_name
        update_fields.append('display_name')
    if not tenant.tenant_code:
        tenant.tenant_code = f'tenant-{owner_user_id}-{secrets.token_hex(4)}'
        update_fields.append('tenant_code')
    if tenant.plan != CoreTenant.PlanChoices.FREE:
        tenant.plan = CoreTenant.PlanChoices.FREE
        update_fields.append('plan')
    if tenant.status != CoreTenant.StatusChoices.ACTIVE:
        tenant.status = CoreTenant.StatusChoices.ACTIVE
        update_fields.append('status')
    if update_fields:
        tenant.save(update_fields=[*update_fields, 'updated_at'])
    return tenant


def _issue_pat_for_user(user, label: str = 'oauth-session') -> str:
    """
    Issue a new PAT for a user through the canonical identity_access ORM.

    Finds or creates the CoreTenant and a default CoreServiceAccount for the
    user, then inserts a new CorePATCredential row. Returns the raw PAT secret
    (shown once only — caller must return it to the client immediately).
    """
    tenant = _resolve_or_create_tenant_for_user(user)
    service_account = (
        CoreServiceAccount.objects
        .filter(tenant=tenant, status=CoreServiceAccount.StatusChoices.ACTIVE)
        .order_by('created_at', 'pk')
        .first()
    )
    if service_account is None:
        service_account = CoreServiceAccount.objects.create(
            tenant=tenant,
            name='default',
            status=CoreServiceAccount.StatusChoices.ACTIVE,
            scopes=[],
            metadata={},
        )

    _, raw_token = CorePATCredential.issue_for_service_account(
        service_account=service_account,
        scopes=[],
        label=label,
        audit_reason='',
    )

    return raw_token


class LegacyCorePATAuthentication:
    """
    DRF-compatible authentication class that validates core-api PAT tokens.

    Add to DEFAULT_AUTHENTICATION_CLASSES or per-view authentication_classes.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '').strip()
        if not auth_header.lower().startswith('bearer '):
            return None
        raw_token = auth_header[7:].strip()
        if not raw_token.startswith(_PAT_PREFIX):
            return None  # not a PAT token, let JWT handle it

        user = _resolve_user_from_pat(raw_token)
        if user is None:
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed('Invalid or revoked PAT token.')
        return (user, raw_token)

    def authenticate_header(self, request):
        return 'Bearer realm="api"'
