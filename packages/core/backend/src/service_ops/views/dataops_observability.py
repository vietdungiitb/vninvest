from .dataops_base import *

from ..envelope import envelope
from vninvest_core.api_envelope import envelope_response

class DataOpsQueueTiersResponseSerializer(serializers.Serializer):
    tiers = serializers.ListField(child=serializers.JSONField())
    updated_at = serializers.DateTimeField()

class DataOpsCoverageResponseSerializer(serializers.Serializer):
    datasets = serializers.ListField(child=serializers.JSONField())
    top_gaps = serializers.ListField(child=serializers.JSONField())
    updated_at = serializers.DateTimeField()

class DataOpsObservabilityResponseSerializer(serializers.Serializer):
    backlog = serializers.JSONField()
    fail_rates = serializers.JSONField()
    parity_gates = serializers.JSONField()
    parity_history = serializers.JSONField()
    retention_health = serializers.JSONField()
    starvation = serializers.ListField(child=serializers.JSONField())
    updated_at = serializers.DateTimeField()

@extend_schema(
    summary='Lấy snapshot queue tiers DataOps market-data',
    description=(
        'Trả về snapshot hiện tại của queue tiers trong DataOps market-data, '
        'bao gồm cadence runtime hiệu lực, batch size, số symbol và ví dụ symbol cho từng tier. '
        'Đây là canonical operator read path cho runtime queue monitoring.'
    ),
    responses={
        200: envelope_response(DataOpsQueueTiersResponseSerializer),
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
        return envelope({
            'tiers': tiers,
            'updated_at': updated_at.isoformat(),
        })

@extend_schema(
    summary='Lấy observability summary DataOps market-data',
    description=(
        'Trả về observability summary cho DataOps market-data gồm backlog theo dataset/tier, '
        'fail-rate cửa sổ 1h/24h và starvation indicators theo queue tier. '
        'Dùng cho operator monitor dashboard trong SOC Config UI.'
    ),
    responses={
        200: envelope_response(DataOpsObservabilityResponseSerializer),
        401: OpenApiTypes.OBJECT,
    },
)
class DataOpsObservabilityView(SOCBaseView):
    """GET canonical DataOps observability summary."""

    def get(self, request):
        return envelope(build_market_data_observability_summary())


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
        200: envelope_response(DataOpsCoverageResponseSerializer),
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
        return envelope(build_global_coverage_summary(top_gap_limit=top_gap_limit))
