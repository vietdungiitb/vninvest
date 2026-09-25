from django.db.models import Avg, Count, Sum
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIUsageRecord, AIUsageSummary
from .serializers import AIUsageRecordSerializer, AIUsageSummarySerializer


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
        serializer = AIUsageRecordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
