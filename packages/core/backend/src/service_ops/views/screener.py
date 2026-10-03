"""
Screener Domain Views (9 endpoints).

GET  /api/soc/screener/config/               — get current config
POST /api/soc/screener/config/               — apply config
GET  /api/soc/screener/rules/                — list active rules
POST /api/soc/screener/rules/                — add rule
PUT  /api/soc/screener/rules/<rule_id>/      — update rule (S5-BE)
DELETE /api/soc/screener/rules/<rule_id>/delete/ — delete rule (S5-BE)
GET  /api/soc/screener/results/              — latest scan results
GET  /api/soc/screener/alert-history/        — alert history
POST /api/soc/screener/manual-scan/          — trigger manual scan
"""
import uuid

from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from signal_intelligence.models import UnifiedAlert

from ..domain_configs import ScreenerDomainConfig
from ..envelope import envelope, paginated_envelope
from ..models import ServiceConfig, ServiceDefinition, ServiceRunLog
from ..ownership import build_ownership_matrix_from_db
from ..registry import SOC_DOMAIN_PRIMARY_SERVICE_KEYS, get_registered_service
from ..serializers import ServiceConfigSerializer
from .base import SOCBaseView
from .mixins import ConfigApplyMixin
from vninvest_core.api_envelope import envelope_response


class ScreenerConfigPayloadSerializer(serializers.Serializer):
    rules = serializers.ListField(child=serializers.JSONField(), required=False)
    enabled = serializers.BooleanField(required=False)
    scan_interval_seconds = serializers.IntegerField(required=False)
    max_symbols_per_scan = serializers.IntegerField(required=False)
    alert_cooldown_seconds = serializers.IntegerField(required=False)
    max_alerts_per_symbol_per_hour = serializers.IntegerField(required=False)
    result_retention_hours = serializers.IntegerField(required=False)
    publish_to_redis = serializers.BooleanField(required=False)
    redis_channel_prefix = serializers.CharField(required=False, allow_blank=True)


class ScreenerConfigRequestSerializer(serializers.Serializer):
    config_payload = ScreenerConfigPayloadSerializer()
    change_reason = serializers.CharField(required=False, allow_blank=True)


class ScreenerConfigResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    service = serializers.IntegerField(required=False, allow_null=True)
    service_key = serializers.CharField(required=False)
    config_schema_version = serializers.CharField(required=False)
    config_payload = ScreenerConfigPayloadSerializer()
    applied_by = serializers.CharField(required=False, allow_blank=True)
    applied_at = serializers.DateTimeField(required=False, allow_null=True)
    change_reason = serializers.CharField(required=False, allow_blank=True)
    is_current = serializers.BooleanField()


class ScreenerRuleSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    type = serializers.CharField()
    enabled = serializers.BooleanField()
    threshold = serializers.JSONField(required=False, allow_null=True)
    value = serializers.JSONField(required=False, allow_null=True)


class ScreenerRulesResponseSerializer(serializers.Serializer):
    rules = ScreenerRuleSerializer(many=True)
    total_rules = serializers.IntegerField()


class ScreenerRuleCreateRequestSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    type = serializers.CharField(required=False, allow_blank=True)
    threshold = serializers.JSONField(required=False, allow_null=True)
    value = serializers.JSONField(required=False, allow_null=True)
    enabled = serializers.BooleanField(required=False, default=True)


class ScreenerRuleUpdateRequestSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True)
    type = serializers.CharField(required=False, allow_blank=True)
    threshold = serializers.JSONField(required=False, allow_null=True)
    value = serializers.JSONField(required=False, allow_null=True)
    enabled = serializers.BooleanField(required=False)


class ScreenerRuleCreateResponseSerializer(serializers.Serializer):
    rule_id = serializers.CharField()
    type = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    threshold = serializers.JSONField(required=False, allow_null=True)
    created_at = serializers.DateTimeField()


class ScreenerAlertSerializer(serializers.Serializer):
    id = serializers.CharField()
    symbol = serializers.CharField()
    rule = serializers.CharField()
    rule_name = serializers.CharField()
    value = serializers.JSONField()
    message = serializers.CharField()
    timestamp = serializers.DateTimeField()


class ScreenerResultsResponseSerializer(serializers.Serializer):
    scan_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    timestamp = serializers.DateTimeField(required=False, allow_null=True)
    symbols_scanned = serializers.IntegerField()
    alerts_triggered = serializers.IntegerField()
    symbols_matched = ScreenerAlertSerializer(many=True)
    scan_duration_ms = serializers.IntegerField(required=False)


class ScreenerAlertHistoryResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True, required=False)
    previous = serializers.CharField(allow_null=True, required=False)
    results = ScreenerAlertSerializer(many=True)


PAGINATION_PARAMETERS = [
    OpenApiParameter(
        name='page',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description='Trang kết quả (mặc định 1).',
        required=False,
    ),
    OpenApiParameter(
        name='page_size',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description='Số kết quả mỗi trang (mặc định 20, tối đa 100).',
        required=False,
    ),
]


class ScreenerManualScanRequestSerializer(serializers.Serializer):
    symbols = serializers.ListField(child=serializers.CharField(), required=False)


class ScreenerManualScanResponseSerializer(serializers.Serializer):
    scan_id = serializers.CharField()
    symbols_count = serializers.IntegerField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    run_log_id = serializers.IntegerField()
    session_date = serializers.CharField(required=False, allow_null=True)
    symbols_scanned = serializers.IntegerField(required=False)
    matched = serializers.ListField(child=serializers.JSONField(), required=False)
    rules_evaluated = serializers.IntegerField(required=False)
    rules_skipped = serializers.ListField(child=serializers.JSONField(), required=False)


class ScreenerOwnershipResponseSerializer(serializers.Serializer):
    domain = serializers.CharField()
    mode = serializers.CharField()
    writer = serializers.CharField(required=False, allow_blank=True)
    owner_team = serializers.CharField(required=False, allow_blank=True)
    write_surface = serializers.CharField(required=False, allow_blank=True)
    can_apply = serializers.BooleanField()
    locked_fields = serializers.ListField(child=serializers.CharField())
    compatibility_domains = serializers.ListField(child=serializers.CharField())
    write_block_reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)


def _get_screener_config() -> ScreenerDomainConfig:
    try:
        service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
        current_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
        if current_config and isinstance(current_config.config_payload, dict):
            return ScreenerDomainConfig.from_dict(current_config.config_payload)
    except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
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


def _audit_screener_rule_change(request, request_id, action, before_rules, after_rules):
    """SC-11: audit trail for global rule mutations (mirrors ConfigApplyMixin)."""
    from ..models import ConfigChangeAudit

    service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
    summary = request.data.get('change_reason', action) if isinstance(request.data, dict) else action
    ConfigChangeAudit.objects.create(
        service=service,
        action=action,
        actor=getattr(request.user, 'username', 'api'),
        actor_ip=request.META.get('REMOTE_ADDR', ''),
        before_snapshot={'rules': before_rules},
        after_snapshot={'rules': after_rules},
        change_summary=summary,
        request_id=request_id,
    )


def _deny_screener_write_unless_owner(view, request):
    """SC-07: enforce ownership matrix on rule CRUD. Returns 403 or None."""
    matrix = build_ownership_matrix_from_db()
    if matrix.is_domain_writable('screener'):
        return None
    block_reason = matrix.get_write_block_reason('screener')
    return view.error_response(
        request,
        code='OWNERSHIP_WRITE_DENIED',
        detail=block_reason or "Domain 'screener' không có quyền ghi.",
        http_status=status.HTTP_403_FORBIDDEN,
    )


def _normalize_screener_rule_type(raw_type):
    """SC-11: blank/missing type becomes 'custom'; unknown types rejected."""
    from ..domain_configs.screener import VALID_RULE_TYPES

    rule_type = (raw_type or '').strip() or 'custom'
    if rule_type not in VALID_RULE_TYPES:
        return None
    return rule_type


def _save_screener_rules_config(request, updated_rules: list) -> None:
    """Persist updated rules list back into ServiceConfig (current version)."""
    service = get_registered_service(SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'])
    current = ServiceConfig.objects.filter(service=service, is_current=True).first()
    current_payload = dict(current.config_payload) if current and isinstance(current.config_payload, dict) else {}
    current_payload['rules'] = updated_rules
    with transaction.atomic():
        ServiceConfig.objects.filter(service=service, is_current=True).update(is_current=False)
        ServiceConfig.objects.create(
            service=service,
            config_schema_version='1.0',
            config_payload=current_payload,
            applied_by=getattr(request.user, 'username', 'api'),
            change_reason=request.data.get('change_reason', 'rule_crud'),
        )


def _build_default_screener_config_response() -> dict:
    default = ScreenerDomainConfig()
    return {
        'service_key': SOC_DOMAIN_PRIMARY_SERVICE_KEYS['screener'],
        'config_schema_version': '1.0',
        'config_payload': default.to_dict(),
        'applied_by': 'system',
        'applied_at': None,
        'change_reason': '',
        'is_current': True,
    }


@extend_schema_view(
    get=extend_schema(
        summary='Lấy runtime config Screener',
        description='Trả về config hiệu lực của domain Screener cùng metadata áp dụng hiện tại.',
        responses={
            200: envelope_response(ScreenerConfigResponseSerializer),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
    post=extend_schema(
        summary='Apply runtime config Screener',
        description='Áp dụng config mới cho Global Screener và trả snapshot config hiện hành.',
        request=ScreenerConfigRequestSerializer,
        responses={
            201: ScreenerConfigResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
)
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
                return envelope(ServiceConfigSerializer(current_config).data)
        except (ServiceDefinition.DoesNotExist, ServiceConfig.DoesNotExist):
            pass
        return envelope(_build_default_screener_config_response())

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
            # `apply_config` chỉ trả Response khi lỗi (RFC 9457) — không bọc.
            return result
        service, svc_config = result
        return envelope(
            ServiceConfigSerializer(svc_config).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema_view(
    get=extend_schema(
        summary='Lấy rules Screener',
        description='Trả về danh sách rule đang active trong config Screener hiện tại.',
        responses={
            200: envelope_response(ScreenerRulesResponseSerializer),
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
    post=extend_schema(
        summary='Tạo rule Screener',
        description='Tạo một rule tạm thời theo contract hiện tại của surface Screener.',
        request=ScreenerRuleCreateRequestSerializer,
        responses={
            201: ScreenerRuleCreateResponseSerializer,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
    ),
)
class ScreenerRulesView(SOCBaseView):
    """GET /api/soc/screener/rules/"""

    def get(self, request):
        """List active screening rules."""
        config = _get_screener_config()
        rules = [
            {
                'id': rule.get('id') or f'rule_{index + 1}',
                'name': rule.get('name') or rule.get('type') or f'Rule {index + 1}',
                'type': rule.get('type', 'custom'),
                'enabled': rule.get('enabled', True),
                'threshold': rule.get('threshold'),
                'value': rule.get('value'),
            }
            for index, rule in enumerate(config.rules)
        ]
        return envelope({
            'rules': rules,
            'total_rules': len(rules),
        })

    def post(self, request):
        """Add new screening rule and persist to ServiceConfig."""
        denied = _deny_screener_write_unless_owner(self, request)
        if denied is not None:
            return denied
        serializer = ScreenerRuleCreateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        rule_type = _normalize_screener_rule_type(serializer.validated_data.get('type'))
        if rule_type is None:
            return Response(
                {'detail': f"Rule type '{serializer.validated_data.get('type')}' không hợp lệ.",
                 'code': 'INVALID_RULE_TYPE'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        rule_id = f'rule_{uuid.uuid4().hex[:12]}'
        now = timezone.now()
        new_rule = {
            'id': rule_id,
            'name': serializer.validated_data.get('name') or rule_type or rule_id,
            'type': rule_type,
            'threshold': serializer.validated_data.get('threshold'),
            'value': serializer.validated_data.get('value'),
            'enabled': serializer.validated_data.get('enabled', True),
        }

        config = _get_screener_config()
        before_rules = list(config.rules)
        updated_rules = before_rules + [new_rule]
        _save_screener_rules_config(request, updated_rules)
        _audit_screener_rule_change(
            request, self.get_request_id(request), 'rule_create', before_rules, updated_rules)

        return envelope({
            'rule_id': rule_id,
            'name': new_rule['name'],
            'type': new_rule['type'],
            'threshold': new_rule['threshold'],
            'value': new_rule['value'],
            'enabled': new_rule['enabled'],
            'created_at': now.isoformat(),
        }, status=status.HTTP_201_CREATED)


@extend_schema(
    summary='Cập nhật rule Screener',
    description='Cập nhật một rule Screener theo rule_id. Trả 404 nếu rule không tồn tại.',
    request=ScreenerRuleUpdateRequestSerializer,
    responses={
        200: ScreenerRuleCreateResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerRuleUpdateView(SOCBaseView):
    """PUT /api/soc/screener/rules/<rule_id>/"""

    def put(self, request, rule_id):
        """Update an existing screening rule by rule_id."""
        denied = _deny_screener_write_unless_owner(self, request)
        if denied is not None:
            return denied
        serializer = ScreenerRuleUpdateRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        config = _get_screener_config()
        rules = list(config.rules)
        target_index = next(
            (i for i, r in enumerate(rules) if r.get('id') == rule_id),
            None,
        )
        if target_index is None:
            return Response(
                {'detail': f"Rule '{rule_id}' không tồn tại.", 'code': 'RULE_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND,
            )

        existing = dict(rules[target_index])
        before_rules = list(rules)
        data = serializer.validated_data
        if 'name' in data:
            existing['name'] = data['name']
        if 'type' in data:
            rule_type = _normalize_screener_rule_type(data['type'])
            if rule_type is None:
                return Response(
                    {'detail': f"Rule type '{data['type']}' không hợp lệ.",
                     'code': 'INVALID_RULE_TYPE'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            existing['type'] = rule_type
        if 'threshold' in data:
            existing['threshold'] = data['threshold']
        if 'value' in data:
            existing['value'] = data['value']
        if 'enabled' in data:
            existing['enabled'] = data['enabled']
        rules[target_index] = existing

        _save_screener_rules_config(request, rules)
        _audit_screener_rule_change(
            request, self.get_request_id(request), 'rule_update', before_rules, list(rules))

        return envelope({
            'rule_id': rule_id,
            'name': existing.get('name'),
            'type': existing.get('type'),
            'threshold': existing.get('threshold'),
            'value': existing.get('value'),
            'enabled': existing.get('enabled'),
            'created_at': timezone.now().isoformat(),
        }, status=status.HTTP_200_OK)


@extend_schema(
    summary='Xóa rule Screener',
    description='Xóa một rule Screener theo rule_id. Trả 204 khi thành công, 404 nếu không tìm thấy.',
    responses={
        204: None,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScreenerRuleDeleteView(SOCBaseView):
    """DELETE /api/soc/screener/rules/<rule_id>/delete/"""

    def delete(self, request, rule_id):
        """Delete a screening rule by rule_id."""
        denied = _deny_screener_write_unless_owner(self, request)
        if denied is not None:
            return denied
        config = _get_screener_config()
        rules = list(config.rules)
        original_len = len(rules)
        updated_rules = [r for r in rules if r.get('id') != rule_id]

        if len(updated_rules) == original_len:
            return Response(
                {'detail': f"Rule '{rule_id}' không tồn tại.", 'code': 'RULE_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND,
            )

        _save_screener_rules_config(request, updated_rules)
        _audit_screener_rule_change(
            request, self.get_request_id(request), 'rule_delete', rules, updated_rules)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='Lấy kết quả scan Screener',
    description=(
        'Kết quả của lần manual scan thành công gần nhất (run log '
        'screener_scan_dispatcher): số mã quét/mã khớp thật + thời gian quét '
        'thật từ duration. Trả zeros trung thực khi chưa có lần chạy nào — '
        'không còn mượn signal feed.'
    ),
    responses={
        200: envelope_response(ScreenerResultsResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerResultsView(SOCBaseView):
    """GET /api/soc/screener/results/"""

    def get(self, request):
        """Latest completed manual scan results (SC-04/SC-10)."""
        try:
            dispatcher_service = get_registered_service('screener_scan_dispatcher')
        except ServiceDefinition.DoesNotExist:
            dispatcher_service = None
        log = None
        if dispatcher_service is not None:
            log = ServiceRunLog.objects.filter(
                service=dispatcher_service, status='success'
            ).order_by('-started_at').first()
        if log is None:
            return envelope({
                'scan_id': None,
                'timestamp': None,
                'symbols_scanned': 0,
                'alerts_triggered': 0,
                'symbols_matched': [],
                'scan_duration_ms': 0,
            })
        out = log.output_summary if isinstance(log.output_summary, dict) else {}
        sample = out.get('matched_sample') or []
        if not isinstance(sample, list):
            sample = []
        session_date = out.get('session_date')
        symbols_matched = [
            {
                'id': f"{m.get('symbol', 'symbol')}-{index}",
                'symbol': m.get('symbol'),
                'rule': m.get('rule_name') or 'rule',
                'rule_name': m.get('rule_name') or 'rule',
                'value': m.get('close'),
                'message': f"{m.get('rule_name') or 'rule'}: {m.get('close')}",
                'timestamp': session_date,
            }
            for index, m in enumerate(sample[:20])
            if isinstance(m, dict)
        ]
        duration_ms = int((log.duration_seconds or 0.0) * 1000)
        finished = log.finished_at or log.started_at
        return envelope({
            'scan_id': f'scan_{log.id}',
            'timestamp': finished.isoformat() if finished else None,
            'symbols_scanned': int(out.get('symbols_scanned') or 0),
            'alerts_triggered': int(out.get('matched_count') or 0),
            'symbols_matched': symbols_matched,
            'scan_duration_ms': duration_ms,
        })


@extend_schema(
    summary='Lấy alert history Screener',
    description='Trả về lịch sử signal alerts có pagination của surface Screener.',
    parameters=PAGINATION_PARAMETERS,
    responses={
        200: envelope_response(ScreenerAlertHistoryResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerAlertHistoryView(SOCBaseView):
    """GET /api/soc/screener/alert-history/"""

    def get(self, request):
        """Alert history with pagination."""
        queryset = _get_recent_signal_alerts()
        page = self.paginate_queryset(queryset, request)
        alerts = [_serialize_signal_alert(alert) for alert in page]
        paginated_response = self.get_paginated_response(alerts)
        # Bọc cả khối phân trang (count/next/previous/results) trong `data`.
        return paginated_envelope(dict(paginated_response.data))


@extend_schema(
    summary='Run manual scan Screener',
    description=(
        'Đánh giá đồng bộ các global rule đang bật (điều kiện trong rule '
        '`value`, định dạng user-engine) trên các symbol chỉ định bằng đúng '
        'data layer của /screener. Ghi ServiceRunLog success/failed để truy vết.'
    ),
    request=ScreenerManualScanRequestSerializer,
    responses={
        200: envelope_response(ScreenerManualScanResponseSerializer),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        429: OpenApiTypes.OBJECT,
    },
)
class ScreenerManualScanView(SOCBaseView):
    """POST /api/soc/screener/manual-scan/"""

    def post(self, request):
        """Run a synchronous manual scan over enabled global rules."""
        from ..screener_bridge import evaluate_global_screener

        symbols = request.data.get('symbols', [])
        if not isinstance(symbols, list) or not [s for s in symbols if str(s).strip()]:
            return Response(
                {'detail': 'symbols phải là list không rỗng.', 'code': 'SYMBOLS_REQUIRED'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        dispatcher_service = get_registered_service('screener_scan_dispatcher')
        run_log = ServiceRunLog.objects.create(
            service=dispatcher_service,
            status='running',
            input_summary={
                'symbols': symbols,
                'requested_by': getattr(request.user, 'username', 'api'),
            },
            output_summary={},
        )
        try:
            config = _get_screener_config()
            result = evaluate_global_screener(symbols, config.rules)
        except Exception as exc:
            run_log.status = 'failed'
            run_log.error_detail = str(exc)[:2000]
            run_log.finished_at = timezone.now()
            if run_log.started_at:
                run_log.duration_seconds = max(
                    (run_log.finished_at - run_log.started_at).total_seconds(), 0.0
                )
            run_log.save(update_fields=['status', 'error_detail', 'finished_at', 'duration_seconds'])
            return Response(
                {'detail': f'Quét thất bại: {exc}', 'code': 'SCAN_FAILED'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        run_log.status = 'success'
        run_log.output_summary = {
            'matched_count': len(result['matched']),
            'symbols_scanned': result['symbols_scanned'],
            'rules_evaluated': result['rules_evaluated'],
            'session_date': result['session_date'],
            # SC-10: capped sample so /results/ can serve real scan rows.
            'matched_sample': result['matched'][:20],
        }
        run_log.finished_at = timezone.now()
        if run_log.started_at:
            run_log.duration_seconds = max(
                (run_log.finished_at - run_log.started_at).total_seconds(), 0.0
            )
        run_log.save(update_fields=['status', 'output_summary', 'finished_at', 'duration_seconds'])
        return envelope({
            'scan_id': f'scan_{run_log.id}',
            'symbols_count': len(result['symbols_requested']),
            'status': 'completed',
            'created_at': run_log.started_at.isoformat(),
            'run_log_id': run_log.id,
            'session_date': result['session_date'],
            'symbols_scanned': result['symbols_scanned'],
            'matched': result['matched'],
            'rules_evaluated': result['rules_evaluated'],
            'rules_skipped': result['rules_skipped'],
        }, status=status.HTTP_200_OK)


@extend_schema(
    summary='Run rules Screener',
    description='Spec-compatible alias của manual scan cho Screener (đánh giá đồng bộ).',
    request=ScreenerManualScanRequestSerializer,
    responses={
        202: ScreenerManualScanResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerRulesRunView(ScreenerManualScanView):
    """POST /api/soc/screener/rules/run/ — spec-compatible alias of manual scan."""

    def post(self, request):
        return super().post(request)


@extend_schema(
    summary='Lấy ownership Screener',
    description='Trả về ownership matrix cho domain Screener để xác định khả năng apply config từ SOC.',
    responses={
        200: envelope_response(ScreenerOwnershipResponseSerializer),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ScreenerOwnershipView(SOCBaseView):
    """GET /api/soc/screener/ownership/"""

    def get(self, request):
        return envelope(_build_screener_ownership_payload())
