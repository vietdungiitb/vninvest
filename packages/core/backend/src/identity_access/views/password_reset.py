import hashlib
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework import permissions
from rest_framework.response import Response

from ..envelope import envelope
from ..models import PasswordResetToken
from ..schema import DetailPayloadSerializer
from ..security_utils import (
    enforce_rate_limit,
    get_user_by_email,
    revoke_user_human_sessions,
    value_bucket,
)
from vninvest_core.api_envelope import envelope_response
from vninvest_core.exceptions import (
    ValidationErrorException,
    RateLimitErrorException,
)
from data_ingest.tasks import send_password_reset_email
from drf_spectacular.openapi import OpenApiTypes


logger = logging.getLogger(__name__)
User = get_user_model()

#: Legacy body key for the new password. The canonical key is ``new_password``.
#: A1: this view only ever read ``password`` while the frontend adapter posts
#: ``new_password`` + ``new_password_confirm``
#: (``packages/web/src/adapters/core/auth.js:112-116``), so *every* confirm
#: from the real UI returned 400 ``token and password are required.`` Both keys
#: are accepted for one release; drop LEGACY_PASSWORD_KEY once the coordinator
#: confirms no external caller still posts it.
LEGACY_PASSWORD_KEY = 'password'
CANONICAL_PASSWORD_KEY = 'new_password'

#: Per-email request budget for the "send me a reset link" endpoint. Unchanged
#: from the previously hard-coded 3, named so it is a single thing rather than a
#: magic number in the middle of a view.
PASSWORD_RESET_REQUEST_LIMIT = 3


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: envelope_response(DetailPayloadSerializer)},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def password_reset_request_view(request):
    """
    SFI-B2.4a: POST /api/auth/password-reset/
    Body: { "email": "..." }
    Sends password reset link to email (if account exists).

    C1 Fix: Uses PasswordResetToken model (DB-backed) instead of in-memory store.
    Tokens now persist across application restarts.
    B1 Fix: Rate limited to 3 requests per minute per EMAIL (per Checklist H2, OWASP A01 enumeration protection).
    """
    email = str(request.data.get('email', '') or '').strip().lower()
    if not email:
        return Response({'detail': 'email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # A5: the counter used to be `cache.get(key, 0)` for the check and
    # `cache.set(key, count + 1, 60)` to consume it. That read-modify-write is
    # not atomic, so N simultaneous requests all read 0 and all wrote 1 - the
    # limiter was weakest exactly under the load an attacker generates.
    enforce_rate_limit(
        [
            value_bucket(
                'password-reset-email',
                'email',
                email,
                PASSWORD_RESET_REQUEST_LIMIT,
                'Too many password reset requests for this email address. Please try again in 1 minute.',
            ),
        ],
        exception_class=RateLimitErrorException,
        code='password_reset_rate_limit_exceeded',
    )

    # Always return 200 to avoid user enumeration (OWASP A01). This endpoint
    # must have exactly ONE observable shape, because any deviation is an
    # oracle: a 500 (see the guard below) says "this address exists" while a 200
    # says "it does not".
    user = get_user_by_email(email, active_only=True)
    if user:
        try:
            # Generate and save token in DB (survives restart)
            token_obj, raw_token = PasswordResetToken.generate_and_save(email=email, hours=1)

            # C4 Fix: Use validated FRONTEND_URL from settings (required in production)
            # Send email asynchronously via Celery (C3 fix)
            send_password_reset_email.delay(email=email, token=raw_token, frontend_url=settings.FRONTEND_URL)
        except Exception:
            # A broker outage must not change the HTTP status of an
            # enumeration-safe endpoint. The token row stays unused and expires
            # on its own; the user can simply request again.
            logger.exception('password_reset_request: reset-email enqueue failed.')

    return envelope(
        {'detail': 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.'},
        status=status.HTTP_200_OK,
    )


def _read_new_password(payload):
    """Extract the new password, accepting the canonical and the legacy key.

    Returns:
        tuple[str, bool]: ``(password, used_legacy_key)``. The password is
        ``''`` when neither key is present.
    """
    canonical = str(payload.get(CANONICAL_PASSWORD_KEY, '') or '')
    if canonical:
        return canonical, False
    legacy = str(payload.get(LEGACY_PASSWORD_KEY, '') or '')
    if legacy:
        logger.warning(
            'password_reset_confirm: deprecated body key %r used; migrate the caller to %r',
            LEGACY_PASSWORD_KEY,
            CANONICAL_PASSWORD_KEY,
        )
        return legacy, True
    return '', False


def _validate_new_password(password: str, user) -> None:
    """Apply ``AUTH_PASSWORD_VALIDATORS`` and re-raise as the project envelope.

    A2: this replaces the ad-hoc ``len(password) < 8`` guard. Registration
    enforces AUTH_PASSWORD_VALIDATORS (``SaaSRegisterSerializer.validate``) but
    this path did not, which made a password reset the cheapest way to install a
    weak password on an existing account. One policy, applied everywhere.
    """
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        messages = list(exc.messages) or ['Mật khẩu không đáp ứng yêu cầu bảo mật.']
        raise ValidationErrorException(
            detail='Mật khẩu mới không đáp ứng yêu cầu bảo mật.',
            code='weak_password',
            field_errors={
                # Both keys, so a client mapping errors onto its own input finds
                # the message whichever key it sent.
                CANONICAL_PASSWORD_KEY: messages,
                LEGACY_PASSWORD_KEY: messages,
            },
        )


@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: envelope_response(DetailPayloadSerializer)},
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def password_reset_confirm_view(request):
    """
    SFI-B2.4b: POST /api/auth/password-reset/confirm/
    Body: { "token": "...", "new_password": "...", "new_password_confirm": "..." }
    Sets new password for user identified by token.

    C1 Fix: Uses PasswordResetToken model to verify token and mark as used.
    A4-A5 Fix: Uses standard error envelope via exceptions.
    """
    token = str(request.data.get('token', '') or '').strip()
    new_password, _used_legacy_key = _read_new_password(request.data)
    confirm_value = request.data.get('new_password_confirm', None)
    if confirm_value is None:
        confirm_value = request.data.get('password_confirm', None)

    if not token or not new_password:
        missing = [
            name
            for name, value in (('token', token), (CANONICAL_PASSWORD_KEY, new_password))
            if not value
        ]
        raise ValidationErrorException(
            detail='token and password are required.',
            code='validation_error',
            field_errors={name: ['Trường này là bắt buộc.'] for name in missing},
        )

    # A1: the confirm field is compared only when the caller actually sent it.
    # Presence-conditional rather than mandatory, so single-field callers (the
    # repo's own tests, any external client predating the field) keep working;
    # but once the field IS sent the server - not the browser - decides.
    if confirm_value is not None and str(confirm_value) != new_password:
        raise ValidationErrorException(
            detail='Mật khẩu mới nhập lại không khớp.',
            code='password_confirmation_mismatch',
            field_errors={'new_password_confirm': ['Mật khẩu xác nhận không khớp mật khẩu mới.']},
        )

    # Resolve the token and the target user BEFORE consuming the token, so a
    # rejected password does not burn a valid reset link. The authoritative
    # verify-and-mark still runs further down via verify_and_mark_used().
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    pending_token = PasswordResetToken.objects.filter(token_hash=token_hash).first()
    user = get_user_by_email(pending_token.email, active_only=True) if pending_token else None

    if user is not None:
        _validate_new_password(new_password, user)

    # Verify token from DB and mark as used
    try:
        reset_token = PasswordResetToken.verify_and_mark_used(token)
    except ValueError as e:
        raise ValidationErrorException(
            detail=str(e),
            code='invalid_reset_token',
        )

    # A10: resolved through get_user_by_email(), which is deterministic
    # (lowest pk) and cannot raise MultipleObjectsReturned even while duplicate
    # email rows exist - auth_user.email has no unique index.
    if user is None:
        user = get_user_by_email(reset_token.email, active_only=True)
    if user is None:
        raise ValidationErrorException(
            detail='Tài khoản không tồn tại hoặc bị vô hiệu hóa.',
            code='account_unavailable',
        )

    user.set_password(new_password)
    user.save(update_fields=['password', 'updated_at'] if hasattr(user, 'updated_at') else ['password'])

    # A9: a reset must invalidate every credential already issued for the
    # account. Human-session PATs live for 12h by default, so without this an
    # attacker holding a stolen session keeps full access after the victim
    # resets. Nothing is excluded here: the caller proved only possession of the
    # emailed token, so there is no legitimate session to preserve.
    revoked = revoke_user_human_sessions(user, reason='Revoked on password reset')
    logger.info('password_reset_confirm: user=%s revoked %s human session(s)', user.pk, revoked)

    return envelope({'detail': 'Mật khẩu đã được đặt lại thành công.'}, status=status.HTTP_200_OK)
