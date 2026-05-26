"""PAT-based authentication for packages/core DRF views."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

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

        # Return (user, auth) — user is the service account's tenant owner surrogate
        owner = credential.service_account.tenant.owner_user
        if not credential.is_human_session:
            owner.is_staff = False
            owner.is_superuser = False
        return (owner, credential)

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
