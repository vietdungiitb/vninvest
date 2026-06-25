"""SFI-B1: Transparent HTTP proxy — forwards unmatched /api/* requests to legacy backend.

Placed as the LAST route in urlpatterns. Native core-api routes take priority.
"""

import logging

import httpx
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

HOP_BY_HOP_HEADERS = frozenset({
    'connection', 'keep-alive', 'transfer-encoding', 'te',
    'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate',
})


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
            if header_name not in HOP_BY_HOP_HEADERS:
                headers[header_name] = value
    content_type = request.META.get('CONTENT_TYPE', '')
    if content_type:
        headers['content-type'] = content_type
    content_length = request.META.get('CONTENT_LENGTH', '')
    if content_length:
        headers['content-length'] = content_length

    try:
        with httpx.Client(verify=False, timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0)) as client:
            resp = client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=request.body,
                follow_redirects=False,
            )
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.debug("[PROXY] %s %s -> 502 (legacy backend unreachable: %s)", request.method, target_url, e)
        return JsonResponse(
            {'detail': 'Legacy backend unavailable.', 'code': 'LEGACY_BACKEND_DOWN'},
            status=502,
        )

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
        key_lower = key.lower()
        if key_lower not in HOP_BY_HOP_HEADERS and key_lower not in (
            'content-encoding', 'transfer-encoding', 'content-length',
        ):
            django_resp[key] = value

    return django_resp
