"""
Partner namespace URL routes — tenant self-admin operations.

All routes under /core/v1/partner/* serve the authenticated tenant owner:
- tenant summary, service accounts, PATs, usage meters, billing data.

These paths mirror the frontend api/client.js partner/* calls.
"""
from django.urls import path

from . import views
from .commercial_partner_views import (
    PartnerBillingInvoicesView,
    PartnerBillingSubscriptionView,
    PartnerUsageMetersView,
    PartnerUsageQuotasView,
)

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

    # Usage
    path('partner/usage/meters/', PartnerUsageMetersView.as_view(), name='partner-usage-meters'),
    path('partner/usage/meters', PartnerUsageMetersView.as_view(), name='partner-usage-meters-noslash'),
    path('partner/usage/quotas/', PartnerUsageQuotasView.as_view(), name='partner-usage-quotas'),
    path('partner/usage/quotas', PartnerUsageQuotasView.as_view(), name='partner-usage-quotas-noslash'),

    # Billing (delegates to commercial app)
    path('partner/billing/subscription/', PartnerBillingSubscriptionView.as_view(), name='partner-billing-sub'),
    path('partner/billing/subscription', PartnerBillingSubscriptionView.as_view(), name='partner-billing-sub-noslash'),
    path('partner/billing/invoices/', PartnerBillingInvoicesView.as_view(), name='partner-billing-invoices'),
    path('partner/billing/invoices', PartnerBillingInvoicesView.as_view(), name='partner-billing-invoices-noslash'),
]
