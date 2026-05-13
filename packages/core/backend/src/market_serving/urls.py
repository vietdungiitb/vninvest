from django.urls import path

from . import views

urlpatterns = [
    path('symbol-snapshot', views.SymbolSnapshotListView.as_view(), name='symbol-snapshot-list'),
    path('symbol-snapshot/<str:symbol>', views.SymbolSnapshotDetailView.as_view(), name='symbol-snapshot-detail'),
    path('session-facts', views.SessionFactsListView.as_view(), name='session-facts-list'),
    path('session-facts/<str:symbol>/cvd', views.SessionFactsCvdView.as_view(), name='session-facts-cvd'),
    path('session-facts/<str:symbol>', views.SessionFactsDetailView.as_view(), name='session-facts-detail'),
]
