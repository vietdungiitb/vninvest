"""
Scheduled Reports CRUD views for partner namespace.
"""
import logging

from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from identity_access.envelope import envelope
from identity_access.models import CoreTenant, ReportDeliveryLog, ScheduledReport
from identity_access.permissions import (
    IsTenantActive,
    require_pat_scopes_or_human_session,
)
from identity_access.schema import (
    ReportTestQueuedSerializer,
    ScheduledReportDetailSerializer,
)
from identity_access.serializers import (
    ReportDeliveryLogSerializer,
    ScheduledReportSerializer,
)
from identity_access.utils.resolve_tenant import (
    require_tenant_permission as _require_tenant_permission,
)
from vninvest_core.api_envelope import envelope_response

logger = logging.getLogger(__name__)

TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]


def _get_tenant(user):
    return CoreTenant.objects.get(owner_user=user)


@extend_schema(
    summary='ScheduledReportListCreateView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScheduledReportListCreateView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/reports/ — list
    POST /api/core/v1/partner/reports/ — create
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(ScheduledReportSerializer, many=True)},
    )
    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:read')
        tenant = _get_tenant(request.user)
        qs = ScheduledReport.objects.filter(tenant=tenant).order_by('-created_at')
        return envelope(ScheduledReportSerializer(qs, many=True).data)

    @extend_schema(
        responses={201: envelope_response(ScheduledReportSerializer)},
    )
    def post(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:write')
        tenant = _get_tenant(request.user)
        serializer = ScheduledReportSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(tenant=tenant)
        return envelope(serializer.data, status=status.HTTP_201_CREATED)


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

    @extend_schema(
        responses={200: envelope_response(ScheduledReportDetailSerializer)},
    )
    @extend_schema(
        summary='ScheduledReportDetailView GET',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        responses={
            200: envelope_response(),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request, report_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:read')
        report = self._get_report(request, report_id)
        if report is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        data = ScheduledReportSerializer(report).data
        logs = ReportDeliveryLog.objects.filter(report=report)[:50]
        data['delivery_logs'] = ReportDeliveryLogSerializer(logs, many=True).data
        return envelope(data)

    @extend_schema(
        responses={200: envelope_response(ScheduledReportSerializer)},
    )
    @extend_schema(
        summary='ScheduledReportDetailView PATCH',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        # Body-carrying method: the REQUEST side must be typed too;
        # responses= alone still yields the unguessable-serializer error.
        request=OpenApiTypes.OBJECT,
        responses={
            200: envelope_response(),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
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
        return envelope(serializer.data)

    @extend_schema(
        responses={204: None},
    )
    @extend_schema(
        summary='ScheduledReportDetailView DELETE',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        responses={
            204: None,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def delete(self, request, report_id, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:write')
        report = self._get_report(request, report_id)
        if report is None:
            return Response({'detail': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary='ScheduledReportTestView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ScheduledReportTestView(generics.GenericAPIView):
    """
    POST /api/core/v1/partner/reports/<id>/test/ — send test email immediately
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(ReportTestQueuedSerializer)},
    )
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
        return envelope({'status': 'queued', 'report_id': report_id})


class ReportDeliveryLogView(generics.GenericAPIView):
    """
    GET /api/core/v1/partner/reports/delivery-log/ — recent delivery log (last 50)
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    @extend_schema(
        responses={200: envelope_response(ReportDeliveryLogSerializer, many=True)},
    )
    def get(self, request, *args, **kwargs):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'report:read')
        tenant = _get_tenant(request.user)
        logs = ReportDeliveryLog.objects.filter(
            report__tenant=tenant
        ).select_related('report')[:50]
        return envelope(ReportDeliveryLogSerializer(logs, many=True).data)
