from django.urls import path

from . import views

urlpatterns = [
    path('signals/unified-alert/', views.UnifiedAlertListView.as_view(), name='api-unified-alert'),
    path('signals/unified-alert/delivery/', views.UserUnifiedAlertDeliveryView.as_view(), name='api-unified-alert-delivery'),
    path('signals/whale-feed/', views.WhaleFeedAggregateView.as_view(), name='api-whale-feed'),
    path('signals/order-flow/<str:symbol>/', views.OrderFlowEventListView.as_view(), name='api-order-flow'),
]