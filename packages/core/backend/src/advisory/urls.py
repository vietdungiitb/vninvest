from django.urls import path

from . import views

urlpatterns = [
    path('advisory/latest/<str:symbol>/', views.AdvisoryLatestView.as_view(), name='advisory-latest'),
    path('advisory/refresh/<str:symbol>/', views.AdvisoryRefreshView.as_view(), name='advisory-refresh'),
    path('advisory/history/<str:symbol>/', views.AdvisoryHistoryView.as_view(), name='advisory-history'),
]
