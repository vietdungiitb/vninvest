from __future__ import annotations

import logging
from threading import Thread

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from portfolio.vnbroker_provider_benchmark import (
    get_latest_price_board_benchmark_report,
    run_price_board_provider_benchmark,
    set_latest_price_board_benchmark_report,
    _utc_now_iso,
)


logger = logging.getLogger(__name__)

_BENCHMARK_RUNNING_MAX_SECONDS = 15 * 60
_BENCHMARK_CELERY_MAX_QUEUE_DEPTH = 60


def _run_benchmark_background(payload: dict, base_report: dict) -> None:
    try:
        report = run_price_board_provider_benchmark(payload)
        report['status'] = report.get('status') or 'completed'
        report['execution_mode'] = base_report.get('execution_mode')
        report['task_id'] = base_report.get('task_id')
        set_latest_price_board_benchmark_report(report)
    except Exception as exc:  # noqa: BLE001
        logger.warning('benchmark background execution failed: %s', exc)
        failed_report = {
            **base_report,
            'status': 'failed',
            'finished_at': _utc_now_iso(),
            'results': [],
            'recommendation': None,
            'error': str(exc),
        }
        set_latest_price_board_benchmark_report(failed_report)


def _count_inspect_tasks(payload: dict | None) -> int:
    if not isinstance(payload, dict):
        return 0
    total = 0
    for tasks in payload.values():
        if isinstance(tasks, list):
            total += len(tasks)
    return total


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnbroker_price_board_benchmark_latest_api(request):
    """GET /api/admin-ops/vnbroker-config/benchmark-price-board/latest/"""
    try:
        report = get_latest_price_board_benchmark_report()
    except Exception as exc:  # noqa: BLE001
        logger.warning('admin_vnbroker_price_board_benchmark_latest_api: failed to load latest report: %s', exc)
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

    if str(report.get('status') or '').lower() == 'running':
        started_at_raw = str(report.get('started_at') or '').strip()
        started_at = parse_datetime(started_at_raw) if started_at_raw else None
        if started_at is not None:
            if timezone.is_naive(started_at):
                started_at = timezone.make_aware(started_at, timezone=timezone.utc)
            running_seconds = max((timezone.now() - started_at).total_seconds(), 0)
            report['running_seconds'] = int(running_seconds)
            if running_seconds > _BENCHMARK_RUNNING_MAX_SECONDS:
                report = {
                    **report,
                    'status': 'failed',
                    'finished_at': _utc_now_iso(),
                    'error': 'Benchmark chạy quá lâu do worker nghẽn. Vui lòng thử lại.',
                }
                set_latest_price_board_benchmark_report(report)

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
def admin_vnbroker_price_board_benchmark_run_api(request):
    """POST /api/admin-ops/vnbroker-config/benchmark-price-board/run/

    Dispatch benchmark sang Celery để tránh gateway timeout (tác vụ có thể chạy vài phút).
    Client poll GET /latest/ để lấy kết quả khi hoàn tất.
    """
    from config.celery import app as celery_app
    from portfolio.tasks_maintenance import run_vnbroker_price_board_benchmark

    payload = request.data if isinstance(request.data, dict) else {}

    base_report = {
        'status': 'running',
        'started_at': _utc_now_iso(),
        'finished_at': None,
        'results': [],
        'recommendation': None,
        'payload': payload,
    }

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

        active_count = _count_inspect_tasks(inspect.active())
        reserved_count = _count_inspect_tasks(inspect.reserved())
        queue_depth = active_count + reserved_count

        if queue_depth >= _BENCHMARK_CELERY_MAX_QUEUE_DEPTH:
            base_report['execution_mode'] = 'local_thread'
            set_latest_price_board_benchmark_report(base_report)
            Thread(
                target=_run_benchmark_background,
                args=(payload, base_report),
                daemon=True,
            ).start()
            return Response(
                {
                    'ok': True,
                    'status': 'started',
                    'mode': 'local_thread',
                    'message': 'Worker đang nghẽn, benchmark chạy bằng luồng nền nội bộ để tránh treo hàng đợi.',
                },
                status=status.HTTP_202_ACCEPTED,
            )
    except Exception:
        base_report['execution_mode'] = 'local_thread'
        set_latest_price_board_benchmark_report(base_report)
        Thread(
            target=_run_benchmark_background,
            args=(payload, base_report),
            daemon=True,
        ).start()
        return Response(
            {
                'ok': True,
                'status': 'started',
                'mode': 'local_thread',
                'message': 'Không kiểm tra được hàng đợi Celery. Đã chuyển sang benchmark nền nội bộ.',
            },
            status=status.HTTP_202_ACCEPTED,
        )

    task = run_vnbroker_price_board_benchmark.apply_async(kwargs={'payload': payload}, queue='manual_on_demand')
    base_report['execution_mode'] = 'celery'
    base_report['task_id'] = str(task.id)
    set_latest_price_board_benchmark_report(base_report)
    return Response(
        {
            'ok': True,
            'status': 'started',
            'task_id': str(task.id),
            'mode': 'celery',
            'message': 'Benchmark đã được khởi động. Vui lòng đợi và reload kết quả sau vài giây.',
        },
        status=status.HTTP_202_ACCEPTED,
    )
