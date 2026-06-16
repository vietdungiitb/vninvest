from django.urls import path
from advertising import views

urlpatterns = [
    path('v1/content/display/', views.ContentDisplayView.as_view(), name='api-content-display'),
    path('v1/metrics/log/view/', views.MetricsLogViewView.as_view(), name='api-metrics-log-view'),
    path('v1/metrics/log/click/<uuid:campaign_id>/', views.MetricsLogClickView.as_view(), name='api-metrics-log-click'),
]
