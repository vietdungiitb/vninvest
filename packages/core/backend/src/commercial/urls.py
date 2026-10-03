from django.urls import path
from . import views
from .stripe_webhooks import StripeWebhookView

urlpatterns = [
    path('billing/subscription', views.SubscriptionDetailView.as_view(), name='subscription-detail'),
    path('billing/quota', views.QuotaListView.as_view(), name='quota-list'),
    path('billing/invoices', views.InvoiceListView.as_view(), name='invoice-list'),

    # VNPay Payment Integration
    path('payments/create/', views.CreateVNPayPaymentView.as_view(), name='payment-create'),
    path('payments/vnpay-ipn/', views.VNPayIPNWebhookView.as_view(), name='payment-vnpay-ipn'),
    path('payments/status/<str:txn_ref>/', views.PaymentStatusCheckView.as_view(), name='payment-status-check'),

    # Stripe Billing Integration (Partner namespace - tenant self-admin)
    path('billing/stripe/session/', views.StripeCheckoutSessionView.as_view(), name='stripe-checkout-session'),
    path('billing/stripe/portal/', views.StripePortalSessionView.as_view(), name='stripe-portal-session'),

    # Stripe Webhook (public endpoint)
    path('billing/stripe/webhook/', StripeWebhookView.as_view(), name='stripe-webhook'),
]
