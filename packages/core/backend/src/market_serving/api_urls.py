from django.urls import path

from . import views

urlpatterns = [
    path('market/symbol-snapshot/', views.SymbolSnapshotListView.as_view(), name='api-symbol-snapshot-list'),
    path('market/symbol-snapshot/<str:symbol>/', views.SymbolSnapshotDetailView.as_view(), name='api-symbol-snapshot-detail'),
    path('market/session-facts/', views.SessionFactsListView.as_view(), name='api-session-facts-list'),
    path('market/session-facts/<str:symbol>/', views.SessionFactsDetailView.as_view(), name='api-session-facts-detail'),
]