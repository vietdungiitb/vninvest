"""Single source of truth for resolving the client IP address of a request.

Threat model
------------
The backend sits behind one or more reverse proxies (nginx in front of gunicorn).
``X-Forwarded-For`` is a **client-supplied, attacker-controlled header**: anybody
can send ``X-Forwarded-For: 10.0.0.1`` and it will be relayed verbatim unless a
trusted intermediary sanitises it. Therefore:

* ``request.META['REMOTE_ADDR']`` is the only authoritative value. It is the
  socket peer, which the kernel/driver gives us and the client cannot forge.
* A forwarded header is honoured **only** when ``REMOTE_ADDR`` itself is listed
  in ``settings.TRUSTED_PROXY_IPS``. Trusting the header unconditionally is the
  root cause of IP spoofing against every rate limiter, every audit-log row and
  the PAT CIDR allow-list check in ``identity_access/authentication.py``.
* When the peer *is* trusted we take the **LAST** non-empty ``X-Forwarded-For``
  entry, because that is the value appended by the closest trusted proxy (i.e.
  the real peer as that proxy saw it). The left-most entry is the one an
  attacker injects, so reading it is equivalent to trusting the client.
* Anything that cannot be parsed as a valid address is discarded, never raised:
  a malformed header must not turn into a 500.

Migration note (all of these MUST be replaced by ``get_client_ip()``)
-----------------------------------------------------------------
Six independent inline copies of the same broken left-most-XFF read exist today
and each one has to be migrated, otherwise the vulnerability survives:

1. ``identity_access/views/register.py:38`` and ``:335``
2. ``identity_access/views/login.py:41``
3. ``identity_access/authentication.py:41`` (PAT CIDR allow-list)
4. ``identity_access/middleware.py:382``
5. ``ops_audit/middleware.py:47``
6. ``commercial/views.py:154``

Further duplicates outside the current slice (same bug, migrate opportunistically):
``advertising/views.py:139,178,353``; ``identity_access/security_utils.py:7``;
``service_ops/views/broker.py:83``, ``service_ops/views/staff.py:43``,
``service_ops/views/users.py:24``.

Fallback contract
-----------------
The function never returns an empty string and never raises. When no usable
address can be determined it returns the literal ``UNKNOWN_IP`` = ``"unknown"``.
This is deliberately **not** ``"0.0.0.0"``: ``"0.0.0.0"`` is a syntactically valid
IP literal, so it would be stored in audit rows and re-parsed downstream as if it
were a real address. ``"unknown"`` is unambiguous. Note this makes every
unidentifiable caller share a single rate-limit bucket, which is the
fail-closed direction for anti-abuse (stricter, not weaker).

Address format
--------------
Return values are the output of ``ipaddress.ip_address().str()``. IPv6 is
therefore returned in its canonical **compressed** form (``2001:db8::dead:beef``,
not ``2001:0db8:0000:...:dead:beef``). Callers must compare and bucket on this
string, never against hand-written expanded literals. Parse with
``ipaddress.ip_address()`` if a canonical comparison is needed.
"""
import ipaddress
import logging

from django.conf import settings as _django_settings

logger = logging.getLogger(__name__)

#: Returned when no valid client address can be determined. Never an IP literal.
UNKNOWN_IP = "unknown"

#: Header consulted only when the immediate peer is a trusted proxy.
X_FORWARDED_FOR = "HTTP_X_FORWARDED_FOR"


def _trusted_proxy_ips():
    """Return the configured trusted-proxy entries as a set of strings.

    Reads ``settings.TRUSTED_PROXY_IPS`` lazily so this module stays importable
    (and unit-testable) before Django settings are configured. A configuration
    error degrades to "trust nothing", which is fail-closed.
    """
    try:
        return _django_settings.TRUSTED_PROXY_IPS or []
    except Exception:  # settings not configured / attribute missing
        return []


def _peer_is_trusted(peer_ip):
    """True when ``peer_ip`` matches a ``TRUSTED_PROXY_IPS`` entry.

    Entries may be a plain address (``"10.0.4.7"``) or a CIDR network
    (``"10.0.0.0/8"``) so a whole Docker network can be trusted at once.
    Unparseable entries never match.
    """
    if not peer_ip:
        return False
    try:
        peer = ipaddress.ip_address(peer_ip.strip())
    except ValueError:
        # Malformed peer => cannot be matched against the allow-list.
        return False

    for entry in _trusted_proxy_ips():
        if not entry or not isinstance(entry, str):
            continue
        entry = entry.strip()
        if not entry:
            continue
        try:
            if "/" in entry:
                if peer in ipaddress.ip_network(entry, strict=False):
                    return True
            elif peer == ipaddress.ip_address(entry):
                return True
        except ValueError:
            # Misconfigured entry - skip it, never break request handling.
            continue
    return False


def _last_valid_forwarded_ip(header_value):
    """Return the last valid address in an ``X-Forwarded-For`` header.

    Splits on ``,``, strips whitespace, drops empties and ignores malformed
    entries. Returns ``None`` when no valid address remains.
    """
    if not header_value:
        return None
    if isinstance(header_value, (list, tuple)):
        # Defensive: some WSGI servers expose repeated headers as a sequence.
        header_value = ", ".join(str(part) for part in header_value)

    result = None
    for raw in str(header_value).split(","):
        candidate = raw.strip()
        if not candidate:
            continue
        # Some proxies append a port, e.g. "1.2.3.4:5678".
        if candidate.startswith("["):  # "[::1]:443"
            candidate = candidate[1:].split("]", 1)[0]
        elif candidate.count(":") == 1:
            candidate = candidate.split(":", 1)[0]
        try:
            result = str(ipaddress.ip_address(candidate))
        except ValueError:
            # Malformed entry is discarded, never raised.
            continue
    return result


def get_client_ip(request):
    """Resolve the client IP address for ``request``.

    Args:
        request: Any object exposing ``request.META`` (WSGIRequest, DRF Request,
            or a plain stub dict for unit tests).

    Returns:
        str: A valid textual IP address, or ``UNKNOWN_IP`` (``"unknown"``) when
        none can be determined. Never empty, never ``None``, never raises.

        Resolution order:
          1. ``REMOTE_ADDR`` if the peer is a trusted proxy and the
             ``X-Forwarded-For`` header yields a valid last entry.
          2. ``REMOTE_ADDR`` (peer is not trusted -> header ignored entirely).
          3. ``UNKNOWN_IP`` when ``REMOTE_ADDR`` is missing/empty/malformed.
    """
    try:
        meta = getattr(request, "META", None) or {}

        peer = (meta.get("REMOTE_ADDR") or "").strip()

        if _peer_is_trusted(peer):
            forwarded = _last_valid_forwarded_ip(meta.get(X_FORWARDED_FOR))
            if forwarded:
                return forwarded

        if peer:
            # Return the peer as-is when it parses; otherwise it is unusable
            # as an address (e.g. a unix socket path) and we degrade.
            try:
                return str(ipaddress.ip_address(peer))
            except ValueError:
                return UNKNOWN_IP

        return UNKNOWN_IP
    except Exception:  # pragma: no cover - last-resort guard
        logger.warning("client_ip: unexpected failure resolving client IP",
                       exc_info=True)
        return UNKNOWN_IP


def get_client_subnet(request, bits=24):
    """Resolve the client subnet for ``request``, for coarse rate-limit buckets.

    Args:
        request: Same contract as :func:`get_client_ip`.
        bits: Prefix length. ``24`` is the sane default for IPv4. For IPv6 pass
            something like ``64`` - an IPv6 ``/24`` covers 2**104 addresses and
            therefore buckets almost every caller together.

    Returns:
        str: The network address as a string (e.g. ``"203.0.113.0"`` for
        ``203.0.113.42/24``), or ``UNKNOWN_IP`` when the client IP is unknown
        or invalid. Never empty, never raises.
    """
    client_ip = get_client_ip(request)
    if client_ip == UNKNOWN_IP:
        return UNKNOWN_IP
    try:
        return str(ipaddress.ip_network(f"{client_ip}/{bits}", strict=False).network_address)
    except ValueError:
        return UNKNOWN_IP
