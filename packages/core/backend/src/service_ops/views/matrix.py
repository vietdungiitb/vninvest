"""Matrix domain views for the SOC symbol universe matrix."""

from __future__ import annotations

from django.db.models import Count
from rest_framework import status
from rest_framework.response import Response

from ..matrix_coordinator import (
    DEFAULT_MATRIX_PROVIDERS,
    DEFAULT_SYMBOL_GROUPS,
    MatrixCoordinator,
    generate_cycle_id,
    get_latest_monitor_cycle,
    normalize_provider_list,
    normalize_symbol_group_ids,
)
from ..models import ScrapeMatrix, ScrapeMatrixCell
from ..provider_catalog import (
    find_unsupported_provider_ids,
    get_unready_provider_messages,
    list_provider_statuses,
)
from ..serializers import ScrapeMatrixCellSerializer, ScrapeMatrixSerializer
from ..tasks import run_scrape_cycle
from ..views.base import SOCBaseView


def _serialize_cells_summary(matrix: ScrapeMatrix) -> dict:
    counts = {
        row['status']: row['count']
        for row in matrix.cells.values('status').annotate(count=Count('id')).order_by('status')
    }
    return {
        'pending': counts.get('pending', 0),
        'claimed': counts.get('claimed', 0),
        'working': counts.get('working', 0),
        'done': counts.get('done', 0),
        'failed': counts.get('failed', 0),
        'skipped': counts.get('skipped', 0),
    }


def _serialize_cycle_detail(matrix: ScrapeMatrix) -> dict:
    data = ScrapeMatrixSerializer(matrix).data
    data['cells_summary'] = _serialize_cells_summary(matrix)
    cells = ScrapeMatrixCellSerializer(matrix.cells.order_by('symbol_group_id', 'provider'), many=True).data
    data['cells'] = cells
    data['symbol_groups'] = [
        {'id': group_id, 'name': group_id.replace('_', ' ').title()}
        for group_id in sorted({cell['symbol_group_id'] for cell in cells})
    ] or list(DEFAULT_SYMBOL_GROUPS)
    return data


class MatrixCycleListView(SOCBaseView):
    """GET /api/soc/matrix/cycles/"""

    def get(self, request):
        queryset = ScrapeMatrix.objects.all().order_by('-started_at')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            serializer = ScrapeMatrixSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(ScrapeMatrixSerializer(queryset, many=True).data)


class MatrixCycleDetailView(SOCBaseView):
    """GET /api/soc/matrix/cycles/{cycle_id}/"""

    def get(self, request, cycle_id: str):
        try:
            matrix = ScrapeMatrix.objects.get(cycle_id=cycle_id)
        except ScrapeMatrix.DoesNotExist:
            return self.error_response(
                request,
                code='MATRIX_CYCLE_NOT_FOUND',
                detail=f"Matrix cycle '{cycle_id}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialize_cycle_detail(matrix))


class MatrixCycleStartView(SOCBaseView):
    """POST /api/soc/matrix/cycles/start/"""

    def post(self, request):
        requested_providers = request.data.get('providers')
        unsupported_providers = find_unsupported_provider_ids(requested_providers, surface='matrix')
        if unsupported_providers:
            return self.error_response(
                request,
                code='MATRIX_PROVIDER_UNSUPPORTED',
                detail=(
                    'Matrix chỉ hỗ trợ các provider KBS, VCI, DNSE. '
                    f"Không chấp nhận: {', '.join(unsupported_providers)}."
                ),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'providers': unsupported_providers},
            )

        providers = normalize_provider_list(requested_providers)
        unready_provider_messages = get_unready_provider_messages(providers)
        if unready_provider_messages:
            return self.error_response(
                request,
                code='MATRIX_PROVIDER_NOT_READY',
                detail='; '.join(unready_provider_messages),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'providers': unready_provider_messages},
            )

        existing_cycle = get_latest_monitor_cycle()
        if existing_cycle is not None and existing_cycle.status in {'active', 'completing'}:
            payload = _serialize_cycle_detail(existing_cycle)
            payload['reused_existing_cycle'] = True
            return Response(payload, status=status.HTTP_200_OK)

        symbol_group_ids = normalize_symbol_group_ids(request.data.get('symbol_group_ids'))
        coordinator = MatrixCoordinator(generate_cycle_id(), providers=providers)
        matrix = coordinator.create_cycle(symbol_group_ids=symbol_group_ids)
        dispatch_result = run_scrape_cycle.delay(
            cycle_id=matrix.cycle_id,
            symbol_group_ids=symbol_group_ids,
            providers=providers,
        )
        payload = _serialize_cycle_detail(matrix)
        payload['reused_existing_cycle'] = False
        payload['dispatch_task_id'] = getattr(dispatch_result, 'id', '')
        return Response(payload, status=status.HTTP_201_CREATED)


class MatrixCellListView(SOCBaseView):
    """GET /api/soc/matrix/cycles/{cycle_id}/cells/"""

    def get(self, request, cycle_id: str):
        try:
            matrix = ScrapeMatrix.objects.get(cycle_id=cycle_id)
        except ScrapeMatrix.DoesNotExist:
            return self.error_response(
                request,
                code='MATRIX_CYCLE_NOT_FOUND',
                detail=f"Matrix cycle '{cycle_id}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        queryset = matrix.cells.order_by('symbol_group_id', 'provider')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            serializer = ScrapeMatrixCellSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(ScrapeMatrixCellSerializer(queryset, many=True).data)


class MatrixCycleAbortView(SOCBaseView):
    """POST /api/soc/matrix/cycles/{cycle_id}/abort/"""

    def post(self, request, cycle_id: str):
        try:
            coordinator = MatrixCoordinator(cycle_id=cycle_id, providers=[])
            matrix = coordinator.abort_cycle()
        except ScrapeMatrix.DoesNotExist:
            return self.error_response(
                request,
                code='MATRIX_CYCLE_NOT_FOUND',
                detail=f"Matrix cycle '{cycle_id}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialize_cycle_detail(matrix))


class MatrixProvidersView(SOCBaseView):
    """GET /api/soc/matrix/providers/"""

    def get(self, request):
        current_cycle = get_latest_monitor_cycle()
        active_provider_ids = current_cycle.providers if current_cycle else []
        providers = list_provider_statuses('matrix', active_provider_ids=active_provider_ids)
        return Response({
            'providers': providers,
            'default_providers': list(DEFAULT_MATRIX_PROVIDERS),
            'ready_providers': [
                provider['provider']
                for provider in providers
                if provider['runtime_ready']
            ],
            'blocked_providers': [
                provider['provider']
                for provider in providers
                if not provider['runtime_ready']
            ],
        })


class MatrixMonitorView(SOCBaseView):
    """GET /api/soc/matrix/monitor/"""

    def get(self, request):
        cycle_id = str(request.query_params.get('cycle_id', '') or '').strip()
        if cycle_id:
            matrix = ScrapeMatrix.objects.filter(cycle_id=cycle_id).first()
        else:
            matrix = get_latest_monitor_cycle()

        if matrix is None:
            return Response({
                'cycle_id': None,
                'status': 'idle',
                'progress_pct': 0.0,
                'total_rows': 0,
                'done_rows': 0,
                'failed_rows': 0,
                'providers': list(DEFAULT_MATRIX_PROVIDERS),
                'symbol_groups': list(DEFAULT_SYMBOL_GROUPS),
                'cells': [],
                'cells_summary': {
                    'pending': 0,
                    'claimed': 0,
                    'working': 0,
                    'done': 0,
                    'failed': 0,
                    'skipped': 0,
                },
            })

        cells = ScrapeMatrixCellSerializer(matrix.cells.order_by('symbol_group_id', 'provider'), many=True).data
        return Response({
            'cycle_id': matrix.cycle_id,
            'status': matrix.status,
            'progress_pct': round(matrix.progress_pct, 2),
            'total_rows': matrix.total_rows,
            'done_rows': matrix.done_rows,
            'failed_rows': matrix.failed_rows,
            'providers': matrix.providers,
            'symbol_groups': [
                {'id': group_id, 'name': group_id.replace('_', ' ').title()}
                for group_id in sorted({cell['symbol_group_id'] for cell in cells})
            ] or list(DEFAULT_SYMBOL_GROUPS),
            'cells_summary': _serialize_cells_summary(matrix),
            'cells': [
                {
                    **cell,
                    'group': cell['symbol_group_id'],
                }
                for cell in cells
            ],
        })