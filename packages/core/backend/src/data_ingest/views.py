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
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from vninvest_core.pagination import StandardPageNumberPagination
from .models import IngestJob, IngestRun
from .serializers import (
    IngestJobSerializer,
    IngestRunSerializer,
    TriggerIngestRequestSerializer,
    IngestTriggerResponseSerializer,
)
from .tasks import ingest_daily_prices, _USER_BACKFILL_MAX_DAYS
from service_ops.models import ServiceRunLog
from service_ops.registry import ensure_service_registry, get_registered_service

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
    queryset = IngestJob.objects.all().order_by('name')
    serializer_class = IngestJobSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPageNumberPagination
    filterset_fields = ['source', 'status']


class IngestRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for ingest runs (execution history).
    Provides pagination and filtering for audit/monitoring.
    """
    serializer_class = IngestRunSerializer
    permission_classes = [IsAdminUser]
    pagination_class = StandardPageNumberPagination
    filterset_fields = ['job', 'state']

    def get_queryset(self):
        # Limit to last 100 runs for performance, ordered by most recent first
        return IngestRun.objects.select_related('job').order_by('-started_at')[:100]


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
        ensure_service_registry()
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_history'),
            status='queued',
            input_summary={
                'trigger': 'data_ingest.trigger_daily_prices',
                'requested_by': request.user.username,
                'days': days,
                'symbols': symbols or [],
            },
            output_summary={},
        )

        try:
            # Queue the ingest task asynchronously
            task = ingest_daily_prices.apply_async(
                kwargs={
                    'days': days,
                    'symbols': symbols,
                    'service_run_log_id': service_run_log.id,
                },
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
                    'service_run_log_id': service_run_log.id,
                    'status': 'queued',
                    'started_at': __import__('django.utils.timezone', fromlist=['now']).now(),
                    'message': f'Daily price ingest queued with task ID {task.id}',
                }
            )
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as exc:
            logger.error(f'Failed to queue daily price ingest: {exc}', exc_info=True)
            service_run_log.status = 'failed'
            service_run_log.error_detail = str(exc)
            service_run_log.save(update_fields=['status', 'error_detail'])
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
        ensure_service_registry()
        service_run_log = ServiceRunLog.objects.create(
            service=get_registered_service('vnbroker_price_board'),
            status='queued',
            input_summary={
                'trigger': 'data_ingest.trigger_price_board',
                'requested_by': request.user.username,
            },
            output_summary={},
        )

        try:
            task = fetch_and_upsert_price_board.apply_async(
                kwargs={'service_run_log_id': service_run_log.id},
                countdown=0,
            )

            logger.info(
                f'Price board refresh triggered by {request.user.username}, task_id={task.id}'
            )

            response_serializer = IngestTriggerResponseSerializer(
                {
                    'task_id': task.id,
                    'job_id': None,
                    'service_run_log_id': service_run_log.id,
                    'status': 'queued',
                    'started_at': __import__('django.utils.timezone', fromlist=['now']).now(),
                    'message': f'Price board refresh queued with task ID {task.id}',
                }
            )
            return Response(response_serializer.data, status=status.HTTP_202_ACCEPTED)

        except Exception as exc:
            logger.error(f'Failed to queue price board refresh: {exc}', exc_info=True)
            service_run_log.status = 'failed'
            service_run_log.error_detail = str(exc)
            service_run_log.save(update_fields=['status', 'error_detail'])
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


# ---------------------------------------------------------------------------
# D03: SOC endpoint — trigger system backfill
# D04: User endpoint — trigger user backfill
# ---------------------------------------------------------------------------

class SystemBackfillThrottle(UserRateThrottle):
    """Rate limit cho SOC system backfill trigger: 30 lần/giờ."""
    scope = 'system_backfill_trigger'
    rate = '30/hour'


class UserBackfillThrottle(UserRateThrottle):
    """Rate limit cho user self-serve backfill: 5 lần/giờ (AGENTS §14.9)."""
    scope = 'user_backfill_trigger'
    rate = '5/hour'


class SystemBackfillTriggerView(APIView):
    """
    POST /core/v1/data-ingest/backfill/system/
    Admin-only: queue backfill_intraday_tick_system task.

    Request body: { "symbol": "HPG", "trade_date": "2026-05-10" }
    """
    permission_classes = [IsAdminUser]
    throttle_classes = [SystemBackfillThrottle]

    def post(self, request):
        symbol = str(request.data.get('symbol') or '').strip().upper()
        trade_date = str(request.data.get('trade_date') or '').strip()

        if not symbol or not trade_date:
            return Response(
                {'detail': 'symbol và trade_date là bắt buộc.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .tasks import backfill_intraday_tick_system
        result = backfill_intraday_tick_system.apply_async(
            kwargs={'symbol': symbol, 'trade_date': trade_date},
        )
        return Response({'task_id': result.id, 'symbol': symbol, 'trade_date': trade_date},
                        status=status.HTTP_202_ACCEPTED)


class UserBackfillTriggerView(APIView):
    """
    POST /core/v1/data-ingest/backfill/user/
    Authenticated user: queue backfill_intraday_tick_user task cho chính user đó.

    Request body: { "symbol": "HPG", "trade_date": "2026-05-10" }
    §14.8: days_back clamp max 180 enforced tại view layer.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserBackfillThrottle]

    def post(self, request):
        from datetime import date, timedelta

        symbol = str(request.data.get('symbol') or '').strip().upper()
        trade_date_str = str(request.data.get('trade_date') or '').strip()

        if not symbol or not trade_date_str:
            return Response(
                {'detail': 'symbol và trade_date là bắt buộc.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # §14.8: clamp trade_date không được quá 180 ngày trước hôm nay
        try:
            from datetime import datetime
            trade_date = datetime.strptime(trade_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'detail': 'trade_date phải có định dạng YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        min_allowed = date.today() - timedelta(days=_USER_BACKFILL_MAX_DAYS)
        if trade_date < min_allowed:
            return Response(
                {'detail': f'trade_date không được trước {min_allowed.isoformat()} (tối đa {_USER_BACKFILL_MAX_DAYS} ngày).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .tasks import backfill_intraday_tick_user
        result = backfill_intraday_tick_user.apply_async(
            kwargs={'user_id': request.user.id, 'symbol': symbol, 'trade_date': trade_date_str},
        )
        return Response({'task_id': result.id, 'symbol': symbol, 'trade_date': trade_date_str},
                        status=status.HTTP_202_ACCEPTED)
