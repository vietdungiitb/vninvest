"""
Legacy backend PAT authentication.

Allows the legacy Django backend to accept PAT tokens issued by core-api.
Both services share the same PostgreSQL database, so PAT credentials can be
looked up directly from the `identity_access_corepatcredential` table.

This is intentionally a transitional adapter for the SFI proxy phase.
When core-api is fully independent, this module can be removed.
"""

import hashlib
import hmac
import os
import secrets
import uuid as _uuid

from django.contrib.auth import get_user_model
from django.db import connection

User = get_user_model()

_PAT_PREFIX = 'vni_'
_PREFIX_LEN = 12
_PEPPER = os.environ.get('CORE_PAT_PEPPER', 'dev-pat-pepper-replace-in-production')


def _hash_pat_secret(raw_secret: str) -> str:
    return hmac.new(_PEPPER.encode(), raw_secret.encode(), hashlib.sha256).hexdigest()


def _resolve_user_from_pat(raw_secret: str):
    """
    Validate a PAT token and return the associated Django User or None.

    Queries identity_access_corepatcredential via raw SQL to avoid
    importing core-api models into the legacy codebase.
    """
    raw_secret = str(raw_secret or '').strip()
    if not raw_secret.startswith(_PAT_PREFIX):
        return None
    prefix = raw_secret[:_PREFIX_LEN]
    expected_hash = _hash_pat_secret(raw_secret)

    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT
                pac.token_secret_hash,
                pac.revoked,
                pac.status,
                pac.expires_at,
                sa.tenant_id
            FROM identity_access_corepatcredential pac
            JOIN identity_access_coreserviceaccount sa ON sa.id = pac.service_account_id
            WHERE pac.token_prefix = %s AND pac.revoked = FALSE
            ORDER BY pac.created_at DESC
            LIMIT 10
            """,
            [prefix],
        )
        rows = cur.fetchall()

    matched_tenant_id = None
    for token_hash, revoked, cred_status, expires_at, tenant_id in rows:
        if not revoked and cred_status == 'active':
            if hmac.compare_digest(str(token_hash or ''), expected_hash):
                matched_tenant_id = tenant_id
                break

    if matched_tenant_id is None:
        return None

    # Resolve the tenant owner user
    with connection.cursor() as cur:
        cur.execute(
            "SELECT owner_user_id FROM identity_access_coretenant WHERE id = %s",
            [matched_tenant_id],
        )
        row = cur.fetchone()

    if not row:
        return None
    owner_user_id = row[0]

    try:
        return User.objects.get(pk=owner_user_id, is_active=True)
    except User.DoesNotExist:
        return None


def _issue_pat_for_user(user, label: str = 'oauth-session') -> str:
    """
    Issue a new PAT for a user via the shared PostgreSQL DB using raw SQL.

    Finds or creates the CoreTenant and a default CoreServiceAccount for the
    user, then inserts a new CorePATCredential row. Returns the raw PAT secret
    (shown once only — caller must return it to the client immediately).

    Uses raw SQL to avoid importing core-api models into the legacy codebase.
    """
    user_id = int(user.pk)

    with connection.cursor() as cur:
        # 1. Resolve tenant for user
        cur.execute(
            "SELECT id FROM identity_access_coretenant WHERE owner_user_id = %s LIMIT 1",
            [user_id],
        )
        row = cur.fetchone()

        if row:
            tenant_id = row[0]
        else:
            # Create a minimal tenant for first-time OAuth users
            tenant_public_id = str(_uuid.uuid4())
            tenant_code = f'ten_usr_{user_id}_{secrets.token_hex(4)}'
            cur.execute(
                """
                INSERT INTO identity_access_coretenant
                    (public_id, owner_user_id, tenant_code, display_name,
                     plan, status, features, created_at, updated_at)
                VALUES (%s, %s, %s, %s, 'free', 'active', '[]', NOW(), NOW())
                RETURNING id
                """,
                [tenant_public_id, user_id, tenant_code, user.username],
            )
            tenant_id = cur.fetchone()[0]

        # 2. Find or create an active service account for this tenant
        cur.execute(
            """
            SELECT id FROM identity_access_coreserviceaccount
            WHERE tenant_id = %s AND status = 'active'
            ORDER BY created_at ASC LIMIT 1
            """,
            [tenant_id],
        )
        row = cur.fetchone()

        if row:
            sa_id = row[0]
        else:
            sa_public_id = str(_uuid.uuid4())
            cur.execute(
                """
                INSERT INTO identity_access_coreserviceaccount
                    (public_id, tenant_id, name, status, scopes, metadata, created_at, updated_at)
                VALUES (%s, %s, 'default', 'active', '[]', '{}', NOW(), NOW())
                RETURNING id
                """,
                [sa_public_id, tenant_id],
            )
            sa_id = cur.fetchone()[0]

        # 3. Issue a new PAT credential
        raw_token = _PAT_PREFIX + secrets.token_urlsafe(48)
        prefix = raw_token[:_PREFIX_LEN]
        token_hash = _hash_pat_secret(raw_token)
        pat_public_id = str(_uuid.uuid4())
        cur.execute(
            """
            INSERT INTO identity_access_corepatcredential
                (public_id, service_account_id, label, token_prefix, token_secret_hash,
                 scopes, status, revoked, audit_reason, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, '[]', 'active', FALSE, '', NOW(), NOW())
            """,
            [pat_public_id, sa_id, label, prefix, token_hash],
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
