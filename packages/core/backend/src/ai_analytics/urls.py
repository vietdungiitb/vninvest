from django.urls import path

from . import views

urlpatterns = [
    path('ai/usage/', views.AIUsageRecordListView.as_view(), name='ai-usage-list'),
    path('ai/usage/summary/', views.AIUsageSummaryView.as_view(), name='ai-usage-summary'),
    path('ai/usage/aggregate/', views.AIUsageAggregateView.as_view(), name='ai-usage-aggregate'),
    # R3.3: SLO p50/p95/p99 + success rate + token/$ theo model.
    path('ai/usage/slo/', views.AIUsageSloView.as_view(), name='ai-usage-slo'),
]
