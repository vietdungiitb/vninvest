"""COC DataOps — CafeF OHLC đối chiếu (preview/dry-run/apply/abort/status).

Chỉ ghi bảng `CafefDailyPrice`; KHÔNG đụng `DailyPrice`.
"""
import uuid

from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.utils import timezone

from market_data.cafef.importer import preview_import
from market_data.models import CafefDailyPrice

from ..envelope import envelope
from ..models import BackfillExecutionRun, ServiceDefinition, ServiceRunLog
from .dataops_base import *
from .dataops_base import (
    SOC_DOMAIN_PRIMARY_SERVICE_KEYS,
    _build_market_data_ownership_payload,
    _build_market_data_write_denied_response,
)


class CafefImportRequestSerializer(serializers.Serializer):
    exchange = serializers.ChoiceField(choices=['HOSE', 'HNX', 'UPCOM'])
    year = serializers.IntegerField(min_value=2010, max_value=2030)
    dry_run = serializers.BooleanField(default=False, required=False)


def _validated(request):
    serializer = CafefImportRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


class CafefPreviewView(SOCBaseView):
    @extend_schema(
        summary='Preview CafeF OHLC import',
        request=CafefImportRequestSerializer,
        responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        data = _validated(request)
        return envelope({
            **preview_import(data['exchange'], data['year']),
            'ownership': _build_market_data_ownership_payload(),
        })


class CafefRunView(SOCBaseView):
    @extend_schema(
        summary='Chạy CafeF OHLC import (dry-run hoặc apply)',
        request=CafefImportRequestSerializer,
        responses={201: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        ownership = _build_market_data_ownership_payload()
        if not ownership.get('can_apply', False):
            return _build_market_data_write_denied_response(self, request)
        data = _validated(request)
        run_id = f"cafef-{uuid.uuid4().hex[:16]}"
        service_key = SOC_DOMAIN_PRIMARY_SERVICE_KEYS['dataops']
        service = ServiceDefinition.objects.filter(service_key=service_key).first()

        run_log = ServiceRunLog.objects.create(
            service=service,
            status='queued',
            trigger='soc.dataops.cafef.run',
            input_summary={
                'run_id': run_id,
                'exchange': data['exchange'],
                'year': data['year'],
                'dry_run': data['dry_run'],
                'write_surface': 'soc_dataops',
                'requested_by': getattr(request.user, 'username', 'api'),
            },
        )
        run = BackfillExecutionRun.objects.create(
            run_id=run_id,
            job_key='cafef_ohlc_import',
            mode='deep_bootstrap',
            trigger='operator_run_now',
            status='queued',
            service_run_log=run_log,
            summary=dict(run_log.input_summary),
        )

        from ..tasks import import_cafef_ohlc_task

        task = import_cafef_ohlc_task.delay(
            run_id, data['exchange'], data['year'], data['dry_run'],
        )
        run_log.celery_task_id = task.id
        run_log.save(update_fields=['celery_task_id'])

        return envelope({
            'queued': True,
            'run_id': run_id,
            'service_run_log_id': run_log.pk,
            'status': 'queued',
            'ownership': ownership,
        }, status=201)


class CafefAbortView(SOCBaseView):
    @extend_schema(
        summary='Hủy CafeF import run',
        request=None,
        responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
    )
    def post(self, request, run_id):
        run = BackfillExecutionRun.objects.filter(run_id=run_id).first()
        if run is None:
            return self.error_response(request, code='CAFEF_RUN_NOT_FOUND',
                                       detail=f'run {run_id} not found', http_status=404)
        if run.status in ('queued', 'running'):
            run.status = 'aborted'
            run.finished_at = timezone.now()
            run.save(update_fields=['status', 'finished_at'])
        run_log = run.service_run_log
        if run_log and run_log.celery_task_id and run_log.status in ('queued', 'running'):
            from celery import current_app

            current_app.control.revoke(run_log.celery_task_id, terminate=True, signal='SIGTERM')
            run_log.status = 'skipped'
            run_log.finished_at = timezone.now()
            run_log.save(update_fields=['status', 'finished_at'])
        return envelope({'run_id': run_id, 'status': run.status})


class CafefStatusView(SOCBaseView):
    @extend_schema(summary='Trạng thái CafeF import run', responses={200: OpenApiTypes.OBJECT})
    def get(self, request, run_id):
        run = BackfillExecutionRun.objects.filter(run_id=run_id).first()
        if run is None:
            return self.error_response(request, code='CAFEF_RUN_NOT_FOUND',
                                       detail=f'run {run_id} not found', http_status=404)
        imported = CafefDailyPrice.objects.filter(source='cafef').count()
        return envelope({
            'run_id': run.run_id,
            'status': run.status,
            'inserted': run.inserted_rows,
            'updated': run.updated_rows,
            'summary': run.summary,
            'error_summary': run.error_summary,
            'imported_rows_total': imported,
        })
