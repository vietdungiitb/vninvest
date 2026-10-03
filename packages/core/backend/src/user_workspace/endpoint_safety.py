"""SSRF guard for user-supplied outbound endpoints.

P0-3 (audit Entry 228): ``custom_endpoint`` is user-controlled and was passed
straight to ``httpx.Client().get()``. Any authenticated user could make the API
server issue GET requests to internal-only addresses (cloud metadata
``169.254.169.254``, RFC1918 ranges, loopback services such as the admin
port). The global ``UserRateThrottle`` allows 1000/hour, which turns the view
into an SSRF amplifier rather than a mitigation.

What this module does and does not do
-------------------------------------
It resolves the hostname and rejects the request if **any** resolved address is
in a forbidden range. That closes direct-IP, hostname→private-IP, and
IPv4-mapped-IPv6 (``::ffff:127.0.0.1``) bypasses.

It does **not** close DNS rebinding (TOCTOU): the address is validated at
resolution time and ``httpx`` re-resolves when it connects, so an attacker
controlling DNS could return a public address first and a private one second.
Closing that needs connect-time pinning, which is out of scope here and is
recorded as residual risk rather than claimed as fixed.
"""
from __future__ import annotations

import ipaddress
import os
import socket
from urllib.parse import urlparse

# Only these two schemes can produce an HTTP request we are willing to make.
# Notably excludes file://, gopher://, dict://, ftp://.
ALLOWED_SCHEMES = frozenset({'http', 'https'})

# Ceiling on endpoint length; a real Ollama/vLLM URL is far shorter.
MAX_ENDPOINT_LENGTH = 300

# Hosts permitted to resolve to RFC1918 space regardless of `allow_loopback`.
# Comma-separated hostnames. Required for on-prem deployments whose inference
# endpoint is on a private network that is not loopback.
ALLOWLIST_ENV = 'SOC_AI_ALLOWED_ENDPOINT_HOSTS'


class UnsafeEndpointError(ValueError):
    """Raised when a user-supplied endpoint must not be contacted."""


def _allowed_private_hosts() -> frozenset[str]:
    raw = os.environ.get(ALLOWLIST_ENV, '') or ''
    return frozenset(h.strip().lower() for h in raw.split(',') if h.strip())


def _unwrap(ip_text: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address:
    """Return the real address behind an IPv4-mapped/compatible IPv6 literal."""
    addr = ipaddress.ip_address(ip_text)
    mapped = getattr(addr, 'ipv4_mapped', None)
    return mapped if mapped is not None else addr


# Categories that no operator flag can unlock. `link-local` is here because
# 169.254.169.254 hands out instance credentials — an allowlist entry must
# never be able to reach it.
NEVER_ALLOWLISTABLE = frozenset({'link-local', 'unspecified', 'multicast'})


def _classify(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> tuple[str, str] | None:
    """Return (stable_category, human_message), or None when acceptable.

    The category is the machine-readable key callers branch on. Returning prose
    here and matching on it is how this module shipped a bug where the
    allowlist both refused private hosts and permitted cloud metadata.
    """
    if addr.is_unspecified:
        return 'unspecified', 'địa chỉ không xác định (0.0.0.0/::)'
    if addr.is_link_local:
        return 'link-local', 'link-local (bao gồm metadata cloud 169.254.169.254)'
    if addr.is_multicast:
        return 'multicast', 'multicast'
    if addr.is_loopback:
        return 'loopback', 'loopback (127.0.0.0/8, ::1)'
    if addr.is_reserved:
        return 'reserved', 'reserved'
    if addr.is_private:
        return 'private', 'mạng nội bộ (RFC1918)'
    return None


def _rejection_for(
    ip_text: str,
    *,
    allow_loopback: bool,
    allow_private: bool,
) -> str | None:
    """Reason this address must not be contacted, or None when it is fine."""
    verdict = _classify(_unwrap(ip_text))
    if verdict is None:
        return None
    category, message = verdict
    if category in NEVER_ALLOWLISTABLE:
        return message
    if category == 'loopback' and allow_loopback:
        return None
    if category in ('private', 'loopback') and allow_private:
        return None
    return message


def resolve_endpoint_ips(host: str, port: int) -> list[str]:
    """Resolve `host` to every address the system would connect to."""
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise UnsafeEndpointError(f'không phân giải được host "{host}": {exc}') from exc
    # getaddrinfo can return one family several times; keep order, drop repeats.
    seen: list[str] = []
    for info in infos:
        sockaddr = info[4]
        ip_text = sockaddr[0]
        if ip_text not in seen:
            seen.append(ip_text)
    return seen


def assert_safe_outbound_url(
    url: str,
    *,
    allow_loopback: bool = False,
    allow_private: bool = False,
) -> str:
    """Validate a user-supplied endpoint. Returns the URL on success.

    `allow_loopback` exists because the `local` provider exists precisely to
    reach an Ollama/vLLM server on the same host (`localhost:11434`). Blocking
    loopback unconditionally would break the feature; blocking it for every
    other provider is what actually removes the SSRF surface.
    """
    candidate = (url or '').strip()
    if not candidate:
        raise UnsafeEndpointError('endpoint rỗng')
    if len(candidate) > MAX_ENDPOINT_LENGTH:
        raise UnsafeEndpointError(
            f'endpoint dài {len(candidate)} ký tự, vượt giới hạn {MAX_ENDPOINT_LENGTH}'
        )

    try:
        parsed = urlparse(candidate)
    except ValueError as exc:
        raise UnsafeEndpointError(f'URL không hợp lệ: {exc}') from exc

    if parsed.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeEndpointError(
            f'scheme "{parsed.scheme}" không được phép '
            f'(chỉ nhận {", ".join(sorted(ALLOWED_SCHEMES))})'
        )

    if parsed.username or parsed.password:
        # http://public.example@127.0.0.1/ — the host is 127.0.0.1 but it reads
        # like a public host. Reject rather than let urlparse pick a winner.
        raise UnsafeEndpointError('endpoint không được chứa thông tin đăng nhập (user:pass@)')

    host = (parsed.hostname or '').strip()
    if not host:
        raise UnsafeEndpointError('endpoint thiếu hostname')

    try:
        port = parsed.port or (443 if parsed.scheme.lower() == 'https' else 80)
    except ValueError as exc:
        raise UnsafeEndpointError(f'port không hợp lệ: {exc}') from exc
    if not (1 <= port <= 65535):
        raise UnsafeEndpointError(f'port ngoài phạm vi: {port}')

    # A literal IP never needs DNS; skip resolution so the check works offline.
    literal = None
    try:
        literal = _unwrap(host)
    except ValueError:
        pass

    if literal is not None:
        addresses = [str(literal)]
    else:
        addresses = resolve_endpoint_ips(host, port)

    # An allowlist entry relaxes RFC1918 for that host only. It still cannot
    # reach link-local/metadata, loopback, or multicast (see NEVER_ALLOWLISTABLE).
    allow_private = allow_private or allowlist_allows(host)

    for ip_text in addresses:
        message = _rejection_for(
            ip_text, allow_loopback=allow_loopback, allow_private=allow_private
        )
        if message is not None:
            raise UnsafeEndpointError(
                f'endpoint bị chặn: {host} → {ip_text} là {message}. '
                f'Nếu đây là endpoint on-prem hợp lệ, thêm host vào {ALLOWLIST_ENV}.'
            )

    return candidate


def allowlist_allows(host: str) -> bool:
    return (host or '').strip().lower() in _allowed_private_hosts()
