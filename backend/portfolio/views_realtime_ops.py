from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .services_realtime_metrics import build_prometheus_metrics_text, build_realtime_metrics_snapshot
from .throttles import RealtimeOpsMetricsRateThrottle


@api_view(['GET'])
@permission_classes([IsAuthenticated])
@throttle_classes([RealtimeOpsMetricsRateThrottle])
def realtime_metrics_ops_api(request):
    """
    GET /api/realtime/ops/metrics/
    Staff-only operational endpoint for realtime observability metrics.

    Query params:
    - output=json (default)
    - output=prometheus
    """
    if not bool(getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)):
        return Response(
            {
                'ok': False,
                'message': 'Ban khong co quyen truy cap metrics van hanh.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    output_format = str(request.query_params.get('output') or 'json').strip().lower()
    if output_format == 'prometheus':
        content = build_prometheus_metrics_text()
        return HttpResponse(content, content_type='text/plain; version=0.0.4; charset=utf-8')

    snapshot = build_realtime_metrics_snapshot()
    return Response(
        {
            'ok': True,
            'metrics': snapshot,
        },
        status=status.HTTP_200_OK,
    )
