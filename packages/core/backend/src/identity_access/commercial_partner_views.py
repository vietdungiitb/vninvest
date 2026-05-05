"""
Partner-namespace views that delegate to the commercial app's models.

These views sit in identity_access to avoid circular imports while keeping
the commercial app self-contained. They're registered under /core/v1/partner/*.
"""
from rest_framework import generics, permissions
from rest_framework.response import Response

from identity_access.models import CoreTenant


def _get_tenant(user):
    return CoreTenant.objects.get(owner_user=user)


class PartnerUsageMetersView(generics.GenericAPIView):
    """Usage meters — placeholder until metering is fully implemented."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response([])


class PartnerUsageQuotasView(generics.GenericAPIView):
    """Usage quotas — delegates to commercial QuotaRecord if table exists."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            from commercial.models import QuotaRecord
            from commercial.serializers import QuotaRecordSerializer
            tenant = _get_tenant(request.user)
            qs = QuotaRecord.objects.filter(tenant=tenant).order_by('-period_start')
            return Response(QuotaRecordSerializer(qs, many=True).data)
        except Exception:
            return Response([])


class PartnerBillingSubscriptionView(generics.GenericAPIView):
    """Subscription detail — delegates to commercial Subscription if exists."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            from commercial.models import Subscription
            from commercial.serializers import SubscriptionSerializer
            tenant = _get_tenant(request.user)
            sub = Subscription.objects.filter(tenant=tenant).first()
            if sub is None:
                # Return graceful empty state instead of 404
                return Response({
                    'status': 'none',
                    'plan': tenant.plan,
                    'billing_period_start': tenant.billing_period_start,
                    'billing_period_end': tenant.billing_period_end,
                    'trial_ends_at': tenant.trial_ends_at,
                })
            return Response(SubscriptionSerializer(sub).data)
        except Exception:
            return Response({
                'status': 'none',
                'plan': None,
                'billing_period_start': None,
                'billing_period_end': None,
                'trial_ends_at': None,
            })


class PartnerBillingInvoicesView(generics.GenericAPIView):
    """Invoices list — delegates to commercial Invoice if exists."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            from commercial.models import Invoice
            from commercial.serializers import InvoiceSerializer
            tenant = _get_tenant(request.user)
            qs = Invoice.objects.filter(tenant=tenant).order_by('-created_at')
            return Response(InvoiceSerializer(qs, many=True).data)
        except Exception:
            return Response([])
