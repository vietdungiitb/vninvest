from django.urls import path

from . import views

urlpatterns = [
    path('ai/usage/', views.AIUsageRecordListView.as_view(), name='ai-usage-list'),
    path('ai/usage/summary/', views.AIUsageSummaryView.as_view(), name='ai-usage-summary'),
    path('ai/usage/aggregate/', views.AIUsageAggregateView.as_view(), name='ai-usage-aggregate'),
]
