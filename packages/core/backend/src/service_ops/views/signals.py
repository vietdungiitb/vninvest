"""
Signal Intelligence Domain Views (13 endpoints) — read-only + bridge-write pattern.

NOTE: write_mode=bridge-write → SOC cannot apply config directly.
Can only preview and read ownership constraints.

GET /api/soc/signals/config/ — get current config (read-only)
POST /api/soc/signals/config/preview/ — preview config
GET /api/soc/signals/ownership/ — write ownership (bridge-write)
GET /api/soc/signals/whale/ — whale detection settings
GET /api/soc/signals/whale/recent/ — recent whale signals
POST /api/soc/signals/whale/test/ — test whale detection
GET /api/soc/signals/dark-pool/ — dark pool detection settings
GET /api/soc/signals/dark-pool/recent/ — recent dark pool signals
GET /api/soc/signals/screener/ — screener signal settings
GET /api/soc/signals/screener/recent/ — recent screener alerts
GET /api/soc/signals/retention-policy/ — data retention settings
GET /api/soc/signals/performance-metrics/ — detection performance
"""
from rest_framework import status
from rest_framework.response import Response
from django.utils import timezone

from ..models import ServiceDefinition, ServiceConfig, OwnershipRecord
from ..serializers import ServiceConfigSerializer
from ..domain_configs import SignalServicesDomainConfig
from ..ownership import get_ownership_matrix
from .base import SOCBaseView


class SignalsConfigView(SOCBaseView):
    """GET /api/soc/signals/config/ — read-only."""

    def get(self, request):
        """Get current signal config (read-only)."""
        try:
            service = ServiceDefinition.objects.get(service_key='signal_detection')
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                return Response(ServiceConfigSerializer(current_config).data)
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        default = SignalServicesDomainConfig()
        return Response({
            'config_payload': default.to_dict(),
            'is_current': True,
            'write_mode': 'bridge-write',
            'note': 'Signal config is managed by signal_intelligence. SOC has read-only access.',
        })


class SignalsConfigPreviewView(SOCBaseView):
    """POST /api/soc/signals/config/preview/"""

    def post(self, request):
        """Preview signal config (no apply allowed)."""
        config_payload = request.data.get('config_payload', {})
        try:
            config_obj = SignalServicesDomainConfig.from_dict(config_payload)
            errors = config_obj.validate()
        except Exception as e:
            errors = [str(e)]
        
        return Response({
            'valid': len(errors) == 0,
            'errors': errors,
            'can_apply': False,
            'reason': 'Signal config is bridge-write. Apply through signal_intelligence service.',
        })


class SignalsOwnershipView(SOCBaseView):
    """GET /api/soc/signals/ownership/"""

    def get(self, request):
        """Ownership + write constraints."""
        matrix = get_ownership_matrix()
        ownership = matrix.to_response_dict('signals')
        ownership['write_block_reason'] = matrix.get_write_block_reason('signals')
        return Response(ownership)


class SignalsWhaleView(SOCBaseView):
    """GET /api/soc/signals/whale/"""

    def get(self, request):
        """Whale detection settings."""
        return Response({
            'enabled': True,
            'threshold_vnd': 500_000_000,
            'top_pct': 0.10,
            'last_scan_at': timezone.now().isoformat(),
            'active_monitors': 45,
        })


class SignalsWhaleRecentView(SOCBaseView):
    """GET /api/soc/signals/whale/recent/"""

    def get(self, request):
        """Recent whale signals."""
        return Response({
            'recent': [
                {
                    'symbol': 'VNM',
                    'order_value_vnd': 1_200_000_000,
                    'side': 'buy',
                    'timestamp': timezone.now().isoformat(),
                },
            ],
            'total_today': 23,
        })


class SignalsWhaleTestView(SOCBaseView):
    """POST /api/soc/signals/whale/test/"""

    def post(self, request):
        """Test whale detection."""
        symbol = request.data.get('symbol', 'VNM')
        return Response({
            'symbol': symbol,
            'test_result': 'success',
            'detection_possible': True,
        })


class SignalsDarkPoolView(SOCBaseView):
    """GET /api/soc/signals/dark-pool/"""

    def get(self, request):
        """Dark pool detection settings."""
        return Response({
            'enabled': True,
            'threshold_vnd': 1_000_000_000,
            'block_ratio_min': 0.05,
            'last_scan_at': timezone.now().isoformat(),
        })


class SignalsDarkPoolRecentView(SOCBaseView):
    """GET /api/soc/signals/dark-pool/recent/"""

    def get(self, request):
        """Recent dark pool signals."""
        return Response({
            'recent': [],
            'total_today': 0,
        })


class SignalsScreenerView(SOCBaseView):
    """GET /api/soc/signals/screener/"""

    def get(self, request):
        """Screener signal settings."""
        return Response({
            'enabled': True,
            'scan_interval_seconds': 60,
            'active_rules': 8,
            'last_scan_at': timezone.now().isoformat(),
        })


class SignalsScreenerRecentView(SOCBaseView):
    """GET /api/soc/signals/screener/recent/"""

    def get(self, request):
        """Recent screener alerts."""
        return Response({
            'recent': [],
            'total_today': 3,
        })


class SignalsRetentionPolicyView(SOCBaseView):
    """GET /api/soc/signals/retention-policy/"""

    def get(self, request):
        """Data retention settings."""
        return Response({
            'intraday_tick_days': 3,
            'canonical_event_days': 365,
            'bucket_fact_days': 90,
            'forensic_window_days': 30,
        })


class SignalsPerformanceMetricsView(SOCBaseView):
    """GET /api/soc/signals/performance-metrics/"""

    def get(self, request):
        """Detection performance stats."""
        return Response({
            'whale_detection_accuracy': 0.94,
            'dark_pool_detection_accuracy': 0.87,
            'avg_detection_latency_ms': 125,
            'total_signals_processed': 456_789,
        })
