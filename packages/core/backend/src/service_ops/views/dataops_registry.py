from vninvest_core.api_envelope import envelope_response

from ..envelope import envelope
from .dataops_base import *
from .dataops_base import _build_market_data_ownership_payload, _get_request_symbols


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

@extend_schema(
    summary='Lấy summary global symbol matrix foundation',
    description=(
        'Trả về summary canonical cho global symbol matrix foundation: tổng số symbol, '
        'phân bổ priority tier, freshness/coverage summary và demand-source ledger aggregates. '
        'Đây là operator read path cho F01/F02 foundation truth.'
    ),
    responses={
        200: envelope_response(DataOpsRegistrySummaryResponseSerializer),
        401: OpenApiTypes.OBJECT,
    },
)
class DataOpsRegistrySummaryView(SOCBaseView):
    """GET canonical global symbol matrix summary for operator surfaces."""

    def get(self, request):
        return envelope(build_global_symbol_registry_summary())


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
        200: envelope_response(DataOpsRegistryDetailResponseSerializer),
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
        return envelope(payload)


@extend_schema(
    summary='Preview drift reconcile cho global symbol matrix',
    description=(
        'Preview read-only các registry rows đang drift so với projected truth tính từ demand edges '
        'và coverage rows. Endpoint này không ghi DB; chỉ dùng để operator audit/reconcile planning.'
    ),
    request=DataOpsRegistryReconcilePreviewRequestSerializer,
    responses={
        200: envelope_response(DataOpsRegistryReconcilePreviewResponseSerializer),
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

        return envelope({
            **preview,
            'ownership': _build_market_data_ownership_payload(),
        })
