"""SOC Data Ops views for the global market-data SSOT."""

from datetime import date

from celery import current_app
from django.utils import timezone
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import serializers, status
from rest_framework.response import Response

from market_data.global_symbol_coverage import (
    build_global_coverage_summary,
    build_global_planner_preview,
)
from market_data.global_symbol_planner import create_global_planner_run
from market_data.global_symbol_registry import (
    build_global_symbol_registry_detail,
    build_global_symbol_registry_reconcile_preview,
    build_global_symbol_registry_summary,
    normalize_symbol,
)
from market_data.models import GlobalSymbolRegistry

from ..dataops_market_data import (
    DATAOPS_MARKET_DATA_DOMAIN,
    build_market_data_observability_summary,
    build_market_data_queue_tier_snapshot,
    get_market_data_runtime_config,
    resolve_market_data_queue_tier,
)
from ..domain_configs import MarketDataRuntimeConfig
from ..models import ConfigChangeAudit, ServiceRunLog
from ..ownership import build_ownership_matrix_from_db
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS
from .base import SOCBaseView
from .mixins import ConfigApplyMixin

# NOTE: this module is a shared-import hub consumed via `import *`
# (e.g. dataops_observability.py). `__all__` keeps F401 from stripping
# the re-exported names. Do NOT remove.
__all__ = [
    'DATAOPS_MARKET_DATA_DOMAIN',
    'RUN_SUMMARY_KEYS',
    'SOC_DOMAIN_PRIMARY_SERVICE_KEYS',
    'ConfigApplyMixin',
    'ConfigChangeAudit',
    'DataOpsOwnershipSerializer',
    'GlobalSymbolRegistry',
    'MarketDataRuntimeConfig',
    'OpenApiExample',
    'OpenApiParameter',
    'OpenApiTypes',
    'Response',
    'SOCBaseView',
    'ServiceRunLog',
    'build_global_coverage_summary',
    'build_global_planner_preview',
    'build_global_symbol_registry_detail',
    'build_global_symbol_registry_reconcile_preview',
    'build_global_symbol_registry_summary',
    'build_market_data_observability_summary',
    'build_market_data_queue_tier_snapshot',
    'build_ownership_matrix_from_db',
    'create_global_planner_run',
    'current_app',
    'date',
    'extend_schema',
    'extend_schema_view',
    'get_market_data_runtime_config',
    'normalize_symbol',
    'resolve_market_data_queue_tier',
    'serializers',
    'status',
    'timezone',
]


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
    if isinstance(symbols, list) and symbols:
        return list(symbols)
    # Support FE `symbol_group` (e.g. "vn100") — resolve to member symbols
    # to avoid blast-radius fallback to entire universe when symbols=None
    group = str(request.data.get('symbol_group') or '').strip()
    if group:
        try:
            from market_data.vnbroker_adapter import fetch_symbol_group_members
            members = fetch_symbol_group_members(group)
            if members:
                return list(members)
        except Exception:
            pass
        # Also try cached symbol group members as fallback
        try:
            from service_ops.models import CustomSymbolGroup
            cg = CustomSymbolGroup.objects.filter(group_id=group, is_active=True).first()
            if cg and cg.symbols:
                return list(cg.symbols)
        except Exception:
            pass
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


def _parse_market_data_run_id(run_id: str) -> int:
    normalized = str(run_id or '').strip().lower()
    if not normalized.startswith('md-run-'):
        raise ValueError(f'Run ID khong hop le: {run_id}')
    raw_id = normalized.replace('md-run-', '', 1)
    try:
        return int(raw_id)
    except (TypeError, ValueError) as exc:
        raise ValueError(f'Run ID khong hop le: {run_id}') from exc


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
