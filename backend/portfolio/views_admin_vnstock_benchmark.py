from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from portfolio.vnstock_provider_benchmark import (
    get_latest_price_board_benchmark_report,
    run_price_board_provider_benchmark,
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
    """POST /api/admin-ops/vnstock-config/benchmark-price-board/run/"""
    try:
        report = run_price_board_provider_benchmark(request.data if isinstance(request.data, dict) else {})
    except Exception as exc:  # noqa: BLE001
        return Response(
            {
                'ok': False,
                'message': f'Benchmark thất bại: {exc}',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(
        {
            'ok': True,
            'report': report,
        },
        status=status.HTTP_200_OK,
    )
