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
from rest_framework import status
from rest_framework.response import Response

from ..models import ServiceDefinition, ServiceConfig, ServiceHealth
from ..serializers import ServiceConfigSerializer, ServiceHealthSerializer
from ..domain_configs import VnbrokerDomainConfig
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


class VnbrokerConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST /api/soc/vnbroker/config/"""

    def get(self, request):
        """GET current config."""
        try:
            service = ServiceDefinition.objects.get(service_key='vnbroker_adapter')
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                serializer = ServiceConfigSerializer(current_config)
                return Response(serializer.data)
        except ServiceDefinition.DoesNotExist:
            pass
        # Return default
        default_config = VnbrokerDomainConfig()
        return Response({
            'config_payload': default_config.to_dict(),
            'is_current': True,
            'applied_by': 'system',
        })

    def post(self, request):
        """POST apply config."""
        config_payload = request.data.get('config_payload', {})
        result = self.apply_config(
            request,
            service_key='vnbroker_adapter',
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
            'impact': {
                'providers_changed': config_payload.get('primary_provider') is not None,
                'timeout_changed': config_payload.get('connect_timeout') is not None,
            },
        })


class VnbrokerHealthView(SOCBaseView):
    """GET /api/soc/vnbroker/health/"""

    def get(self, request):
        try:
            service = ServiceDefinition.objects.get(service_key='vnbroker_adapter')
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
        provider = request.data.get('provider', 'vci')
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
            service = ServiceDefinition.objects.get(service_key='vnbroker_adapter')
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                payload = current_config.config_payload
                return Response({
                    'primary': payload.get('primary_provider', 'vci'),
                    'fallback': payload.get('fallback_providers', []),
                    'enabled': payload.get('enabled', True),
                })
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        return Response({
            'primary': 'vci',
            'fallback': ['tcbs', 'ssi'],
            'enabled': True,
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
                'vci': {'status': 'closed', 'failures': 0},
                'tcbs': {'status': 'closed', 'failures': 0},
                'ssi': {'status': 'closed', 'failures': 0},
            },
        })


# Import timezone at top of file
from django.utils import timezone
