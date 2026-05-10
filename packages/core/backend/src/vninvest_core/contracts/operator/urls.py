from django.urls import path

from .views import OperatorHealthView, OperatorOverviewView

app_name = 'operator'

urlpatterns = [
    path('overview/', OperatorOverviewView.as_view(), name='overview'),
    path('health/', OperatorHealthView.as_view(), name='health'),
]