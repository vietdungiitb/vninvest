"""
Auth views for packages/core.

Endpoints:
  POST /core/v1/auth/login   — exchange credentials for session + PAT
  GET  /core/v1/auth/profile — return current tenant profile
  POST /core/v1/auth/logout  — invalidate session
"""
from django.contrib.auth import authenticate
from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .authentication import CorePATAuthentication
from .models import CorePATCredential, CoreTenant


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    POST /core/v1/auth/login
    Body: { "username": "...", "password": "..." }
    Returns: { "token": "<raw_pat>", "token_prefix": "...", "tenant": {...} }
    """
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response(
            {'detail': 'username and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {'detail': 'Invalid credentials.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Issue a fresh PAT for this login session
    service_account = tenant.service_accounts.filter(status='active').first()
    if service_account is None:
        return Response(
            {'detail': 'No active service account for tenant.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    raw_secret = CorePATCredential.issue_for_service_account(service_account)
    credential = CorePATCredential.objects.filter(
        service_account=service_account,
        status='active',
        token_prefix=raw_secret[:12],
    ).first()

    return Response(
        {
            'token': raw_secret,
            'token_prefix': raw_secret[:12],
            'tenant': {
                'public_id': str(tenant.public_id),
                'tenant_code': tenant.tenant_code,
                'display_name': tenant.display_name,
                'plan': tenant.plan,
                'status': tenant.status,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@authentication_classes([CorePATAuthentication])
@permission_classes([permissions.IsAuthenticated])
def profile_view(request):
    """
    GET /core/v1/auth/profile
    Returns current user/tenant profile.
    Requires: Authorization: Bearer <raw_pat>
    """
    user = request.user
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    subscription = tenant.subscriptions.filter(status='active').first()

    return Response(
        {
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
            },
            'tenant': {
                'public_id': str(tenant.public_id),
                'tenant_code': tenant.tenant_code,
                'display_name': tenant.display_name,
                'plan': tenant.plan,
                'status': tenant.status,
                'created_at': tenant.created_at.isoformat() if hasattr(tenant, 'created_at') else None,
            },
            'subscription': {
                'plan': subscription.plan if subscription else tenant.plan,
                'status': subscription.status if subscription else 'none',
            } if subscription else None,
        }
    )


@api_view(['POST'])
@authentication_classes([CorePATAuthentication])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    """
    POST /core/v1/auth/logout
    Revokes the PAT used for this request.
    """
    credential = getattr(request, 'auth', None)
    if credential and isinstance(credential, CorePATCredential):
        credential.revoke_pat()
        return Response({'detail': 'Logged out and PAT revoked.'}, status=status.HTTP_200_OK)
    return Response({'detail': 'No active PAT to revoke.'}, status=status.HTTP_200_OK)
