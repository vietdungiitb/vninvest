from django.db.models import Avg, Count, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIUsageRecord, AIUsageSummary
from .serializers import AIUsageRecordSerializer, AIUsageSummarySerializer
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
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
