"""Matrix domain views for the SOC symbol universe matrix."""

from __future__ import annotations

from django.db.models import Count
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status

from ..envelope import envelope, paginated_envelope
from ..matrix_coordinator import (
    DEFAULT_MATRIX_PROVIDERS,
    DEFAULT_SYMBOL_GROUPS,
    MatrixCoordinator,
    generate_cycle_id,
    get_latest_monitor_cycle,
    normalize_provider_list,
    normalize_symbol_group_ids,
)
from ..models import ScrapeMatrix
from ..provider_catalog import (
    find_unsupported_provider_ids,
    get_unready_provider_messages,
    list_provider_statuses,
)
from ..serializers import ScrapeMatrixCellSerializer, ScrapeMatrixSerializer
from ..tasks import run_scrape_cycle
from ..views.base import SOCBaseView
from vninvest_core.api_envelope import envelope_response


PAGINATION_PARAMETERS = [
    OpenApiParameter(
        name='page',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description='Trang kết quả cần lấy.',
    ),
    OpenApiParameter(
        name='page_size',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        required=False,
        description='Số phần tử mỗi trang.',
    ),
]


class MatrixProviderStatusSerializer(serializers.Serializer):
    provider = serializers.CharField()
    label = serializers.CharField()
    enabled = serializers.BooleanField()
    in_active_cycle = serializers.BooleanField()
    runtime_ready = serializers.BooleanField()
    credential_mode = serializers.CharField()
    requires_runtime_credentials = serializers.BooleanField()
    required_runtime_envs = serializers.ListField(child=serializers.CharField())
    runtime_gate = serializers.CharField()
    readiness_reason = serializers.CharField()
    default_selected = serializers.BooleanField()
    supports_matrix = serializers.BooleanField()
    supports_vnbroker = serializers.BooleanField()


class MatrixCellsSummarySerializer(serializers.Serializer):
    pending = serializers.IntegerField()
    claimed = serializers.IntegerField()
    working = serializers.IntegerField()
    done = serializers.IntegerField()
    failed = serializers.IntegerField()
    skipped = serializers.IntegerField()


class MatrixCycleSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    cycle_id = serializers.CharField()
    status = serializers.CharField()
    providers = serializers.ListField(child=serializers.CharField())
    started_at = serializers.DateTimeField(required=False, allow_null=True)
    completed_at = serializers.DateTimeField(required=False, allow_null=True)
    total_rows = serializers.IntegerField()
    done_rows = serializers.IntegerField()
    failed_rows = serializers.IntegerField()
    progress_pct = serializers.FloatField()


class MatrixCycleDetailResponseSerializer(MatrixCycleSummarySerializer):
    cells_summary = MatrixCellsSummarySerializer()
    cells = serializers.ListField(child=serializers.JSONField())
    symbol_groups = serializers.ListField(child=serializers.JSONField())
    reused_existing_cycle = serializers.BooleanField(required=False)
    dispatch_task_id = serializers.CharField(required=False, allow_blank=True)


class MatrixCycleListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(required=False, allow_null=True)
    previous = serializers.CharField(required=False, allow_null=True)
    results = MatrixCycleSummarySerializer(many=True)


class MatrixCellListResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(required=False, allow_null=True)
    previous = serializers.CharField(required=False, allow_null=True)
    results = serializers.ListField(child=serializers.JSONField())


class MatrixCycleStartRequestSerializer(serializers.Serializer):
    providers = serializers.ListField(child=serializers.CharField(), required=False)
    symbol_group_ids = serializers.ListField(child=serializers.CharField(), required=False)


class MatrixProvidersResponseSerializer(serializers.Serializer):
    providers = MatrixProviderStatusSerializer(many=True)
    default_providers = serializers.ListField(child=serializers.CharField())
    ready_providers = serializers.ListField(child=serializers.CharField())
    blocked_providers = serializers.ListField(child=serializers.CharField())


class MatrixMonitorResponseSerializer(serializers.Serializer):
    cycle_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    status = serializers.CharField()
    progress_pct = serializers.FloatField()
    total_rows = serializers.IntegerField()
    done_rows = serializers.IntegerField()
    failed_rows = serializers.IntegerField()
    providers = serializers.ListField(child=serializers.CharField())
    symbol_groups = serializers.ListField(child=serializers.JSONField())
    cells_summary = MatrixCellsSummarySerializer()
    cells = serializers.ListField(child=serializers.JSONField())


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


@extend_schema(
    summary='Liệt kê matrix cycles',
    description='Trả về danh sách các matrix cycle theo phân trang chuẩn của SOC.',
    parameters=PAGINATION_PARAMETERS,
    responses={
        200: envelope_response(MatrixCycleListResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class MatrixCycleListView(SOCBaseView):
    """GET /api/soc/matrix/cycles/"""

    def get(self, request):
        queryset = ScrapeMatrix.objects.all().order_by('-started_at')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            serializer = ScrapeMatrixSerializer(page, many=True)
            paged = self.get_paginated_response(serializer.data)
            # Bọc cả khối phân trang (count/next/previous/results) trong `data`.
            return paginated_envelope(dict(paged.data))
        return envelope(ScrapeMatrixSerializer(queryset, many=True).data)


@extend_schema(
    summary='Lấy chi tiết matrix cycle',
    description='Trả về chi tiết một matrix cycle bao gồm cells và cells summary.',
    responses={
        200: envelope_response(MatrixCycleDetailResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
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
        return envelope(_serialize_cycle_detail(matrix))


@extend_schema(
    summary='Khởi động matrix cycle',
    description='Tạo matrix cycle mới hoặc reuse cycle đang active nếu đã tồn tại.',
    request=MatrixCycleStartRequestSerializer,
    responses={
        200: envelope_response(MatrixCycleDetailResponseSerializer),
        201: envelope_response(MatrixCycleDetailResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        429: OpenApiTypes.OBJECT,
    },
)
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
            return envelope(payload, status=status.HTTP_200_OK)

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
        return envelope(payload, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Liệt kê matrix cells',
    description='Trả về danh sách cells của một matrix cycle theo phân trang chuẩn.',
    parameters=PAGINATION_PARAMETERS,
    responses={
        200: envelope_response(MatrixCellListResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
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
            paged = self.get_paginated_response(serializer.data)
            return paginated_envelope(dict(paged.data))
        return envelope(ScrapeMatrixCellSerializer(queryset, many=True).data)


@extend_schema(
    summary='Abort matrix cycle',
    description='Abort một matrix cycle hiện có và mark các cells chưa xong thành skipped.',
    request=None,
    responses={
        200: envelope_response(MatrixCycleDetailResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
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
        return envelope(_serialize_cycle_detail(matrix))


@extend_schema(
    summary='Lấy matrix providers',
    description='Trả về provider catalog cho matrix, bao gồm active providers của cycle hiện tại và readiness metadata.',
    responses={
        200: envelope_response(MatrixProvidersResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class MatrixProvidersView(SOCBaseView):
    """GET /api/soc/matrix/providers/"""

    def get(self, request):
        current_cycle = get_latest_monitor_cycle()
        active_provider_ids = current_cycle.providers if current_cycle else []
        providers = list_provider_statuses('matrix', active_provider_ids=active_provider_ids)
        return envelope({
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


@extend_schema(
    summary='Lấy matrix monitor',
    description='Trả về monitor snapshot của cycle hiện tại hoặc cycle được chỉ định qua query param `cycle_id`.',
    parameters=[
        OpenApiParameter(
            name='cycle_id',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=False,
            description='Cycle ID cần theo dõi. Nếu bỏ trống, hệ thống lấy cycle active gần nhất.',
        )
    ],
    responses={
        200: envelope_response(MatrixMonitorResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class MatrixMonitorView(SOCBaseView):
    """GET /api/soc/matrix/monitor/"""

    def get(self, request):
        cycle_id = str(request.query_params.get('cycle_id', '') or '').strip()
        if cycle_id:
            matrix = ScrapeMatrix.objects.filter(cycle_id=cycle_id).first()
        else:
            matrix = get_latest_monitor_cycle()

        if matrix is None:
            return envelope({
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
        return envelope({
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
