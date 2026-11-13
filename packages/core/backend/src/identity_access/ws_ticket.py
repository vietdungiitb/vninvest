"""G0.2/C02: short-lived single-use WS handshake tickets.

Khong dung DB migration — ticket song trong Django cache (60s, xoa ngay khi
dung). Widget lay ticket qua POST /core/v1/auth/ws-ticket/ (Bearer PAT), roi
noi WS bang ?ticket= thay cho ?token=<raw_pat> (van tuong thich nguoc).
"""
import secrets

from django.contrib.auth import get_user_model
from django.core.cache import cache

WS_TICKET_TTL_S = 60


def _cache_key(ticket: str) -> str:
    return f"ws_ticket:{ticket}"


def issue_ws_ticket(user_id, tenant_id=None, timeout_s: int = WS_TICKET_TTL_S):
    """Cap ticket 1 lan dung. Tra ve (ticket, expires_in)."""
    ticket = secrets.token_urlsafe(32)
    cache.set(_cache_key(ticket), {"user_id": user_id, "tenant_id": tenant_id}, timeout=timeout_s)
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
                return get_user_model().objects.get(pk=payload["user_id"])
            except Exception:
                return None
    for part in (query_string or "").split("&"):
        if part.startswith("token="):
            return _user_from_token_token(part[6:])
    return None
