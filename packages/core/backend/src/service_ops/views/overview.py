"""SOC overview endpoints aligned with the documented summary and service contracts."""

from drf_spectacular.openapi import OpenApiParameter, OpenApiTypes
from drf_spectacular.utils import OpenApiExample, extend_schema
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response

from ..models import (
    ConfigChangeAudit,
    OwnershipRecord,
    ServiceConfig,
    ServiceDefinition,
    ServiceHealth,
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
    description='Trả về snapshot tổng hợp theo domain cho toàn bộ service đang active trong Service Operations Center.',
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
        services = list(ServiceDefinition.objects.filter(is_active=True).order_by('domain', 'service_key'))
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
    description='Trả về danh sách paginated các service active đang được quản lý trong SOC.',
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
        queryset = ServiceDefinition.objects.filter(is_active=True).order_by('domain', 'service_key')
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
class ServiceDetailView(SOCBaseView):
    """GET detail for one SOC service."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
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
class ServiceCurrentConfigView(SOCBaseView):
    """GET current config snapshot for one SOC service."""

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
