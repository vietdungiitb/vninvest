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
from rest_framework import status
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


class VnbrokerConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST /api/soc/vnbroker/config/"""

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
            'config_payload': default_config,
            'config': default_config,
            'is_current': True,
            'applied_by': 'system',
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
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VnbrokerConfigPreviewView(SOCBaseView):
    """GET /api/soc/vnbroker/config/preview/"""

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


class VnbrokerHealthView(SOCBaseView):
    """GET /api/soc/vnbroker/health/"""

    def get(self, request):
        try:
            service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['vnbroker'])
            health = ServiceHealth.objects.get(service=service)
            serializer = ServiceHealthSerializer(health)
            return Response(serializer.data)
        except (ServiceDefinition.DoesNotExist, ServiceHealth.DoesNotExist):
            return Response({
                'status': 'unknown',
                'detail': 'Health record not found',
            })


class VnbrokerTestConnectionView(SOCBaseView):
    """POST /api/soc/vnbroker/test-connection/"""

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


class VnbrokerProvidersView(SOCBaseView):
    """GET /api/soc/vnbroker/providers/"""

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


class VnbrokerCircuitBreakerView(SOCBaseView):
    """GET /api/soc/vnbroker/circuit-breaker-status/"""

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


class VnbrokerOwnershipView(SOCBaseView):
    """GET /api/soc/vnbroker/ownership/"""

    def get(self, request):
        return Response(_build_vnbroker_ownership_payload())
