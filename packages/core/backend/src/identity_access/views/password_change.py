import logging

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from ..models import CorePATCredential
from ..security_utils import (
    enforce_rate_limit,
    revoke_user_human_sessions,
    value_bucket,
)
from vninvest_core.exceptions import ValidationErrorException

logger = logging.getLogger(__name__)

#: Attempts per minute before the endpoint refuses to even look at the password.
#: Unchanged from the previously hard-coded 5.
PASSWORD_CHANGE_ATTEMPT_LIMIT = 5


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def password_change_view(request):
    """
    POST /core/v1/auth/password-change/ — đổi mật khẩu user đang đăng nhập.
    Body: { "current_password": "...", "new_password": "...", "new_password_confirm": "..." }
    Rate limit 5 lần/phút/user để chống brute-force mật khẩu hiện tại.
    """
    user = request.user
    current_password = str(request.data.get('current_password') or '')
    new_password = str(request.data.get('new_password') or '')
    new_password_confirm = str(request.data.get('new_password_confirm') or '')

    if not current_password or not new_password or not new_password_confirm:
        raise ValidationErrorException(
            detail='current_password, new_password và new_password_confirm là bắt buộc.',
        )

    # Every attempt consumes the budget, successful or not - that is the point
    # of this limiter, it exists to bound guesses of `current_password`. Note
    # the deliberate contrast with `register_view`, where the budget is only
    # spent on a real attempt so a typo cannot lock the user out.
    #
    # `exception_class=ValidationErrorException` (400) rather than the default
    # RateLimitErrorException (429): this endpoint's published contract has
    # always been 400 for "too many attempts" and the frontend keys off that.
    enforce_rate_limit(
        [
            value_bucket(
                'password-change-user',
                'user',
                getattr(user, 'pk', 'anon'),
                PASSWORD_CHANGE_ATTEMPT_LIMIT,
                'Quá nhiều lần thử đổi mật khẩu. Vui lòng thử lại sau 1 phút.',
            ),
        ],
        exception_class=ValidationErrorException,
        code='validation_error',
    )

    if not user.check_password(current_password):
        raise ValidationErrorException(
            detail='Mật khẩu hiện tại không đúng.',
        )
    if new_password != new_password_confirm:
        raise ValidationErrorException(
            detail='Mật khẩu mới nhập lại không khớp.',
        )
    # A2: the ad-hoc `len(new_password) < 8` guard is gone. It was the only
    # password policy on this endpoint and it was weaker than the one
    # registration enforces, so a user who set up a compliant account could
    # immediately downgrade it to 8 characters here. Same policy everywhere.
    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        messages = list(exc.messages) or ['Mật khẩu không đáp ứng yêu cầu bảo mật.']
        raise ValidationErrorException(
            detail='Mật khẩu mới không đáp ứng yêu cầu bảo mật.',
            code='weak_password',
            field_errors={'new_password': messages},
        )
    if user.check_password(new_password):
        raise ValidationErrorException(
            detail='Mật khẩu mới phải khác mật khẩu hiện tại.',
        )

    user.set_password(new_password)
    user.save(update_fields=['password'])

    # A9: changing a password is how a user responds to a compromise, so every
    # OTHER session must die. Without this an attacker keeps their stolen
    # human-session PAT (12h default) and the change is cosmetic. The caller's
    # own credential is excluded so they are not logged out of the tab they are
    # using; this is why the reset path passes no exclusion and this one does.
    current_credential = getattr(request, 'auth', None)
    exclude_id = current_credential.id if isinstance(current_credential, CorePATCredential) else None
    revoked = revoke_user_human_sessions(
        user,
        exclude_session_id=exclude_id,
        reason='Revoked on password change',
    )
    logger.info('password_change: user=%s revoked %s other session(s)', user.pk, revoked)
    return Response({'detail': 'Đã đổi mật khẩu thành công.'}, status=status.HTTP_200_OK)
