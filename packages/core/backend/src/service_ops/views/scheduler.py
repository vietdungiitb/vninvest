"""
Scheduler Control Center — Operator views.

Namespace: /core/v1/operator/scraping/dataops/scheduler/

Endpoints:
  GET  scheduler/plan/            — unified scheduler job catalog
  GET  scheduler/health/          — global scheduler health summary
  GET  scheduler/jobs/{key}/history/ — paginated run/action history for a job
"""

from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, extend_schema, extend_schema_view
from drf_spectacular.openapi import OpenApiTypes
from rest_framework import serializers, status
from rest_framework.response import Response

from ..scheduler_catalog import build_scheduler_catalog, build_scheduler_health_summary
from ..ownership import build_ownership_matrix_from_db
from ..models import ConfigChangeAudit, ServiceRunLog
from .base import SOCBaseView


# ── Serializers ────────────────────────────────────────────────────────────────

class SchedulerJobSerializer(serializers.Serializer):
    job_key = serializers.CharField()
    display_name = serializers.CharField()
    domain = serializers.CharField()
    data_types = serializers.ListField(child=serializers.CharField())
    trigger_type = serializers.CharField()
    control_mode = serializers.CharField()
    schedule_label = serializers.CharField()
    task_path = serializers.CharField()
    queue = serializers.CharField()
    status = serializers.CharField()
    status_reason = serializers.CharField(required=False, allow_null=True)
    enabled = serializers.BooleanField()
    is_inflight = serializers.BooleanField()
    next_run_at = serializers.CharField(required=False, allow_null=True)
    last_run_at = serializers.CharField(required=False, allow_null=True)
    lag_seconds = serializers.IntegerField(required=False, allow_null=True)
    freshness_state = serializers.CharField()
    total_run_count = serializers.IntegerField()
    beat_registered = serializers.BooleanField()
    capabilities = serializers.ListField(child=serializers.CharField())


class SchedulerPlanResponseSerializer(serializers.Serializer):
    generated_at = serializers.CharField()
    jobs_total = serializers.IntegerField()
    jobs = SchedulerJobSerializer(many=True)
    ownership = serializers.JSONField()


class SchedulerHealthResponseSerializer(serializers.Serializer):
    generated_at = serializers.CharField()
    overall_health = serializers.CharField()
    jobs_total = serializers.IntegerField()
    by_status = serializers.DictField(child=serializers.IntegerField())
    by_domain = serializers.DictField(child=serializers.IntegerField())
    by_freshness = serializers.DictField(child=serializers.IntegerField())
    enabled_count = serializers.IntegerField()
    degraded_count = serializers.IntegerField()
    unregistered_count = serializers.IntegerField()


class SchedulerJobHistoryResponseSerializer(serializers.Serializer):
    job_key = serializers.CharField()
    count = serializers.IntegerField()
    next = serializers.CharField(required=False, allow_null=True)
    previous = serializers.CharField(required=False, allow_null=True)
    results = serializers.ListField(child=serializers.JSONField())


# ── Views ──────────────────────────────────────────────────────────────────────

@extend_schema_view(
    get=extend_schema(
        summary='Danh sách kế hoạch chạy scheduler (unified catalog)',
        description=(
            'Trả về danh sách tất cả scheduler jobs hợp nhất từ CELERY_BEAT_SCHEDULE, '
            'PeriodicTask DB, và ServiceRunLog. '
            'Mỗi job có status truth, lag, freshness, và capabilities để operator biết '
            'action nào có thể thực hiện.'
        ),
        parameters=[
            OpenApiParameter(
                'domain',
                OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Lọc theo domain: dataops | prefetch | materialization | platform',
            ),
        ],
        responses={
            200: SchedulerPlanResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
        examples=[
            OpenApiExample(
                'Scheduler plan response',
                value={
                    'generated_at': '2026-05-18T10:00:00Z',
                    'jobs_total': 18,
                    'jobs': [
                        {
                            'job_key': 'market-data-queue-tier-scheduler-30s',
                            'display_name': 'Market data queue-tier scheduler (30s)',
                            'domain': 'dataops',
                            'data_types': ['daily_prices', 'price_board'],
                            'trigger_type': 'interval',
                            'control_mode': 'beat_enabled',
                            'schedule_label': 'every 30s',
                            'task_path': 'service_ops.run_market_data_queue_tier_scheduler',
                            'queue': 'manual_on_demand',
                            'status': 'enabled',
                            'status_reason': None,
                            'enabled': True,
                            'is_inflight': False,
                            'next_run_at': None,
                            'last_run_at': None,
                            'lag_seconds': None,
                            'freshness_state': 'missing',
                            'total_run_count': 0,
                            'beat_registered': True,
                            'capabilities': ['enable', 'disable', 'run_now', 'abort_active'],
                        }
                    ],
                    'ownership': {'can_apply': True, 'domain': 'dataops'},
                },
            )
        ],
        tags=['Operator - Scheduler'],
    )
)
class SchedulerPlanView(SOCBaseView):
    """GET /core/v1/operator/scraping/dataops/scheduler/plan/"""

    def get(self, request):
        domain_filter = request.query_params.get('domain') or None
        catalog = build_scheduler_catalog(domain_filter=domain_filter)

        matrix = build_ownership_matrix_from_db()
        ownership = matrix.to_response_dict('dataops_market_data')
        ownership['can_apply'] = matrix.is_domain_writable('dataops_market_data')

        return Response({
            'generated_at': timezone.now().isoformat(),
            'jobs_total': len(catalog),
            'jobs': catalog,
            'ownership': ownership,
        })


@extend_schema_view(
    get=extend_schema(
        summary='Global scheduler health summary',
        description=(
            'Trả về snapshot sức khỏe tổng thể của scheduler: '
            'tổng số jobs, phân bổ theo status/domain/freshness, '
            'số jobs degraded và chưa đăng ký trong beat DB.'
        ),
        responses={
            200: SchedulerHealthResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
        },
        tags=['Operator - Scheduler'],
    )
)
class SchedulerHealthView(SOCBaseView):
    """GET /core/v1/operator/scraping/dataops/scheduler/health/"""

    def get(self, request):
        summary = build_scheduler_health_summary()
        return Response(summary)


@extend_schema_view(
    get=extend_schema(
        summary='Lịch sử run/action của một scheduler job',
        description='Trả về paginated run log và audit trail cho job_key cụ thể.',
        parameters=[
            OpenApiParameter(
                'page',
                OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
            ),
            OpenApiParameter(
                'page_size',
                OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
            ),
        ],
        responses={
            200: SchedulerJobHistoryResponseSerializer,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
        tags=['Operator - Scheduler'],
    )
)
class SchedulerJobHistoryView(SOCBaseView):
    """GET /core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/history/"""

    def get(self, request, job_key: str):
        from django.conf import settings
        from ..scheduler_catalog import CATALOG_JOB_METADATA
        from ..models import ServiceRunLog, ServiceDefinition

        schedule_map = getattr(settings, 'CELERY_BEAT_SCHEDULE', {}) or {}
        if job_key not in schedule_map and job_key not in CATALOG_JOB_METADATA:
            return self.error_response(
                request,
                code='SCHEDULER_JOB_NOT_FOUND',
                detail=f"Scheduler job '{job_key}' does not exist.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        # S04: fetch ServiceRunLog via service_key mapping from CATALOG_JOB_METADATA
        meta = CATALOG_JOB_METADATA.get(job_key, {})
        service_key = meta.get('service_key', '')

        page_size = min(int(request.query_params.get('page_size', 20)), 100)
        page = max(int(request.query_params.get('page', 1)), 1)
        offset = (page - 1) * page_size

        results = []
        count = 0

        if service_key:
            qs = ServiceRunLog.objects.filter(
                service__service_key=service_key,
            ).order_by('-started_at')
            count = qs.count()
            for log in qs[offset:offset + page_size]:
                results.append({
                    'id': log.pk,
                    'celery_task_id': log.celery_task_id,
                    'status': log.status,
                    'started_at': log.started_at.isoformat() if log.started_at else None,
                    'finished_at': log.finished_at.isoformat() if log.finished_at else None,
                    'duration_seconds': log.duration_seconds,
                    'input_summary': log.input_summary,
                    'output_summary': log.output_summary,
                    'error_detail': log.error_detail or None,
                })

        total_pages = max((count + page_size - 1) // page_size, 1)

        return Response({
            'job_key': job_key,
            'count': count,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'next': f'?page={page + 1}&page_size={page_size}' if page < total_pages else None,
            'previous': f'?page={page - 1}&page_size={page_size}' if page > 1 else None,
            'results': results,
        })


# ── S02: Capability Matrix + Ownership Guard ───────────────────────────────────

# Actions được phép theo control_mode
_ALLOWED_ACTIONS_BY_CONTROL_MODE: dict[str, frozenset] = {
    'beat_enabled': frozenset({'enable', 'disable', 'run_now', 'abort'}),
    'beat_read_only': frozenset({'run_now'}),
    'service_config': frozenset({'enable', 'disable', 'run_now', 'abort'}),
    'manual_only': frozenset({'run_now'}),
    'platform_managed': frozenset(),
}

# Actions được phép theo domain (ownership guard)
_DOMAIN_WRITE_ENABLED: frozenset = frozenset({
    'dataops', 'prefetch', 'materialization', 'vnbroker', 'matrix', 'dataops_market_data',
})

_DOMAIN_WRITE_BLOCKED: frozenset = frozenset({'signals', 'platform'})

VALID_ACTIONS = frozenset({'enable', 'disable', 'run_now', 'abort'})


class SchedulerJobActionRequestSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=list(VALID_ACTIONS),
        help_text='Action: enable | disable | run_now | abort',
    )
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text='Lý do thực hiện action (tuỳ chọn, hiển thị trong audit log).',
    )


class SchedulerJobActionResponseSerializer(serializers.Serializer):
    job_key = serializers.CharField()
    action = serializers.CharField()
    accepted = serializers.BooleanField()
    message = serializers.CharField()
    executed_at = serializers.CharField()


@extend_schema_view(
    post=extend_schema(
        summary='Thực hiện action trên một scheduler job',
        description=(
            'Nhận action từ operator: enable / disable / run_now / abort. '
            'Hệ thống kiểm tra ownership boundary và capability whitelist trước khi thực thi. '
            'Lệnh bị chặn trả về 403 với ownership error envelope chuẩn. '
            'Actual execution được hoàn thiện trong S03.'
        ),
        request=SchedulerJobActionRequestSerializer,
        responses={
            202: SchedulerJobActionResponseSerializer,
            400: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
        tags=['Operator - Scheduler'],
        examples=[
            OpenApiExample(
                'Enable job success',
                request_only=True,
                value={'action': 'enable', 'reason': 'Morning bootstrap enable'},
            ),
            OpenApiExample(
                'Action denied — domain blocked',
                response_only=True,
                status_codes=['403'],
                value={
                    'detail': "Domain 'platform' không cho phép ghi từ SOC.",
                    'code': 'SCHEDULER_ACTION_OWNERSHIP_DENIED',
                    'timestamp': '2026-05-18T10:00:00Z',
                    'request_id': 'req-xxx',
                },
            ),
        ],
    )
)
class SchedulerJobActionView(SOCBaseView):
    """POST /core/v1/operator/scraping/dataops/scheduler/jobs/{job_key}/actions/

    S02: Ownership guard + capability whitelist gate.
    S03: Actual Beat/ServiceConfig execution (to be implemented).
    """

    def post(self, request, job_key: str):
        from django.conf import settings
        from ..scheduler_catalog import CATALOG_JOB_METADATA

        # 1. Validate job exists
        schedule_map = getattr(settings, 'CELERY_BEAT_SCHEDULE', {}) or {}
        if job_key not in schedule_map and job_key not in CATALOG_JOB_METADATA:
            return self.error_response(
                request,
                code='SCHEDULER_JOB_NOT_FOUND',
                detail=f"Scheduler job '{job_key}' không tồn tại.",
                http_status=status.HTTP_404_NOT_FOUND,
            )

        # 2. Validate request body
        serializer = SchedulerJobActionRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return self.error_response(
                request,
                code='SCHEDULER_ACTION_INVALID_REQUEST',
                detail='Dữ liệu action không hợp lệ.',
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors=serializer.errors,
            )
        action = serializer.validated_data['action']
        reason = serializer.validated_data.get('reason', '')

        # 3. Ownership domain guard
        meta = CATALOG_JOB_METADATA.get(job_key, {})
        domain = meta.get('domain', 'platform')
        if domain in _DOMAIN_WRITE_BLOCKED:
            return self.error_response(
                request,
                code='SCHEDULER_ACTION_OWNERSHIP_DENIED',
                detail=(
                    f"Domain '{domain}' không cho phép ghi từ SOC. "
                    "Vui lòng dùng surface quản trị tương ứng."
                ),
                http_status=status.HTTP_403_FORBIDDEN,
            )

        # 4. Capability / control_mode whitelist guard
        control_mode = meta.get('control_mode', 'beat_enabled')
        allowed_actions = _ALLOWED_ACTIONS_BY_CONTROL_MODE.get(control_mode, frozenset())
        if action not in allowed_actions:
            return self.error_response(
                request,
                code='SCHEDULER_ACTION_NOT_ALLOWED',
                detail=(
                    f"Action '{action}' không được phép cho job '{job_key}' "
                    f"(control_mode='{control_mode}'). "
                    f"Các action hợp lệ: {sorted(allowed_actions) or 'không có'}."
                ),
                http_status=status.HTTP_403_FORBIDDEN,
            )

        # 5. Execute action (S03)
        result = _execute_scheduler_action(
            job_key=job_key,
            action=action,
            meta=meta,
            actor=str(request.user),
            actor_ip=_get_client_ip(request),
            reason=reason,
            request_id=getattr(request, 'request_id', ''),
        )
        return Response(result, status=status.HTTP_202_ACCEPTED)


def _get_client_ip(request) -> 'str | None':
    """Lấy IP của operator từ request (proxy-aware)."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if x_forwarded:
        ip = x_forwarded.split(',')[0].strip()
        return ip or None
    return request.META.get('REMOTE_ADDR') or None


def _execute_scheduler_action(
    job_key: str,
    action: str,
    meta: dict,
    actor: str,
    actor_ip: 'str | None',
    reason: str,
    request_id: str,
) -> dict:
    """
    Thực thi action trên scheduler job.

    enable/disable → toggle PeriodicTask.enabled + ConfigChangeAudit
    run_now        → send_task() async + ServiceRunLog(queued)
    abort          → revoke inflight tasks + mark ServiceRunLog failed
    """
    from django.conf import settings
    from django_celery_beat.models import PeriodicTask
    from celery import current_app as celery_app

    from ..models import ServiceDefinition, ServiceRunLog, ConfigChangeAudit

    executed_at = timezone.now()
    # task_path phải đọc từ CELERY_BEAT_SCHEDULE, không phải từ CATALOG_JOB_METADATA.
    # meta (CATALOG_JOB_METADATA) không chứa task_path — chỉ build_scheduler_catalog() mới attach nó.
    _beat_schedule = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
    task_path = (_beat_schedule.get(job_key) or {}).get('task', '') or meta.get('task_path', '')
    message_parts: list[str] = []

    if action in ('enable', 'disable'):
        new_enabled = action == 'enable'
        updated = PeriodicTask.objects.filter(name=job_key).update(enabled=new_enabled)
        if updated:
            # Audit record — best effort (không block nếu service_key không map)
            try:
                service_def = ServiceDefinition.objects.filter(service_key=job_key).first()
                if service_def:
                    ConfigChangeAudit.objects.create(
                        service=service_def,
                        action='apply',
                        actor=actor,
                        actor_ip=actor_ip,
                        before_snapshot={'enabled': not new_enabled},
                        after_snapshot={'enabled': new_enabled},
                        change_summary=(
                            f"Scheduler job '{job_key}' "
                            f"{'bật' if new_enabled else 'tắt'} bởi operator. "
                            f"Lý do: {reason or 'Không có'}."
                        ),
                        request_id=request_id,
                    )
            except Exception:
                pass
            message_parts.append(
                f"PeriodicTask '{job_key}' đã được "
                f"{'bật' if new_enabled else 'tắt'} thành công."
            )
        else:
            message_parts.append(
                f"Job '{job_key}' không tìm thấy trong PeriodicTask DB. "
                "Action được ghi nhận nhưng không có beat task nào bị thay đổi."
            )

    elif action == 'run_now':
        if task_path:
            try:
                schedule_map = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
                job_def = schedule_map.get(job_key, {})
                kwargs = job_def.get('kwargs', {})
                queue = job_def.get('options', {}).get('queue', 'celery')
                async_result = celery_app.send_task(task_path, kwargs=kwargs, queue=queue)
                celery_task_id = async_result.id
                message_parts.append(
                    f"Task '{task_path}' đã được gửi vào queue '{queue}'. "
                    f"Celery task ID: {celery_task_id}."
                )
                # Đánh dấu inflight trong cache để catalog hiển thị 'ĐANG CHẠY' ngay lập tức.
                # TTL = 7200s (2h) — đủ cho backfill dài; abort sẽ xóa sớm hơn nếu cần.
                try:
                    from django.core.cache import cache
                    _INFLIGHT_TTL = 7200  # 2 giờ
                    cache.set(f'scheduler:inflight:{job_key}', celery_task_id, timeout=_INFLIGHT_TTL)
                    cache.set(f'scheduler:manual_run:{job_key}', executed_at.isoformat(), timeout=86400)
                except Exception:
                    pass
                try:
                    service_def = ServiceDefinition.objects.filter(service_key=job_key).first()
                    if service_def:
                        ServiceRunLog.objects.create(
                            service=service_def,
                            celery_task_id=celery_task_id,
                            status='queued',
                            input_summary={
                                'triggered_by': 'operator_run_now',
                                'actor': actor,
                                'reason': reason,
                            },
                        )
                except Exception:
                    pass
            except Exception as exc:
                message_parts.append(f"Không thể gửi task: {exc}")
        else:
            message_parts.append(
                f"Job '{job_key}' không có task_path trong CELERY_BEAT_SCHEDULE. "
                "run_now không được thực thi."
            )

    elif action == 'abort':
        # Xóa inflight cache marker khi operator abort job.
        try:
            from django.core.cache import cache
            cache.delete(f'scheduler:inflight:{job_key}')
        except Exception:
            pass
        try:
            service_def = ServiceDefinition.objects.filter(service_key=job_key).first()
            revoked_count = 0
            if service_def:
                inflight_logs = ServiceRunLog.objects.filter(
                    service=service_def,
                    status__in=['queued', 'running'],
                )
                for run_log in inflight_logs:
                    if run_log.celery_task_id:
                        try:
                            celery_app.control.revoke(
                                run_log.celery_task_id,
                                terminate=True,
                                signal='SIGTERM',
                            )
                            revoked_count += 1
                        except Exception:
                            pass
                    run_log.status = 'failed'
                    run_log.finished_at = executed_at
                    run_log.error_detail = (
                        f'Bị abort bởi operator {actor} lúc {executed_at.isoformat()}.'
                    )
                    run_log.save(update_fields=['status', 'finished_at', 'error_detail'])
            message_parts.append(
                f"Đã gửi revoke signal cho {revoked_count} celery task(s) của job '{job_key}'."
            )
        except Exception as exc:
            message_parts.append(f"Abort gặp lỗi: {exc}")

    return {
        'job_key': job_key,
        'action': action,
        'accepted': True,
        'message': ' '.join(message_parts) or f"Action '{action}' đã được xử lý.",
        'executed_at': executed_at.isoformat(),
    }

