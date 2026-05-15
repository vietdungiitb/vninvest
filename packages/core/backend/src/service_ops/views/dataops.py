"""SOC Data Ops views for the global market-data SSOT."""

from rest_framework import status
from rest_framework.response import Response

from market_data.global_symbol_coverage import build_global_coverage_summary

from ..domain_configs import MarketDataRuntimeConfig
from ..dataops_market_data import (
    DATAOPS_MARKET_DATA_DOMAIN,
    build_market_data_queue_tier_snapshot,
    get_market_data_runtime_config,
)
from ..ownership import build_ownership_matrix_from_db
from ..models import ServiceDefinition
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


def _build_market_data_ownership_payload() -> dict:
    matrix = build_ownership_matrix_from_db()
    payload = matrix.to_response_dict(DATAOPS_MARKET_DATA_DOMAIN)
    payload['write_block_reason'] = matrix.get_write_block_reason(DATAOPS_MARKET_DATA_DOMAIN)
    return payload


class DataOpsQueueTiersView(SOCBaseView):
    """GET /api/soc/dataops/queue-tiers/"""

    def get(self, request):
        tiers, updated_at = build_market_data_queue_tier_snapshot(example_limit=5)
        return Response({
            'tiers': tiers,
            'updated_at': updated_at.isoformat(),
        })


class DataOpsCoverageView(SOCBaseView):
    """GET /api/soc/dataops/coverage/"""

    def get(self, request):
        try:
            top_gap_limit = max(int(request.query_params.get('top_gap_limit', 10)), 0)
        except (TypeError, ValueError):
            top_gap_limit = 10
        return Response(build_global_coverage_summary(top_gap_limit=top_gap_limit))


class DataOpsRuntimeConfigView(SOCBaseView, ConfigApplyMixin):
    def get(self, request):
        config, updated_at = get_market_data_runtime_config()
        return Response({
            'config': config.to_dict(),
            'ownership': _build_market_data_ownership_payload(),
            'updated_at': updated_at.isoformat() if updated_at else None,
        })

    """POST /api/soc/dataops/runtime-config/"""

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