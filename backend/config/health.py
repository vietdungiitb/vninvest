from django.conf import settings
from django.http import JsonResponse


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

