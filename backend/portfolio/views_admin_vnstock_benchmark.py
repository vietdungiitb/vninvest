from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from portfolio.vnstock_provider_benchmark import (
    get_latest_price_board_benchmark_report,
)


logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnstock_price_board_benchmark_latest_api(request):
    """GET /api/admin-ops/vnstock-config/benchmark-price-board/latest/"""
    try:
        report = get_latest_price_board_benchmark_report()
    except Exception as exc:  # noqa: BLE001
        logger.warning('admin_vnstock_price_board_benchmark_latest_api: failed to load latest report: %s', exc)
        return Response(
            {
                'ok': False,
                'has_report': False,
                'status': 'temporarily_unavailable',
                'message': 'Tạm thời chưa đọc được dữ liệu benchmark gần nhất. Vui lòng thử lại sau vài giây.',
            },
            status=status.HTTP_200_OK,
        )

    if report is None:
        return Response(
            {
                'ok': True,
                'has_report': False,
                'message': 'Chưa có dữ liệu benchmark gần nhất.',
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            'ok': True,
            'has_report': True,
            'report': report,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_vnstock_price_board_benchmark_run_api(request):
    """POST /api/admin-ops/vnstock-config/benchmark-price-board/run/

    Dispatch benchmark sang Celery để tránh gateway timeout (tác vụ có thể chạy vài phút).
    Client poll GET /latest/ để lấy kết quả khi hoàn tất.
    """
    from config.celery import app as celery_app
    from portfolio.tasks_maintenance import run_vnstock_price_board_benchmark

    payload = request.data if isinstance(request.data, dict) else {}

    # Fail fast when Celery worker is not alive to avoid frontend waiting until timeout.
    try:
        inspect = celery_app.control.inspect(timeout=1.5)
        ping_result = inspect.ping()
        if not ping_result:
            return Response(
                {
                    'ok': False,
                    'status': 'worker_unavailable',
                    'message': 'Celery worker đang offline. Không thể chạy benchmark nền lúc này.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
    except Exception:
        return Response(
            {
                'ok': False,
                'status': 'worker_unavailable',
                'message': 'Không kiểm tra được trạng thái Celery worker. Vui lòng thử lại sau.',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    task = run_vnstock_price_board_benchmark.apply_async(kwargs={'payload': payload})
    return Response(
        {
            'ok': True,
            'status': 'started',
            'task_id': str(task.id),
            'message': 'Benchmark đã được khởi động. Vui lòng đợi và reload kết quả sau vài giây.',
        },
        status=status.HTTP_202_ACCEPTED,
    )
