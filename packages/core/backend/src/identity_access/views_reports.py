"""
Scheduled Reports CRUD views for partner namespace.
"""
import logging

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from identity_access.models import CoreTenant, ScheduledReport, ReportDeliveryLog
from identity_access.permissions import IsTenantActive, require_pat_scopes_or_human_session
from identity_access.serializers import ScheduledReportSerializer, ReportDeliveryLogSerializer
from identity_access.utils.resolve_tenant import require_tenant_permission as _require_tenant_permission

logger = logging.getLogger(__name__)

TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]


def _get_tenant(user):
    return CoreTenant.objects.get(owner_user=user)


class ScheduledReportListCreateView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/reports/ — list
    POST /api/core/v1/partner/reports/ — create
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:read')
        tenant = _get_tenant(request.user)
        qs = ScheduledReport.objects.filter(tenant=tenant).order_by('-created_at')
        return Response(ScheduledReportSerializer(qs, many=True).data)

    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:write')
        tenant = _get_tenant(request.user)
        serializer = ScheduledReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(tenant=tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ScheduledReportDetailView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/reports/<id>/
    PATCH /api/core/v1/partner/reports/<id>/
    DELETE /api/core/v1/partner/reports/<id>/
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def _get_report(self, request, report_id):
        tenant = _get_tenant(request.user)
        try:
            return ScheduledReport.objects.get(id=report_id, tenant=tenant)
        except ScheduledReport.DoesNotExist:
            return None

    def get(self, request, report_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:read')
        report = self._get_report(request, report_id)
        if report is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        data = ScheduledReportSerializer(report).data
        logs = ReportDeliveryLog.objects.filter(report=report)[:50]
        data['delivery_logs'] = ReportDeliveryLogSerializer(logs, many=True).data
        return Response(data)

    def patch(self, request, report_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:write')
        report = self._get_report(request, report_id)
        if report is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ScheduledReportSerializer(report, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, report_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:write')
        report = self._get_report(request, report_id)
        if report is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ScheduledReportTestView(generics.GenericAPIView):
    """
    POST /api/core/v1/partner/reports/<id>/test/ — send test email immediately
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def post(self, request, report_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:write')
        tenant = _get_tenant(request.user)
        try:
            report = ScheduledReport.objects.get(id=report_id, tenant=tenant)
        except ScheduledReport.DoesNotExist:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        from identity_access.tasks import generate_and_deliver_report
        generate_and_deliver_report.delay(report.id, is_test=True)
        return Response({'status': 'queued', 'report_id': report_id})


class ReportDeliveryLogView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/reports/delivery-log/ — recent delivery log (last 50)
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:read')
        tenant = _get_tenant(request.user)
        logs = ReportDeliveryLog.objects.filter(
            report__tenant=tenant
        ).select_related('report')[:50]
        return Response(ReportDeliveryLogSerializer(logs, many=True).data)
