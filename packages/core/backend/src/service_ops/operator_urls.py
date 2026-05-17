"""Canonical operator scraping routes backed by service_ops control-plane views."""

from django.urls import path

from .views import dataops, matrix

app_name = 'operator_scraping'

urlpatterns = [
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
    path('dataops/planner/preview/', dataops.DataOpsPlannerPreviewView.as_view(), name='dataops_planner_preview'),
    path('dataops/planner/run/', dataops.DataOpsPlannerRunView.as_view(), name='dataops_planner_run'),
    path('dataops/planner/run/<str:run_id>/abort/', dataops.DataOpsPlannerRunAbortView.as_view(), name='dataops_planner_run_abort'),
    path('dataops/queue-tiers/', dataops.DataOpsQueueTiersView.as_view(), name='dataops_queue_tiers'),
    path('dataops/runtime-config/', dataops.DataOpsRuntimeConfigView.as_view(), name='dataops_runtime_config'),
]
