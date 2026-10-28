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

from vninvest_core.pagination import CoreCursorPagination
from vninvest_core.exceptions import ValidationErrorException

class IngestRunCursorPagination(CoreCursorPagination):
    ordering = '-started_at'
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
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response


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
    pagination_class = CoreCursorPagination
    filterset_fields = ['source', 'status']


class IngestRunViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for ingest runs (execution history).
    Provides pagination and filtering for audit/monitoring.
    """
    serializer_class = IngestRunSerializer
    permission_classes = [IsAdminUser]
    pagination_class = IngestRunCursorPagination
    filterset_fields = ['job', 'state']

    def get_queryset(self):
        # Limit to last 100 runs for performance, ordered by most recent first
        return IngestRun.objects.select_related('job').order_by('-started_at')


@extend_schema(
    request=OpenApiTypes.OBJECT,
    summary='DataIngestAdminViewSet',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
@extend_schema(
    summary='DataIngestAdminViewSet',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: envelope_response(),
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
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


_SYSTEM_BACKFILL_SUPPORTED_DATASETS = frozenset(['tape_intraday'])
_SYSTEM_BACKFILL_MAX_DATE_RANGE_DAYS = 365
_VALID_MODES = frozenset(['missing_only', 'force_refresh'])


def _resolve_backfill_symbols(symbols_group: str, custom_symbol: str) -> list[str] | None:
    """
    Resolve a symbols_group string to a flat list of symbol strings.
    Returns None if resolution fails (caller should return 400).
    """
    group = str(symbols_group or '').strip().lower()
    if group == 'custom':
        sym = str(custom_symbol or '').strip().upper()
        if not sym:
            return None
        return [sym]
    from market_data.vnbroker_adapter import fetch_symbol_group_members
    try:
        members = fetch_symbol_group_members(group)
        return [s.upper() for s in members if s] if members else None
    except Exception as exc:
        logger.warning('_resolve_backfill_symbols group=%s failed: %s', group, exc)
        return None


def _build_trading_date_range(from_date_str: str, to_date_str: str):
    """
    Return list of date strings (YYYY-MM-DD) from from_date to to_date,
    excluding weekends. Raises ValueError on bad input.
    """
    from datetime import date, timedelta
    from_date = date.fromisoformat(from_date_str)
    to_date = date.fromisoformat(to_date_str)
    if from_date > to_date:
        raise ValueError('from_date phải trước hoặc bằng to_date.')
    if (to_date - from_date).days > _SYSTEM_BACKFILL_MAX_DATE_RANGE_DAYS:
        raise ValueError(f'Khoảng ngày không được vượt quá {_SYSTEM_BACKFILL_MAX_DATE_RANGE_DAYS} ngày.')
    dates = []
    current = from_date
    while current <= to_date:
        if current.weekday() < 5:  # Mon–Fri only
            dates.append(current.isoformat())
        current += timedelta(days=1)
    return dates


@extend_schema(
    summary='SystemBackfillTriggerView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class SystemBackfillTriggerView(APIView):
    """
    POST /core/v1/data-ingest/backfill/system/
    Admin-only: queue backfill_intraday_tick_system tasks for a symbol group × date range.

    Request body (v2):
    {
        "datasets": ["tape_intraday"],
        "symbols_group": "vn30",        # or "custom"
        "symbol": "HPG",                # required when symbols_group == "custom"
        "from_date": "2026-05-01",
        "to_date": "2026-05-19",
        "mode": "missing_only",         # or "force_refresh"
        "dry_run": false
    }

    Backward-compat (v1): { "symbol": "HPG", "trade_date": "2026-05-10" }
    → auto-mapped to v2 with symbols_group=custom, from_date=to_date=trade_date.
    """
    permission_classes = [IsAdminUser]
    throttle_classes = [SystemBackfillThrottle]

    def post(self, request):
        data = request.data

        # ── Backward-compat: v1 payload { symbol, trade_date } ──────────────
        if 'trade_date' in data and 'from_date' not in data:
            data = {
                'datasets': ['tape_intraday'],
                'symbols_group': 'custom',
                'symbol': str(data.get('symbol') or '').strip().upper(),
                'from_date': str(data.get('trade_date') or '').strip(),
                'to_date': str(data.get('trade_date') or '').strip(),
                'mode': 'missing_only',
                'dry_run': False,
            }

        # ── Validate datasets ────────────────────────────────────────────────
        datasets = data.get('datasets') or []
        if not isinstance(datasets, list) or not datasets:
            raise ValidationErrorException('datasets phải là list không rỗng.')
        unsupported = [d for d in datasets if d not in _SYSTEM_BACKFILL_SUPPORTED_DATASETS]
        if unsupported:
            raise ValidationErrorException(
                f'Dataset chưa hỗ trợ: {unsupported}. Hiện chỉ hỗ trợ: {list(_SYSTEM_BACKFILL_SUPPORTED_DATASETS)}.'
            )

        # ── Validate mode ────────────────────────────────────────────────────
        mode = str(data.get('mode') or 'missing_only').strip()
        if mode not in _VALID_MODES:
            raise ValidationErrorException(f'mode phải là một trong: {list(_VALID_MODES)}.')

        dry_run = bool(data.get('dry_run', False))

        # ── Resolve symbols ──────────────────────────────────────────────────
        symbols_group = str(data.get('symbols_group') or 'custom').strip().lower()
        custom_symbol = str(data.get('symbol') or '').strip().upper()
        symbols = _resolve_backfill_symbols(symbols_group, custom_symbol)
        if not symbols:
            raise ValidationErrorException(
                'Không thể xác định danh sách mã. Kiểm tra lại symbols_group hoặc symbol.'
            )

        # ── Validate & build date range ──────────────────────────────────────
        from_date_str = str(data.get('from_date') or '').strip()
        to_date_str = str(data.get('to_date') or '').strip()
        if not from_date_str or not to_date_str:
            raise ValidationErrorException('from_date và to_date là bắt buộc.')
        try:
            trade_dates = _build_trading_date_range(from_date_str, to_date_str)
        except ValueError as exc:
            raise ValidationErrorException(str(exc))

        if not trade_dates:
            raise ValidationErrorException('Không có ngày giao dịch hợp lệ trong khoảng ngày đã chọn.')

        # ── Build (symbol, date) slots & apply missing-only filter via pandas ──
        import pandas as pd
        from .tasks import backfill_intraday_tick_system

        # All candidate slots as DataFrame
        all_slots = pd.DataFrame(
            [(s, d) for s in symbols for d in trade_dates],
            columns=['symbol', 'trade_date'],
        )

        if mode == 'missing_only':
            # §14.5 one bulk query → pandas anti-join to get only missing slots
            # Use IntradayBar (1H timeframe) for presence check as it is ~1000x smaller
            # and composite indexed on (symbol, timeframe, datetime)
            from datetime import datetime, time
            import pytz
            from django.db.models.functions import TruncDate
            from django.utils.timezone import make_aware
            from market_data.models import IntradayBar

            tz = pytz.timezone('Asia/Ho_Chi_Minh')
            sorted_dates = sorted(trade_dates)
            existing_pairs = []
            if sorted_dates:
                min_date = datetime.strptime(sorted_dates[0], '%Y-%m-%d').date()
                max_date = datetime.strptime(sorted_dates[-1], '%Y-%m-%d').date()
                start_dt = make_aware(datetime.combine(min_date, time.min), tz)
                end_dt = make_aware(datetime.combine(max_date, time.max), tz)

                existing_qs = (
                    IntradayBar.objects
                    .filter(symbol__in=symbols, timeframe='1H', datetime__gte=start_dt, datetime__lte=end_dt)
                    .annotate(trade_date=TruncDate('datetime'))
                    .values_list('symbol', 'trade_date')
                    .distinct()
                )
                existing_pairs = [(sym, dt.isoformat() if hasattr(dt, 'isoformat') else str(dt)) for sym, dt in existing_qs if dt]

            existing_df = pd.DataFrame(existing_pairs, columns=['symbol', 'trade_date'])
            if not existing_df.empty:
                existing_df['trade_date'] = existing_df['trade_date'].astype(str)
                merged = all_slots.merge(existing_df, on=['symbol', 'trade_date'], how='left', indicator=True)
                missing_slots = merged.loc[merged['_merge'] == 'left_only', ['symbol', 'trade_date']]
                skipped_count = len(all_slots) - len(missing_slots)
            else:
                missing_slots = all_slots
                skipped_count = 0
        else:
            missing_slots = all_slots
            skipped_count = 0

        if dry_run:
            return Response(
                {
                    'dry_run': True,
                    'slots_preview': len(missing_slots),
                    'skipped_preview': skipped_count,
                    'symbols_count': len(symbols),
                    'dates_count': len(trade_dates),
                },
                status=status.HTTP_200_OK,
            )

        tasks_queued = 0
        for row in missing_slots.itertuples(index=False):
            backfill_intraday_tick_system.apply_async(
                kwargs={'symbol': row.symbol, 'trade_date': row.trade_date},
            )
            tasks_queued += 1

        return Response(
            {
                'tasks_queued': tasks_queued,
                'skipped': skipped_count,
                'symbols_count': len(symbols),
                'from_date': from_date_str,
                'to_date': to_date_str,
            },
            status=status.HTTP_202_ACCEPTED,
        )


@extend_schema(
    summary='UserBackfillTriggerView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    # Body-carrying method: the REQUEST side must be typed too;
    # responses= alone still yields the unguessable-serializer error.
    request=OpenApiTypes.OBJECT,
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
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
            raise ValidationErrorException('symbol và trade_date là bắt buộc.')

        # §14.8: clamp trade_date không được quá 180 ngày trước hôm nay
        try:
            from datetime import datetime
            trade_date = datetime.strptime(trade_date_str, '%Y-%m-%d').date()
        except ValueError:
            raise ValidationErrorException('trade_date phải có định dạng YYYY-MM-DD.')

        min_allowed = date.today() - timedelta(days=_USER_BACKFILL_MAX_DAYS)
        if trade_date < min_allowed:
            raise ValidationErrorException(
                f'trade_date không được trước {min_allowed.isoformat()} (tối đa {_USER_BACKFILL_MAX_DAYS} ngày).'
            )

        from .tasks import backfill_intraday_tick_user
        result = backfill_intraday_tick_user.apply_async(
            kwargs={'user_id': request.user.id, 'symbol': symbol, 'trade_date': trade_date_str},
        )
        return Response({'task_id': result.id, 'symbol': symbol, 'trade_date': trade_date_str},
                        status=status.HTTP_202_ACCEPTED)
