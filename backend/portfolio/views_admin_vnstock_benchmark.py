from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from portfolio.vnstock_provider_benchmark import (
    get_latest_price_board_benchmark_report,
)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnstock_price_board_benchmark_latest_api(request):
    """GET /api/admin-ops/vnstock-config/benchmark-price-board/latest/"""
    report = get_latest_price_board_benchmark_report()
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
    from portfolio.tasks_maintenance import run_vnstock_price_board_benchmark

    payload = request.data if isinstance(request.data, dict) else {}
    run_vnstock_price_board_benchmark.apply_async(kwargs={'payload': payload})
    return Response(
        {
            'ok': True,
            'status': 'started',
            'message': 'Benchmark đã được khởi động. Vui lòng đợi và reload kết quả sau vài giây.',
        },
        status=status.HTTP_202_ACCEPTED,
    )
