"""SOC overview endpoints aligned with the documented summary and service contracts."""

from django.utils import timezone
from rest_framework import status
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


class OverviewSummaryView(SOCBaseView):
    """GET /api/soc/overview/ — health summary grouped by domain."""

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


class ServiceListView(SOCBaseView):
    """GET /api/soc/services/ — list services + pagination."""

    def get(self, request):
        queryset = ServiceDefinition.objects.filter(is_active=True).order_by('domain', 'service_key')
        page = self.paginate_queryset(queryset, request)
        if page is not None:
            return self.get_paginated_response(ServiceDefinitionSerializer(page, many=True).data)
        return Response(ServiceDefinitionSerializer(queryset, many=True).data)


class ServiceDetailView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/ — detail 1 service + config + health + ownership."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
        return Response(_serialize_service_detail(service))


class ServiceHealthCheckTriggerView(SOCBaseView):
    """POST /api/soc/services/{service_key}/health-check/ — enqueue a manual health probe."""

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


class ServiceCurrentConfigView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/config/ — current config snapshot."""

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


class ServiceHealthView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/health/ — service health snapshot."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
        return Response(_serialize_health(service))


class ServiceAuditView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/audit/ — config audit trail."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        audits = ConfigChangeAudit.objects.filter(service=service).order_by('-timestamp')
        page = self.paginate_queryset(audits, request)
        if page is not None:
            return self.get_paginated_response(ConfigChangeAuditSerializer(page, many=True).data)
        return Response(ConfigChangeAuditSerializer(audits, many=True).data)


class ServiceConfigHistoryView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/history/ — config history + pagination."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        configs = ServiceConfig.objects.filter(service=service).order_by('-applied_at')
        page = self.paginate_queryset(configs, request)
        if page is not None:
            return self.get_paginated_response(ServiceConfigSerializer(page, many=True).data)
        return Response(ServiceConfigSerializer(configs, many=True).data)


class ServiceRunLogsView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/run-logs/ — recent runs + pagination."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error

        logs = ServiceRunLog.objects.filter(service=service).order_by('-started_at')
        page = self.paginate_queryset(logs, request)
        if page is not None:
            return self.get_paginated_response(ServiceRunLogSerializer(page, many=True).data)
        return Response(ServiceRunLogSerializer(logs, many=True).data)


class ServiceOwnershipView(SOCBaseView):
    """GET /api/soc/overview/{service_key}/ownership/ — ownership record."""

    def get(self, request, service_key: str):
        service, error = _get_service_or_error(self, request, service_key)
        if error is not None:
            return error
        return Response(_get_ownership_payload(service))


class HealthStatusView(SOCBaseView):
    """GET /api/soc/overview/health-status/ — health summary toàn hệ."""

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


class RunLogListView(SOCBaseView):
    """GET /api/soc/run-logs/ — paginated recent run logs."""

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


class ChangeAuditListView(SOCBaseView):
    """GET /api/soc/change-audit/ — paginated config change audit trail."""

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
