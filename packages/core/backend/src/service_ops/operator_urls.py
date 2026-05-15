"""Canonical operator scraping routes backed by service_ops matrix views."""

from django.urls import path

from .views import matrix

app_name = 'operator_scraping'

urlpatterns = [
    path('matrix/cycles/', matrix.MatrixCycleListView.as_view(), name='matrix_cycle_list'),
    path('matrix/cycles/start/', matrix.MatrixCycleStartView.as_view(), name='matrix_cycle_start'),
    path('matrix/cycles/<str:cycle_id>/', matrix.MatrixCycleDetailView.as_view(), name='matrix_cycle_detail'),
    path('matrix/cycles/<str:cycle_id>/cells/', matrix.MatrixCellListView.as_view(), name='matrix_cell_list'),
    path('matrix/cycles/<str:cycle_id>/abort/', matrix.MatrixCycleAbortView.as_view(), name='matrix_cycle_abort'),
    path('matrix/providers/', matrix.MatrixProvidersView.as_view(), name='matrix_providers'),
    path('matrix/monitor/', matrix.MatrixMonitorView.as_view(), name='matrix_monitor'),
]
