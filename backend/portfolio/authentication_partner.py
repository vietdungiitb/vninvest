from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import CorePATCredential


class CorePartnerPATAuthentication(BaseAuthentication):
    keyword = 'bearer'

    def authenticate(self, request):
        header = get_authorization_header(request)
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2:
            return None

        try:
            scheme = parts[0].decode('utf-8')
            raw_secret = parts[1].decode('utf-8')
        except UnicodeDecodeError as error:
            raise AuthenticationFailed('Header Authorization không hợp lệ.') from error

        if scheme.lower() != self.keyword:
            return None

        if not raw_secret.startswith('vni_pat_live_'):
            return None

        credential = CorePATCredential.resolve_from_raw_secret(raw_secret)
        if credential is None:
            raise AuthenticationFailed('PAT không hợp lệ hoặc không tồn tại.')

        if credential.effective_status not in {CorePATCredential.StatusChoices.ACTIVE, CorePATCredential.StatusChoices.ROTATING}:
            raise AuthenticationFailed('PAT đã hết hạn hoặc bị vô hiệu.')

        if credential.service_account.status != credential.service_account.StatusChoices.ACTIVE:
            raise AuthenticationFailed('Service account đã bị vô hiệu.')

        if not credential.owner_user.is_active:
            raise AuthenticationFailed('Tài khoản tenant không còn hoạt động.')

        return credential.owner_user, credential

    def authenticate_header(self, request):
        return 'Bearer'
