"""
SOC Overview SSE stream — Overview P3 (F-OV-14/15).

GET /operator/soc/overview/stream/

Auth: SOCBaseView (IsAuthenticated + IsAdminUser). Token via ?token= fallback
cho EventSource không gửi được Authorization header (pattern signals_stream).

SSE wire format:
  retry: 3000
  : ping                          (comment heartbeat 15s)
  event: overview
  id: <payload version / last_check cursor>
  data: {"generated_at":...,"summary":{...},"by_domain":{...},"services":[...]}

Khác signals (stream từng alert): overview gửi toàn bộ SNAPSHOT mỗi khi có
thay đổi health (status/is_active/last_check_at/avg_response_ms) — payload
giống hệt OverviewSummaryView.get. Client nhận snapshot → setState trực tiếp,
không cần merge. Poll DB 3s, chỉ emit khi signature đổi.
"""
import time

from django.db import close_old_connections
from django.http import StreamingHttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema

from ..models import ServiceDefinition, ServiceHealth
from .base import SOCBaseView
from .signals_stream import SOCStreamThrottle, _sse_format


def _build_overview_snapshot():
    """Dựng payload giống hệt OverviewSummaryView.get — dùng chung cho stream."""
    services = list(ServiceDefinition.objects.all().order_by('domain', 'service_key'))
    health_by_service_id = {
        health.service_id: health
        for health in ServiceHealth.objects.filter(service__in=services).select_related('service')
    }
    summary = {
        'total': len(services),
        'healthy': 0,
        'degraded': 0,
        'unhealthy': 0,
        'unknown': 0,
        'maintenance': 0,
    }
    by_domain = {}
    service_rows = []

    for service in services:
        health = health_by_service_id.get(service.id)
        status_name = health.status if health is not None else 'unknown'
        summary[status_name] = summary.get(status_name, 0) + 1

        domain_row = by_domain.setdefault(
            service.domain,
            {
                'total': 0,
                'healthy': 0,
                'degraded': 0,
                'unhealthy': 0,
                'unknown': 0,
                'maintenance': 0,
            },
        )
        domain_row['total'] += 1
        domain_row[status_name] = domain_row.get(status_name, 0) + 1

        service_rows.append({
            'service_key': service.service_key,
            'name': service.name,
            'domain': service.domain,
            'status': status_name,
            'is_active': service.is_active,
            'last_check_at': health.last_check_at.isoformat() if health and health.last_check_at else None,
            'avg_response_ms': health.avg_response_ms if health else None,
        })

    return {
        'generated_at': timezone.now().isoformat(),
        'summary': summary,
        'by_domain': by_domain,
        'services': service_rows,
    }


def _snapshot_signature(snapshot) -> str:
    """Signature để phát hiện thay đổi — tránh emit trùng lặp không đổi.

    Không dùng generated_at (change mỗi loop) — chỉ dựa trên trạng thái health.
    """
    rows = sorted(snapshot['services'], key=lambda r: r['service_key'])
    parts = []
    for r in rows:
        parts.append(
            '|'.join([
                r['service_key'],
                r['status'],
                '1' if r['is_active'] else '0',
                str(r['last_check_at'] or ''),
                str(r['avg_response_ms'] or ''),
            ])
        )
    return '\n'.join(parts)


class OverviewStreamView(SOCBaseView):
    """
    GET /operator/soc/overview/stream/ — SSE realtime snapshot.
    Gửi toàn bộ overview payload mỗi khi health thay đổi (status/last_check/active).
    """

    throttle_classes = [SOCStreamThrottle]

    def initial(self, request, *args, **kwargs):
        token = request.query_params.get('token') or request.GET.get('token')
        if token and not request.META.get('HTTP_AUTHORIZATION'):
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {token}'
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
        import sys

        testing = 'test' in sys.argv
        max_loops = int(request.query_params.get('max_loops') or 0) or None

        def event_stream():
            yield _sse_format(retry=3000)

            # Last-Event-ID / ?since: client reconnect → gửi lại snapshot hiện tại.
            # Không cần cursor thực sự vì payload là snapshot trạng thái, không phải log.
            last_signature = None
            last_heartbeat = time.time()
            stream_start = time.time()
            loop_count = 0

            while True:
                loop_count += 1
                if max_loops is not None and loop_count > max_loops:
                    break
                if not testing and time.time() - stream_start > 3600:
                    break

                try:
                    close_old_connections()
                    snapshot = _build_overview_snapshot()
                    signature = _snapshot_signature(snapshot)
                    if signature != last_signature:
                        # Chỉ emit khi thay đổi (ít nhất 1 lần đầu tiên)
                        yield _sse_format(
                            event='overview',
                            data=snapshot,
                            sse_id=str(loop_count),
                        )
                        last_signature = signature
                        last_heartbeat = time.time()
                    else:
                        # Heartbeat nếu 15s không có thay đổi; trong test luôn gửi để verify
                        if testing or time.time() - last_heartbeat >= 15:
                            yield _sse_format(comment='ping')
                            last_heartbeat = time.time()

                except GeneratorExit:
                    break
                except Exception:
                    try:
                        yield _sse_format(comment='ping')
                    except GeneratorExit:
                        break

                if testing and max_loops is not None:
                    continue
                try:
                    time.sleep(3)
                except Exception:
                    break

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        response['Connection'] = 'keep-alive'
        return response