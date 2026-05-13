"""
data_ingest REST API views for admin data operations.

Endpoints:
- POST /core/v1/data-ingest/trigger/daily-prices/  : Manually trigger daily price ingestion
- GET  /core/v1/data-ingest/jobs/                 : List all ingest jobs
- GET  /core/v1/data-ingest/jobs/<id>/            : Get job details + last run
- GET  /core/v1/data-ingest/runs/                 : List recent ingest runs (paginated)
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from .models import IngestJob, IngestRun
from .serializers import (
    IngestJobSerializer,
    IngestRunSerializer,
    TriggerIngestRequestSerializer,
    IngestTriggerResponseSerializer,
)
from .tasks import ingest_daily_prices

logger = logging.getLogger(__name__)


class IngestAdminThrottle(UserRateThrottle):
    """Rate limit for admin ingest triggers: 10 per hour."""
    scope = 'ingest_admin_trigger'
    rate = '10/hour'


class IngestJobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for ingest jobs.
    Only admin users can view job configurations.
    """
    queryset = IngestJob.objects.all()
    serializer_class = IngestJobSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['source', 'status']
    ordering = ['name']


class IngestRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for ingest runs (execution history).
    Provides pagination and filtering for audit/monitoring.
    """
    queryset = IngestRun.objects.select_related('job').order_by('-started_at')
    serializer_class = IngestRunSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['job', 'state']
    ordering = ['-started_at']
    pagination_class = None  # Use global default (StandardPageNumberPagination)

    def get_queryset(self):
        # Limit to last 100 runs for performance
        return super().get_queryset()[:100]


class DataIngestAdminViewSet(viewsets.ViewSet):
    """
    Admin endpoints for manually triggering data ingest tasks.
    All operations require IsAdminUser permission + rate limiting.
    
    P3-T02: Core-worker topology with admin trigger endpoints.
    """
    permission_classes = [IsAdminUser]
    throttle_classes = [IngestAdminThrottle]

    @action(
        detail=False,
        methods=['post'],
        url_path='trigger/daily-prices',
        url_name='trigger_daily_prices',
    )
    def trigger_daily_prices(self, request):
        """
        POST /core/v1/data-ingest/trigger/daily-prices/
        
        Manually trigger daily price ingestion task.
        
        Request body:
        {
            "days": 1,
            "symbols": ["VNM", "BCM"]  (optional, defaults to all active)
        }
        
        Returns:
        {
            "task_id": "abc123...",
            "job_id": null,
            "status": "queued",
            "started_at": "2025-01-01T17:00:00Z",
            "message": "Daily price ingest queued successfully"
        }
        """
        serializer = TriggerIngestRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        days = serializer.validated_data.get('days', 1)
        symbols = serializer.validated_data.get('symbols')

        try:
            # Queue the ingest task asynchronously
            task = ingest_daily_prices.apply_async(
                args=[days, symbols],
                countdown=0,  # Execute immediately
            )

            logger.info(
                f'Daily price ingest triggered by {request.user.username}: '
                f'days={days}, symbols={symbols}, task_id={task.id}'
            )

            response_serializer = IngestTriggerResponseSerializer(
                {
                    'task_id': task.id,
                    'job_id': None,
                    'status': 'queued',
                    'started_at': __import__('django.utils.timezone', fromlist=['now']).now(),
                    'message': f'Daily price ingest queued with task ID {task.id}',
                }
            )
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as exc:
            logger.error(f'Failed to queue daily price ingest: {exc}', exc_info=True)
            return Response(
                {
                    'detail': 'Failed to queue ingest task',
                    'error': str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=False,
        methods=['post'],
        url_path='trigger/price-board',
        url_name='trigger_price_board',
    )
    def trigger_price_board(self, request):
        """
        POST /core/v1/data-ingest/trigger/price-board/
        
        Manually trigger price board (SymbolSnapshot) refresh.
        (No body parameters needed)
        
        Returns:
        {
            "task_id": "xyz789...",
            "job_id": null,
            "status": "queued",
            "started_at": "2025-01-01T17:00:00Z",
            "message": "Price board refresh queued successfully"
        }
        """
        from .tasks import fetch_and_upsert_price_board

        try:
            task = fetch_and_upsert_price_board.apply_async(countdown=0)

            logger.info(
                f'Price board refresh triggered by {request.user.username}, task_id={task.id}'
            )

            response_serializer = IngestTriggerResponseSerializer(
                {
                    'task_id': task.id,
                    'job_id': None,
                    'status': 'queued',
                    'started_at': __import__('django.utils.timezone', fromlist=['now']).now(),
                    'message': f'Price board refresh queued with task ID {task.id}',
                }
            )
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as exc:
            logger.error(f'Failed to queue price board refresh: {exc}', exc_info=True)
            return Response(
                {
                    'detail': 'Failed to queue refresh task',
                    'error': str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=False,
        methods=['get'],
        url_path='task-status/<str:task_id>',
        url_name='task_status',
    )
    def task_status(self, request, task_id=None):
        """
        GET /core/v1/data-ingest/task-status/{task_id}/
        
        Check the status of a queued/running ingest task.
        """
        from celery.result import AsyncResult

        try:
            task_result = AsyncResult(task_id)

            return Response(
                {
                    'task_id': task_id,
                    'status': task_result.status,
                    'result': task_result.result if task_result.status == 'SUCCESS' else None,
                    'error': str(task_result.info) if task_result.status == 'FAILURE' else None,
                }
            )

        except Exception as exc:
            logger.error(f'Failed to get task status for {task_id}: {exc}')
            return Response(
                {
                    'detail': 'Failed to retrieve task status',
                    'error': str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
