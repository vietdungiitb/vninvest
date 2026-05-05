"""
SFI-B3: Compat URL routes for signal_intelligence — maps /api/signals/* to native core-api views.
"""
from django.urls import path

from . import views

urlpatterns = [
    path('signals/unified-alert/', views.UnifiedAlertListView.as_view(), name='compat-unified-alert'),
    path('signals/whale-feed/', views.WhaleFeedAggregateView.as_view(), name='compat-whale-feed'),
    path('signals/order-flow/<str:symbol>/', views.OrderFlowEventListView.as_view(), name='compat-order-flow'),
]
