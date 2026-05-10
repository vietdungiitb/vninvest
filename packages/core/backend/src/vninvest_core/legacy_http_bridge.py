from __future__ import annotations

from copy import deepcopy
from typing import Any

from django.conf import settings
import httpx
from rest_framework import status
from rest_framework.response import Response


LEGACY_HTTP_BRIDGE_TIMEOUT = httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0)


def legacy_bridge_enabled() -> bool:
    return bool(str(getattr(settings, 'LEGACY_BACKEND_URL', '') or '').strip())


def _normalized_bridge_payload(payload: Any) -> Any:
    if payload is None:
        return None
    if hasattr(payload, 'dict') and callable(payload.dict):
        try:
            return payload.dict()
        except TypeError:
            return payload
    if isinstance(payload, (dict, list)):
        return deepcopy(payload)
    return payload


def build_legacy_bridge_headers(request, *, bridge_name: str = 'core-api') -> dict[str, str]:
    headers = {
        'Accept': 'application/json',
        'X-Legacy-Bridge': bridge_name,
    }
    request_host = ''
    try:
        request_host = str(request.get_host() or '').strip()
    except Exception:
        request_host = str(request.META.get('HTTP_HOST') or '').strip()
    if request_host:
        headers['Host'] = request_host
        headers['X-Forwarded-Host'] = request_host
    authorization = str(request.META.get('HTTP_AUTHORIZATION') or '').strip()
    if authorization:
        headers['Authorization'] = authorization
    return headers


def legacy_bridge_response(
    request,
    legacy_path: str,
    *,
    bridge_name: str = 'core-api',
    timeout: httpx.Timeout | None = None,
    unavailable_message: str | None = None,
) -> Response | None:
    base_url = str(getattr(settings, 'LEGACY_BACKEND_URL', '') or '').strip().rstrip('/')
    if not base_url:
        return None

    payload = _normalized_bridge_payload(request.data) if request.method.upper() in {'POST', 'PUT', 'PATCH'} else None
    params = request.query_params.dict() if hasattr(request.query_params, 'dict') else dict(request.query_params)
    url = f'{base_url}{legacy_path}'

    try:
        upstream_response = httpx.request(
            method=request.method.upper(),
            url=url,
            headers=build_legacy_bridge_headers(request, bridge_name=bridge_name),
            params=params,
            json=payload,
            timeout=timeout or LEGACY_HTTP_BRIDGE_TIMEOUT,
        )
    except httpx.RequestError as exc:
        return Response(
            {
                'ok': False,
                'status': 'bridge_unavailable',
                'message': unavailable_message or 'Legacy bridge hiện không khả dụng.',
                'detail': str(exc),
                'bridge': {
                    'enabled': True,
                    'url': url,
                },
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if upstream_response.status_code == status.HTTP_204_NO_CONTENT or not upstream_response.content:
        return Response(status=upstream_response.status_code)

    try:
        response_payload = upstream_response.json()
    except ValueError:
        response_payload = {
            'ok': upstream_response.is_success,
            'status': 'bridge_response',
            'detail': upstream_response.text,
        }

    return Response(response_payload, status=upstream_response.status_code)