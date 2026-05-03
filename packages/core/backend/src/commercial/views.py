from rest_framework import generics, permissions

from identity_access.models import CoreTenant

from .models import Invoice, QuotaRecord, Subscription
from .serializers import InvoiceSerializer, QuotaRecordSerializer, SubscriptionSerializer


class SubscriptionDetailView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return generics.get_object_or_404(Subscription, tenant=tenant)


class QuotaListView(generics.ListAPIView):
    serializer_class = QuotaRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return QuotaRecord.objects.filter(tenant=tenant).order_by('-period_start')


class InvoiceListView(generics.ListAPIView):
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return Invoice.objects.filter(tenant=tenant).order_by('-created_at')
