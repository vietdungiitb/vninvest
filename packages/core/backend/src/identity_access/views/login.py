import logging
from django.contrib.auth import authenticate, get_user_model
from django.conf import settings as django_settings
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.decorators import api_view, authentication_classes, permission_classes

from ..authentication import CorePATAuthentication
from ..envelope import envelope
from ..models import CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember
from ..schema import DetailPayloadSerializer, F3SuccessResponseSerializer
from ..security_utils import (
    LoginRecorder,
    client_ip_bucket,
    client_subnet_bucket,
    enforce_rate_limit,
    get_user_by_email,
    get_user_by_username,
    value_bucket,
)
from vninvest_core.api_envelope import envelope_response
from vninvest_core.exceptions import (
    ValidationErrorException,
    AuthenticationErrorException,
    PermissionErrorException,
)
from .helpers import (
    _human_session_pat_expires_at,
    _build_auth_payload,
    success_response,
    TENANT_PERMISSION_CLASSES,
)

logger = logging.getLogger(__name__)
User = get_user_model()


#: F3 **phẳng** `{status, timestamp, request_id, data}` — KHÔNG phải envelope
#: `{data, meta}`. `success_response()` (`views/helpers.py:327`) không sinh
#: `meta`; bọc nó vào envelope sẽ **làm mất `request_id`** mà client dùng để
#: tra log. Bộ phân loại của `scripts/check-envelope-contract.py` xếp shape
#: này là `SKIP_F3`.
@extend_schema(
    responses={200: F3SuccessResponseSerializer},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """
    POST /core/v1/auth/login
    Body: { "username": "...", "password": "..." }
    Returns: success_response envelope with { "access": "...", "refresh": "...", "token": "...", ... }
    
    Upgraded SaaS Native Login with 3-Layer Brute-Force Rate Limiting (IP, Subnet, User).
    Fully compliant with StandardErrorEnvelope & success_response envelope.
    """
    # 2. Extract and Normalize Input Identifier
    username_input = str(request.data.get('username', '') or '').strip()
    password = request.data.get('password', '')

    if not username_input or not password:
        raise ValidationErrorException(
            detail='Tên đăng nhập và mật khẩu không được để trống.',
            code='validation_error',
        )

    # Resolve actual username from email if provided.
    # A10: was `User.objects.get(email__iexact=...)` inside
    # `except User.DoesNotExist`. auth_user.email has no unique index, so once
    # two rows shared an address this raised MultipleObjectsReturned - uncaught,
    # so a 500. get_user_by_email() resolves deterministically instead.
    auth_username = username_input
    if '@' in username_input:
        resolved_user = get_user_by_email(username_input)
        if resolved_user is not None:
            auth_username = resolved_user.username

    normalized_user = auth_username.lower()

    # 3. 3-Layer Multi-Dimensional Brute-Force Rate Limiting
    # A5: the client address used to be the left-most `X-Forwarded-For` entry -
    # the value a *client* injects - so all three dimensions below were
    # bypassable with one header. `client_ip_bucket` / `client_subnet_bucket`
    # go through get_client_ip(), which honours the header only when the socket
    # peer is a trusted proxy. The counters were also a non-atomic
    # read-modify-write, so N simultaneous guesses counted as 1.
    # All three dimensions are checked before any is consumed, so a request
    # rejected on one layer does not also burn the others. `on_reject` records
    # which layer tripped, preserving the existing audit vocabulary.
    rate_limit_reasons = {
        'ip': 'rate_limit_ip',
        'subnet': 'rate_limit_subnet',
        'user': 'rate_limit_user',
    }

    def _record_rate_limit_rejection(bucket):
        layer = bucket.key.split(':')[2] if bucket.key.count(':') >= 2 else 'unknown'
        LoginRecorder.record_login(
            request,
            user=None,
            tenant=None,
            success=False,
            failure_reason=rate_limit_reasons.get(layer, 'rate_limit'),
        )

    enforce_rate_limit(
        [
            client_ip_bucket(
                'login',
                request,
                django_settings.LOGIN_IP_LIMIT_THRESHOLD,
                'Quá nhiều yêu cầu đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau 1 phút.',
            ),
            client_subnet_bucket(
                'login',
                request,
                django_settings.LOGIN_SUBNET_LIMIT_THRESHOLD,
                'Quá nhiều yêu cầu đăng nhập từ mạng này. Vui lòng thử lại sau 1 phút.',
            ),
            value_bucket(
                'login',
                'user',
                normalized_user,
                django_settings.LOGIN_USER_LIMIT_THRESHOLD,
                'Quá nhiều yêu cầu đăng nhập cho tài khoản này. Vui lòng thử lại sau 1 phút.',
            ),
        ],
        code='login_rate_limit_exceeded',
        on_reject=_record_rate_limit_rejection,
    )

    # 4. Resolve the candidate account.
    user_check = get_user_by_username(auth_username)

    # 5. Authenticate credentials.
    # Authenticate with the RESOLVED row's username, not the raw client input.
    # `get_user_by_username` matches case-insensitively (`username__iexact`), but
    # Django's ModelBackend does an EXACT `get(username=...)` -- so a user who typed
    # "VietDung" against a stored "vietdung" resolved the row on line 123 and then
    # failed authentication anyway, with a misleading "wrong credentials". The
    # registration serializer lowercases on the way in, so accounts created through
    # this API are already lowercase; this line makes accounts created by any other
    # route (admin, seed, import) reachable instead of silently locked out.
    user = authenticate(
        request,
        username=user_check.username if user_check is not None else auth_username,
        password=password,
    )
    if user is None:
        # A7: `user_inactive` used to be returned BEFORE the password was ever
        # checked, so an unauthenticated caller could confirm that any username
        # existed and was merely unverified - with no secret required. The
        # distinct code is now revealed only once the password is proven, so the
        # endpoint stops being an account-existence oracle while the account
        # owner still gets the "check your inbox" guidance they need.
        # `authenticate()` returns None for inactive accounts (ModelBackend
        # checks is_active), so both cases land here.
        if (
            user_check is not None
            and not user_check.is_active
            and user_check.check_password(password)
        ):
            LoginRecorder.record_login(request, user=None, tenant=None, success=False, failure_reason='inactive')
            raise AuthenticationErrorException(
                detail='Tài khoản chưa được kích hoạt. Vui lòng xác minh email trước khi đăng nhập.',
                code='user_inactive',
            )
        LoginRecorder.record_login(request, user=None, tenant=None, success=False, failure_reason='invalid_credentials')
        raise AuthenticationErrorException(
            detail='Tên đăng nhập hoặc mật khẩu không chính xác.',
            code='invalid_credentials',
        )

    # 6. Tenant and Service Account Validation
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        member = TenantMember.objects.filter(user=user).select_related('tenant').first()
        if member:
            tenant = member.tenant
        else:
            LoginRecorder.record_login(request, user=user, tenant=None, success=False, failure_reason='tenant_not_found')
            raise PermissionErrorException(
                detail='Không tìm thấy Workspace/Tenant liên kết với tài khoản này.',
                code='tenant_not_found',
            )

    service_account = tenant.service_accounts.filter(status='active').first()
    if service_account is None:
        LoginRecorder.record_login(request, user=user, tenant=tenant, success=False, failure_reason='sa_inactive')
        raise PermissionErrorException(
            detail='Tài khoản chưa có Service Account hoạt động.',
            code='service_account_inactive',
        )

    # 7. Resolve the TenantMember (if user is not the owner) so the issued
    #    human-session PAT carries the real member role instead of collapsing
    #    to the tenant owner (Sprint 4 prerequisite fix).
    member = None
    if tenant.owner_user_id != user.id:
        member = TenantMember.objects.filter(user=user, tenant=tenant).first()

    # 8. Issue dynamic PAT credentials
    credential, raw_secret = CorePATCredential.issue_for_service_account(
        service_account=service_account,
        scopes=list(service_account.scopes or []),
        expires_at=_human_session_pat_expires_at(),
        label=f'login:{user.username}',
        audit_reason='core login',
        is_human_session=True,
        issued_for_member=member,
    )

    auth_payload = _build_auth_payload(user, tenant, service_account, credential, raw_secret)
    LoginRecorder.record_login(request, user=user, tenant=tenant, success=True)
    return success_response(auth_payload, status.HTTP_200_OK, request=request)


@extend_schema(
    responses={200: F3SuccessResponseSerializer},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def refresh_token_view(request):
    """
    POST /core/v1/auth/token/refresh/
    Validate PAT token and return a rotated new PAT token.
    SaaS native OpenAPI compliant.
    """
    refresh = str(request.data.get('refresh', '') or '').strip()
    if not refresh:
        raise ValidationErrorException(
            detail='Refresh token không được để trống.',
            code='validation_error',
        )

    credential = CorePATCredential.resolve_from_raw_secret(refresh)
    if (
        credential is None
        or credential.effective_status != CorePATCredential.StatusChoices.ACTIVE
        or credential.service_account.status != CoreServiceAccount.StatusChoices.ACTIVE
        or not credential.is_human_session
    ):
        raise AuthenticationErrorException(
            detail='Refresh token không hợp lệ hoặc đã hết hạn.',
            code='invalid_refresh_token',
        )

    tenant = credential.service_account.tenant
    member = credential.issued_for_member
    user = member.user if member is not None else tenant.owner_user
    next_credential, next_raw_secret = CorePATCredential.issue_for_service_account(
        service_account=credential.service_account,
        scopes=list(credential.scopes or []),
        expires_at=_human_session_pat_expires_at(),
        label=credential.label,
        audit_reason='core refresh rotation',
        is_human_session=True,
        issued_for_member=member,
    )
    credential.revoke_pat(reason='core refresh rotation')

    auth_payload = _build_auth_payload(
        user,
        tenant,
        credential.service_account,
        next_credential,
        next_raw_secret,
    )
    return success_response(auth_payload, status.HTTP_200_OK, request=request)


@extend_schema(
    responses={200: envelope_response(DetailPayloadSerializer)},
)
@api_view(['POST'])
@authentication_classes([CorePATAuthentication])
@permission_classes(TENANT_PERMISSION_CLASSES)
def logout_view(request):
    """
    POST /core/v1/auth/logout
    Revokes the PAT used for this request.
    """
    credential = getattr(request, 'auth', None)
    if credential and isinstance(credential, CorePATCredential):
        credential.revoke_pat()
        return envelope({'detail': 'Logged out and PAT revoked.'}, status=status.HTTP_200_OK)
    return envelope({'detail': 'No active PAT to revoke.'}, status=status.HTTP_200_OK)
