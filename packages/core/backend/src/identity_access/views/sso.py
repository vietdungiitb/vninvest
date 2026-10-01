"""
SAML 2.0 SSO views for Enterprise tenants.

Uses saml_service.SAMLService for protocol-level operations (AuthnRequest,
Response parsing, metadata generation). Signature verification is a stub
pending python3-saml + xmlsec1 in production.
"""
import base64
import logging

from django.contrib.auth import get_user_model
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    CorePATCredential,
    CoreServiceAccount,
    TenantMember,
    TenantSSOConfig,
)
from ..saml_service import (
    SAMLParseError,
    SAMLRequestError,
    SAMLService,
    SAMLSignatureError,
)
from ..serializers import TenantSSOConfigSerializer
from ..envelope import envelope
from ..permissions import IsTenantActive, require_pat_scopes_or_human_session
from ..utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission

logger = logging.getLogger(__name__)

User = get_user_model()

PARTNER_SCOPE_MANAGE_TENANT = 'manage_tenant'


# ─── helper ───────────────────────────────────────────────────────────


def _find_sso_config(domain: str = '', email: str = '') -> 'TenantSSOConfig | None':
    """Look up an enabled SSO config by domain hint or email domain."""
    if domain:
        return (
            TenantSSOConfig.objects
            .filter(domain_hint__iexact=domain, is_enabled=True)
            .select_related('tenant')
            .first()
        )
    email_domain = email.split('@')[-1] if '@' in email else ''
    if email_domain:
        return (
            TenantSSOConfig.objects
            .filter(domain_hint__iexact=email_domain, is_enabled=True)
            .select_related('tenant')
            .first()
        )
    return None


# ─── Partner SSO Config (CRUD) ────────────────────────────────────────


class PartnerSSOConfigView(APIView):
    """
    GET  /core/v1/partner/sso/  — Read SSO configuration
    POST /core/v1/partner/sso/  — Create / Update SSO configuration

    POST auto-fills sp_entity_id and sp_acs_url from the request host
    when they are not provided by the caller.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_permission(request, 'sso:read')
        tenant = _get_request_tenant(request)
        sso_config, _ = TenantSSOConfig.objects.get_or_create(tenant=tenant)
        return envelope(TenantSSOConfigSerializer(sso_config).data)

    def post(self, request):
        require_pat_scopes_or_human_session(request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_permission(request, 'sso:write')
        tenant = _get_request_tenant(request)
        sso_config, _ = TenantSSOConfig.objects.get_or_create(tenant=tenant)

        data = dict(request.data)

        # Auto-populate SP fields from tenant when not supplied
        host = request.get_host()
        scheme = request.scheme
        base = f'{scheme}://{host}'
        if not data.get('sp_entity_id'):
            data['sp_entity_id'] = f'{base}/core/v1/auth/sso/metadata/{tenant.tenant_code}'
        if not data.get('sp_acs_url'):
            data['sp_acs_url'] = f'{base}/core/v1/auth/sso/callback/'

        serializer = TenantSSOConfigSerializer(sso_config, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return envelope(serializer.data)


# ─── SAML Login Initiate ──────────────────────────────────────────────


class SSOLoginInitiateView(APIView):
    """
    GET /core/v1/auth/sso/login/?domain=company.com
    GET /core/v1/auth/sso/login/?email=user@company.com

    Generate a SAML AuthnRequest and redirect the user-agent to the IdP.
    Falls back to returning JSON with the redirect URL for SPA clients
    that handle the redirect client-side.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        domain = request.query_params.get('domain', '').strip()
        email = request.query_params.get('email', '').strip()

        if not domain and not email:
            return Response(
                {'error': 'Cần cung cấp domain hoặc email để xác định IdP.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sso_config = _find_sso_config(domain=domain, email=email)
        if sso_config is None:
            return Response(
                {'error': 'Không tìm thấy cấu hình SSO cho domain này.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            saml_svc = SAMLService.from_config(sso_config)
            relay_state = sso_config.tenant.tenant_code
            _request_id, redirect_url, _encoded = saml_svc.create_authn_request(
                relay_state=relay_state,
            )
        except (SAMLRequestError, ValueError) as exc:
            logger.exception('Failed to create SAML AuthnRequest')
            return Response(
                {'error': f'Không tạo được yêu cầu SAML: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        accept = request.META.get('HTTP_ACCEPT', '')
        if 'text/html' in accept:
            # Browser navigated directly — redirect
            return HttpResponseRedirect(redirect_url)

        # SPA client — return URL for client-side redirect
        return envelope({
            'redirect_url': redirect_url,
            'sso_url': saml_svc.idp_sso_url,
            'tenant_id': sso_config.tenant.public_id,
            'tenant_name': sso_config.tenant.display_name,
        })


# ─── SAML Callback ────────────────────────────────────────────────────


class SSOCallbackView(APIView):
    """
    POST /core/v1/auth/sso/callback/

    Accepts SAMLResponse + RelayState from the IdP, parses the assertion,
    finds-or-creates the user, ensures tenant membership, and issues a
    human-session PAT that the frontend stores as the access token.

    Also accepts a GET for HTTP-Redirect binding (SAMLResponse query param).
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    # ── POST (HTTP-POST binding) ──

    def post(self, request):
        saml_response_b64 = request.data.get('SAMLResponse', '')
        relay_state = request.data.get('RelayState', '')

        if not saml_response_b64:
            return Response(
                {'error': 'Thiếu SAMLResponse trong yêu cầu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return self._process_response(saml_response_b64, relay_state)

    # ── GET (HTTP-Redirect binding) ──

    def get(self, request):
        saml_response_b64 = request.query_params.get('SAMLResponse', '')
        relay_state = request.query_params.get('RelayState', '')

        if not saml_response_b64:
            return Response(
                {'error': 'Thiếu SAMLResponse trong query string.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return self._process_response(saml_response_b64, relay_state)

    # ── Shared processing ──

    def _process_response(self, saml_response_b64: str, relay_state: str):
        # Determine tenant from RelayState (tenant_code) or SAML attributes
        tenant_code = relay_state.strip() if relay_state else ''
        sso_config = None

        if tenant_code:
            from ..models import CoreTenant
            tenant = CoreTenant.objects.filter(tenant_code=tenant_code).first()
            if tenant:
                sso_config = (
                    TenantSSOConfig.objects
                    .filter(tenant=tenant, is_enabled=True)
                    .first()
                )

        if sso_config is None:
            # Fallback: try to resolve from the response itself
            try:
                partial_svc = SAMLService(
                    sp_entity_id='',
                    sp_acs_url='',
                    idp_entity_id='',
                    idp_sso_url='',
                )
                parsed_partial = partial_svc.parse_response(saml_response_b64)
                issuer_email = parsed_partial.get('email', '')
                sso_config = _find_sso_config(email=issuer_email)
            except Exception:
                pass

        if sso_config is None:
            return Response(
                {'error': 'Không tìm thấy cấu hình SSO cho tenant này.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Parse the full SAML Response
        try:
            saml_svc = SAMLService.from_config(sso_config)
            parsed = saml_svc.parse_response(saml_response_b64)
        except (SAMLParseError, SAMLSignatureError) as exc:
            logger.warning('SAML Response parse failed: %s', exc)
            return Response(
                {'error': f'Phản hồi SAML không hợp lệ: {exc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            logger.exception('Unexpected SAML parse error')
            return Response(
                {'error': f'Lỗi xử lý SAML: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        email = (parsed.get('email') or '').strip().lower()
        display_name = (parsed.get('name') or '').strip()

        if not email:
            return Response(
                {'error': 'SAML Response không chứa email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tenant = sso_config.tenant

        # ── Find or create user ──
        user, user_created = User.objects.get_or_create(
            email=email,
            defaults={
                'username': email.split('@')[0],
                'email': email,
                'first_name': display_name.split()[0] if display_name else '',
                'last_name': ' '.join(display_name.split()[1:]) if display_name else '',
            },
        )
        if not user_created and display_name and not user.first_name:
            user.first_name = display_name.split()[0]
            user.last_name = ' '.join(display_name.split()[1:])
            user.save(update_fields=['first_name', 'last_name'])

        # ── Ensure tenant membership ──
        member, member_created = TenantMember.objects.get_or_create(
            tenant=tenant,
            user=user,
            defaults={'role': TenantMember.RoleChoices.VIEWER},
        )

        # ── Create or reuse service account for SSO sessions ──
        sa_name = f'SSO Session — {email}'
        sa, _sa_created = CoreServiceAccount.objects.get_or_create(
            tenant=tenant,
            name=sa_name,
            defaults={
                'status': CoreServiceAccount.StatusChoices.ACTIVE,
                'scopes': ['market:read', 'signals:read', 'ai:invoke'],
            },
        )

        # ── Issue human-session PAT ──
        credential, raw_token = CorePATCredential.issue_for_service_account(
            service_account=sa,
            scopes=sa.scopes,
            label=f'sso:{email}',
            audit_reason='sso login',
            allowed_cidr_blocks=[],
            is_human_session=True,
            issued_for_member=member,
        )

        logger.info('SSO login: user=%s tenant=%s session=%s', email, tenant.tenant_code, credential.public_id)

        return envelope({
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


# ─── SP Metadata endpoint ─────────────────────────────────────────────


class SSOMetadataView(APIView):
    """
    GET /core/v1/auth/sso/metadata/<tenant_code>/

    Returns SP EntityDescriptor XML for the given tenant so the IdP
    administrator can import it.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, tenant_code: str = ''):
        from ..models import CoreTenant
        tenant = CoreTenant.objects.filter(tenant_code=tenant_code).first()
        if tenant is None:
            return Response(
                {'error': 'Tenant không tồn tại.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        sso_config = TenantSSOConfig.objects.filter(tenant=tenant, is_enabled=True).first()
        if sso_config is None:
            return Response(
                {'error': 'SSO chưa được cấu hình cho tenant này.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        saml_svc = SAMLService.from_config(sso_config)
        metadata_xml = saml_svc.generate_metadata()
        return HttpResponse(metadata_xml, content_type='application/xml; charset=utf-8')


# ─── Partner: test SSO connection ──────────────────────────────────────


class PartnerSSOTestConnectionView(APIView):
    """
    POST /core/v1/partner/sso/test/

    Run validation checks against the stored SSO configuration:
    - All required fields are present
    - IdP SSO URL is reachable (HTTP HEAD)
    Returns {success, checks, errors}.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def post(self, request):
        require_pat_scopes_or_human_session(request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_permission(request, 'sso:read')
        tenant = _get_request_tenant(request)

        sso_config = TenantSSOConfig.objects.filter(tenant=tenant).first()
        if sso_config is None or not sso_config.idp_sso_url:
            return envelope({
                'success': False,
                'checks': [],
                'errors': ['SSO chưa được cấu hình.'],
            })

        saml_svc = SAMLService.from_config(sso_config)
        result = saml_svc.test_connection()
        return envelope(result)


# ─── Partner: test SSO login initiation (JSON only) ────────────────────


class PartnerSSOTestLoginView(APIView):
    """
    POST /core/v1/partner/sso/test-login/

    Like SSOLoginInitiateView but requires authentication and returns
    the redirect URL as JSON (no redirect). Used by the admin test panel.
    """
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def post(self, request):
        require_pat_scopes_or_human_session(request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_permission(request, 'sso:read')
        tenant = _get_request_tenant(request)

        sso_config = TenantSSOConfig.objects.filter(tenant=tenant, is_enabled=True).first()
        if sso_config is None:
            return Response(
                {'error': 'SSO chưa được cấu hình hoặc chưa bật.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            saml_svc = SAMLService.from_config(sso_config)
            _request_id, redirect_url, _encoded = saml_svc.create_authn_request(
                relay_state=tenant.tenant_code,
            )
        except (SAMLRequestError, ValueError) as exc:
            return Response(
                {'error': f'Không tạo được yêu cầu SAML: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return envelope({
            'redirect_url': redirect_url,
            'sso_url': saml_svc.idp_sso_url,
        })
