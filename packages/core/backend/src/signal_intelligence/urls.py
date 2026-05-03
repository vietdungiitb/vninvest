from django.urls import path

from . import views

urlpatterns = [
    path('unified-alert', views.UnifiedAlertListView.as_view(), name='unified-alert-list'),
    path('whale-feed', views.WhaleFeedAggregateView.as_view(), name='whale-feed-list'),
]
