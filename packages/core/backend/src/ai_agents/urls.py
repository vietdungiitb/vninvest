from django.urls import path

from . import views

urlpatterns = [
    path('ai/agents/', views.AgentRegistryListView.as_view(), name='ai-agents-list'),
    path('ai/agents/<int:pk>/', views.AgentRegistryDetailView.as_view(), name='ai-agents-detail'),
]
