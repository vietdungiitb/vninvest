"""PAT-based authentication for packages/core DRF views."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import ipaddress

from .models import CorePATCredential


class CorePATAuthentication(BaseAuthentication):
    """
    Authenticates requests using a Bearer PAT token.
    Header: Authorization: Bearer <raw_pat_secret>
    """
    keyword = 'Bearer'

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '').strip()
        if not auth_header or not auth_header.startswith(f'{self.keyword} '):
            return None

        raw_secret = auth_header[len(self.keyword) + 1:].strip()
        if not raw_secret:
            return None

        credential = CorePATCredential.resolve_from_raw_secret(raw_secret)
        if credential is None:
            raise AuthenticationFailed('Invalid or revoked PAT.')

        if credential.effective_status not in {
            CorePATCredential.StatusChoices.ACTIVE,
            CorePATCredential.StatusChoices.ROTATING,
        }:
            raise AuthenticationFailed(f'PAT is {credential.effective_status}.')

        if credential.service_account.status != credential.service_account.StatusChoices.ACTIVE:
            raise AuthenticationFailed('Service account is disabled.')

        # Check CIDR whitelist if configured
        if credential.allowed_cidr_blocks:
            client_ip = request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip() or request.META.get('REMOTE_ADDR', '127.0.0.1')
            ip_allowed = False
            try:
                ip_obj = ipaddress.ip_address(client_ip)
                for cidr in credential.allowed_cidr_blocks:
                    if ip_obj in ipaddress.ip_network(cidr, strict=False):
                        ip_allowed = True
                        break
            except ValueError:
                pass
            if not ip_allowed:
                raise AuthenticationFailed('Địa chỉ IP không được phép truy cập bằng Token này.')

        # Return (user, auth) — user is the service account's tenant owner surrogate
        # unless the PAT was issued for a specific TenantMember (Sprint 4 prereq fix).
        from identity_access.utils.resolve_tenant import apply_pat_user_privileges
        member = credential.issued_for_member
        if member is not None:
            user = member.user
        else:
            user = credential.service_account.tenant.owner_user
        user = apply_pat_user_privileges(user, credential)
        return (user, credential)

    def authenticate_header(self, request):
        return self.keyword


class CorePATAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = 'identity_access.authentication.CorePATAuthentication'
    name = 'CorePATBearer'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'PAT',
            'description': 'Bearer token backed by Core PAT credentials.',
        }
