"""
Signals Rule Management Views (W2.3, P2b) — rule table, change requests, feedback, precision proxies.

Bridge-write honored: SOC không apply config trực tiếp. Mọi thay đổi rule đi qua
ConfigChangeAudit(action='request') — immutable trail, owner signal_intelligence duyệt sau.

Endpoints:
  GET  /api/soc/signals/rules/ — bảng rule (config hiện tại + precision/hit-rate proxy per rule)
  POST /api/soc/signals/rules/request/ — tạo rule change request (audit, không apply)
  POST /api/soc/signals/rules/feedback/ — thumbs up/down per delivery (acknowledged / suppressed)
  GET  /api/soc/signals/rules/performance/ — precision/hit-rate proxy + top noisy (Datadog "noisiest monitors")
"""
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response

from signal_intelligence import delivery_service
from signal_intelligence.models import UnifiedAlert, UserAlertDelivery

from ..domain_configs.signals import SignalServicesDomainConfig
from ..models import ConfigChangeAudit
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from .base import SOCBaseView
from .signals import _build_signals_ownership_payload, _get_signals_domain_config
from .signals_triage import _serialize_delivery_with_context

FAMILY_ENABLED_FLAG = {
    'whale': 'whale_enabled',
    'dark_flow': 'dark_pool_enabled',
    'signal': 'screener_signal_enabled',
}

RULE_SPECS = [
    {'rule_key': 'whale_enabled', 'alert_family': 'whale', 'kind': 'enabled', 'label': 'Whale detection'},
    {'rule_key': 'whale_threshold_vnd', 'alert_family': 'whale', 'kind': 'threshold', 'label': 'Whale threshold (VNĐ)'},
    {'rule_key': 'whale_top_pct', 'alert_family': 'whale', 'kind': 'ratio', 'label': 'Whale top %'},
    {'rule_key': 'dark_pool_enabled', 'alert_family': 'dark_flow', 'kind': 'enabled', 'label': 'Dark pool detection'},
    {'rule_key': 'dark_pool_threshold_vnd', 'alert_family': 'dark_flow', 'kind': 'threshold', 'label': 'Dark pool threshold (VNĐ)'},
    {'rule_key': 'dark_pool_block_ratio_min', 'alert_family': 'dark_flow', 'kind': 'ratio', 'label': 'Dark pool min block ratio'},
    {'rule_key': 'screener_signal_enabled', 'alert_family': 'signal', 'kind': 'enabled', 'label': 'Screener signals'},
    {'rule_key': 'screener_signal_cooldown_seconds', 'alert_family': 'signal', 'kind': 'cooldown', 'label': 'Screener cooldown (s)'},
]
RULE_KEYS = {spec['rule_key'] for spec in RULE_SPECS}

RULE_FIELD_MAP = {
    'whale_enabled': 'enabled',
    'dark_pool_enabled': 'enabled',
    'screener_signal_enabled': 'enabled',
    'whale_threshold_vnd': 'threshold_vnd',
    'dark_pool_threshold_vnd': 'threshold_vnd',
    'screener_signal_cooldown_seconds': 'cooldown_seconds',
    'whale_top_pct': 'top_pct',
    'dark_pool_block_ratio_min': 'block_ratio_min',
}

METRIC_ALERT_FAMILIES = ('whale', 'dark_flow', 'signal')


class SignalsRuleRequestSerializer(serializers.Serializer):
    rule_key = serializers.CharField()
    enabled = serializers.BooleanField(required=False)
    threshold_vnd = serializers.IntegerField(required=False, min_value=0)
    cooldown_seconds = serializers.IntegerField(required=False, min_value=0)
    top_pct = serializers.FloatField(required=False, min_value=0.0, max_value=1.0)
    block_ratio_min = serializers.FloatField(required=False, min_value=0.0, max_value=1.0)
    change_reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


class SignalsRuleFeedbackSerializer(serializers.Serializer):
    alert_id = serializers.UUIDField()
    signal = serializers.ChoiceField(choices=['up', 'down'])
    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


def _rule_metric_builder(user):
    """Precision proxy per alert family từ deliveries của user (W2.3, W2.4 pattern).

    ack = positive, muted/suppressed = negative. Không đủ dữ liệu → null (UI hiện "—").
    """
    agg_rows = (
        UserAlertDelivery.objects.filter(user=user, alert__alert_type__in=list(METRIC_ALERT_FAMILIES))
        .values('alert__alert_type')
        .annotate(
            delivered=Count('pk'),
            acked=Count('pk', filter=Q(delivery_state=UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED)),
            muted=Count('pk', filter=Q(delivery_state=UserAlertDelivery.DeliveryStateChoices.MUTED)),
            suppressed=Count('pk', filter=Q(delivery_state=UserAlertDelivery.DeliveryStateChoices.SUPPRESSED)),
        )
    )
    by_family = {row['alert__alert_type']: row for row in agg_rows}

    def _metrics(family: str) -> dict:
        row = by_family.get(family)
        if row is None:
            return {
                'alert_count': 0,
                'acked': 0,
                'muted': 0,
                'suppressed': 0,
                'precision_proxy': None,
                'hit_rate': None,
            }
        delivered = row['delivered'] or 0
        acked = row['acked'] or 0
        muted = row['muted'] or 0
        suppressed = row['suppressed'] or 0
        responded = acked + muted + suppressed
        return {
            'alert_count': delivered,
            'acked': acked,
            'muted': muted,
            'suppressed': suppressed,
            'precision_proxy': round(acked / responded, 3) if responded else None,
            'hit_rate': round(responded / delivered, 3) if delivered else None,
        }

    return _metrics


def _build_rule_rows(metrics):
    config = _get_signals_domain_config()
    config_dict = config.to_dict()
    rows = []
    for spec in RULE_SPECS:
        family = spec['alert_family']
        enabled = bool(config_dict.get(FAMILY_ENABLED_FLAG[family], True))
        rows.append({
            'rule_key': spec['rule_key'],
            'alert_family': family,
            'label': spec['label'],
            'kind': spec['kind'],
            'enabled': enabled,
            'value': config_dict.get(spec['rule_key']),
            **metrics(family),
        })
    return rows


@extend_schema(
    summary='Bảng rules Signals',
    description='Config hiện tại (threshold/cooldown/enabled) + precision/hit-rate proxy per rule từ deliveries.',
    responses={200: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
)
class SignalsRuleListView(SOCBaseView):
    """GET /api/soc/signals/rules/"""

    def get(self, request):
        rows = _build_rule_rows(_rule_metric_builder(request.user))
        return Response({'rules': rows, 'generated_at': timezone.now().isoformat()})


@extend_schema(
    summary='Tạo rule change request',
    description='Bridge-write: ghi ConfigChangeAudit(action=request), KHÔNG apply trực tiếp. Owner duyệt sau.',
    request=SignalsRuleRequestSerializer,
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
)
class SignalsRuleRequestView(SOCBaseView):
    """POST /api/soc/signals/rules/request/"""

    def post(self, request):
        serializer = SignalsRuleRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return self.error_response(
                request,
                code='INVALID_RULE_PAYLOAD',
                detail=self._stringify_error_detail(serializer.errors),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors=serializer.errors,
            )
        validated = serializer.validated_data
        rule_key = validated['rule_key']
        if rule_key not in RULE_KEYS:
            return self.error_response(
                request,
                code='INVALID_RULE_KEY',
                detail=f"rule_key '{rule_key}' không hợp lệ.",
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'rule_key': [f"Chấp nhận: {', '.join(sorted(RULE_KEYS))}"]},
            )

        config_dict = _get_signals_domain_config().to_dict()
        candidate = dict(config_dict)
        field = RULE_FIELD_MAP[rule_key]
        if field in validated and validated[field] is not None:
            candidate[rule_key] = validated[field]

        errors = SignalServicesDomainConfig.from_dict(candidate).validate()
        if errors:
            return self.error_response(
                request,
                code='RULE_CHANGE_REJECTED',
                detail='; '.join(errors),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors={'payload': errors},
            )

        change_reason = (validated.get('change_reason') or '').strip()
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['signals'])
        audit = ConfigChangeAudit.objects.create(
            service=service,
            action='request',
            actor=getattr(request.user, 'username', 'api'),
            actor_ip=request.META.get('REMOTE_ADDR', ''),
            before_snapshot=config_dict,
            after_snapshot=candidate,
            change_summary=change_reason or f'Rule change request: {rule_key}',
            request_id=self.get_request_id(request),
        )
        return Response({
            'request_id': str(audit.pk),
            'pending': True,
            'rule_key': rule_key,
            'before': config_dict,
            'after': candidate,
            'ownership': _build_signals_ownership_payload(),
            'note': 'Rule change request đã ghi audit; duyệt ở signal_intelligence.',
        })


@extend_schema(
    summary='Feedback rule (thumbs up/down)',
    description='up → acknowledged; down → suppressed + suppression_reason. Muted/suppressed giữ registry (bỏ phiếu không hủy).',
    request=SignalsRuleFeedbackSerializer,
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
)
class SignalsRuleFeedbackView(SOCBaseView):
    """POST /api/soc/signals/rules/feedback/"""

    def post(self, request):
        serializer = SignalsRuleFeedbackSerializer(data=request.data)
        if not serializer.is_valid():
            return self.error_response(
                request,
                code='INVALID_FEEDBACK_PAYLOAD',
                detail=self._stringify_error_detail(serializer.errors),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors=serializer.errors,
            )
        validated = serializer.validated_data
        alert = UnifiedAlert.objects.filter(alert_id=validated['alert_id']).first()
        if alert is None:
            return Response({
                'detail': 'Không tìm thấy signal/alert.',
                'code': 'ALERT_NOT_FOUND',
            }, status=status.HTTP_404_NOT_FOUND)

        signal = validated['signal']
        reason = (validated.get('reason') or '')
        if signal == 'up':
            row = delivery_service.acknowledge_delivery(user=request.user, alert=alert)
        else:
            row = delivery_service.transition_delivery_state(
                user=request.user,
                alert=alert,
                target_state=UserAlertDelivery.DeliveryStateChoices.SUPPRESSED,
                suppression_reason=reason or 'rule feedback: down',
            )

        row.metadata = {**(row.metadata or {}), 'feedback_signal': signal, 'feedback_reason': reason.strip()}
        row.save(update_fields=['metadata', 'updated_at'])

        payload = _serialize_delivery_with_context(row)
        payload['signal'] = signal
        payload['feedback_reason'] = reason.strip()
        return Response(payload)


@extend_schema(
    summary='Performance rules Signals',
    description='Precision/recall proxy per rule từ deliveries + top noisy rules (Datadog "noisiest monitors"). Không đủ data → null.',
    responses={200: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
)
class SignalsRulePerformanceView(SOCBaseView):
    """GET /api/soc/signals/rules/performance/"""

    def get(self, request):
        metrics = _rule_metric_builder(request.user)
        rules = _build_rule_rows(metrics)
        by_family = [{'alert_family': family, **metrics(family)} for family in METRIC_ALERT_FAMILIES]

        totals = {key: sum(family[key] for family in by_family) for key in ('alert_count', 'acked', 'muted', 'suppressed')}
        responded = totals['acked'] + totals['muted'] + totals['suppressed']
        overall = {
            **totals,
            'precision_proxy': round(totals['acked'] / responded, 3) if responded else None,
            'hit_rate': round(responded / totals['alert_count'], 3) if totals['alert_count'] else None,
        }

        top_noisy = sorted(
            rules,
            key=lambda r: (r['alert_count'], r['suppressed']),
            reverse=True,
        )[:5]
        top_noisy = [
            {
                'rule_key': r['rule_key'],
                'alert_family': r['alert_family'],
                'label': r['label'],
                'enabled': r['enabled'],
                'alert_count': r['alert_count'],
                'precision_proxy': r['precision_proxy'],
                'hit_rate': r['hit_rate'],
            }
            for r in top_noisy
        ]

        return Response({
            'overall': overall,
            'by_family': by_family,
            'rules': rules,
            'top_noisy': top_noisy,
            'generated_at': timezone.now().isoformat(),
        })