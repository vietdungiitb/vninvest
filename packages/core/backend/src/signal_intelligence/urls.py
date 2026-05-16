from django.urls import path

from . import views

urlpatterns = [
    path('unified-alert', views.UnifiedAlertListView.as_view(), name='unified-alert-list'),
    path('unified-alert/delivery', views.UserUnifiedAlertDeliveryView.as_view(), name='unified-alert-delivery'),
    path('whale-feed', views.WhaleFeedAggregateView.as_view(), name='whale-feed-list'),
    path('signals/order-flow/<str:symbol>/', views.OrderFlowEventListView.as_view(), name='order-flow-list'),
]
