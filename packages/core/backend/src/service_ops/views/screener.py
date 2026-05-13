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
from rest_framework import status
from rest_framework.response import Response
from django.utils import timezone

from ..models import ServiceDefinition, ServiceConfig
from ..serializers import ServiceConfigSerializer
from ..domain_configs import ScreenerDomainConfig
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


class ScreenerConfigView(SOCBaseView, ConfigApplyMixin):
    """GET/POST /api/soc/screener/config/"""

    def get(self, request):
        """GET current screener config."""
        try:
            service = ServiceDefinition.objects.get(service_key='global_screener')
            current_config = ServiceConfig.objects.filter(
                service=service, is_current=True
            ).first()
            if current_config:
                return Response(ServiceConfigSerializer(current_config).data)
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        default = ScreenerDomainConfig()
        return Response({
            'config_payload': default.to_dict(),
            'is_current': True,
        })

    def post(self, request):
        """POST apply screener config."""
        config_payload = request.data.get('config_payload', {})
        result = self.apply_config(
            request,
            service_key='global_screener',
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


class ScreenerRulesView(SOCBaseView):
    """GET /api/soc/screener/rules/"""

    def get(self, request):
        """List active screening rules."""
        return Response({
            'rules': [
                {
                    'type': 'price_change_pct',
                    'threshold': 5.0,
                    'direction': 'both',
                    'enabled': True,
                },
                {
                    'type': 'volume_spike_ratio',
                    'threshold': 2.5,
                    'enabled': True,
                },
            ],
            'total_rules': 2,
        })

    def post(self, request):
        """Add new screening rule."""
        rule_type = request.data.get('type')
        threshold = request.data.get('threshold')
        # Placeholder
        return Response({
            'rule_id': 'rule_123',
            'type': rule_type,
            'threshold': threshold,
            'created_at': timezone.now().isoformat(),
        }, status=status.HTTP_201_CREATED)


class ScreenerResultsView(SOCBaseView):
    """GET /api/soc/screener/results/"""

    def get(self, request):
        """Latest scan results."""
        return Response({
            'scan_id': 'scan_456',
            'timestamp': timezone.now().isoformat(),
            'symbols_scanned': 2000,
            'alerts_triggered': 12,
            'symbols_matched': [
                {'symbol': 'VNM', 'rule': 'price_change_pct', 'value': 5.2},
                {'symbol': 'SAB', 'rule': 'volume_spike_ratio', 'value': 2.8},
            ],
        })


class ScreenerAlertHistoryView(SOCBaseView):
    """GET /api/soc/screener/alert-history/"""

    def get(self, request):
        """Alert history with pagination."""
        return Response({
            'count': 45,
            'alerts': [
                {
                    'id': 'alert_1',
                    'symbol': 'VNM',
                    'rule': 'price_change_pct',
                    'value': 5.2,
                    'timestamp': timezone.now().isoformat(),
                },
            ],
        })


class ScreenerManualScanView(SOCBaseView):
    """POST /api/soc/screener/manual-scan/"""

    def post(self, request):
        """Trigger manual screener scan."""
        symbols = request.data.get('symbols', [])
        # Placeholder — would queue Celery task
        return Response({
            'scan_id': 'scan_789',
            'symbols_count': len(symbols),
            'status': 'queued',
            'created_at': timezone.now().isoformat(),
        }, status=status.HTTP_202_ACCEPTED)
