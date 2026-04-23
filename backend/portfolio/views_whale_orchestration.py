import logging
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import WhaleServiceJob
from .serializers import WhaleServiceJobSerializer
from .whale_service_manager import WhaleJobManager
from .permissions import IsProPlan

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsProPlan])
def whale_service_trigger_api(request):
    """
    Trigger a whale service job (USER_REFRESH, BACKFILL, or GLOBAL_RECOMPUTE).
    """
    service_type = request.data.get('service_type')
    params = request.data.get('params', {})
    
    # 1. Validation & Permission Matrix
    allowed_types = [
        WhaleServiceJob.ServiceType.USER_REFRESH,
        WhaleServiceJob.ServiceType.BACKFILL,
        WhaleServiceJob.ServiceType.GLOBAL_RECOMPUTE
    ]
    if service_type not in allowed_types:
        return Response({"error": "Invalid service_type", "code": "invalid_type"}, status=status.HTTP_400_BAD_REQUEST)

    # Administrative tasks require staff permission
    if service_type in [WhaleServiceJob.ServiceType.BACKFILL, WhaleServiceJob.ServiceType.GLOBAL_RECOMPUTE]:
        if not request.user.is_staff:
            return Response({"error": "Staff permission required for this service type", "code": "admin_only"}, status=status.HTTP_403_FORBIDDEN)
            
    # USER_REFRESH requires symbol
    if service_type == WhaleServiceJob.ServiceType.USER_REFRESH:
        if not params.get('symbol'):
            return Response({"error": "Symbol is required for USER_REFRESH", "code": "missing_symbol"}, status=status.HTTP_400_BAD_REQUEST)
        # Standardize symbol
        params['symbol'] = str(params['symbol']).upper().strip()

    # Inject user_id into params
    params['user_id'] = request.user.id
    
    # 2. Get or create job (Idempotency layer)
    job, created, st = WhaleJobManager.get_or_create_job(service_type, params, created_by=request.user)
    
    # st can be: 'accepted', 'duplicate' (same idempotency), 'in_progress' (same lock)
    
    if st == 'duplicate':
        return Response({
            "status": "duplicate",
            "message": "An identical job is already pending or running.",
            "job": WhaleServiceJobSerializer(job).data if job else None
        }, status=status.HTTP_409_CONFLICT)

    if st == 'in_progress':
        return Response({
            "status": "in_progress",
            "message": "A job with the same scope is currently in progress.",
            "job": WhaleServiceJobSerializer(job).data if job else None
        }, status=status.HTTP_409_CONFLICT)
        
    # 3. Trigger Celery Task
    if created:
        from .tasks_whale_service import whale_service_job_task
        whale_service_job_task.delay(job.id)
    
    return Response({
        "status": "accepted",
        "message": "Job registered and queued successfully.",
        "job": WhaleServiceJobSerializer(job).data
    }, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def whale_service_jobs_list_api(request):
    """List recent whale service jobs."""
    queryset = WhaleServiceJob.objects.all()
    if not request.user.is_staff:
        queryset = queryset.filter(created_by=request.user)
    
    queryset = queryset.order_by('-created_at')[:50]
    serializer = WhaleServiceJobSerializer(queryset, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def whale_service_job_status_api(request, job_id):
    """Get status of a specific job."""
    try:
        job = WhaleServiceJob.objects.get(id=job_id)
    except WhaleServiceJob.DoesNotExist:
        return Response({"error": "Job not found"}, status=status.HTTP_404_NOT_FOUND)
        
    if not request.user.is_staff and job.created_by != request.user:
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
        
    serializer = WhaleServiceJobSerializer(job)
    return Response(serializer.data)
