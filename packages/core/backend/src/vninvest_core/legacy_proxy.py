"""
SFI-B1.2: Transparent HTTP proxy â€” core-api â†’ legacy backend.

Forwards ALL /api/<remaining> requests to the legacy backend unchanged.
This is a temporary bridge; each domain migrated natively removes its
proxy rule via the PROXY_EXCLUDED_PREFIXES exclusion list.

Hard rules (from CODE_QUALITY_CONSTITUTION):
- NEVER log request body.
- NEVER forward hop-by-hop headers.
- Return 502 JSON when legacy backend is unreachable.
- Timeout: connect=5s, read=120s (file upload: 300s).

Implementation note: Uses synchronous httpx.Client (not async) because
core-api runs under WSGI (gunicorn). Async client causes RuntimeError
when instantiated at module level under WSGI event loop semantics.
"""

import logging

import httpx
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse

logger = logging.getLogger(__name__)

# Headers that MUST NOT be forwarded upstream (RFC 2616 Â§13.5.1 + de-facto).
HOP_BY_HOP = frozenset([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'proxy-connection',
    'content-length',  # httpx sets this automatically
])

# Prefixes that are already handled natively by core-api — never proxy these.
# Extend this list as each domain is migrated in B2-B7.
# NOTE: auth/token/, auth/token/refresh/, auth/me/ are handled by compat_urls
# (core-api login_view / refresh_token_view / profile_view) — no entry needed here.
PROXY_EXCLUDED_PREFIXES = ()

# Shared sync client â€” connection pool reused across requests.
# connect=5s prevents hanging on unreachable legacy; read=120s covers long ops.
_SYNC_CLIENT = httpx.Client(
    timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0),
    follow_redirects=False,
    http2=False,
)


def _build_upstream_url(remaining_path: str, query_string: str) -> str:
    base = settings.LEGACY_BACKEND_URL.rstrip('/')
    path = f'/api/{remaining_path}'
    if query_string:
        return f'{base}{path}?{query_string}'
    return f'{base}{path}'


def _filter_request_headers(django_meta: dict) -> dict:
    """Extract and clean request headers from Django META dict."""
    headers: dict[str, str] = {}
    for key, value in django_meta.items():
        if key.startswith('HTTP_'):
            header_name = key[5:].lower().replace('_', '-')
            if header_name not in HOP_BY_HOP:
                headers[header_name] = value
        elif key == 'CONTENT_TYPE' and value:
            headers['content-type'] = value
    return headers


def _filter_response_headers(httpx_headers) -> dict:
    """Strip hop-by-hop headers from upstream response before forwarding."""
    result = {}
    for name, value in httpx_headers.items():
        if name.lower() not in HOP_BY_HOP:
            result[name] = value
    return result


def legacy_proxy_view(request, remaining=''):
    """
    Synchronous Django view: transparent proxy to legacy backend.

    Called only for routes not handled natively by core-api
    (registered as the LAST urlpattern in urls.py).

    Sync implementation for WSGI compatibility (gunicorn wsgi:application).
    """
    path = f'/api/{remaining}'

    # Safety: excluded prefixes should have been caught by native routes.
    for prefix in PROXY_EXCLUDED_PREFIXES:
        if path.startswith(prefix):
            return HttpResponse(
                '{"detail": "Route handled natively."}',
                content_type='application/json',
                status=400,
            )

    upstream_url = _build_upstream_url(
        remaining,
        request.META.get('QUERY_STRING', ''),
    )
    method = request.method.upper()
    headers = _filter_request_headers(request.META)

    body = request.body if method in ('POST', 'PUT', 'PATCH', 'DELETE') else None

    # Use longer timeout for file-upload / admin-ops paths.
    timeout = httpx.Timeout(connect=5.0, read=300.0, write=30.0, pool=5.0) \
        if remaining.startswith('admin-ops/') or remaining.startswith('stock-management/upload') \
        else None  # None â†’ use client default (120s read)

    try:
        upstream_resp = _SYNC_CLIENT.request(
            method=method,
            url=upstream_url,
            headers=headers,
            content=body,
            timeout=timeout,
        )
        logger.debug('[PROXY] %s /api/%s â†’ %s', method, remaining, upstream_resp.status_code)

    except httpx.ConnectError:
        logger.warning('[PROXY] %s /api/%s â†’ ConnectError (legacy backend down?)', method, remaining)
        return HttpResponse(
            '{"detail": "Legacy backend unavailable.", "code": "upstream_connect_error"}',
            content_type='application/json',
            status=502,
        )
    except httpx.TimeoutException:
        logger.warning('[PROXY] %s /api/%s â†’ Timeout', method, remaining)
        return HttpResponse(
            '{"detail": "Legacy backend timeout.", "code": "upstream_timeout"}',
            content_type='application/json',
            status=504,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error('[PROXY] %s /api/%s â†’ Unexpected error: %s', method, remaining, type(exc).__name__)
        return HttpResponse(
            '{"detail": "Proxy error.", "code": "upstream_error"}',
            content_type='application/json',
            status=502,
        )

    resp_headers = _filter_response_headers(upstream_resp.headers)
    content_type = resp_headers.pop('content-type', 'application/json')

    # Stream response content.
    response = StreamingHttpResponse(
        streaming_content=_iter_content(upstream_resp),
        status=upstream_resp.status_code,
        content_type=content_type,
    )
    for header_name, header_value in resp_headers.items():
        try:
            response[header_name] = header_value
        except Exception:  # noqa: BLE001
            pass  # skip malformed headers silently
    return response


def _iter_content(upstream_resp: httpx.Response):
    """Yield response content chunks for StreamingHttpResponse."""
    for chunk in upstream_resp.iter_bytes(chunk_size=8192):
        yield chunk
