from datetime import date
import time

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import IsProPlan
from .services_whale_analytics_snapshot import (
    build_snapshot_etag,
    build_whale_analytics_snapshot,
    _parse_trade_date,
    _resolve_whale_analytics_cache_revision,
)


def _resolve_cache_control(payload: dict) -> str:
    now_vn = timezone.localtime()
    today_vn = now_vn.date()
    payload_trade_date = payload.get('trade_date')
    try:
        trade_date = date.fromisoformat(str(payload_trade_date)) if payload_trade_date else None
    except ValueError:
        trade_date = None

    data_state = str((payload.get('meta') or {}).get('data_state') or '').strip().lower()
    if data_state == 'live':
        return 'private, max-age=5, stale-while-revalidate=25'
    if trade_date == today_vn:
        return 'private, max-age=60, stale-while-revalidate=300'
    return 'private, max-age=900, stale-while-revalidate=3600'


def _resolve_snapshot_cache_timeout(payload: dict) -> int:
    data_state = str((payload.get('meta') or {}).get('data_state') or '').strip().lower()
    if data_state == 'live':
        return 5

    now_vn = timezone.localtime()
    today_vn = now_vn.date()
    payload_trade_date = payload.get('trade_date')
    try:
        trade_date = date.fromisoformat(str(payload_trade_date)) if payload_trade_date else None
    except ValueError:
        trade_date = None

    if trade_date == today_vn:
        return 60
    return 900


def _build_snapshot_cache_key(*, user, symbol: str, timeframe: str, compact: bool, trade_date, include_baseline: bool = True, cache_revision: str | None = None) -> str:
    trade_date_key = trade_date.isoformat() if trade_date else 'auto'
    revision_key = _resolve_whale_analytics_cache_revision(symbol=symbol, cache_revision=cache_revision)
    return f'whale:analytics:v5:{revision_key}:{user.id}:{symbol}:{trade_date_key}:{timeframe}:{1 if compact else 0}:{1 if include_baseline else 0}'


def _build_snapshot_lock_key(cache_key: str) -> str:
    return f'{cache_key}:lock'


def _get_or_build_snapshot_payload(*, request, symbol: str, timeframe: str, compact: bool, trade_date, include_baseline: bool):
    cache_revision = _resolve_whale_analytics_cache_revision(symbol=symbol)
    cache_key = _build_snapshot_cache_key(
        user=request.user,
        symbol=symbol,
        timeframe=timeframe,
        compact=compact,
        trade_date=trade_date,
        include_baseline=include_baseline,
        cache_revision=cache_revision,
    )
    payload = cache.get(cache_key)
    if payload is not None:
        return payload

    lock_key = _build_snapshot_lock_key(cache_key)
    lock_timeout = 15
    wait_attempts = 4
    wait_seconds = 0.05

    if cache.add(lock_key, 1, timeout=lock_timeout):
        try:
            payload = cache.get(cache_key)
            if payload is not None:
                return payload

            payload = build_whale_analytics_snapshot(
                user=request.user,
                symbol=symbol,
                timeframe=timeframe,
                compact=compact,
                trade_date=trade_date,
                include_baseline=include_baseline,
                cache_revision=cache_revision,
            )
            cache.set(cache_key, payload, timeout=_resolve_snapshot_cache_timeout(payload))
            return payload
        finally:
            try:
                cache.delete(lock_key)
            except Exception:
                pass

    for _ in range(wait_attempts):
        time.sleep(wait_seconds)
        payload = cache.get(cache_key)
        if payload is not None:
            return payload

    payload = build_whale_analytics_snapshot(
        user=request.user,
        symbol=symbol,
        timeframe=timeframe,
        compact=compact,
        trade_date=trade_date,
        include_baseline=include_baseline,
    )
    cache.set(cache_key, payload, timeout=_resolve_snapshot_cache_timeout(payload))
    return payload


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_analytics_snapshot_api(request, symbol: str):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or len(normalized_symbol) > 10 or not normalized_symbol.isalpha():
        return Response({'ok': False, 'error': 'Invalid symbol format'}, status=status.HTTP_400_BAD_REQUEST)

    timeframe = str(request.query_params.get('timeframe', 'session')).strip().lower()
    compact = str(request.query_params.get('compact', '1')).strip() != '0'
    include_baseline = str(request.query_params.get('include_baseline', '1')).strip() != '0'
    trade_date = _parse_trade_date(request.query_params.get('trade_date'))
    payload = _get_or_build_snapshot_payload(
        request=request,
        symbol=normalized_symbol,
        timeframe=timeframe,
        compact=compact,
        trade_date=trade_date,
        include_baseline=include_baseline,
    )
    etag = build_snapshot_etag(payload)
    quoted_etag = f'"{etag}"'
    cache_control = _resolve_cache_control(payload)
    if_none_match = str(
        request.headers.get('If-None-Match')
        or request.META.get('HTTP_IF_NONE_MATCH')
        or ''
    ).strip()
    if if_none_match == quoted_etag:
        response = Response(status=status.HTTP_304_NOT_MODIFIED)
        response['ETag'] = quoted_etag
        response['Last-Modified'] = payload['meta']['generated_at']
        response['Cache-Control'] = cache_control
        return response

    response = Response(payload, status=status.HTTP_200_OK)
    response['ETag'] = quoted_etag
    response['Last-Modified'] = payload['meta']['generated_at']
    response['Cache-Control'] = cache_control
    return response
