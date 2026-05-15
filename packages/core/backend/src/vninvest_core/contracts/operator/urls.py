from django.urls import include, path

from .views import OperatorHealthView, OperatorOverviewView

app_name = 'operator'

urlpatterns = [
    path('overview/', OperatorOverviewView.as_view(), name='overview'),
    path('health/', OperatorHealthView.as_view(), name='health'),
    path('scraping/', include(('service_ops.operator_urls', 'operator_scraping'), namespace='scraping')),
]