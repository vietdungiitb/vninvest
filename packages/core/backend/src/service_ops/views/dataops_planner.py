from .dataops_base import *
from .dataops_base import (
    _build_market_data_ownership_payload,
    _build_market_data_write_denied_response,
    _format_market_data_run_id,
    _get_reference_trade_date,
    _get_request_datasets,
    _get_request_force_refresh,
    _get_request_symbols,
    _parse_market_data_run_id,
    _serialize_market_data_run_log,
)

from ..envelope import envelope, paginated_envelope
from vninvest_core.api_envelope import envelope_response
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes


class DataOpsPlannerPreviewRequestSerializer(serializers.Serializer):
    symbols = serializers.ListField(child=serializers.CharField(), required=False)
    datasets = serializers.ListField(child=serializers.CharField(), required=False)
    mode = serializers.ChoiceField(choices=['missing_only', 'strict_fresh'], default='missing_only', required=False)
    force_refresh = serializers.BooleanField(default=False, required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    reference_trade_date = serializers.DateField(required=False)

class DataOpsPlannerRunRequestSerializer(DataOpsPlannerPreviewRequestSerializer):
    execution_mode = serializers.ChoiceField(choices=['async', 'sync'], default='async', required=False)

class DataOpsRunLogsResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(required=False, allow_null=True)
    previous = serializers.CharField(required=False, allow_null=True)
    results = serializers.ListField(child=serializers.JSONField())

class DataOpsPlannerPreviewResponseSerializer(serializers.Serializer):
    summary = serializers.JSONField()
    items = serializers.ListField(child=serializers.JSONField())
    skipped = serializers.ListField(child=serializers.JSONField())
    ownership = DataOpsOwnershipSerializer()

class DataOpsPlannerRunResponseSerializer(serializers.Serializer):
    queued = serializers.BooleanField()
    status = serializers.CharField()
    run_id = serializers.CharField()
    service_run_log_id = serializers.IntegerField()
    celery_task_id = serializers.CharField(required=False, allow_blank=True)
    ownership = DataOpsOwnershipSerializer()

class DataOpsPlannerAbortResponseSerializer(serializers.Serializer):
    cancelled = serializers.BooleanField()
    status = serializers.CharField()
    run_id = serializers.CharField()
    service_run_log_id = serializers.IntegerField()
    celery_task_id = serializers.CharField(required=False, allow_blank=True)
    ownership = DataOpsOwnershipSerializer()

@extend_schema(
    summary='Lấy lịch sử planner runs DataOps market-data',
    description=(
        'Trả về danh sách paginated các parent planner runs của DataOps market-data. '
        'Đây là operator history read path cho manual runs và scheduler-triggered runs.'
    ),
    parameters=[
        OpenApiParameter(
            name='page',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Trang paginated cần đọc. Mặc định dùng pagination chuẩn của SOCBaseView.',
            required=False,
        ),
    ],
    responses={
        200: envelope_response(DataOpsRunLogsResponseSerializer),
        401: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Run logs page',
            value={
                'count': 1,
                'next': None,
                'previous': None,
                'results': [
                    {
                        'run_id': 'md-run-111',
                        'status': 'success',
                        'mode': 'missing_only',
                        'reason': 'scheduler_hot_tier',
                        'execution_mode': 'async',
                        'started_at': '2026-05-15T10:55:00Z',
                        'finished_at': '2026-05-15T10:56:00Z',
                        'summary': {'planned_items': 3, 'inserted': 2, 'updated': 1},
                    }
                ],
            },
        )
    ],
)
class DataOpsRunLogsView(SOCBaseView):
    """GET canonical DataOps run-log history."""

    def get(self, request):
        queryset = ServiceRunLog.objects.filter(
            service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops'],
        ).order_by('-started_at', '-pk')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            paged = self.get_paginated_response([
                _serialize_market_data_run_log(run_log)
                for run_log in page
            ])
            # Bọc cả khối phân trang — `next`/`previous` nằm trong `data`.
            return paginated_envelope(dict(paged.data))
        return envelope([
            _serialize_market_data_run_log(run_log)
            for run_log in queryset
        ])


@extend_schema(
    summary='Xóa lịch sử run-log DataOps',
    description=(
        'Xóa các ServiceRunLog cũ của DataOps market-data planner. '
        'Giữ lại N bản ghi mới nhất (mặc định 50), xóa toàn bộ bản ghi còn lại. '
        'Chỉ dành cho operator/admin.'
    ),
    request=None,
    responses={
        200: envelope_response(),
        401: OpenApiTypes.OBJECT,
    },
    parameters=[
        OpenApiParameter(
            name='keep',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Số bản ghi mới nhất cần giữ lại. Mặc định 50.',
            required=False,
        ),
    ],
    examples=[
        OpenApiExample(
            'Purge result',
            value={'deleted': 2654, 'kept': 50},
        )
    ],
)
class DataOpsRunLogsPurgeView(SOCBaseView):
    """POST xóa lịch sử run-log cũ của DataOps planner, giữ lại N bản mới nhất."""

    def post(self, request):
        try:
            keep = int(request.query_params.get('keep', 50))
            if keep < 0:
                keep = 0
        except (TypeError, ValueError):
            keep = 50

        base_qs = ServiceRunLog.objects.filter(
            service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops'],
        )
        total = base_qs.count()

        if total <= keep:
            return envelope({'deleted': 0, 'kept': total})

        # Lấy PK của N bản mới nhất cần giữ lại
        keep_ids = list(
            base_qs.order_by('-started_at', '-pk').values_list('pk', flat=True)[:keep]
        )
        deleted_count, _ = base_qs.exclude(pk__in=keep_ids).delete()

        return envelope({'deleted': deleted_count, 'kept': keep})


@extend_schema(
    summary='Preview planner DataOps market-data',
    description=(
        'Preview kế hoạch planner cho market-data global matrix mà không queue execution. '
        'Dùng để xem trước danh sách item sẽ chạy, item bị skip và ownership write status.'
    ),
    request=DataOpsPlannerPreviewRequestSerializer,
    responses={
        200: envelope_response(DataOpsPlannerPreviewResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Planner preview',
            value={
                'summary': {'planned_items': 1, 'skipped_items': 1},
                'items': [
                    {
                        'symbol': 'FPT',
                        'dataset': 'daily_prices',
                        'reason': 'hydrate_daily_prices',
                    }
                ],
                'skipped': [
                    {
                        'symbol': 'FPT',
                        'dataset': 'price_board_snapshot',
                        'reason': 'coverage_ok',
                    }
                ],
                'ownership': {
                    'domain': 'dataops_market_data',
                    'can_apply': True,
                    'write_surface': 'soc_dataops',
                },
            },
        )
    ],
)
class DataOpsPlannerPreviewView(SOCBaseView):
    """POST canonical DataOps planner preview."""

    def post(self, request):
        try:
            preview = build_global_planner_preview(
                symbols=_get_request_symbols(request),
                datasets=_get_request_datasets(request),
                mode=request.data.get('mode', 'missing_only'),
                force_refresh=_get_request_force_refresh(request),
                reason=request.data.get('reason', 'manual_preview'),
                reference_trade_date=_get_reference_trade_date(request),
            )
        except ValueError as exc:
            return self.error_response(
                request,
                code='PLANNER_PREVIEW_INVALID',
                detail=str(exc),
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        return envelope({
            **preview,
            'ownership': _build_market_data_ownership_payload(),
        })


@extend_schema(
    summary='Queue planner run DataOps market-data',
    description=(
        'Queue một planner run cho market-data global matrix. '
        'Endpoint này chỉ được phép apply khi ownership cho phép write từ DataOps operator surface.'
    ),
    request=DataOpsPlannerRunRequestSerializer,
    responses={
        201: DataOpsPlannerRunResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Planner run queued',
            value={
                'queued': True,
                'status': 'queued',
                'run_id': 'md-run-112',
                'service_run_log_id': 112,
                'ownership': {
                    'domain': 'dataops_market_data',
                    'can_apply': True,
                    'write_surface': 'soc_dataops',
                },
            },
            response_only=True,
        )
    ],
)
class DataOpsPlannerRunView(SOCBaseView):
    """POST canonical DataOps planner run."""

    def post(self, request):
        ownership = _build_market_data_ownership_payload()
        if not ownership.get('can_apply', False):
            return _build_market_data_write_denied_response(self, request)

        try:
            result = create_global_planner_run(
                symbols=_get_request_symbols(request),
                datasets=_get_request_datasets(request),
                mode=request.data.get('mode', 'missing_only'),
                force_refresh=_get_request_force_refresh(request),
                reason=request.data.get('reason', 'operator_manual_run'),
                execution_mode=request.data.get('execution_mode', 'async'),
                reference_trade_date=_get_reference_trade_date(request),
                trigger='soc.dataops.planner.run',
                planner_queue='manual_on_demand',
                extra_input_summary={
                    'write_surface': 'soc_dataops',
                    'requested_by': getattr(request.user, 'username', 'api'),
                },
            )
        except ValueError as exc:
            return self.error_response(
                request,
                code='PLANNER_RUN_INVALID',
                detail=str(exc),
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        return envelope({
            **result,
            'ownership': ownership,
        }, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Abort planner run DataOps market-data',
    description=(
        'Hủy một planner run theo run_id. '
        'Nếu run đang queued/running, endpoint sẽ revoke Celery task (nếu có) '
        'và đóng run về trạng thái terminal.'
    ),
    responses={
        200: DataOpsPlannerAbortResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
        409: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Planner run aborted',
            value={
                'cancelled': True,
                'status': 'skipped',
                'run_id': 'md-run-112',
                'service_run_log_id': 112,
                'celery_task_id': '1b2f6f6f-9d31-42ce-b39b-4c2fceec2eee',
                'ownership': {
                    'domain': 'dataops_market_data',
                    'can_apply': True,
                    'write_surface': 'soc_dataops',
                },
            },
            response_only=True,
        )
    ],
)
@extend_schema(
    summary='DataOpsPlannerRunAbortView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class DataOpsPlannerRunAbortView(SOCBaseView):
    """POST abort for a queued/running DataOps planner run."""

    def post(self, request, run_id: str):
        ownership = _build_market_data_ownership_payload()
        if not ownership.get('can_apply', False):
            return _build_market_data_write_denied_response(self, request)

        try:
            run_log_id = _parse_market_data_run_id(run_id)
        except ValueError as exc:
            return self.error_response(
                request,
                code='PLANNER_RUN_ABORT_INVALID',
                detail=str(exc),
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        run_log = ServiceRunLog.objects.filter(
            pk=run_log_id,
            service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops'],
        ).first()
        if run_log is None:
            return self.error_response(
                request,
                code='PLANNER_RUN_ABORT_NOT_FOUND',
                detail=f'Khong tim thay run {run_id}',
                http_status=status.HTTP_404_NOT_FOUND,
            )

        normalized_status = str(run_log.status or '').lower()
        if normalized_status not in {'queued', 'running'}:
            return self.error_response(
                request,
                code='PLANNER_RUN_ABORT_CONFLICT',
                detail=f'Run {run_id} da o trang thai terminal: {run_log.status}',
                http_status=status.HTTP_409_CONFLICT,
            )

        if run_log.celery_task_id:
            try:
                if normalized_status == 'running':
                    current_app.control.revoke(run_log.celery_task_id, terminate=True, signal='SIGTERM')
                else:
                    current_app.control.revoke(run_log.celery_task_id)
            except Exception as exc:
                return self.error_response(
                    request,
                    code='PLANNER_RUN_ABORT_REVOKE_FAILED',
                    detail=f'Khong the revoke task: {exc}',
                    http_status=status.HTTP_400_BAD_REQUEST,
                )

        finished_at = timezone.now()
        run_log.status = 'skipped'
        run_log.finished_at = finished_at
        if run_log.started_at is not None:
            run_log.duration_seconds = max((finished_at - run_log.started_at).total_seconds(), 0.0)
        existing_output = dict(run_log.output_summary or {})
        existing_output['cancelled_by_operator'] = True
        existing_output['cancelled_at'] = finished_at.isoformat()
        run_log.output_summary = existing_output
        run_log.error_detail = 'Cancelled by operator via SOC DataOps.'
        run_log.save(update_fields=['status', 'finished_at', 'duration_seconds', 'output_summary', 'error_detail'])

        return envelope({
            'cancelled': True,
            'status': run_log.status,
            'run_id': _format_market_data_run_id(run_log.id),
            'service_run_log_id': run_log.id,
            'celery_task_id': run_log.celery_task_id,
            'ownership': ownership,
        })
