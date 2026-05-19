"""Canonical operator scraping routes backed by service_ops control-plane views."""

from django.urls import path

from .views import dataops, matrix, scheduler

app_name = 'operator_scraping'

urlpatterns = [
    # === Scheduler Control Center ===
    path('dataops/scheduler/plan/', scheduler.SchedulerPlanView.as_view(), name='scheduler_plan'),
    path('dataops/scheduler/health/', scheduler.SchedulerHealthView.as_view(), name='scheduler_health'),
    path('dataops/scheduler/jobs/<str:job_key>/history/', scheduler.SchedulerJobHistoryView.as_view(), name='scheduler_job_history'),
    path('dataops/scheduler/jobs/<str:job_key>/actions/', scheduler.SchedulerJobActionView.as_view(), name='scheduler_job_actions'),

    path('matrix/cycles/', matrix.MatrixCycleListView.as_view(), name='matrix_cycle_list'),
    path('matrix/cycles/start/', matrix.MatrixCycleStartView.as_view(), name='matrix_cycle_start'),
    path('matrix/cycles/<str:cycle_id>/', matrix.MatrixCycleDetailView.as_view(), name='matrix_cycle_detail'),
    path('matrix/cycles/<str:cycle_id>/cells/', matrix.MatrixCellListView.as_view(), name='matrix_cell_list'),
    path('matrix/cycles/<str:cycle_id>/abort/', matrix.MatrixCycleAbortView.as_view(), name='matrix_cycle_abort'),
    path('matrix/providers/', matrix.MatrixProvidersView.as_view(), name='matrix_providers'),
    path('matrix/monitor/', matrix.MatrixMonitorView.as_view(), name='matrix_monitor'),
    path('dataops/coverage/', dataops.DataOpsCoverageView.as_view(), name='dataops_coverage'),
    path('dataops/registry/summary/', dataops.DataOpsRegistrySummaryView.as_view(), name='dataops_registry_summary'),
    path('dataops/registry/reconcile-preview/', dataops.DataOpsRegistryReconcilePreviewView.as_view(), name='dataops_registry_reconcile_preview'),
    path('dataops/registry/<str:symbol>/', dataops.DataOpsRegistryDetailView.as_view(), name='dataops_registry_detail'),
    path('dataops/run-logs/', dataops.DataOpsRunLogsView.as_view(), name='dataops_run_logs'),
    path('dataops/run-logs/purge/', dataops.DataOpsRunLogsPurgeView.as_view(), name='dataops_run_logs_purge'),
    path('dataops/planner/preview/', dataops.DataOpsPlannerPreviewView.as_view(), name='dataops_planner_preview'),
    path('dataops/planner/run/', dataops.DataOpsPlannerRunView.as_view(), name='dataops_planner_run'),
    path('dataops/planner/run/<str:run_id>/abort/', dataops.DataOpsPlannerRunAbortView.as_view(), name='dataops_planner_run_abort'),
    path('dataops/queue-tiers/', dataops.DataOpsQueueTiersView.as_view(), name='dataops_queue_tiers'),
    path('dataops/observability/', dataops.DataOpsObservabilityView.as_view(), name='dataops_observability'),
    path('dataops/runtime-config/', dataops.DataOpsRuntimeConfigView.as_view(), name='dataops_runtime_config'),
    # === B03 — Backfill Progress API ===
    path('dataops/backfill/runs/', dataops.BackfillRunListView.as_view(), name='backfill_run_list'),
    path('dataops/backfill/runs/<str:run_id>/', dataops.BackfillRunDetailView.as_view(), name='backfill_run_detail'),
    path('dataops/backfill/run-now/', dataops.BackfillRunNowView.as_view(), name='backfill_run_now'),
]
