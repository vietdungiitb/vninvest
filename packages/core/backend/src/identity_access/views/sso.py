"""
SAML 2.0 SSO views for Enterprise tenants.
"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
import logging

from ..models import CoreTenant, TenantSSOConfig, CorePATCredential, CoreServiceAccount
from ..serializers import TenantSSOConfigSerializer
from ..permissions import IsTenantActive, require_pat_scopes_or_human_session

logger = logging.getLogger(__name__)

PARTNER_SCOPE_MANAGE_TENANT = 'manage_tenant'


def _get_request_tenant(request) -> CoreTenant:
    """Get tenant from request (set by TenantResolutionMiddleware)."""
    tenant = getattr(request, 'tenant', None)
    if tenant is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Không tìm thấy tenant trong request. Middleware chưa chạy hoặc tenant không hợp lệ.')
    return tenant


def _get_request_tenant_role(request) -> str:
    """Get tenant role from request (set by TenantResolutionMiddleware)."""
    role = getattr(request, 'tenant_role', None)
    if role is None:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Không tìm thấy vai trò tenant trong request.')
    return role


def _require_tenant_role(request, *allowed_roles: str) -> None:
    """Check if request.tenant_role is in allowed_roles."""
    role = _get_request_tenant_role(request)
    if role not in allowed_roles:
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied(f'Vai trò {role} không có quyền thực hiện hành động này.')


class PartnerSSOConfigView(APIView):
    """
    GET  /core/v1/partner/sso/  — Get SSO configuration
    POST /core/v1/partner/sso/  — Create/Update SSO configuration
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_role(request, 'owner', 'admin')
        tenant = _get_request_tenant(request)
        
        sso_config, created = TenantSSOConfig.objects.get_or_create(tenant=tenant)
        serializer = TenantSSOConfigSerializer(sso_config)
        return Response(serializer.data)

    def post(self, request):
        require_pat_scopes_or_human_session(request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_role(request, 'owner', 'admin')
        tenant = _get_request_tenant(request)
        
        sso_config, created = TenantSSOConfig.objects.get_or_create(tenant=tenant)
        serializer = TenantSSOConfigSerializer(sso_config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SSOLoginInitiateView(APIView):
    """
    GET /core/v1/auth/sso/login/?domain=company.com
    
    Initiate SAML SSO login flow. Redirects to IdP SSO URL.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        domain = request.query_params.get('domain', '').strip().lower()
        email = request.query_params.get('email', '').strip().lower()
        
        if not domain and not email:
            return Response(
                {'error': 'Cần cung cấp domain hoặc email để xác định IdP.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find tenant by domain hint or email domain
        if domain:
            sso_config = TenantSSOConfig.objects.filter(
                domain_hint__iexact=domain,
                is_enabled=True
            ).select_related('tenant').first()
        else:
            email_domain = email.split('@')[-1] if '@' in email else ''
            sso_config = TenantSSOConfig.objects.filter(
                domain_hint__iexact=email_domain,
                is_enabled=True
            ).select_related('tenant').first()
        
        if not sso_config:
            return Response(
                {'error': 'Không tìm thấy cấu hình SSO cho domain này.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Build SAML AuthnRequest redirect URL (simplified - in production use python3-saml)
        # For now, return the IdP SSO URL for frontend to redirect
        return Response({
            'sso_url': sso_config.idp_sso_url,
            'tenant_id': sso_config.tenant.public_id,
            'tenant_name': sso_config.tenant.display_name,
        })


class SSOCallbackView(APIView):
    """
    POST /core/v1/auth/sso/callback/
    
    Handle SAML Response from IdP. Creates/updates user and issues PAT.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        # In production, parse SAML Response here using python3-saml
        # For now, mock implementation expecting email in request body
        email = request.data.get('email', '').strip().lower()
        domain = request.data.get('domain', '').strip().lower()
        
        if not email:
            return Response(
                {'error': 'Email là bắt buộc trong SAML Response.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Find SSO config
        if domain:
            sso_config = TenantSSOConfig.objects.filter(
                domain_hint__iexact=domain,
                is_enabled=True
            ).select_related('tenant').first()
        else:
            email_domain = email.split('@')[-1] if '@' in email else ''
            sso_config = TenantSSOConfig.objects.filter(
                domain_hint__iexact=email_domain,
                is_enabled=True
            ).select_related('tenant').first()
        
        if not sso_config:
            return Response(
                {'error': 'Không tìm thấy cấu hình SSO cho domain này.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        tenant = sso_config.tenant
        
        # Find or create user
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'email': email,
            }
        )
        
        # Ensure user is member of tenant
        from ..models import TenantMember
        member, member_created = TenantMember.objects.get_or_create(
            tenant=tenant,
            user=user,
            defaults={
                'role': TenantMember.RoleChoices.VIEWER,
            }
        )
        
        # Create or get a service account for SSO sessions
        sa, sa_created = CoreServiceAccount.objects.get_or_create(
            tenant=tenant,
            name=f'SSO Session - {user.username}',
            defaults={
                'status': CoreServiceAccount.StatusChoices.ACTIVE,
                'scopes': ['market:read', 'signals:read', 'ai:invoke'],
            }
        )
        
        # Issue a human session PAT
        credential, raw_token = CorePATCredential.issue_for_service_account(
            service_account=sa,
            scopes=sa.scopes,
            label=f'login:{user.username}',
            audit_reason='core login',
            allowed_cidr_blocks=[],
        )
        credential.is_human_session = True
        credential.save(update_fields=['is_human_session'])
        
        return Response({
            'access': raw_token,
            'token': raw_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
            },
            'tenant': {
                'tenant_id': tenant.public_id,
                'tenant_code': tenant.tenant_code,
                'display_name': tenant.display_name,
                'plan': tenant.plan,
            },
            'member': {
                'role': member.role,
            },
        })
