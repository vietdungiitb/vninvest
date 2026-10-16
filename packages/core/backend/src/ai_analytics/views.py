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
        queryset = AIUsageRecord.objects.all()
        if not request.user.is_staff and not request.user.is_superuser:
            queryset = queryset.filter(user=request.user)
        return queryset

    def get(self, request):
        queryset = self._base_queryset(request)

        action = request.query_params.get('action', '').strip()
        if action:
            queryset = queryset.filter(action=action)

        # F2: server-side model / status filters
        model_filter = request.query_params.get('model', '').strip()
        if model_filter:
            queryset = queryset.filter(model=model_filter)

        status_filter = request.query_params.get('status', '').strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

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

        try:
            limit = min(int(request.query_params.get('limit', 20)), 100)
        except (TypeError, ValueError):
            limit = 20
        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (TypeError, ValueError):
            offset = 0

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
        queryset = AIUsageSummary.objects.all()
        if not request.user.is_staff and not request.user.is_superuser:
            queryset = queryset.filter(user=request.user)

        days = request.query_params.get('days', '').strip()
        if days:
            try:
                cutoff = timezone.now().date() - timezone.timedelta(days=int(days))
                queryset = queryset.filter(date__gte=cutoff)
            except (TypeError, ValueError):
                pass

        action = request.query_params.get('action', '').strip()
        if action:
            queryset = queryset.filter(action=action)

        serializer = AIUsageSummarySerializer(queryset, many=True)
        return Response({'results': serializer.data})


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
        queryset = AIUsageRecord.objects.all()
        if not request.user.is_staff and not request.user.is_superuser:
            queryset = queryset.filter(user=request.user)

        days = request.query_params.get('days', '').strip()
        if days:
            try:
                cutoff = timezone.now() - timezone.timedelta(days=int(days))
                queryset = queryset.filter(created_at__gte=cutoff)
            except (TypeError, ValueError):
                pass

        pipeline = queryset.aggregate(
            total_requests=Count('id'),
            total_tokens_in=Sum('tokens_in'),
            total_tokens_out=Sum('tokens_out'),
            total_cost=Sum('cost'),
            avg_latency=Avg('latency_ms'),
        )
        return Response(pipeline)
