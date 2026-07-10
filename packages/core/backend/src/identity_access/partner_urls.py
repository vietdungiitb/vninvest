"""
Partner namespace URL routes — tenant self-admin operations.

All routes under /core/v1/partner/* serve the authenticated tenant owner:
- tenant summary, service accounts, PATs, usage meters, billing data.

These paths mirror the frontend api/client.js partner/* calls.
"""
from django.urls import path

from . import views_dashboard
from . import views_alert_config
from . import views_forecast
from . import views_usage_trend
from . import views_reports
from . import views_security
from . import views_webhooks
from . import views_tenant as views
from .commercial_partner_views import (
    PartnerBillingInvoicesView,
    PartnerBillingSubscriptionView,
    PartnerCostTrendView,
    PartnerUsageHistoryView,
    PartnerUsageMetersView,
    PartnerUsageQuotasView,
    PartnerStripeCheckoutSessionView,
    PartnerStripePortalSessionView,
)
from .views.sso import PartnerSSOConfigView

urlpatterns = [
    # Tenant summary
    path('partner/tenant/', views.TenantDetailView.as_view(), name='partner-tenant'),
    path('partner/tenant', views.TenantDetailView.as_view(), name='partner-tenant-noslash'),

    # Service accounts
    path('partner/service-accounts/', views.ServiceAccountListView.as_view(), name='partner-sa-list'),
    path('partner/service-accounts', views.ServiceAccountListView.as_view(), name='partner-sa-list-noslash'),

    # PATs
    path('partner/pats/', views.PATListView.as_view(), name='partner-pat-list'),
    path('partner/pats', views.PATListView.as_view(), name='partner-pat-list-noslash'),
    path('partner/pats/issue/', views.partner_issue_pat, name='partner-pat-issue'),
    path('partner/pats/issue', views.partner_issue_pat, name='partner-pat-issue-noslash'),
    path('partner/pats/<str:pat_id>/rotate/', views.partner_rotate_pat, name='partner-pat-rotate'),
    path('partner/pats/<str:pat_id>/revoke/', views.partner_revoke_pat, name='partner-pat-revoke'),

    # SSO Configuration
    path('partner/sso/', PartnerSSOConfigView.as_view(), name='partner-sso-config'),
    path('partner/sso', PartnerSSOConfigView.as_view(), name='partner-sso-config-noslash'),

    # Usage
    path('partner/usage/meters/', PartnerUsageMetersView.as_view(), name='partner-usage-meters'),
    path('partner/usage/meters', PartnerUsageMetersView.as_view(), name='partner-usage-meters-noslash'),
    path('partner/usage/quotas/', PartnerUsageQuotasView.as_view(), name='partner-usage-quotas'),
    path('partner/usage/quotas', PartnerUsageQuotasView.as_view(), name='partner-usage-quotas-noslash'),
    path('partner/usage/history/', PartnerUsageHistoryView.as_view(), name='partner-usage-history'),
    path('partner/usage/history', PartnerUsageHistoryView.as_view(), name='partner-usage-history-noslash'),

    # Billing (delegates to commercial app)
    path('partner/billing/subscription/', PartnerBillingSubscriptionView.as_view(), name='partner-billing-sub'),
    path('partner/billing/subscription', PartnerBillingSubscriptionView.as_view(), name='partner-billing-sub-noslash'),
    path('partner/billing/invoices/', PartnerBillingInvoicesView.as_view(), name='partner-billing-invoices'),
    path('partner/billing/invoices', PartnerBillingInvoicesView.as_view(), name='partner-billing-invoices-noslash'),

    # Dashboard (Phase 0 — Tenant Admin Upgrade)
    path('partner/dashboard/summary/', views_dashboard.partner_dashboard_summary, name='partner-dashboard-summary'),
    path('partner/dashboard/summary', views_dashboard.partner_dashboard_summary, name='partner-dashboard-summary-noslash'),
    path('partner/dashboard/usage-trend/', views_dashboard.partner_dashboard_usage_trend, name='partner-dashboard-usage-trend'),
    path('partner/dashboard/usage-trend', views_dashboard.partner_dashboard_usage_trend, name='partner-dashboard-usage-trend-noslash'),

    # Alert Config (Phase 1 — Monitoring & Activity)
    path('partner/usage/alert-config/', views_alert_config.partner_usage_alert_config_list, name='partner-alert-config-list'),
    path('partner/usage/alert-config', views_alert_config.partner_usage_alert_config_list, name='partner-alert-config-list-noslash'),
    path('partner/usage/alert-config/<str:meter_code>/', views_alert_config.partner_usage_alert_config_detail, name='partner-alert-config-detail'),
    path('partner/usage/alert-config/<str:meter_code>', views_alert_config.partner_usage_alert_config_detail, name='partner-alert-config-detail-noslash'),

    # Usage Forecast (Phase 1/2 — Analytics & Forecasting)
    path('partner/usage/forecast/', views_forecast.partner_usage_forecast, name='partner-usage-forecast'),
    path('partner/usage/forecast', views_forecast.partner_usage_forecast, name='partner-usage-forecast-noslash'),
    path('partner/usage/forecast/<str:meter_code>/', views_forecast.partner_usage_forecast_detail, name='partner-usage-forecast-detail'),
    path('partner/usage/forecast/<str:meter_code>', views_forecast.partner_usage_forecast_detail, name='partner-usage-forecast-detail-noslash'),

    # Per-Meter Usage Trend (Phase 1 — Monitoring & Activity)
    path('partner/usage/trend/', views_usage_trend.partner_usage_trend_all, name='partner-usage-trend-all'),
    path('partner/usage/trend', views_usage_trend.partner_usage_trend_all, name='partner-usage-trend-all-noslash'),
    path('partner/usage/trend/<str:meter_code>/', views_usage_trend.partner_usage_trend, name='partner-usage-trend-meter'),
    path('partner/usage/trend/<str:meter_code>', views_usage_trend.partner_usage_trend, name='partner-usage-trend-meter-noslash'),

    # Cost Analytics (Phase 2)
    path('partner/billing/cost-trend/', PartnerCostTrendView.as_view(), name='partner-cost-trend'),
    path('partner/billing/cost-trend', PartnerCostTrendView.as_view(), name='partner-cost-trend-noslash'),

    # Scheduled Reports (Phase 2)
    path('partner/reports/', views_reports.ScheduledReportListCreateView.as_view(), name='partner-report-list'),
    path('partner/reports', views_reports.ScheduledReportListCreateView.as_view(), name='partner-report-list-noslash'),
    path('partner/reports/<int:report_id>/', views_reports.ScheduledReportDetailView.as_view(), name='partner-report-detail'),
    path('partner/reports/<int:report_id>', views_reports.ScheduledReportDetailView.as_view(), name='partner-report-detail-noslash'),
    path('partner/reports/<int:report_id>/test/', views_reports.ScheduledReportTestView.as_view(), name='partner-report-test'),
    path('partner/reports/<int:report_id>/test', views_reports.ScheduledReportTestView.as_view(), name='partner-report-test-noslash'),
    path('partner/reports/delivery-log/', views_reports.ReportDeliveryLogView.as_view(), name='partner-report-delivery-log'),
    path('partner/reports/delivery-log', views_reports.ReportDeliveryLogView.as_view(), name='partner-report-delivery-log-noslash'),

    # Stripe Billing
    path('partner/billing/stripe/session/', PartnerStripeCheckoutSessionView.as_view(), name='partner-stripe-checkout-session'),
    path('partner/billing/stripe/session', PartnerStripeCheckoutSessionView.as_view(), name='partner-stripe-checkout-session-noslash'),
    path('partner/billing/stripe/portal/', PartnerStripePortalSessionView.as_view(), name='partner-stripe-portal-session'),
    path('partner/billing/stripe/portal', PartnerStripePortalSessionView.as_view(), name='partner-stripe-portal-session-noslash'),

    # Security Dashboard (Phase 3)
    path('partner/security/login-activity/', views_security.partner_login_activity, name='partner-security-login-activity'),
    path('partner/security/login-activity', views_security.partner_login_activity, name='partner-security-login-activity-noslash'),
    path('partner/security/sessions/', views_security.partner_active_sessions, name='partner-security-sessions'),
    path('partner/security/sessions', views_security.partner_active_sessions, name='partner-security-sessions-noslash'),
    path('partner/security/sessions/revoke/', views_security.partner_revoke_session, name='partner-security-sessions-revoke'),
    path('partner/security/sessions/revoke', views_security.partner_revoke_session, name='partner-security-sessions-revoke-noslash'),

    # Phase 4 — Webhook Management
    path('partner/webhooks/', views_webhooks.WebhookConfigListCreateView.as_view(), name='partner-webhook-list'),
    path('partner/webhooks', views_webhooks.WebhookConfigListCreateView.as_view(), name='partner-webhook-list-noslash'),
    path('partner/webhooks/<int:config_id>/', views_webhooks.WebhookConfigDetailView.as_view(), name='partner-webhook-detail'),
    path('partner/webhooks/<int:config_id>', views_webhooks.WebhookConfigDetailView.as_view(), name='partner-webhook-detail-noslash'),
    path('partner/webhooks/<int:config_id>/regenerate-secret/', views_webhooks.WebhookRegenerateSecretView.as_view(), name='partner-webhook-regenerate'),
    path('partner/webhooks/<int:config_id>/regenerate-secret', views_webhooks.WebhookRegenerateSecretView.as_view(), name='partner-webhook-regenerate-noslash'),
    path('partner/webhooks/<int:config_id>/deliveries/', views_webhooks.WebhookDeliveryLogView.as_view(), name='partner-webhook-deliveries'),
    path('partner/webhooks/<int:config_id>/deliveries', views_webhooks.WebhookDeliveryLogView.as_view(), name='partner-webhook-deliveries-noslash'),
    path('partner/webhooks/<int:config_id>/test/', views_webhooks.WebhookTestView.as_view(), name='partner-webhook-test'),
    path('partner/webhooks/<int:config_id>/test', views_webhooks.WebhookTestView.as_view(), name='partner-webhook-test-noslash'),
    path('partner/webhooks/<int:config_id>/deliveries/<int:delivery_id>/retry/', views_webhooks.WebhookManualRetryView.as_view(), name='partner-webhook-retry'),
    path('partner/webhooks/<int:config_id>/deliveries/<int:delivery_id>/retry', views_webhooks.WebhookManualRetryView.as_view(), name='partner-webhook-retry-noslash'),

    # Phase 4 — Billing Status & Upgrade Preview
    path('partner/billing/status/', views_webhooks.BillingStatusView.as_view(), name='partner-billing-status'),
    path('partner/billing/status', views_webhooks.BillingStatusView.as_view(), name='partner-billing-status-noslash'),
    path('partner/subscription/preview-change/', views_webhooks.PreviewPlanChangeView.as_view(), name='partner-subscription-preview-change'),
    path('partner/subscription/preview-change', views_webhooks.PreviewPlanChangeView.as_view(), name='partner-subscription-preview-change-noslash'),

    # Phase 4 — Deprovision
    path('partner/billing/deprovision/', views_webhooks.DeprovisionView.as_view(), name='partner-billing-deprovision'),
    path('partner/billing/deprovision', views_webhooks.DeprovisionView.as_view(), name='partner-billing-deprovision-noslash'),
]
