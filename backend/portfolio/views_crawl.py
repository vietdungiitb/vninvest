# views_crawl.py
"""DRF viewsets for the Crawling Control Plane.
Provides admin‑only CRUD endpoints for CrawlJob, CrawlSchedule, CrawlRun,
and CrawlAuditLog models.
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .permissions import IsAdminPlan
from .models import CrawlJob, CrawlSchedule, CrawlRun, CrawlAuditLog
from .serializers import (
    CrawlJobSerializer,
    CrawlScheduleSerializer,
    CrawlRunSerializer,
    CrawlAuditLogSerializer,
)
from .tasks_crawl import run_crawl_job


class CrawlJobViewSet(viewsets.ModelViewSet):
    """Admin CRUD for CrawlJob."""
    queryset = CrawlJob.objects.all()
    serializer_class = CrawlJobSerializer
    permission_classes = [IsAuthenticated, IsAdminPlan]

    @action(detail=True, methods=['post'])
    def run(self, request, pk=None):
        job = self.get_object()
        if not job.is_active:
            return Response({'error': 'Job is inactive'}, status=400)
            
        run = CrawlRun.objects.create(
            job=job,
            status='queued',
            trigger_type='manual',
        )
        
        # Dispatch Celery task
        result = run_crawl_job.delay(run.id)
        run.task_id = result.id
        run.save(update_fields=['task_id'])
        
        return Response({'message': 'Job queued successfully', 'run_id': run.id, 'task_id': result.id})

    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        job = self.get_object()
        run = CrawlRun.objects.filter(job=job, status__in=['queued', 'running']).order_by('-created_at').first()
        
        if not run:
            return Response({'error': 'No active run found for this job'}, status=400)
            
        if run.task_id:
            from celery import current_app
            current_app.control.revoke(run.task_id, terminate=True)
            
        run.status = 'failed'
        run.log = (run.log + '\n\nForce stopped by admin').strip()
        run.finished_at = timezone.now()
        run.save(update_fields=['status', 'log', 'finished_at'])
        
        # Free lock explicitly using token to avoid erasing a newly acquired lock
        from .services_service_control import force_release_job_lock
        if run.task_id:
            force_release_job_lock(job.id, str(run.task_id))

        return Response({'message': 'Job stopped successfully'})


class CrawlScheduleViewSet(viewsets.ModelViewSet):
    """Admin CRUD for CrawlSchedule."""
    queryset = CrawlSchedule.objects.all()
    serializer_class = CrawlScheduleSerializer
    permission_classes = [IsAuthenticated, IsAdminPlan]


class CrawlRunViewSet(viewsets.ReadOnlyModelViewSet):
    """Read‑only view for CrawlRun logs."""
    queryset = CrawlRun.objects.all()
    serializer_class = CrawlRunSerializer
    permission_classes = [IsAuthenticated, IsAdminPlan]


class CrawlAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read‑only view for audit logs of crawl runs."""
    queryset = CrawlAuditLog.objects.all()
    serializer_class = CrawlAuditLogSerializer
    permission_classes = [IsAuthenticated, IsAdminPlan]
