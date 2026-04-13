from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone

from portfolio.observability import get_market_observability_snapshot


def build_prefetch_health_snapshot():
    result = {
        "cache_backend": settings.CACHES["default"]["BACKEND"],
        "cache_location": settings.CACHES["default"].get("LOCATION"),
        "healthy": False,
        "status": "unknown",
        "reason": None,
        "meta_present": False,
        "freshness_seconds": None,
        "sample_cache_hits": 0,
        "sample_cache_total": 0,
        "prefetch": None,
    }

    try:
        meta = cache.get('ticker:prefetch:meta')
    except Exception as exc:
        result["error"] = str(exc)
        return result

    if not meta:
        # No prefetch metadata yet should be considered idle, not degraded.
        result["healthy"] = True
        result["status"] = "idle"
        result["reason"] = "no_prefetch_meta_yet"
        return result

    result["meta_present"] = True
    result["prefetch"] = meta
    prefetch_status = str(meta.get('status') or '').strip().lower()
    result["status"] = prefetch_status or "unknown"

    generated_at = meta.get('generated_at')
    if generated_at:
        try:
            generated_dt = timezone.datetime.fromisoformat(str(generated_at))
            if timezone.is_naive(generated_dt):
                generated_dt = timezone.make_aware(generated_dt, timezone.get_current_timezone())
            result["freshness_seconds"] = max(int((timezone.now() - generated_dt).total_seconds()), 0)
        except Exception:
            result["freshness_seconds"] = None

    sample_symbols = meta.get('sample_symbols') or []
    sample_hits = 0
    for symbol in sample_symbols:
        try:
            if cache.get(f'ticker:{symbol}') is not None:
                sample_hits += 1
        except Exception:
            break

    result["sample_cache_hits"] = sample_hits
    result["sample_cache_total"] = len(sample_symbols)

    freshness_ok = result["freshness_seconds"] is None or result["freshness_seconds"] <= 90
    query_enabled = bool((meta.get('policy') or {}).get('query_enabled', True))
    symbol_count = int(meta.get('symbols') or 0)

    # Prefetch can be intentionally idle (offhours policy / no symbol set).
    if prefetch_status in {'throttled_by_policy'} or not query_enabled:
        result["healthy"] = True
        result["reason"] = "policy_throttled"
        return result

    if prefetch_status == 'ok' and symbol_count == 0:
        result["healthy"] = True
        result["reason"] = "no_symbols_to_prefetch"
        return result

    if prefetch_status == 'ok':
        has_sample = len(sample_symbols) == 0 or sample_hits > 0
        result["healthy"] = bool(freshness_ok and has_sample)
        if not freshness_ok:
            result["reason"] = "stale_prefetch_meta"
        elif not has_sample:
            result["reason"] = "sample_cache_miss"
        else:
            result["reason"] = "ok"
        return result

    result["healthy"] = False
    result["reason"] = prefetch_status or "unknown_prefetch_status"
    return result


def healthcheck(request):
    return JsonResponse({"status": "ok", "service": "vninvest-backend"})


def realtime_health(request):
    """
    Trả về trạng thái realtime layer: loại channel layer, enabled flag,
    và kết quả ping Redis nếu đang dùng redis backend.
    Public endpoint (không cần auth) để frontend hiển thị observability badge.
    """
    channel_layer_type = getattr(settings, "REALTIME_CHANNEL_LAYER", "redis")
    realtime_enabled = getattr(settings, "REALTIME_ENABLED", False)

    result = {
        "channel_layer_type": channel_layer_type,
        "realtime_enabled": realtime_enabled,
        "redis_ok": None,
    }

    if channel_layer_type != "inmemory":
        try:
            import redis as redis_lib
            redis_url = getattr(settings, "REALTIME_REDIS_URL", "redis://localhost:6379/0")
            client = redis_lib.from_url(redis_url, socket_connect_timeout=1)
            client.ping()
            result["redis_ok"] = True
        except Exception:
            result["redis_ok"] = False

    return JsonResponse(result)


def streams_health(request):
    """
    GET /health/streams/
    Trả về trạng thái Redis Streams: ping, độ dài stream mỗi symbol.
    Public endpoint không cần auth (chỉ dùng nội bộ / observability).
    """
    result = {
        "stream_redis_url": getattr(settings, "STREAM_REDIS_URL", "redis://localhost:6379/1"),
        "redis_ok": False,
        "symbols": {},
        "total_ticks": 0,
    }

    try:
        import redis as redis_lib
        stream_url = getattr(settings, "STREAM_REDIS_URL", "redis://localhost:6379/1")
        client = redis_lib.from_url(stream_url, socket_connect_timeout=1, decode_responses=True)
        client.ping()
        result["redis_ok"] = True
    except Exception as exc:
        result["error"] = str(exc)
        return JsonResponse(result, status=503)

    # Liệt kê tất cả stream keys
    try:
        keys = client.keys("vninvest:ticks:*")
        total = 0
        for key in sorted(keys):
            symbol = key.replace("vninvest:ticks:", "")
            length = client.xlen(key)
            total += length
            result["symbols"][symbol] = {"stream_key": key, "tick_count": length}
        result["total_ticks"] = total
    except Exception as exc:
        result["scan_error"] = str(exc)

    return JsonResponse(result)


def prefetch_health(request):
    """
    GET /api/health/prefetch/
    Trả về trạng thái ticker prefetch: metadata lần chạy gần nhất,
    độ tươi của cache và số sample key còn đọc được từ shared cache.
    """
    snapshot = build_prefetch_health_snapshot()
    return JsonResponse(snapshot, status=200 if snapshot.get('healthy') else 503)


def market_observability_health(request):
    """
    GET /api/health/market-observability/
    Trả về snapshot p95/5xx/fallback/external-timeout cho market hot-path.
    """
    snapshot = get_market_observability_snapshot()
    return JsonResponse(snapshot)

