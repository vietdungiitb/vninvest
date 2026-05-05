"""PAT-based authentication for packages/core DRF views."""
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

        if credential.effective_status != CorePATCredential.StatusChoices.ACTIVE:
            raise AuthenticationFailed(f'PAT is {credential.effective_status}.')

        # Return (user, auth) — user is the service account's tenant owner surrogate
        owner = credential.service_account.tenant.owner_user
        return (owner, credential)

    def authenticate_header(self, request):
        return self.keyword
