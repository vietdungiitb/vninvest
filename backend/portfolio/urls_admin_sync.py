from django.urls import path

from . import views

app_name = 'portfolio_admin_sync'

urlpatterns = [
    path('stockprofile/', views.sync_stockprofile_api, name='stockprofile-sync'),
]