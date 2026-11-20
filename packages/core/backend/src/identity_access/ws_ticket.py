"""G0.2/C02 + C-01: short-lived single-use WS/SSE handshake tickets.

Khong dung DB migration — ticket song trong Django cache (60s, xoa ngay khi dung).
Human session (JWT/session) lay ticket qua POST /core/v1/auth/ws-ticket/ roi noi WS/SSE
bang ?ticket=. Machine PAT chi duoc mint khi co scope `ws:realtime` (2026-11-20);
ticket machine mang flag `machine=True`, TTL ngan hon va phai strip quyen o moi redeem
site. Client cu van co ?token=<raw_pat> tuong thich nguoc qua TLS (deprecated).
"""
import secrets

from django.contrib.auth import get_user_model
from django.core.cache import cache

WS_TICKET_TTL_S = 60
# Machine PAT tickets are short-lived: demo WS handshake only, never SSE admin.
WS_TICKET_MACHINE_TTL_S = 30


def _cache_key(ticket: str) -> str:
    return f"ws_ticket:{ticket}"


def issue_ws_ticket(
    user_id, tenant_id=None, timeout_s: int = WS_TICKET_TTL_S,
    machine: bool = False, service_account_id=None,
):
    """Cap ticket 1 lan dung. Tra ve (ticket, expires_in).

    `machine=True` danh dau ticket cap cho service account (khong phai human session).
    Moi redeem site PHAI goi `strip_machine_privileges` de tranh escalation (O2/2026-11-15).
    """
    ticket = secrets.token_urlsafe(32)
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "machine": bool(machine),
        "service_account_id": service_account_id,
    }
    cache.set(_cache_key(ticket), payload, timeout=timeout_s)
    return ticket, timeout_s


def redeem_ws_ticket(ticket):
    """Doi ticket lay payload; tra None neu sai/het han/da dung (single-use)."""
    if not ticket or not isinstance(ticket, str):
        return None
    payload = cache.get(_cache_key(ticket))
    if payload is None:
        return None
    cache.delete(_cache_key(ticket))
    return payload


def strip_machine_privileges(user, payload):
    """Strip staff/superuser on a machine ticket, in-memory only (no DB write).

    `redeem` loads the user fresh from DB, which restores privileges that
    `apply_pat_user_privileges` had stripped for machine PAT (resolve_tenant.py:216-226).
    Applying this before DRF permission checks closes that escalation path.
    """
    if isinstance(payload, dict) and payload.get("machine"):
        user.is_staff = False
        user.is_superuser = False
    return user


def _user_from_token_token(token: str):
    from identity_access.models import CorePATCredential

    if not token:
        return None
    cred = CorePATCredential.resolve_from_raw_secret(token)
    if cred and cred.effective_status == CorePATCredential.StatusChoices.ACTIVE:
        return cred.service_account.tenant.owner_user
    return None


def resolve_user_from_ws_query(query_string: str):
    """Giai user tu query WS: uu tien ?ticket= (single-use), fallback ?token=."""
    for part in (query_string or "").split("&"):
        if part.startswith("ticket="):
            payload = redeem_ws_ticket(part[7:])
            if not payload:
                return None
            try:
                user = get_user_model().objects.get(pk=payload["user_id"])
                return strip_machine_privileges(user, payload)
            except Exception:
                return None
    for part in (query_string or "").split("&"):
        if part.startswith("token="):
            return _user_from_token_token(part[6:])
    return None
