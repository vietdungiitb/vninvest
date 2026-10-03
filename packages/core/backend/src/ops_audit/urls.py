from django.urls import path

from . import views

urlpatterns = [
    # Operator audit logs (staff/superuser only)
    path('audit-log', views.AuditLogListView.as_view(), name='audit-log-list'),
    
    # Partner audit logs (tenant admin access)
    path('partner/audit-logs', views.PartnerAuditLogsView.as_view(), name='partner-audit-logs'),
    path('partner/audit-logs/', views.PartnerAuditLogsView.as_view(), name='partner-audit-logs-slash'),
]