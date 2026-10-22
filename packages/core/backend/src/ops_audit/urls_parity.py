"""
URL routing for Phase 3 Shadow Run parity monitoring endpoints.

Exposed endpoints:
- GET /core/v1/phase3/parity-status/ - Current phase status
- GET /core/v1/phase3/parity-report/ - Daily reports
- GET /core/v1/phase3/parity-logs/ - Raw logs
- POST /core/v1/phase3/phase-checkpoint/sign-off/ - Tech Lead sign-off
"""

from django.urls import path
from ops_audit.views_parity import (
    ParityStatusView,
    ParityReportListView,
    ParityLogListView,
    ParityPhaseCheckpointSignOffView,
)

app_name = 'ops_audit_parity'

urlpatterns = [
    # Phase 3 parity monitoring
    path(
        'phase3/parity-status/',
        ParityStatusView.as_view(),
        name='parity-status',
    ),
    path(
        'phase3/parity-report/',
        ParityReportListView.as_view(),
        name='parity-report-list',
    ),
    path(
        'phase3/parity-logs/',
        ParityLogListView.as_view(),
        name='parity-logs-list',
    ),
    path(
        'phase3/phase-checkpoint/sign-off/',
        ParityPhaseCheckpointSignOffView.as_view(),
        name='phase-checkpoint-sign-off',
    ),
]
