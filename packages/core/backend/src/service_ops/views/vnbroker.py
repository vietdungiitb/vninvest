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
from django.utils import timezone
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import serializers, status
from rest_framework.response import Response

from market_data.vnbroker_benchmark import (
    get_latest_price_board_benchmark_report,
    run_price_board_provider_benchmark,
)
from market_data.vnbroker_provider_health import (
    build_provider_health_payload,
    get_circuit_snapshot,
    probe_provider,
)
from vninvest_core.api_envelope import envelope_response

from ..domain_configs import VnbrokerDomainConfig
from ..envelope import envelope
from ..models import ServiceConfig, ServiceDefinition, ServiceHealth
from ..ownership import build_ownership_matrix_from_db
from ..provider_catalog import (
    find_unsupported_provider_ids,
    get_default_provider_ids,
    get_supported_provider_ids,
    get_unready_provider_messages,
    list_provider_statuses,
    normalize_provider_id,
)
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from ..serializers import ServiceConfigSerializer, ServiceHealthSerializer
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


class VnbrokerProviderConfigSerializer(serializers.Serializer):
    """Cấu hình riêng cho từng provider."""
    timeout = VnbrokerTimeoutSerializer(required=False, allow_null=True)
    max_retries = serializers.IntegerField(required=False, allow_null=True)
    retry_delay_seconds = serializers.FloatField(required=False, allow_null=True)
    requests_per_minute = serializers.IntegerField(required=False, allow_null=True)
    burst_limit = serializers.IntegerField(required=False, allow_null=True)


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
    per_provider_config = serializers.DictField(
        child=VnbrokerProviderConfigSerializer(required=False, allow_null=True),
        required=False
    )


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


class VnbrokerProviderHealthRowSerializer(serializers.Serializer):
    provider = serializers.CharField()
    label = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    latency_ms = serializers.FloatField(allow_null=True)
    success_rate = serializers.FloatField(allow_null=True)
    error_rate = serializers.FloatField(allow_null=True)
    total_requests = serializers.IntegerField()
    failed_requests = serializers.IntegerField()
    rate_limited_requests = serializers.IntegerField()
    consecutive_failures = serializers.IntegerField()
    last_success_at = serializers.DateTimeField(allow_null=True)
    last_check_at = serializers.DateTimeField(allow_null=True)
    last_error = serializers.CharField(allow_blank=True)
    circuit_state = serializers.CharField()


class VnbrokerProviderHealthResponseSerializer(serializers.Serializer):
    checked_at = serializers.DateTimeField()
    source = serializers.CharField()
    providers = VnbrokerProviderHealthRowSerializer(many=True)


class VnbrokerBenchmarkRequestSerializer(serializers.Serializer):
    provider = serializers.CharField(required=False, allow_blank=True)
    providers = serializers.ListField(child=serializers.CharField(), required=False)
    symbol = serializers.CharField(required=False, allow_blank=True)
    duration_seconds = serializers.IntegerField(required=False)
    runs = serializers.IntegerField(required=False)
    timeout_seconds = serializers.IntegerField(required=False)
    concurrency_levels = serializers.ListField(child=serializers.IntegerField(), required=False)


class VnbrokerBenchmarkResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    has_report = serializers.BooleanField(required=False)
    report = serializers.JSONField(required=False)


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
            200: envelope_response(VnbrokerConfigResponseSerializer),
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
                return envelope(data)
        except ServiceDefinition.DoesNotExist:
            pass
        # Return default
        default_config = _sanitize_vnbroker_config_payload(VnbrokerDomainConfig().to_dict())
        return envelope({
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
            # `apply_config` chỉ trả Response khi lỗi (RFC 9457) — không bọc.
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
        return envelope(data, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Preview runtime config VNBroker',
    description='Validate và preview config VNBroker trước khi apply, bao gồm provider catalog và impact summary.',
    request=VnbrokerConfigRequestSerializer,
    responses={
        200: envelope_response(VnbrokerPreviewResponseSerializer),
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
        return envelope({
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
        200: envelope_response(VnbrokerHealthResponseSerializer),
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
            return envelope(serializer.data)
        except (ServiceDefinition.DoesNotExist, ServiceHealth.DoesNotExist):
            service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker']
            return envelope({
                'service_key': service_key,
                'status': 'unknown',
                'last_check_at': None,
                'last_success_at': None,
                'consecutive_failures': 0,
                'avg_response_ms': None,
                'detail': {'message': 'Health record not found'},
            })


@extend_schema(
    summary='Lấy sức khỏe theo từng nhà cung cấp VNBroker',
    description=(
        'Trả sức khỏe runtime đo THẬT của từng provider (độ trễ, tỉ lệ thành công, '
        'lỗi liên tiếp, trạng thái circuit breaker). Không có dữ liệu thì trả '
        '`source=unavailable` và mảng rỗng — KHÔNG tự chế số liệu.'
    ),
    responses={
        200: envelope_response(VnbrokerProviderHealthResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerProviderHealthView(SOCBaseView):
    """GET sức khỏe per-provider của VNBroker."""

    def get(self, request):
        return envelope(build_provider_health_payload())


@extend_schema(
    summary='Kiểm tra kết nối provider VNBroker',
    description='Thực hiện test kết nối nhẹ cho provider VNBroker được chọn và trả latency snapshot. Endpoint này validate provider trước khi thử kết nối.',
    request=VnbrokerTestConnectionRequestSerializer,
    responses={
        200: envelope_response(VnbrokerTestConnectionResponseSerializer),
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

        # Gọi provider THẬT và đo độ trễ. Trước 2026-10-19 endpoint này trả
        # `latency_ms: 45` cứng (placeholder) ⇒ nút "Thử nghiệm kết nối" LUÔN
        # báo thành công dù provider đã chết (audit Entry 384 §D1 F-07).
        probe = probe_provider(provider)
        payload = {
            'provider': probe.get('provider', provider),
            'status': probe.get('status', 'error'),
            'latency_ms': probe.get('latency_ms'),
            'error': probe.get('error', ''),
            'timestamp': timezone.now().isoformat(),
        }
        if probe.get('status') != 'ok':
            return self.error_response(
                request,
                code='VNBROKER_PROVIDER_UNREACHABLE',
                detail=probe.get('error') or 'Không gọi được provider.',
                http_status=status.HTTP_502_BAD_GATEWAY,
                field_errors={'provider': [probe.get('error') or 'unreachable']},
            )
        return envelope(payload)


@extend_schema(
    summary='Lấy provider catalog VNBroker',
    description='Trả về provider chính, fallback providers, cờ enabled và provider catalog với readiness/runtime metadata.',
    responses={
        200: envelope_response(VnbrokerProvidersResponseSerializer),
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
                return envelope({
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
        return envelope({
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
        200: envelope_response(VnbrokerCircuitBreakerResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerCircuitBreakerView(SOCBaseView):
    """GET VNBroker circuit breaker snapshot."""

    def get(self, request):
        """Circuit breaker state."""
        # Nguồn THẬT: đọc state circuit breaker theo provider do
        # `market_data.vnbroker_provider_health` ghi khi gọi provider.
        # Trước 2026-10-19 endpoint này trả `closed` / `failures: 0` cứng ⇒
        # badge "CLOSED" luôn xanh giả (audit Entry 384 §D1 F-04).
        return envelope(get_circuit_snapshot())


@extend_schema(
    summary='Lấy ownership VNBroker',
    description='Trả về ownership payload của domain VNBroker để operator biết quyền apply và write surface hiện hành.',
    responses={
        200: envelope_response(VnbrokerOwnershipResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerOwnershipView(SOCBaseView):
    """GET VNBroker ownership payload."""

    def get(self, request):
        return envelope(_build_vnbroker_ownership_payload())


@extend_schema(
    summary='Benchmark provider VNBroker',
    description='Chạy benchmark price-board cho provider VNBroker (KBS/VCI/DNSE) và trả kết quả + runtime recommendation.',
    request=VnbrokerBenchmarkRequestSerializer,
    responses={
        200: envelope_response(VnbrokerBenchmarkResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class VnbrokerBenchmarkView(SOCBaseView):
    """GET latest benchmark report; POST run benchmark and return the latest report."""

    def get(self, request):
        report = get_latest_price_board_benchmark_report()
        if not isinstance(report, dict):
            return envelope({'has_report': False, 'report': None})
        return envelope({'has_report': True, 'report': report})

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        supported = set(get_supported_provider_ids('vnbroker'))

        normalized_provider = normalize_provider_id(payload.get('provider'))
        normalized_providers = [
            normalize_provider_id(provider_id)
            for provider_id in (payload.get('providers') or [])
            if normalize_provider_id(provider_id)
        ]

        if normalized_provider:
            normalized_providers = [normalized_provider]

        unsupported = [provider_id for provider_id in normalized_providers if provider_id not in supported]
        if unsupported:
            return self.error_response(
                request,
                code='VNBROKER_PROVIDER_UNSUPPORTED',
                detail=(
                    'SOC chỉ hỗ trợ benchmark cho provider KBS, VCI, DNSE. '
                    f"Không chấp nhận: {', '.join(unsupported)}."
                ),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'provider': unsupported},
            )

        benchmark_payload = {
            key: value
            for key, value in payload.items()
            if key in {'symbol', 'duration_seconds', 'runs', 'timeout_seconds', 'concurrency_levels'}
        }
        if normalized_providers:
            benchmark_payload['providers'] = [provider_id.upper() for provider_id in normalized_providers]

        try:
            report = run_price_board_provider_benchmark(benchmark_payload)
        except Exception as exc:
            return self.error_response(
                request,
                code='VNBROKER_BENCHMARK_FAILED',
                detail=f'Không thể chạy benchmark VNBroker: {exc}',
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        return envelope({'has_report': True, 'report': report})
