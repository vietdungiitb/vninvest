from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import CorePATCredential, CoreServiceAccount, CoreTenant
from .serializers import (
    CorePATCredentialSerializer,
    CorePATIssueResponseSerializer,
    CoreServiceAccountSerializer,
    CoreTenantSerializer,
)


class TenantDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CoreTenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return CoreTenant.objects.get(owner_user=self.request.user)


class ServiceAccountListView(generics.ListCreateAPIView):
    serializer_class = CoreServiceAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return CoreServiceAccount.objects.filter(tenant=tenant).order_by('-created_at')

    def perform_create(self, serializer):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        serializer.save(tenant=tenant)


class ServiceAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CoreServiceAccountSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return CoreServiceAccount.objects.filter(tenant=tenant)

    def get_object(self):
        return generics.get_object_or_404(
            self.get_queryset(), public_id=self.kwargs['service_account_id']
        )


class PATListView(generics.ListAPIView):
    serializer_class = CorePATCredentialSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return CorePATCredential.objects.filter(
            service_account__tenant=tenant
        ).order_by('-created_at')


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def issue_pat(request, service_account_id):
    """Issue a new PAT for a service account. Returns token ONE TIME only."""
    tenant = CoreTenant.objects.get(owner_user=request.user)
    sa = generics.get_object_or_404(CoreServiceAccount, public_id=service_account_id, tenant=tenant)

    scopes = request.data.get('scopes', [])
    expires_at = request.data.get('expires_at', None)
    label = request.data.get('label', '')

    credential, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes,
        expires_at=expires_at,
        label=label,
    )

    payload = {
        'pat_id': credential.public_id,
        'service_account_id': sa.public_id,
        'tenant_id': tenant.public_id,
        'label': credential.label,
        'token_prefix': credential.token_prefix,
        'token': raw_token,
        'scopes': credential.scopes,
        'expires_at': credential.expires_at,
    }
    serializer = CorePATIssueResponseSerializer(payload)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
