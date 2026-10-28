"""
API Usage Analytics views for tenant-admin (Phase 2).

Queries pre-aggregated ApiCallRollup for fast group_by queries.
Raw AuditEvent fallback for days <= 1 (per-endpoint precision).
"""
from datetime import timedelta
from django.db import models
from django.db.models import Sum, Count
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from drf_spectacular.utils import OpenApiTypes, extend_schema

from .permissions import IsTenantActive, require_pat_scopes_or_human_session
from .schema import PartnerApiTimelineSerializer, PartnerApiUsageSerializer
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission

RAW_QUERY_MAX_DAYS = 1  # configurable threshold for raw AuditEvent fallback


#: Hợp đồng **phẳng**, KHÔNG phải envelope. View trả
#: `{summary, data, filters}` — `data` nằm **ngang hàng** sibling nên bọc vào
#: `{data, meta}` sẽ **làm rơi** `summary`/`filters`. Bộ phân loại của
#: `scripts/check-envelope-contract.py` xếp là `SKIP_F5_SIBLINGS`.
@extend_schema(
    responses={200: PartnerApiUsageSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_api_usage(request):
    """
    GET /partner/usage/api-calls/
    
    Query params:
      - group_by: ip | endpoint | status | hour (required)
      - days: 1-90 (default 7)
      - status: 2xx | 4xx | 5xx (filter)
      - method: GET | POST | PATCH | DELETE | PUT (filter)
      - endpoint: path pattern (filter)
    """
    require_pat_scopes_or_human_session(request, 'manage_tenant')
    _require_tenant_permission(request, 'usage:read')
    tenant = _get_request_tenant(request)

    group_by = request.GET.get('group_by')
    if group_by not in {'ip', 'endpoint', 'status', 'hour'}:
        return Response({'detail': 'group_by must be one of: ip, endpoint, status, hour'}, status=400)

    try:
        days = max(1, min(int(request.GET.get('days', 7)), 90))
    except (TypeError, ValueError):
        days = 7

    status_filter = request.GET.get('status')
    method_filter = request.GET.get('method')
    endpoint_filter = request.GET.get('endpoint')

    today = timezone.now().date()
    start = today - timedelta(days=days - 1)

    # Decide data source: raw for days <= RAW_QUERY_MAX_DAYS, rollup otherwise
    use_raw = days <= 1  # RAW_QUERY_MAX_DAYS

    if use_raw:
        from ops_audit.models import AuditEvent
        qs = AuditEvent.objects.filter(
            tenant_id=tenant.public_id,
            occurred_at__date__gte=start,
            occurred_at__date__lte=today,
        )
        # Real request attributes live in the metadata JSON (RequestTraceMiddleware).
        if status_filter:
            if status_filter == '2xx':
                qs = qs.filter(metadata__status_code__lt=300)
            elif status_filter == '4xx':
                qs = qs.filter(metadata__status_code__gte=400, metadata__status_code__lt=500)
            elif status_filter == '5xx':
                qs = qs.filter(metadata__status_code__gte=500)
        if endpoint_filter:
            qs = qs.filter(metadata__path__startswith=endpoint_filter)
        if method_filter:
            qs = qs.filter(metadata__method=method_filter)

        # Build group_by aggregation
        if group_by == 'ip':
            rows = qs.values('ip_address').annotate(
                count=Count('id'),
                error_count=Count('id', filter=models.Q(metadata__status_code__gte=400)),
            ).order_by('-count')
            data = [{'key': r['ip_address'] or 'unknown', 'count': r['count'], 'error_count': r['error_count']} for r in rows]
        elif group_by == 'endpoint':
            rows = qs.values('metadata__path').annotate(
                count=Count('id'),
                error_count=Count('id', filter=models.Q(metadata__status_code__gte=400)),
            ).order_by('-count')
            data = [{'key': r['metadata__path'] or 'unknown', 'count': r['count'], 'error_count': r['error_count']} for r in rows]
        elif group_by == 'status':
            rows = qs.values('metadata__status_code').annotate(count=Count('id')).order_by('-count')
            data = [{'key': str(r['metadata__status_code']), 'count': r['count']} for r in rows]
        elif group_by == 'hour':
            rows = qs.extra(select={'hour': "EXTRACT(hour FROM occurred_at)"}).values('hour').annotate(
                count=Count('id'),
                error_count=Count('id', filter=models.Q(metadata__status_code__gte=400)),
            ).order_by('hour')
            data = [{'key': int(r['hour']), 'count': r['count'], 'error_count': r['error_count']} for r in rows]
    else:
        # Use pre-aggregated rollup (fast, always available)
        from ops_audit.models import ApiCallRollup
        today = timezone.now().date()
        start = today - timedelta(days=days - 1)

        qs = ApiCallRollup.objects.filter(
            tenant_id=tenant.public_id,
            date__gte=start,
            date__lte=today,
        )
        if status_filter:
            qs = qs.filter(status_group=status_filter)
        if endpoint_filter:
            qs = qs.filter(endpoint_group__startswith=endpoint_filter)

        if group_by == 'ip':
            rows = qs.values('ip_address').annotate(
                count=Sum('call_count'),
                error_count=Sum('error_count'),
            ).order_by('-count')
            data = [{'key': r['ip_address'] or 'unknown', 'count': r['count'] or 0, 'error_count': r['error_count'] or 0} for r in rows]
        elif group_by == 'endpoint':
            rows = qs.values('endpoint_group').annotate(
                count=Sum('call_count'),
                error_count=Sum('error_count'),
            ).order_by('-count')
            data = [{'key': r['endpoint_group'] or 'unknown', 'count': r['count'] or 0, 'error_count': r['error_count'] or 0} for r in rows]
        elif group_by == 'status':
            rows = qs.values('status_group').annotate(count=Sum('call_count')).order_by('-count')
            data = [{'key': r['status_group'], 'count': r['count'] or 0} for r in rows]
        elif group_by == 'hour':
            rows = qs.values('hour').annotate(
                count=Sum('call_count'),
                error_count=Sum('error_count'),
            ).order_by('hour')
            data = [{'key': r['hour'], 'count': r['count'] or 0, 'error_count': r['error_count'] or 0} for r in rows]

    return Response({
        'group_by': group_by,
        'data': data,
        'days': days,
        'start_date': start.isoformat(),
        'end_date': today.isoformat(),
    })


#: Hợp đồng **phẳng** — `{interval, data, days, start_date, end_date}`.
#: `SKIP_F5_SIBLINGS`, cùng lý do như `partner_api_usage` ở trên.
@extend_schema(
    responses={200: PartnerApiTimelineSerializer},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_api_timeline(request):
    """
    GET /partner/usage/api-calls/timeline/
    
    Query params:
      - interval: hour | day (default day)
      - days: 1-90 (default 7)
      - status: 2xx | 4xx | 5xx (filter)
    """
    require_pat_scopes_or_human_session(request, 'manage_tenant')
    _require_tenant_permission(request, 'usage:read')
    tenant = _get_request_tenant(request)

    interval = request.GET.get('interval', 'day')
    if interval not in {'hour', 'day'}:
        return Response({'detail': 'interval must be hour or day'}, status=400)

    try:
        days = max(1, min(int(request.GET.get('days', 7)), 90))
    except (TypeError, ValueError):
        days = 7

    status_filter = request.GET.get('status')

    from ops_audit.models import ApiCallRollup

    today = timezone.now().date()
    start = today - timedelta(days=days - 1)

    qs = ApiCallRollup.objects.filter(
        tenant_id=tenant.public_id,
        date__gte=start,
        date__lte=today,
    )
    if status_filter:
        qs = qs.filter(status_group=status_filter)

    if interval == 'day':
        rows = qs.values('date').annotate(
            total_calls=Sum('call_count'),
            success_count=Sum('call_count', filter=models.Q(status_group='2xx')),
            error_count=Sum('error_count'),
        ).order_by('date')
        data = [{'timestamp': r['date'].isoformat(), 'total_calls': r['total_calls'] or 0,
                 'success_count': r['success_count'] or 0, 'error_count': r['error_count'] or 0} for r in rows]
    else:
        rows = qs.values('date', 'hour').annotate(
            total_calls=Sum('call_count'),
            success_count=Sum('call_count', filter=models.Q(status_group='2xx')),
            error_count=Sum('error_count'),
        ).order_by('date', 'hour')
        data = [{'timestamp': f"{r['date']}T{r['hour']:02d}:00:00", 'total_calls': r['total_calls'] or 0,
                 'success_count': r['success_count'] or 0, 'error_count': r['error_count'] or 0} for r in rows]

    return Response({
        'interval': interval,
        'data': data,
        'days': days,
        'start_date': start.isoformat(),
        'end_date': today.isoformat(),
    })


#: **Không phải JSON**: `StreamingHttpResponse` với `content_type='text/csv'`
#: (`views_usage.py:251`). Không có envelope `{data, meta}` nào ở đây — mô tả
#: sai thành JSON sẽ khiến client `response.json()` ném lỗi.
#:
#: Key tuple `(200, 'text/csv')` là cách drf-spectacular đổi media type cho một
#: response (`AutoSchema._get_response_bodies` tách `code, media_types` khi code
#: là tuple).
@extend_schema(
    responses={(200, 'text/csv'): OpenApiTypes.STR},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTenantActive])
def partner_api_export(request):
    """
    GET /partner/usage/api-calls/export/?days=30&format=csv
    
    Streams CSV with columns: date, hour, ip_address, endpoint_group, status_group, call_count, error_count, total_duration_ms
    """
    require_pat_scopes_or_human_session(request, 'manage_tenant')
    _require_tenant_permission(request, 'usage:read')
    tenant = _get_request_tenant(request)

    try:
        days = max(1, min(int(request.GET.get('days', 30)), 90))
    except (TypeError, ValueError):
        days = 30

    fmt = request.GET.get('format', 'csv')
    if fmt != 'csv':
        return Response({'detail': 'Only format=csv supported'}, status=400)

    from ops_audit.models import ApiCallRollup

    today = timezone.now().date()
    start = today - timedelta(days=days - 1)

    qs = ApiCallRollup.objects.filter(
        tenant_id=tenant.public_id,
        date__gte=start,
        date__lte=today,
    ).order_by('date', 'hour', 'ip_address', 'endpoint_group', 'status_group')

    def row_iter():
        yield 'date,hour,ip_address,endpoint_group,status_group,call_count,error_count,total_duration_ms\n'
        for r in qs.iterator(chunk_size=1000):
            yield f"{r.date},{r.hour},{r.ip_address},{r.endpoint_group},{r.status_group},{r.call_count},{r.error_count},{r.total_duration_ms}\n"

    response = StreamingHttpResponse(row_iter(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="api_usage_{tenant.public_id}_{start}_{today}.csv"'
    return response