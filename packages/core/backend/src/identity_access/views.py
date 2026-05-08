from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.pagination import CoreCursorPagination

from .models import CorePATCredential, CoreServiceAccount, CoreTenant, UserProfile
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
    pagination_class = CoreCursorPagination
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
    pagination_class = CoreCursorPagination
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


class UserProfileView(APIView):
    """
    GET  /core/v1/identity/profile/  — return authenticated user's UserProfile
    PATCH /core/v1/identity/profile/ — partial update display_name, language, theme, whale_alert_threshold
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'display_name': request.user.get_full_name() or request.user.username,
            },
        )
        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'display_name': profile.display_name,
            'language': profile.language,
            'theme': profile.theme,
            'whale_alert_threshold': str(profile.whale_alert_threshold),
            'preferences': profile.preferences,
        })

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'display_name': request.user.get_full_name() or request.user.username,
            },
        )
        allowed_fields = {'display_name', 'language', 'theme', 'whale_alert_threshold', 'preferences'}
        update_fields = []
        for field in allowed_fields:
            if field in request.data:
                setattr(profile, field, request.data[field])
                update_fields.append(field)
        if update_fields:
            update_fields.append('updated_at')
            profile.save(update_fields=update_fields)
        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'display_name': profile.display_name,
            'language': profile.language,
            'theme': profile.theme,
            'whale_alert_threshold': str(profile.whale_alert_threshold),
            'preferences': profile.preferences,
        })


# ---------------------------------------------------------------------------
# Partner namespace views — tenant self-admin operations at /core/v1/partner/*
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def partner_issue_pat(request):
    """Issue a new PAT. Takes service_account_id from request body."""
    tenant = CoreTenant.objects.get(owner_user=request.user)
    sa_id = request.data.get('service_account_id')
    if not sa_id:
        return Response({'detail': 'service_account_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
    sa = generics.get_object_or_404(CoreServiceAccount, public_id=sa_id, tenant=tenant)

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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def partner_rotate_pat(request, pat_id):
    """Revoke old PAT and issue a replacement for the same service account."""
    tenant = CoreTenant.objects.get(owner_user=request.user)
    old_pat = generics.get_object_or_404(
        CorePATCredential, public_id=pat_id, service_account__tenant=tenant
    )
    sa = old_pat.service_account
    old_pat.revoke_pat(reason=request.data.get('reason', 'rotated_by_tenant_admin'))

    scopes = request.data.get('scopes', old_pat.scopes or [])
    expires_at = request.data.get('expires_at', None)
    label = request.data.get('label', old_pat.label or '')

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


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def partner_revoke_pat(request, pat_id):
    """Revoke a PAT owned by the authenticated tenant."""
    tenant = CoreTenant.objects.get(owner_user=request.user)
    pat = generics.get_object_or_404(
        CorePATCredential, public_id=pat_id, service_account__tenant=tenant
    )
    pat.revoke_pat(reason=request.data.get('reason', 'revoked_by_tenant_admin'))
    return Response({'status': 'revoked', 'pat_id': pat_id})


class PartnerUsageMetersView(generics.ListAPIView):
    """Usage meters list — placeholder until usage metering is implemented."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        return Response([])

