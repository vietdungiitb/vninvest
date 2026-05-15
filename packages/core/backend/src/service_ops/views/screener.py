"""
Screener Domain Views (7 endpoints).

GET /api/soc/screener/config/ — get current config
POST /api/soc/screener/config/ — apply config
GET /api/soc/screener/rules/ — list active rules
POST /api/soc/screener/rules/ — add rule
GET /api/soc/screener/results/ — latest scan results
GET /api/soc/screener/alert-history/ — alert history
POST /api/soc/screener/manual-scan/ — trigger manual scan
"""
from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from signal_intelligence.models import UnifiedAlert

from ..domain_configs import ScreenerDomainConfig
from ..models import ServiceConfig, ServiceDefinition, ServiceRunLog
from ..ownership import build_ownership_matrix_from_db
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from ..serializers import ServiceConfigSerializer
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


class ScreenerConfigPayloadSerializer(serializers.Serializer):
    rules = serializers.ListField(child=serializers.JSONField(), required=False)
    enabled = serializers.BooleanField(required=False)
    scan_interval_seconds = serializers.IntegerField(required=False)
    max_symbols_per_scan = serializers.IntegerField(required=False)
    alert_cooldown_seconds = serializers.IntegerField(required=False)
    max_alerts_per_symbol_per_hour = serializers.IntegerField(required=False)
    result_retention_hours = serializers.IntegerField(required=False)
    publish_to_redis = serializers.BooleanField(required=False)
    redis_channel_prefix = serializers.CharField(required=False, allow_blank=True)


class ScreenerConfigRequestSerializer(serializers.Serializer):
    config_payload = ScreenerConfigPayloadSerializer()
    change_reason = serializers.CharField(required=False, allow_blank=True)


class ScreenerConfigResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    service = serializers.IntegerField(required=False, allow_null=True)
    service_key = serializers.CharField(required=False)
    config_schema_version = serializers.CharField(required=False)
    config_payload = ScreenerConfigPayloadSerializer()
    applied_by = serializers.CharField(required=False, allow_blank=True)
    applied_at = serializers.DateTimeField(required=False, allow_null=True)
    change_reason = serializers.CharField(required=False, allow_blank=True)
    is_current = serializers.BooleanField()


class ScreenerRuleSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    type = serializers.CharField()
    enabled = serializers.BooleanField()
    threshold = serializers.JSONField(required=False, allow_null=True)
    value = serializers.JSONField(required=False, allow_null=True)


class ScreenerRulesResponseSerializer(serializers.Serializer):
    rules = ScreenerRuleSerializer(many=True)
    total_rules = serializers.IntegerField()


class ScreenerRuleCreateRequestSerializer(serializers.Serializer):
    type = serializers.CharField(required=False, allow_blank=True)
    threshold = serializers.JSONField(required=False, allow_null=True)
    value = serializers.JSONField(required=False, allow_null=True)


class ScreenerRuleCreateResponseSerializer(serializers.Serializer):
    rule_id = serializers.CharField()
    type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    threshold = serializers.JSONField(required=False, allow_null=True)
    created_at = serializers.DateTimeField()


class ScreenerAlertSerializer(serializers.Serializer):
    id = serializers.CharField()
    symbol = serializers.CharField()
    rule = serializers.CharField()
    rule_name = serializers.CharField()
    value = serializers.JSONField()
    message = serializers.CharField()
    timestamp = serializers.DateTimeField()


class ScreenerResultsResponseSerializer(serializers.Serializer):
    scan_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    timestamp = serializers.DateTimeField(required=False, allow_null=True)
    symbols_scanned = serializers.IntegerField()
    alerts_triggered = serializers.IntegerField()
    symbols_matched = ScreenerAlertSerializer(many=True)


class ScreenerAlertHistoryResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True, required=False)
    previous = serializers.CharField(allow_null=True, required=False)
    results = ScreenerAlertSerializer(many=True)


PAGINATION_PARAMETERS = [
    OpenApiParameter(
        name='page',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description='Trang kết quả (mặc định 1).',
        required=False,
    ),
    OpenApiParameter(
        name='page_size',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description='Số kết quả mỗi trang (mặc định 20, tối đa 100).',
        required=False,
    ),
]


class ScreenerManualScanRequestSerializer(serializers.Serializer):
    symbols = serializers.ListField(child=serializers.CharField(), required=False)


class ScreenerManualScanResponseSerializer(serializers.Serializer):
    scan_id = serializers.CharField()
    symbols_count = serializers.IntegerField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    run_log_id = serializers.IntegerField()


class ScreenerOwnershipResponseSerializer(serializers.Serializer):
    domain = serializers.CharField()
    mode = serializers.CharField()
    writer = serializers.CharField(required=False, allow_blank=True)
    owner_team = serializers.CharField(required=False, allow_blank=True)
    write_surface = serializers.CharField(required=False, allow_blank=True)
    can_apply = serializers.BooleanField()
    locked_fields = serializers.ListField(child=serializers.CharField())
    compatibility_domains = serializers.ListField(child=serializers.CharField())
    write_block_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


def _get_screener_config() -> ScreenerDomainConfig:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return ScreenerDomainConfig.from_dict(current_config.config_payload)
    except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
        pass
    return ScreenerDomainConfig()


def _get_recent_signal_alerts(limit: int | None = None):
    queryset = UnifiedAlert.objects.filter(
        alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
    ).order_by('-triggered_at', '-pk')
    if limit is not None:
        return queryset[:limit]
    return queryset


def _serialize_signal_alert(alert: UnifiedAlert) -> dict:
    rule_name = (
        alert.metadata.get('rule_name')
        or alert.metadata.get('rule')
        or alert.title
        or 'signal'
    )
    return {
        'id': str(alert.alert_id),
        'symbol': alert.symbol,
        'rule': rule_name,
        'rule_name': rule_name,
        'value': alert.value,
        'message': alert.body or alert.title,
        'timestamp': alert.triggered_at.isoformat(),
    }


def _build_screener_ownership_payload() -> dict:
    matrix = build_ownership_matrix_from_db()
    payload = matrix.to_response_dict('screener')
    payload['write_block_reason'] = matrix.get_write_block_reason('screener')
    return payload


def _build_default_screener_config_response() -> dict:
    default = ScreenerDomainConfig()
    return {
        'service_key': SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'],
        'config_schema_version': '1.0',
        'config_payload': default.to_dict(),
        'applied_by': 'system',
        'applied_at': None,
        'change_reason': '',
        'is_current': True,
    }


@extend_schema_view(
    get=extend_schema(
        summary='Lấy runtime config Screener',
        description='Trả về config hiệu lực của domain Screener cùng metadata áp dụng hiện tại.',
        responses={
            200: ScreenerConfigResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
    post=extend_schema(
        summary='Apply runtime config Screener',
        description='Áp dụng config mới cho Global Screener và trả snapshot config hiện hành.',
        request=ScreenerConfigRequestSerializer,
        responses={
            201: ScreenerConfigResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
)
class ScreenerConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST /api/soc/screener/config/"""

    def get(self, request):
        """GET current screener config."""
        try:
            service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                return Response(ServiceConfigSerializer(current_config).data)
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        return Response(_build_default_screener_config_response())

    def post(self, request):
        """POST apply screener config."""
        config_payload = request.data.get('config_payload', {})
        result = self.apply_config(
            request,
            service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'],
            domain='screener',
            config_payload=config_payload,
            config_class=ScreenerDomainConfig,
        )
        if isinstance(result, Response):
            return result
        service, svc_config = result
        return Response(
            ServiceConfigSerializer(svc_config).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    get=extend_schema(
        summary='Lấy rules Screener',
        description='Trả về danh sách rule đang active trong config Screener hiện tại.',
        responses={
            200: ScreenerRulesResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
    post=extend_schema(
        summary='Tạo rule Screener',
        description='Tạo một rule tạm thời theo contract hiện tại của surface Screener.',
        request=ScreenerRuleCreateRequestSerializer,
        responses={
            201: ScreenerRuleCreateResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
)
class ScreenerRulesView(SOCBaseView):
    """GET /api/soc/screener/rules/"""

    def get(self, request):
        """List active screening rules."""
        config = _get_screener_config()
        rules = [
            {
                'id': rule.get('id') or f'rule_{index + 1}',
                'name': rule.get('name') or rule.get('type') or f'Rule {index + 1}',
                'type': rule.get('type', 'custom'),
                'enabled': rule.get('enabled', True),
                'threshold': rule.get('threshold'),
                'value': rule.get('value'),
            }
            for index, rule in enumerate(config.rules)
        ]
        return Response({
            'rules': rules,
            'total_rules': len(rules),
        })

    def post(self, request):
        """Add new screening rule."""
        rule_type = request.data.get('type')
        threshold = request.data.get('threshold')
        return Response({
            'rule_id': 'rule_123',
            'type': rule_type,
            'threshold': threshold,
            'created_at': timezone.now().isoformat(),
        }, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Lấy kết quả scan Screener',
    description='Trả về latest scan results dựa trên signal alerts gần nhất của Screener.',
    responses={
        200: ScreenerResultsResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerResultsView(SOCBaseView):
    """GET /api/soc/screener/results/"""

    def get(self, request):
        """Latest scan results."""
        alerts = list(_get_recent_signal_alerts(limit=20))
        symbols_matched = [_serialize_signal_alert(alert) for alert in alerts]
        latest_timestamp = alerts[0].triggered_at.isoformat() if alerts else None
        return Response({
            'scan_id': alerts[0].source_ref if alerts and alerts[0].source_ref else None,
            'timestamp': latest_timestamp,
            'symbols_scanned': len({alert.symbol for alert in alerts}),
            'alerts_triggered': len(alerts),
            'symbols_matched': symbols_matched,
        })


@extend_schema(
    summary='Lấy alert history Screener',
    description='Trả về lịch sử signal alerts có pagination của surface Screener.',
    parameters=PAGINATION_PARAMETERS,
    responses={
        200: ScreenerAlertHistoryResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerAlertHistoryView(SOCBaseView):
    """GET /api/soc/screener/alert-history/"""

    def get(self, request):
        """Alert history with pagination."""
        queryset = _get_recent_signal_alerts()
        page = self.paginate_queryset(queryset, request)
        alerts = [_serialize_signal_alert(alert) for alert in page]
        paginated_response = self.get_paginated_response(alerts)
        return paginated_response


@extend_schema(
    summary='Queue manual scan Screener',
    description='Queue một manual scan cho danh sách symbol được chỉ định.',
    request=ScreenerManualScanRequestSerializer,
    responses={
        202: ScreenerManualScanResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        429: OpenApiTypes.OBJECT,
    },
)
class ScreenerManualScanView(SOCBaseView):
    """POST /api/soc/screener/manual-scan/"""

    def post(self, request):
        """Trigger manual screener scan."""
        symbols = request.data.get('symbols', [])
        dispatcher_service = get_registered_service('screener_scan_dispatcher')
        run_log = ServiceRunLog.objects.create(
            service=dispatcher_service,
            status='queued',
            input_summary={
                'symbols': symbols,
                'requested_by': getattr(request.user, 'username', 'api'),
            },
            output_summary={},
        )
        return Response({
            'scan_id': f'scan_{run_log.id}',
            'symbols_count': len(symbols),
            'status': 'queued',
            'created_at': run_log.started_at.isoformat(),
            'run_log_id': run_log.id,
        }, status=status.HTTP_202_ACCEPTED)


@extend_schema(
    summary='Queue rules run Screener',
    description='Spec-compatible alias của manual scan cho Screener.',
    request=ScreenerManualScanRequestSerializer,
    responses={
        202: ScreenerManualScanResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerRulesRunView(ScreenerManualScanView):
    """POST /api/soc/screener/rules/run/ — spec-compatible alias of manual scan."""

    def post(self, request):
        return super().post(request)


@extend_schema(
    summary='Lấy ownership Screener',
    description='Trả về ownership matrix cho domain Screener để xác định khả năng apply config từ SOC.',
    responses={
        200: ScreenerOwnershipResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerOwnershipView(SOCBaseView):
    """GET /api/soc/screener/ownership/"""

    def get(self, request):
        return Response(_build_screener_ownership_payload())
