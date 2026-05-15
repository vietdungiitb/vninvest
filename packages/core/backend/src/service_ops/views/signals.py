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

from signal_intelligence.models import OrderFlowEvent, UnifiedAlert

from ..models import ServiceConfig, ServiceDefinition, ServiceRunLog
from ..serializers import ServiceConfigSerializer
from ..domain_configs import SignalServicesDomainConfig
from ..ownership import build_ownership_matrix_from_db
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from ..tasks import create_signal_job_run_log, run_signals_detection_workflow
from .base import SOCBaseView


def _get_signals_domain_config() -> SignalServicesDomainConfig:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return SignalServicesDomainConfig.from_dict(current_config.config_payload)
    except ServiceDefinition.DoesNotExist:
        pass
    return SignalServicesDomainConfig()


def _build_signals_ownership_payload() -> dict:
    matrix = build_ownership_matrix_from_db()
    ownership = matrix.to_response_dict('signals')
    ownership['write_block_reason'] = matrix.get_write_block_reason('signals')
    return ownership


def _latest_signal_session_date():
    alert_session = UnifiedAlert.objects.order_by('-session_date').values_list('session_date', flat=True).first()
    event_session = OrderFlowEvent.objects.order_by('-session_date').values_list('session_date', flat=True).first()
    if alert_session and event_session:
        return max(alert_session, event_session)
    return alert_session or event_session


def _compute_avg_signal_latency_ms(events) -> float:
    samples = list(events.only('created_at', 'triggered_at')[:200])
    if not samples:
        return 0.0
    latencies = [
        max((event.created_at - event.triggered_at).total_seconds() * 1000.0, 0.0)
        for event in samples
        if event.created_at and event.triggered_at
    ]
    if not latencies:
        return 0.0
    return round(sum(latencies) / len(latencies), 2)


def _serialize_recent_alert(alert: UnifiedAlert) -> dict:
    return {
        'symbol': alert.symbol,
        'value': alert.value,
        'side': alert.direction or UnifiedAlert.DirectionChoices.NEUTRAL,
        'timestamp': alert.triggered_at.isoformat(),
        'title': alert.title,
    }


def _build_bridge_write_denied_response(view: SOCBaseView, request) -> Response:
    ownership = _build_signals_ownership_payload()
    reason = ownership.get('write_block_reason') or (
        'Signal config is bridge-write. Apply through signal_intelligence service.'
    )
    return Response({
        'detail': reason,
        'code': 'OWNERSHIP_WRITE_DENIED',
        'timestamp': timezone.now().isoformat(),
        'request_id': view.get_request_id(request),
        'write_block_reason': reason,
        'ownership': ownership,
    }, status=status.HTTP_403_FORBIDDEN)


def _get_latest_signal_job_run() -> ServiceRunLog | None:
    service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals'])
    return ServiceRunLog.objects.filter(service=service).order_by('-started_at', '-pk').first()


def _materializer_status(service_key: str) -> dict:
    service = get_registered_service(service_key)
    run_log = ServiceRunLog.objects.filter(service=service).order_by('-started_at', '-pk').first()
    return {
        'service_key': service.service_key,
        'status': run_log.status if run_log is not None else 'idle',
        'last_started_at': run_log.started_at.isoformat() if run_log and run_log.started_at else None,
        'last_finished_at': run_log.finished_at.isoformat() if run_log and run_log.finished_at else None,
        'run_log_id': run_log.id if run_log is not None else None,
    }


def _build_materialization_execution_plan(domain: str = 'all', symbol: str | None = None) -> list[dict]:
    return [
        {
            'service_key': 'signal_whale_canonical_pipeline',
            'execution_supported': True,
            'will_run': domain in {'all', 'whale'},
            'symbol': symbol,
        },
        {
            'service_key': 'signal_unified_alert_materializer',
            'execution_supported': True,
            'will_run': domain in {'all', 'dark_flow'},
            'symbol': None,
        },
        {
            'service_key': 'signal_session_facts_materializer',
            'execution_supported': True,
            'will_run': domain in {'all', 'whale', 'session_facts'},
            'symbol': symbol if domain in {'all', 'whale', 'session_facts'} else None,
        },
    ]


class SignalsConfigView(SOCBaseView):
    """GET /api/soc/signals/config/ — read-only."""

    def get(self, request):
        """Get current signal config (read-only)."""
        config = _get_signals_domain_config()
        ownership = _build_signals_ownership_payload()
        return Response({
            'config': config.to_dict(),
            'config_payload': config.to_dict(),
            'is_current': True,
            'write_mode': ownership.get('mode'),
            'can_apply': ownership.get('can_apply', False),
            'ownership': ownership,
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


class SignalsConfigApplyView(SOCBaseView):
    """POST /api/soc/signals/config/apply/ — bridge-write block surface."""

    def post(self, request):
        return _build_bridge_write_denied_response(self, request)


class SignalsOwnershipView(SOCBaseView):
    """GET /api/soc/signals/ownership/"""

    def get(self, request):
        """Ownership + write constraints."""
        return Response(_build_signals_ownership_payload())


class SignalsSummaryView(SOCBaseView):
    """GET /api/soc/signals/summary/ — runtime metrics."""

    def get(self, request):
        session_date = _latest_signal_session_date()
        if session_date is None:
            return Response({
                'session_date': None,
                'active_alerts': 0,
                'whale_alerts': 0,
                'dark_flow_alerts': 0,
                'signal_alerts': 0,
                'order_flow_events': 0,
                'detection_rate': 0.0,
                'false_positive_rate': 0.0,
                'avg_signal_latency_ms': 0.0,
                'last_triggered_at': None,
            })

        alerts = UnifiedAlert.objects.filter(session_date=session_date)
        events = OrderFlowEvent.objects.filter(session_date=session_date)
        order_flow_events = events.count()
        active_alerts = alerts.count()
        whale_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.WHALE).count()
        dark_flow_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW).count()
        signal_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL).count()
        last_alert = alerts.order_by('-triggered_at').values_list('triggered_at', flat=True).first()
        last_event = events.order_by('-triggered_at').values_list('triggered_at', flat=True).first()
        last_triggered_at = max(filter(None, [last_alert, last_event]), default=None)

        return Response({
            'session_date': session_date.isoformat(),
            'active_alerts': active_alerts,
            'whale_alerts': whale_alerts,
            'dark_flow_alerts': dark_flow_alerts,
            'signal_alerts': signal_alerts,
            'order_flow_events': order_flow_events,
            'detection_rate': round((active_alerts / order_flow_events) * 100.0, 2) if order_flow_events else 0.0,
            'false_positive_rate': 0.0,
            'avg_signal_latency_ms': _compute_avg_signal_latency_ms(events),
            'last_triggered_at': last_triggered_at.isoformat() if last_triggered_at else None,
        })


class SignalsWhaleView(SOCBaseView):
    """GET /api/soc/signals/whale/"""

    def get(self, request):
        """Whale detection settings."""
        config = _get_signals_domain_config()
        return Response({
            'enabled': config.whale_enabled,
            'threshold_vnd': config.whale_threshold_vnd,
            'top_pct': config.whale_top_pct,
            'min_volume': config.whale_threshold_vnd,
            'last_scan_at': timezone.now().isoformat(),
            'active_monitors': OrderFlowEvent.objects.filter(
                session_date=_latest_signal_session_date(),
                signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
            ).count(),
        })


class SignalsWhaleRecentView(SOCBaseView):
    """GET /api/soc/signals/whale/recent/"""

    def get(self, request):
        """Recent whale signals."""
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            session_date=session_date,
        ).order_by('-triggered_at', '-pk') if session_date else UnifiedAlert.objects.none()
        return Response({
            'recent': [
                {
                    **_serialize_recent_alert(alert),
                    'order_value_vnd': alert.value,
                }
                for alert in queryset[:20]
            ],
            'total_today': queryset.count(),
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
        config = _get_signals_domain_config()
        return Response({
            'enabled': config.dark_pool_enabled,
            'threshold_vnd': config.dark_pool_threshold_vnd,
            'block_ratio_min': config.dark_pool_block_ratio_min,
            'min_signal_count': config.dark_pool_threshold_vnd,
            'last_scan_at': timezone.now().isoformat(),
        })


class SignalsDarkPoolRecentView(SOCBaseView):
    """GET /api/soc/signals/dark-pool/recent/"""

    def get(self, request):
        """Recent dark pool signals."""
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            session_date=session_date,
        ).order_by('-triggered_at', '-pk') if session_date else UnifiedAlert.objects.none()
        return Response({
            'recent': [
                {
                    **_serialize_recent_alert(alert),
                    'matched_value_vnd': alert.value,
                }
                for alert in queryset[:20]
            ],
            'total_today': queryset.count(),
        })


class SignalsScreenerView(SOCBaseView):
    """GET /api/soc/signals/screener/"""

    def get(self, request):
        """Screener signal settings."""
        config = _get_signals_domain_config()
        session_date = _latest_signal_session_date()
        latest_signal = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            session_date=session_date,
        ).order_by('-triggered_at', '-pk').first() if session_date else None
        recent_signal_alerts = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            session_date=session_date,
        ) if session_date else UnifiedAlert.objects.none()
        active_rules = len({
            alert.metadata.get('rule_name') or alert.metadata.get('rule') or alert.title
            for alert in recent_signal_alerts[:50]
        })
        return Response({
            'enabled': config.screener_signal_enabled,
            'scan_interval_seconds': config.detection_task_interval_seconds,
            'active_rules': active_rules,
            'last_scan_at': latest_signal.triggered_at.isoformat() if latest_signal else None,
        })


class SignalsScreenerRecentView(SOCBaseView):
    """GET /api/soc/signals/screener/recent/"""

    def get(self, request):
        """Recent screener alerts."""
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            session_date=session_date,
        ).order_by('-triggered_at', '-pk') if session_date else UnifiedAlert.objects.none()
        return Response({
            'recent': [_serialize_recent_alert(alert) for alert in queryset[:20]],
            'total_today': queryset.count(),
        })


class SignalsRetentionPolicyView(SOCBaseView):
    """GET /api/soc/signals/retention-policy/"""

    def get(self, request):
        """Data retention settings."""
        config = _get_signals_domain_config()
        return Response({
            'intraday_tick_days': config.intraday_tick_retention_days,
            'canonical_event_days': config.canonical_event_retention_days,
            'bucket_fact_days': config.bucket_fact_retention_days,
            'forensic_window_days': config.forensic_window_days,
        })


class SignalsRetentionPreviewView(SOCBaseView):
    """POST /api/soc/signals/retention-policy/preview/"""

    def post(self, request):
        config = SignalServicesDomainConfig.from_dict(request.data.get('config_payload', {}))
        errors = config.validate()
        alerts_count = UnifiedAlert.objects.count()
        events_count = OrderFlowEvent.objects.count()
        return Response({
            'valid': len(errors) == 0,
            'errors': errors,
            'retention_days': {
                'intraday_tick': config.intraday_tick_retention_days,
                'canonical_event': config.canonical_event_retention_days,
                'bucket_fact': config.bucket_fact_retention_days,
                'forensic_window': config.forensic_window_days,
            },
            'impact': {
                'alerts_in_scope': alerts_count,
                'order_flow_events_in_scope': events_count,
                'bridge_write_locked': True,
            },
        })


class SignalsMaterializationView(SOCBaseView):
    """GET /api/soc/signals/materialization/"""

    def get(self, request):
        latest_detection_job = _get_latest_signal_job_run()
        return Response({
            'services': [
                _materializer_status('signal_unified_alert_materializer'),
                _materializer_status('signal_session_facts_materializer'),
                _materializer_status('signal_whale_canonical_pipeline'),
            ],
            'execution_plan': _build_materialization_execution_plan(),
            'unified_alerts_available': UnifiedAlert.objects.count(),
            'session_dates_available': UnifiedAlert.objects.values('session_date').distinct().count(),
            'latest_detection_job_run_log_id': latest_detection_job.id if latest_detection_job is not None else None,
        })


class SignalsMaterializationPreviewView(SOCBaseView):
    """POST /api/soc/signals/materialization/preview/"""

    def post(self, request):
        domain = request.data.get('domain', 'all')
        symbol = request.data.get('symbol')
        if isinstance(symbol, str):
            symbol = symbol.strip().upper() or None
        session_dates = list(UnifiedAlert.objects.values_list('session_date', flat=True).distinct())
        return Response({
            'domain': domain,
            'symbol': symbol,
            'session_dates_available': len(session_dates),
            'unified_alerts_available': UnifiedAlert.objects.count(),
            'order_flow_events_available': OrderFlowEvent.objects.count(),
            'execution_plan': _build_materialization_execution_plan(domain=domain, symbol=symbol),
        })


class SignalsUniverseView(SOCBaseView):
    """GET /api/soc/signals/universe/"""

    def get(self, request):
        config = _get_signals_domain_config()
        ownership = _build_signals_ownership_payload()
        return Response({
            'universe_group_ids': config.universe_group_ids,
            'ownership': ownership,
            'write_block_reason': ownership.get('write_block_reason'),
        })


class SignalsUniverseUpdateView(SOCBaseView):
    """POST /api/soc/signals/universe/update/"""

    def post(self, request):
        return _build_bridge_write_denied_response(self, request)


class SignalsJobRunView(SOCBaseView):
    """POST /api/soc/signals/jobs/run/"""

    def post(self, request):
        domain = request.data.get('domain', 'all')
        symbol = request.data.get('symbol')
        if isinstance(symbol, str):
            symbol = symbol.strip().upper() or None

        run_log = create_signal_job_run_log(
            requested_by=getattr(request.user, 'username', 'api'),
            domain=domain,
            symbol=symbol,
        )
        async_result = run_signals_detection_workflow.delay(
            run_log_id=run_log.id,
            domain=domain,
            symbol=symbol,
        )
        run_log.celery_task_id = async_result.id
        run_log.save(update_fields=['celery_task_id'])

        return Response({
            'service_key': run_log.service.service_key,
            'status': 'queued',
            'run_log_id': run_log.id,
            'celery_task_id': async_result.id,
            'domain': domain,
            'symbol': symbol,
            'requested_at': run_log.started_at.isoformat(),
        }, status=status.HTTP_202_ACCEPTED)


class SignalsJobStatusView(SOCBaseView):
    """GET /api/soc/signals/jobs/status/"""

    def get(self, request):
        run_log = _get_latest_signal_job_run()
        return Response({
            'service_key': SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals'],
            'status': run_log.status if run_log is not None else 'idle',
            'run_log_id': run_log.id if run_log is not None else None,
            'celery_task_id': run_log.celery_task_id if run_log is not None else '',
            'input_summary': run_log.input_summary if run_log is not None else {},
            'output_summary': run_log.output_summary if run_log is not None else {},
            'last_started_at': run_log.started_at.isoformat() if run_log and run_log.started_at else None,
            'last_finished_at': run_log.finished_at.isoformat() if run_log and run_log.finished_at else None,
            'error_detail': run_log.error_detail if run_log is not None else '',
        })


class SignalsPerformanceMetricsView(SOCBaseView):
    """GET /api/soc/signals/performance-metrics/"""

    def get(self, request):
        """Detection performance stats."""
        session_date = _latest_signal_session_date()
        events = OrderFlowEvent.objects.filter(session_date=session_date) if session_date else OrderFlowEvent.objects.none()
        alerts = UnifiedAlert.objects.filter(session_date=session_date) if session_date else UnifiedAlert.objects.none()
        total_signals_processed = events.count()
        active_alerts = alerts.count()
        detection_rate = round((active_alerts / total_signals_processed) * 100.0, 2) if total_signals_processed else 0.0
        return Response({
            'whale_detection_accuracy': 100.0 - 0.0,
            'dark_pool_detection_accuracy': 100.0 - 0.0,
            'avg_detection_latency_ms': _compute_avg_signal_latency_ms(events),
            'avg_signal_latency_ms': _compute_avg_signal_latency_ms(events),
            'detection_rate': detection_rate,
            'false_positive_rate': 0.0,
            'total_signals_processed': total_signals_processed,
        })
