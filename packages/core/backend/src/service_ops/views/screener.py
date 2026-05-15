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

from signal_intelligence.models import UnifiedAlert

from ..models import ServiceConfig, ServiceDefinition, ServiceRunLog
from ..ownership import build_ownership_matrix_from_db
from ..serializers import ServiceConfigSerializer
from ..domain_configs import ScreenerDomainConfig
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from .base import SOCBaseView
from .mixins import ConfigApplyMixin


def _get_screener_config() -> ScreenerDomainConfig:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return ScreenerDomainConfig.from_dict(current_config.config_payload)
    except ServiceConfig.DoesNotExist:
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


class ScreenerRulesView(SOCBaseView):
    """GET /api/soc/screener/rules/"""

    def get(self, request):
        """List active screening rules."""
        config = _get_screener_config()
        rules = [
            {
                'id': rule.get('id') or f"rule_{index + 1}",
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


class ScreenerAlertHistoryView(SOCBaseView):
    """GET /api/soc/screener/alert-history/"""

    def get(self, request):
        """Alert history with pagination."""
        alerts = [_serialize_signal_alert(alert) for alert in _get_recent_signal_alerts(limit=50)]
        return Response({
            'count': len(alerts),
            'alerts': alerts,
        })


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


class ScreenerRulesRunView(ScreenerManualScanView):
    """POST /api/soc/screener/rules/run/ — spec-compatible alias of manual scan."""


class ScreenerOwnershipView(SOCBaseView):
    """GET /api/soc/screener/ownership/"""

    def get(self, request):
        return Response(_build_screener_ownership_payload())
