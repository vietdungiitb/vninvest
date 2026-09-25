"""SFI-B1: Transparent HTTP proxy — forwards unmatched /api/* requests to legacy backend.

Placed as the LAST route in urlpatterns. Native core-api routes take priority.
"""

import logging
import os

import httpx
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

HOP_BY_HOP_HEADERS = frozenset({
    'connection', 'keep-alive', 'transfer-encoding', 'te',
    'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate',
})

# BL-03: explicit forward whitelist (default) + env-extensible without code change.
# Rationale: forward-all HTTP_* leaked arbitrary client headers (incl. proxy
# internals) to the legacy backend. Measure real traffic (BL-14) before narrowing.
_DEFAULT_FORWARD_HEADERS = frozenset({
    'authorization', 'content-type', 'accept', 'accept-language',
    'x-request-id', 'user-agent',
})
_EXTRA_FORWARD_HEADERS = frozenset(
    h.strip().lower() for h in os.environ.get('LEGACY_PROXY_EXTRA_HEADERS', '').split(',') if h.strip()
)
FORWARD_HEADERS = _DEFAULT_FORWARD_HEADERS | _EXTRA_FORWARD_HEADERS

# BL-03: only these response headers pass back (never Set-Cookie from legacy).
# BL-03: only these response headers pass back (never Set-Cookie from legacy).
RESPONSE_PASS_HEADERS = frozenset({'content-type', 'x-request-id'})

# BL-14: deprecation advertisement. Removal only after traffic measurement
# shows zero real callers (see docs/evidence/audit-bl/BL-14/gates.md).
DEPRECATION_SUNSET_DATE = 'Thu, 31 Dec 2026 00:00:00 GMT'


def _deprecated_response(resp):
    """Attach standard deprecation headers (BL-14)."""
    resp['Deprecation'] = 'true'
    resp['Sunset'] = DEPRECATION_SUNSET_DATE
    resp['X-Legacy-Proxy-Deprecated'] = 'migrate to /core/v1/ native endpoints'
    return resp


def _tls_verify():
    """BL-03: verify TLS to legacy (was verify=False = MITM)."""
    bundle = os.environ.get('LEGACY_BACKEND_CA_BUNDLE', '').strip()
    return bundle or True


@csrf_exempt
def legacy_proxy_view(request, remaining):
    target_url = f"{settings.LEGACY_BACKEND_URL.rstrip('/')}/api/{remaining}"
    query = request.META.get('QUERY_STRING', '')
    if query:
        target_url = f"{target_url}?{query}"

    headers = {}
    for key, value in request.META.items():
        if key.startswith('HTTP_'):
            header_name = key[5:].replace('_', '-').lower()
            if header_name in FORWARD_HEADERS:
                headers[header_name] = value
    content_type = request.META.get('CONTENT_TYPE', '')
    if content_type:
        headers['content-type'] = content_type
    # NOTE: CONTENT_LENGTH intentionally not forwarded (BL-03) — httpx
    # recomputes it from body; forwarding a stale value breaks requests.

    try:
        with httpx.Client(verify=_tls_verify(), timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0)) as client:
            resp = client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=request.body,
                follow_redirects=False,
            )
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.debug("[PROXY] %s %s -> 502 (legacy backend unreachable: %s)", request.method, target_url, e)
        return _deprecated_response(JsonResponse(
            {'detail': 'Legacy backend unavailable.', 'code': 'LEGACY_BACKEND_DOWN'},
            status=502,
        ))

    logger.debug(
        "[PROXY] %s %s -> %s",
        request.method,
        target_url,
        resp.status_code,
    )

    django_resp = HttpResponse(
        content=resp.content,
        status=resp.status_code,
        content_type=resp.headers.get('content-type', 'application/json'),
    )
    for key, value in resp.headers.items():
        # BL-03: strict pass-list (never Set-Cookie / security headers from legacy).
        if key.lower() in RESPONSE_PASS_HEADERS:
            django_resp[key] = value

    return _deprecated_response(django_resp)
