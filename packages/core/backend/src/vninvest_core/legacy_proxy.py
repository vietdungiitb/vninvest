import logging
import httpx
from django.conf import settings
from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)

# SFI-B1.3: Timeout cho proxy: connect 5s, read 120s (không dùng default).
PROXY_TIMEOUT = httpx.Timeout(5.0, read=120.0)

def legacy_proxy_view(request, path):
    """
    SFI-B1: Proxy các request chưa được migrate natively sang legacy backend.
    """
    base_url = getattr(settings, 'LEGACY_BACKEND_URL', '').strip().rstrip('/')
    if not base_url:
        logger.error("LEGACY_BACKEND_URL not configured. Cannot proxy path: %s", path)
        return HttpResponse("Legacy bridge not configured.", status=502)

    url = f"{base_url}/api/{path}"
    if request.GET:
        url += f"?{request.GET.urlencode()}"

    # SFI-B1.2: Strip hop-by-hop headers.
    headers = {k: v for k, v in request.headers.items() if k.lower() not in (
        'host', 'connection', 'keep-alive', 'proxy-authenticate', 
        'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'
    )}
    
    # Forward Authorization header if present.
    if 'Authorization' in request.headers:
        headers['Authorization'] = request.headers['Authorization']

    try:
        # SFI-B1.8: Không log request body để bảo mật.
        logger.info("Proxying %s %s -> %s", request.method, path, url)
        
        response = httpx.request(
            method=request.method,
            url=url,
            headers=headers,
            content=request.body,
            timeout=PROXY_TIMEOUT,
            follow_redirects=True,
        )
        
        # Build Django response.
        django_response = HttpResponse(
            content=response.content,
            status=response.status_code,
            content_type=response.headers.get('Content-Type')
        )
        
        # Forward relevant headers.
        for k, v in response.headers.items():
            if k.lower() not in ('content-length', 'transfer-encoding', 'connection'):
                django_response[k] = v
                
        return django_response

    except httpx.RequestError as exc:
        logger.error("Proxy request failed for %s: %s", url, exc)
        return HttpResponse(f"Legacy bridge connection failed: {exc}", status=502)
