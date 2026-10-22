"""
Signal Intelligence Domain Views (13 endpoints) — read-only + bridge-write pattern.

NOTE: write_mode=bridge-write -> SOC cannot apply config directly.
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
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from signal_intelligence.models import OrderFlowEvent, UnifiedAlert

from ..domain_configs import SignalServicesDomainConfig
from ..envelope import envelope, paginated_envelope
from ..models import ServiceConfig, ServiceDefinition, ServiceRunLog
from ..ownership import build_ownership_matrix_from_db
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from ..tasks import create_signal_job_run_log, run_signals_detection_workflow
from .base import SOCBaseView
from vninvest_core.api_envelope import envelope_response


class SignalsOwnershipSerializer(serializers.Serializer):
    domain = serializers.CharField()
    mode = serializers.CharField()
    writer = serializers.CharField(required=False, allow_blank=True)
    owner_team = serializers.CharField(required=False, allow_blank=True)
    write_surface = serializers.CharField(required=False, allow_blank=True)
    can_apply = serializers.BooleanField()
    locked_fields = serializers.ListField(child=serializers.CharField())
    compatibility_domains = serializers.ListField(child=serializers.CharField())
    write_block_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SignalsConfigPayloadSerializer(serializers.Serializer):
    whale_threshold_vnd = serializers.IntegerField(required=False)
    whale_top_pct = serializers.FloatField(required=False)
    whale_enabled = serializers.BooleanField(required=False)
    dark_pool_threshold_vnd = serializers.IntegerField(required=False)
    dark_pool_block_ratio_min = serializers.FloatField(required=False)
    dark_pool_enabled = serializers.BooleanField(required=False)
    screener_signal_enabled = serializers.BooleanField(required=False)
    screener_signal_cooldown_seconds = serializers.IntegerField(required=False)
    intraday_tick_retention_days = serializers.IntegerField(required=False)
    canonical_event_retention_days = serializers.IntegerField(required=False)
    bucket_fact_retention_days = serializers.IntegerField(required=False)
    forensic_window_days = serializers.IntegerField(required=False)
    detection_task_interval_seconds = serializers.IntegerField(required=False)
    aggregation_task_interval_seconds = serializers.IntegerField(required=False)
    universe_group_ids = serializers.ListField(child=serializers.CharField(), required=False)


class SignalsConfigPreviewRequestSerializer(serializers.Serializer):
    config_payload = SignalsConfigPayloadSerializer(required=False)


class SignalsConfigResponseSerializer(serializers.Serializer):
    config = SignalsConfigPayloadSerializer()
    config_payload = SignalsConfigPayloadSerializer()
    is_current = serializers.BooleanField()
    write_mode = serializers.CharField()
    can_apply = serializers.BooleanField()
    ownership = SignalsOwnershipSerializer()
    note = serializers.CharField()


class SignalsConfigPreviewResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    errors = serializers.ListField(child=serializers.CharField())
    can_apply = serializers.BooleanField()
    reason = serializers.CharField()


class SignalsBridgeWriteDeniedResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    code = serializers.CharField()
    timestamp = serializers.DateTimeField()
    request_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    write_block_reason = serializers.CharField()
    ownership = SignalsOwnershipSerializer()


class SignalsSummaryResponseSerializer(serializers.Serializer):
    session_date = serializers.DateField(required=False, allow_null=True)
    active_alerts = serializers.IntegerField()
    whale_alerts = serializers.IntegerField()
    dark_flow_alerts = serializers.IntegerField()
    signal_alerts = serializers.IntegerField()
    system_alerts = serializers.IntegerField()
    ai_alerts = serializers.IntegerField()
    order_flow_events = serializers.IntegerField()
    detection_rate = serializers.FloatField()
    false_positive_rate = serializers.FloatField(required=False, allow_null=True)
    avg_signal_latency_ms = serializers.FloatField()
    sentiment = serializers.JSONField(required=False)
    last_triggered_at = serializers.DateTimeField(required=False, allow_null=True)


class SignalsWhaleResponseSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    threshold_vnd = serializers.IntegerField()
    top_pct = serializers.FloatField()
    min_volume = serializers.IntegerField()
    last_scan_at = serializers.DateTimeField(required=False, allow_null=True)
    active_monitors = serializers.IntegerField()


class SignalsRecentAlertSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    symbol = serializers.CharField()
    severity = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)
    session_date = serializers.DateField(required=False, allow_null=True)
    value = serializers.JSONField()
    side = serializers.CharField()
    timestamp = serializers.DateTimeField()
    title = serializers.CharField()


class SignalsWhaleRecentItemSerializer(SignalsRecentAlertSerializer):
    order_value_vnd = serializers.JSONField()


class SignalsDarkPoolRecentItemSerializer(SignalsRecentAlertSerializer):
    matched_value_vnd = serializers.JSONField()


class SignalsRecentResponseSerializer(serializers.Serializer):
    recent = SignalsRecentAlertSerializer(many=True)
    total_today = serializers.IntegerField()
    total_filtered = serializers.IntegerField(required=False)
    page = serializers.IntegerField(required=False)
    page_size = serializers.IntegerField(required=False)


class SignalsWhaleRecentResponseSerializer(serializers.Serializer):
    recent = SignalsWhaleRecentItemSerializer(many=True)
    total_today = serializers.IntegerField()
    total_filtered = serializers.IntegerField(required=False)
    page = serializers.IntegerField(required=False)
    page_size = serializers.IntegerField(required=False)


class SignalsDarkPoolResponseSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    threshold_vnd = serializers.IntegerField()
    block_ratio_min = serializers.FloatField()
    last_scan_at = serializers.DateTimeField(required=False, allow_null=True)


class SignalsDarkPoolRecentResponseSerializer(serializers.Serializer):
    recent = SignalsDarkPoolRecentItemSerializer(many=True)
    total_today = serializers.IntegerField()
    total_filtered = serializers.IntegerField(required=False)
    page = serializers.IntegerField(required=False)
    page_size = serializers.IntegerField(required=False)


class SignalsFeedExportResponseSerializer(serializers.Serializer):
    session_date = serializers.DateField(required=False, allow_null=True)
    columns = serializers.ListField(child=serializers.CharField())
    rows = serializers.JSONField()
    count = serializers.IntegerField()
    truncated = serializers.BooleanField()


class SignalsWhaleTestRequestSerializer(serializers.Serializer):
    symbol = serializers.CharField(required=False, allow_blank=True)


class SignalsWhaleTestResponseSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    test_result = serializers.CharField()
    detection_possible = serializers.BooleanField()
    smoke = serializers.BooleanField(required=False)
    note = serializers.CharField(required=False, allow_blank=True)


class SignalsScreenerResponseSerializer(serializers.Serializer):
    enabled = serializers.BooleanField()
    scan_interval_seconds = serializers.IntegerField()
    rules_seen_session = serializers.IntegerField()
    last_scan_at = serializers.DateTimeField(required=False, allow_null=True)


class SignalsRetentionPolicyResponseSerializer(serializers.Serializer):
    intraday_tick_days = serializers.IntegerField()
    canonical_event_days = serializers.IntegerField()
    bucket_fact_days = serializers.IntegerField()
    forensic_window_days = serializers.IntegerField()
    session_facts_days = serializers.IntegerField()


class SignalsRetentionPreviewResponseSerializer(serializers.Serializer):
    valid = serializers.BooleanField()
    errors = serializers.ListField(child=serializers.CharField())
    retention_days = serializers.JSONField()
    impact = serializers.JSONField()


class SignalsMaterializerStatusSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    status = serializers.CharField()
    last_started_at = serializers.DateTimeField(required=False, allow_null=True)
    last_finished_at = serializers.DateTimeField(required=False, allow_null=True)
    run_log_id = serializers.IntegerField(required=False, allow_null=True)


class SignalsMaterializationExecutionPlanItemSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    execution_supported = serializers.BooleanField()
    will_run = serializers.BooleanField()
    symbol = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SignalsMaterializationResponseSerializer(serializers.Serializer):
    services = SignalsMaterializerStatusSerializer(many=True)
    execution_plan = SignalsMaterializationExecutionPlanItemSerializer(many=True)
    unified_alerts_available = serializers.IntegerField()
    session_dates_available = serializers.IntegerField()
    latest_detection_job_run_log_id = serializers.IntegerField(required=False, allow_null=True)


class SignalsMaterializationPreviewRequestSerializer(serializers.Serializer):
    domain = serializers.CharField(required=False, allow_blank=True)
    symbol = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SignalsMaterializationPreviewResponseSerializer(serializers.Serializer):
    domain = serializers.CharField()
    symbol = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    session_dates_available = serializers.IntegerField()
    unified_alerts_available = serializers.IntegerField()
    order_flow_events_available = serializers.IntegerField()
    execution_plan = SignalsMaterializationExecutionPlanItemSerializer(many=True)


class SignalsUniverseResponseSerializer(serializers.Serializer):
    universe_group_ids = serializers.ListField(child=serializers.CharField())
    ownership = SignalsOwnershipSerializer()
    write_block_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SignalsUniverseUpdateRequestSerializer(serializers.Serializer):
    universe_group_ids = serializers.ListField(child=serializers.CharField(), required=False)


class SignalsJobRunRequestSerializer(serializers.Serializer):
    domain = serializers.CharField(required=False, allow_blank=True)
    symbol = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SignalsJobRunResponseSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    status = serializers.CharField()
    run_log_id = serializers.IntegerField()
    celery_task_id = serializers.CharField()
    domain = serializers.CharField()
    symbol = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    requested_at = serializers.DateTimeField()


class SignalsJobStatusResponseSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    status = serializers.CharField()
    run_log_id = serializers.IntegerField(required=False, allow_null=True)
    celery_task_id = serializers.CharField(required=False, allow_blank=True)
    input_summary = serializers.JSONField()
    output_summary = serializers.JSONField()
    last_started_at = serializers.DateTimeField(required=False, allow_null=True)
    last_finished_at = serializers.DateTimeField(required=False, allow_null=True)
    error_detail = serializers.CharField(required=False, allow_blank=True)


class SignalsPerformanceMetricsResponseSerializer(serializers.Serializer):
    whale_detection_accuracy = serializers.FloatField(required=False, allow_null=True)
    dark_pool_detection_accuracy = serializers.FloatField(required=False, allow_null=True)
    avg_detection_latency_ms = serializers.FloatField()
    avg_signal_latency_ms = serializers.FloatField()
    detection_rate = serializers.FloatField()
    false_positive_rate = serializers.FloatField(required=False, allow_null=True)
    total_signals_processed = serializers.IntegerField()
    sentiment = serializers.JSONField(required=False)


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


def _compute_signals_sentiment(alerts) -> dict:
    """Đếm sentiment theo direction: buy→bullish, sell→bearish, còn lại→neutral (1 query)."""
    from django.db.models import Count, Q
    agg = alerts.aggregate(
        bullish=Count('pk', filter=Q(direction=UnifiedAlert.DirectionChoices.BUY)),
        bearish=Count('pk', filter=Q(direction=UnifiedAlert.DirectionChoices.SELL)),
        total=Count('pk'),
    )
    bullish = agg['bullish'] or 0
    bearish = agg['bearish'] or 0
    total = agg['total'] or 0
    return {'bullish': bullish, 'bearish': bearish, 'neutral': max(total - bullish - bearish, 0)}


def _serialize_recent_alert(alert: UnifiedAlert) -> dict:
    return {
        'id': alert.pk,
        'symbol': alert.symbol,
        'severity': alert.severity,
        'metadata': alert.metadata or {},
        'session_date': alert.session_date.isoformat() if alert.session_date else None,
        'value': alert.value,
        'side': alert.direction or UnifiedAlert.DirectionChoices.NEUTRAL,
        'timestamp': alert.triggered_at.isoformat(),
        'title': alert.title,
    }


RECENT_PAGE_DEFAULT = 20
RECENT_PAGE_MAX = 100


def _parse_recent_params(request) -> dict:
    """W1.1: paging + filter cho 3 recent views (additive, backward compat)."""
    try:
        page = int(request.query_params.get('page', 1))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.query_params.get('page_size', RECENT_PAGE_DEFAULT))
    except (TypeError, ValueError):
        page_size = RECENT_PAGE_DEFAULT
    page = max(page, 1)
    page_size = min(max(page_size, 1), RECENT_PAGE_MAX)
    symbol = (request.query_params.get('symbol') or '').strip().upper() or None
    severity = (request.query_params.get('severity') or '').strip().lower() or None
    if severity not in {c.value for c in UnifiedAlert.SeverityChoices}:
        severity = None
    direction = (request.query_params.get('direction') or '').strip().lower() or None
    if direction not in {c.value for c in UnifiedAlert.DirectionChoices}:
        direction = None
    return {'page': page, 'page_size': page_size, 'symbol': symbol, 'severity': severity, 'direction': direction}


def _apply_recent_filters(queryset, params: dict):
    if params['symbol']:
        queryset = queryset.filter(symbol__icontains=params['symbol'])
    if params['severity']:
        queryset = queryset.filter(severity=params['severity'])
    if params['direction']:
        queryset = queryset.filter(direction=params['direction'])
    return queryset


def _build_recent_response(queryset, params: dict, serialize_extra=None) -> dict:
    total_today = queryset.count()
    filtered = _apply_recent_filters(queryset, params)
    total_filtered = filtered.count()
    start = (params['page'] - 1) * params['page_size']
    items = list(filtered.order_by('-triggered_at', '-pk')[start:start + params['page_size']])
    recent = []
    for alert in items:
        item = _serialize_recent_alert(alert)
        if serialize_extra:
            item.update(serialize_extra(alert))
        recent.append(item)
    return {
        'recent': recent,
        'total_today': total_today,
        'total_filtered': total_filtered,
        'page': params['page'],
        'page_size': params['page_size'],
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


def _latest_signal_scan_at():
    """W2.4: last_scan_at trung thực từ run log gần nhất (None khi chưa từng chạy)."""
    run_log = _get_latest_signal_job_run()
    if run_log is None:
        return None
    return run_log.finished_at or run_log.started_at


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
    # W1.3: FE gọi domain 'dark_pool', task dùng 'dark_flow' — chuẩn hoá 1 tên.
    if domain == 'dark_pool':
        domain = 'dark_flow'
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


@extend_schema(
    summary='Lấy runtime config Signals',
    description='Trả về config tín hiệu hiệu lực ở chế độ đọc-only cùng ownership bridge-write của domain signals.',
    responses={
        200: envelope_response(SignalsConfigResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsConfigView(SOCBaseView):
    """GET /api/soc/signals/config/ — read-only."""

    def get(self, request):
        """Get current signal config (read-only)."""
        config = _get_signals_domain_config()
        ownership = _build_signals_ownership_payload()
        return envelope({
            'config': config.to_dict(),
            'config_payload': config.to_dict(),
            'is_current': True,
            'write_mode': ownership.get('mode'),
            'can_apply': ownership.get('can_apply', False),
            'ownership': ownership,
            'note': 'Signal config is managed by signal_intelligence. SOC has read-only access.',
        })


@extend_schema(
    summary='Preview runtime config Signals',
    description='Validate payload config của domain signals, nhưng vẫn giữ can_apply=false vì đây là bridge-write domain.',
    request=SignalsConfigPreviewRequestSerializer,
    responses={
        200: envelope_response(SignalsConfigPreviewResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsConfigPreviewView(SOCBaseView):
    """POST /api/soc/signals/config/preview/"""

    def post(self, request):
        """Preview signal config (no apply allowed)."""
        config_payload = request.data.get('config_payload', {})
        try:
            config_obj = SignalServicesDomainConfig.from_dict(config_payload)
            errors = config_obj.validate()
        except Exception as exc:
            errors = [str(exc)]

        return envelope({
            'valid': len(errors) == 0,
            'errors': errors,
            'can_apply': False,
            'reason': 'Signal config is bridge-write. Apply through signal_intelligence service.',
        })


@extend_schema(
    summary='Apply runtime config Signals',
    description='Endpoint alias theo contract cũ; luôn trả 403 vì domain signals là bridge-write và không cho apply trực tiếp từ SOC.',
    request=SignalsConfigPreviewRequestSerializer,
    responses={
        403: SignalsBridgeWriteDeniedResponseSerializer,
        401: OpenApiTypes.OBJECT,
    },
)
class SignalsConfigApplyView(SOCBaseView):
    """POST /api/soc/signals/config/apply/ — bridge-write block surface."""

    def post(self, request):
        return _build_bridge_write_denied_response(self, request)


@extend_schema(
    summary='Lấy ownership Signals',
    description='Trả về ownership matrix cho domain signals, bao gồm write_block_reason và các field bị khóa.',
    responses={
        200: envelope_response(SignalsOwnershipSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsOwnershipView(SOCBaseView):
    """GET /api/soc/signals/ownership/"""

    def get(self, request):
        """Ownership + write constraints."""
        return envelope(_build_signals_ownership_payload())


FEED_EXPORT_LIMIT = 5000
FEED_EXPORT_TYPE_MAP = {
    'whale': UnifiedAlert.AlertTypeChoices.WHALE,
    'dark_pool': UnifiedAlert.AlertTypeChoices.DARK_FLOW,
    'screener': UnifiedAlert.AlertTypeChoices.SIGNAL,
}


@extend_schema(
    summary='Xuất feed Signals',
    description='Trả về rows JSON của session hiện tại (tối đa 5000) để FE dựng CSV client-side.',
    responses={
        200: envelope_response(SignalsFeedExportResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsFeedExportView(SOCBaseView):
    """GET /api/soc/signals/feed/export/"""

    def get(self, request):
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(session_date=session_date) if session_date else UnifiedAlert.objects.none()
        alert_type = FEED_EXPORT_TYPE_MAP.get((request.query_params.get('type') or '').strip().lower())
        if alert_type:
            queryset = queryset.filter(alert_type=alert_type)
        queryset = _apply_recent_filters(queryset, _parse_recent_params(request))
        count = queryset.count()
        columns = ['id', 'symbol', 'type', 'severity', 'direction', 'session_date', 'triggered_at', 'value', 'title']
        rows = [
            [
                alert.pk,
                alert.symbol,
                alert.alert_type,
                alert.severity,
                alert.direction,
                alert.session_date.isoformat() if alert.session_date else None,
                alert.triggered_at.isoformat() if alert.triggered_at else None,
                str(alert.value) if alert.value is not None else None,
                alert.title,
            ]
            for alert in queryset.order_by('-triggered_at', '-pk')[:FEED_EXPORT_LIMIT]
        ]
        return envelope({
            'session_date': session_date.isoformat() if session_date else None,
            'columns': columns,
            'rows': rows,
            'count': count,
            'truncated': count > FEED_EXPORT_LIMIT,
        })


@extend_schema(
    summary='Lấy summary Signals',
    description='Trả về snapshot tổng hợp alert/event của session tín hiệu gần nhất.',
    responses={
        200: envelope_response(SignalsSummaryResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsSummaryView(SOCBaseView):
    """GET /api/soc/signals/summary/ — runtime metrics."""

    def get(self, request):
        session_date = _latest_signal_session_date()
        if session_date is None:
            return envelope({
                'session_date': None,
                'active_alerts': 0,
                'whale_alerts': 0,
                'dark_flow_alerts': 0,
                'signal_alerts': 0,
                'system_alerts': 0,
                'ai_alerts': 0,
                'order_flow_events': 0,
                'detection_rate': 0.0,
                'false_positive_rate': None,
                'avg_signal_latency_ms': 0.0,
                'sentiment': {'bullish': 0, 'bearish': 0, 'neutral': 0},
                'last_triggered_at': None,
            })

        alerts = UnifiedAlert.objects.filter(session_date=session_date)
        events = OrderFlowEvent.objects.filter(session_date=session_date)
        order_flow_events = events.count()
        active_alerts = alerts.count()
        whale_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.WHALE).count()
        dark_flow_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW).count()
        signal_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL).count()
        # S6: đếm nốt system + ai để thẻ TỔNG cộng khớp (trước đây thiếu → TỔNG 1 vs 3 số 0)
        system_alerts = alerts.filter(alert_type=UnifiedAlert.AlertTypeChoices.SYSTEM).count()
        ai_alerts = alerts.filter(
            alert_type__in=(UnifiedAlert.AlertTypeChoices.AI_ALERT, UnifiedAlert.AlertTypeChoices.AI_SUGGEST),
        ).count()
        last_alert = alerts.order_by('-triggered_at').values_list('triggered_at', flat=True).first()
        last_event = events.order_by('-triggered_at').values_list('triggered_at', flat=True).first()
        last_triggered_at = max(filter(None, [last_alert, last_event]), default=None)

        return envelope({
            'session_date': session_date.isoformat(),
            'active_alerts': active_alerts,
            'whale_alerts': whale_alerts,
            'dark_flow_alerts': dark_flow_alerts,
            'signal_alerts': signal_alerts,
            'system_alerts': system_alerts,
            'ai_alerts': ai_alerts,
            'order_flow_events': order_flow_events,
            'detection_rate': round((active_alerts / order_flow_events) * 100.0, 2) if order_flow_events else 0.0,
            'false_positive_rate': None,
            'avg_signal_latency_ms': _compute_avg_signal_latency_ms(events),
            'sentiment': _compute_signals_sentiment(alerts),
            'last_triggered_at': last_triggered_at.isoformat() if last_triggered_at else None,
        })


@extend_schema(
    summary='Lấy config whale Signals',
    description='Trả về cấu hình whale detection và monitor count của session gần nhất.',
    responses={
        200: envelope_response(SignalsWhaleResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsWhaleView(SOCBaseView):
    """GET /api/soc/signals/whale/"""

    def get(self, request):
        """Whale detection settings."""
        config = _get_signals_domain_config()
        scan_at = _latest_signal_scan_at()
        return envelope({
            'enabled': config.whale_enabled,
            'threshold_vnd': config.whale_threshold_vnd,
            'top_pct': config.whale_top_pct,
            'min_volume': config.whale_threshold_vnd,
            'last_scan_at': scan_at.isoformat() if scan_at else None,
            'active_monitors': OrderFlowEvent.objects.filter(
                session_date=_latest_signal_session_date(),
                signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
            ).count(),
        })


@extend_schema(
    summary='Lấy recent whale alerts Signals',
    description='Trả về danh sách whale alerts gần nhất trong session hiện tại.',
    responses={
        200: envelope_response(SignalsWhaleRecentResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsWhaleRecentView(SOCBaseView):
    """GET /api/soc/signals/whale/recent/"""

    def get(self, request):
        """Recent whale signals."""
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.WHALE,
            session_date=session_date,
        ) if session_date else UnifiedAlert.objects.none()
        params = _parse_recent_params(request)
        return paginated_envelope(_build_recent_response(
            queryset, params, lambda alert: {'order_value_vnd': alert.value},
        ))


@extend_schema(
    summary='Kiểm tra whale detection Signals',
    description='Chạy test nhẹ cho whale detection với symbol được chỉ định.',
    request=SignalsWhaleTestRequestSerializer,
    responses={
        200: envelope_response(SignalsWhaleTestResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsWhaleTestView(SOCBaseView):
    """POST /api/soc/signals/whale/test/"""

    def post(self, request):
        """Chay whale detection THAT tren tick cua symbol.

        W0.6: truoc day ham tra cung 'test_result': 'success' bat ke khi CHUA
        chay gi ⇒ operator tin nham da test. Bay phai bao so lieu that.
        """
        import logging as _logging
        from django.utils import timezone as _timezone

        # Lazy import: tranh keo pandas vao luc khoi dong server.
        from signal_intelligence.order_flow_engine import (
            detect_dark_flow_windows,
            detect_whale_ticks,
            load_session_ticks_df,
        )

        log = _logging.getLogger(__name__)
        symbol = str(request.data.get('symbol', 'VNM') or 'VNM').upper()
        session_date = _timezone.now().date()

        try:
            df = load_session_ticks_df(symbol, session_date)
        except Exception as exc:  # noqa: BLE001 — endpoint phai bao loi ro
            log.warning('soc_signals_whale_test: load tick that that: %s', exc)
            return envelope({
                'symbol': symbol,
                'test_result': 'error',
                'detection_possible': False,
                'session_date': session_date.isoformat(),
                'ticks_scanned': 0,
                'whale_ticks_detected': 0,
                'dark_flow_windows': 0,
                'note': f'Khong tai duoc du lieu tick: {exc.__class__.__name__}',
            })

        ticks = 0 if df is None else int(len(df))
        if ticks == 0:
            return envelope({
                'symbol': symbol,
                'test_result': 'no_data',
                'detection_possible': False,
                'smoke': False,
                'session_date': session_date.isoformat(),
                'ticks_scanned': 0,
                'whale_ticks_detected': 0,
                'dark_flow_windows': 0,
                'note': 'Khong co du lieu tick cho phien nay — KHONG co gi de detect. '
                        'Hay chay ingestion truoc khi test.',
            })

        whale_df = detect_whale_ticks(df)
        whale_count = 0 if whale_df is None else int(len(whale_df))
        dark_windows = detect_dark_flow_windows(df)
        return envelope({
            'symbol': symbol,
            'test_result': 'completed',
            'detection_possible': True,
            'smoke': False,
            'session_date': session_date.isoformat(),
            'ticks_scanned': ticks,
            'whale_ticks_detected': whale_count,
            'dark_flow_windows': len(dark_windows),
            'note': 'Ket qua chay THAT tren du lieu tick cua phien.',
        })


@extend_schema(
    summary='Lấy config dark-pool Signals',
    description='Trả về cấu hình dark-pool detection của domain signals.',
    responses={
        200: envelope_response(SignalsDarkPoolResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsDarkPoolView(SOCBaseView):
    """GET /api/soc/signals/dark-pool/"""

    def get(self, request):
        """Dark pool detection settings."""
        config = _get_signals_domain_config()
        scan_at = _latest_signal_scan_at()
        return envelope({
            'enabled': config.dark_pool_enabled,
            'threshold_vnd': config.dark_pool_threshold_vnd,
            'block_ratio_min': config.dark_pool_block_ratio_min,
            'last_scan_at': scan_at.isoformat() if scan_at else None,
        })


@extend_schema(
    summary='Lấy recent dark-pool alerts Signals',
    description='Trả về các dark-pool alerts gần nhất trong session hiện tại.',
    responses={
        200: envelope_response(SignalsDarkPoolRecentResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsDarkPoolRecentView(SOCBaseView):
    """GET /api/soc/signals/dark-pool/recent/"""

    def get(self, request):
        """Recent dark pool signals."""
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            session_date=session_date,
        ) if session_date else UnifiedAlert.objects.none()
        params = _parse_recent_params(request)
        return paginated_envelope(_build_recent_response(
            queryset, params, lambda alert: {'matched_value_vnd': alert.value},
        ))


@extend_schema(
    summary='Lấy config screener Signals',
    description='Trả về trạng thái signal screener và số rule đang active trong session gần nhất.',
    responses={
        200: envelope_response(SignalsScreenerResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
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
        rules_seen_session = len({
            alert.metadata.get('rule_name') or alert.metadata.get('rule') or alert.title
            for alert in recent_signal_alerts[:50]
        })
        return envelope({
            'enabled': config.screener_signal_enabled,
            'scan_interval_seconds': config.detection_task_interval_seconds,
            'rules_seen_session': rules_seen_session,
            'last_scan_at': latest_signal.triggered_at.isoformat() if latest_signal else None,
        })


@extend_schema(
    summary='Lấy recent screener alerts Signals',
    description='Trả về recent screener alerts của session hiện tại.',
    responses={
        200: envelope_response(SignalsRecentResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsScreenerRecentView(SOCBaseView):
    """GET /api/soc/signals/screener/recent/"""

    def get(self, request):
        """Recent screener alerts."""
        session_date = _latest_signal_session_date()
        queryset = UnifiedAlert.objects.filter(
            alert_type=UnifiedAlert.AlertTypeChoices.SIGNAL,
            session_date=session_date,
        ) if session_date else UnifiedAlert.objects.none()
        params = _parse_recent_params(request)
        return paginated_envelope(_build_recent_response(queryset, params))


@extend_schema(
    summary='Lấy retention policy Signals',
    description='Trả về retention policy hiện tại cho intraday tick, canonical events, bucket facts và forensic windows.',
    responses={
        200: envelope_response(SignalsRetentionPolicyResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsRetentionPolicyView(SOCBaseView):
    """GET /api/soc/signals/retention-policy/"""

    def get(self, request):
        """Data retention settings."""
        config = _get_signals_domain_config()
        return envelope({
            'intraday_tick_days': config.intraday_tick_retention_days,
            'canonical_event_days': config.canonical_event_retention_days,
            'bucket_fact_days': config.bucket_fact_retention_days,
            'forensic_window_days': config.forensic_window_days,
            # SOA-T07: session facts are long-lived derived data; floor is canonical_event_retention_days
            'session_facts_days': config.canonical_event_retention_days,
        })


@extend_schema(
    summary='Preview retention policy Signals',
    description='Validate preview cho retention policy của domain signals mà không thực hiện apply.',
    request=SignalsConfigPreviewRequestSerializer,
    responses={
        200: envelope_response(SignalsRetentionPreviewResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsRetentionPreviewView(SOCBaseView):
    """POST /api/soc/signals/retention-policy/preview/"""

    def post(self, request):
        config = SignalServicesDomainConfig.from_dict(request.data.get('config_payload', {}))
        errors = config.validate()
        alerts_count = UnifiedAlert.objects.count()
        events_count = OrderFlowEvent.objects.count()
        return envelope({
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


@extend_schema(
    summary='Lấy materialization status Signals',
    description='Trả về trạng thái materializer services, execution plan và mức sẵn sàng dữ liệu tín hiệu hiện tại.',
    responses={
        200: envelope_response(SignalsMaterializationResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsMaterializationView(SOCBaseView):
    """GET /api/soc/signals/materialization/"""

    def get(self, request):
        latest_detection_job = _get_latest_signal_job_run()
        return envelope({
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


@extend_schema(
    summary='Preview materialization Signals',
    description='Preview execution plan cho materialization theo domain hoặc symbol yêu cầu.',
    request=SignalsMaterializationPreviewRequestSerializer,
    responses={
        200: envelope_response(SignalsMaterializationPreviewResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsMaterializationPreviewView(SOCBaseView):
    """POST /api/soc/signals/materialization/preview/"""

    def post(self, request):
        domain = request.data.get('domain', 'all')
        symbol = request.data.get('symbol')
        if isinstance(symbol, str):
            symbol = symbol.strip().upper() or None
        session_dates = list(UnifiedAlert.objects.values_list('session_date', flat=True).distinct())
        return envelope({
            'domain': domain,
            'symbol': symbol,
            'session_dates_available': len(session_dates),
            'unified_alerts_available': UnifiedAlert.objects.count(),
            'order_flow_events_available': OrderFlowEvent.objects.count(),
            'execution_plan': _build_materialization_execution_plan(domain=domain, symbol=symbol),
        })


@extend_schema(
    summary='Lấy universe Signals',
    description='Trả về universe groups và ownership block reason cho domain signals.',
    responses={
        200: envelope_response(SignalsUniverseResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsUniverseView(SOCBaseView):
    """GET /api/soc/signals/universe/"""

    def get(self, request):
        config = _get_signals_domain_config()
        ownership = _build_signals_ownership_payload()
        return envelope({
            'universe_group_ids': config.universe_group_ids,
            'ownership': ownership,
            'write_block_reason': ownership.get('write_block_reason'),
        })


@extend_schema(
    summary='Cập nhật universe Signals',
    description='Endpoint bridge-write block cho cập nhật universe; luôn trả 403 từ SOC.',
    request=SignalsUniverseUpdateRequestSerializer,
    responses={
        403: SignalsBridgeWriteDeniedResponseSerializer,
        401: OpenApiTypes.OBJECT,
    },
)
class SignalsUniverseUpdateView(SOCBaseView):
    """POST /api/soc/signals/universe/update/"""

    def post(self, request):
        return _build_bridge_write_denied_response(self, request)


@extend_schema(
    summary='Queue detection job Signals',
    description='Queue một detection workflow cho domain hoặc symbol được yêu cầu và trả run-log snapshot.',
    request=SignalsJobRunRequestSerializer,
    responses={
        202: envelope_response(SignalsJobRunResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsJobRunView(SOCBaseView):
    """POST /api/soc/signals/jobs/run/"""

    allowed_domains = {'all', 'whale', 'dark_pool', 'dark_flow', 'screener', 'session_facts'}

    def post(self, request):
        domain = request.data.get('domain', 'all')
        if isinstance(domain, str):
            domain = domain.strip().lower() or 'all'
        else:
            domain = 'all'
        if domain not in self.allowed_domains:
            return Response({
                'detail': f"Domain '{domain}' không hỗ trợ. Cho phép: {sorted(self.allowed_domains)}.",
                'code': 'INVALID_SIGNAL_DOMAIN',
            }, status=status.HTTP_400_BAD_REQUEST)
        # W1.3: task workflow không có nhánh screener (chỉ whale/session_facts/dark_flow).
        # Chạy screener ở đây sẽ success rỗng — từ chối trung thực, hướng sang screener manual-scan.
        if domain == 'screener':
            return Response({
                'detail': 'Screener chạy qua POST /api/soc/screener/manual-scan/, không qua signals job.',
                'code': 'SCREENER_USE_MANUAL_SCAN',
            }, status=status.HTTP_400_BAD_REQUEST)
        # W1.3: alias FE 'dark_pool' → task 'dark_flow' (cùng pipeline).
        if domain == 'dark_pool':
            domain = 'dark_flow'
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

        return envelope({
            'service_key': run_log.service.service_key,
            'status': 'queued',
            'run_log_id': run_log.id,
            'celery_task_id': async_result.id,
            'domain': domain,
            'symbol': symbol,
            'requested_at': run_log.started_at.isoformat(),
        }, status=status.HTTP_202_ACCEPTED)


@extend_schema(
    summary='Lấy job status Signals',
    description='Trả về trạng thái detection job gần nhất của domain signals.',
    responses={
        200: envelope_response(SignalsJobStatusResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SignalsJobStatusView(SOCBaseView):
    """GET /api/soc/signals/jobs/status/"""

    def get(self, request):
        run_log = None
        run_log_id = request.query_params.get('run_log_id')
        if run_log_id:
            try:
                service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals'])
                run_log = ServiceRunLog.objects.filter(service=service, pk=int(run_log_id)).first()
            except (ValueError, TypeError):
                run_log = None
        if run_log is None:
            run_log = _get_latest_signal_job_run()
        return envelope({
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


@extend_schema(
    summary='Lấy performance metrics Signals',
    description='Trả về detection performance metrics của session tín hiệu hiện tại.',
    responses={
        200: envelope_response(SignalsPerformanceMetricsResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
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
        avg_latency_ms = _compute_avg_signal_latency_ms(events)
        return envelope({
            'whale_detection_accuracy': None,
            'dark_pool_detection_accuracy': None,
            'avg_detection_latency_ms': avg_latency_ms,
            'avg_signal_latency_ms': avg_latency_ms,
            'detection_rate': detection_rate,
            'false_positive_rate': None,
            'total_signals_processed': total_signals_processed,
            'sentiment': _compute_signals_sentiment(alerts),
        })
