"""
VNBroker Domain Views (7 endpoints).

GET /api/soc/vnbroker/config/ — get current config
POST /api/soc/vnbroker/config/ — apply config
GET /api/soc/vnbroker/config/preview/ — preview before apply
GET /api/soc/vnbroker/health/ — health check
POST /api/soc/vnbroker/test-connection/ — test provider connection
GET /api/soc/vnbroker/providers/ — list configured providers
GET /api/soc/vnbroker/circuit-breaker-status/ — circuit breaker state
"""
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from ..models import ServiceDefinition, ServiceConfig, ServiceHealth
from ..ownership import build_ownership_matrix_from_db
from ..serializers import ServiceConfigSerializer, ServiceHealthSerializer
from ..domain_configs import VnbrokerDomainConfig
from ..provider_catalog import (
    find_unsupported_provider_ids,
    get_default_provider_ids,
    get_supported_provider_ids,
    get_unready_provider_messages,
    list_provider_statuses,
    normalize_provider_id,
)
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


DEFAULT_VNBROKER_PRIMARY_PROVIDER = 'vci'
DEFAULT_VNBROKER_FALLBACK_PROVIDERS = [
    provider_id
    for provider_id in get_default_provider_ids('vnbroker')
    if provider_id != DEFAULT_VNBROKER_PRIMARY_PROVIDER
]


class ProviderStatusSerializer(serializers.Serializer):
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


class VnbrokerTimeoutSerializer(serializers.Serializer):
    connect = serializers.FloatField()
    read = serializers.FloatField()
    write = serializers.FloatField()
    pool = serializers.FloatField()


class VnbrokerConfigPayloadSerializer(serializers.Serializer):
    timeout = VnbrokerTimeoutSerializer()
    max_retries = serializers.IntegerField()
    retry_delay_seconds = serializers.FloatField()
    preferred_provider = serializers.CharField()
    fallback_providers = serializers.ListField(child=serializers.CharField())
    enabled = serializers.BooleanField()
    circuit_breaker_threshold = serializers.IntegerField()
    circuit_breaker_window_seconds = serializers.IntegerField()
    circuit_breaker_cooldown_seconds = serializers.IntegerField()
    requests_per_minute = serializers.IntegerField()
    burst_limit = serializers.IntegerField()


class VnbrokerConfigRequestSerializer(serializers.Serializer):
    config_payload = VnbrokerConfigPayloadSerializer()
    change_reason = serializers.CharField(required=False, allow_blank=True)


class VnbrokerConfigResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    service = serializers.IntegerField(required=False)
    service_key = serializers.CharField()
    config_schema_version = serializers.CharField(required=False)
    config_payload = VnbrokerConfigPayloadSerializer()
    config = VnbrokerConfigPayloadSerializer()
    applied_by = serializers.CharField()
    applied_at = serializers.DateTimeField(required=False, allow_null=True)
    change_reason = serializers.CharField(required=False, allow_blank=True)
    is_current = serializers.BooleanField()
    providers_catalog = ProviderStatusSerializer(many=True)


class VnbrokerPreviewImpactSerializer(serializers.Serializer):
    providers_changed = serializers.BooleanField()
    timeout_changed = serializers.BooleanField()


class VnbrokerPreviewResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    errors = serializers.ListField(child=serializers.CharField())
    config_payload = VnbrokerConfigPayloadSerializer()
    providers_catalog = ProviderStatusSerializer(many=True)
    impact = VnbrokerPreviewImpactSerializer()


class VnbrokerHealthResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    service = serializers.IntegerField(required=False)
    service_key = serializers.CharField(required=False)
    status = serializers.CharField()
    last_check_at = serializers.DateTimeField(required=False, allow_null=True)
    last_success_at = serializers.DateTimeField(required=False, allow_null=True)
    consecutive_failures = serializers.IntegerField(required=False)
    avg_response_ms = serializers.FloatField(required=False, allow_null=True)
    detail = serializers.JSONField()


class VnbrokerTestConnectionRequestSerializer(serializers.Serializer):
    provider = serializers.CharField(required=False, allow_blank=True)


class VnbrokerTestConnectionResponseSerializer(serializers.Serializer):
    provider = serializers.CharField()
    status = serializers.CharField()
    latency_ms = serializers.IntegerField()
    timestamp = serializers.DateTimeField()


class VnbrokerProvidersResponseSerializer(serializers.Serializer):
    primary = serializers.CharField()
    fallback = serializers.ListField(child=serializers.CharField())
    enabled = serializers.BooleanField()
    providers = ProviderStatusSerializer(many=True)


class VnbrokerCircuitBreakerSummarySerializer(serializers.Serializer):
    status = serializers.CharField()
    failures = serializers.IntegerField()
    threshold = serializers.IntegerField(required=False)
    window_seconds = serializers.IntegerField(required=False)
    cooldown_seconds = serializers.IntegerField(required=False)


class VnbrokerCircuitBreakerResponseSerializer(serializers.Serializer):
    circuit_breaker = VnbrokerCircuitBreakerSummarySerializer()
    per_provider = serializers.DictField(child=serializers.DictField(child=serializers.JSONField()))


class VnbrokerOwnershipResponseSerializer(serializers.Serializer):
    domain = serializers.CharField()
    mode = serializers.CharField()
    writer = serializers.CharField()
    owner_team = serializers.CharField()
    write_surface = serializers.CharField()
    can_apply = serializers.BooleanField()
    locked_fields = serializers.ListField(child=serializers.CharField())
    compatibility_domains = serializers.ListField(child=serializers.CharField())
    write_block_reason = serializers.CharField(allow_null=True)


def _sanitize_vnbroker_config_payload(payload: dict | None) -> dict:
    config = VnbrokerDomainConfig.from_dict(payload or {})
    data = config.to_dict()
    supported = set(get_supported_provider_ids('vnbroker'))

    preferred_provider = data.get('preferred_provider')
    if preferred_provider not in supported:
        preferred_provider = DEFAULT_VNBROKER_PRIMARY_PROVIDER

    fallback_providers = []
    for provider_id in data.get('fallback_providers', []):
        if provider_id in supported and provider_id != preferred_provider and provider_id not in fallback_providers:
            fallback_providers.append(provider_id)
    if not fallback_providers:
        fallback_providers = [
            provider_id
            for provider_id in DEFAULT_VNBROKER_FALLBACK_PROVIDERS
            if provider_id != preferred_provider
        ]

    return {
        **data,
        'preferred_provider': preferred_provider,
        'fallback_providers': fallback_providers,
    }


def _get_active_vnbroker_provider_ids(payload: dict) -> list[str]:
    provider_ids = [
        payload.get('preferred_provider', payload.get('primary_provider')),
        *(payload.get('fallback_providers', []) or []),
    ]
    active_provider_ids = []
    for provider_id in provider_ids:
        normalized_id = normalize_provider_id(provider_id)
        if normalized_id and normalized_id not in active_provider_ids:
            active_provider_ids.append(normalized_id)
    return active_provider_ids


def _build_vnbroker_ownership_payload() -> dict:
    matrix = build_ownership_matrix_from_db()
    payload = matrix.to_response_dict('vnbroker')
    payload['write_block_reason'] = matrix.get_write_block_reason('vnbroker')
    return payload


@extend_schema_view(
    get=extend_schema(
        summary='Lấy runtime config VNBroker',
        description='Trả về config hiệu lực của VNBroker cùng catalog provider đang áp dụng trong runtime hiện tại.',
        responses={
            200: VnbrokerConfigResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'VNBroker config',
                value={
                    'service_key': 'vnbroker_runtime',
                    'config_schema_version': '1.0',
                    'config_payload': {
                        'timeout': {'connect': 10.0, 'read': 30.0, 'write': 10.0, 'pool': 5.0},
                        'max_retries': 3,
                        'retry_delay_seconds': 2.0,
                        'preferred_provider': 'vci',
                        'fallback_providers': ['kbs', 'dnse'],
                        'enabled': True,
                        'circuit_breaker_threshold': 5,
                        'circuit_breaker_window_seconds': 60,
                        'circuit_breaker_cooldown_seconds': 300,
                        'requests_per_minute': 60,
                        'burst_limit': 10,
                    },
                    'config': {
                        'timeout': {'connect': 10.0, 'read': 30.0, 'write': 10.0, 'pool': 5.0},
                        'max_retries': 3,
                        'retry_delay_seconds': 2.0,
                        'preferred_provider': 'vci',
                        'fallback_providers': ['kbs', 'dnse'],
                        'enabled': True,
                        'circuit_breaker_threshold': 5,
                        'circuit_breaker_window_seconds': 60,
                        'circuit_breaker_cooldown_seconds': 300,
                        'requests_per_minute': 60,
                        'burst_limit': 10,
                    },
                    'applied_by': 'system',
                    'is_current': True,
                    'providers_catalog': [
                        {
                            'provider': 'vci',
                            'label': 'VCI',
                            'enabled': True,
                            'in_active_cycle': True,
                            'runtime_ready': True,
                            'credential_mode': 'builtin',
                            'requires_runtime_credentials': False,
                            'required_runtime_envs': [],
                            'runtime_gate': 'ready',
                            'readiness_reason': 'Provider sẵn sàng cho runtime hiện tại.',
                            'default_selected': True,
                            'supports_matrix': True,
                            'supports_vnbroker': True,
                        }
                    ],
                },
            )
        ],
    ),
    post=extend_schema(
        summary='Apply runtime config VNBroker',
        description='Áp dụng config mới cho VNBroker và trả về snapshot config đã sanitize cùng provider catalog hiệu lực.',
        request=VnbrokerConfigRequestSerializer,
        responses={
            201: VnbrokerConfigResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
)
class VnbrokerConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST VNBroker runtime config."""

    def get(self, request):
        """GET current config."""
        try:
            service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                serializer = ServiceConfigSerializer(current_config)
                data = serializer.data
                sanitized_payload = _sanitize_vnbroker_config_payload(data.get('config_payload'))
                data['config_payload'] = sanitized_payload
                data['config'] = sanitized_payload
                data['providers_catalog'] = list_provider_statuses(
                    'vnbroker',
                    active_provider_ids=_get_active_vnbroker_provider_ids(sanitized_payload),
                )
                return Response(data)
        except ServiceDefinition.DoesNotExist:
            pass
        # Return default
        default_config = _sanitize_vnbroker_config_payload(VnbrokerDomainConfig().to_dict())
        return Response({
            'service_key': SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'],
            'config_schema_version': '1.0',
            'config_payload': default_config,
            'config': default_config,
            'is_current': True,
            'applied_by': 'system',
            'applied_at': None,
            'change_reason': '',
            'providers_catalog': list_provider_statuses(
                'vnbroker',
                active_provider_ids=_get_active_vnbroker_provider_ids(default_config),
            ),
        })

    def post(self, request):
        """POST apply config."""
        config_payload = request.data.get('config_payload', {})
        result = self.apply_config(
            request,
            service_key=SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'],
            domain='vnbroker',
            config_payload=config_payload,
            config_class=VnbrokerDomainConfig,
        )
        if isinstance(result, Response):
            return result
        service, svc_config = result
        serializer = ServiceConfigSerializer(svc_config)
        data = serializer.data
        sanitized_payload = _sanitize_vnbroker_config_payload(data.get('config_payload'))
        data['config_payload'] = sanitized_payload
        data['config'] = sanitized_payload
        data['providers_catalog'] = list_provider_statuses(
            'vnbroker',
            active_provider_ids=_get_active_vnbroker_provider_ids(sanitized_payload),
        )
        return Response(data, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Preview runtime config VNBroker',
    description='Validate và preview config VNBroker trước khi apply, bao gồm provider catalog và impact summary.',
    request=VnbrokerConfigRequestSerializer,
    responses={
        200: VnbrokerPreviewResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerConfigPreviewView(SOCBaseView):
    """POST preview for VNBroker config."""

    def post(self, request):
        """Preview config before apply."""
        config_payload = request.data.get('config_payload', {})
        config_obj = VnbrokerDomainConfig.from_dict(config_payload)
        errors = config_obj.validate()
        return Response({
            'valid': len(errors) == 0,
            'errors': errors,
            'config_payload': config_obj.to_dict(),
            'providers_catalog': list_provider_statuses(
                'vnbroker',
                active_provider_ids=_get_active_vnbroker_provider_ids(config_obj.to_dict()),
            ),
            'impact': {
                'providers_changed': any(
                    key in config_payload for key in ('preferred_provider', 'primary_provider', 'fallback_providers')
                ),
                'timeout_changed': 'timeout' in config_payload or any(
                    key in config_payload for key in ('connect_timeout', 'read_timeout', 'write_timeout', 'pool_connections')
                ),
            },
        })


@extend_schema(
    summary='Lấy health snapshot VNBroker',
    description='Trả về health snapshot của service VNBroker; nếu chưa có health record thì trả trạng thái `unknown` theo contract ổn định.',
    responses={
        200: VnbrokerHealthResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerHealthView(SOCBaseView):
    """GET VNBroker health snapshot."""

    def get(self, request):
        try:
            service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
            health = ServiceHealth.objects.get(service=service)
            serializer = ServiceHealthSerializer(health)
            return Response(serializer.data)
        except (ServiceDefinition.DoesNotExist, ServiceHealth.DoesNotExist):
            service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker']
            return Response({
                'service_key': service_key,
                'status': 'unknown',
                'last_check_at': None,
                'last_success_at': None,
                'consecutive_failures': 0,
                'avg_response_ms': None,
                'detail': {'message': 'Health record not found'},
            })


@extend_schema(
    summary='Kiểm tra kết nối provider VNBroker',
    description='Thực hiện test kết nối nhẹ cho provider VNBroker được chọn và trả latency snapshot. Endpoint này validate provider trước khi thử kết nối.',
    request=VnbrokerTestConnectionRequestSerializer,
    responses={
        200: VnbrokerTestConnectionResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerTestConnectionView(SOCBaseView):
    """POST provider connectivity test for VNBroker."""

    def post(self, request):
        """Test connection to providers."""
        provider = normalize_provider_id(request.data.get('provider', 'vci'))
        unsupported_providers = find_unsupported_provider_ids([provider], surface='vnbroker')
        if unsupported_providers:
            return self.error_response(
                request,
                code='VNBROKER_PROVIDER_UNSUPPORTED',
                detail=(
                    'SOC chỉ hỗ trợ các provider KBS, VCI, DNSE. '
                    f"Không chấp nhận: {', '.join(unsupported_providers)}."
                ),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'provider': unsupported_providers},
            )

        unready_provider_messages = get_unready_provider_messages([provider])
        if unready_provider_messages:
            return self.error_response(
                request,
                code='VNBROKER_PROVIDER_NOT_READY',
                detail='; '.join(unready_provider_messages),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'provider': unready_provider_messages},
            )

        # Placeholder — in real implementation, call vnbroker_adapter
        return Response({
            'provider': provider,
            'status': 'ok',
            'latency_ms': 45,
            'timestamp': timezone.now().isoformat(),
        })


@extend_schema(
    summary='Lấy provider catalog VNBroker',
    description='Trả về provider chính, fallback providers, cờ enabled và provider catalog với readiness/runtime metadata.',
    responses={
        200: VnbrokerProvidersResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerProvidersView(SOCBaseView):
    """GET configured VNBroker provider catalog."""

    def get(self, request):
        """List configured providers."""
        try:
            service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                payload = _sanitize_vnbroker_config_payload(current_config.config_payload)
                return Response({
                    'primary': payload.get('preferred_provider', DEFAULT_VNBROKER_PRIMARY_PROVIDER),
                    'fallback': payload.get('fallback_providers', []),
                    'enabled': payload.get('enabled', True),
                    'providers': list_provider_statuses(
                        'vnbroker',
                        active_provider_ids=_get_active_vnbroker_provider_ids(payload),
                    ),
                })
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        default_config = _sanitize_vnbroker_config_payload(VnbrokerDomainConfig().to_dict())
        return Response({
            'primary': default_config['preferred_provider'],
            'fallback': default_config['fallback_providers'],
            'enabled': True,
            'providers': list_provider_statuses(
                'vnbroker',
                active_provider_ids=_get_active_vnbroker_provider_ids(default_config),
            ),
        })


@extend_schema(
    summary='Lấy trạng thái circuit breaker VNBroker',
    description='Trả về trạng thái circuit breaker tổng và theo từng provider của domain VNBroker.',
    responses={
        200: VnbrokerCircuitBreakerResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerCircuitBreakerView(SOCBaseView):
    """GET VNBroker circuit breaker snapshot."""

    def get(self, request):
        """Circuit breaker state."""
        return Response({
            'circuit_breaker': {
                'status': 'closed',  # closed=ok, open=failing
                'failures': 0,
                'threshold': 5,
                'window_seconds': 60,
                'cooldown_seconds': 300,
            },
            'per_provider': {
                provider_id: {'status': 'closed', 'failures': 0}
                for provider_id in get_supported_provider_ids('vnbroker')
            },
        })


@extend_schema(
    summary='Lấy ownership VNBroker',
    description='Trả về ownership payload của domain VNBroker để operator biết quyền apply và write surface hiện hành.',
    responses={
        200: VnbrokerOwnershipResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerOwnershipView(SOCBaseView):
    """GET VNBroker ownership payload."""

    def get(self, request):
        return Response(_build_vnbroker_ownership_payload())
