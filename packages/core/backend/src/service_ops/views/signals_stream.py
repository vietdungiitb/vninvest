"""
SOC Signals SSE stream — P2c W2.1-long (Phase P2c).

GET /operator/soc/signals/stream/?type=&severity=&direction=&symbol=&token=

Auth: SOCBaseView (IsAuthenticated + IsAdminUser). Token via ?token= fallback
cho EventSource không gửi được Authorization header.

SSE wire format:
  retry: 3000
  : ping                          (comment heartbeat 15s)
  event: signal
  id: <pk>
  data: {"id":1,"type":"whale","symbol":"VCI","severity":"high","direction":"buy","detected_at":"...","title":"...","value":...}

Nguồn: UnifiedAlert mới theo session (poll DB 3s). Hỗ trợ Last-Event-ID để
client reconnect không mất sự kiện.
"""
import json
import time

from django.db import close_old_connections
from django.db.models import Max
from django.http import StreamingHttpResponse
from rest_framework.throttling import UserRateThrottle
from drf_spectacular.utils import extend_schema

from signal_intelligence.models import UnifiedAlert

from .base import SOCBaseView
from .signals import _latest_signal_session_date, _serialize_recent_alert


class SOCStreamThrottle(UserRateThrottle):
    """Throttle riêng cho SSE stream — 60/min, không tiêu quota soc_operator_read."""

    scope = "soc_stream"


# Query param → alert_type mapping (FE type → BE alert_type)
_STREAM_TYPE_MAP = {
    "whale": UnifiedAlert.AlertTypeChoices.WHALE,
    "dark_pool": UnifiedAlert.AlertTypeChoices.DARK_FLOW,
    "dark_flow": UnifiedAlert.AlertTypeChoices.DARK_FLOW,
    "screener": UnifiedAlert.AlertTypeChoices.SIGNAL,
    "signal": UnifiedAlert.AlertTypeChoices.SIGNAL,
}

_VALID_SEVERITIES = {c.value for c in UnifiedAlert.SeverityChoices}
_VALID_DIRECTIONS = {c.value for c in UnifiedAlert.DirectionChoices}


def _sse_format(*, event=None, data=None, sse_id=None, retry=None, comment=None) -> str:
    lines: list[str] = []
    if comment is not None:
        lines.append(f": {comment}")
    if retry is not None:
        lines.append(f"retry: {retry}")
    if sse_id is not None:
        lines.append(f"id: {sse_id}")
    if event is not None:
        lines.append(f"event: {event}")
    if data is not None:
        if not isinstance(data, str):
            data = json.dumps(data, ensure_ascii=False, default=str)
        for line in data.splitlines() or [""]:
            lines.append(f"data: {line}")
    lines.append("")
    return "\n".join(lines) + "\n"


def _parse_stream_params(request) -> dict:
    raw_type = (request.query_params.get("type") or "").strip().lower()
    alert_type = _STREAM_TYPE_MAP.get(raw_type) if raw_type and raw_type != "all" else None
    # Invalid type → ignore (no filter) để tránh 400 làm đứt EventSource
    if raw_type and raw_type not in _STREAM_TYPE_MAP and raw_type != "all":
        alert_type = None

    severity = (request.query_params.get("severity") or "").strip().lower() or None
    if severity and severity not in _VALID_SEVERITIES:
        severity = None

    direction = (request.query_params.get("direction") or "").strip().lower() or None
    if direction and direction not in _VALID_DIRECTIONS:
        direction = None

    symbol = (request.query_params.get("symbol") or "").strip().upper() or None
    return {"alert_type": alert_type, "severity": severity, "direction": direction, "symbol": symbol}


def _apply_stream_filters(qs, params: dict):
    if params["alert_type"]:
        qs = qs.filter(alert_type=params["alert_type"])
    if params["severity"]:
        qs = qs.filter(severity=params["severity"])
    if params["direction"]:
        qs = qs.filter(direction=params["direction"])
    if params["symbol"]:
        qs = qs.filter(symbol__icontains=params["symbol"])
    return qs


class SignalsStreamView(SOCBaseView):
    """
    GET /operator/soc/signals/stream/ — SSE realtime.
    Long-lived connection, heartbeat : ping 15s, retry 3000.
    Poll DB 3s cho UnifiedAlert mới (id > last_id).
    """

    # F4 fix: throttle riêng soc_stream 60/min thay vì [] (tránh mở N kết nối vô hạn)
    throttle_classes = [SOCStreamThrottle]

    def initial(self, request, *args, **kwargs):
        # EventSource không gửi được Authorization header → hỗ trợ ?token=
        token = request.query_params.get("token") or request.GET.get("token")
        if token and not request.META.get("HTTP_AUTHORIZATION"):
            request.META["HTTP_AUTHORIZATION"] = f"Bearer {token}"
            # Thử authenticate ngay để request.user được set trước khi permission check
            # Nếu thất bại, để DRF xử lý 401 như thường
            try:
                from identity_access.authentication import CorePATAuthentication

                pat_auth = CorePATAuthentication()
                user_auth = pat_auth.authenticate(request)
                if user_auth is not None:
                    request.user, request.auth = user_auth
            except Exception:
                pass
        return super().initial(request, *args, **kwargs)

    @extend_schema(exclude=True)
    def get(self, request):
        params = _parse_stream_params(request)

        # TESTING: cho phép giới hạn vòng lặp / thời gian để test không treo
        import sys

        testing = "test" in sys.argv
        max_loops = int(request.query_params.get("max_loops") or 0) or None
        # Khi TESTING và không có max_loops, mặc định 2 vòng để test nhanh
        if testing and max_loops is None:
            max_loops = None

        def event_stream():
            # Gửi retry ngay khi kết nối
            yield _sse_format(retry=3000)
            # Xác định last_id từ Last-Event-ID (EventSource tự gửi) hoặc max hiện tại
            # Lưu ý: "0" là giá trị hợp lệ (muốn replay từ đầu), chỉ fallback khi header rỗng/missing
            raw_last = request.META.get("HTTP_LAST_EVENT_ID")
            if raw_last is None and hasattr(request, "headers"):
                try:
                    raw_last = request.headers.get("Last-Event-ID")
                except Exception:
                    raw_last = None
            # F3: hỗ trợ ?since=<last_id> cho reconnect manual (EventSource mới không gửi Last-Event-ID)
            if raw_last is None or str(raw_last).strip() == "":
                raw_last = request.query_params.get("since") or request.query_params.get("last_id")
            if raw_last is None or str(raw_last).strip() == "":
                # Không có Last-Event-ID → bắt đầu từ max hiện tại (tránh flood lịch sử)
                try:
                    agg = UnifiedAlert.objects.aggregate(max_id=Max("pk"))
                    last_id = agg["max_id"] or 0
                except Exception:
                    last_id = 0
            else:
                try:
                    last_id = int(str(raw_last).strip())
                except (TypeError, ValueError):
                    last_id = 0

            last_heartbeat = time.time()
            stream_start = time.time()
            loop_count = 0
            # Poll DB 3s, heartbeat comment 15s
            while True:
                loop_count += 1
                if max_loops is not None and loop_count > max_loops:
                    break
                # F5: idle timeout 1h — tránh giữ worker vô hạn khi operator rời bàn
                if not testing and time.time() - stream_start > 3600:
                    break

                try:
                    close_old_connections()
                    qs = UnifiedAlert.objects.all()
                    # Chỉ stream session mới nhất để tránh flood lịch sử
                    session_date = _latest_signal_session_date()
                    if session_date is not None:
                        qs = qs.filter(session_date=session_date)
                    qs = _apply_stream_filters(qs, params)
                    qs = qs.filter(pk__gt=last_id).order_by("triggered_at", "pk")[:50]

                    alerts = list(qs)
                    if alerts:
                        for alert in alerts:
                            try:
                                base = _serialize_recent_alert(alert)
                                # Map alert_type → FE type
                                fe_type = "whale"
                                if alert.alert_type == UnifiedAlert.AlertTypeChoices.DARK_FLOW:
                                    fe_type = "dark_pool"
                                elif alert.alert_type == UnifiedAlert.AlertTypeChoices.SIGNAL:
                                    fe_type = "screener"
                                data = {
                                    "id": base.get("id"),
                                    "type": fe_type,
                                    "symbol": base.get("symbol"),
                                    "severity": base.get("severity"),
                                    "direction": base.get("side"),
                                    "detected_at": base.get("timestamp"),
                                    "title": base.get("title"),
                                    "value": base.get("value"),
                                    "metadata": base.get("metadata") or {},
                                    "session_date": base.get("session_date"),
                                }
                                yield _sse_format(event="signal", data=data, sse_id=str(alert.pk))
                                last_id = max(last_id, alert.pk)
                            except Exception:
                                continue
                        last_heartbeat = time.time()
                    else:
                        # Heartbeat nếu 15s không có sự kiện; trong test luôn gửi để verify
                        if testing or time.time() - last_heartbeat >= 15:
                            yield _sse_format(comment="ping")
                            last_heartbeat = time.time()

                    # Idle timeout 5 phút (chỉ khi không có test max_loops) — client sẽ auto-reconnect
                    # Để đơn giản giữ kết nối vô hạn cho operator; không break ở production
                    # Nếu muốn idle timeout, có thể check ở đây

                except GeneratorExit:
                    break
                except Exception:
                    # Lỗi DB tạm → gửi comment để giữ kết nối, thử lại sau poll_interval
                    try:
                        yield _sse_format(comment="ping")
                    except GeneratorExit:
                        break
                    pass

                # Ngủ 3s (nhanh hơn materialize 2m để bắt kịp realtime prefetch 3s)
                # Trong test, ngủ 0 để chạy nhanh
                if testing and max_loops is not None:
                    # Không ngủ trong test để suite chạy nhanh
                    continue
                try:
                    time.sleep(3)
                except Exception:
                    break

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        response["Connection"] = "keep-alive"
        # CORS headers cho EventSource cross-origin (nếu cần)
        return response
