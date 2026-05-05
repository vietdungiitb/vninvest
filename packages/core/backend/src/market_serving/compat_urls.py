"""
SFI-B3: Compat URL routes for market_serving — maps /api/market/* to native core-api views.

These routes are registered BEFORE the legacy proxy, so requests matching here
are served natively by core-api without touching the legacy backend.
"""
from django.urls import path

from . import views

urlpatterns = [
    # /api/market/symbol-snapshot/  →  market_serving SymbolSnapshotListView
    path('market/symbol-snapshot/', views.SymbolSnapshotListView.as_view(), name='compat-symbol-snapshot-list'),
    path('market/symbol-snapshot/<str:symbol>/', views.SymbolSnapshotDetailView.as_view(), name='compat-symbol-snapshot-detail'),
    # /api/market/session-facts/  →  market_serving SessionFactsListView
    path('market/session-facts/', views.SessionFactsListView.as_view(), name='compat-session-facts-list'),
    path('market/session-facts/<str:symbol>/', views.SessionFactsDetailView.as_view(), name='compat-session-facts-detail'),
]
