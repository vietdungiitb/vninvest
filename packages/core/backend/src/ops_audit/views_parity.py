"""
Views for Phase 3 Shadow Run parity monitoring.

Endpoints:
- GET /api/phase3/parity-status/ - Current phase status + 3-day progress
- GET /api/phase3/parity-report/:endpoint/ - Daily reports for endpoint
- GET /api/phase3/parity-logs/:endpoint/ - Raw parity logs for endpoint
- POST /api/phase3/phase-checkpoint/sign-off/ - Tech Lead sign-off (admin only)
"""

from django.db.models import Avg
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from ops_audit.envelope import envelope
from ops_audit.models import (
    ParityLog,
    ParityPhaseCheckpoint,
    ParityReport,
)
from ops_audit.serializers import (
    ParityLogSerializer,
    ParityPhaseCheckpointSerializer,
    ParityReportSerializer,
)


class ParityStatusView(generics.RetrieveAPIView):
    """
    Current Phase 3 status + 3-day progress overview.
    
    GET /api/phase3/parity-status/
    
    Returns:
        {
            'phase_status': 'day1' | 'day2' | 'day3' | ...,
            'day1': {'date': ..., 'parity_score': ..., 'status': ...},
            'day2': {...},
            'day3': {...},
            'endpoints_monitored': [...],
            'critical_failures': {...},
            'recommendation': 'green' | 'yellow' | 'red',
        }
    """
    
    def get(self, request):
        try:
            checkpoint = ParityPhaseCheckpoint.objects.filter(
                phase_name='Phase 3'
            ).latest('created_at')
        except ParityPhaseCheckpoint.DoesNotExist:
            return envelope({
                'phase_status': 'not_started',
                'message': 'Phase 3 shadow run not started yet',
            }, status=status.HTTP_200_OK)
        
        # Collect day results
        day1_result = None
        if checkpoint.day1_date:
            reports = ParityReport.objects.filter(report_date=checkpoint.day1_date)
            avg_score = reports.aggregate(Avg('avg_parity_score'))['avg_parity_score__avg'] or 0.0
            green_count = reports.filter(recommendation='green').count()
            day1_result = {
                'date': str(checkpoint.day1_date),
                'parity_score': avg_score,
                'endpoints_green': green_count,
                'endpoints_total': reports.count(),
                'status': 'pass' if avg_score >= 0.99 else 'fail',
            }
        
        day2_result = None
        if checkpoint.day2_date:
            reports = ParityReport.objects.filter(report_date=checkpoint.day2_date)
            avg_score = reports.aggregate(Avg('avg_parity_score'))['avg_parity_score__avg'] or 0.0
            green_count = reports.filter(recommendation='green').count()
            day2_result = {
                'date': str(checkpoint.day2_date),
                'parity_score': avg_score,
                'endpoints_green': green_count,
                'endpoints_total': reports.count(),
                'status': 'pass' if avg_score >= 0.99 else 'fail',
            }
        
        day3_result = None
        if checkpoint.day3_date:
            reports = ParityReport.objects.filter(report_date=checkpoint.day3_date)
            avg_score = reports.aggregate(Avg('avg_parity_score'))['avg_parity_score__avg'] or 0.0
            green_count = reports.filter(recommendation='green').count()
            day3_result = {
                'date': str(checkpoint.day3_date),
                'parity_score': avg_score,
                'endpoints_green': green_count,
                'endpoints_total': reports.count(),
                'status': 'pass' if avg_score >= 0.99 else 'fail',
            }
        
        # Get monitored endpoints
        all_endpoints = ParityLog.objects.values_list('endpoint', flat=True).distinct()
        
        return envelope({
            'phase_status': checkpoint.phase_status,
            'day1': day1_result,
            'day2': day2_result,
            'day3': day3_result,
            'endpoints_monitored': list(all_endpoints),
            'all_days_complete': checkpoint.all_days_complete,
            'all_days_pass': checkpoint.all_days_pass,
            'final_decision': checkpoint.final_decision,
            'tech_lead_sign_off': checkpoint.tech_lead_sign_off,
            'summary': checkpoint.summary,
        }, status=status.HTTP_200_OK)


class ParityReportListView(generics.ListAPIView):
    """
    List daily parity reports for a specific endpoint.
    
    GET /api/phase3/parity-report/?endpoint=/api/portfolios/
    
    Query params:
        endpoint: API endpoint to filter by
        date_from: Start date (YYYY-MM-DD)
        date_to: End date (YYYY-MM-DD)
    
    Returns:
        [{
            'endpoint': '...',
            'report_date': '...',
            'total_requests': N,
            'match_count': N,
            'avg_parity_score': 0.99,
            'recommendation': 'green',
            'status': 'complete',
        }]
    """
    
    queryset = ParityReport.objects.all()
    serializer_class = ParityReportSerializer
    
    def get_queryset(self):
        endpoint = self.request.query_params.get('endpoint')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        qs = super().get_queryset()
        
        if endpoint:
            qs = qs.filter(endpoint=endpoint)
        
        if date_from:
            qs = qs.filter(report_date__gte=date_from)
        
        if date_to:
            qs = qs.filter(report_date__lte=date_to)
        
        return qs.order_by('-report_date')


class ParityLogListView(generics.ListAPIView):
    """
    List raw parity logs for a specific endpoint.
    
    GET /api/phase3/parity-logs/?endpoint=/api/portfolios/
    
    Query params:
        endpoint: API endpoint to filter by
        parity_status: 'match' | 'warning' | 'mismatch' | 'error'
        x_request_id: Filter by specific request ID
    
    Returns:
        [{
            'x_request_id': '...',
            'endpoint': '...',
            'parity_status': 'match',
            'parity_score': 0.99,
            'legacy_status': 200,
            'core_status': 200,
            'created_at': '...',
        }]
    """
    
    queryset = ParityLog.objects.all()
    serializer_class = ParityLogSerializer
    
    def get_queryset(self):
        endpoint = self.request.query_params.get('endpoint')
        parity_status = self.request.query_params.get('parity_status')
        x_request_id = self.request.query_params.get('x_request_id')
        
        qs = super().get_queryset()
        
        if endpoint:
            qs = qs.filter(endpoint=endpoint)
        
        if parity_status:
            qs = qs.filter(parity_status=parity_status)
        
        if x_request_id:
            qs = qs.filter(x_request_id=x_request_id)
        
        return qs.order_by('-created_at')


class ParityPhaseCheckpointSignOffView(generics.UpdateAPIView):
    """
    Tech Lead sign-off for Phase 3 completion and Phase 4 cutover approval.
    
    POST /api/phase3/phase-checkpoint/sign-off/
    
    Body:
        {
            'tech_lead_name': 'Name',
            'approved': true,
            'notes': 'All metrics GREEN, ready for Phase 4'
        }
    
    Returns:
        {
            'phase_status': 'complete',
            'final_decision': 'green',
            'tech_lead_sign_off': true,
            'sign_off_date': '...',
        }
    
    Permission: IsAdminUser (Tech Lead only)
    """
    
    queryset = ParityPhaseCheckpoint.objects.all()
    serializer_class = ParityPhaseCheckpointSerializer
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['post'])
    def sign_off(self, request):
        """Handle sign-off approval"""
        
        approved = request.data.get('approved', False)
        tech_lead_name = request.data.get('tech_lead_name', request.user.username)
        notes = request.data.get('notes', '')
        
        try:
            checkpoint = ParityPhaseCheckpoint.objects.filter(
                phase_name='Phase 3'
            ).latest('created_at')
        except ParityPhaseCheckpoint.DoesNotExist:
            return Response({
                'error': 'Phase 3 checkpoint not found',
            }, status=status.HTTP_404_NOT_FOUND)
        
        if not checkpoint.all_days_complete:
            return Response({
                'error': 'All 3 days must be complete before sign-off',
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if approved:
            if not checkpoint.all_days_pass:
                return Response({
                    'error': 'All 3 days must have parity >= 99% to approve',
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Mark as approved
            checkpoint.final_decision = 'green'
            checkpoint.phase_status = 'complete'
            checkpoint.tech_lead_sign_off = True
            checkpoint.sign_off_by = tech_lead_name
            checkpoint.sign_off_date = timezone.now()
            checkpoint.summary = notes
            checkpoint.save()
            
            return envelope({
                'status': 'approved',
                'phase_status': checkpoint.phase_status,
                'final_decision': checkpoint.final_decision,
                'tech_lead_sign_off': True,
                'sign_off_date': checkpoint.sign_off_date,
                'message': 'Phase 3 approved. Phase 4 cutover ready to proceed.',
            }, status=status.HTTP_200_OK)
        else:
            # Reject
            checkpoint.final_decision = 'red'
            checkpoint.phase_status = 'review'
            checkpoint.summary = notes
            checkpoint.save()
            
            return envelope({
                'status': 'rejected',
                'phase_status': checkpoint.phase_status,
                'message': 'Phase 3 rejected. Investigation required before retry.',
            }, status=status.HTTP_200_OK)
