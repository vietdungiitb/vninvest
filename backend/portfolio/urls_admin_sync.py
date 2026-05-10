from django.urls import path

from . import views
from .views_admin_sync import sync_stock_profiles_from_snapshot_api

app_name = 'portfolio_admin_sync'

urlpatterns = [
    path('stockprofile/', views.sync_stockprofile_api, name='stockprofile-sync'),
    path('stockprofile/sync-snapshot/', sync_stock_profiles_from_snapshot_api, name='stockprofile-sync-snapshot'),
]
