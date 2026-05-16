from django.urls import path

from . import views

urlpatterns = [
    path('signals/alert-center/feed/', views.AlertCenterFeedView.as_view(), name='api-alert-center-feed'),
    path('signals/alert-center/summary/', views.AlertCenterSummaryView.as_view(), name='api-alert-center-summary'),
    path('signals/alert-center/events/<uuid:alert_id>/', views.AlertCenterEventDetailView.as_view(), name='api-alert-center-event-detail'),
    path('signals/alert-center/events/<uuid:alert_id>/ack/', views.AlertCenterAcknowledgeView.as_view(), name='api-alert-center-event-ack'),
    path('signals/alert-center/symbols/<str:symbol>/context/', views.AlertCenterSymbolContextView.as_view(), name='api-alert-center-symbol-context'),
    path('signals/alert-center/preferences/mute/', views.AlertCenterMutePreferenceView.as_view(), name='api-alert-center-preferences-mute'),
    path('signals/ai-alerts/feed/', views.AIAlertsFeedView.as_view(), name='api-ai-alerts-feed'),
    path('signals/ai-alerts/summary/', views.AIAlertsSummaryView.as_view(), name='api-ai-alerts-summary'),
    path('signals/whale-feed/', views.WhaleFeedAggregateView.as_view(), name='api-whale-feed'),
    path('signals/order-flow/<str:symbol>/', views.OrderFlowEventListView.as_view(), name='api-order-flow'),
]