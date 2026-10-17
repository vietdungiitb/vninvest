from decimal import Decimal

from django.db.models import Avg, Count, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIUsageRecord, AIUsageSummary
from .serializers import AIUsageRecordSerializer, AIUsageSummarySerializer
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes, OpenApiParameter
from vninvest_core.api_envelope import envelope_response


def _scope_to_requester(queryset, request):
    """Hẹp queryset theo user, trừ staff/superuser thấy tất cả (R0.7)."""
    if not request.user.is_staff and not request.user.is_superuser:
        queryset = queryset.filter(user=request.user)
    return queryset


def _apply_common_filters(queryset, request):
    """R1.5: 1 helper lọc chung model/status/action cho cả 3 view."""
    action = request.query_params.get('action', '').strip()
    if action:
        queryset = queryset.filter(action=action)

    model_filter = request.query_params.get('model', '').strip()
    if model_filter:
        queryset = queryset.filter(model=model_filter)

    status_filter = request.query_params.get('status', '').strip()
    if status_filter:
        queryset = queryset.filter(status=status_filter)

    return queryset


def _parse_int(value, default, minimum=None, maximum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    if minimum is not None:
        number = max(number, minimum)
    if maximum is not None:
        number = min(number, maximum)
    return number



@extend_schema(
    summary='AIUsageRecordListView',
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
class AIUsageRecordListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _base_queryset(self, request):
        return _scope_to_requester(AIUsageRecord.objects.all(), request)

    def get(self, request):
        queryset = _apply_common_filters(self._base_queryset(request), request)

        days = request.query_params.get('days', '').strip()
        if days:
            try:
                cutoff = timezone.now() - timezone.timedelta(days=int(days))
                queryset = queryset.filter(created_at__gte=cutoff)
            except (TypeError, ValueError):
                pass

        user_id = request.query_params.get('user_id', '').strip()
        if user_id and (request.user.is_staff or request.user.is_superuser):
            queryset = queryset.filter(user_id=user_id)

        limit = _parse_int(request.query_params.get('limit', 20), 20, maximum=100)
        offset = _parse_int(request.query_params.get('offset', 0), 0, minimum=0)

        total = queryset.count()
        records = queryset[offset:offset + limit]
        serializer = AIUsageRecordSerializer(records, many=True)

        return Response({
            'results': serializer.data,
            'total': total,
            'limit': limit,
            'offset': offset,
        })

    def post(self, request):
        # R0.7 AC5: usage record do server tu ghi (instrument o task) —
        # cho user tu POST so lieu la duong bia du lieu (P0 audit Entry 228).
        return Response(
            {'detail': 'Ghi usage truc tiep da tat. So lieu do he thong tu ghi.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )


@extend_schema(
    summary='AIUsageSummaryView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AIUsageSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = _scope_to_requester(AIUsageSummary.objects.all(), request)

        days = request.query_params.get('days', '').strip()
        if days:
            try:
                cutoff = timezone.now().date() - timezone.timedelta(days=int(days))
                queryset = queryset.filter(date__gte=cutoff)
            except (TypeError, ValueError):
                pass

        queryset = _apply_common_filters(queryset, request)

        limit = _parse_int(request.query_params.get('limit', 20), 20, maximum=100)
        offset = _parse_int(request.query_params.get('offset', 0), 0, minimum=0)

        total = queryset.count()
        rows = queryset[offset:offset + limit]
        serializer = AIUsageSummarySerializer(rows, many=True)
        return Response({'results': serializer.data, 'total': total, 'limit': limit, 'offset': offset})


@extend_schema(
    summary='AIUsageSloView — p50/p95/p99 + success rate + token/$ theo model',
    description=(
        'R3.3. Percentile tính **trên DB** bằng window function '
        '`percentile_cont(...) OVER (ORDER BY latency_ms)` — không kéo bản ghi về '
        'Python. `pricing_complete=false` ⇒ cột `$` không đáng tin (bản ghi thiếu '
        'bảng giá). Không có bản ghi ⇒ `results=[]`, không trả số 0 giả.'
    ),
    parameters=[
        OpenApiParameter('days', OpenApiTypes.INT,
                         description='7 | 30 | 90 — mặc định 30'),
        OpenApiParameter('action', OpenApiTypes.STR),
        OpenApiParameter('model', OpenApiTypes.STR),
        OpenApiParameter('status', OpenApiTypes.STR),
    ],
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
    },
)
class AIUsageSloView(APIView):
    """GET /ai/usage/slo/ — chỉ số SLO LLM theo model (plan `:1085`).

    AC1: percentile **trên DB**. Có test chốt chặn (AC1b) đòi SQL có `OVER` —
    nếu sau này ai đó đổi sang kéo hết bản ghi về Python rồi tự tính, test đỏ.
    AC2: không có bản ghi ⇒ `results=[]`; `success_rate=None` thay vì `0`
    (FE hiện `—` chứ không hiện `0%`).
    AC3: `pricing_complete` = **mọi** bản ghi trong phạm vi đều `pricing_available`.
    """

    permission_classes = [permissions.IsAuthenticated]

    #: R3.3 AC5: chỉ 3 khoảng thời gian — bỏ giá trị lạ để UI và cache khớp nhau.
    ALLOWED_DAYS = (7, 30, 90)

    def get(self, request):
        from django.db.models import Count, F, Q, Sum

        from drf_spectacular.openapi import OpenApiParameter

        from .percentiles import PercentileCont

        days = _parse_int(request.query_params.get('days', ''), 30)
        if days not in self.ALLOWED_DAYS:
            days = 30

        queryset = _scope_to_requester(AIUsageRecord.objects.all(), request)
        queryset = _apply_common_filters(queryset, request)
        cutoff = timezone.now() - timezone.timedelta(days=days)
        queryset = queryset.filter(created_at__gte=cutoff)

        # AC1 — percentile **trên DB**. Xem `ai_analytics/percentiles.py`: Django
        # không có `PercentileCont` và Postgres không cho percentile dạng window,
        # nên dùng ordered-set aggregate (đúng construct của Postgres).
        rows = (
            queryset
            .values('model')
            .annotate(
                requests=Count('id'),
                successes=Count('id', filter=Q(status='success')),
                unpriced=Count('id', filter=Q(pricing_available=False)),
                p50_latency_ms=PercentileCont(0.50),
                p95_latency_ms=PercentileCont(0.95),
                p99_latency_ms=PercentileCont(0.99),
                tokens_in=Sum('tokens_in'),
                tokens_out=Sum('tokens_out'),
                cost_total=Sum('cost'),
            )
            .order_by('model')
        )

        results = []
        requests_total = 0
        for row in rows:
            requests = row['requests'] or 0
            requests_total += requests
            tokens_total = int(row['tokens_in'] or 0) + int(row['tokens_out'] or 0)
            cost_total = row['cost_total'] or Decimal('0')
            results.append({
                'model': row['model'],
                'requests': requests,
                # None (không phải 0) để FE hiện `—` — AC2.
                'success_rate': (
                    round((row['successes'] or 0) / requests, 4)
                    if requests else None
                ),
                'p50_latency_ms': _r3(row['p50_latency_ms']),
                'p95_latency_ms': _r3(row['p95_latency_ms']),
                'p99_latency_ms': _r3(row['p99_latency_ms']),
                'tokens_in': int(row['tokens_in'] or 0),
                'tokens_out': int(row['tokens_out'] or 0),
                'tokens_total': tokens_total,
                'tokens_per_day': round(tokens_total / days, 2),
                'cost_total': cost_total,
                'cost_per_day': (cost_total / days).quantize(
                    Decimal('0.000001')),
                # AC3: thiếu 1 bản ghi chưa có bảng giá ⇒ cột `$` không đáng tin.
                'pricing_complete': not row['unpriced'],
            })

        return Response({
            'results': results,
            'days': days,
            'requests_total': requests_total,
        })


def _r3(value):
    """Làm tròn 3 chữ số thập phân cho percentile (float từ DB)."""
    if value is None:
        return None
    return round(float(value), 3)


@extend_schema(
    summary='AIUsageAggregateView',
    description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
    responses={
        200: OpenApiTypes.OBJECT,
        400: OpenApiTypes.OBJECT,
        401: OpenApiTypes.OBJECT,
        403: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class AIUsageAggregateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = _scope_to_requester(AIUsageRecord.objects.all(), request)

        days = request.query_params.get('days', '').strip()
        if days:
            try:
                cutoff = timezone.now() - timezone.timedelta(days=int(days))
                queryset = queryset.filter(created_at__gte=cutoff)
            except (TypeError, ValueError):
                pass

        queryset = _apply_common_filters(queryset, request)

        pipeline = queryset.aggregate(
            total_requests=Count('id'),
            total_tokens_in=Sum('tokens_in'),
            total_tokens_out=Sum('tokens_out'),
            total_cost=Sum('cost'),
            avg_latency=Avg('latency_ms'),
        )
        return Response(pipeline)
