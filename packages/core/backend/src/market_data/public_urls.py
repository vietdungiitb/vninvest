from django.urls import path

from . import views

urlpatterns = [
    path('stock-management/tracked-symbols/', views.TrackedSymbolsView.as_view(), name='tracked-symbols'),
]