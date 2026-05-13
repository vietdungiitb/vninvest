"""
SOC Overview Views — 6 endpoint tổng quát về toàn bộ SOC.

  GET /api/soc/overview/ — List tất cả services
  GET /api/soc/overview/{service_key}/ — Detail một service + config + health
  GET /api/soc/overview/{service_key}/config-history/ — Lịch sử config
  GET /api/soc/overview/{service_key}/run-logs/ — Lịch sử run
  GET /api/soc/overview/{service_key}/ownership/ — Ownership record
  GET /api/soc/overview/health-status/ — Health summary toàn hệ
"""
from rest_framework.response import Response
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework import status

from ..models import (
    ServiceDefinition,
    ServiceConfig,
    ServiceHealth,
    ServiceRunLog,
    OwnershipRecord,
)
from ..serializers import (
    ServiceDefinitionSerializer,
    ServiceConfigSerializer,
    ServiceHealthSerializer,
    ServiceRunLogSerializer,
    OwnershipRecordSerializer,
)
from .base import SOCBaseView


class ServiceListView(ListAPIView):
    """GET /api/soc/overview/ — list services + pagination."""
    queryset = ServiceDefinition.objects.filter(is_active=True)
    serializer_class = ServiceDefinitionSerializer


class ServiceDetailView(RetrieveAPIView):
    """GET /api/soc/overview/{service_key}/ — detail 1 service."""
    queryset = ServiceDefinition.objects.all()
    serializer_class = ServiceDefinitionSerializer
    lookup_field = 'service_key'


class ServiceConfigHistoryView(SOCBaseView):
    """
    GET /api/soc/overview/{service_key}/config-history/
    Lịch sử config + pagination.
    """

    def get(self, request, service_key):
        try:
            service = ServiceDefinition.objects.get(service_key=service_key)
        except ServiceDefinition.DoesNotExist:
            return self.error_response(
                request,
                code='SERVICE_NOT_FOUND',
                detail=f"Service '{service_key}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        configs = ServiceConfig.objects.filter(service=service).order_by('-applied_at')
        page = self.paginate_queryset(configs, request)
        if page is not None:
            serializer = ServiceConfigSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ServiceConfigSerializer(configs, many=True)
        return Response({
            'count': len(configs),
            'results': serializer.data,
        })


class ServiceRunLogsView(SOCBaseView):
    """
    GET /api/soc/overview/{service_key}/run-logs/
    Lịch sử run + pagination.
    """

    def get(self, request, service_key):
        try:
            service = ServiceDefinition.objects.get(service_key=service_key)
        except ServiceDefinition.DoesNotExist:
            return self.error_response(
                request,
                code='SERVICE_NOT_FOUND',
                detail=f"Service '{service_key}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        logs = ServiceRunLog.objects.filter(service=service).order_by('-started_at')
        page = self.paginate_queryset(logs, request)
        if page is not None:
            serializer = ServiceRunLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ServiceRunLogSerializer(logs, many=True)
        return Response({
            'count': len(logs),
            'results': serializer.data,
        })


class ServiceOwnershipView(SOCBaseView):
    """
    GET /api/soc/overview/{service_key}/ownership/
    Khai báo ownership + write permission.
    """

    def get(self, request, service_key):
        try:
            service = ServiceDefinition.objects.get(service_key=service_key)
        except ServiceDefinition.DoesNotExist:
            return self.error_response(
                request,
                code='SERVICE_NOT_FOUND',
                detail=f"Service '{service_key}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        try:
            ownership = OwnershipRecord.objects.get(domain=service.domain)
        except OwnershipRecord.DoesNotExist:
            # Return default từ ServiceOwnershipMatrix
            from ..ownership import get_ownership_matrix
            matrix = get_ownership_matrix()
            record_dict = matrix.to_response_dict(service.domain)
            return Response(record_dict)

        serializer = OwnershipRecordSerializer(ownership)
        return Response(serializer.data)


class HealthStatusView(SOCBaseView):
    """GET /api/soc/overview/health-status/ — health summary toàn hệ."""

    def get(self, request):
        health_records = ServiceHealth.objects.all()
        status_counts = {}
        for h in health_records:
            status_counts[h.status] = status_counts.get(h.status, 0) + 1

        data = {
            'total_services': ServiceDefinition.objects.count(),
            'active_services': ServiceDefinition.objects.filter(is_active=True).count(),
            'health_status_counts': status_counts,
            'services': ServiceHealthSerializer(health_records, many=True).data,
        }
        return Response(data)

from rest_framework import status

from ..models import (
    ServiceDefinition,
    ServiceHealth,
    ServiceRunLog,
    ConfigChangeAudit,
    OwnershipRecord,
)
from ..serializers import (
    ServiceDefinitionSerializer,
    ServiceHealthSerializer,
    ServiceRunLogSerializer,
    ConfigChangeAuditSerializer,
    OwnershipRecordSerializer,
)
from ..ownership import get_ownership_matrix
from .base import SOCBaseView


class SOCOverviewView(SOCBaseView):
    """
    GET /api/soc/overview/
    Tổng quan trạng thái tất cả services.
    """

    def get(self, request):
        services = ServiceDefinition.objects.filter(is_active=True).select_related('health')
        total = services.count()

        # Health summary
        health_counts = {'healthy': 0, 'degraded': 0, 'unhealthy': 0, 'unknown': 0, 'maintenance': 0}
        for svc in services:
            h = getattr(svc, 'health', None)
            s = h.status if h else 'unknown'
            health_counts[s] = health_counts.get(s, 0) + 1

        # Domain breakdown
        domain_counts = list(
            services.values('domain').annotate(count=Count('id')).order_by('domain')
        )

        # Latest run logs
        recent_runs = ServiceRunLog.objects.order_by('-started_at')[:5]

        return Response({
            'total_services': total,
            'health_summary': health_counts,
            'domain_breakdown': domain_counts,
            'recent_runs': ServiceRunLogSerializer(recent_runs, many=True).data,
        })


class SOCServiceListView(SOCBaseView):
    """
    GET /api/soc/services/
    Danh sách tất cả service definitions (có phân trang).
    """

    def get(self, request):
        domain = request.query_params.get('domain', '')
        active_only = request.query_params.get('active', 'true').lower() in ('1', 'true', 'yes')

        qs = ServiceDefinition.objects.all().order_by('domain', 'service_key')
        if domain:
            qs = qs.filter(domain=domain)
        if active_only:
            qs = qs.filter(is_active=True)

        page = self.paginate_queryset(qs, request)
        if page is not None:
            return self.get_paginated_response(
                ServiceDefinitionSerializer(page, many=True).data
            )
        return Response(ServiceDefinitionSerializer(qs, many=True).data)


class SOCServiceDetailView(SOCBaseView):
    """
    GET /api/soc/services/<service_key>/
    Chi tiết một service.
    """

    def get(self, request, service_key: str):
        try:
            svc = ServiceDefinition.objects.get(service_key=service_key)
        except ServiceDefinition.DoesNotExist:
            return self.error_response(
                request,
                code='service_not_found',
                detail=f"Service '{service_key}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ServiceDefinitionSerializer(svc).data)


class SOCHealthSummaryView(SOCBaseView):
    """
    GET /api/soc/health/
    Health của tất cả service.
    """

    def get(self, request):
        healths = ServiceHealth.objects.select_related('service').order_by('status')
        return Response(ServiceHealthSerializer(healths, many=True).data)


class SOCRecentRunsView(SOCBaseView):
    """
    GET /api/soc/runs/
    Recent run logs (có phân trang).
    """

    def get(self, request):
        service_key = request.query_params.get('service', '')
        run_status = request.query_params.get('status', '')

        qs = ServiceRunLog.objects.select_related('service').order_by('-started_at')
        if service_key:
            qs = qs.filter(service__service_key=service_key)
        if run_status:
            qs = qs.filter(status=run_status)

        page = self.paginate_queryset(qs, request)
        if page is not None:
            return self.get_paginated_response(
                ServiceRunLogSerializer(page, many=True).data
            )
        return Response(ServiceRunLogSerializer(qs, many=True).data)


class SOCOwnershipMatrixView(SOCBaseView):
    """
    GET /api/soc/ownership/
    Ownership matrix cho tất cả domains.
    """

    def get(self, request):
        matrix = get_ownership_matrix()
        domains = matrix.all_domains()
        return Response({
            'domains': [matrix.to_response_dict(d) for d in domains],
            'writable_domains': [d for d in domains if matrix.is_domain_writable(d)],
        })
