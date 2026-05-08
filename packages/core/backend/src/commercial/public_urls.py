from django.urls import path

from . import views

urlpatterns = [
    path('public/legal-pages/', views.PublicLegalPagesView.as_view(), name='public-legal-pages'),
]