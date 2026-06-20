from django.urls import path

from .views import (
    StaffSupportDashboardView,
    StaffTicketListView,
    StaffTicketPatchView,
    StaffTicketReplyView,
    TicketDetailView,
    TicketListCreateView,
    TicketReplyView,
    TicketReopenView,
)


urlpatterns = [
    path('tickets/', TicketListCreateView.as_view(), name='support-ticket-list-create'),
    path('tickets/<uuid:ticket_id>/', TicketDetailView.as_view(), name='support-ticket-detail'),
    path('tickets/<uuid:ticket_id>/reply/', TicketReplyView.as_view(), name='support-ticket-reply'),
    path('tickets/<uuid:ticket_id>/reopen/', TicketReopenView.as_view(), name='support-ticket-reopen'),
    path('staff/tickets/', StaffTicketListView.as_view(), name='support-staff-ticket-list'),
    path('staff/dashboard/', StaffSupportDashboardView.as_view(), name='support-staff-dashboard'),
    path('staff/tickets/<uuid:ticket_id>/', StaffTicketPatchView.as_view(), name='support-staff-ticket-patch'),
    path('staff/tickets/<uuid:ticket_id>/reply/', StaffTicketReplyView.as_view(), name='support-staff-ticket-reply'),
]
