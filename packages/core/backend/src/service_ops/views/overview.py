"""SOC overview endpoints aligned with the documented summary and service contracts."""

from datetime import timedelta

from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
from django.db.models import Count, Q
from django.db.models.functions import TruncHour
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from ..models import (
    ConfigChangeAudit,
    OwnershipRecord,
    ServiceConfig,
    ServiceDefinition,
    ServiceHealth,
    ServiceHealthCheckLog,
    ServiceRunLog,
)
from ..ownership import get_ownership_matrix
from ..serializers import (
    ConfigChangeAuditSerializer,
    OwnershipRecordSerializer,
    ServiceConfigSerializer,
    ServiceDefinitionSerializer,
    ServiceHealthSerializer,
    ServiceRunLogSerializer,
)
from .base import SOCBaseView


STANDARD_PAGINATION_PARAMETERS = [
    OpenApiParameter(
        name='page',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description='Trang cần đọc theo pagination chuẩn của SOC. Mặc định 1.',
        required=False,
    ),
    OpenApiParameter(
        name='page_size',
        type=OpenApiTypes.INT,
        location=OpenApiParameter.QUERY,
        description='Số kết quả mỗi trang. Mặc định 20, tối đa 100.',
        required=False,
    ),
]


class OverviewCountsSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    healthy = serializers.IntegerField()
    degraded = serializers.IntegerField()
    unhealthy = serializers.IntegerField()
    unknown = serializers.IntegerField()
    maintenance = serializers.IntegerField()


class ServiceSummaryRowSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    name = serializers.CharField()
    domain = serializers.CharField()
    status = serializers.CharField()
    is_active = serializers.BooleanField()
    last_check_at = serializers.DateTimeField(allow_null=True)
    avg_response_ms = serializers.FloatField(allow_null=True)


class ServiceOwnershipPayloadSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    domain = serializers.CharField()
    owner_team = serializers.CharField(required=False, allow_blank=True)
    write_mode = serializers.CharField(required=False, allow_blank=True)
    mode = serializers.CharField(required=False, allow_blank=True)
    writer = serializers.CharField(required=False, allow_blank=True)
    write_surface = serializers.CharField(required=False, allow_blank=True)
    can_apply = serializers.BooleanField(required=False)
    locked_fields = serializers.ListField(child=serializers.CharField(), required=False)
    compatibility_domains = serializers.ListField(child=serializers.CharField(), required=False)
    deprecation_notes = serializers.CharField(required=False, allow_blank=True)
    updated_at = serializers.DateTimeField(required=False, allow_null=True)


class ServiceCurrentConfigSnapshotSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    service = serializers.IntegerField(required=False)
    service_key = serializers.CharField()
    config_schema_version = serializers.CharField()
    config_payload = serializers.JSONField()
    applied_by = serializers.CharField(allow_blank=True)
    applied_at = serializers.DateTimeField(allow_null=True)
    change_reason = serializers.CharField(allow_blank=True)
    is_current = serializers.BooleanField()


class ServiceHealthSnapshotSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    status = serializers.CharField()
    last_check_at = serializers.DateTimeField(allow_null=True)
    last_success_at = serializers.DateTimeField(allow_null=True)
    consecutive_failures = serializers.IntegerField()
    avg_response_ms = serializers.FloatField(allow_null=True)
    detail = serializers.JSONField()


class ServiceDetailResponseSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    service_key = serializers.CharField()
    name = serializers.CharField()
    domain = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    owner_team = serializers.CharField()
    tags = serializers.ListField(child=serializers.CharField(), required=False)
    is_active = serializers.BooleanField()
    is_deprecated = serializers.BooleanField()
    deprecation_note = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    current_config = ServiceCurrentConfigSnapshotSerializer(allow_null=True)
    health = ServiceHealthSnapshotSerializer()
    ownership = ServiceOwnershipPayloadSerializer()


class OverviewSummaryResponseSerializer(serializers.Serializer):
    generated_at = serializers.DateTimeField()
    summary = OverviewCountsSerializer()
    by_domain = serializers.DictField(child=serializers.DictField(child=serializers.IntegerField()))
    services = ServiceSummaryRowSerializer(many=True)


class HealthStatusResponseSerializer(serializers.Serializer):
    total_services = serializers.IntegerField()
    active_services = serializers.IntegerField()
    health_status_counts = serializers.DictField(child=serializers.IntegerField())
    services = ServiceHealthSerializer(many=True)


class HealthCheckTriggerResponseSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    status = serializers.CharField()
    run_log_id = serializers.IntegerField()
    requested_at = serializers.DateTimeField()


class PaginatedServiceDefinitionResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = ServiceDefinitionSerializer(many=True)


class PaginatedServiceConfigResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = ServiceConfigSerializer(many=True)


class PaginatedServiceRunLogResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = ServiceRunLogSerializer(many=True)


class PaginatedConfigChangeAuditResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = ConfigChangeAuditSerializer(many=True)


def _get_service_or_error(view: SOCBaseView, request, service_key: str):
    try:
        return ServiceDefinition.objects.get(service_key=service_key), None
    except ServiceDefinition.DoesNotExist:
        return None, view.error_response(
            request,
            code='SERVICE_NOT_FOUND',
            detail=f"Service '{service_key}' không tồn tại.",
            http_status=status.HTTP_404_NOT_FOUND,
        )


def _get_ownership_payload(service: ServiceDefinition) -> dict:
    ownership = OwnershipRecord.objects.filter(domain=service.domain).first()
    if ownership is not None:
        return OwnershipRecordSerializer(ownership).data
    return get_ownership_matrix().to_response_dict(service.domain)


def _get_current_config(service: ServiceDefinition) -> ServiceConfig | None:
    return ServiceConfig.objects.filter(service=service, is_current=True).order_by('-applied_at').first()


def _serialize_health(service: ServiceDefinition) -> dict:
    health = ServiceHealth.objects.filter(service=service).first()
    if health is not None:
        return ServiceHealthSerializer(health).data
    return {
        'service_key': service.service_key,
        'status': 'unknown',
        'last_check_at': None,
        'last_success_at': None,
        'consecutive_failures': 0,
        'avg_response_ms': None,
        'detail': {},
    }


def _serialize_service_detail(service: ServiceDefinition) -> dict:
    payload = ServiceDefinitionSerializer(service).data
    current_config = _get_current_config(service)
    payload['current_config'] = (
        ServiceConfigSerializer(current_config).data
        if current_config is not None else None
    )
    payload['health'] = _serialize_health(service)
    payload['ownership'] = _get_ownership_payload(service)
    return payload


@extend_schema(
    summary='Lấy tổng quan sức khỏe SOC',
    description='Trả về snapshot tổng hợp theo domain cho toàn bộ service trong Service Operations Center (bao gồm cả inactive).',
    responses={
        200: OverviewSummaryResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'SOC overview summary',
            value={
                'generated_at': '2026-05-15T14:00:00Z',
                'summary': {
                    'total': 4,
                    'healthy': 2,
                    'degraded': 1,
                    'unhealthy': 0,
                    'unknown': 1,
                    'maintenance': 0,
                },
                'by_domain': {
                    'vnbroker': {
                        'total': 1,
                        'healthy': 1,
                        'degraded': 0,
                        'unhealthy': 0,
                        'unknown': 0,
                        'maintenance': 0,
                    }
                },
                'services': [
                    {
                        'service_key': 'vnbroker_runtime',
                        'name': 'VNBroker Runtime',
                        'domain': 'vnbroker',
                        'status': 'healthy',
                        'is_active': True,
                        'last_check_at': '2026-05-15T13:59:00Z',
                        'avg_response_ms': 25.0,
                    }
                ],
            },
        )
    ],
)
class OverviewSummaryView(SOCBaseView):
    """GET SOC health summary grouped by domain."""

    def get(self, request):
        services = list(ServiceDefinition.objects.all().order_by('domain', 'service_key'))
        health_by_service_id = {
            health.service_id: health
            for health in ServiceHealth.objects.filter(service__in=services).select_related('service')
        }
        summary = {
            'total': len(services),
            'healthy': 0,
            'degraded': 0,
            'unhealthy': 0,
            'unknown': 0,
            'maintenance': 0,
        }
        by_domain = {}
        service_rows = []

        for service in services:
            health = health_by_service_id.get(service.id)
            status_name = health.status if health is not None else 'unknown'
            summary[status_name] = summary.get(status_name, 0) + 1

            domain_row = by_domain.setdefault(
                service.domain,
                {
                    'total': 0,
                    'healthy': 0,
                    'degraded': 0,
                    'unhealthy': 0,
                    'unknown': 0,
                    'maintenance': 0,
                },
            )
            domain_row['total'] += 1
            domain_row[status_name] = domain_row.get(status_name, 0) + 1

            service_rows.append({
                'service_key': service.service_key,
                'name': service.name,
                'domain': service.domain,
                'status': status_name,
                'is_active': service.is_active,
                'last_check_at': health.last_check_at.isoformat() if health and health.last_check_at else None,
                'avg_response_ms': health.avg_response_ms if health else None,
            })

        return Response({
            'generated_at': timezone.now().isoformat(),
            'summary': summary,
            'by_domain': by_domain,
            'services': service_rows,
        })


@extend_schema(
    summary='Liệt kê danh mục service SOC',
    description='Trả về danh sách paginated tất cả service đang được quản lý trong SOC (bao gồm cả inactive).',
    parameters=STANDARD_PAGINATION_PARAMETERS,
    responses={
        200: PaginatedServiceDefinitionResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ServiceListView(SOCBaseView):
    """GET paginated SOC service catalog."""

    def get(self, request):
        queryset = ServiceDefinition.objects.all().order_by('domain', 'service_key')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            return self.get_paginated_response(ServiceDefinitionSerializer(page, many=True).data)
        return Response(ServiceDefinitionSerializer(queryset, many=True).data)


@extend_schema(
    summary='Lấy chi tiết service SOC',
    description='Trả về metadata service, config hiện tại, health snapshot và ownership payload cho một service cụ thể.',
    responses={
        200: ServiceDetailResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
@extend_schema(
    summary='Cập nhật trạng thái active/inactive của service SOC',
    description='Cho phép operator bật/tắt service thông qua PATCH is_active.',
    request=serializers.Serializer,
    responses={
        200: ServiceDetailResponseSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Toggle service active',
            value={'is_active': False},
            request_only=True,
        ),
        OpenApiExample(
            'Toggle service active response',
            value={
                'id': 1,
                'service_key': 'vnbroker_quote',
                'name': 'VNBroker Quote Fetcher',
                'domain': 'vnbroker',
                'description': 'Fetches realtime quote data through the canonical vnbroker adapter.',
                'owner_team': 'core',
                'tags': ['market-data', 'realtime', 'ssot'],
                'is_active': False,
                'is_deprecated': False,
                'deprecation_note': '',
                'created_at': '2026-05-15T14:00:00Z',
                'updated_at': '2026-06-20T10:00:00Z',
                'current_config': None,
                'health': {'status': 'unknown', 'last_check_at': None, 'last_success_at': None, 'consecutive_failures': 0, 'avg_response_ms': None, 'detail': {}},
                'ownership': {'domain': 'vnbroker', 'mode': 'native-write', 'writer': 'service_ops', 'owner_team': 'core', 'write_surface': 'service_ops', 'can_apply': True, 'locked_fields': [], 'compatibility_domains': []},
            },
            response_only=True,
        ),
    ],
)
class ServiceDetailView(SOCBaseView):
    """GET/PATCH detail for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
        return Response(_serialize_service_detail(service))

    def patch(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        is_active = request.data.get('is_active')
        if is_active is None:
            return self.error_response(
                request,
                code='INVALID_PAYLOAD',
                detail='Thiếu trường is_active trong request body.',
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        if not isinstance(is_active, bool):
            return self.error_response(
                request,
                code='INVALID_PAYLOAD',
                detail='Trường is_active phải là boolean (true/false).',
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        change_reason = str(request.data.get('change_reason', '') or '').strip()
        previous_is_active = service.is_active
        service.is_active = is_active
        service.save(update_fields=['is_active', 'updated_at'])

        # Audit toggle — optional reason, backward compatible when empty
        try:
            from ..models import ConfigChangeAudit
            summary = change_reason or ('Bật dịch vụ {}'.format(service.service_key) if is_active else 'Tắt dịch vụ {}'.format(service.service_key))
            ConfigChangeAudit.objects.create(
                service=service,
                action='toggle',
                actor=getattr(request.user, 'username', 'api') or 'api',
                actor_ip=request.META.get('REMOTE_ADDR', ''),
                before_snapshot={'is_active': previous_is_active},
                after_snapshot={'is_active': is_active},
                change_summary=summary,
                request_id=self.get_request_id(request),
            )
        except Exception:
            pass

        return Response(_serialize_service_detail(service))


@extend_schema(
    summary='Queue health check thủ công cho service SOC',
    description='Tạo một queued run log để operator kích hoạt health probe thủ công cho service được chọn.',
    request=None,
    responses={
        202: HealthCheckTriggerResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Queued health check',
            value={
                'service_key': 'vnbroker_runtime',
                'status': 'queued',
                'run_log_id': 101,
                'requested_at': '2026-05-15T14:05:00Z',
            },
            response_only=True,
        )
    ],
)
class ServiceHealthCheckTriggerView(SOCBaseView):
    """POST manual health-check trigger for one SOC service."""

    def post(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        run_log = ServiceRunLog.objects.create(
            service=service,
            status='queued',
            input_summary={
                'trigger': 'manual_health_check',
                'requested_by': getattr(request.user, 'username', 'api'),
            },
            output_summary={},
        )
        return Response({
            'service_key': service.service_key,
            'status': 'queued',
            'run_log_id': run_log.id,
            'requested_at': run_log.started_at.isoformat(),
        }, status=status.HTTP_202_ACCEPTED)


@extend_schema(
    summary='Lấy config hiện tại của service SOC',
    description='Trả về config snapshot hiện tại của service. Nếu chưa có config current thì trả payload rỗng nhưng vẫn cùng contract.',
    responses={
        200: ServiceCurrentConfigSnapshotSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
@extend_schema(
    summary='Áp dụng cấu hình mới cho service SOC',
    description='Validate và lưu cấu hình mới cho service. Tự động tạo audit trail và de-activate config cũ.',
    request=serializers.Serializer,
    responses={
        201: ServiceCurrentConfigSnapshotSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Apply config request',
            value={
                'config_payload': {
                    'timeout': {'connect': 10.0, 'read': 30.0},
                    'max_retries': 3,
                    'retry_delay_seconds': 2.0,
                },
                'change_reason': 'Tăng timeout do mạng chập chờn',
            },
            request_only=True,
        ),
        OpenApiExample(
            'Apply config response',
            value={
                'id': 1,
                'service': 1,
                'service_key': 'vnbroker_quote',
                'config_schema_version': '1.0',
                'config_payload': {
                    'timeout': {'connect': 10.0, 'read': 30.0},
                    'max_retries': 3,
                    'retry_delay_seconds': 2.0,
                },
                'applied_by': 'admin',
                'applied_at': '2026-06-20T10:00:00Z',
                'change_reason': 'Tăng timeout do mạng chập chờn',
                'is_current': True,
            },
            response_only=True,
        ),
    ],
)
@extend_schema(
    summary='Khôi phục cấu hình mặc định cho service SOC',
    description='Reset cấu hình service về baseline mặc định trong registry. Tự động tạo audit trail.',
    request=serializers.Serializer,
    responses={
        201: ServiceCurrentConfigSnapshotSerializer,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
    examples=[
        OpenApiExample(
            'Reset config request',
            value={'change_reason': 'Khôi phục cấu hình mặc định hệ thống'},
            request_only=True,
        ),
        OpenApiExample(
            'Reset config response',
            value={
                'id': 2,
                'service': 1,
                'service_key': 'vnbroker_quote',
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
                    'per_provider_config': {},
                },
                'applied_by': 'admin',
                'applied_at': '2026-06-20T10:05:00Z',
                'change_reason': 'Khôi phục cấu hình mặc định hệ thống',
                'is_current': True,
            },
            response_only=True,
        ),
    ],
)
class ServiceCurrentConfigView(SOCBaseView):
    """GET/POST current config snapshot for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        current_config = _get_current_config(service)
        if current_config is not None:
            return Response(ServiceConfigSerializer(current_config).data)

        return Response({
            'service_key': service.service_key,
            'service': service.id,
            'config_schema_version': '1.0',
            'config_payload': {},
            'applied_by': '',
            'applied_at': None,
            'change_reason': '',
            'is_current': False,
        })

    def post(self, request, service_key: str):
        """Apply new config or reset to default based on endpoint."""
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        # Check if this is a reset request (empty config_payload or explicit reset flag)
        config_payload = request.data.get('config_payload')
        change_reason = request.data.get('change_reason', '')
        is_reset = config_payload is None or config_payload == {}

        # Get the appropriate config class for this service's domain
        config_class = self._get_config_class_for_domain(service.domain)
        if config_class is None:
            return self.error_response(
                request,
                code='CONFIG_CLASS_NOT_FOUND',
                detail=f'Không tìm thấy config class cho domain "{service.domain}".',
                http_status=status.HTTP_400_BAD_REQUEST,
            )

        # Check ownership
        from ..ownership import build_ownership_matrix_from_db
        matrix = build_ownership_matrix_from_db()
        if not matrix.is_domain_writable(service.domain):
            block_reason = matrix.get_write_block_reason(service.domain)
            return self.error_response(
                request,
                code='OWNERSHIP_WRITE_DENIED',
                detail=block_reason or f'Domain \'{service.domain}\' không có quyền ghi.',
                http_status=status.HTTP_403_FORBIDDEN,
            )

        if is_reset:
            # Reset to default config
            default_config = config_class()
            config_dict = default_config.to_dict()
            change_reason = change_reason or 'Khôi phục cấu hình mặc định hệ thống'
        else:
            # Validate and use provided config
            try:
                config_obj = config_class.from_dict(config_payload)
            except Exception as e:
                return self.error_response(
                    request,
                    code='CONFIG_PARSE_FAILED',
                    detail=f'Không thể parse config payload: {str(e)}',
                    http_status=status.HTTP_400_BAD_REQUEST,
                )

            errors = config_obj.validate()
            if errors:
                return self.error_response(
                    request,
                    code='CONFIG_VALIDATION_FAILED',
                    detail='; '.join(errors),
                    http_status=status.HTTP_400_BAD_REQUEST,
                    field_errors={'payload': errors},
                )
            config_dict = config_obj.to_dict()

        # Save config transactionally
        from django.db import transaction
        from ..models import ServiceConfig, ConfigChangeAudit

        try:
            with transaction.atomic():
                previous_config = ServiceConfig.objects.filter(service=service, is_current=True).first()
                previous_payload = previous_config.config_payload if previous_config is not None else None

                svc_config = ServiceConfig.objects.create(
                    service=service,
                    config_schema_version='1.0',
                    config_payload=config_dict,
                    applied_by=getattr(request.user, 'username', 'api'),
                    change_reason=change_reason,
                )

                # Audit trail
                ConfigChangeAudit.objects.create(
                    service=service,
                    action='apply' if not is_reset else 'reset',
                    actor=getattr(request.user, 'username', 'api'),
                    actor_ip=request.META.get('REMOTE_ADDR', ''),
                    before_snapshot=previous_payload,
                    after_snapshot=config_dict,
                    change_summary=change_reason,
                    request_id=self.get_request_id(request),
                )
        except Exception as e:
            return self.error_response(
                request,
                code='CONFIG_SAVE_FAILED',
                detail=f'Lỗi lưu config: {str(e)}',
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(ServiceConfigSerializer(svc_config).data, status=status.HTTP_201_CREATED)

    def _get_config_class_for_domain(self, domain: str):
        """Map domain to its config class."""
        from ..domain_configs import (
            VnbrokerDomainConfig,
            PrefetchTimePolicyConfig,
            SignalServicesDomainConfig,
            ScreenerDomainConfig,
        )
        domain_config_map = {
            'vnbroker': VnbrokerDomainConfig,
            'prefetch': PrefetchTimePolicyConfig,
            'signals': SignalServicesDomainConfig,
            'screener': ScreenerDomainConfig,
            'matrix': None,  # Matrix uses dataops runtime config
            'platform': None,
            'dataops': None,
            'data_ingest': None,
        }
        return domain_config_map.get(domain)


@extend_schema(
    summary='Lấy health snapshot của service SOC',
    description='Trả về health snapshot hiện tại của service. Nếu chưa có bản ghi health thì trả trạng thái `unknown` theo contract chuẩn.',
    responses={
        200: ServiceHealthSnapshotSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ServiceHealthView(SOCBaseView):
    """GET health snapshot for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
        return Response(_serialize_health(service))


@extend_schema(
    summary='Lấy audit trail config của service SOC',
    description='Trả về audit trail paginated cho các lần preview/apply/rollback config của service.',
    parameters=STANDARD_PAGINATION_PARAMETERS,
    responses={
        200: PaginatedConfigChangeAuditResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ServiceAuditView(SOCBaseView):
    """GET paginated config audit trail for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        audits = ConfigChangeAudit.objects.filter(service=service).order_by('-timestamp')
        page = self.paginate_queryset(audits, request)
        if page is not None:
            return self.get_paginated_response(ConfigChangeAuditSerializer(page, many=True).data)
        return Response(ConfigChangeAuditSerializer(audits, many=True).data)


@extend_schema(
    summary='Lấy lịch sử config của service SOC',
    description='Trả về lịch sử config paginated của service theo thứ tự áp dụng mới nhất trước.',
    parameters=STANDARD_PAGINATION_PARAMETERS,
    responses={
        200: PaginatedServiceConfigResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ServiceConfigHistoryView(SOCBaseView):
    """GET paginated config history for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        configs = ServiceConfig.objects.filter(service=service).order_by('-applied_at')
        page = self.paginate_queryset(configs, request)
        if page is not None:
            return self.get_paginated_response(ServiceConfigSerializer(page, many=True).data)
        return Response(ServiceConfigSerializer(configs, many=True).data)


@extend_schema(
    summary='Lấy run logs của service SOC',
    description='Trả về run logs paginated của một service theo thứ tự chạy mới nhất trước.',
    parameters=STANDARD_PAGINATION_PARAMETERS,
    responses={
        200: PaginatedServiceRunLogResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ServiceRunLogsView(SOCBaseView):
    """GET paginated run logs for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        logs = ServiceRunLog.objects.filter(service=service).order_by('-started_at')
        page = self.paginate_queryset(logs, request)
        if page is not None:
            return self.get_paginated_response(ServiceRunLogSerializer(page, many=True).data)
        return Response(ServiceRunLogSerializer(logs, many=True).data)


@extend_schema(
    summary='Lấy ownership của service SOC',
    description='Trả về ownership payload để xác định writer, quyền apply và compatibility domains của service.',
    responses={
        200: ServiceOwnershipPayloadSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ServiceOwnershipView(SOCBaseView):
    """GET ownership payload for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
        return Response(_get_ownership_payload(service))


@extend_schema(
    summary='Lấy health status tổng hợp của SOC',
    description='Trả về số lượng service theo trạng thái sức khỏe cùng danh sách health records hiện có.',
    responses={
        200: HealthStatusResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class HealthStatusView(SOCBaseView):
    """GET global SOC health-status summary."""

    def get(self, request):
        health_records = ServiceHealth.objects.select_related('service').all()
        status_counts = {
            'healthy': 0,
            'degraded': 0,
            'unhealthy': 0,
            'unknown': 0,
            'maintenance': 0,
        }
        for record in health_records:
            status_counts[record.status] = status_counts.get(record.status, 0) + 1

        return Response({
            'total_services': ServiceDefinition.objects.count(),
            'active_services': ServiceDefinition.objects.filter(is_active=True).count(),
            'health_status_counts': status_counts,
            'services': ServiceHealthSerializer(health_records, many=True).data,
        })


@extend_schema(
    summary='Liệt kê run logs toàn SOC',
    description='Trả về run logs paginated toàn SOC, hỗ trợ filter theo `service_key` và `status`.',
    parameters=[
        *STANDARD_PAGINATION_PARAMETERS,
        OpenApiParameter(
            name='service_key',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Filter theo service key.',
            required=False,
        ),
        OpenApiParameter(
            name='status',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Filter theo trạng thái run log như queued, success, failed.',
            required=False,
        ),
    ],
    responses={
        200: PaginatedServiceRunLogResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class RunLogListView(SOCBaseView):
    """GET paginated recent run logs across SOC."""

    def get(self, request):
        queryset = ServiceRunLog.objects.select_related('service').order_by('-started_at')
        service_key = str(request.query_params.get('service_key', '') or '').strip()
        run_status = str(request.query_params.get('status', '') or '').strip()
        if service_key:
            queryset = queryset.filter(service__service_key=service_key)
        if run_status:
            queryset = queryset.filter(status=run_status)

        page = self.paginate_queryset(queryset, request)
        if page is not None:
            return self.get_paginated_response(ServiceRunLogSerializer(page, many=True).data)
        return Response(ServiceRunLogSerializer(queryset, many=True).data)


@extend_schema(
    summary='Liệt kê config audit toàn SOC',
    description='Trả về audit trail paginated toàn SOC, hỗ trợ filter theo `service_key` và `action`.',
    parameters=[
        *STANDARD_PAGINATION_PARAMETERS,
        OpenApiParameter(
            name='service_key',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Filter theo service key.',
            required=False,
        ),
        OpenApiParameter(
            name='action',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Filter theo action audit như apply, preview, rollback.',
            required=False,
        ),
    ],
    responses={
        200: PaginatedConfigChangeAuditResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class ChangeAuditListView(SOCBaseView):
    """GET paginated config change audit trail across SOC."""

    def get(self, request):
        queryset = ConfigChangeAudit.objects.select_related('service').order_by('-timestamp')
        service_key = str(request.query_params.get('service_key', '') or '').strip()
        action = str(request.query_params.get('action', '') or '').strip()
        if service_key:
            queryset = queryset.filter(service__service_key=service_key)
        if action:
            queryset = queryset.filter(action=action)

        page = self.paginate_queryset(queryset, request)
        if page is not None:
            return self.get_paginated_response(ConfigChangeAuditSerializer(page, many=True).data)
        return Response(ConfigChangeAuditSerializer(queryset, many=True).data)


class SloRowSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    name = serializers.CharField()
    domain = serializers.CharField()
    status = serializers.CharField()
    is_active = serializers.BooleanField()
    slo_target = serializers.FloatField()
    uptime_30d = serializers.FloatField(allow_null=True)
    burn_rate_1h = serializers.FloatField(allow_null=True)
    error_budget_remaining = serializers.FloatField(allow_null=True)
    last_check_at = serializers.DateTimeField(allow_null=True)
    recent_checks_24h = serializers.ListField(
        child=serializers.DictField(),
        required=False,
    )


class SloOverviewResponseSerializer(serializers.Serializer):
    services = SloRowSerializer(many=True)
    total = serializers.IntegerField()
    generated_at = serializers.DateTimeField()


class ConfigAuditExportRowSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    action = serializers.CharField()
    actor = serializers.CharField()
    actor_ip = serializers.CharField(allow_null=True)
    change_summary = serializers.CharField()
    timestamp = serializers.DateTimeField()
    request_id = serializers.CharField()


class RunLogExportRowSerializer(serializers.Serializer):
    service_key = serializers.CharField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True)
    finished_at = serializers.DateTimeField(allow_null=True)
    duration_seconds = serializers.FloatField(allow_null=True)
    input_summary = serializers.JSONField()
    output_summary = serializers.JSONField()
    error_detail = serializers.CharField()


@extend_schema(
    summary='Lấy tổng quan SLO/SLI của SOC',
    description='Trả về uptime 30 ngày, burn rate 1 giờ và error budget còn lại cho từng service.',
    responses={
        200: SloOverviewResponseSerializer,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SloOverviewView(SOCBaseView):
    """GET SOC SLO/SLI overview across all services."""

    def get(self, request):
        services = ServiceDefinition.objects.order_by('service_key')
        hour_cutoff = timezone.now() - timedelta(hours=24)
        rows = []
        for service in services:
            health = ServiceHealth.objects.filter(service=service).first()
            recent_buckets = (
                ServiceHealthCheckLog.objects
                .filter(service=service, checked_at__gte=hour_cutoff)
                .exclude(status__in=['maintenance', 'unknown'])
                .annotate(bucket=TruncHour('checked_at'))
                .values('bucket')
                .annotate(
                    checks=Count('id'),
                    failed=Count('id', filter=Q(status__in=['unhealthy', 'degraded'])),
                )
                .order_by('bucket')
            )
            rows.append({
                'service_key': service.service_key,
                'name': service.name,
                'domain': service.domain,
                'status': health.status if health else 'unknown',
                'is_active': service.is_active,
                'slo_target': health.slo_target if health else 0.999,
                'uptime_30d': health.uptime_30d if health else None,
                'burn_rate_1h': health.burn_rate_1h if health else None,
                'error_budget_remaining': health.error_budget_remaining if health else None,
                'last_check_at': health.last_check_at if health else None,
                'recent_checks_24h': [
                    {'hour': bucket['bucket'].isoformat(), 'checks': bucket['checks'], 'failed': bucket['failed']}
                    for bucket in recent_buckets
                ],
            })
        return Response({
            'services': rows,
            'total': len(rows),
            'generated_at': timezone.now(),
        })


@extend_schema(
    summary='Xuất danh sách config audit ra CSV',
    description='Trả về tối đa 500 dòng ConfigChangeAudit mới nhất, hỗ trợ filter theo `service_key` (domain).',
    parameters=[
        OpenApiParameter(
            name='service_key',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Filter theo service key / domain.',
            required=False,
        ),
        OpenApiParameter(
            name='limit',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Số dòng tối đa (mặc định 500).',
            required=False,
        ),
    ],
    responses={
        200: ConfigAuditExportRowSerializer(many=True),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SocExportConfigAuditsView(SOCBaseView):
    """GET last N ConfigChangeAudit rows for CSV export."""

    def get(self, request):
        limit = min(int(request.query_params.get('limit', 500) or 500), 5000)
        service_key = str(request.query_params.get('service_key', '') or '').strip()
        queryset = ConfigChangeAudit.objects.select_related('service').order_by('-timestamp')
        if service_key:
            queryset = queryset.filter(service__service_key=service_key)
        rows = queryset[:limit]
        payload = [
            {
                'service_key': row.service.service_key,
                'action': row.action,
                'actor': row.actor,
                'actor_ip': str(row.actor_ip) if row.actor_ip else None,
                'change_summary': row.change_summary,
                'timestamp': row.timestamp,
                'request_id': row.request_id,
            }
            for row in rows
        ]
        return Response(payload)


@extend_schema(
    summary='Xuất danh sách run logs ra CSV',
    description='Trả về tối đa 500 dòng ServiceRunLog mới nhất, hỗ trợ filter theo `service_key` (domain).',
    parameters=[
        OpenApiParameter(
            name='service_key',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            description='Filter theo service key / domain.',
            required=False,
        ),
        OpenApiParameter(
            name='limit',
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            description='Số dòng tối đa (mặc định 500).',
            required=False,
        ),
    ],
    responses={
        200: RunLogExportRowSerializer(many=True),
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class SocExportRunLogsView(SOCBaseView):
    """GET last N ServiceRunLog rows for CSV export."""

    def get(self, request):
        limit = min(int(request.query_params.get('limit', 500) or 500), 5000)
        service_key = str(request.query_params.get('service_key', '') or '').strip()
        queryset = ServiceRunLog.objects.select_related('service').order_by('-started_at')
        if service_key:
            queryset = queryset.filter(service__service_key=service_key)
        rows = queryset[:limit]
        payload = [
            {
                'service_key': row.service.service_key,
                'status': row.status,
                'started_at': row.started_at,
                'finished_at': row.finished_at,
                'duration_seconds': row.duration_seconds,
                'input_summary': row.input_summary,
                'output_summary': row.output_summary,
                'error_detail': row.error_detail,
            }
            for row in rows
        ]
        return Response(payload)
