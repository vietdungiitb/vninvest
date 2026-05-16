"""SOC Data Ops views for the global market-data SSOT."""

from datetime import date

from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import serializers, status
from rest_framework.response import Response

from market_data.global_symbol_coverage import build_global_coverage_summary, build_global_planner_preview
from market_data.global_symbol_registry import (
    build_global_symbol_registry_detail,
    build_global_symbol_registry_reconcile_preview,
    build_global_symbol_registry_summary,
    normalize_symbol,
)
from market_data.global_symbol_planner import create_global_planner_run
from market_data.models import GlobalSymbolRegistry

from ..domain_configs import MarketDataRuntimeConfig
from ..dataops_market_data import (
    DATAOPS_MARKET_DATA_DOMAIN,
    build_market_data_queue_tier_snapshot,
    get_market_data_runtime_config,
    resolve_market_data_queue_tier,
)
from ..ownership import build_ownership_matrix_from_db
from ..models import ConfigChangeAudit, ServiceRunLog
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


RUN_SUMMARY_KEYS = (
    'planned_items',
    'skipped_items',
    'inserted',
    'updated',
    'skipped_existing',
    'failed',
    'repaired_conflicts',
)


class DataOpsOwnershipSerializer(serializers.Serializer):
    domain = serializers.CharField()
    owner_team = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    write_mode = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    write_surface = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    can_apply = serializers.BooleanField()
    locked_fields = serializers.ListField(child=serializers.CharField(), required=False)
    compatibility_domains = serializers.ListField(child=serializers.CharField(), required=False)
    deprecation_notes = serializers.ListField(child=serializers.CharField(), required=False)
    write_block_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class DataOpsPlannerPreviewRequestSerializer(serializers.Serializer):
    symbols = serializers.ListField(child=serializers.CharField(), required=False)
    datasets = serializers.ListField(child=serializers.CharField(), required=False)
    mode = serializers.ChoiceField(choices=['missing_only'], default='missing_only', required=False)
    force_refresh = serializers.BooleanField(default=False, required=False)
    reason = serializers.CharField(required=False, allow_blank=True)
    reference_trade_date = serializers.DateField(required=False)


class DataOpsPlannerRunRequestSerializer(DataOpsPlannerPreviewRequestSerializer):
    execution_mode = serializers.ChoiceField(choices=['async', 'sync'], default='async', required=False)


class DataOpsRuntimeConfigApplyRequestSerializer(serializers.Serializer):
    config_payload = serializers.JSONField()


class DataOpsQueueTiersResponseSerializer(serializers.Serializer):
    tiers = serializers.ListField(child=serializers.JSONField())
    updated_at = serializers.DateTimeField()


class DataOpsCoverageResponseSerializer(serializers.Serializer):
    datasets = serializers.ListField(child=serializers.JSONField())
    top_gaps = serializers.ListField(child=serializers.JSONField())
    updated_at = serializers.DateTimeField()


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
    ownership = DataOpsOwnershipSerializer()


class DataOpsRegistrySummaryResponseSerializer(serializers.Serializer):
    totals = serializers.JSONField()
    priority_tiers = serializers.ListField(child=serializers.JSONField())
    freshness_states = serializers.ListField(child=serializers.JSONField())
    coverage_states = serializers.ListField(child=serializers.JSONField())
    demand_sources = serializers.ListField(child=serializers.JSONField())
    updated_at = serializers.DateTimeField()


class DataOpsRegistryDetailResponseSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    registry = serializers.JSONField()
    projected_registry = serializers.JSONField()
    needs_reconcile = serializers.BooleanField()
    drift_fields = serializers.ListField(child=serializers.CharField())
    queue_tier = serializers.CharField()
    demand_sources = serializers.ListField(child=serializers.JSONField())
    coverage = serializers.ListField(child=serializers.JSONField())


class DataOpsRegistryReconcilePreviewRequestSerializer(serializers.Serializer):
    symbols = serializers.ListField(child=serializers.CharField(), required=False)
    limit = serializers.IntegerField(required=False, min_value=0, max_value=200, default=50)


class DataOpsRegistryReconcilePreviewResponseSerializer(serializers.Serializer):
    summary = serializers.JSONField()
    items = serializers.ListField(child=serializers.JSONField())
    ownership = DataOpsOwnershipSerializer()


class DataOpsRuntimeConfigResponseSerializer(serializers.Serializer):
    config = serializers.JSONField()
    ownership = DataOpsOwnershipSerializer()
    updated_at = serializers.DateTimeField(allow_null=True)


def _build_market_data_ownership_payload() -> dict:
    matrix = build_ownership_matrix_from_db()
    payload = matrix.to_response_dict(DATAOPS_MARKET_DATA_DOMAIN)
    payload['write_block_reason'] = matrix.get_write_block_reason(DATAOPS_MARKET_DATA_DOMAIN)
    return payload


def _build_market_data_write_denied_response(view: SOCBaseView, request) -> Response:
    ownership = _build_market_data_ownership_payload()
    reason = ownership.get('write_block_reason') or (
        'DataOps market-data domain currently does not allow write actions from SOC.'
    )
    return Response({
        'detail': reason,
        'code': 'OWNERSHIP_WRITE_DENIED',
        'timestamp': date.today().isoformat(),
        'request_id': view.get_request_id(request),
        'write_block_reason': reason,
        'ownership': ownership,
    }, status=status.HTTP_403_FORBIDDEN)


def _get_request_symbols(request) -> list[str] | None:
    symbols = request.data.get('symbols')
    return list(symbols) if isinstance(symbols, list) else None


def _get_request_datasets(request) -> list[str] | None:
    datasets = request.data.get('datasets')
    return list(datasets) if isinstance(datasets, list) else None


def _get_request_force_refresh(request) -> bool:
    return bool(request.data.get('force_refresh', False))


def _get_reference_trade_date(request) -> date | None:
    raw_value = request.data.get('reference_trade_date')
    if not raw_value:
        return None
    return date.fromisoformat(str(raw_value))


def _format_market_data_run_id(run_log_id: int) -> str:
    return f'md-run-{run_log_id}'


def _build_market_data_run_summary(run_log: ServiceRunLog) -> dict:
    summary = {key: 0 for key in RUN_SUMMARY_KEYS}
    input_summary = dict(run_log.input_summary or {})
    output_summary = dict(run_log.output_summary or {})
    for source in (input_summary.get('plan_summary') or {}, output_summary.get('summary') or {}):
        if not isinstance(source, dict):
            continue
        for key in RUN_SUMMARY_KEYS:
            value = source.get(key)
            if value is None:
                continue
            summary[key] = value
    return summary


def _serialize_market_data_run_log(run_log: ServiceRunLog) -> dict:
    input_summary = dict(run_log.input_summary or {})
    return {
        'run_id': _format_market_data_run_id(run_log.id),
        'service_run_log_id': run_log.id,
        'status': run_log.status,
        'mode': input_summary.get('mode') or 'missing_only',
        'reason': input_summary.get('reason') or 'operator_manual_run',
        'execution_mode': input_summary.get('execution_mode') or 'async',
        'started_at': run_log.started_at.isoformat() if run_log.started_at else None,
        'finished_at': run_log.finished_at.isoformat() if run_log.finished_at else None,
        'summary': _build_market_data_run_summary(run_log),
    }


@extend_schema(
    summary='Lấy snapshot queue tiers DataOps market-data',
    description=(
        'Trả về snapshot hiện tại của queue tiers trong DataOps market-data, '
        'bao gồm cadence runtime hiệu lực, batch size, số symbol và ví dụ symbol cho từng tier. '
        'Đây là canonical operator read path cho runtime queue monitoring.'
    ),
    responses={
        200: DataOpsQueueTiersResponseSerializer,
        401: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Queue tiers snapshot',
            value={
                'tiers': [
                    {
                        'tier': 'hot_user_demand',
                        'symbol_count': 12,
                        'poll_interval_seconds': 30,
                        'max_batch_size': 50,
                        'examples': ['FPT', 'HPG', 'SSI'],
                    }
                ],
                'updated_at': '2026-05-15T11:00:00Z',
            },
        )
    ],
)
class DataOpsQueueTiersView(SOCBaseView):
    """GET canonical DataOps queue tiers snapshot."""

    def get(self, request):
        tiers, updated_at = build_market_data_queue_tier_snapshot(example_limit=5)
        return Response({
            'tiers': tiers,
            'updated_at': updated_at.isoformat(),
        })


@extend_schema(
    summary='Lấy coverage summary DataOps market-data',
    description=(
        'Trả về summary coverage theo dataset cùng top gaps ưu tiên cho global market-data matrix. '
        'Dùng cho operator coverage monitoring và action planning.'
    ),
    parameters=[
        OpenApiParameter(
            name='top_gap_limit',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Số gap ưu tiên cao nhất cần trả về. Mặc định 10.',
            required=False,
        ),
    ],
    responses={
        200: DataOpsCoverageResponseSerializer,
        401: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Coverage summary',
            value={
                'datasets': [
                    {
                        'dataset': 'daily_prices',
                        'fresh': 120,
                        'warm': 10,
                        'stale': 4,
                        'missing': 8,
                        'error': 0,
                        'unknown': 0,
                    }
                ],
                'top_gaps': [
                    {
                        'symbol': 'AAA',
                        'dataset': 'daily_prices',
                        'freshness_state': 'missing',
                        'next_recommended_action': 'hydrate_daily_prices',
                    }
                ],
                'updated_at': '2026-05-15T11:02:00Z',
            },
        )
    ],
)
class DataOpsCoverageView(SOCBaseView):
    """GET canonical DataOps coverage summary."""

    def get(self, request):
        try:
            top_gap_limit = max(int(request.query_params.get('top_gap_limit', 10)), 0)
        except (TypeError, ValueError):
            top_gap_limit = 10
        return Response(build_global_coverage_summary(top_gap_limit=top_gap_limit))


@extend_schema(
    summary='Lấy summary global symbol matrix foundation',
    description=(
        'Trả về summary canonical cho global symbol matrix foundation: tổng số symbol, '
        'phân bổ priority tier, freshness/coverage summary và demand-source ledger aggregates. '
        'Đây là operator read path cho F01/F02 foundation truth.'
    ),
    responses={
        200: DataOpsRegistrySummaryResponseSerializer,
        401: OpenApiTypes.OBJECT,
    },
)
class DataOpsRegistrySummaryView(SOCBaseView):
    """GET canonical global symbol matrix summary for operator surfaces."""

    def get(self, request):
        return Response(build_global_symbol_registry_summary())


@extend_schema(
    summary='Lấy detail một symbol trong global symbol matrix',
    description=(
        'Trả về registry snapshot hiện hành, projected registry sau reconcile, demand sources '
        'và coverage detail cho một symbol. Dùng để audit foundation truth và drift cục bộ.'
    ),
    parameters=[
        OpenApiParameter(
            name='symbol',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.PATH,
            description='Mã chứng khoán cần đọc detail trong global symbol matrix.',
            required=True,
        ),
    ],
    responses={
        200: DataOpsRegistryDetailResponseSerializer,
        401: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class DataOpsRegistryDetailView(SOCBaseView):
    """GET canonical global symbol matrix detail for a symbol."""

    def get(self, request, symbol: str):
        try:
            registry = GlobalSymbolRegistry.objects.get(symbol=normalize_symbol(symbol))
        except GlobalSymbolRegistry.DoesNotExist:
            return self.error_response(
                request,
                code='REGISTRY_SYMBOL_NOT_FOUND',
                detail=f'Khong tim thay symbol {str(symbol or "").upper().strip()} trong global symbol matrix.',
                http_status=status.HTTP_404_NOT_FOUND,
            )

        payload = build_global_symbol_registry_detail(registry)
        payload['queue_tier'] = resolve_market_data_queue_tier(registry)
        return Response(payload)


@extend_schema(
    summary='Preview drift reconcile cho global symbol matrix',
    description=(
        'Preview read-only các registry rows đang drift so với projected truth tính từ demand edges '
        'và coverage rows. Endpoint này không ghi DB; chỉ dùng để operator audit/reconcile planning.'
    ),
    request=DataOpsRegistryReconcilePreviewRequestSerializer,
    responses={
        200: DataOpsRegistryReconcilePreviewResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
    },
)
class DataOpsRegistryReconcilePreviewView(SOCBaseView):
    """POST canonical reconcile preview for global symbol matrix foundation."""

    def post(self, request):
        try:
            preview = build_global_symbol_registry_reconcile_preview(
                symbols=_get_request_symbols(request),
                limit=request.data.get('limit', 50),
            )
        except ValueError as exc:
            return self.error_response(
                request,
                code='REGISTRY_RECONCILE_PREVIEW_INVALID',
                detail=str(exc),
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            **preview,
            'ownership': _build_market_data_ownership_payload(),
        })


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
        200: DataOpsRunLogsResponseSerializer,
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
            service__service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
        ).order_by('-started_at', '-pk')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            return self.get_paginated_response([
                _serialize_market_data_run_log(run_log)
                for run_log in page
            ])
        return Response([
            _serialize_market_data_run_log(run_log)
            for run_log in queryset
        ])


@extend_schema(
    summary='Preview planner DataOps market-data',
    description=(
        'Preview kế hoạch planner cho market-data global matrix mà không queue execution. '
        'Dùng để xem trước danh sách item sẽ chạy, item bị skip và ownership write status.'
    ),
    request=DataOpsPlannerPreviewRequestSerializer,
    responses={
        200: DataOpsPlannerPreviewResponseSerializer,
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

        return Response({
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

        return Response({
            **result,
            'ownership': ownership,
        }, status=status.HTTP_201_CREATED)


@extend_schema_view(
    get=extend_schema(
        summary='Lấy runtime config DataOps market-data',
        description=(
            'Trả về runtime config hiệu lực của market-data queue tiers cùng ownership payload. '
            'Đây là canonical read path cho frontend runtime config/admin panel.'
        ),
        responses={
            200: DataOpsRuntimeConfigResponseSerializer,
            401: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Runtime config read',
                value={
                    'config': {
                        'decay_days': 7,
                        'hot_user_demand': {'poll_interval_seconds': 30, 'max_batch_size': 50},
                    },
                    'ownership': {
                        'domain': 'dataops_market_data',
                        'can_apply': True,
                        'write_surface': 'soc_dataops',
                    },
                    'updated_at': '2026-05-15T11:00:00Z',
                },
            )
        ],
    ),
    post=extend_schema(
        summary='Apply runtime config DataOps market-data',
        description=(
            'Apply runtime config cho market-data queue tiers qua canonical operator path. '
            'Request phải đi qua ownership guard và tạo ConfigChangeAudit ở backend.'
        ),
        request=DataOpsRuntimeConfigApplyRequestSerializer,
        responses={
            201: DataOpsRuntimeConfigResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Runtime config apply',
                value={
                    'config_payload': {
                        'decay_days': 9,
                        'hot_user_demand': {'poll_interval_seconds': 20, 'max_batch_size': 40},
                        'warm_liquid_market': {'poll_interval_seconds': 180, 'max_batch_size': 110},
                    }
                },
                request_only=True,
            )
        ],
    ),
)
class DataOpsRuntimeConfigView(SOCBaseView, ConfigApplyMixin):
    def get(self, request):
        config, updated_at = get_market_data_runtime_config()
        return Response({
            'config': config.to_dict(),
            'ownership': _build_market_data_ownership_payload(),
            'updated_at': updated_at.isoformat() if updated_at else None,
        })

    def post(self, request):
        result = self.apply_config(
            request,
            service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix'],
            domain=DATAOPS_MARKET_DATA_DOMAIN,
            config_payload=request.data.get('config_payload', {}),
            config_class=MarketDataRuntimeConfig,
        )
        if isinstance(result, Response):
            return result
        _, svc_config = result
        return Response({
            'config': svc_config.config_payload,
            'ownership': _build_market_data_ownership_payload(),
            'updated_at': svc_config.applied_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class DataOpsRuntimeConfigPreviewRequestSerializer(serializers.Serializer):
    config_payload = serializers.JSONField()


class DataOpsRuntimeConfigPreviewResponseSerializer(serializers.Serializer):
    projected_config = serializers.JSONField()
    validation_errors = serializers.ListField(child=serializers.CharField(), required=False)
    is_valid = serializers.BooleanField()
    ownership = DataOpsOwnershipSerializer()


@extend_schema(
    summary='Preview runtime config DataOps (dry-run)',
    description=(
        'Validate và hiển thị projected config sau khi apply — không lưu vào DB. '
        'Dùng để operator kiểm tra trước khi thực sự apply.'
    ),
    request=DataOpsRuntimeConfigPreviewRequestSerializer,
    responses={
        200: DataOpsRuntimeConfigPreviewResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class DataOpsRuntimeConfigPreviewView(SOCBaseView):
    """POST /api/soc/dataops/runtime-config/preview/ — dry-run validation."""

    def post(self, request):
        config_payload = request.data.get('config_payload', {})
        current_config, _ = get_market_data_runtime_config()
        current_dict = current_config.to_dict()

        validation_errors = []
        projected_dict = current_dict
        if not isinstance(config_payload, dict):
            validation_errors.append('config_payload phải là object.')
        else:
            try:
                projected = MarketDataRuntimeConfig.from_dict({**current_dict, **config_payload})
                projected_dict = projected.to_dict()
            except Exception as exc:
                validation_errors.append(str(exc))

        if validation_errors:
            return Response({
                'projected_config': projected_dict,
                'validation_errors': validation_errors,
                'is_valid': False,
                'ownership': _build_market_data_ownership_payload(),
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'projected_config': projected_dict,
            'validation_errors': [],
            'is_valid': True,
            'ownership': _build_market_data_ownership_payload(),
        })


class DataOpsRuntimeConfigAuditSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    service_key = serializers.CharField()
    actor = serializers.CharField(allow_null=True)
    timestamp = serializers.DateTimeField(allow_null=True)
    change_summary = serializers.CharField(allow_blank=True, allow_null=True)


class DataOpsRuntimeConfigAuditResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True, required=False)
    previous = serializers.CharField(allow_null=True, required=False)
    results = DataOpsRuntimeConfigAuditSerializer(many=True)


@extend_schema(
    summary='Audit log runtime config DataOps',
    description=(
        'Trả về lịch sử thay đổi config của DataOps market-data domain, '
        'sắp xếp theo thứ tự mới nhất.'
    ),
    responses={
        200: DataOpsRuntimeConfigAuditResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class DataOpsRuntimeConfigAuditView(SOCBaseView):
    """GET /api/soc/dataops/runtime-config/audit/ — change history."""

    def get(self, request):
        service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['matrix']
        audits = ConfigChangeAudit.objects.filter(
            service__service_key=service_key,
        ).select_related('service').order_by('-timestamp', '-id')
        page = self.paginate_queryset(audits, request)
        data = [
            {
                'id': audit.id,
                'service_key': audit.service.service_key if audit.service else service_key,
                'actor': audit.actor,
                'timestamp': audit.timestamp.isoformat() if audit.timestamp else None,
                'change_summary': audit.change_summary,
            }
            for audit in page
        ]
        return self.get_paginated_response(data)


class DataOpsInventoryView(SOCBaseView):
    """GET /api/soc/dataops/inventory/ — data warehouse inventory stats."""

    @extend_schema(
        summary='Thống kê kho dữ liệu thị trường',
        description='Trả về inventory toàn bộ dữ liệu thị trường trong DB: tổng quan, phân bổ theo năm, và coverage theo nhóm.',
        responses={200: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        from datetime import timedelta
        from django.db.models import Min, Max, Count
        from django.db.models.functions import TruncYear
        from market_data.models import DailyPrice
        from market_serving.models import SymbolSnapshot
        from market_data.vnbroker_adapter import fetch_symbol_group_members
        from ..matrix_coordinator import PREDEFINED_SYMBOL_GROUPS
        from ..models import CustomSymbolGroup

        # ── Tổng quan DailyPrice ────────────────────────────────────────────
        dp_agg = DailyPrice.objects.aggregate(
            earliest=Min('date'), latest=Max('date'),
            total_rows=Count('id'), total_symbols=Count('symbol', distinct=True),
        )
        cal_days = (
            (dp_agg['latest'] - dp_agg['earliest']).days + 1
            if dp_agg['earliest'] and dp_agg['latest'] else 0
        )

        # ── Phân bổ theo năm ────────────────────────────────────────────────
        by_year_qs = (
            DailyPrice.objects.annotate(yr=TruncYear('date'))
            .values('yr')
            .annotate(rows=Count('id'), symbols=Count('symbol', distinct=True))
            .order_by('yr')
        )
        by_year = [
            {'year': str(r['yr'])[:4], 'rows': r['rows'], 'symbols': r['symbols']}
            for r in by_year_qs
        ]

        # ── Coverage theo nhóm (30-ngày gần nhất) ──────────────────────────
        cutoff = dp_agg['latest'] - timedelta(days=30) if dp_agg['latest'] else None
        groups_data = []
        all_groups = list(PREDEFINED_SYMBOL_GROUPS) + [
            {'id': cg.group_id, 'name': cg.name, 'type': 'custom'}
            for cg in CustomSymbolGroup.objects.filter(is_active=True).order_by('name')
        ]
        for g in all_groups:
            try:
                syms = fetch_symbol_group_members(g['id'])
                total = len(syms)
                agg = DailyPrice.objects.filter(symbol__in=syms).aggregate(
                    earliest=Min('date'), latest=Max('date'),
                    rows=Count('id'), covered=Count('symbol', distinct=True),
                )
                recent = (
                    DailyPrice.objects.filter(symbol__in=syms, date__gte=cutoff)
                    .values('symbol').distinct().count()
                    if cutoff else 0
                )
                group_days = (
                    (agg['latest'] - agg['earliest']).days + 1
                    if agg['earliest'] and agg['latest'] else 0
                )
                groups_data.append({
                    'id': g['id'], 'name': g['name'], 'type': g.get('type', 'index'),
                    'symbol_count': total, 'covered_symbols': agg['covered'] or 0,
                    'recent_symbols': recent, 'total_rows': agg['rows'] or 0,
                    'earliest_date': agg['earliest'].isoformat() if agg['earliest'] else None,
                    'latest_date': agg['latest'].isoformat() if agg['latest'] else None,
                    'calendar_days': group_days,
                })
            except Exception:
                groups_data.append({
                    'id': g['id'], 'name': g['name'], 'type': g.get('type', 'index'),
                    'symbol_count': 0, 'covered_symbols': 0, 'recent_symbols': 0,
                    'total_rows': 0, 'earliest_date': None, 'latest_date': None, 'calendar_days': 0,
                })

        # ── Các loại dữ liệu khác ───────────────────────────────────────────
        snapshot_count = SymbolSnapshot.objects.aggregate(
            total=Count('id'), symbols=Count('symbol', distinct=True)
        )
        from market_serving.models import SessionFacts
        session_agg = SessionFacts.objects.aggregate(
            total=Count('id'), symbols=Count('symbol', distinct=True),
            earliest=Min('session_date'), latest=Max('session_date'),
        )
        data_types = [
            {
                'name': 'DailyPrice', 'label': 'Giá ngày (OHLCV)',
                'total_rows': dp_agg['total_rows'] or 0,
                'symbols': dp_agg['total_symbols'] or 0,
                'earliest_date': dp_agg['earliest'].isoformat() if dp_agg['earliest'] else None,
                'latest_date': dp_agg['latest'].isoformat() if dp_agg['latest'] else None,
            },
            {
                'name': 'SymbolSnapshot', 'label': 'Snapshot giá realtime',
                'total_rows': snapshot_count['total'] or 0,
                'symbols': snapshot_count['symbols'] or 0,
                'earliest_date': None, 'latest_date': None,
            },
            {
                'name': 'SessionFacts', 'label': 'Facts phiên giao dịch',
                'total_rows': session_agg['total'] or 0,
                'symbols': session_agg['symbols'] or 0,
                'earliest_date': session_agg['earliest'].isoformat() if session_agg['earliest'] else None,
                'latest_date': session_agg['latest'].isoformat() if session_agg['latest'] else None,
            },
        ]

        return Response({
            'summary': {
                'total_rows': dp_agg['total_rows'] or 0,
                'total_symbols': dp_agg['total_symbols'] or 0,
                'earliest_date': dp_agg['earliest'].isoformat() if dp_agg['earliest'] else None,
                'latest_date': dp_agg['latest'].isoformat() if dp_agg['latest'] else None,
                'calendar_days': cal_days,
            },
            'by_year': by_year,
            'by_group': groups_data,
            'data_types': data_types,
        })