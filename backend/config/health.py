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

