"""PAT-based authentication for packages/core DRF views."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import hmac
import ipaddress

from .models import CorePATCredential
from vninvest_core.client_ip import get_client_ip


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

        credential = self._resolve_credential(request, raw_secret)
        if credential is None:
            raise AuthenticationFailed('Invalid or revoked PAT.')

        if credential.effective_status not in {
            CorePATCredential.StatusChoices.ACTIVE,
            CorePATCredential.StatusChoices.ROTATING,
        }:
            raise AuthenticationFailed(f'PAT is {credential.effective_status}.')

        if credential.service_account.status != credential.service_account.StatusChoices.ACTIVE:
            raise AuthenticationFailed('Service account is disabled.')

        # Check CIDR whitelist if configured.
        #
        # Was: request.META.get('HTTP_X_FORWARDED_FOR','').split(',')[0].strip()
        #      or request.META.get('REMOTE_ADDR', '127.0.0.1')
        # That read the LEFT-MOST X-Forwarded-For entry, which is the
        # client-supplied one: anybody could send "X-Forwarded-For: 10.0.0.7"
        # and make a CIDR-restricted PAT usable from anywhere. get_client_ip()
        # honours the header only when REMOTE_ADDR is a TRUSTED_PROXY_IPS
        # entry, and with the default empty list ignores it entirely.
        #
        # Fail-closed: when the peer cannot be determined get_client_ip returns
        # UNKNOWN_IP ("unknown"), which ipaddress.ip_address() rejects with
        # ValueError, so ip_allowed stays False and the PAT is rejected.
        if credential.allowed_cidr_blocks:
            client_ip = get_client_ip(request)
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

    def _resolve_credential(self, request, raw_secret):
        """Return the PAT for `raw_secret`, reusing the middleware's lookup.

        `TenantResolutionMiddleware` runs before DRF and already resolves the PAT
        to answer "which tenant is this request for?". Re-running that resolution
        here meant a second HMAC plus a second indexed query on every single
        authenticated request, and the two lookups could in principle disagree.

        The cached credential is only trusted after re-deriving the hash of the
        secret actually presented and comparing it in constant time, so a stale or
        foreign `request._pat_credential` can never authorise a different token.
        Anything that does not match falls through to the database.
        """
        cached = getattr(request, '_pat_credential', None)
        if cached is not None:
            from .models import _hash_pat_secret
            try:
                matches = hmac.compare_digest(cached.token_secret_hash, _hash_pat_secret(raw_secret))
            except (AttributeError, TypeError):
                matches = False
            if matches:
                return cached
        return CorePATCredential.resolve_from_raw_secret(raw_secret)


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
