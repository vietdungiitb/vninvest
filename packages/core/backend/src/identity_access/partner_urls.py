"""
Partner namespace URL routes — tenant self-admin operations.

All routes under /core/v1/partner/* serve the authenticated tenant owner:
- tenant summary, service accounts, PATs, usage meters, billing data.

These paths mirror the frontend api/client.js partner/* calls.
"""
from django.urls import path

from . import (
    views_alert_config,
    views_dashboard,
    views_forecast,
    views_personal,
    views_reports,
    views_security,
    views_usage,
    views_usage_trend,
    views_webhooks,
)
from . import views_tenant as views
from .commercial_partner_views import (
    PartnerBillingInvoicesView,
    PartnerBillingSubscriptionView,
    PartnerCostTrendView,
    PartnerStripeCheckoutSessionView,
    PartnerStripePortalSessionView,
    PartnerUsageHistoryView,
    PartnerUsageMetersView,
    PartnerUsageQuotasView,
)
from .views.sso import (
    PartnerSSOConfigView,
    PartnerSSOTestConnectionView,
    PartnerSSOTestLoginView,
)

urlpatterns = [
    # Tenant summary
    path('partner/tenant/', views.TenantDetailView.as_view(), name='partner-tenant'),
    path('partner/tenant', views.TenantDetailView.as_view(), name='partner-tenant-noslash'),

    # Tenant Settings
    path('partner/settings/', views.PartnerTenantSettingsView.as_view(), name='partner-settings'),
    path('partner/settings', views.PartnerTenantSettingsView.as_view(), name='partner-settings-noslash'),

    # Service accounts
    path('partner/service-accounts/', views.ServiceAccountListView.as_view(), name='partner-sa-list'),
    path('partner/service-accounts', views.ServiceAccountListView.as_view(), name='partner-sa-list-noslash'),
    path('partner/service-accounts/<str:sa_id>/usage/', views.partner_service_account_usage, name='partner-sa-usage'),
    path('partner/service-accounts/<str:sa_id>/usage', views.partner_service_account_usage, name='partner-sa-usage-noslash'),
    # W0.10 gap-2: FE goi PATCH/DELETE 1 service account
    # (/partner/service-accounts/{id}/) nhung route CHUA duoc dang ky => 404 that.
    # View da ton tai (views_tenant.py:190 ServiceAccountDetailView) va dung khoa
    # `service_account_id` (get_object) => route phai dung DUNG ten khoa do.
    path('partner/service-accounts/<str:service_account_id>/', views.ServiceAccountDetailView.as_view(), name='partner-sa-detail'),
    path('partner/service-accounts/<str:service_account_id>', views.ServiceAccountDetailView.as_view(), name='partner-sa-detail-noslash'),

    # PATs
    path('partner/pats/', views.PATListView.as_view(), name='partner-pat-list'),
    path('partner/pats', views.PATListView.as_view(), name='partner-pat-list-noslash'),
    # MUST be declared before '<str:pat_id>' routes so 'usage-summary' is not captured as pat_id.
    path('partner/pats/usage-summary/', views.partner_pat_usage_summary, name='partner-pat-usage-summary'),
    path('partner/pats/usage-summary', views.partner_pat_usage_summary, name='partner-pat-usage-summary-noslash'),
    path('partner/pats/issue/', views.partner_issue_pat, name='partner-pat-issue'),
    path('partner/pats/issue', views.partner_issue_pat, name='partner-pat-issue-noslash'),
    path('partner/pats/<str:pat_id>/rotate/', views.partner_rotate_pat, name='partner-pat-rotate'),
    path('partner/pats/<str:pat_id>/revoke/', views.partner_revoke_pat, name='partner-pat-revoke'),
    path('partner/pats/<str:pat_id>/usage/', views.partner_pat_usage, name='partner-pat-usage'),
    path('partner/pats/<str:pat_id>/usage', views.partner_pat_usage, name='partner-pat-usage-noslash'),

    # Personal API keys self-service (B+A S1) — own-data, mọi role có tenant
    path('partner/me/keys/', views_personal.personal_keys_list_create, name='partner-me-keys'),
    path('partner/me/keys', views_personal.personal_keys_list_create, name='partner-me-keys-noslash'),
    path('partner/me/keys/usage-summary/', views_personal.personal_keys_usage_summary, name='partner-me-keys-usage'),
    path('partner/me/keys/usage-summary', views_personal.personal_keys_usage_summary, name='partner-me-keys-usage-noslash'),
    path('partner/me/keys/<str:key_id>/rotate/', views_personal.personal_keys_rotate, name='partner-me-keys-rotate'),
    path('partner/me/keys/<str:key_id>/rotate', views_personal.personal_keys_rotate, name='partner-me-keys-rotate-noslash'),
    path('partner/me/keys/<str:key_id>/revoke/', views_personal.personal_keys_revoke, name='partner-me-keys-revoke'),
    path('partner/me/keys/<str:key_id>/revoke', views_personal.personal_keys_revoke, name='partner-me-keys-revoke-noslash'),
    path('partner/me/summary/', views_personal.personal_summary, name='partner-me-summary'),
    path('partner/me/summary', views_personal.personal_summary, name='partner-me-summary-noslash'),

    # SSO Configuration
    path('partner/sso/', PartnerSSOConfigView.as_view(), name='partner-sso-config'),
    path('partner/sso', PartnerSSOConfigView.as_view(), name='partner-sso-config-noslash'),
    path('partner/sso/test/', PartnerSSOTestConnectionView.as_view(), name='partner-sso-test'),
    path('partner/sso/test', PartnerSSOTestConnectionView.as_view(), name='partner-sso-test-noslash'),
    path('partner/sso/test-login/', PartnerSSOTestLoginView.as_view(), name='partner-sso-test-login'),
    path('partner/sso/test-login', PartnerSSOTestLoginView.as_view(), name='partner-sso-test-login-noslash'),

    # Usage
    path('partner/usage/meters/', PartnerUsageMetersView.as_view(), name='partner-usage-meters'),
    path('partner/usage/meters', PartnerUsageMetersView.as_view(), name='partner-usage-meters-noslash'),
    path('partner/usage/quotas/', PartnerUsageQuotasView.as_view(), name='partner-usage-quotas'),
    path('partner/usage/quotas', PartnerUsageQuotasView.as_view(), name='partner-usage-quotas-noslash'),
    path('partner/usage/history/', PartnerUsageHistoryView.as_view(), name='partner-usage-history'),
    path('partner/usage/history', PartnerUsageHistoryView.as_view(), name='partner-usage-history-noslash'),

    # Phase 2 — API Analytics
    path('partner/usage/api-calls/', views_usage.partner_api_usage, name='partner-api-usage'),
    path('partner/usage/api-calls', views_usage.partner_api_usage, name='partner-api-usage-noslash'),
    path('partner/usage/api-calls/timeline/', views_usage.partner_api_timeline, name='partner-api-timeline'),
    path('partner/usage/api-calls/timeline', views_usage.partner_api_timeline, name='partner-api-timeline-noslash'),
    path('partner/usage/api-calls/export/', views_usage.partner_api_export, name='partner-api-export'),
    path('partner/usage/api-calls/export', views_usage.partner_api_export, name='partner-api-export-noslash'),

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

    # Phase 4 — Custom Roles (RBAC)
    path('partner/roles/', views.PartnerRoleListCreateView.as_view(), name='partner-role-list'),
    path('partner/roles', views.PartnerRoleListCreateView.as_view(), name='partner-role-list-noslash'),
    path('partner/roles/<str:role_id>/', views.PartnerRoleDetailView.as_view(), name='partner-role-detail'),
    path('partner/roles/<str:role_id>', views.PartnerRoleDetailView.as_view(), name='partner-role-detail-noslash'),
]
